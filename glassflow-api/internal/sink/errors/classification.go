package errors

import (
	"errors"
	"io"
	"net"
	"syscall"

	// ch-go proto gives us typed error code constants (Error = int).
	// clickhouse-go v2 wraps server exceptions in *proto.Exception (Code int32).
	chproto "github.com/ClickHouse/ch-go/proto"
	"github.com/ClickHouse/clickhouse-go/v2/lib/proto"
)

// Classification describes how the sink should handle a ClickHouse error.
type Classification int

const (
	// Retryable — transient condition; sink NACKs so NATS redelivers after a delay.
	Retryable Classification = iota
	// Permanent — same message will fail again; route to DLQ.
	Permanent
	// Unknown — not yet classified; treated conservatively as Permanent + logged
	// so real-traffic gaps surface and the list can be extended.
	Unknown
)

func (c Classification) String() string {
	switch c {
	case Retryable:
		return "retryable"
	case Permanent:
		return "permanent"
	default:
		return "unknown"
	}
}

// retryableCodes are transient ClickHouse server conditions where the same
// message is expected to succeed once the server recovers.
// Source: https://github.com/ClickHouse/ch-go/blob/main/proto/error_codes.go
var retryableCodes = map[int32]struct{}{
	int32(chproto.ErrTimeoutExceeded):                   {}, // 159 — query timeout
	int32(chproto.ErrTooManySimultaneousQueries):        {}, // 202 — server overloaded
	int32(chproto.ErrNoFreeConnection):                  {}, // 203 — connection pool exhausted
	int32(chproto.ErrSocketTimeout):                     {}, // 209 — network timeout
	int32(chproto.ErrNetworkError):                      {}, // 210 — network layer error
	int32(chproto.ErrMemoryLimitExceeded):               {}, // 241 — transient resource pressure
	int32(chproto.ErrTableIsReadOnly):                   {}, // 242 — replica recovery in progress
	int32(chproto.ErrNotEnoughSpace):                    {}, // 243 — disk pressure (may clear)
	int32(chproto.ErrUnexpectedZookeeperError):          {}, // 244 — transient ZooKeeper/Keeper error
	int32(chproto.ErrNoActiveReplicas):                  {}, // 254 — all replicas temporarily down
	int32(chproto.ErrNoAvailableReplica):                {}, // 265 — no replica available
	int32(chproto.ErrTooLessLiveReplicas):               {}, // 285 — not enough live replicas for quorum
	int32(chproto.ErrUnsatisfiedQuorumForPreviousWrite): {}, // 286 — previous write quorum not yet met
	int32(chproto.ErrAllConnectionTriesFailed):          {}, // 279 — all replicas unreachable
	int32(chproto.ErrShardHasNoConnections):             {}, // 297 — shard connection pool empty
	int32(chproto.ErrReplicaIsNotInQuorum):              {}, // 289 — replication lag
	int32(chproto.ErrLimitExceeded):                     {}, // 290 — rate/resource limit
	int32(chproto.ErrReceivedErrorTooManyRequests):      {}, // 364 — HTTP 429 / CH rate limit
	int32(chproto.ErrPartIsTemporarilyLocked):           {}, // 384 — merge in progress
	int32(chproto.ErrDNSError):                          {}, // 198 — DNS resolution failure
	int32(chproto.ErrQuotaExpired):                      {}, // 201 — quota exhausted, resets on schedule
	int32(chproto.ErrAborted):                           {}, // 236 — server-initiated query abort
	int32(chproto.ErrKeeperException):                   {}, // 999 — ClickHouse Keeper exception
	int32(chproto.ErrPocoException):                     {}, // 1000 — Poco network/IO exception
}

