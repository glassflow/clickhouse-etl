package message

import "errors"

// Typed errors returned by Parse, Pack, and DataPlaneMsg.Originals when a
// wire buffer or pack request fails the v1 framing contract. Exported so
// callers (component DLQ paths, tests, future debug tooling) can branch on
// the specific failure mode.
var (
	// ErrReservedFlags reports that one or more reserved flag bits (bits 1..7
	// in v1) were set on the inbound frame. Producers MUST keep these zero.
	ErrReservedFlags = errors.New("dataplane/message: reserved flag bits set")

	// ErrShortBuffer reports that the wire buffer is shorter than the minimum
	// frame header (flags + payload_len + original_len = 9 bytes) or shorter
	// than the bytes declared by a length prefix.
	ErrShortBuffer = errors.New("dataplane/message: buffer truncated")

	// ErrLenOverflow reports that a declared length prefix would read past the
	// end of the surrounding buffer.
	ErrLenOverflow = errors.New("dataplane/message: length prefix overflows buffer")

	// ErrBadCount reports that the originals count is 0. A frame must carry
	// at least one original payload — both at pack time (caller passed zero
	// originals) and at parse time (multi-source slot declared count == 0).
	ErrBadCount = errors.New("dataplane/message: originals count must be >= 1")

	// ErrTooManyOriginals reports that the originals count exceeds 255. The
	// count is a single byte and thus must be <= 255.
	ErrTooManyOriginals = errors.New("dataplane/message: originals count must be <= 255")
)
