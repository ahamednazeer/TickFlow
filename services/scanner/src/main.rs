mod engine;
mod models;

use std::env;
use std::str::FromStr;

use async_nats::Client;
use engine::ScannerEngine;
use futures_util::StreamExt;
use models::*;
use tracing::{error, info, warn};

const TICKER_SUBJECT: &str = "tickflow.market.ticker";
const OPPORTUNITY_SUBJECT: &str = "tickflow.scanner.opportunities";

#[tokio::main]
async fn main() {
    tracing_subscriber::fmt()
        .with_target(false)
        .with_timer(tracing_subscriber::fmt::time::time())
        .init();

    let nats_url = env::var("NATS_URL").unwrap_or_else(|_| "nats://127.0.0.1:4222".to_string());
    let publish_subject = env::var("TICKFLOW_OPPORTUNITY_SUBJECT")
        .unwrap_or_else(|_| OPPORTUNITY_SUBJECT.to_string());
    let subscribe_subject =
        env::var("TICKFLOW_TICKER_SUBJECT").unwrap_or_else(|_| TICKER_SUBJECT.to_string());

    info!("TickFlow Scanner Engine starting");
    info!("NATS subscribe subject: {}", subscribe_subject);
    info!("NATS publish subject: {}", publish_subject);

    let config = ScannerConfig::default();
    info!(
        "Config: min_spread={}%, min_confidence={}, min_liquidity={} BTC",
        config.min_spread_percent, config.min_confidence, config.min_liquidity_btc
    );

    let client = connect_nats(&nats_url).await;
    let mut subscription = client
        .subscribe(subscribe_subject.clone())
        .await
        .expect("failed to subscribe to ticker subject");
    let mut engine = ScannerEngine::new(config);

    info!("Scanner engine ready - waiting for real ticker data from ingestion");

    while let Some(message) = subscription.next().await {
        let payload = match std::str::from_utf8(&message.payload) {
            Ok(value) => value,
            Err(err) => {
                warn!("dropping invalid UTF-8 ticker payload: {}", err);
                continue;
            }
        };

        let inbound: InboundTicker = match serde_json::from_str(payload) {
            Ok(value) => value,
            Err(err) => {
                warn!("dropping malformed ticker payload: {}", err);
                continue;
            }
        };

        let ticker = match inbound.try_into_ticker() {
            Ok(value) => value,
            Err(err) => {
                warn!("dropping unsupported ticker payload: {}", err);
                continue;
            }
        };

        engine.update_ticker(ticker);
        let start = std::time::Instant::now();
        let opportunities = engine.scan();
        let valid_count = opportunities.iter().filter(|opp| opp.status == "VALID").count();
        let detected_count = opportunities.len();
        let scan_duration = start.elapsed();

        if detected_count > 0 {
            info!(
                "Scan complete in {:?} - {} detected, {} valid opportunities",
                scan_duration,
                detected_count,
                valid_count
            );
        }

        let payload = match serde_json::to_vec(&opportunities) {
            Ok(value) => value,
            Err(err) => {
                error!("failed to serialize opportunities: {}", err);
                continue;
            }
        };

        if let Err(err) = client
            .publish(publish_subject.clone(), payload.into())
            .await
        {
            error!("failed to publish opportunities: {}", err);
        }
    }
}

async fn connect_nats(nats_url: &str) -> Client {
    async_nats::connect(nats_url)
        .await
        .unwrap_or_else(|err| panic!("failed to connect to NATS at {}: {}", nats_url, err))
}

#[derive(Debug, serde::Deserialize)]
struct InboundTicker {
    exchange: String,
    symbol: String,
    bid: f64,
    ask: f64,
    #[serde(rename = "bidSize")]
    bid_size: f64,
    #[serde(rename = "askSize")]
    ask_size: f64,
    #[serde(rename = "lastPrice")]
    last_price: f64,
    #[serde(rename = "volume24h")]
    volume_24h: f64,
    timestamp: i64,
}

impl InboundTicker {
    fn try_into_ticker(self) -> Result<TickerData, String> {
        Ok(TickerData {
            exchange: Exchange::from_str(&self.exchange)?,
            symbol: self.symbol,
            bid: self.bid,
            ask: self.ask,
            bid_size: self.bid_size,
            ask_size: self.ask_size,
            last_price: self.last_price,
            volume_24h: self.volume_24h,
            timestamp: self.timestamp,
        })
    }
}
