package api

import (
	"strings"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/models"
)

// toJSON converts an internal PipelineConfig back into the API JSON shape.
// Used for the GET endpoint's response.
func toJSON(p models.PipelineConfig) pipelineJSON {
	cfg := pipelineJSON{
		Version:    internal.PipelineVersion,
		PipelineID: p.ID,
		Name:       p.Name,
		Metadata:   p.Metadata,
	}

	cfg.Sources = buildSources(p)
	cfg.Transforms = buildTransforms(p)
	cfg.Join = buildJoin(p)
	cfg.Sink = buildSink(p)
	cfg.Resources = buildResources(p)
	return cfg
}

func buildSources(p models.PipelineConfig) []source {
	switch {
	case p.SourceType.IsKafka():
		conn := kafkaConnectionParamsFromModel(p.Ingestor.KafkaConnectionParams)
		sources := make([]source, 0, len(p.Ingestor.KafkaTopics))
		for _, t := range p.Ingestor.KafkaTopics {
			sourceID := t.ID
			if sourceID == "" {
				sourceID = t.Name
			}
			src := source{
				Type:                       string(p.SourceType),
				SourceID:                   sourceID,
				ConnectionParams:           &conn,
				Topic:                      t.Name,
				ConsumerGroupInitialOffset: t.ConsumerGroupInitialOffset,
			}
			if t.SchemaRegistryConfig != (models.SchemaRegistryConfig{}) {
				sr := t.SchemaRegistryConfig
				src.SchemaRegistry = &sr
			}
			if sv, ok := p.SchemaVersions[sourceID]; ok {
				src.SchemaVersion = sv.VersionID
				src.SchemaFields = sv.Fields
			}
			sources = append(sources, src)
		}
		return sources
	case p.SourceType.IsOTLP():
		return []source{{Type: string(p.SourceType), SourceID: p.OTLPSource.ID}}
	default:
		return nil
	}
}

func buildTransforms(p models.PipelineConfig) []pipelineTransform {
	var transformations []pipelineTransform

	// Dedup transforms: one per Kafka topic that has it enabled, plus OTLP.
	for _, t := range p.Ingestor.KafkaTopics {
		if !t.Deduplication.Enabled {
			continue
		}
		sourceID := t.ID
		if sourceID == "" {
			sourceID = t.Name
		}
		transformations = append(transformations, pipelineTransform{
			Type:     transformTypeDedup,
			SourceID: sourceID,
			Config: transformParams{
				Key:        t.Deduplication.ID,
				TimeWindow: t.Deduplication.Window,
			},
		})
	}
	if p.SourceType.IsOTLP() && p.OTLPSource.Deduplication.Enabled {
		transformations = append(transformations, pipelineTransform{
			Type:     transformTypeDedup,
			SourceID: p.OTLPSource.ID,
			Config: transformParams{
				Key:        p.OTLPSource.Deduplication.ID,
				TimeWindow: p.OTLPSource.Deduplication.Window,
			},
		})
	}

	if p.Filter.Enabled {
		sourceID := firstSourceID(p)
		transformations = append(transformations, pipelineTransform{
			Type:     transformTypeFilter,
			SourceID: sourceID,
			Config: transformParams{
				Expression: p.Filter.Expression,
			},
		})
	}

	if p.StatelessTransformation.Enabled && len(p.StatelessTransformation.Config.Transform) > 0 {
		transformations = append(transformations, pipelineTransform{
			Type:     transformTypeStateless,
			SourceID: p.StatelessTransformation.SourceID,
			Config: transformParams{
				Transforms: p.StatelessTransformation.Config.Transform,
			},
		})
	}
	return transformations
}

func buildJoin(p models.PipelineConfig) *join {
	if !p.Join.Enabled {
		return nil
	}
	j := &join{
		Enabled: true,
		Type:    p.Join.Type,
	}
	if j.Type == "" {
		j.Type = internal.TemporalJoinType
	}
	for _, s := range p.Join.Sources {
		js := joinSource{SourceID: s.SourceID, Key: s.JoinKey, TimeWindow: s.Window}
		switch strings.ToLower(s.Orientation) {
		case internal.JoinLeft:
			j.LeftSource = js
		case internal.JoinRight:
			j.RightSource = js
		}
	}
	for _, r := range p.Join.Config {
		j.OutputFields = append(j.OutputFields, joinOutputField{
			SourceID:   r.SourceID,
			Name:       r.SourceName,
			OutputName: r.OutputName,
		})
	}
	return j
}

func buildSink(p models.PipelineConfig) sink {
	mapping := make([]sinkMappingEntry, 0, len(p.Sink.Config))
	for _, m := range p.Sink.Config {
		mapping = append(mapping, sinkMappingEntry{
			Name:       m.SourceField,
			ColumnName: m.DestinationField,
			ColumnType: m.DestinationType,
		})
	}
	return sink{
		Type: internal.ClickHouseSinkType,
		ConnectionParams: clickhouseConnectionParams{
			Host:                        p.Sink.ClickHouseConnectionParams.Host,
			Port:                        p.Sink.ClickHouseConnectionParams.Port,
			HTTPPort:                    p.Sink.ClickHouseConnectionParams.HttpPort,
			Database:                    p.Sink.ClickHouseConnectionParams.Database,
			Username:                    p.Sink.ClickHouseConnectionParams.Username,
			Password:                    p.Sink.ClickHouseConnectionParams.Password,
			Secure:                      p.Sink.ClickHouseConnectionParams.Secure,
			SkipCertificateVerification: p.Sink.ClickHouseConnectionParams.SkipCertificateCheck,
		},
		Table:        p.Sink.ClickHouseConnectionParams.Table,
		MaxBatchSize: p.Sink.Batch.MaxBatchSize,
		MaxDelayTime: p.Sink.Batch.MaxDelayTime,
		Mapping:      mapping,
	}
}

