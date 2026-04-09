use serde::{Deserialize, Serialize};
use std::str::FromStr;

/// Supported exchanges
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum Exchange {
    BINANCE,
    KUCOIN,
    OKX,
    BYBIT,
}

impl std::fmt::Display for Exchange {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Exchange::BINANCE => write!(f, "BINANCE"),
            Exchange::KUCOIN => write!(f, "KUCOIN"),
            Exchange::OKX => write!(f, "OKX"),
            Exchange::BYBIT => write!(f, "BYBIT"),
        }
    }
}

impl FromStr for Exchange {
    type Err = String;

    fn from_str(value: &str) -> Result<Self, Self::Err> {
        match value.to_uppercase().as_str() {
            "BINANCE" => Ok(Exchange::BINANCE),
            "KUCOIN" => Ok(Exchange::KUCOIN),
            "OKX" => Ok(Exchange::OKX),
            "BYBIT" => Ok(Exchange::BYBIT),
            other => Err(format!("unsupported exchange: {other}")),
        }
    }
}

/// Live ticker data from an exchange
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TickerData {
    pub exchange: Exchange,
    pub symbol: String,
    pub bid: f64,
    pub ask: f64,
    pub bid_size: f64,
    pub ask_size: f64,
    pub last_price: f64,
    pub volume_24h: f64,
    pub timestamp: i64,
}

/// Orderbook level
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OrderbookLevel {
    pub price: f64,
    pub quantity: f64,
}

/// Detected arbitrage opportunity
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ArbitrageOpportunity {
    pub id: String,
    pub symbol: String,
    pub buy_exchange: Exchange,
    pub sell_exchange: Exchange,
    pub buy_price: f64,
    pub sell_price: f64,
    pub spread: f64,
    pub spread_percent: f64,
    pub buy_fee: f64,
    pub sell_fee: f64,
    pub total_fees: f64,
    pub net_profit: f64,
    pub net_profit_percent: f64,
    pub confidence: u8,
    pub available_liquidity: f64,
    pub estimated_slippage: f64,
    pub status: String,
    pub detected_at: i64,
}

/// Fee structure per exchange
#[derive(Debug, Clone)]
pub struct FeeModel {
    pub maker_fee: f64,
    pub taker_fee: f64,
    pub withdrawal_fee_btc: f64,
}

impl FeeModel {
    pub fn for_exchange(exchange: Exchange) -> Self {
        match exchange {
            Exchange::BINANCE => FeeModel {
                maker_fee: 0.001,
                taker_fee: 0.001,
                withdrawal_fee_btc: 0.0005,
            },
            Exchange::KUCOIN => FeeModel {
                maker_fee: 0.001,
                taker_fee: 0.001,
                withdrawal_fee_btc: 0.0005,
            },
            Exchange::OKX => FeeModel {
                maker_fee: 0.0008,
                taker_fee: 0.001,
                withdrawal_fee_btc: 0.0004,
            },
            Exchange::BYBIT => FeeModel {
                maker_fee: 0.001,
                taker_fee: 0.001,
                withdrawal_fee_btc: 0.0005,
            },
        }
    }
}

/// Scanner configuration
#[derive(Debug, Clone)]
pub struct ScannerConfig {
    pub min_spread_percent: f64,
    pub min_confidence: u8,
    pub min_liquidity_btc: f64,
    pub max_slippage_percent: f64,
}

impl Default for ScannerConfig {
    fn default() -> Self {
        Self {
            min_spread_percent: 0.05,
            min_confidence: 60,
            min_liquidity_btc: 0.01,
            max_slippage_percent: 0.1,
        }
    }
}
