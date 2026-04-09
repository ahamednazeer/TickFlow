package middleware

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"net/http"
	"strings"
	"time"
)

type contextKey string

const UserContextKey contextKey = "user"

var jwtSecret = []byte("tickflow-secret-change-in-production")

// CORS middleware
func CORS(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")

		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusOK)
			return
		}

		next.ServeHTTP(w, r)
	})
}

// Auth middleware
func Auth(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		authHeader := r.Header.Get("Authorization")
		if authHeader == "" {
			http.Error(w, `{"message":"Missing authorization header"}`, http.StatusUnauthorized)
			return
		}

		parts := strings.SplitN(authHeader, " ", 2)
		if len(parts) != 2 || parts[0] != "Bearer" {
			http.Error(w, `{"message":"Invalid authorization format"}`, http.StatusUnauthorized)
			return
		}

		token := parts[1]
		username, err := ValidateToken(token)
		if err != nil {
			http.Error(w, `{"message":"Invalid or expired token"}`, http.StatusUnauthorized)
			return
		}

		ctx := context.WithValue(r.Context(), UserContextKey, username)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

// GenerateToken creates a simple HMAC-based token
func GenerateToken(username string) string {
	payload := fmt.Sprintf("%s|%d", username, time.Now().Add(24*time.Hour).Unix())
	mac := hmac.New(sha256.New, jwtSecret)
	mac.Write([]byte(payload))
	sig := hex.EncodeToString(mac.Sum(nil))
	return fmt.Sprintf("%s.%s", payload, sig)
}

// ValidateToken validates the HMAC token
func ValidateToken(token string) (string, error) {
	parts := strings.SplitN(token, ".", 2)
	if len(parts) != 2 {
		return "", fmt.Errorf("invalid token format")
	}

	payload := parts[0]
	sig := parts[1]

	mac := hmac.New(sha256.New, jwtSecret)
	mac.Write([]byte(payload))
	expectedSig := hex.EncodeToString(mac.Sum(nil))

	if !hmac.Equal([]byte(sig), []byte(expectedSig)) {
		return "", fmt.Errorf("invalid signature")
	}

	payloadParts := strings.Split(payload, "|")
	if len(payloadParts) != 2 {
		return "", fmt.Errorf("invalid payload")
	}

	username := payloadParts[0]
	return username, nil
}