// permanentCodes are data or schema errors where the same message will fail
// again on retry; user intervention is required.
// Source: https://github.com/ClickHouse/ch-go/blob/main/proto/error_codes.go
var permanentCodes = map[int32]struct{}{
	int32(chproto.ErrCannotParseText):                       {}, // 6   — bad payload
	int32(chproto.ErrIncorrectNumberOfColumns):              {}, // 7   — schema mismatch
	int32(chproto.ErrNoSuchColumnInTable):                   {}, // 16  — column missing from table
	int32(chproto.ErrCannotInsertElementIntoConstantColumn): {}, // 18 — bad data
	int32(chproto.ErrNumberOfColumnsDoesntMatch):            {}, // 20  — schema mismatch
	int32(chproto.ErrCannotParseEscapeSequence):             {}, // 25  — bad payload
	int32(chproto.ErrCannotParseQuotedString):               {}, // 26  — bad payload
	int32(chproto.ErrCannotParseInputAssertionFailed):       {}, // 27  — bad payload
	int32(chproto.ErrCannotParseDate):                       {}, // 38  — bad date in payload
	int32(chproto.ErrCannotParseDatetime):                   {}, // 41  — bad datetime in payload
	int32(chproto.ErrIllegalTypeOfArgument):                 {}, // 43  — type mismatch
	int32(chproto.ErrIllegalColumn):                         {}, // 44  — column issue
	int32(chproto.ErrUnknownIdentifier):                     {}, // 47  — unknown column reference
	int32(chproto.ErrTypeMismatch):                          {}, // 53  — type mismatch
	int32(chproto.ErrUnknownTable):                          {}, // 60  — table doesn't exist (see docs)
	int32(chproto.ErrCannotParseNumber):                     {}, // 72  — bad numeric value in payload
	int32(chproto.ErrIncorrectQuery):                        {}, // 80  — malformed query
	int32(chproto.ErrUnknownDatabase):                       {}, // 81  — wrong database in config
	int32(chproto.ErrIncorrectData):                         {}, // 117 — bad data value
	int32(chproto.ErrUnknownUser):                           {}, // 192 — auth: user doesn't exist
	int32(chproto.ErrWrongPassword):                         {}, // 193 — auth: wrong password
	int32(chproto.ErrRequiredPassword):                      {}, // 194 — auth: password required
	int32(chproto.ErrIPAddressNotAllowed):                   {}, // 195 — auth: IP not in allowlist
	int32(chproto.ErrReadonly):                              {}, // 164 — readonly mode
	int32(chproto.ErrDatabaseAccessDenied):                  {}, // 291 — permission denied on database
	int32(chproto.ErrValueIsOutOfRangeOfDataType):           {}, // 321 — value out of range for column type
	int32(chproto.ErrCannotInsertNullInOrdinaryColumn):      {}, // 349 — NULL into NOT NULL column
	int32(chproto.ErrQueryIsProhibited):                     {}, // 392 — query type prohibited by server policy
	int32(chproto.ErrAuthenticationFailed):                  {}, // 516 — auth failure
}

// ErrorName returns a label-safe string identifying the specific error, suitable
// for use as a metric label value.
// CH exceptions → the ch-go constant name (e.g. "TOO_MANY_SIMULTANEOUS_QUERIES").
// Network/IO errors with no CH code → "network_io".
// Everything else → "unknown".
func ErrorName(err error) string {
	var ex *proto.Exception
	if errors.As(err, &ex) {
		return chproto.Error(ex.Code).String()
	}
	if isNetworkError(err) {
		return "network_io"
	}
	return "unknown"
}

// Classify inspects err and returns its Classification.
// Unknown is the conservative default — callers should route Unknown to DLQ
// and log with a "needs_classification" marker so the list can be extended.
func Classify(err error) Classification {
	if err == nil {
		return Unknown
	}

	// ClickHouse server-side exception (clickhouse-go v2 driver)
	var ex *proto.Exception
	if errors.As(err, &ex) {
		if _, ok := retryableCodes[ex.Code]; ok {
			return Retryable
		}
		if _, ok := permanentCodes[ex.Code]; ok {
			return Permanent
		}
		return Unknown
	}

	// Network / IO errors with no CH exception code
	if isNetworkError(err) {
		return Retryable
	}

	return Unknown
}

func isNetworkError(err error) bool {
	if errors.Is(err, io.EOF) || errors.Is(err, io.ErrUnexpectedEOF) {
		return true
	}
	if errors.Is(err, syscall.ECONNREFUSED) || errors.Is(err, syscall.ECONNRESET) || errors.Is(err, syscall.EPIPE) {
		return true
	}
	var netErr net.Error
	if errors.As(err, &netErr) && netErr.Timeout() {
		return true
	}
	return false
}
