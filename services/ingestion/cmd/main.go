package main

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"net/url"
	"os"
	"sync"
	"time"

	"github.com/gorilla/websocket"
	"github.com/nats-io/nats.go"
)

const (
	defaultNATSURL = "nats://127.0.0.1:4222"
	defaultSubject = "tickflow.market.ticker"
)

var exchangeWSEndpoints = map[string]string{
	"BINANCE": "wss://stream.binance.com:9443/ws/btcusdt@bookTicker",
	"OKX":     "wss://ws.okx.com:8443/ws/v5/public",
	"BYBIT":   "wss://stream.bybit.com/v5/public/spot",
}

type NormalizedTicker struct {
	Exchange  string  `json:"exchange"`
	Symbol    string  `json:"symbol"`
	Bid       float64 `json:"bid"`
	Ask       float64 `json:"ask"`
	BidSize   float64 `json:"bidSize"`
	AskSize   float64 `json:"askSize"`
	LastPrice float64 `json:"lastPrice"`
	Volume24h float64 `json:"volume24h"`
	Change24h float64 `json:"change24h"`
	Timestamp int64   `json:"timestamp"`
}

type TickerCache struct {
	mu      sync.RWMutex
	tickers map[string]NormalizedTicker
}

func NewTickerCache() *TickerCache {
	return &TickerCache{tickers: make(map[string]NormalizedTicker)}
}

func (c *TickerCache) Update(ticker NormalizedTicker) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.tickers[ticker.Exchange] = ticker
}

func (c *TickerCache) Snapshot() []NormalizedTicker {
	c.mu.RLock()
	defer c.mu.RUnlock()
	result := make([]NormalizedTicker, 0, len(c.tickers))
	for _, ticker := range c.tickers {
		result = append(result, ticker)
	}
	return result
}

type Publisher struct {
	subject string
	conn    *nats.Conn
}

func NewPublisher() (*Publisher, error) {
	natsURL := os.Getenv("NATS_URL")
	if natsURL == "" {
		natsURL = defaultNATSURL
	}
	subject := os.Getenv("TICKFLOW_TICKER_SUBJECT")
	if subject == "" {
		subject = defaultSubject
	}

	conn, err := nats.Connect(natsURL)
	if err != nil {
		return nil, err
	}

	return &Publisher{subject: subject, conn: conn}, nil
}

func (p *Publisher) Publish(ticker NormalizedTicker) {
	payload, err := json.Marshal(ticker)
	if err != nil {
		log.Printf("failed to marshal ticker for %s: %v", ticker.Exchange, err)
		return
	}
	if err := p.conn.Publish(p.subject, payload); err != nil {
		log.Printf("failed to publish ticker for %s: %v", ticker.Exchange, err)
	}
}

func (p *Publisher) Close() {
	p.conn.Close()
}

func main() {
	log.Println("╔══════════════════════════════════════════╗")
	log.Println("║   TickFlow Data Ingestion Service       ║")
	log.Println("║   Live feeds: BINANCE, KUCOIN, OKX, BYBIT ║")
	log.Println("╚══════════════════════════════════════════╝")

	publisher, err := NewPublisher()
	if err != nil {
		log.Fatalf("failed to connect to NATS: %v", err)
	}
	defer publisher.Close()

	cache := NewTickerCache()
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	go connectBinance(ctx, cache, publisher)
	go connectKuCoin(ctx, cache, publisher)
	go connectOKX(ctx, cache, publisher)
	go connectBybit(ctx, cache, publisher)

	ticker := time.NewTicker(5 * time.Second)
	defer ticker.Stop()

	for range ticker.C {
		snapshot := cache.Snapshot()
		log.Printf("active live feeds: %d exchanges", len(snapshot))
		for _, t := range snapshot {
			log.Printf("[%s] bid=%.2f ask=%.2f last=%.2f", t.Exchange, t.Bid, t.Ask, t.LastPrice)
		}
	}
}

type BinanceTickerMessage struct {
	Symbol    string `json:"s"`
	BidPrice  string `json:"b"`
	BidQty    string `json:"B"`
	AskPrice  string `json:"a"`
	AskQty    string `json:"A"`
}

func connectBinance(ctx context.Context, cache *TickerCache, publisher *Publisher) {
	wsURL := exchangeWSEndpoints["BINANCE"]
	for {
		if ctx.Err() != nil {
			return
		}

		log.Printf("[BINANCE] connecting to %s", wsURL)
		u, _ := url.Parse(wsURL)
		conn, _, err := websocket.DefaultDialer.Dial(u.String(), nil)
		if err != nil {
			log.Printf("[BINANCE] connect failed: %v", err)
			time.Sleep(5 * time.Second)
			continue
		}

		log.Println("[BINANCE] connected")
		for {
			_, message, err := conn.ReadMessage()
			if err != nil {
				log.Printf("[BINANCE] read error: %v", err)
				_ = conn.Close()
				break
			}

			var msg BinanceTickerMessage
			if err := json.Unmarshal(message, &msg); err != nil {
				continue
			}

			ticker := NormalizedTicker{
				Exchange:  "BINANCE",
				Symbol:    "BTC/USDT",
				Bid:       parseFloat(msg.BidPrice),
				Ask:       parseFloat(msg.AskPrice),
				BidSize:   parseFloat(msg.BidQty),
				AskSize:   parseFloat(msg.AskQty),
				// bookTicker is the correct low-latency feed for top-of-book arbitrage.
				LastPrice: midpoint(parseFloat(msg.BidPrice), parseFloat(msg.AskPrice)),
				Volume24h: 0,
				Change24h: 0,
				Timestamp: time.Now().UnixMilli(),
			}
			cache.Update(ticker)
			publisher.Publish(ticker)
		}

		time.Sleep(3 * time.Second)
	}
}

