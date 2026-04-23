package api

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"net/http"

	"github.com/danielgtaylor/huma/v2"
	"github.com/expr-lang/expr/ast"
	"github.com/expr-lang/expr/parser"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/models"
)

func MigratePreviewDocs() huma.Operation {
	return huma.Operation{
		OperationID: "migrate-pipeline-preview",
		Method:      http.MethodPost,
		Summary:     "Convert a v2 pipeline request to v3 format",
		Description: "Accepts a v2 pipeline JSON and returns the equivalent v3 pipeline JSON. Pure transformation — no pipeline is created.",
	}
}

// MigratePreviewInput accepts raw JSON so Huma does not validate against the
// v2 schema — v2 payloads in the wild contain fields we don't model and we
// don't want unknown-property errors before the handler even runs.
type MigratePreviewInput struct {
	Body json.RawMessage
}

type MigratePreviewResponse struct {
	Body pipelineJSON
}

func (h *handler) migratePipelinePreview(_ context.Context, input *MigratePreviewInput) (*MigratePreviewResponse, error) {
	var v2 pipelineJSONv2
	if err := json.Unmarshal(input.Body, &v2); err != nil {
		return nil, &ErrorDetail{
			Status:  http.StatusUnprocessableEntity,
			Code:    "unprocessable_entity",
			Message: "invalid v2 pipeline JSON",
			Details: map[string]any{"error": err.Error()},
		}
	}
	out, err := convertV2ToV3(v2)
	if err != nil {
		return nil, &ErrorDetail{
			Status:  http.StatusUnprocessableEntity,
			Code:    "unprocessable_entity",
			Message: "failed to convert v2 pipeline to v3",
			Details: map[string]any{"error": err.Error()},
		}
	}
	return &MigratePreviewResponse{Body: out}, nil
}

// convertV2ToV3 converts a v2 pipeline request JSON to the v3 format.
func convertV2ToV3(v2 pipelineJSONv2) (pipelineJSON, error) {
	sources, err := convertSources(v2)
	if err != nil {
		return pipelineJSON{}, err
	}

	out := pipelineJSON{
		Version:    "v3",
		PipelineID: v2.PipelineID,
		Name:       v2.Name,
		Sources:    sources,
		Transforms: convertTransforms(v2),
		Sink:       convertSink(v2),
		Metadata:   v2.Metadata,
	}

	if v2.Join.Enabled {
		j, err := convertJoin(v2)
		if err != nil {
			return pipelineJSON{}, err
		}
		out.Join = &j
	}

	return out, nil
}

func convertSources(v2 pipelineJSONv2) ([]source, error) {
	sources := make([]source, 0, len(v2.Source.Topics))
	for _, t := range v2.Source.Topics {
		sourceID := t.ID
		if sourceID == "" {
			sourceID = t.Topic
		}

		schemaFields := extractSchemaFields(v2.Schema.Fields, sourceID)
		if v2.StatelessTransformation.Enabled && v2.StatelessTransformation.SourceID == sourceID {
			schemaFields = supplementFieldsFromTransforms(schemaFields, v2.StatelessTransformation.Config.Transform)
		}

		s := source{
			Type:                       v2.Source.Type,
			SourceID:                   sourceID,
			Topic:                      t.Topic,
			ConsumerGroupInitialOffset: t.ConsumerGroupInitialOffset,
			SchemaVersion:              t.SchemaVersion,
			SchemaFields:               schemaFields,
		}

		if t.SchemaRegistry.URL != "" {
			sr := t.SchemaRegistry
			s.SchemaRegistry = &models.SchemaRegistryConfig{
				URL:       sr.URL,
				APIKey:    sr.APIKey,
				APISecret: sr.APISecret,
			}
		}

		if v2.Source.ConnectionParams != nil {
			cp := v2.Source.ConnectionParams
			s.ConnectionParams = &kafkaConnectionParams{
				Brokers:             cp.Brokers,
				SASLMechanism:       cp.SASLMechanism,
				SASLProtocol:        cp.SASLProtocol,
				SkipAuth:            cp.SkipAuth,
				SASLUsername:        cp.SASLUsername,
				SASLPassword:        cp.SASLPassword,
				SkipTLSVerification: cp.SkipTLSVerification,
				TLSRoot:             cp.TLSRoot,
				TLSCert:             cp.TLSCert,
				TLSKey:              cp.TLSKey,
				KerberosServiceName: cp.KerberosServiceName,
				KerberosRealm:       cp.KerberosRealm,
				KerberosKeytab:      cp.KerberosKeytab,
				KerberosConfig:      cp.KerberosConfig,
			}
		}

		sources = append(sources, s)
	}
	return sources, nil
}

