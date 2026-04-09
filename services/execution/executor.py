"""
TickFlow — Trade Execution Engine
Interfaces with Hummingbot for order placement and management.
"""

import asyncio
import json
import logging
import os
import time
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Optional

import aiohttp
try:
    from nats.aio.client import Client as NATS
except ImportError:  # pragma: no cover - optional at test time
    NATS = None

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)
logger = logging.getLogger('tickflow.executor')


class TradeStatus(Enum):
    PENDING = "PENDING"
    EXECUTING = "EXECUTING"
    FILLED = "FILLED"
    PARTIAL = "PARTIAL"
    FAILED = "FAILED"
    CANCELLED = "CANCELLED"


@dataclass
class TradeSignal:
    """Signal from the scanner engine"""
    opportunity_id: str
    symbol: str
    buy_exchange: str
    sell_exchange: str
    buy_price: float
    sell_price: float
    quantity: float
    expected_profit: float
    confidence: int
    timestamp: int


@dataclass
class TradeResult:
    """Result of trade execution"""
    trade_id: str
    opportunity_id: str
    symbol: str
    buy_exchange: str
    sell_exchange: str
    buy_price: float
    sell_price: float
    buy_filled: float
    sell_filled: float
    quantity: float
    gross_profit: float
    total_fees: float
    net_profit: float
    slippage: float
    status: TradeStatus
    execution_time_ms: int
    error_message: Optional[str] = None
    buy_order_id: Optional[str] = None
    sell_order_id: Optional[str] = None


@dataclass
class RiskLimits:
    """Risk management configuration"""
    max_trade_size: float = 5000.0
    max_daily_loss: float = 500.0
    max_open_trades: int = 5
    min_confidence: int = 70
    kill_switch: bool = False
    daily_pnl: float = 0.0
    open_trades: int = 0


class RiskManager:
    """Validates trades against risk parameters before execution"""

    def __init__(self, limits: RiskLimits):
        self.limits = limits
        self.trade_history: list[TradeResult] = []

    def validate(self, signal: TradeSignal) -> tuple[bool, str]:
        """Check if trade passes risk controls"""

        if self.limits.kill_switch:
            return False, "Kill switch is active"

        if signal.confidence < self.limits.min_confidence:
            return False, f"Confidence {signal.confidence}% below minimum {self.limits.min_confidence}%"

        trade_value = signal.buy_price * signal.quantity
        if trade_value > self.limits.max_trade_size:
            return False, f"Trade size ${trade_value:.2f} exceeds max ${self.limits.max_trade_size:.2f}"

        if self.limits.daily_pnl < -self.limits.max_daily_loss:
            return False, f"Daily loss limit reached: ${self.limits.daily_pnl:.2f}"

        if self.limits.open_trades >= self.limits.max_open_trades:
            return False, f"Max open trades reached: {self.limits.open_trades}/{self.limits.max_open_trades}"

        return True, "OK"

    def mark_trade_open(self):
        self.limits.open_trades += 1

    def record_trade(self, result: TradeResult):
        """Update risk metrics after trade completion"""
        self.trade_history.append(result)

        if result.status in (TradeStatus.FILLED, TradeStatus.PARTIAL):
            self.limits.daily_pnl += result.net_profit

        if result.status not in (TradeStatus.PENDING, TradeStatus.EXECUTING):
            self.limits.open_trades = max(0, self.limits.open_trades - 1)

        logger.info(
            "Risk metrics | Daily P&L: $%.2f | Open trades: %d",
            self.limits.daily_pnl,
            self.limits.open_trades,
        )


