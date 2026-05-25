package message

import (
	"bytes"
	"encoding/binary"
	"errors"
	"fmt"
	"testing"

	"github.com/stretchr/testify/require"
)

// packForTest is a tiny helper to keep test setup terse: it runs the
// NewDataPlaneMsg → Pack flow and fails the test on error.
func packForTest(t *testing.T, payload []byte, originals ...[]byte) []byte {
	t.Helper()
	m, err := NewDataPlaneMsg(payload, originals...)
	require.NoError(t, err)
	return m.Pack()
}

func TestRoundTripSingleSource(t *testing.T) {
	orig := []byte(`{"id":1,"v":"src"}`)
	data := []byte(`{"id":1,"v":"transformed"}`)

	buf := packForTest(t, data, orig)
	m, err := Parse(buf)
	require.NoError(t, err)
	require.Equal(t, byte(0), m.Flags(), "1-original New must write a single-source frame")
	require.True(t, bytes.Equal(data, m.Payload()))

	srcs, err := m.Originals()
	require.NoError(t, err)
	require.Len(t, srcs, 1)
	require.True(t, bytes.Equal(orig, srcs[0]))
}

func TestRoundTripMultiSource(t *testing.T) {
	left := []byte(`{"side":"left"}`)
	right := []byte(`{"side":"right"}`)
	data := []byte(`{"joined":true}`)

	buf := packForTest(t, data, left, right)
	m, err := Parse(buf)
	require.NoError(t, err)
	require.Equal(t, FlagMultiSource, m.Flags()&FlagMultiSource, "2-original New must set multi-source flag")
	require.True(t, bytes.Equal(data, m.Payload()))

	srcs, err := m.Originals()
	require.NoError(t, err)
	require.Len(t, srcs, 2)
	require.True(t, bytes.Equal(left, srcs[0]))
	require.True(t, bytes.Equal(right, srcs[1]))
}

func TestRepackInvariant(t *testing.T) {
	tests := []struct {
		name      string
		originals [][]byte
	}{
		{
			name:      "single source",
			originals: [][]byte{[]byte("orig-bytes")},
		},
		{
			name:      "multi source",
			originals: [][]byte{[]byte("L"), []byte("R")},
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			inbound := packForTest(t, []byte("inner"), tc.originals...)

			m, err := Parse(inbound)
			require.NoError(t, err)
			origBefore := append([]byte(nil), m.origSlot...) // snapshot before mutation
			flagsBefore := m.Flags()

			newData := []byte("new-mutated-payload")
			m.SetPayload(newData)

			out := m.Pack()

			m2, err := Parse(out)
			require.NoError(t, err)
			require.Equal(t, flagsBefore, m2.Flags())
			require.True(t, bytes.Equal(origBefore, m2.origSlot), "origSlot must be byte-identical after Pack")
			require.True(t, bytes.Equal(newData, m2.Payload()))
		})
	}
}

func TestEmptyPayloads(t *testing.T) {
	// NewDataPlaneMsg with len(originals)==1 has no validation in v1; nil / []
	// round-trip cleanly so the package itself doesn't trip on edge cases that
	// callers (source stages) may screen for separately.
	tests := []struct {
		name string
		orig []byte
		data []byte
	}{
		{"both nil", nil, nil},
		{"both empty", []byte{}, []byte{}},
		{"empty data, real orig", []byte("source"), nil},
		{"empty orig, real data", nil, []byte("data")},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			buf := packForTest(t, tc.data, tc.orig)
			m, err := Parse(buf)
			require.NoError(t, err)
			require.Equal(t, byte(0), m.Flags())
			require.Equal(t, len(tc.data), len(m.Payload()))

			srcs, err := m.Originals()
			require.NoError(t, err)
			require.Len(t, srcs, 1)
			require.Equal(t, len(tc.orig), len(srcs[0]))
		})
	}
}

