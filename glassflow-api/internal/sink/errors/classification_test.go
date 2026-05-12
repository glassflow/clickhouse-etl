package errors_test

import (
	"errors"
	"fmt"
	"io"
	"net"
	"syscall"
	"testing"

	"github.com/ClickHouse/clickhouse-go/v2/lib/proto"
	"github.com/stretchr/testify/assert"

	sinkerrors "github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/sink/errors"
)

func chEx(code int32) error {
	return &proto.Exception{Code: code}
}

func wrapped(err error) error {
	return fmt.Errorf("outer: %w", err)
}

func TestClassify_Retryable(t *testing.T) {
	cases := []struct {
		name string
		err  error
	}{
		// CH server codes
		{"TimeoutExceeded/159", chEx(159)},
		{"TooManySimultaneousQueries/202", chEx(202)},
		{"NoFreeConnection/203", chEx(203)},
		{"SocketTimeout/209", chEx(209)},
		{"NetworkError/210", chEx(210)},
		{"MemoryLimitExceeded/241", chEx(241)},
		{"TableIsReadOnly/242", chEx(242)},
		{"NotEnoughSpace/243", chEx(243)},
		{"UnexpectedZookeeperError/244", chEx(244)},
		{"NoActiveReplicas/254", chEx(254)},
		{"NoAvailableReplica/265", chEx(265)},
		{"TooLessLiveReplicas/285", chEx(285)},
		{"UnsatisfiedQuorumForPreviousWrite/286", chEx(286)},
		{"AllConnectionTriesFailed/279", chEx(279)},
		{"ShardHasNoConnections/297", chEx(297)},
		{"ReplicaIsNotInQuorum/289", chEx(289)},
		{"LimitExceeded/290", chEx(290)},
		{"ReceivedErrorTooManyRequests/364", chEx(364)},
		{"PartIsTemporarilyLocked/384", chEx(384)},
		{"DNSError/198", chEx(198)},
		{"QuotaExpired/201", chEx(201)},
		{"Aborted/236", chEx(236)},
		{"KeeperException/999", chEx(999)},
		{"PocoException/1000", chEx(1000)},
		// Wrapped CH error
		{"wrapped/202", wrapped(chEx(202))},
		// Network/IO errors
		{"io.EOF", io.EOF},
		{"io.ErrUnexpectedEOF", io.ErrUnexpectedEOF},
		{"syscall.ECONNREFUSED", syscall.ECONNREFUSED},
		{"syscall.ECONNRESET", syscall.ECONNRESET},
		{"syscall.EPIPE", syscall.EPIPE},
		{"net.Error timeout", &net.OpError{Op: "dial", Err: &timeoutErr{}}},
		{"wrapped EOF", wrapped(io.EOF)},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			assert.Equal(t, sinkerrors.Retryable, sinkerrors.Classify(tc.err))
		})
	}
}

func TestClassify_Permanent(t *testing.T) {
	cases := []struct {
		name string
		err  error
	}{
		{"CannotParseText/6", chEx(6)},
		{"IncorrectNumberOfColumns/7", chEx(7)},
		{"NoSuchColumnInTable/16", chEx(16)},
		{"CannotInsertElementIntoConstantColumn/18", chEx(18)},
		{"NumberOfColumnsDoesntMatch/20", chEx(20)},
		{"CannotParseEscapeSequence/25", chEx(25)},
		{"CannotParseQuotedString/26", chEx(26)},
		{"CannotParseInputAssertionFailed/27", chEx(27)},
		{"CannotParseDate/38", chEx(38)},
		{"CannotParseDatetime/41", chEx(41)},
		{"IllegalTypeOfArgument/43", chEx(43)},
		{"IllegalColumn/44", chEx(44)},
		{"UnknownIdentifier/47", chEx(47)},
		{"TypeMismatch/53", chEx(53)},
		{"UnknownTable/60", chEx(60)},
		{"CannotParseNumber/72", chEx(72)},
		{"IncorrectQuery/80", chEx(80)},
		{"UnknownDatabase/81", chEx(81)},
		{"IncorrectData/117", chEx(117)},
		{"UnknownUser/192", chEx(192)},
		{"Readonly/164", chEx(164)},
		{"WrongPassword/193", chEx(193)},
		{"RequiredPassword/194", chEx(194)},
		{"IPAddressNotAllowed/195", chEx(195)},
		{"DatabaseAccessDenied/291", chEx(291)},
		{"ValueIsOutOfRangeOfDataType/321", chEx(321)},
		{"CannotInsertNullInOrdinaryColumn/349", chEx(349)},
		{"QueryIsProhibited/392", chEx(392)},
		{"AuthenticationFailed/516", chEx(516)},
		// Wrapped permanent error
		{"wrapped/60", wrapped(chEx(60))},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			assert.Equal(t, sinkerrors.Permanent, sinkerrors.Classify(tc.err))
		})
	}
}

func TestClassify_Unknown(t *testing.T) {
	cases := []struct {
		name string
		err  error
	}{
		{"nil", nil},
		{"generic error", errors.New("something broke")},
		{"unknown CH code", chEx(9999)},
		{"non-timeout net.Error", &net.OpError{Op: "dial", Err: errors.New("refused")}},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			assert.Equal(t, sinkerrors.Unknown, sinkerrors.Classify(tc.err))
		})
	}
}

func TestClassification_String(t *testing.T) {
	assert.Equal(t, "retryable", sinkerrors.Retryable.String())
	assert.Equal(t, "permanent", sinkerrors.Permanent.String())
	assert.Equal(t, "unknown", sinkerrors.Unknown.String())
}

// timeoutErr implements net.Error with Timeout() = true
type timeoutErr struct{}

func (timeoutErr) Error() string   { return "i/o timeout" }
func (timeoutErr) Timeout() bool   { return true }
func (timeoutErr) Temporary() bool { return true }
