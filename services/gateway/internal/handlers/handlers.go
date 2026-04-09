package handlers

import (
	"context"
	"encoding/json"
	"log"
	"math"
	"net/http"
	"os"
	"strconv"
	"sync"
	"time"

	"github.com/nats-io/nats.go"
	"github.com/tickflow/gateway/internal/middleware"
	"github.com/tickflow/gateway/internal/models"
	"github.com/tickflow/gateway/internal/storage"
)

// Store holds in-memory state for the gateway
type Store struct {
	mu              sync.RWMutex
	users           map[string]models.User
	tickers         map[models.Exchange]models.TickerData
	orderbooks      map[models.Exchange]models.Orderbook
	trades          []models.Trade
	opportunities   []models.ArbitrageOpportunity
	riskConfig      models.RiskConfig
	exchangeConfigs map[models.Exchange]models.ExchangeConfigDTO
	connections     []models.ExchangeConnection
	startTime       time.Time
	repo            storage.Repository
	persistRequests chan struct{}
}

func NewStore(repo storage.Repository) *Store {
	s := &Store{
		users: map[string]models.User{
			"admin": {
				ID:        "1",
				Username:  "admin",
				Email:     "admin@tickflow.io",
				Password:  "admin123",
				Role:      "ADMIN",
				CreatedAt: time.Now(),
			},
			"trader": {
				ID:        "2",
				Username:  "trader",
				Email:     "trader@tickflow.io",
				Password:  "trader123",
				Role:      "TRADER",
				CreatedAt: time.Now(),
			},
		},
		tickers:       make(map[models.Exchange]models.TickerData),
		orderbooks:    make(map[models.Exchange]models.Orderbook),
		trades:        []models.Trade{},
		opportunities: []models.ArbitrageOpportunity{},
		riskConfig: models.RiskConfig{
			MaxTradeSize:        5000,
			MaxDailyLoss:        500,
			MaxOpenTrades:       5,
			MinSpreadPercent:    0.05,
			MinConfidence:       70,
			VolatilityThreshold: 0.8,
			KillSwitch:          false,
			PerExchangeAllocation: map[models.Exchange]float64{
				models.Binance: 10000,
				models.KuCoin:  10000,
				models.OKX:     10000,
				models.Bybit:   10000,
			},
		},
		exchangeConfigs: map[models.Exchange]models.ExchangeConfigDTO{
			models.Binance: {Exchange: models.Binance, Enabled: false, TestMode: true},
			models.KuCoin:  {Exchange: models.KuCoin, Enabled: false, TestMode: true},
			models.OKX:     {Exchange: models.OKX, Enabled: false, TestMode: true},
			models.Bybit:   {Exchange: models.Bybit, Enabled: false, TestMode: true},
		},
		connections: []models.ExchangeConnection{
			{Exchange: models.Binance, Status: "disconnected", LatencyMs: 0, LastHeartbeat: 0, MessagesPerSec: 0, ErrorCount: 0},
			{Exchange: models.KuCoin, Status: "disconnected", LatencyMs: 0, LastHeartbeat: 0, MessagesPerSec: 0, ErrorCount: 0},
			{Exchange: models.OKX, Status: "disconnected", LatencyMs: 0, LastHeartbeat: 0, MessagesPerSec: 0, ErrorCount: 0},
			{Exchange: models.Bybit, Status: "disconnected", LatencyMs: 0, LastHeartbeat: 0, MessagesPerSec: 0, ErrorCount: 0},
		},
		startTime:       time.Now(),
		repo:            repo,
		persistRequests: make(chan struct{}, 1),
	}

	s.loadPersistedState()
	go s.persistenceWorker()
	go s.connectionMonitor()
	go s.startNATSConsumers()

	return s
}

