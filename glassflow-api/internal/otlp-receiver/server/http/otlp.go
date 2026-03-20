package http

import (
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

func decodeOTLPRequest(r *nethttp.Request, req proto.Message) error {
	body, err := io.ReadAll(r.Body)
	if err != nil {
		return err
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
