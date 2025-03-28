/*
 * Copyright 2019 The NATS Authors
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 */

package core

import (
	"time"
)

type reconnectTimer struct {
	cancel chan bool
}

// NewReconnectTimer builds a new reconnect timer
func newReconnectTimer() *reconnectTimer {
	return &reconnectTimer{
		cancel: make(chan bool),
	}
}

// After returns a channel that will return true/false based on whether the timer was canceled
func (c *reconnectTimer) After(d time.Duration) chan bool {
	ch := make(chan bool)
	go func() {
		select {
		case <-time.After(d):
			ch <- true
		case <-c.cancel:
			ch <- false
		}
	}()
	return ch
}

// Cancel stops the timer
func (c *reconnectTimer) Cancel() {
	close(c.cancel)
}
