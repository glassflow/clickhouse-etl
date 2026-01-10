package encryption

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"errors"
	"fmt"
	"io"
)

const (
	aesKeySize   = 32
	gcmNonceSize = 12
)

var (
	ErrInvalidKeySize   = errors.New("encryption key must be exactly 32 bytes for AES-256")
	ErrDecryptionFailed = errors.New("decryption failed: invalid ciphertext or authentication failed")
)

type Service struct {
	aead cipher.AEAD
}

func NewService(key []byte) (*Service, error) {
	if len(key) != aesKeySize {
		return nil, fmt.Errorf("%w: got %d bytes", ErrInvalidKeySize, len(key))
	}

	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, fmt.Errorf("create AES cipher: %w", err)
	}

	aead, err := cipher.NewGCM(block)
	if err != nil {
		return nil, fmt.Errorf("create GCM: %w", err)
	}

	return &Service{aead: aead}, nil
}

func (s *Service) Encrypt(plaintext []byte) ([]byte, error) {
	nonce := make([]byte, gcmNonceSize)
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return nil, fmt.Errorf("generate nonce: %w", err)
	}

	ciphertext := s.aead.Seal(nonce, nonce, plaintext, nil)
	return ciphertext, nil
}

func (s *Service) Decrypt(ciphertext []byte) ([]byte, error) {
	if len(ciphertext) < gcmNonceSize {
		return nil, ErrDecryptionFailed
	}

	nonce, ciphertext := ciphertext[:gcmNonceSize], ciphertext[gcmNonceSize:]
	plaintext, err := s.aead.Open(nil, nonce, ciphertext, nil)
	if err != nil {
		return nil, fmt.Errorf("%w: %v", ErrDecryptionFailed, err)
	}

	return plaintext, nil
}
