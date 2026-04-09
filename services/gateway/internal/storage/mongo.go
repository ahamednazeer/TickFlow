package storage

import (
	"context"
	"encoding/json"
	"errors"
	"os"
	"time"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

const latestStateDocumentID = "latest"

type MongoRepository struct {
	client     *mongo.Client
	collection *mongo.Collection
}

type mongoStateDocument struct {
	ID        string    `bson:"_id"`
	Payload   []byte    `bson:"payload"`
	UpdatedAt time.Time `bson:"updatedAt"`
}

func NewMongoRepository(ctx context.Context, uri, database, collection string) (*MongoRepository, error) {
	client, err := mongo.Connect(ctx, options.Client().ApplyURI(uri))
	if err != nil {
		return nil, err
	}

	if err := client.Ping(ctx, nil); err != nil {
		_ = client.Disconnect(ctx)
		return nil, err
	}

	return &MongoRepository{
		client:     client,
		collection: client.Database(database).Collection(collection),
	}, nil
}

func RepositoryFromEnv(ctx context.Context) (Repository, error) {
	uri := os.Getenv("MONGODB_URL")
	if uri == "" {
		return NewNoopRepository(), nil
	}

	database := os.Getenv("MONGODB_DATABASE")
	if database == "" {
		database = "tickflow"
	}

	collection := os.Getenv("MONGODB_COLLECTION")
	if collection == "" {
		collection = "system_state"
	}

	return NewMongoRepository(ctx, uri, database, collection)
}

func (r *MongoRepository) LoadState(ctx context.Context) (*PersistedState, error) {
	var doc mongoStateDocument
	err := r.collection.FindOne(ctx, bson.M{"_id": latestStateDocumentID}).Decode(&doc)
	if errors.Is(err, mongo.ErrNoDocuments) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}

	var state PersistedState
	if err := json.Unmarshal(doc.Payload, &state); err != nil {
		return nil, err
	}
	return &state, nil
}

func (r *MongoRepository) SaveState(ctx context.Context, state PersistedState) error {
	payload, err := json.Marshal(state)
	if err != nil {
		return err
	}

	_, err = r.collection.UpdateOne(
		ctx,
		bson.M{"_id": latestStateDocumentID},
		bson.M{
			"$set": bson.M{
				"payload":   payload,
				"updatedAt": time.Now().UTC(),
			},
		},
		options.Update().SetUpsert(true),
	)
	return err
}

func (r *MongoRepository) Close(ctx context.Context) error {
	return r.client.Disconnect(ctx)
}