func extractSchemaFields(fields []schemaFieldV2, sourceID string) []models.Field {
	var out []models.Field
	for _, f := range fields {
		if f.SourceID == sourceID {
			out = append(out, models.Field{Name: f.Name, Type: f.Type})
		}
	}
	return out
}

func convertTransforms(v2 pipelineJSONv2) []pipelineTransform {
	var transforms []pipelineTransform

	for _, t := range v2.Source.Topics {
		if !t.Deduplication.Enabled {
			continue
		}
		sourceID := t.ID
		if sourceID == "" {
			sourceID = t.Topic
		}
		dedupKey := t.Deduplication.Key
		if dedupKey == "" {
			dedupKey = t.Deduplication.IDField
		}
		transforms = append(transforms, pipelineTransform{
			Type:     transformTypeDedup,
			SourceID: sourceID,
			Config: transformParams{
				Key:        dedupKey,
				TimeWindow: t.Deduplication.Window,
			},
		})
	}

	if v2.Filter.Enabled {
		sourceID := v2FirstSourceID(v2)
		transforms = append(transforms, pipelineTransform{
			Type:     transformTypeFilter,
			SourceID: sourceID,
			Config:   transformParams{Expression: v2.Filter.Expression},
		})
	}

	if v2.StatelessTransformation.Enabled {
		sourceID := v2.StatelessTransformation.SourceID
		if sourceID == "" {
			sourceID = v2FirstSourceID(v2)
		}
		transforms = append(transforms, pipelineTransform{
			Type:     transformTypeStateless,
			SourceID: sourceID,
			Config:   transformParams{Transforms: v2.StatelessTransformation.Config.Transform},
		})
	}

	return transforms
}

func convertJoin(v2 pipelineJSONv2) (join, error) {
	var leftSrc, rightSrc joinSourceV2
	found := 0
	for _, s := range v2.Join.Sources {
		switch s.Orientation {
		case "left":
			leftSrc = s
			found++
		case "right":
			rightSrc = s
			found++
		}
	}
	if found != 2 {
		return join{}, fmt.Errorf("join requires exactly one left and one right source, found %d oriented sources", found)
	}

	outputFields := make([]joinOutputField, 0, len(v2.Schema.Fields))
	for _, f := range v2.Schema.Fields {
		of := joinOutputField{
			SourceID: f.SourceID,
			Name:     f.Name,
		}
		if f.ColumnName != "" {
			of.OutputName = f.ColumnName
		}
		outputFields = append(outputFields, of)
	}

	return join{
		Enabled: true,
		Type:    v2.Join.Kind,
		LeftSource: joinSource{
			SourceID:   leftSrc.SourceID,
			Key:        leftSrc.Key,
			TimeWindow: leftSrc.Window,
		},
		RightSource: joinSource{
			SourceID:   rightSrc.SourceID,
			Key:        rightSrc.Key,
			TimeWindow: rightSrc.Window,
		},
		OutputFields: outputFields,
	}, nil
}

func sinkConnParams(s clickhouseSinkV2) sinkConnectionParamsV2 {
	if s.ConnectionParams != (sinkConnectionParamsV2{}) {
		return s.ConnectionParams
	}
	return sinkConnectionParamsV2{
		Host:                        s.Host,
		Port:                        s.Port,
		HttpPort:                    s.HttpPort,
		Database:                    s.Database,
		Username:                    s.Username,
		Password:                    s.Password,
		Secure:                      s.Secure,
		SkipCertificateVerification: s.SkipCertificateVerification,
	}
}

