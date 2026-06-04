package testutils

import (
	"io"
	"net"
	"sync"
)

// CHGateProxy is a simple TCP proxy that sits between the sink and ClickHouse.
// Calling Block() closes all active connections and rejects new ones, causing the
// sink to receive ECONNRESET — classified as a retryable network error.
// Calling Unblock() restores pass-through behaviour.
type CHGateProxy struct {
	listener net.Listener
	realAddr string

	mu      sync.Mutex
	blocked bool
	active  []net.Conn // currently proxied connections (both directions)
	done    chan struct{}
}

// NewCHGateProxy starts a proxy listening on a random local port that forwards
// TCP traffic to realHost:realPort.
func NewCHGateProxy(realHost, realPort string) (*CHGateProxy, error) {
	ln, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		return nil, err
	}
	p := &CHGateProxy{
		listener: ln,
		realAddr: net.JoinHostPort(realHost, realPort),
		done:     make(chan struct{}),
	}
	go p.accept()
	return p, nil
}

// Port returns the local port the proxy is listening on.
func (p *CHGateProxy) Port() string {
	_, port, _ := net.SplitHostPort(p.listener.Addr().String())
	return port
}

// Block closes all active connections and rejects new ones until Unblock is called.
func (p *CHGateProxy) Block() {
	p.mu.Lock()
	defer p.mu.Unlock()
	p.blocked = true
	for _, c := range p.active {
		c.Close()
	}
	p.active = nil
}

// Unblock resumes pass-through; the sink will reconnect on the next attempt.
func (p *CHGateProxy) Unblock() {
	p.mu.Lock()
	defer p.mu.Unlock()
	p.blocked = false
}

// Stop shuts down the proxy listener.
func (p *CHGateProxy) Stop() {
	close(p.done)
	p.listener.Close()
}

func (p *CHGateProxy) accept() {
	for {
		client, err := p.listener.Accept()
		if err != nil {
			select {
			case <-p.done:
				return
			default:
				continue
			}
		}

		p.mu.Lock()
		blocked := p.blocked
		p.mu.Unlock()

		if blocked {
			client.Close()
			continue
		}

		upstream, err := net.Dial("tcp", p.realAddr)
		if err != nil {
			client.Close()
			continue
		}

		p.mu.Lock()
		p.active = append(p.active, client, upstream)
		p.mu.Unlock()

		go p.pipe(client, upstream)
		go p.pipe(upstream, client)
	}
}

func (p *CHGateProxy) pipe(dst, src net.Conn) {
	_, _ = io.Copy(dst, src)
	dst.Close()
	src.Close()
}
