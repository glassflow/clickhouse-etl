// Package message implements the GlassFlow data-plane wire format.
//
// Every NATS data-plane message body (between source stage and sink) is a
// fixed framing of two length-prefixed slots: a "payload" slot carrying the
// in-flight bytes that each processor reads/mutates, followed by an
// immutable "original" slot carrying the raw source payload(s). DLQ writers
// always read from the original slot so re-processing replays source bytes,
// not the post-transform body.
//
// Payload-before-original keeps the hot in-flight bytes adjacent to the
// header — a small cache-locality win on small frames, and a natural fit
// for future tooling that reads only the payload (e.g. very-large records
// where the original is shipped out-of-band).
//
// Message layout:
//
//	offset    size  field
//	------    ----  -------------------------------------------------
//	0         1     flags         (bit 0: multi_source; 1..7 reserved=0)
//	1         4     payload_len   (big-endian u32)
//	5         M     payload
//	5+M       4     original_len  (big-endian u32)
//	9+M       N     original_slot
//
// When flags has bit 0 unset (single_source), original_slot is the raw source
// bytes verbatim. When bit 0 is set (multi_source), original_slot is itself a
// count-prefixed encoding of one or more sources:
//
//	offset  size  field
//	------  ----  -------------------------------------------------
//	0       1     count                 (uint8, >= 1)
//	1       4     source_0_len          (big-endian u32)
//	5       …     source_0_bytes
//	…       4     source_{k-1}_len
//	…       …     source_{k-1}_bytes
//
// Two flows produce a wire frame:
//   - Source / join stages: NewDataPlaneMsg(payload, originals…) → Pack.
//   - Mid-stages: Parse(buf) → SetPayload(new) → Pack.
//
// Pass-through components forward the inbound bytes verbatim and never touch
// either slot.
package message

import (
	"encoding/binary"
	"fmt"
)

const (
	// FlagMultiSource (bit 0) signals the multi-source encoding inside the
	// original slot. Set automatically by Pack when len(originals) > 1. A
	// single-source frame has flags == 0.
	FlagMultiSource byte = 1 << 0

	// flagsReservedMask covers bits 1..7. v1 producers MUST keep these zero
	// and v1 readers MUST reject any non-zero reserved bit. The mask doubles
	// as a sanity check that catches accidental raw-byte publishes: common
	// payload preludes (JSON '{' = 0x7B, JSON '[' = 0x5B, Avro/protobuf
	// headers) all carry non-zero reserved bits.
	//
	// Future format extensions (e.g. compression) will claim bits from this
	// mask one at a time; until then, set bits here are a producer bug.
	flagsReservedMask byte = 0xFE

	// headerSize is the size of the fixed frame prelude: flags + payload_len
	// + original_len. The payload and original bytes sit between/after.
	headerSize = 1 + 4 + 4

	// maxOriginalsCount is the upper bound on the multi-source count byte.
	maxOriginalsCount = 255
)

// DataPlaneMsg is a parsed (or to-be-packed) data-plane wire frame.
//
// Memory & lifetime contract:
//
//   - After Parse, Payload() and Originals() return sub-slices into the
//     buffer that was parsed — no copies. NATS reuses message buffers
//     between fetches, so those slices are only valid until the message is
//     ack'd (or, more conservatively, until the next batch fetch).
//   - After NewDataPlaneMsg, Originals() aliases the caller's argument
//     slice — the constructor does not copy. Lifetime is the caller's.
//
// In both cases the returned bytes are READ-ONLY. Mutating Payload() /
// Originals() return values has undefined effects on the frame, the source
// NATS buffer, and any other holder of the slice.
//
// The type is small (1 byte + three slice headers); pass it by value on the
// hot path. Use SetPayload to swap the payload slot before Pack().
//
// Exactly one of origSlot / originals is populated on a valid msg:
//   - Parse populates origSlot with the encoded slot bytes from the buffer.
//   - NewDataPlaneMsg populates originals with the raw per-source bytes;
//     Pack inline-encodes them into the output buffer.
//
// The zero value packs to a valid empty single-source frame.
type DataPlaneMsg struct {
	flags     byte
	payload   []byte
	origSlot  []byte
	originals [][]byte
}

