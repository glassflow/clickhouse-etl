package encryption

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"fmt"
	"io"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal"
)

type Service struct {
	aead cipher.AEAD
}

func NewService(key []byte) (*Service, error) {
	if len(key) != internal.AESKeySize {
		return nil, fmt.Errorf("%w: got %d bytes", internal.ErrInvalidKeySize, len(key))
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
	nonce := make([]byte, s.aead.NonceSize())
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return nil, fmt.Errorf("generate nonce: %w", err)
	}

	ciphertext := s.aead.Seal(nonce, nonce, plaintext, nil)
	return ciphertext, nil
}

func (s *Service) Decrypt(ciphertext []byte) ([]byte, error) {
	nonceSize := s.aead.NonceSize()
	if len(ciphertext) < nonceSize {
		return nil, internal.ErrDecryptionFailed
	}

	nonce, ciphertext := ciphertext[:nonceSize], ciphertext[nonceSize:]
	plaintext, err := s.aead.Open(nil, nonce, ciphertext, nil)
	if err != nil {
		return nil, fmt.Errorf("%w: %v", internal.ErrDecryptionFailed, err)
	}

	return plaintext, nil
}
