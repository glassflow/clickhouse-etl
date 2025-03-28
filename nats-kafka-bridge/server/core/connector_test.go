package core

import (
	"fmt"
	"testing"

	"github.com/IBM/sarama"
	"github.com/nats-io/nats.go"
	"github.com/stretchr/testify/require"

	"github.com/glassflow/nats-kafka-bridge/server/conf"
	"github.com/glassflow/nats-kafka-bridge/server/logging"
)

func TestNoOp(t *testing.T) {
	conn := &BridgeConnector{}
	require.NoError(t, conn.Start())
	require.NoError(t, conn.Shutdown())
	require.NoError(t, conn.CheckConnections())
}

func TestCalculateKeyInvalidKeyValue(t *testing.T) {
	conn := &BridgeConnector{
		config: conf.ConnectorConfig{
			KeyValue: "[[[",
		},
		bridge: &NATSKafkaBridge{
			logger: logging.NewNATSLogger(logging.Config{}),
		},
		stats: NewConnectorStatsHolder("name", "id"),
	}

	conn.config.KeyType = conf.SubjectRegex
	require.Equal(t, []byte{}, conn.calculateKey("subject", "replyto"))

	conn.config.KeyType = conf.ReplyRegex
	require.Equal(t, []byte{}, conn.calculateKey("subject", "replyto"))
}

func TestConvertFromKafkaToNatsHeadersOk(t *testing.T) {
	conn := &BridgeConnector{
		config: conf.ConnectorConfig{
			KeyValue: "[[[",
		},
		bridge: &NATSKafkaBridge{
			logger: logging.NewNATSLogger(logging.Config{}),
		},
		stats: NewConnectorStatsHolder("name", "id"),
	}

	kHdrs := make([]sarama.RecordHeader, 3)
	kHdrsMap := make(map[string]string)
	i := 0
	for i < len(kHdrs) {
		keyString := fmt.Sprintf("key-%d", i)
		valueString := fmt.Sprintf("value-%d", i)
		kHdrs[i].Key = []byte(keyString)
		kHdrs[i].Value = []byte(valueString)
		i++

		kHdrsMap[keyString] = valueString
	}

	nHdrs := conn.convertFromKafkaToNatsHeaders(kHdrs)
	i = 0
	require.Len(t, nHdrs, 3)
	for nKey, nValue := range nHdrs {
		require.Equal(t, kHdrsMap[nKey], nValue[0])
		i++
	}
}

func TestConvertFromKafkaToNatsHeadersNull(t *testing.T) {
	conn := &BridgeConnector{
		config: conf.ConnectorConfig{
			KeyValue: "[[[",
		},
		bridge: &NATSKafkaBridge{
			logger: logging.NewNATSLogger(logging.Config{}),
		},
		stats: NewConnectorStatsHolder("name", "id"),
	}

	nHdrs := conn.convertFromKafkaToNatsHeaders(nil)
	require.Equal(t, nats.Header{}, nHdrs)
}