// Parse reads a wire frame from b. The returned DataPlaneMsg holds sub-slices
// into b; no copies. Returns a typed error on any framing violation; never
// panics.
func Parse(b []byte) (DataPlaneMsg, error) {
	var zero DataPlaneMsg
	if len(b) < headerSize {
		return zero, fmt.Errorf("%w: need at least %d bytes, have %d", ErrShortBuffer, headerSize, len(b))
	}

	flags := b[0]
	if flags&flagsReservedMask != 0 {
		return zero, fmt.Errorf("%w: flags=0x%02x", ErrReservedFlags, flags)
	}

	payloadLen := binary.BigEndian.Uint32(b[1:5])
	payloadEnd := uint64(5) + uint64(payloadLen)
	origLenEnd := payloadEnd + 4
	if origLenEnd > uint64(len(b)) {
		return zero, fmt.Errorf("%w: payload_len=%d exceeds buffer (len=%d)", ErrLenOverflow, payloadLen, len(b))
	}

	payload := b[5:payloadEnd]

	origLen := binary.BigEndian.Uint32(b[payloadEnd:origLenEnd])
	origEnd := origLenEnd + uint64(origLen)
	if origEnd > uint64(len(b)) {
		return zero, fmt.Errorf("%w: original_len=%d exceeds buffer (len=%d)", ErrLenOverflow, origLen, len(b))
	}

	return DataPlaneMsg{
		flags:    flags,
		payload:  payload,
		origSlot: b[origLenEnd:origEnd],
	}, nil
}

// NewDataPlaneMsg constructs a frame in memory from a payload and one or
// more originals. The frame is not encoded until Pack is called.
//
// The wire format is chosen by source count:
//   - 1 original  → single-source frame (flags=0, no inner count prefix)
//   - 2..255      → multi-source frame (flags=FlagMultiSource, count-prefixed)
//
// Returns ErrBadCount when len(originals) == 0 and ErrTooManyOriginals when
// it exceeds 255 (the wire format's single-byte count limit). Source stages
// (ingestor, OTLP receiver) call this with one original; the join component
// calls it with two.
//
// The returned value holds a reference to the originals slice; do not mutate
// the elements between construction and Pack.
func NewDataPlaneMsg(payload []byte, originals ...[]byte) (DataPlaneMsg, error) {
	switch {
	case len(originals) == 0:
		return DataPlaneMsg{}, fmt.Errorf("%w: NewDataPlaneMsg requires at least one original", ErrBadCount)
	case len(originals) > maxOriginalsCount:
		return DataPlaneMsg{}, fmt.Errorf("%w: got %d originals", ErrTooManyOriginals, len(originals))
	}

	flags := byte(0)
	if len(originals) > 1 {
		flags = FlagMultiSource
	}
	return DataPlaneMsg{
		flags:     flags,
		payload:   payload,
		originals: originals,
	}, nil
}

// Payload returns the data-slot bytes. For parsed frames this is a sub-slice
// into the NATS buffer; for constructed frames it aliases the caller's
// argument. In both cases the bytes are READ-ONLY — see the DataPlaneMsg
// memory & lifetime contract. To replace the payload, use SetPayload.
func (m DataPlaneMsg) Payload() []byte { return m.payload }

// SetPayload replaces the data slot. Used by mutating processors between
// Parse and Pack. The original slot and flags are preserved.
func (m *DataPlaneMsg) SetPayload(p []byte) { m.payload = p }

// Originals returns the source payloads carried in the original slot. For
// single-source frames a one-element slice; for multi-source the decoded
// per-source bytes.
//
// The returned [][]byte and its element bytes are READ-ONLY — see the
// DataPlaneMsg memory & lifetime contract. For constructed frames the slice
// aliases the constructor's argument directly (zero allocation); for parsed
// frames the elements are sub-slices into the NATS buffer.
//
// Contract: a valid frame always yields at least one element. An empty/nil
// single-source original yields one entry with empty bytes — DLQ writers
// should iterate and emit one envelope per element regardless of length.
func (m DataPlaneMsg) Originals() ([][]byte, error) {
	// Constructed frame: originals already in slice form, no decode needed.
	if len(m.originals) > 0 {
		return m.originals, nil
	}
	if m.flags&FlagMultiSource == 0 {
		return [][]byte{m.origSlot}, nil
	}

	if len(m.origSlot) < 1 {
		return nil, fmt.Errorf("%w: multi-source slot needs count byte", ErrShortBuffer)
	}

	count := m.origSlot[0]
	if count == 0 {
		return nil, fmt.Errorf("%w: count=0", ErrBadCount)
	}

	srcs := make([][]byte, 0, count)
	pos := uint64(1)
	bound := uint64(len(m.origSlot))

	for i := range int(count) {
		if pos+4 > bound {
			return nil, fmt.Errorf("%w: multi-source[%d] length prefix truncated", ErrShortBuffer, i)
		}
		srcLen := binary.BigEndian.Uint32(m.origSlot[pos : pos+4])
		pos += 4
		end := pos + uint64(srcLen)
		if end > bound {
			return nil, fmt.Errorf("%w: multi-source[%d] len=%d exceeds slot (len=%d)", ErrLenOverflow, i, srcLen, len(m.origSlot))
		}
		srcs = append(srcs, m.origSlot[pos:end])
		pos = end
	}

	return srcs, nil
}

