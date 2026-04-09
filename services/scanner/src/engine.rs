use std::collections::HashMap;
use crate::models::*;
use chrono::Utc;

/// Core arbitrage detection engine
/// Designed for microsecond-level performance with zero allocations in hot path
pub struct ScannerEngine {
    config: ScannerConfig,
    fee_models: HashMap<Exchange, FeeModel>,
    ticker_cache: HashMap<Exchange, TickerData>,
    opportunity_counter: u64,
}

impl ScannerEngine {
    pub fn new(config: ScannerConfig) -> Self {
        let exchanges = vec![
            Exchange::BINANCE,
            Exchange::KUCOIN,
            Exchange::OKX,
            Exchange::BYBIT,
        ];

        let fee_models: HashMap<Exchange, FeeModel> = exchanges
            .iter()
            .map(|&ex| (ex, FeeModel::for_exchange(ex)))
            .collect();

        Self {
            config,
            fee_models,
            ticker_cache: HashMap::new(),
            opportunity_counter: 0,
        }
    }

    /// Update ticker cache with latest data from an exchange
    pub fn update_ticker(&mut self, ticker: TickerData) {
        self.ticker_cache.insert(ticker.exchange, ticker);
    }

    /// Scan all exchange pairs for arbitrage opportunities
    /// This is the HOT PATH — must complete in < 5ms
    pub fn scan(&mut self) -> Vec<ArbitrageOpportunity> {
        let mut opportunities = Vec::new();
        let exchanges: Vec<Exchange> = self.ticker_cache.keys().cloned().collect();

        for &buy_exchange in &exchanges {
            for &sell_exchange in &exchanges {
                if buy_exchange == sell_exchange {
                    continue;
                }

                if let Some(opp) = self.evaluate_pair(buy_exchange, sell_exchange) {
                    opportunities.push(opp);
                }
            }
        }

        // Sort by net profit descending
        opportunities.sort_by(|a, b| b.net_profit.partial_cmp(&a.net_profit).unwrap());
        opportunities
    }

    /// Evaluate a single exchange pair for arbitrage
    fn evaluate_pair(
        &mut self,
        buy_exchange: Exchange,
        sell_exchange: Exchange,
    ) -> Option<ArbitrageOpportunity> {
        let buy_ticker = self.ticker_cache.get(&buy_exchange)?;
        let sell_ticker = self.ticker_cache.get(&sell_exchange)?;

        // Buy at ask (lowest sell price), Sell at bid (highest buy price)
        let buy_price = buy_ticker.ask;
        let sell_price = sell_ticker.bid;

        if buy_price <= 0.0 || sell_price <= 0.0 {
            return None;
        }

        // 1. Raw spread calculation
        let spread = sell_price - buy_price;
        let spread_percent = (spread / buy_price) * 100.0;

        // Quick reject if spread is too negative
        if spread_percent < -0.5 {
            return None;
        }

        // 2. Fee calculation
        let buy_fee_model = self.fee_models.get(&buy_exchange)?;
        let sell_fee_model = self.fee_models.get(&sell_exchange)?;

        let buy_fee = buy_price * buy_fee_model.taker_fee;
        let sell_fee = sell_price * sell_fee_model.taker_fee;
        let total_fees = buy_fee + sell_fee;

        // 3. Net profit after fees
        let net_profit = spread - total_fees;
        let net_profit_percent = (net_profit / buy_price) * 100.0;

        // 4. Slippage estimation (simplified)
        let min_liquidity = buy_ticker.bid_size.min(sell_ticker.ask_size);
        let estimated_slippage = if min_liquidity > 1.0 {
            0.01
        } else if min_liquidity > 0.1 {
            0.05
        } else {
            0.15
        };

        // 5. Confidence score
        let confidence = self.calculate_confidence(
            spread_percent,
            net_profit_percent,
            min_liquidity,
            estimated_slippage,
        );

        // 6. Apply filters
        let status = if net_profit > 0.0
            && spread_percent >= self.config.min_spread_percent
            && confidence >= self.config.min_confidence
            && min_liquidity >= self.config.min_liquidity_btc
            && estimated_slippage <= self.config.max_slippage_percent
        {
            "VALID"
        } else if spread_percent > 0.0 {
            "DETECTED"
        } else {
            return None; // Don't report clearly unprofitable
        };

        self.opportunity_counter += 1;

        Some(ArbitrageOpportunity {
            id: format!(
                "opp-{}-{}-{}",
                self.opportunity_counter, buy_exchange, sell_exchange
            ),
            symbol: "BTC/USDT".to_string(),
            buy_exchange,
            sell_exchange,
            buy_price,
            sell_price,
            spread,
            spread_percent,
            buy_fee,
            sell_fee,
            total_fees,
            net_profit,
            net_profit_percent,
            confidence,
            available_liquidity: min_liquidity,
            estimated_slippage,
            status: status.to_string(),
            detected_at: Utc::now().timestamp_millis(),
        })
    }

