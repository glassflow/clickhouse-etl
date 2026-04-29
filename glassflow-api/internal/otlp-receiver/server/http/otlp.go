package http

import (
	"errors"
	"io"
	nethttp "net/http"
	"strings"

	"google.golang.org/protobuf/encoding/protojson"
	"google.golang.org/protobuf/proto"
)

const (
	contentTypeProtobuf = "application/x-protobuf"
	contentTypeJSON     = "application/json"
)

var errRequestTooLarge = errors.New("request body exceeds maximum allowed size")

func decodeOTLPRequest(r *nethttp.Request, maxBodyBytes int64, req proto.Message) error {
	// Read up to maxBodyBytes+1; if we get more, the request is too large.
	lr := io.LimitReader(r.Body, maxBodyBytes+1)
	body, err := io.ReadAll(lr)
	if err != nil {
		return err
	}
	if int64(len(body)) > maxBodyBytes {
		return errRequestTooLarge
	}

	if strings.HasPrefix(r.Header.Get("Content-Type"), contentTypeProtobuf) {
		return proto.Unmarshal(body, req)
	}
	return protojson.Unmarshal(body, req)
}

func writeOTLPResponse(w nethttp.ResponseWriter, r *nethttp.Request, resp proto.Message) {
	var (
		out         []byte
		err         error
		contentType string
	)

	if strings.HasPrefix(r.Header.Get("Content-Type"), contentTypeProtobuf) {
		out, err = proto.Marshal(resp)
		contentType = contentTypeProtobuf
	} else {
		out, err = protojson.Marshal(resp)
		contentType = contentTypeJSON
	}

	if err != nil {
		nethttp.Error(w, "failed to marshal response", nethttp.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", contentType)
	w.WriteHeader(nethttp.StatusOK)
	_, _ = w.Write(out)
}