// Flags returns the raw flags byte. Bit 0 (FlagMultiSource) distinguishes
// single-source (0) from multi-source (1); bits 1..7 are reserved for future
// extensions (e.g. compression). Exported so callers like the sink can fast-
// branch on shape without going through Originals().
func (m DataPlaneMsg) Flags() byte { return m.flags }

// Pack encodes the message into a wire frame.
//
// For messages produced by Parse, the original slot is already encoded and
// is copied through byte-identical. For messages produced by NewDataPlaneMsg,
// the originals are encoded inline into the output buffer — single allocation
// regardless of source count.
//
// The payload slot reflects any SetPayload changes since construction/parse.
// The zero-value DataPlaneMsg packs to a valid empty single-source frame.
func (m DataPlaneMsg) Pack() []byte {
	// Path 1: constructed frame — originals carry the raw per-source bytes.
	if len(m.originals) > 0 {
		if len(m.originals) == 1 {
			return writeFrame(0, m.payload, m.originals[0])
		}
		return writeFrameMulti(0, m.payload, m.originals)
	}
	// Path 2: parsed frame (or zero value) — origSlot already encoded.
	return writeFrame(m.flags, m.payload, m.origSlot)
}

// writeFrame writes a wire frame whose original slot is already encoded.
// Used for parsed frames (any flags) and constructed single-source frames
// (where the raw original IS the slot, no inner framing). Callers must
// pass a v1-legal flags byte (reserved bits zero).
func writeFrame(flags byte, payload, slot []byte) []byte {
	out := make([]byte, headerSize+len(payload)+len(slot))
	out[0] = flags
	binary.BigEndian.PutUint32(out[1:5], uint32(len(payload))) //nolint:gosec // bounded by NATS message size
	copy(out[5:], payload)
	origLenOff := 5 + len(payload)
	binary.BigEndian.PutUint32(out[origLenOff:origLenOff+4], uint32(len(slot))) //nolint:gosec // bounded by NATS message size
	copy(out[origLenOff+4:], slot)
	return out
}

// writeFrameMulti writes a multi-source wire frame in a single allocation.
// The count-prefixed slot is materialized directly into the output buffer
// rather than into a temporary. FlagMultiSource is set automatically;
// callers may pass additional flag bits in flags (v1 defines none).
// Callers must pass a v1-legal flags byte (reserved bits zero).
func writeFrameMulti(flags byte, payload []byte, originals [][]byte) []byte {
	flags |= FlagMultiSource

	slotLen := 1 // count byte
	for _, s := range originals {
		slotLen += 4 + len(s)
	}

	out := make([]byte, headerSize+len(payload)+slotLen)
	out[0] = flags
	binary.BigEndian.PutUint32(out[1:5], uint32(len(payload))) //nolint:gosec // bounded by NATS message size
	copy(out[5:], payload)

	origLenOff := 5 + len(payload)
	binary.BigEndian.PutUint32(out[origLenOff:origLenOff+4], uint32(slotLen)) //nolint:gosec // bounded by NATS message size

	pos := origLenOff + 4
	out[pos] = byte(len(originals))
	pos++
	for _, s := range originals {
		binary.BigEndian.PutUint32(out[pos:pos+4], uint32(len(s))) //nolint:gosec // bounded by NATS message size
		pos += 4
		copy(out[pos:], s)
		pos += len(s)
	}
	return out
}
