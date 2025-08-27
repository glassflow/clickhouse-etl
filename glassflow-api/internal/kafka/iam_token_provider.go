package kafka

import (
	"context"
	"fmt"

	"github.com/IBM/sarama"
	"github.com/aws/aws-msk-iam-sasl-signer-go/signer"
)

type MSKAccessTokenProvider struct {
	Region string // AWS IAM region
}

func (m *MSKAccessTokenProvider) Token() (*sarama.AccessToken, error) {
	token, _, err := signer.GenerateAuthToken(context.TODO(), m.Region)
	if err != nil {
		return nil, fmt.Errorf("generate aws access token: %w", err)
	}
	//nolint: exhaustruct // optional config
	return &sarama.AccessToken{Token: token}, nil
}
