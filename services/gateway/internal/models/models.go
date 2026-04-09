package models

import "time"

// ─── Auth ───────────────────────────────────────────────────

type User struct {
	ID        string    `json:"id"`
	Username  string    `json:"username"`
	Email     string    `json:"email"`
	Password  string    `json:"-"`
	Role      string    `json:"role"`
	CreatedAt time.Time `json:"createdAt"`
}

type LoginRequest struct {
	Username string `json:"username"`
	Password string `json:"password"`
}

type AuthResponse struct {
	Token string `json:"token"`
	User  User   `json:"user"`
}

// ─── Exchange ───────────────────────────────────────────────

type Exchange string

const (
	Binance Exchange = "BINANCE"
	KuCoin  Exchange = "KUCOIN"
	OKX     Exchange = "OKX"
	Bybit   Exchange = "BYBIT"
)

// ─── Market Data ────────────────────────────────────────────

type TickerData struct {
	Exchange  Exchange `json:"exchange"`
	Symbol    string   `json:"symbol"`
	Bid       float64  `json:"bid"`
	Ask       float64  `json:"ask"`
	BidSize   float64  `json:"bidSize"`
	AskSize   float64  `json:"askSize"`
	LastPrice float64  `json:"lastPrice"`
	Volume24h float64  `json:"volume24h"`
	Change24h float64  `json:"change24h"`
	Timestamp int64    `json:"timestamp"`
}

type OrderbookLevel struct {
	Price    float64 `json:"price"`
	Quantity float64 `json:"quantity"`
	Total    float64 `json:"total"`
}

type Orderbook struct {
	Exchange  Exchange         `json:"exchange"`
	Symbol    string           `json:"symbol"`
	Bids      []OrderbookLevel `json:"bids"`
	Asks      []OrderbookLevel `json:"asks"`
	Timestamp int64            `json:"timestamp"`
}

// ─── Arbitrage ──────────────────────────────────────────────

type ArbitrageOpportunity struct {
	ID                 string   `json:"id"`
	Symbol             string   `json:"symbol"`
	BuyExchange        Exchange `json:"buyExchange"`
	SellExchange       Exchange `json:"sellExchange"`
	BuyPrice           float64  `json:"buyPrice"`
	SellPrice          float64  `json:"sellPrice"`
	Spread             float64  `json:"spread"`
	SpreadPercent      float64  `json:"spreadPercent"`
	BuyFee             float64  `json:"buyFee"`
	SellFee            float64  `json:"sellFee"`
	WithdrawalFee      float64  `json:"withdrawalFee"`
	TotalFees          float64  `json:"totalFees"`
	NetProfit          float64  `json:"netProfit"`
	NetProfitPercent   float64  `json:"netProfitPercent"`
	Confidence         int      `json:"confidence"`
	AvailableLiquidity float64  `json:"availableLiquidity"`
	EstimatedSlippage  float64  `json:"estimatedSlippage"`
	Status             string   `json:"status"`
	DetectedAt         int64    `json:"detectedAt"`
	ExpiresAt          int64    `json:"expiresAt"`
}

// ─── Trade ──────────────────────────────────────────────────

type Trade struct {
	ID              string   `json:"id"`
	OpportunityID   string   `json:"opportunityId"`
	Symbol          string   `json:"symbol"`
	BuyExchange     Exchange `json:"buyExchange"`
	SellExchange    Exchange `json:"sellExchange"`
	BuyPrice        float64  `json:"buyPrice"`
	SellPrice       float64  `json:"sellPrice"`
	BuyFilled       float64  `json:"buyFilled"`
	SellFilled      float64  `json:"sellFilled"`
	Quantity        float64  `json:"quantity"`
	GrossProfit     float64  `json:"grossProfit"`
	TotalFees       float64  `json:"totalFees"`
	NetProfit       float64  `json:"netProfit"`
	Slippage        float64  `json:"slippage"`
	Status          string   `json:"status"`
	ExecutionTimeMs int64    `json:"executionTimeMs"`
	CreatedAt       int64    `json:"createdAt"`
	CompletedAt     *int64   `json:"completedAt"`
	ErrorMessage    string   `json:"errorMessage,omitempty"`
}