func TestLargePayloads(t *testing.T) {
	// NATS body cap is 8 MB; 4 MB + 4 MB exercises the u32 length math
	// without hitting the cap.
	orig := bytes.Repeat([]byte("A"), 4<<20)
	data := bytes.Repeat([]byte("B"), 4<<20)

	buf := packForTest(t, data, orig)
	m, err := Parse(buf)
	require.NoError(t, err)
	require.Equal(t, byte(0), m.Flags())
	require.True(t, bytes.Equal(data, m.Payload()))

	srcs, err := m.Originals()
	require.NoError(t, err)
	require.True(t, bytes.Equal(orig, srcs[0]))
}

func TestNewDataPlaneMsg_ZeroOriginals(t *testing.T) {
	_, err := NewDataPlaneMsg([]byte("data"))
	require.Error(t, err)
	require.True(t, errors.Is(err, ErrBadCount), "got %v", err)
}

func TestNewDataPlaneMsg_TooManyOriginals(t *testing.T) {
	// 256 originals overflows the single-byte count field.
	originals := make([][]byte, 256)
	for i := range originals {
		originals[i] = []byte{byte(i)}
	}
	_, err := NewDataPlaneMsg([]byte("data"), originals...)
	require.Error(t, err)
	require.True(t, errors.Is(err, ErrTooManyOriginals), "got %v", err)
}

func TestNewDataPlaneMsg_MaxOriginals(t *testing.T) {
	// Exactly 255 must succeed and round-trip.
	originals := make([][]byte, 255)
	for i := range originals {
		originals[i] = []byte{byte(i)}
	}
	m, err := NewDataPlaneMsg([]byte("data"), originals...)
	require.NoError(t, err)
	buf := m.Pack()

	m2, err := Parse(buf)
	require.NoError(t, err)
	srcs, err := m2.Originals()
	require.NoError(t, err)
	require.Len(t, srcs, 255)
}

func TestMalformedInputs(t *testing.T) {
	tests := []struct {
		name    string
		build   func() []byte
		wantErr error
	}{
		{
			name: "buffer shorter than header",
			build: func() []byte {
				return make([]byte, 8) // header is 9 bytes
			},
			wantErr: ErrShortBuffer,
		},
		{
			name: "payload_len exceeds buffer",
			build: func() []byte {
				b := make([]byte, headerSize)
				binary.BigEndian.PutUint32(b[1:5], 9999)
				return b
			},
			wantErr: ErrLenOverflow,
		},
		{
			name: "original_len exceeds buffer",
			build: func() []byte {
				// payload_len=0, then bogus original_len
				b := make([]byte, headerSize)
				binary.BigEndian.PutUint32(b[1:5], 0)
				binary.BigEndian.PutUint32(b[5:9], 9999)
				return b
			},
			wantErr: ErrLenOverflow,
		},
		{
			name: "u32 overflow on payload_len",
			build: func() []byte {
				b := make([]byte, headerSize)
				binary.BigEndian.PutUint32(b[1:5], ^uint32(0))
				return b
			},
			wantErr: ErrLenOverflow,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			_, err := Parse(tc.build())
			require.Error(t, err)
			require.True(t, errors.Is(err, tc.wantErr), "got %v, want errors.Is(%v)", err, tc.wantErr)
		})
	}
}

func TestReservedFlagsBitByBit(t *testing.T) {
	// Cover each reserved bit 1..7 individually. v1 must reject all of them.
	for bit := 1; bit <= 7; bit++ {
		t.Run(fmt.Sprintf("bit_%d", bit), func(t *testing.T) {
			b := make([]byte, headerSize)
			b[0] = byte(1 << bit)
			_, err := Parse(b)
			require.Error(t, err)
			require.True(t, errors.Is(err, ErrReservedFlags))
		})
	}
}