@dataclass(frozen=True)
class HummingbotConfig:
    """Runtime config for submitting orders to Hummingbot."""

    base_url: str = "http://localhost:15888"
    order_endpoint: str = "/clob/orders"
    auth_token: Optional[str] = None
    default_chain: Optional[str] = None
    default_network: Optional[str] = None
    default_order_type: str = "LIMIT"
    timeout_seconds: float = 10.0
    connector_map: dict[str, str] = field(default_factory=dict)

    @classmethod
    def from_env(cls) -> "HummingbotConfig":
        raw_mapping = os.getenv("HUMMINGBOT_CONNECTOR_MAP", "")
        connector_map = {
            "BINANCE": "binance",
            "KUCOIN": "kucoin",
            "OKX": "okx",
            "BYBIT": "bybit",
        }
        if raw_mapping:
            try:
                user_mapping = json.loads(raw_mapping)
            except json.JSONDecodeError as exc:
                raise ValueError("HUMMINGBOT_CONNECTOR_MAP must be valid JSON") from exc
            if not isinstance(user_mapping, dict):
                raise ValueError("HUMMINGBOT_CONNECTOR_MAP must decode to an object")
            connector_map.update({str(key).upper(): str(value) for key, value in user_mapping.items()})

        timeout_seconds = float(os.getenv("HUMMINGBOT_TIMEOUT_SECONDS", "10"))
        return cls(
            base_url=os.getenv("HUMMINGBOT_URL", "http://localhost:15888").rstrip("/"),
            order_endpoint=os.getenv("HUMMINGBOT_ORDER_ENDPOINT", "/clob/orders"),
            auth_token=os.getenv("HUMMINGBOT_AUTH_TOKEN"),
            default_chain=os.getenv("HUMMINGBOT_DEFAULT_CHAIN"),
            default_network=os.getenv("HUMMINGBOT_DEFAULT_NETWORK"),
            default_order_type=os.getenv("HUMMINGBOT_ORDER_TYPE", "LIMIT").upper(),
            timeout_seconds=timeout_seconds,
            connector_map=connector_map,
        )

    def connector_for_exchange(self, exchange: str) -> str:
        normalized = exchange.upper()
        return self.connector_map.get(normalized, normalized.lower())


@dataclass
class OrderSubmission:
    client_order_id: str
    exchange_order_id: Optional[str]
    state: str
    raw_response: dict[str, Any]


class HummingbotClientError(Exception):
    """Raised when Hummingbot rejects or cannot process an order request."""


class TradeResultPublisher:
    """Publishes execution results for monitoring and persistence."""

    def __init__(self, nats_url: str, subject: str):
        self.nats_url = nats_url
        self.subject = subject
        self._client: Optional[NATS] = None

    async def connect(self):
        if NATS is None:
            raise RuntimeError("nats client library is not installed")
        self._client = NATS()
        await self._client.connect(servers=[self.nats_url])

    async def close(self):
        if self._client is not None and self._client.is_connected:
            await self._client.close()

    async def publish(self, result: TradeResult):
        if self._client is None or not self._client.is_connected:
            return
        payload = json.dumps(self._to_event_payload(result)).encode()
        await self._client.publish(self.subject, payload)

    @staticmethod
    def _to_event_payload(result: TradeResult) -> dict[str, Any]:
        completed_at = None
        if result.status in (TradeStatus.FAILED, TradeStatus.CANCELLED, TradeStatus.FILLED, TradeStatus.PARTIAL):
            completed_at = int(time.time() * 1000)

        return {
            "id": result.trade_id,
            "opportunityId": result.opportunity_id,
            "symbol": result.symbol,
            "buyExchange": result.buy_exchange,
            "sellExchange": result.sell_exchange,
            "buyPrice": result.buy_price,
            "sellPrice": result.sell_price,
            "buyFilled": result.buy_filled,
            "sellFilled": result.sell_filled,
            "quantity": result.quantity,
            "grossProfit": result.gross_profit,
            "totalFees": result.total_fees,
            "netProfit": result.net_profit,
            "slippage": result.slippage,
            "status": result.status.value,
            "executionTimeMs": result.execution_time_ms,
            "createdAt": int(time.time() * 1000),
            "completedAt": completed_at,
            "errorMessage": result.error_message or "",
        }


