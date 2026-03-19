package encryption

import (
	"crypto/rand"
	"testing"
)

func TestNewService(t *testing.T) {
	tests := []struct {
		name    string
		key     []byte
		wantErr bool
	}{
		{
			name:    "valid 32-byte key",
			key:     make([]byte, 32),
			wantErr: false,
		},
		{
			name:    "invalid 16-byte key",
			key:     make([]byte, 16),
			wantErr: true,
		},
		{
			name:    "invalid 64-byte key",
			key:     make([]byte, 64),
			wantErr: true,
		},
		{
			name:    "empty key",
			key:     []byte{},
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if tt.key != nil && len(tt.key) > 0 {
				rand.Read(tt.key)
			}
			_, err := NewService(tt.key)
			if (err != nil) != tt.wantErr {
				t.Errorf("NewService() error = %v, wantErr %v", err, tt.wantErr)
			}
		})
	}
}

func TestService_EncryptDecrypt(t *testing.T) {
	key := make([]byte, 32)
	rand.Read(key)

	service, err := NewService(key)
	if err != nil {
		t.Fatalf("NewService() error = %v", err)
	}

	plaintext := []byte("test data to encrypt")
	ciphertext, err := service.Encrypt(plaintext)
	if err != nil {
		t.Fatalf("Encrypt() error = %v", err)
	}

	if len(ciphertext) <= len(plaintext) {
		t.Errorf("ciphertext should be longer than plaintext")
	}

	decrypted, err := service.Decrypt(ciphertext)
	if err != nil {
		t.Fatalf("Decrypt() error = %v", err)
	}

	if string(decrypted) != string(plaintext) {
		t.Errorf("Decrypt() = %v, want %v", string(decrypted), string(plaintext))
	}
}

func TestService_EncryptDecrypt_UniqueNonce(t *testing.T) {
	key := make([]byte, 32)
	rand.Read(key)

	service, err := NewService(key)
	if err != nil {
		t.Fatalf("NewService() error = %v", err)
	}

	plaintext := []byte("same plaintext")
	ciphertext1, err := service.Encrypt(plaintext)
	if err != nil {
		t.Fatalf("Encrypt() error = %v", err)
	}

	ciphertext2, err := service.Encrypt(plaintext)
	if err != nil {
		t.Fatalf("Encrypt() error = %v", err)
	}

	if string(ciphertext1) == string(ciphertext2) {
		t.Error("encrypted data should be different due to unique nonces")
	}

	decrypted1, err := service.Decrypt(ciphertext1)
	if err != nil {
		t.Fatalf("Decrypt() error = %v", err)
	}

	decrypted2, err := service.Decrypt(ciphertext2)
	if err != nil {
		t.Fatalf("Decrypt() error = %v", err)
	}

	if string(decrypted1) != string(plaintext) || string(decrypted2) != string(plaintext) {
		t.Error("both decrypted values should match plaintext")
	}
}

func TestService_Decrypt_InvalidCiphertext(t *testing.T) {
	key := make([]byte, 32)
	rand.Read(key)

	service, err := NewService(key)
	if err != nil {
		t.Fatalf("NewService() error = %v", err)
	}

	tests := []struct {
		name       string
		ciphertext []byte
	}{
		{
			name:       "too short",
			ciphertext: []byte("short"),
		},
		{
			name:       "corrupted",
			ciphertext: make([]byte, 50),
		},
		{
			name:       "empty",
			ciphertext: []byte{},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if tt.ciphertext != nil && len(tt.ciphertext) > 0 && tt.name == "corrupted" {
				rand.Read(tt.ciphertext)
			}
			_, err := service.Decrypt(tt.ciphertext)
			if err == nil {
				t.Error("Decrypt() should fail for invalid ciphertext")
			}
		})
	}
}

func TestService_WrongKey(t *testing.T) {
	key1 := make([]byte, 32)
	key2 := make([]byte, 32)
	rand.Read(key1)
	rand.Read(key2)

	service1, err := NewService(key1)
	if err != nil {
		t.Fatalf("NewService() error = %v", err)
	}

	service2, err := NewService(key2)
	if err != nil {
		t.Fatalf("NewService() error = %v", err)
	}

	plaintext := []byte("test data")
	ciphertext, err := service1.Encrypt(plaintext)
	if err != nil {
		t.Fatalf("Encrypt() error = %v", err)
	}

	_, err = service2.Decrypt(ciphertext)
	if err == nil {
		t.Error("Decrypt() should fail when using wrong key")
	}
}
