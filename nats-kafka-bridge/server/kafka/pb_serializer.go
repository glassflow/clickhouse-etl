package kafka

import (
	"encoding/binary"
	"fmt"
	"strings"
	"unsafe"

	//nolint:staticcheck // will move away from legacy once support is added
	"github.com/jhump/protoreflect/dynamic"
	"github.com/riferrei/srclient"
)

type pbSerializer interface {
	Serialize(*srclient.Schema, []byte) ([]byte, error)
}

type protobufSerializer struct {
	//nolint: unused // will be overhauled when we start supporting protobuf
	schemaManager protobufSchemaManager
}

func newSerializer() pbSerializer {
	return &protobufSerializer{
		schemaManager: newProtobufSchemaManager(),
	}
}

func (ps *protobufSerializer) Serialize(schema *srclient.Schema, payload []byte) ([]byte, error) {
	// Get the message descriptor from cache or build it
	messageDescriptor, err := schemaManager.getMessageDescriptor(schema)
	if err != nil {
		return nil, err
	}

	// Parse the protobuf json sent as payload and convert it into wire format
	message := dynamic.NewMessage(messageDescriptor)
	err = message.UnmarshalJSON(payload)
	if err != nil {
		return nil, fmt.Errorf("protobuf unmarshal JSON: %w", err)
	}

	indexLenBytes, indexBytes, err := ps.buildMessageIndexes(schema, messageDescriptor.GetFullyQualifiedName())
	if err != nil {
		return nil, err
	}

	protoBytes, err := message.Marshal()
	if err != nil {
		return nil, fmt.Errorf("protobuf marshal to wire: %w", err)
	}

	var serializedPayload []byte
	serializedPayload = append(serializedPayload, indexLenBytes...)
	if len(indexBytes) > 0 {
		serializedPayload = append(serializedPayload, indexBytes...)
	}
	serializedPayload = append(serializedPayload, protoBytes...)
	return serializedPayload, nil
}

func (ps *protobufSerializer) buildMessageIndexes(schema *srclient.Schema, name string) ([]byte, []byte, error) {
	fileDescriptor, err := schemaManager.getFileDescriptor(schema)
	if err != nil {
		return nil, nil, err
	}

	parts := strings.Split(name, ".")
	messageTypes := fileDescriptor.GetMessageTypes()

	var messageIndex []byte
	indexesCount := int64(0)
	for _, part := range parts {
		i := int64(0)
		for _, mType := range messageTypes {
			if mType.GetName() == part {
				indexBuf := make([]byte, unsafe.Sizeof(i))
				bytesLen := int64(binary.PutVarint(indexBuf, i))

				messageIndex = append(messageIndex, indexBuf[:bytesLen]...)
				indexesCount++
				break
			}
			i++
		}
	}

	indexCountBytes := make([]byte, unsafe.Sizeof(indexesCount))
	indexCountBytesSize := binary.PutVarint(indexCountBytes, indexesCount)

	return indexCountBytes[:indexCountBytesSize], messageIndex, nil
}