func buildResources(p models.PipelineConfig) resources {
	var out resources
	out.NATS = p.PipelineResources.Nats
	out.Sink = p.PipelineResources.Sink

	if ing := p.PipelineResources.Ingestor; ing != nil {
		if p.Join.Enabled {
			if ing.Left != nil {
				out.Sources = append(out.Sources, sourceResourcesFromComponent(joinSourceID(p.Join.Sources, internal.JoinLeft), ing.Left))
			}
			if ing.Right != nil {
				out.Sources = append(out.Sources, sourceResourcesFromComponent(joinSourceID(p.Join.Sources, internal.JoinRight), ing.Right))
			}
		} else if ing.Base != nil {
			out.Sources = append(out.Sources, sourceResourcesFromComponent(firstSourceID(p), ing.Base))
		}
	}

	if tr := p.PipelineResources.Transform; tr != nil {
		dedupSources := dedupSourceIDSet(p)
		for _, sourceID := range transformResourceSourceIDs(p) {
			var storage *models.StorageConfig
			if _, hasDedup := dedupSources[sourceID]; hasDedup {
				storage = tr.Storage
			}
			out.Transform = append(out.Transform, transformResources{
				SourceID: sourceID,
				Replicas: tr.Replicas,
				Requests: tr.Requests,
				Limits:   tr.Limits,
				Storage:  storage,
			})
		}
	}
	return out
}

// dedupSourceIDSet returns the set of source IDs that have dedup enabled.
func dedupSourceIDSet(p models.PipelineConfig) map[string]struct{} {
	ids := make(map[string]struct{})
	for _, t := range p.Ingestor.KafkaTopics {
		if t.Deduplication.Enabled {
			sourceID := t.ID
			if sourceID == "" {
				sourceID = t.Name
			}
			ids[sourceID] = struct{}{}
		}
	}
	if p.SourceType.IsOTLP() && p.OTLPSource.Deduplication.Enabled {
		ids[p.OTLPSource.ID] = struct{}{}
	}
	return ids
}

// transformResourceSourceIDs returns the source_ids that should carry a
// resources.transform[] entry when converting model -> v3. Dedup sources come
// first (one per topic with dedup enabled, or the OTLP source), followed by
// the stateless transform source if distinct.
func transformResourceSourceIDs(p models.PipelineConfig) []string {
	seen := make(map[string]struct{})
	var ids []string
	add := func(id string) {
		if id == "" {
			return
		}
		if _, ok := seen[id]; ok {
			return
		}
		seen[id] = struct{}{}
		ids = append(ids, id)
	}

	for _, t := range p.Ingestor.KafkaTopics {
		if !t.Deduplication.Enabled {
			continue
		}
		sourceID := t.ID
		if sourceID == "" {
			sourceID = t.Name
		}
		add(sourceID)
	}
	if p.SourceType.IsOTLP() && p.OTLPSource.Deduplication.Enabled {
		add(p.OTLPSource.ID)
	}
	if p.StatelessTransformation.Enabled {
		add(p.StatelessTransformation.SourceID)
	}
	return ids
}

func sourceResourcesFromComponent(sourceID string, cr *models.ComponentResources) sourceResources {
	return sourceResources{
		SourceID: sourceID,
		Replicas: cr.Replicas,
		Requests: cr.Requests,
		Limits:   cr.Limits,
	}
}

func kafkaConnectionParamsFromModel(conn models.KafkaConnectionParamsConfig) kafkaConnectionParams {
	return kafkaConnectionParams{
		Brokers:             conn.Brokers,
		SASLMechanism:       conn.SASLMechanism,
		SASLProtocol:        conn.SASLProtocol,
		SkipAuth:            conn.SkipAuth,
		SASLUsername:        conn.SASLUsername,
		SASLPassword:        conn.SASLPassword,
		SkipTLSVerification: conn.SkipTLSVerification,
		TLSRoot:             conn.TLSRoot,
		TLSCert:             conn.TLSCert,
		TLSKey:              conn.TLSKey,
		KerberosServiceName: conn.KerberosServiceName,
		KerberosRealm:       conn.KerberosRealm,
		KerberosKeytab:      conn.KerberosKeytab,
		KerberosConfig:      conn.KerberosConfig,
	}
}

func firstSourceID(p models.PipelineConfig) string {
	if p.SourceType.IsOTLP() {
		return p.OTLPSource.ID
	}
	if len(p.Ingestor.KafkaTopics) > 0 {
		t := p.Ingestor.KafkaTopics[0]
		if t.ID != "" {
			return t.ID
		}
		return t.Name
	}
	return ""
}

func joinSourceID(sources []models.JoinSourceConfig, orientation string) string {
	for _, s := range sources {
		if strings.EqualFold(s.Orientation, orientation) {
			return s.SourceID
		}
	}
	return ""
}
