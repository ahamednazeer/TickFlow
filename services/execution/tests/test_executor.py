import json
import unittest

import executor
from executor import ExecutionEngine, HummingbotConfig, HummingbotClient, RiskLimits, RiskManager, TradeSignal, TradeStatus


class FakeResponse:
    def __init__(self, status: int, payload: dict, content_type: str = "application/json"):
        self.status = status
        self._payload = payload
        self.headers = {"Content-Type": content_type}

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc, tb):
        return False

    async def json(self):
        return self._payload

    async def text(self):
        return json.dumps(self._payload)


class FakeSession:
    def __init__(self, responses):
        self._responses = list(responses)
        self.requests = []
        self.closed = False

    def post(self, url, json=None, headers=None):
        self.requests.append({"url": url, "json": json, "headers": headers})
        if not self._responses:
            raise AssertionError("No fake responses configured")
        return self._responses.pop(0)

    async def close(self):
        self.closed = True


class HummingbotClientTests(unittest.IsolatedAsyncioTestCase):
    async def test_place_order_builds_expected_payload(self):
        session = FakeSession([
            FakeResponse(200, {"orderId": "trade-1-buy-remote", "status": "OPEN"}),
        ])
        config = HummingbotConfig(
            base_url="http://hummingbot:15888",
            default_chain="ethereum",
            default_network="mainnet",
            connector_map={"BINANCE": "binance_spot"},
        )

        async with HummingbotClient(config, session=session) as client:
            result = await client.place_order(
                exchange="BINANCE",
                side="BUY",
                symbol="BTC/USDT",
                quantity=0.25,
                price=100123.45,
                client_order_id="trade-1-buy",
            )

        payload = session.requests[0]["json"]
        self.assertEqual(result.exchange_order_id, "trade-1-buy-remote")
        self.assertEqual(payload["connector"], "binance_spot")
        self.assertEqual(payload["base"], "BTC")
        self.assertEqual(payload["quote"], "USDT")
        self.assertEqual(payload["amount"], "0.25")
        self.assertEqual(payload["price"], "100123.45")
        self.assertEqual(payload["chain"], "ethereum")
        self.assertEqual(payload["network"], "mainnet")


class ExecutionEngineTests(unittest.IsolatedAsyncioTestCase):
    async def test_execute_submits_both_legs_and_returns_executing(self):
        session = FakeSession([
            FakeResponse(200, {"orderId": "buy-remote", "status": "OPEN"}),
            FakeResponse(200, {"orderId": "sell-remote", "status": "OPEN"}),
        ])
        config = HummingbotConfig(base_url="http://hummingbot:15888")
        risk_manager = RiskManager(RiskLimits())
        engine = ExecutionEngine(risk_manager, config)

        async def run_test():
            async with HummingbotClient(config, session=session) as client:
                original_client = executor.HummingbotClient
                try:
                    executor.HummingbotClient = lambda *args, **kwargs: client
                    return await engine.execute(
                        TradeSignal(
                            opportunity_id="opp-1",
                            symbol="BTC/USDT",
                            buy_exchange="BINANCE",
                            sell_exchange="KUCOIN",
                            buy_price=100000.0,
                            sell_price=100250.0,
                            quantity=0.01,
                            expected_profit=2.5,
                            confidence=90,
                            timestamp=1,
                        )
                    )
                finally:
                    executor.HummingbotClient = original_client

        result = await run_test()

        self.assertEqual(result.status, TradeStatus.EXECUTING)
        self.assertEqual(len(session.requests), 2)
        self.assertEqual(result.buy_order_id, "buy-remote")
        self.assertEqual(result.sell_order_id, "sell-remote")
        self.assertEqual(risk_manager.limits.open_trades, 1)

    async def test_execute_marks_trade_failed_when_one_leg_rejects(self):
        session = FakeSession([
            FakeResponse(200, {"orderId": "buy-accepted", "status": "OPEN"}),
            FakeResponse(400, {"message": "sell leg rejected"}),
        ])
        config = HummingbotConfig(base_url="http://hummingbot:15888")
        risk_manager = RiskManager(RiskLimits())
        engine = ExecutionEngine(risk_manager, config)

        async def run_test():
            async with HummingbotClient(config, session=session) as client:
                original_client = executor.HummingbotClient
                try:
                    executor.HummingbotClient = lambda *args, **kwargs: client
                    return await engine.execute(
                        TradeSignal(
                            opportunity_id="opp-2",
                            symbol="BTC/USDT",
                            buy_exchange="BINANCE",
                            sell_exchange="KUCOIN",
                            buy_price=100000.0,
                            sell_price=100250.0,
                            quantity=0.01,
                            expected_profit=2.5,
                            confidence=90,
                            timestamp=2,
                        )
                    )
                finally:
                    executor.HummingbotClient = original_client

        result = await run_test()

        self.assertEqual(result.status, TradeStatus.FAILED)
        self.assertIn("sell leg failed", result.error_message)
        self.assertEqual(risk_manager.limits.open_trades, 0)


if __name__ == "__main__":
    unittest.main()