class HummingbotClient:
    """Minimal async client for the Hummingbot order endpoint."""

    def __init__(self, config: HummingbotConfig, session: Optional[aiohttp.ClientSession] = None):
        self.config = config
        self._session = session
        self._owns_session = session is None

    async def __aenter__(self) -> "HummingbotClient":
        if self._session is None:
            timeout = aiohttp.ClientTimeout(total=self.config.timeout_seconds)
            self._session = aiohttp.ClientSession(timeout=timeout)
        return self

    async def __aexit__(self, exc_type, exc, tb):
        if self._owns_session and self._session is not None:
            await self._session.close()
            self._session = None

    async def place_order(
        self,
        *,
        exchange: str,
        side: str,
        symbol: str,
        quantity: float,
        price: float,
        client_order_id: str,
    ) -> OrderSubmission:
        if self._session is None:
            raise RuntimeError("HummingbotClient must be used inside an async context manager")

        payload = self._build_order_payload(
            exchange=exchange,
            side=side,
            symbol=symbol,
            quantity=quantity,
            price=price,
            client_order_id=client_order_id,
        )
        url = f"{self.config.base_url}{self.config.order_endpoint}"
        headers = self._build_headers()

        async with self._session.post(url, json=payload, headers=headers) as response:
            data = await self._decode_json(response)
            if response.status >= 400:
                message = self._extract_error_message(data) or f"Hummingbot returned HTTP {response.status}"
                raise HummingbotClientError(message)

        return OrderSubmission(
            client_order_id=client_order_id,
            exchange_order_id=self._extract_order_id(data) or client_order_id,
            state=str(data.get("state") or data.get("status") or "OPEN").upper(),
            raw_response=data,
        )

    def _build_headers(self) -> dict[str, str]:
        headers = {"Content-Type": "application/json"}
        if self.config.auth_token:
            headers["Authorization"] = f"Bearer {self.config.auth_token}"
        return headers

    def _build_order_payload(
        self,
        *,
        exchange: str,
        side: str,
        symbol: str,
        quantity: float,
        price: float,
        client_order_id: str,
    ) -> dict[str, Any]:
        base_asset, quote_asset = self._split_symbol(symbol)

        payload: dict[str, Any] = {
            "connector": self.config.connector_for_exchange(exchange),
            "side": side.upper(),
            "base": base_asset,
            "quote": quote_asset,
            "amount": str(quantity),
            "price": str(price),
            "orderType": self.config.default_order_type,
            "clientOrderId": client_order_id,
        }

        if self.config.default_chain:
            payload["chain"] = self.config.default_chain
        if self.config.default_network:
            payload["network"] = self.config.default_network

        return payload

    @staticmethod
    def _split_symbol(symbol: str) -> tuple[str, str]:
        if "/" in symbol:
            return tuple(symbol.split("/", 1))
        if "-" in symbol:
            return tuple(symbol.split("-", 1))
        raise ValueError(f"Unsupported symbol format: {symbol}")

    @staticmethod
    async def _decode_json(response: aiohttp.ClientResponse) -> dict[str, Any]:
        content_type = response.headers.get("Content-Type", "")
        if "application/json" in content_type:
            return await response.json()

        raw_body = await response.text()
        if not raw_body:
            return {}
        try:
            return json.loads(raw_body)
        except json.JSONDecodeError:
            return {"message": raw_body}

    @staticmethod
    def _extract_order_id(payload: dict[str, Any]) -> Optional[str]:
        for key in ("exchangeOrderId", "orderId", "id", "txHash", "hash"):
            value = payload.get(key)
            if value is not None:
                return str(value)
        return None

    @staticmethod
    def _extract_error_message(payload: dict[str, Any]) -> Optional[str]:
        for key in ("error", "message", "detail"):
            value = payload.get(key)
            if value:
                return str(value)
        return None


