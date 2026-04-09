package main

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"strings"
	"time"

	"github.com/tickflow/gateway/internal/handlers"
	"github.com/tickflow/gateway/internal/middleware"
	"github.com/tickflow/gateway/internal/storage"
)

func main() {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	repo, err := storage.RepositoryFromEnv(ctx)
	if err != nil {
		log.Fatalf("failed to initialize storage: %v", err)
	}
	defer func() {
		closeCtx, closeCancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer closeCancel()
		if err := repo.Close(closeCtx); err != nil {
			log.Printf("failed to close storage: %v", err)
		}
	}()

	store := handlers.NewStore(repo)

	mux := http.NewServeMux()

	// ─── Public Routes (no auth) ────────────────────────────
	mux.HandleFunc("POST /api/auth/login", store.Login)

	// ─── Protected Routes (require auth) ────────────────────
	// Auth
	mux.Handle("GET /api/auth/me", middleware.Auth(http.HandlerFunc(store.GetMe)))
	mux.Handle("POST /api/auth/logout", middleware.Auth(http.HandlerFunc(store.Logout)))

	// Market Data
	mux.Handle("GET /api/market/tickers", middleware.Auth(http.HandlerFunc(store.GetTickers)))
	mux.Handle("GET /api/market/orderbooks", middleware.Auth(http.HandlerFunc(store.GetOrderbooks)))

	// Arbitrage
	mux.Handle("GET /api/arbitrage/opportunities", middleware.Auth(http.HandlerFunc(store.GetOpportunities)))

	// Trades
	mux.Handle("GET /api/trades", middleware.Auth(http.HandlerFunc(store.GetTrades)))

	// Risk
	mux.Handle("GET /api/risk/config", middleware.Auth(http.HandlerFunc(store.GetRiskConfig)))
	mux.Handle("PUT /api/risk/config", middleware.Auth(http.HandlerFunc(store.UpdateRiskConfig)))
	mux.Handle("GET /api/risk/metrics", middleware.Auth(http.HandlerFunc(store.GetRiskMetrics)))
	mux.Handle("POST /api/risk/kill-switch", middleware.Auth(http.HandlerFunc(store.ToggleKillSwitch)))

	// System
	mux.Handle("GET /api/system/metrics", middleware.Auth(http.HandlerFunc(store.GetSystemMetrics)))

	// Analytics
	mux.Handle("GET /api/analytics/performance", middleware.Auth(http.HandlerFunc(store.GetPerformanceMetrics)))
	mux.Handle("GET /api/analytics/pnl", middleware.Auth(http.HandlerFunc(store.GetPnLHistory)))
	mux.Handle("GET /api/analytics/exchange-pairs", middleware.Auth(http.HandlerFunc(store.GetExchangePairPerformance)))

	// Settings
	mux.Handle("GET /api/settings/exchanges", middleware.Auth(http.HandlerFunc(store.GetExchangeConfigs)))
	mux.Handle("PUT /api/settings/exchanges/{exchange}", middleware.Auth(http.HandlerFunc(store.UpdateExchangeConfig)))
	mux.Handle("POST /api/settings/exchanges/{exchange}/test", middleware.Auth(http.HandlerFunc(store.TestExchangeConnection)))

	// Apply CORS
	handler := middleware.CORS(mux)

	// Also handle legacy pattern-based routing for Go < 1.22 compatibility
	legacyMux := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Handle exchange-specific settings routes
		if strings.HasPrefix(r.URL.Path, "/api/settings/exchanges/") {
			parts := strings.Split(strings.TrimPrefix(r.URL.Path, "/api/settings/exchanges/"), "/")
			if len(parts) >= 1 {
				if r.Method == "PUT" {
					middleware.Auth(http.HandlerFunc(store.UpdateExchangeConfig)).ServeHTTP(w, r)
					return
				}
				if len(parts) >= 2 && parts[1] == "test" && r.Method == "POST" {
					middleware.Auth(http.HandlerFunc(store.TestExchangeConnection)).ServeHTTP(w, r)
					return
				}
			}
		}
		handler.ServeHTTP(w, r)
	})

	port := ":8080"
	fmt.Println("╔══════════════════════════════════════════╗")
	fmt.Println("║   ⚡ TickFlow API Gateway                ║")
	fmt.Println("║   Listening on http://localhost" + port + "     ║")
	fmt.Println("║                                          ║")
	fmt.Println("║   Auth: POST /api/auth/login             ║")
	fmt.Println("║   Users: admin/admin123, trader/trader123 ║")
	fmt.Println("║                                          ║")
	fmt.Println("║   Market data source: NATS live feeds    ║")
	fmt.Println("╚══════════════════════════════════════════╝")

	log.Fatal(http.ListenAndServe(port, middleware.CORS(legacyMux)))
}