// decodeBase64Password decodes a base64-encoded password back to plaintext.
// v2 pipelines stored the ClickHouse password base64-encoded in the JSON;
// v3 expects plaintext (the storage layer handles encryption).
func decodeBase64Password(p string) string {
	decoded, err := base64.StdEncoding.DecodeString(p)
	if err != nil {
		return p // not base64 — already plaintext
	}
	return string(decoded)
}

func convertSink(v2 pipelineJSONv2) sink {
	cp := sinkConnParams(v2.Sink)
	s := sink{
		Type: v2.Sink.Kind,
		ConnectionParams: clickhouseConnectionParams{
			Host:                        cp.Host,
			Port:                        cp.Port,
			HTTPPort:                    cp.HttpPort,
			Database:                    cp.Database,
			Username:                    cp.Username,
			Password:                    decodeBase64Password(cp.Password),
			Secure:                      cp.Secure,
			SkipCertificateVerification: cp.SkipCertificateVerification,
		},
		Table:        v2.Sink.Table,
		MaxBatchSize: v2.Sink.MaxBatchSize,
		MaxDelayTime: v2.Sink.MaxDelayTime,
		Mapping:      convertSinkMapping(v2),
	}
	return s
}

func convertSinkMapping(v2 pipelineJSONv2) []sinkMappingEntry {
	// Prefer explicit table_mapping (v2 newer format)
	if len(v2.Sink.TableMapping) > 0 {
		entries := make([]sinkMappingEntry, len(v2.Sink.TableMapping))
		for i, m := range v2.Sink.TableMapping {
			entries[i] = sinkMappingEntry(m)
		}
		return entries
	}

	// Fall back to schema fields with column mapping
	var entries []sinkMappingEntry
	for _, f := range v2.Schema.Fields {
		if f.ColumnName == "" {
			continue
		}
		entries = append(entries, sinkMappingEntry{
			Name:       f.Name,
			ColumnName: f.ColumnName,
			ColumnType: f.ColumnType,
		})
	}
	return entries
}

func v2FirstSourceID(v2 pipelineJSONv2) string {
	if len(v2.Source.Topics) == 0 {
		return ""
	}
	t := v2.Source.Topics[0]
	if t.ID != "" {
		return t.ID
	}
	return t.Topic
}

// supplementFieldsFromTransforms adds any source fields referenced in transform
// expressions that are missing from the declared schema fields. This handles v2
// pipelines that used undeclared fields as transform inputs without listing them
// in schema.fields under the source's source_id.
func supplementFieldsFromTransforms(fields []models.Field, transforms []models.Transform) []models.Field {
	known := make(map[string]struct{}, len(fields))
	for _, f := range fields {
		known[f.Name] = struct{}{}
	}

	outputType := make(map[string]string, len(transforms))
	for _, tr := range transforms {
		outputType[tr.OutputName] = tr.OutputType
	}

	for _, tr := range transforms {
		for _, name := range extractExprIdentifiers(tr.Expression) {
			if _, exists := known[name]; exists {
				continue
			}
			typ, ok := outputType[name]
			if !ok {
				typ = tr.OutputType
			}
			fields = append(fields, models.Field{Name: name, Type: typ})
			known[name] = struct{}{}
		}
	}
	return fields
}

// extractExprIdentifiers parses an expr-lang expression and returns all identifier names.
func extractExprIdentifiers(expression string) []string {
	tree, err := parser.Parse(expression)
	if err != nil {
		return nil
	}
	c := &identifierCollector{seen: make(map[string]struct{})}
	ast.Walk(&tree.Node, c)
	return c.names
}

type identifierCollector struct {
	seen  map[string]struct{}
	names []string
}

func (c *identifierCollector) Visit(node *ast.Node) {
	ident, ok := (*node).(*ast.IdentifierNode)
	if !ok {
		return
	}
	if _, dup := c.seen[ident.Value]; dup {
		return
	}
	c.seen[ident.Value] = struct{}{}
	c.names = append(c.names, ident.Value)
}
