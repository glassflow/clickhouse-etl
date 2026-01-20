package models

import "errors"

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