class ExecutionEngine:
    """
    Converts validated signals into trade instructions and submits both legs to Hummingbot.
    """

    def __init__(
        self,
        risk_manager: RiskManager,
        hummingbot_config: HummingbotConfig,
        trade_result_publisher: Optional[TradeResultPublisher] = None,
    ):
        self.risk_manager = risk_manager
        self.trade_counter = 0
        self.hummingbot_config = hummingbot_config
        self.trade_result_publisher = trade_result_publisher

    async def execute(self, signal: TradeSignal) -> TradeResult:
        """Execute an arbitrage trade by submitting both legs to Hummingbot."""

        valid, reason = self.risk_manager.validate(signal)
        if not valid:
            logger.warning(f"Trade rejected: {reason}")
            return TradeResult(
                trade_id=f"trade-{self.trade_counter}",
                opportunity_id=signal.opportunity_id,
                symbol=signal.symbol,
                buy_exchange=signal.buy_exchange,
                sell_exchange=signal.sell_exchange,
                buy_price=signal.buy_price,
                sell_price=signal.sell_price,
                buy_filled=0,
                sell_filled=0,
                quantity=signal.quantity,
                gross_profit=0,
                total_fees=0,
                net_profit=0,
                slippage=0,
                status=TradeStatus.CANCELLED,
                execution_time_ms=0,
                error_message=reason,
            )

        self.trade_counter += 1
        trade_id = f"trade-{self.trade_counter}"
        start_time = time.time()
        self.risk_manager.mark_trade_open()

        logger.info(
            "Submitting trade %s | buy %.8f %s on %s @ %.2f | sell %.8f on %s @ %.2f",
            trade_id,
            signal.quantity,
            signal.symbol,
            signal.buy_exchange,
            signal.buy_price,
            signal.quantity,
            signal.sell_exchange,
            signal.sell_price,
        )

        buy_client_order_id = f"{trade_id}-buy"
        sell_client_order_id = f"{trade_id}-sell"

        try:
            async with HummingbotClient(self.hummingbot_config) as hummingbot:
                buy_result, sell_result = await asyncio.gather(
                    hummingbot.place_order(
                        exchange=signal.buy_exchange,
                        side="BUY",
                        symbol=signal.symbol,
                        quantity=signal.quantity,
                        price=signal.buy_price,
                        client_order_id=buy_client_order_id,
                    ),
                    hummingbot.place_order(
                        exchange=signal.sell_exchange,
                        side="SELL",
                        symbol=signal.symbol,
                        quantity=signal.quantity,
                        price=signal.sell_price,
                        client_order_id=sell_client_order_id,
                    ),
                    return_exceptions=True,
                )

            errors = [result for result in (buy_result, sell_result) if isinstance(result, Exception)]
            if errors:
                error_text = self._build_submission_error(buy_result, sell_result)
                raise RuntimeError(error_text)

            execution_time = int((time.time() - start_time) * 1000)
            projected_gross_profit = (signal.sell_price - signal.buy_price) * signal.quantity
            projected_buy_fee = signal.buy_price * signal.quantity * 0.001
            projected_sell_fee = signal.sell_price * signal.quantity * 0.001
            projected_total_fees = projected_buy_fee + projected_sell_fee
            projected_net_profit = projected_gross_profit - projected_total_fees

            result = TradeResult(
                trade_id=trade_id,
                opportunity_id=signal.opportunity_id,
                symbol=signal.symbol,
                buy_exchange=signal.buy_exchange,
                sell_exchange=signal.sell_exchange,
                buy_price=signal.buy_price,
                sell_price=signal.sell_price,
                buy_filled=0,
                sell_filled=0,
                quantity=signal.quantity,
                gross_profit=projected_gross_profit,
                total_fees=projected_total_fees,
                net_profit=projected_net_profit,
                slippage=0,
                status=TradeStatus.EXECUTING,
                execution_time_ms=execution_time,
                buy_order_id=buy_result.exchange_order_id,
                sell_order_id=sell_result.exchange_order_id,
            )

            logger.info(
                "Trade %s submitted in %dms | buy_order=%s | sell_order=%s",
                trade_id,
                execution_time,
                result.buy_order_id,
                result.sell_order_id,
            )
            self.risk_manager.record_trade(result)
            await self._publish_trade_result(result)
            return result

        except Exception as exc:
            execution_time = int((time.time() - start_time) * 1000)
            logger.error("Trade %s failed during submission: %s", trade_id, exc)

            result = TradeResult(
                trade_id=trade_id,
                opportunity_id=signal.opportunity_id,
                symbol=signal.symbol,
                buy_exchange=signal.buy_exchange,
                sell_exchange=signal.sell_exchange,
                buy_price=signal.buy_price,
                sell_price=signal.sell_price,
                buy_filled=0,
                sell_filled=0,
                quantity=signal.quantity,
                gross_profit=0,
                total_fees=0,
                net_profit=0,
                slippage=0,
                status=TradeStatus.FAILED,
                execution_time_ms=execution_time,
                error_message=str(exc),
            )
            self.risk_manager.record_trade(result)
            await self._publish_trade_result(result)
            return result

    async def _publish_trade_result(self, result: TradeResult):
        if self.trade_result_publisher is None:
            return
        try:
            await self.trade_result_publisher.publish(result)
        except Exception as exc:
            logger.error("Failed to publish trade result %s: %s", result.trade_id, exc)

    @staticmethod
    def _build_submission_error(buy_result: Any, sell_result: Any) -> str:
        errors = []
        partial_ids = []

        if isinstance(buy_result, Exception):
            errors.append(f"buy leg failed: {buy_result}")
        elif isinstance(buy_result, OrderSubmission):
            partial_ids.append(f"buy={buy_result.exchange_order_id}")

        if isinstance(sell_result, Exception):
            errors.append(f"sell leg failed: {sell_result}")
        elif isinstance(sell_result, OrderSubmission):
            partial_ids.append(f"sell={sell_result.exchange_order_id}")

        if partial_ids:
            errors.append("successful leg(s) may require manual hedge/cancel: " + ", ".join(partial_ids))

        return " | ".join(errors) if errors else "unknown submission failure"


class OpportunityDeduper:
    """Prevents repeated execution of the same opportunity snapshot."""

    def __init__(self, ttl_ms: int = 30_000):
        self.ttl_ms = ttl_ms
        self.seen: dict[str, int] = {}

    def should_process(self, opportunity_id: str, now_ms: int) -> bool:
        self._prune(now_ms)
        if opportunity_id in self.seen:
            return False
        self.seen[opportunity_id] = now_ms
        return True

    def _prune(self, now_ms: int):
        expired = [key for key, ts in self.seen.items() if now_ms-ts > self.ttl_ms]
        for key in expired:
            del self.seen[key]