type TradesResponse struct {
	Trades []Trade `json:"trades"`
	Total  int     `json:"total"`
}

// ─── Risk ───────────────────────────────────────────────────

type RiskConfig struct {
	MaxTradeSize          float64            `json:"maxTradeSize"`
	MaxDailyLoss          float64            `json:"maxDailyLoss"`
	MaxOpenTrades         int                `json:"maxOpenTrades"`
	MinSpreadPercent      float64            `json:"minSpreadPercent"`
	MinConfidence         int                `json:"minConfidence"`
	VolatilityThreshold   float64            `json:"volatilityThreshold"`
	KillSwitch            bool               `json:"killSwitch"`
	PerExchangeAllocation map[Exchange]float64 `json:"perExchangeAllocation"`
}

type RiskMetrics struct {
	CurrentDailyPnL  float64 `json:"currentDailyPnL"`
	DailyLossLimit   float64 `json:"dailyLossLimit"`
	OpenTrades       int     `json:"openTrades"`
	MaxOpenTrades    int     `json:"maxOpenTrades"`
	TotalCapital     float64 `json:"totalCapital"`
	UtilizationPct   float64 `json:"utilizationPercent"`
	VolatilityIndex  float64 `json:"volatilityIndex"`
	IsKillSwitchActive bool  `json:"isKillSwitchActive"`
}

// ─── System ─────────────────────────────────────────────────

type ExchangeConnection struct {
	Exchange         Exchange `json:"exchange"`
	Status           string   `json:"status"`
	LatencyMs        float64  `json:"latencyMs"`
	LastHeartbeat    int64    `json:"lastHeartbeat"`
	MessagesPerSec   int      `json:"messagesPerSecond"`
	ErrorCount       int      `json:"errorCount"`
}

type SystemMetrics struct {
	Uptime                int64                `json:"uptime"`
	AvgLatencyMs          float64              `json:"avgLatencyMs"`
	ScannerCycleMs        float64              `json:"scannerCycleMs"`
	OpportunitiesDetected int                  `json:"opportunitiesDetected"`
	OpportunitiesExecuted int                  `json:"opportunitiesExecuted"`
	TotalTrades           int                  `json:"totalTrades"`
	WinRate               float64              `json:"winRate"`
	TotalProfit           float64              `json:"totalProfit"`
	Connections           []ExchangeConnection `json:"connections"`
}

// ─── Analytics ──────────────────────────────────────────────

type PnLDataPoint struct {
	Timestamp  int64   `json:"timestamp"`
	Profit     float64 `json:"profit"`
	Cumulative float64 `json:"cumulative"`
	TradeCount int     `json:"tradeCount"`
}

type ExchangePairPerformance struct {
	BuyExchange  Exchange `json:"buyExchange"`
	SellExchange Exchange `json:"sellExchange"`
	TotalTrades  int      `json:"totalTrades"`
	WinRate      float64  `json:"winRate"`
	AvgProfit    float64  `json:"avgProfit"`
	TotalProfit  float64  `json:"totalProfit"`
}

type PerformanceMetrics struct {
	TotalTrades      int     `json:"totalTrades"`
	WinningTrades    int     `json:"winningTrades"`
	LosingTrades     int     `json:"losingTrades"`
	WinRate          float64 `json:"winRate"`
	TotalProfit      float64 `json:"totalProfit"`
	AvgProfit        float64 `json:"avgProfit"`
	MaxProfit        float64 `json:"maxProfit"`
	MaxLoss          float64 `json:"maxLoss"`
	AvgExecTime      float64 `json:"avgExecutionTime"`
	SharpeRatio      float64 `json:"sharpeRatio"`
	ProfitFactor     float64 `json:"profitFactor"`
}

// ─── Settings ───────────────────────────────────────────────

type ExchangeConfigDTO struct {
	Exchange   Exchange `json:"exchange"`
	APIKey     string   `json:"apiKey"`
	APISecret  string   `json:"apiSecret"`
	Passphrase string   `json:"passphrase,omitempty"`
	Enabled    bool     `json:"enabled"`
	TestMode   bool     `json:"testMode"`
}
