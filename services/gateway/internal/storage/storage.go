package storage

import (
	"context"

	"github.com/tickflow/gateway/internal/models"
)

type PersistedState struct {
	Trades          []models.Trade                `json:"trades"`
	Opportunities   []models.ArbitrageOpportunity `json:"opportunities"`
	RiskConfig      models.RiskConfig             `json:"riskConfig"`
	ExchangeConfigs []models.ExchangeConfigDTO    `json:"exchangeConfigs"`
}

type Repository interface {
	LoadState(ctx context.Context) (*PersistedState, error)
	SaveState(ctx context.Context, state PersistedState) error
	Close(ctx context.Context) error
}

type NoopRepository struct{}

func NewNoopRepository() *NoopRepository {
	return &NoopRepository{}
}

func (r *NoopRepository) LoadState(ctx context.Context) (*PersistedState, error) {
	return nil, nil
}

func (r *NoopRepository) SaveState(ctx context.Context, state PersistedState) error {
	return nil
}

func (r *NoopRepository) Close(ctx context.Context) error {
	return nil
}