async def main():
    """Main execution loop"""
    logger.info("╔══════════════════════════════════════════╗")
    logger.info("║   TickFlow Execution Engine             ║")
    logger.info("║   Risk Manager: ACTIVE                  ║")
    logger.info("║   Hummingbot: LIVE ORDER SUBMISSION     ║")
    logger.info("╚══════════════════════════════════════════╝")

    risk_limits = RiskLimits()
    risk_manager = RiskManager(risk_limits)
    hummingbot_config = HummingbotConfig.from_env()
    publisher = await maybe_create_trade_result_publisher()
    engine = ExecutionEngine(risk_manager, hummingbot_config, publisher)

    logger.info(
        "Execution engine ready | Hummingbot=%s%s",
        hummingbot_config.base_url,
        hummingbot_config.order_endpoint,
    )
    await run_signal_consumer(engine)


async def maybe_create_trade_result_publisher() -> Optional[TradeResultPublisher]:
    nats_url = os.getenv("NATS_URL")
    if not nats_url:
        return None

    subject = os.getenv("TICKFLOW_TRADE_RESULT_SUBJECT", "tickflow.execution.results")
    publisher = TradeResultPublisher(nats_url=nats_url, subject=subject)
    try:
        await publisher.connect()
    except Exception as exc:
        logger.error("Failed to connect trade result publisher to NATS: %s", exc)
        return None
    return publisher


async def run_signal_consumer(engine: ExecutionEngine):
    if NATS is None:
        logger.error("NATS client library is not installed; execution consumer cannot start")
        while True:
            await asyncio.sleep(60)

    nats_url = os.getenv("NATS_URL")
    if not nats_url:
        logger.error("NATS_URL is not configured; execution consumer cannot start")
        while True:
            await asyncio.sleep(60)

    subject = os.getenv("TICKFLOW_OPPORTUNITY_SUBJECT", "tickflow.scanner.opportunities")
    deduper = OpportunityDeduper()
    nc = NATS()
    await nc.connect(servers=[nats_url])
    logger.info("Subscribed to opportunity subject: %s", subject)

    async def handle_message(msg):
        try:
            payload = json.loads(msg.data.decode())
        except Exception as exc:
            logger.error("Failed to decode opportunity message: %s", exc)
            return

        opportunities = payload if isinstance(payload, list) else [payload]
        now_ms = int(time.time() * 1000)

        for opportunity in opportunities:
            try:
                signal = build_trade_signal(opportunity, engine.risk_manager, deduper, now_ms)
            except ValueError as exc:
                logger.debug("Skipping opportunity: %s", exc)
                continue
            asyncio.create_task(engine.execute(signal))

    await nc.subscribe(subject, cb=handle_message)

    while True:
        await asyncio.sleep(60)


def build_trade_signal(
    opportunity: dict[str, Any],
    risk_manager: RiskManager,
    deduper: OpportunityDeduper,
    now_ms: int,
) -> TradeSignal:
    opportunity_id = str(opportunity.get("id") or "")
    if not opportunity_id:
        raise ValueError("missing opportunity id")
    if not deduper.should_process(opportunity_id, now_ms):
        raise ValueError(f"duplicate opportunity {opportunity_id}")
    if opportunity.get("status") not in (None, "VALID"):
        raise ValueError(f"opportunity {opportunity_id} is not valid")

    buy_price = float(opportunity["buyPrice"])
    max_qty_by_value = risk_manager.limits.max_trade_size / buy_price
    liquidity = float(opportunity.get("availableLiquidity") or 0)
    configured_cap = float(os.getenv("EXECUTION_MAX_BTC_QUANTITY", "0.01"))
    quantity = min(liquidity if liquidity > 0 else configured_cap, configured_cap, max_qty_by_value)
    if quantity <= 0:
        raise ValueError(f"opportunity {opportunity_id} has no executable quantity")

    return TradeSignal(
        opportunity_id=opportunity_id,
        symbol=str(opportunity["symbol"]),
        buy_exchange=str(opportunity["buyExchange"]),
        sell_exchange=str(opportunity["sellExchange"]),
        buy_price=buy_price,
        sell_price=float(opportunity["sellPrice"]),
        quantity=quantity,
        expected_profit=float(opportunity.get("netProfit") or 0),
        confidence=int(opportunity.get("confidence") or 0),
        timestamp=int(opportunity.get("detectedAt") or now_ms),
    )


if __name__ == "__main__":
    asyncio.run(main())