func TestProducerBugDetection(t *testing.T) {
	// Common raw payloads accidentally published without wrapping. All should
	// trip ErrReservedFlags or another framing error — never silently parse.
	tests := []struct {
		name string
		body []byte
	}{
		{"json object", []byte(`{"id":1}`)},
		{"json array", []byte(`[1,2,3]`)},
		{"avro header", []byte{'O', 'b', 'j', 1}},
		{"protobuf varint prelude", []byte{0x0A, 0x05, 'h', 'e', 'l', 'l', 'o'}},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			// Pad to header size so we exercise the flags-check before the
			// length-check trips.
			body := tc.body
			if len(body) < headerSize {
				body = append(body, make([]byte, headerSize-len(body))...)
			}
			_, err := Parse(body)
			require.Error(t, err, "raw payload %q should not parse as a v1 wire frame", tc.body)
			require.True(t, errors.Is(err, ErrReservedFlags), "got %v", err)
		})
	}
}

func TestMultiSourceBadCount(t *testing.T) {
	t.Run("count=0", func(t *testing.T) {
		// Multi-source flag set, origSlot is a single zero byte (count=0).
		m := DataPlaneMsg{flags: FlagMultiSource, origSlot: []byte{0x00}}
		_, err := m.Originals()
		require.Error(t, err)
		require.True(t, errors.Is(err, ErrBadCount))
	})

	t.Run("count exceeds slot", func(t *testing.T) {
		// count=2, but only one source bytes truncated
		m := DataPlaneMsg{
			flags:    FlagMultiSource,
			origSlot: []byte{0x02, 0x00, 0x00, 0x00, 0x01, 'a'},
		}
		_, err := m.Originals()
		require.Error(t, err)
		require.True(t, errors.Is(err, ErrShortBuffer))
	})

	t.Run("source len exceeds slot", func(t *testing.T) {
		// count=1, source_0_len=999, only 1 byte of payload
		m := DataPlaneMsg{
			flags:    FlagMultiSource,
			origSlot: []byte{0x01, 0x00, 0x00, 0x03, 0xE7, 'a'},
		}
		_, err := m.Originals()
		require.Error(t, err)
		require.True(t, errors.Is(err, ErrLenOverflow))
	})

	t.Run("multi-source empty slot", func(t *testing.T) {
		m := DataPlaneMsg{flags: FlagMultiSource, origSlot: nil}
		_, err := m.Originals()
		require.Error(t, err)
		require.True(t, errors.Is(err, ErrShortBuffer))
	})
}

func TestParseThenOriginals_MalformedMultiSource(t *testing.T) {
	// Frame parses cleanly but the multi-source slot declares count=0. The
	// realistic on-wire shape of a bad-count failure, complementing the
	// direct-construction cases above.
	payload := []byte("payload")
	slot := []byte{0x00} // count=0
	buf := writeFrame(FlagMultiSource, payload, slot)

	m, err := Parse(buf)
	require.NoError(t, err, "Parse should accept the frame shape")

	_, err = m.Originals()
	require.Error(t, err)
	require.True(t, errors.Is(err, ErrBadCount))
}

func TestFlagShapeMismatch(t *testing.T) {
	// Build a single-source frame and forcibly re-interpret as multi-source.
	// Originals must surface a framing error rather than silently treating
	// the raw bytes as a count-prefixed slot.
	orig := []byte("plain source bytes — no count prefix")
	buf := packForTest(t, []byte("data"), orig)
	m, err := Parse(buf)
	require.NoError(t, err)

	// Strip the constructed-frame originals so the discriminator falls
	// through to the parsed-frame origSlot path.
	m.originals = nil
	m.flags |= FlagMultiSource
	_, err = m.Originals()
	require.Error(t, err)
}

func TestParseNoAllocOnHotPath(t *testing.T) {
	buf := packForTest(t, []byte("data"), []byte("orig"))
	allocs := testing.AllocsPerRun(100, func() {
		_, _ = Parse(buf)
	})
	require.Equal(t, 0.0, allocs, "Parse must not allocate on the hot path")
}

func TestOriginalsSingleSourceLowAlloc_ParsedFrame(t *testing.T) {
	buf := packForTest(t, []byte("data"), []byte("orig"))
	m, err := Parse(buf)
	require.NoError(t, err)

	allocs := testing.AllocsPerRun(100, func() {
		_, _ = m.Originals()
	})
	require.Equal(t, 1.0, allocs, "Originals on parsed single-source should allocate exactly the result slice")
}

