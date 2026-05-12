package badger

import (
	"context"
	"testing"
	"time"

	badgerdb "github.com/dgraph-io/badger/v4"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/models"
)

func newTestDB(t *testing.T) *badgerdb.DB {
	t.Helper()
	opts := badgerdb.DefaultOptions("").WithInMemory(true).WithLogger(nil)
	db, err := badgerdb.Open(opts)
	require.NoError(t, err)
	t.Cleanup(func() { db.Close() })
	return db
}

func msgWithID(id string) models.Message {
	msg := models.Message{Type: models.MessageTypeNatsMsg}
	msg.SetHeader("Nats-Msg-Id", id)
	return msg
}

func TestDeduplicator_FilterAndSave_SingleKey(t *testing.T) {
	d := NewDeduplicator(newTestDB(t), time.Minute)
	ctx := context.Background()

	msgs := []models.Message{msgWithID("id-1"), msgWithID("id-2")}

	filtered, err := d.FilterDuplicates(ctx, msgs)
	require.NoError(t, err)
	assert.Len(t, filtered, 2)

	require.NoError(t, d.SaveKeys(ctx, msgs))

	// Both are now duplicates
	filtered, err = d.FilterDuplicates(ctx, msgs)
	require.NoError(t, err)
	assert.Empty(t, filtered)
}

func TestDeduplicator_FilterAndSave_ArrayMultikey(t *testing.T) {
	// Verifies that gjson array multipath values (e.g. ["u1","s1"]) work as badger keys.
	// The key is just a string — badger accepts any byte slice — so this should work fine.
	d := NewDeduplicator(newTestDB(t), time.Minute)
	ctx := context.Background()

	// Simulate what setupNatsDedupHeader produces for field name `[user_id,session_id]`
	arrKey1 := `["u1","s1"]`
	arrKey2 := `["u2","s2"]`
	msgs := []models.Message{msgWithID(arrKey1), msgWithID(arrKey2)}

	filtered, err := d.FilterDuplicates(ctx, msgs)
	require.NoError(t, err)
	assert.Len(t, filtered, 2, "unseen array-key messages should pass through")

	require.NoError(t, d.SaveKeys(ctx, msgs))

	filtered, err = d.FilterDuplicates(ctx, msgs)
	require.NoError(t, err)
	assert.Empty(t, filtered, "seen array-key messages should be deduplicated")
}

func TestDeduplicator_ObjectMultikeyOrderMatters(t *testing.T) {
	// Documents the object multipath bug: same field values, different query key order
	// → different Nats-Msg-Id strings → badger treats them as distinct → no dedup.
	d := NewDeduplicator(newTestDB(t), time.Minute)
	ctx := context.Background()

	// These represent the same logical message but with {a,b} vs {b,a} field order in the gjson query.
	keyAB := `{"a":"u1","b":"s1"}`
	keyBA := `{"b":"s1","a":"u1"}`

	msgAB := msgWithID(keyAB)
	msgBA := msgWithID(keyBA)

	require.NoError(t, d.SaveKeys(ctx, []models.Message{msgAB}))

	// msgBA has a different string so it is NOT filtered — dedup fails silently
	filtered, err := d.FilterDuplicates(ctx, []models.Message{msgBA})
	require.NoError(t, err)
	assert.Len(t, filtered, 1, "object multipath with different key order bypasses dedup — this is the bug")
}