func connectKuCoin(ctx context.Context, cache *TickerCache, publisher *Publisher) {
	for {
		if ctx.Err() != nil {
			return
		}

		endpoint, token, err := fetchKuCoinBulletToken(ctx)
		if err != nil {
			log.Printf("[KUCOIN] token fetch failed: %v", err)
			time.Sleep(5 * time.Second)
			continue
		}

		wsURL := fmt.Sprintf("%s?token=%s", endpoint, url.QueryEscape(token))
		log.Printf("[KUCOIN] connecting to %s", endpoint)
		conn, _, err := websocket.DefaultDialer.Dial(wsURL, nil)
		if err != nil {
			log.Printf("[KUCOIN] connect failed: %v", err)
			time.Sleep(5 * time.Second)
			continue
		}

		subMsg := map[string]any{
			"id":       time.Now().UnixMilli(),
			"type":     "subscribe",
			"topic":    "/market/ticker:all",
			"response": true,
		}
		subBytes, _ := json.Marshal(subMsg)
		if err := conn.WriteMessage(websocket.TextMessage, subBytes); err != nil {
			log.Printf("[KUCOIN] subscribe failed: %v", err)
			_ = conn.Close()
			time.Sleep(5 * time.Second)
			continue
		}

		log.Println("[KUCOIN] connected")
		go keepAlive(ctx, "[KUCOIN]", 20*time.Second, func() error {
			return conn.WriteMessage(websocket.TextMessage, []byte(`{"type":"ping"}`))
		})

		for {
			_, message, err := conn.ReadMessage()
			if err != nil {
				log.Printf("[KUCOIN] read error: %v", err)
				_ = conn.Close()
				break
			}

			var raw map[string]any
			if err := json.Unmarshal(message, &raw); err != nil {
				continue
			}
			if raw["topic"] != "/market/ticker:all" || raw["subject"] != "BTC-USDT" {
				continue
			}

			data, ok := raw["data"].(map[string]any)
			if !ok {
				continue
			}

			ticker := NormalizedTicker{
				Exchange:  "KUCOIN",
				Symbol:    "BTC/USDT",
				Bid:       getFloat(data, "bestBid"),
				Ask:       getFloat(data, "bestAsk"),
				BidSize:   getFloat(data, "bestBidSize"),
				AskSize:   getFloat(data, "bestAskSize"),
				LastPrice: getFloat(data, "price"),
				Volume24h: 0,
				Change24h: 0,
				Timestamp: time.Now().UnixMilli(),
			}
			cache.Update(ticker)
			publisher.Publish(ticker)
		}

		time.Sleep(3 * time.Second)
	}
}

func connectOKX(ctx context.Context, cache *TickerCache, publisher *Publisher) {
	wsURL := exchangeWSEndpoints["OKX"]
	for {
		if ctx.Err() != nil {
			return
		}

		log.Printf("[OKX] connecting to %s", wsURL)
		conn, _, err := websocket.DefaultDialer.Dial(wsURL, nil)
		if err != nil {
			log.Printf("[OKX] connect failed: %v", err)
			time.Sleep(5 * time.Second)
			continue
		}

		subMsg := map[string]any{
			"op": "subscribe",
			"args": []map[string]string{
				{"channel": "tickers", "instId": "BTC-USDT"},
			},
		}
		subBytes, _ := json.Marshal(subMsg)
		if err := conn.WriteMessage(websocket.TextMessage, subBytes); err != nil {
			log.Printf("[OKX] subscribe failed: %v", err)
			_ = conn.Close()
			time.Sleep(5 * time.Second)
			continue
		}

		log.Println("[OKX] connected")
		for {
			_, message, err := conn.ReadMessage()
			if err != nil {
				log.Printf("[OKX] read error: %v", err)
				_ = conn.Close()
				break
			}

			var raw map[string]any
			if err := json.Unmarshal(message, &raw); err != nil {
				continue
			}

			data, ok := raw["data"].([]any)
			if !ok || len(data) == 0 {
				continue
			}

			tickData, ok := data[0].(map[string]any)
			if !ok {
				continue
			}

			ticker := NormalizedTicker{
				Exchange:  "OKX",
				Symbol:    "BTC/USDT",
				Bid:       getFloat(tickData, "bidPx"),
				Ask:       getFloat(tickData, "askPx"),
				BidSize:   getFloat(tickData, "bidSz"),
				AskSize:   getFloat(tickData, "askSz"),
				LastPrice: getFloat(tickData, "last"),
				Volume24h: getFloat(tickData, "vol24h"),
				Change24h: 0,
				Timestamp: time.Now().UnixMilli(),
			}
			cache.Update(ticker)
			publisher.Publish(ticker)
		}

		time.Sleep(3 * time.Second)
	}
}