func (s *Store) loadPersistedState() {
	if s.repo == nil {
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	state, err := s.repo.LoadState(ctx)
	if err != nil {
		log.Printf("failed to load persisted gateway state: %v", err)
		return
	}
	if state == nil {
		return
	}

	s.trades = append([]models.Trade(nil), state.Trades...)
	s.opportunities = append([]models.ArbitrageOpportunity(nil), state.Opportunities...)
	s.riskConfig = state.RiskConfig
	if len(state.ExchangeConfigs) > 0 {
		s.exchangeConfigs = make(map[models.Exchange]models.ExchangeConfigDTO, len(state.ExchangeConfigs))
		for _, cfg := range state.ExchangeConfigs {
			s.exchangeConfigs[cfg.Exchange] = cfg
		}
	}
}

func (s *Store) persistenceWorker() {
	for range s.persistRequests {
		if s.repo == nil {
			continue
		}

		snapshot := s.snapshotState()
		ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
		if err := s.repo.SaveState(ctx, snapshot); err != nil {
			log.Printf("failed to persist gateway state: %v", err)
		}
		cancel()
	}
}

func (s *Store) requestPersist() {
	select {
	case s.persistRequests <- struct{}{}:
	default:
	}
}

func (s *Store) snapshotState() storage.PersistedState {
	s.mu.RLock()
	defer s.mu.RUnlock()

	exchangeConfigs := make([]models.ExchangeConfigDTO, 0, len(s.exchangeConfigs))
	for _, cfg := range s.exchangeConfigs {
		exchangeConfigs = append(exchangeConfigs, cfg)
	}

	return storage.PersistedState{
		Trades:          append([]models.Trade(nil), s.trades...),
		Opportunities:   append([]models.ArbitrageOpportunity(nil), s.opportunities...),
		RiskConfig:      s.riskConfig,
		ExchangeConfigs: exchangeConfigs,
	}
}

func (s *Store) connectionMonitor() {
	ticker := time.NewTicker(1 * time.Second)
	defer ticker.Stop()

	for range ticker.C {
		now := time.Now().UnixMilli()
		s.mu.Lock()
		for idx := range s.connections {
			if s.connections[idx].LastHeartbeat == 0 || now-s.connections[idx].LastHeartbeat > 10_000 {
				s.connections[idx].Status = "disconnected"
			}
			s.connections[idx].MessagesPerSec = 0
		}
		s.mu.Unlock()
	}
}

func (s *Store) startNATSConsumers() {
	natsURL := os.Getenv("NATS_URL")
	if natsURL == "" {
		natsURL = "nats://127.0.0.1:4222"
	}

	conn, err := nats.Connect(natsURL)
	if err != nil {
		log.Printf("failed to connect gateway to NATS: %v", err)
		return
	}

	tickerSubject := os.Getenv("TICKFLOW_TICKER_SUBJECT")
	if tickerSubject == "" {
		tickerSubject = "tickflow.market.ticker"
	}

	opportunitySubject := os.Getenv("TICKFLOW_OPPORTUNITY_SUBJECT")
	if opportunitySubject == "" {
		opportunitySubject = "tickflow.scanner.opportunities"
	}

	tradeSubject := os.Getenv("TICKFLOW_TRADE_RESULT_SUBJECT")
	if tradeSubject == "" {
		tradeSubject = "tickflow.execution.results"
	}

	if _, err := conn.Subscribe(tickerSubject, func(msg *nats.Msg) {
		s.handleTickerMessage(msg.Data)
	}); err != nil {
		log.Printf("failed to subscribe to ticker subject: %v", err)
	}

	if _, err := conn.Subscribe(opportunitySubject, func(msg *nats.Msg) {
		s.handleOpportunityMessage(msg.Data)
	}); err != nil {
		log.Printf("failed to subscribe to opportunity subject: %v", err)
	}

	if _, err := conn.Subscribe(tradeSubject, func(msg *nats.Msg) {
		s.handleTradeMessage(msg.Data)
	}); err != nil {
		log.Printf("failed to subscribe to trade subject: %v", err)
	}

	log.Printf("gateway subscribed to real-time subjects: %s, %s, %s", tickerSubject, opportunitySubject, tradeSubject)
	select {}
}

func (s *Store) handleTickerMessage(payload []byte) {
	var ticker models.TickerData
	if err := json.Unmarshal(payload, &ticker); err != nil {
		log.Printf("failed to decode ticker payload: %v", err)
		return
	}

	orderbook := models.Orderbook{
		Exchange: ticker.Exchange,
		Symbol:   ticker.Symbol,
		Bids: []models.OrderbookLevel{
			{Price: ticker.Bid, Quantity: ticker.BidSize, Total: ticker.BidSize},
		},
		Asks: []models.OrderbookLevel{
			{Price: ticker.Ask, Quantity: ticker.AskSize, Total: ticker.AskSize},
		},
		Timestamp: ticker.Timestamp,
	}

	s.mu.Lock()
	s.tickers[ticker.Exchange] = ticker
	s.orderbooks[ticker.Exchange] = orderbook
	s.updateConnectionLocked(ticker.Exchange, ticker.Timestamp)
	s.mu.Unlock()
}

func (s *Store) handleOpportunityMessage(payload []byte) {
	var opportunities []models.ArbitrageOpportunity
	if err := json.Unmarshal(payload, &opportunities); err != nil {
		log.Printf("failed to decode opportunity payload: %v", err)
		return
	}

	now := time.Now().UnixMilli()
	for idx := range opportunities {
		if opportunities[idx].DetectedAt == 0 {
			opportunities[idx].DetectedAt = now
		}
		if opportunities[idx].ExpiresAt == 0 {
			opportunities[idx].ExpiresAt = now + 5_000
		}
	}

	s.mu.Lock()
	s.opportunities = opportunities
	s.mu.Unlock()
	s.requestPersist()
}

func (s *Store) handleTradeMessage(payload []byte) {
	var trade models.Trade
	if err := json.Unmarshal(payload, &trade); err != nil {
		log.Printf("failed to decode trade payload: %v", err)
		return
	}

	s.mu.Lock()
	s.trades = append([]models.Trade{trade}, s.trades...)
	if len(s.trades) > 200 {
		s.trades = s.trades[:200]
	}
	s.mu.Unlock()
	s.requestPersist()
}

func (s *Store) updateConnectionLocked(exchange models.Exchange, timestamp int64) {
	for idx := range s.connections {
		if s.connections[idx].Exchange == exchange {
			s.connections[idx].Status = "connected"
			s.connections[idx].LastHeartbeat = timestamp
			s.connections[idx].LatencyMs = math.Max(0, float64(time.Now().UnixMilli()-timestamp))
			s.connections[idx].MessagesPerSec++
			return
		}
	}
}

// ─── Auth Handlers ──────────────────────────────────────────

func (s *Store) Login(w http.ResponseWriter, r *http.Request) {
	var req models.LoginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"message":"Invalid request body"}`, http.StatusBadRequest)
		return
	}

	user, ok := s.users[req.Username]
	if !ok || user.Password != req.Password {
		http.Error(w, `{"message":"Invalid credentials"}`, http.StatusUnauthorized)
		return
	}

	token := middleware.GenerateToken(user.Username)
	resp := models.AuthResponse{Token: token, User: user}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(resp)
}

func (s *Store) GetMe(w http.ResponseWriter, r *http.Request) {
	username, _ := r.Context().Value(middleware.UserContextKey).(string)
	user, ok := s.users[username]
	if !ok {
		http.Error(w, `{"message":"User not found"}`, http.StatusNotFound)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(user)
}

func (s *Store) Logout(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.Write([]byte(`{"message":"Logged out"}`))
}

// ─── Market Handlers ────────────────────────────────────────

func (s *Store) GetTickers(w http.ResponseWriter, r *http.Request) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	tickers := make([]models.TickerData, 0, len(s.tickers))
	for _, t := range s.tickers {
		tickers = append(tickers, t)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(tickers)
}

func (s *Store) GetOrderbooks(w http.ResponseWriter, r *http.Request) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	obs := make([]models.Orderbook, 0, len(s.orderbooks))
	for _, ob := range s.orderbooks {
		obs = append(obs, ob)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(obs)
}

// ─── Arbitrage Handlers ─────────────────────────────────────

func (s *Store) GetOpportunities(w http.ResponseWriter, r *http.Request) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(s.opportunities)
}

// ─── Trade Handlers ─────────────────────────────────────────

func (s *Store) GetTrades(w http.ResponseWriter, r *http.Request) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	offset, _ := strconv.Atoi(r.URL.Query().Get("offset"))
	statusFilter := r.URL.Query().Get("status")

	if limit <= 0 {
		limit = 20
	}

	filtered := s.trades
	if statusFilter != "" {
		var f []models.Trade
		for _, t := range s.trades {
			if t.Status == statusFilter {
				f = append(f, t)
			}
		}
		filtered = f
	}

	total := len(filtered)
	end := offset + limit
	if end > total {
		end = total
	}
	if offset > total {
		offset = total
	}

	result := filtered[offset:end]
	if result == nil {
		result = []models.Trade{}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(models.TradesResponse{Trades: result, Total: total})
}

// ─── Risk Handlers ──────────────────────────────────────────

func (s *Store) GetRiskConfig(w http.ResponseWriter, r *http.Request) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(s.riskConfig)
}

func (s *Store) UpdateRiskConfig(w http.ResponseWriter, r *http.Request) {
	var config models.RiskConfig
	if err := json.NewDecoder(r.Body).Decode(&config); err != nil {
		http.Error(w, `{"message":"Invalid request body"}`, http.StatusBadRequest)
		return
	}

	s.mu.Lock()
	s.riskConfig = config
	s.mu.Unlock()
	s.requestPersist()

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(config)
}

func (s *Store) GetRiskMetrics(w http.ResponseWriter, r *http.Request) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	totalPnL := 0.0
	openTrades := 0
	for _, t := range s.trades {
		totalPnL += t.NetProfit
		if t.Status == "PENDING" || t.Status == "EXECUTING" {
			openTrades++
		}
	}

	metrics := models.RiskMetrics{
		CurrentDailyPnL:    totalPnL,
		DailyLossLimit:     s.riskConfig.MaxDailyLoss,
		OpenTrades:         openTrades,
		MaxOpenTrades:      s.riskConfig.MaxOpenTrades,
		TotalCapital:       40000,
		UtilizationPct:     15.5,
		VolatilityIndex:    0.35,
		IsKillSwitchActive: s.riskConfig.KillSwitch,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(metrics)
}

func (s *Store) ToggleKillSwitch(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Active bool `json:"active"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"message":"Invalid request body"}`, http.StatusBadRequest)
		return
	}

	s.mu.Lock()
	s.riskConfig.KillSwitch = req.Active
	s.mu.Unlock()
	s.requestPersist()

	w.Header().Set("Content-Type", "application/json")
	w.Write([]byte(`{"message":"Kill switch updated"}`))
}

// ─── System Handlers ────────────────────────────────────────

func (s *Store) GetSystemMetrics(w http.ResponseWriter, r *http.Request) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	totalProfit := 0.0
	wins := 0
	for _, t := range s.trades {
		totalProfit += t.NetProfit
		if t.NetProfit > 0 {
			wins++
		}
	}

	winRate := 0.0
	if len(s.trades) > 0 {
		winRate = float64(wins) / float64(len(s.trades)) * 100
	}

	avgLatency := 0.0
	for _, c := range s.connections {
		avgLatency += c.LatencyMs
	}
	if len(s.connections) > 0 {
		avgLatency /= float64(len(s.connections))
	}

	metrics := models.SystemMetrics{
		Uptime:                int64(time.Since(s.startTime).Seconds()),
		AvgLatencyMs:          avgLatency,
		ScannerCycleMs:        3.2,
		OpportunitiesDetected: len(s.opportunities),
		OpportunitiesExecuted: len(s.trades),
		TotalTrades:           len(s.trades),
		WinRate:               winRate,
		TotalProfit:           totalProfit,
		Connections:           s.connections,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(metrics)
}

// ─── Analytics Handlers ─────────────────────────────────────

func (s *Store) GetPerformanceMetrics(w http.ResponseWriter, r *http.Request) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	wins, losses := 0, 0
	totalProfit, maxProfit, maxLoss := 0.0, 0.0, 0.0
	totalExecTime := int64(0)

	for _, t := range s.trades {
		totalProfit += t.NetProfit
		totalExecTime += t.ExecutionTimeMs
		if t.NetProfit > 0 {
			wins++
			if t.NetProfit > maxProfit {
				maxProfit = t.NetProfit
			}
		} else {
			losses++
			if t.NetProfit < maxLoss {
				maxLoss = t.NetProfit
			}
		}
	}

	total := len(s.trades)
	avgProfit, avgExec, winRate := 0.0, 0.0, 0.0
	if total > 0 {
		avgProfit = totalProfit / float64(total)
		avgExec = float64(totalExecTime) / float64(total)
		winRate = float64(wins) / float64(total) * 100
	}

	profitFactor := 1.0
	if maxLoss != 0 {
		profitFactor = math.Abs(totalProfit / maxLoss)
	}

	metrics := models.PerformanceMetrics{
		TotalTrades:   total,
		WinningTrades: wins,
		LosingTrades:  losses,
		WinRate:       winRate,
		TotalProfit:   totalProfit,
		AvgProfit:     avgProfit,
		MaxProfit:     maxProfit,
		MaxLoss:       maxLoss,
		AvgExecTime:   avgExec,
		SharpeRatio:   1.45,
		ProfitFactor:  profitFactor,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(metrics)
}

func (s *Store) GetPnLHistory(w http.ResponseWriter, r *http.Request) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	points := make([]models.PnLDataPoint, 0, 25)
	cumulative := 0.0
	now := time.Now().UTC()

	for i := 24; i >= 0; i-- {
		windowStart := now.Add(-time.Duration(i) * time.Hour).Truncate(time.Hour)
		windowEnd := windowStart.Add(time.Hour)
		profit := 0.0
		tradeCount := 0

		for _, trade := range s.trades {
			tradeTime := time.UnixMilli(trade.CreatedAt).UTC()
			if !tradeTime.Before(windowStart) && tradeTime.Before(windowEnd) {
				profit += trade.NetProfit
				tradeCount++
			}
		}

		cumulative += profit
		points = append(points, models.PnLDataPoint{
			Timestamp:  windowStart.UnixMilli(),
			Profit:     profit,
			Cumulative: cumulative,
			TradeCount: tradeCount,
		})
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(points)
}

func (s *Store) GetExchangePairPerformance(w http.ResponseWriter, r *http.Request) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	exchanges := []models.Exchange{models.Binance, models.KuCoin, models.OKX, models.Bybit}
	pairs := make([]models.ExchangePairPerformance, 0)

	for _, buy := range exchanges {
		for _, sell := range exchanges {
			if buy == sell {
				continue
			}
			trades := 0
			wins := 0
			totalProfit := 0.0
			for _, t := range s.trades {
				if t.BuyExchange == buy && t.SellExchange == sell {
					trades++
					totalProfit += t.NetProfit
					if t.NetProfit > 0 {
						wins++
					}
				}
			}
			if trades > 0 {
				pairs = append(pairs, models.ExchangePairPerformance{
					BuyExchange:  buy,
					SellExchange: sell,
					TotalTrades:  trades,
					WinRate:      float64(wins) / float64(trades) * 100,
					AvgProfit:    totalProfit / float64(trades),
					TotalProfit:  totalProfit,
				})
			}
		}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(pairs)
}

// ─── Settings Handlers ──────────────────────────────────────

func (s *Store) GetExchangeConfigs(w http.ResponseWriter, r *http.Request) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	configs := make([]models.ExchangeConfigDTO, 0, len(s.exchangeConfigs))
	for _, c := range s.exchangeConfigs {
		// Mask secrets
		masked := c
		if c.APIKey != "" {
			masked.APIKey = c.APIKey[:4] + "****"
		}
		if c.APISecret != "" {
			masked.APISecret = "****"
		}
		configs = append(configs, masked)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(configs)
}

func (s *Store) UpdateExchangeConfig(w http.ResponseWriter, r *http.Request) {
	var config models.ExchangeConfigDTO
	if err := json.NewDecoder(r.Body).Decode(&config); err != nil {
		http.Error(w, `{"message":"Invalid request body"}`, http.StatusBadRequest)
		return
	}

	s.mu.Lock()
	s.exchangeConfigs[config.Exchange] = config
	s.mu.Unlock()
	s.requestPersist()

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(config)
}

func (s *Store) TestExchangeConnection(w http.ResponseWriter, r *http.Request) {
	exchangeParam := r.PathValue("exchange")
	if exchangeParam == "" {
		http.Error(w, `{"message":"Exchange is required"}`, http.StatusBadRequest)
		return
	}

	s.mu.RLock()
	defer s.mu.RUnlock()

	var result struct {
		Success   bool    `json:"success"`
		LatencyMs float64 `json:"latencyMs"`
	}

	for _, connection := range s.connections {
		if string(connection.Exchange) == exchangeParam {
			result.Success = connection.Status == "connected"
			result.LatencyMs = connection.LatencyMs
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(result)
			return
		}
	}

	http.Error(w, `{"message":"Exchange not found"}`, http.StatusNotFound)
	return
}
