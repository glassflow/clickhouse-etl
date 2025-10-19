package kafka

import (
	"encoding/base64"
	"fmt"
	"os"
)

func createTempKeytabFile(keytabContent string) (string, error) {
	// Decode base64 keytab content
	keytabData, err := base64.StdEncoding.DecodeString(keytabContent)
	if err != nil {
		return "", fmt.Errorf("base64 decode keytab content: %w", err)
	}

	// Create temporary keytab file
	tmpFile, err := os.CreateTemp("", "keytab-*.keytab")
	if err != nil {
		return "", fmt.Errorf("create temp keytab file: %w", err)
	}
	defer tmpFile.Close()

	// Write keytab data to file
	if _, err := tmpFile.Write(keytabData); err != nil {
		os.Remove(tmpFile.Name())
		return "", fmt.Errorf("write keytab data: %w", err)
	}

	return tmpFile.Name(), nil
}

func createTempKerberosConfigFile(krb5ConfigContent string) (string, error) {
	// Create temporary krb5 config file
	tmpFile, err := os.CreateTemp("", "krb5-*.conf")
	if err != nil {
		return "", fmt.Errorf("create temp krb5 config file: %w", err)
	}
	defer tmpFile.Close()

	// Write krb5 config data to file
	if _, err := tmpFile.WriteString(krb5ConfigContent); err != nil {
		os.Remove(tmpFile.Name())
		return "", fmt.Errorf("write krb5 config data: %w", err)
	}

	return tmpFile.Name(), nil
}
