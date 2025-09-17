package models

import "errors"

var ErrNoNewMessages = errors.New("no new messages")

func IsNoNewMessagesErr(err error) bool { return errors.Is(err, ErrNoNewMessages) }
