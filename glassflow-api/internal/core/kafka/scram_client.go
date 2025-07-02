package kafka

import (
	"crypto/sha256"
	"crypto/sha512"
	"fmt"

	"github.com/xdg-go/scram"
)

//nolint:gochecknoglobals // build variables
var (
	SHA256 scram.HashGeneratorFcn = sha256.New
	SHA512 scram.HashGeneratorFcn = sha512.New
)

type XDGSCRAMClient struct {
	*scram.Client
	*scram.ClientConversation
	scram.HashGeneratorFcn
}

func (x *XDGSCRAMClient) Begin(userName, password, authzID string) error {
	var err error

	x.Client, err = x.NewClient(userName, password, authzID)
	if err != nil {
		return fmt.Errorf("generate new hash client: %w", err)
	}
	x.ClientConversation = x.NewConversation()
	return nil
}

func (x *XDGSCRAMClient) Step(challenge string) (zero string, _ error) {
	response, err := x.ClientConversation.Step(challenge)
	if err != nil {
		return zero, fmt.Errorf("scram client conversation step: %w", err)
	}
	return response, nil
}

func (x *XDGSCRAMClient) Done() bool {
	return x.ClientConversation.Done()
}
