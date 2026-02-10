package models

import (
	"errors"
	"fmt"
)

var ErrNoNewMessages = errors.New("no new messages")

func IsNoNewMessagesErr(err error) bool { return errors.Is(err, ErrNoNewMessages) }

var ErrSchemaNotFound = errors.New("schema not found")

func IsSchemaNotFoundErr(err error) bool { return errors.Is(err, ErrSchemaNotFound) }

var ErrUnexpectedSchemaFormat = errors.New("schema is not JSON format")

func IsErrUnexpectedSchemaFormat(err error) bool { return errors.Is(err, ErrUnexpectedSchemaFormat) }

var ErrInvalidSchema = errors.New("invalid schema format")

func IsInvalidSchemaErr(err error) bool { return errors.Is(err, ErrInvalidSchema) }

var ErrUnsupportedDataType = errors.New("unsupported data type")

func IsUnsupportedDataTypeErr(err error) bool { return errors.Is(err, ErrUnsupportedDataType) }

var ErrInvalidPipelineID = errors.New("invalid pipeline ID format")

func IsInvalidPipelineID(err error) bool { return errors.Is(err, ErrInvalidPipelineID) }

var ErrRecordNotFound = errors.New("record not found")

func IsRecordNotFoundErr(err error) bool { return errors.Is(err, ErrRecordNotFound) }

var ErrSchemaVerionNotFound = errors.New("schema version not found")

func IsSchemaVersionNotFoundErr(err error) bool { return errors.Is(err, ErrSchemaVerionNotFound) }

var ErrConfigNotFound = errors.New("config not found")

func IsConfigNotFoundErr(err error) bool { return errors.Is(err, ErrConfigNotFound) }

type IncompatibleSchemaError struct {
	schemaID int
	errText  string
}

func (e *IncompatibleSchemaError) Error() string {
	return fmt.Sprintf("schema %d is incompatible: %s", e.schemaID, e.errText)
}

// NewIncompatibleSchemaError creates a new IncompatibleSchemaError
func NewIncompatibleSchemaError(schemaID int, errText string) *IncompatibleSchemaError {
	return &IncompatibleSchemaError{
		schemaID: schemaID,
		errText:  errText,
	}
}

// AsIncompatibleSchemaError attempts to extract IncompatibleSchemaError from an error
func IsIncompatibleSchemaError(err error) bool {
	var incompatibleErr *IncompatibleSchemaError
	return errors.As(err, &incompatibleErr)
}

var ErrCompileTransformation = errors.New("failed to compile transformation")
var ErrSignalSent = errors.New("signal to stop component is sent")
var ErrSchemaIDIsMissingInHeader = errors.New("schema id is missing in header")