    /// Calculate confidence score (0-100)
    fn calculate_confidence(
        &self,
        spread_percent: f64,
        net_profit_percent: f64,
        liquidity: f64,
        slippage: f64,
    ) -> u8 {
        let mut score = 0.0;

        // Spread contribution (0-30 points)
        score += (spread_percent * 100.0).min(30.0).max(0.0);

        // Net profit contribution (0-30 points)
        score += (net_profit_percent * 150.0).min(30.0).max(0.0);

        // Liquidity contribution (0-20 points)
        score += (liquidity * 10.0).min(20.0).max(0.0);

        // Slippage penalty (0-20 points, higher slippage = lower score)
        score += ((1.0 - slippage * 10.0) * 20.0).min(20.0).max(0.0);

        score.min(100.0).max(0.0) as u8
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_scanner_detects_opportunity() {
        let mut engine = ScannerEngine::new(ScannerConfig::default());

        engine.update_ticker(TickerData {
            exchange: Exchange::BINANCE,
            symbol: "BTC/USDT".to_string(),
            bid: 99990.0,
            ask: 100000.0,
            bid_size: 2.0,
            ask_size: 2.0,
            last_price: 99995.0,
            volume_24h: 5000.0,
            timestamp: Utc::now().timestamp_millis(),
        });

        engine.update_ticker(TickerData {
            exchange: Exchange::KUCOIN,
            symbol: "BTC/USDT".to_string(),
            bid: 100300.0,
            ask: 100310.0,
            bid_size: 1.5,
            ask_size: 1.5,
            last_price: 100305.0,
            volume_24h: 3000.0,
            timestamp: Utc::now().timestamp_millis(),
        });

        let opps = engine.scan();
        assert!(!opps.is_empty());

        let best = &opps[0];
        assert_eq!(best.buy_exchange, Exchange::BINANCE);
        assert_eq!(best.sell_exchange, Exchange::KUCOIN);
        assert!(best.spread > 0.0);
        println!(
            "Detected: Buy {} @ {}, Sell {} @ {}, Net: {:.2}",
            best.buy_exchange, best.buy_price, best.sell_exchange, best.sell_price, best.net_profit
        );
    }

    #[test]
    fn test_scanner_rejects_unprofitable() {
        let mut engine = ScannerEngine::new(ScannerConfig {
            min_spread_percent: 0.5,
            ..ScannerConfig::default()
        });

        // Same price on both exchanges = no opportunity
        engine.update_ticker(TickerData {
            exchange: Exchange::BINANCE,
            symbol: "BTC/USDT".to_string(),
            bid: 100000.0,
            ask: 100010.0,
            bid_size: 2.0,
            ask_size: 2.0,
            last_price: 100005.0,
            volume_24h: 5000.0,
            timestamp: Utc::now().timestamp_millis(),
        });

        engine.update_ticker(TickerData {
            exchange: Exchange::KUCOIN,
            symbol: "BTC/USDT".to_string(),
            bid: 100005.0,
            ask: 100015.0,
            bid_size: 2.0,
            ask_size: 2.0,
            last_price: 100010.0,
            volume_24h: 5000.0,
            timestamp: Utc::now().timestamp_millis(),
        });

        let opps = engine.scan();
        // All should be DETECTED, none VALID (spread too small)
        for opp in &opps {
            assert_ne!(opp.status, "VALID");
        }
    }
}
