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