func TestOriginalsConstructedFrame_NoAlloc(t *testing.T) {
	// Constructed frames already hold the originals slice; Originals returns
	// it directly with zero allocations.
	m, err := NewDataPlaneMsg([]byte("data"), []byte("orig"))
	require.NoError(t, err)

	allocs := testing.AllocsPerRun(100, func() {
		_, _ = m.Originals()
	})
	require.Equal(t, 0.0, allocs, "Originals on constructed frame should allocate zero")
}

func TestPackSingleSourceSingleAlloc(t *testing.T) {
	// Construct + Pack should allocate exactly the output buffer.
	payload := []byte("payload")
	orig := []byte("source")

	allocs := testing.AllocsPerRun(100, func() {
		m, _ := NewDataPlaneMsg(payload, orig)
		_ = m.Pack()
	})
	require.Equal(t, 1.0, allocs, "single-source construct+Pack should allocate exactly the output buffer")
}

func TestPackMultiSourceSingleAlloc(t *testing.T) {
	// Multi-source construct + Pack writes the count-prefixed slot directly
	// into the output buffer; the only allocation should be the output buffer.
	payload := []byte("payload")
	left := []byte("left-src")
	right := []byte("right-src")

	allocs := testing.AllocsPerRun(100, func() {
		m, _ := NewDataPlaneMsg(payload, left, right)
		_ = m.Pack()
	})
	require.Equal(t, 1.0, allocs, "multi-source construct+Pack should allocate exactly the output buffer")
}

func TestPayloadFirstLayout(t *testing.T) {
	// Lock the wire-format layout against accidental reversal: bytes 5..5+M
	// must be the payload, NOT the original slot.
	orig := []byte("ORIGINAL_BYTES")
	data := []byte("payload-here")
	buf := packForTest(t, data, orig)

	// flags byte
	require.Equal(t, byte(0), buf[0])
	// payload_len at bytes 1..5
	require.Equal(t, uint32(len(data)), binary.BigEndian.Uint32(buf[1:5]))
	// payload bytes immediately follow
	require.True(t, bytes.Equal(data, buf[5:5+len(data)]))
	// original_len after payload
	origLenOff := 5 + len(data)
	require.Equal(t, uint32(len(orig)), binary.BigEndian.Uint32(buf[origLenOff:origLenOff+4]))
	// original bytes at the tail
	require.True(t, bytes.Equal(orig, buf[origLenOff+4:]))
}

func BenchmarkParse(b *testing.B) {
	buf := mustPack(bytes.Repeat([]byte("x"), 1024), []byte("orig bytes"))
	b.ReportAllocs()
	for b.Loop() {
		_, _ = Parse(buf)
	}
}

func BenchmarkPackFromParsed(b *testing.B) {
	inbound := mustPack(bytes.Repeat([]byte("x"), 1024), []byte("orig bytes"))
	m, _ := Parse(inbound)
	m.SetPayload(bytes.Repeat([]byte("y"), 1024))
	b.ReportAllocs()
	for b.Loop() {
		_ = m.Pack()
	}
}

func BenchmarkNewAndPackSingleSource(b *testing.B) {
	payload := bytes.Repeat([]byte("y"), 1024)
	orig := []byte("orig bytes")
	b.ReportAllocs()
	for b.Loop() {
		m, _ := NewDataPlaneMsg(payload, orig)
		_ = m.Pack()
	}
}

func BenchmarkNewAndPackMultiSource(b *testing.B) {
	payload := bytes.Repeat([]byte("y"), 1024)
	left := []byte("left bytes")
	right := []byte("right bytes")
	b.ReportAllocs()
	for b.Loop() {
		m, _ := NewDataPlaneMsg(payload, left, right)
		_ = m.Pack()
	}
}

// mustPack is the benchmark-side equivalent of packForTest — same flow, no
// *testing.T (so it can be used from BenchmarkXxx setup).
func mustPack(payload []byte, originals ...[]byte) []byte {
	m, err := NewDataPlaneMsg(payload, originals...)
	if err != nil {
		panic(err)
	}
	return m.Pack()
}
