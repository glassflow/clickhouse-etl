package kafka

import (
	"crypto/tls"
	"crypto/x509"
	"encoding/base64"
	"fmt"
)

func MakeTLSConfigFromStrings(tlsCert, tlsKey, tlsRoot string) (*tls.Config, error) {
	if tlsCert == "" && tlsKey == "" && tlsRoot == "" {
		//nolint: nilnil // don't need sentinel error
		return nil, nil
	}

	//nolint: exhaustruct // optional config
	config := tls.Config{
		MinVersion:               tls.VersionTLS12,
		ClientAuth:               tls.NoClientCert,
		PreferServerCipherSuites: true,
	}

	if tlsRoot != "" {
		// Load CA cert
		caCert, err := base64.StdEncoding.DecodeString(tlsRoot)
		if err != nil {
			return nil, fmt.Errorf("base64 decode tls root: %w", err)
		}
		caCertPool := x509.NewCertPool()
		caCertPool.AppendCertsFromPEM(caCert)
		config.RootCAs = caCertPool
	}

	if tlsCert != "" || tlsKey != "" {
		cert, err := base64.StdEncoding.DecodeString(tlsCert)
		if err != nil {
			return nil, fmt.Errorf("base64 decode tls cert: %w", err)
		}

		key, err := base64.StdEncoding.DecodeString(tlsKey)
		if err != nil {
			return nil, fmt.Errorf("base64 decode tls cert: %w", err)
		}

		tlsCert, err := tls.X509KeyPair(cert, key)
		if err != nil {
			return nil, fmt.Errorf("error loading X509 certificate/key pair: %w", err)
		}

		tlsCert.Leaf, err = x509.ParseCertificate(tlsCert.Certificate[0])
		if err != nil {
			return nil, fmt.Errorf("error parsing certificate: %w", err)
		}

		config.Certificates = []tls.Certificate{tlsCert}
	}

	return &config, nil
}
