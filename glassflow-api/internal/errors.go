package internal

import "fmt"

var (
	ErrDLQNotExists    = fmt.Errorf("dlq does not exist")
	ErrNoMessagesInDLQ = fmt.Errorf("no content")

	// Encryption errors
	ErrInvalidKeySize   = fmt.Errorf("encryption key must be exactly 32 bytes for AES-256")
	ErrDecryptionFailed = fmt.Errorf("decryption failed: invalid ciphertext or authentication failed")
)