func connectBybit(ctx context.Context, cache *TickerCache, publisher *Publisher) {
	wsURL := exchangeWSEndpoints["BYBIT"]
	for {
		if ctx.Err() != nil {
			return
		}

		log.Printf("[BYBIT] connecting to %s", wsURL)
		conn, _, err := websocket.DefaultDialer.Dial(wsURL, nil)
		if err != nil {
			log.Printf("[BYBIT] connect failed: %v", err)
			time.Sleep(5 * time.Second)
			continue
		}

		subMsg := map[string]any{
			"op":   "subscribe",
			"args": []string{"orderbook.1.BTCUSDT"},
		}
		subBytes, _ := json.Marshal(subMsg)
		if err := conn.WriteMessage(websocket.TextMessage, subBytes); err != nil {
			log.Printf("[BYBIT] subscribe failed: %v", err)
			_ = conn.Close()
			time.Sleep(5 * time.Second)
			continue
		}

		log.Println("[BYBIT] connected")
		go keepAlive(ctx, "[BYBIT]", 20*time.Second, func() error {
			return conn.WriteMessage(websocket.TextMessage, []byte(`{"op":"ping"}`))
		})

		for {
			_, message, err := conn.ReadMessage()
			if err != nil {
				log.Printf("[BYBIT] read error: %v", err)
				_ = conn.Close()
				break
			}

			var raw map[string]any
			if err := json.Unmarshal(message, &raw); err != nil {
				continue
			}

			data, ok := raw["data"].(map[string]any)
			if !ok {
				continue
			}

			bidPrice, bidSize := getOrderbookTopLevel(data, "b")
			askPrice, askSize := getOrderbookTopLevel(data, "a")
			ticker := NormalizedTicker{
				Exchange:  "BYBIT",
				Symbol:    "BTC/USDT",
				Bid:       bidPrice,
				Ask:       askPrice,
				BidSize:   bidSize,
				AskSize:   askSize,
				LastPrice: midpoint(bidPrice, askPrice),
				Volume24h: 0,
				Change24h: 0,
				Timestamp: time.Now().UnixMilli(),
			}
			cache.Update(ticker)
			publisher.Publish(ticker)
		}

		time.Sleep(3 * time.Second)
	}
}

func fetchKuCoinBulletToken(ctx context.Context) (string, string, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, "https://api.kucoin.com/api/v1/bullet-public", bytes.NewBuffer(nil))
	if err != nil {
		return "", "", err
	}

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return "", "", err
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", "", err
	}
	if resp.StatusCode >= 400 {
		return "", "", fmt.Errorf("kucoin token endpoint returned %d: %s", resp.StatusCode, string(body))
	}

	var payload struct {
		Data struct {
			Token           string `json:"token"`
			InstanceServers []struct {
				Endpoint string `json:"endpoint"`
			} `json:"instanceServers"`
		} `json:"data"`
	}
	if err := json.Unmarshal(body, &payload); err != nil {
		return "", "", err
	}
	if payload.Data.Token == "" || len(payload.Data.InstanceServers) == 0 {
		return "", "", fmt.Errorf("kucoin token response missing endpoint or token")
	}
	return payload.Data.InstanceServers[0].Endpoint, payload.Data.Token, nil
}

func keepAlive(ctx context.Context, label string, interval time.Duration, fn func() error) {
	ticker := time.NewTicker(interval)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			if err := fn(); err != nil {
				log.Printf("%s heartbeat failed: %v", label, err)
				return
			}
		}
	}
}

func parseFloat(s string) float64 {
	var f float64
	fmt.Sscanf(s, "%f", &f)
	return f
}

func midpoint(a float64, b float64) float64 {
	if a <= 0 && b <= 0 {
		return 0
	}
	if a <= 0 {
		return b
	}
	if b <= 0 {
		return a
	}
	return (a + b) / 2
}

func getFloat(m map[string]any, key string) float64 {
	v, ok := m[key]
	if !ok {
		return 0
	}
	switch val := v.(type) {
	case float64:
		return val
	case string:
		return parseFloat(val)
	default:
		return 0
	}
}

func getOrderbookTopLevel(m map[string]any, key string) (float64, float64) {
	rawLevels, ok := m[key].([]any)
	if !ok || len(rawLevels) == 0 {
		return 0, 0
	}

	level, ok := rawLevels[0].([]any)
	if !ok || len(level) < 2 {
		return 0, 0
	}

	price := toFloat(level[0])
	size := toFloat(level[1])
	return price, size
}

func toFloat(v any) float64 {
	switch val := v.(type) {
	case float64:
		return val
	case string:
		return parseFloat(val)
	default:
		return 0
	}
}
