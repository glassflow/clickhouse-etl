# Encryption Package

This package provides encryption services for connection credentials stored in PostgreSQL.

## Overview

Connection details (Kafka and ClickHouse credentials) are encrypted using **AES-256-GCM** before being stored in PostgreSQL. The encryption key is managed via Kubernetes Secrets and mounted as a file in the API pod.

## Encryption Algorithm

- **Algorithm**: AES-256-GCM (Galois/Counter Mode)
- **Key Size**: 32 bytes (256 bits)
- **Nonce Size**: 12 bytes (generated randomly for each encryption)
- **Authentication**: Built-in authentication tag (16 bytes) prevents tampering

## Key Management

Users can provide their own encryption key via the Helm chart, or GlassFlow will automatically generate one during installation. The key is stored in a Kubernetes Secret and mounted as a file at `/etc/glassflow/secrets/encryption-key`.

## Usage

The encryption service is initialized with a 32-byte key and provides methods to encrypt/decrypt data:

```go
service, err := encryption.NewService(key)
encrypted, err := service.Encrypt(plaintext)
decrypted, err := service.Decrypt(encrypted)
```
