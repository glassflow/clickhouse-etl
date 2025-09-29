package models

import "errors"

var ErrNoNewMessages = errors.New("no new messages")

func IsNoNewMessagesErr(err error) bool { return errors.Is(err, ErrNoNewMessages) }

var ErrAsyncBatchFailed = errors.New("async batch publish failed")

func IsAsyncBatchFailedErr(err error) bool { return errors.Is(err, ErrAsyncBatchFailed) }

var FailedToTerminateBatchMsgs = errors.New("failed to terminate batch messages")

func IsFailedToTerminateBatchMsgsErr(err error) bool { return errors.Is(err, FailedToTerminateBatchMsgs) }