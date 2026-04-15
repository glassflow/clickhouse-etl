package api

import (
	"fmt"
	"reflect"
	"strings"
	"time"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/filter"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/mapper"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/models"
	jsonTransformer "github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/transformer/json"
)

// toModel converts a v3 API config into the internal domain model.
// All structural validation happens here; downstream code can assume the
// returned config is well-formed.
func (p pipelineJSON) toModel() (zero models.PipelineConfig, _ error) {
	if err := p.validate(); err != nil {
		return zero, err
	}

	schemaVersions := p.seedSchemaVersions()
	sourceType := p.resolveSourceType()

	ingestor, err := p.newIngestorComponentConfig()
	if err != nil {
		return zero, fmt.Errorf("create ingestor component config: %w", err)
	}

	otlpSource := p.newOTLPSourceConfig()

	filterCfg, err := p.newFilterConfig(schemaVersions)
	if err != nil {
		return zero, fmt.Errorf("create filter config: %w", err)
	}

	join, err := p.newJoinComponentConfig(schemaVersions)
	if err != nil {
		return zero, fmt.Errorf("create join component config: %w", err)
	}

	stateless, err := p.newStatelessTransformationConfig(schemaVersions)
	if err != nil {
		return zero, fmt.Errorf("create stateless transformation config: %w", err)
	}

	sink, err := p.newSinkComponentConfig(schemaVersions)
	if err != nil {
		return zero, fmt.Errorf("create sink component config: %w", err)
	}

	return models.NewPipelineConfig(
		strings.TrimSpace(p.PipelineID),
		p.Name,
		sourceType,
		otlpSource,
		ingestor,
		join,
		sink,
		filterCfg,
		stateless,
		p.Metadata,
		p.toPipelineResources(),
		schemaVersions,
	), nil
}

// validate enforces v3 structural constraints before any conversion runs.
func (p pipelineJSON) validate() error {
	if v := strings.TrimSpace(p.Version); v != "" && v != internal.PipelineVersion {
		return fmt.Errorf("unsupported pipeline version %q; expected %q", v, internal.PipelineVersion)
	}

	id := strings.TrimSpace(p.PipelineID)
	if len(id) < internal.MinPipelineIDLength {
		return fmt.Errorf("pipeline ID must be at least %d characters", internal.MinPipelineIDLength)
	}

	if err := p.validateSources(); err != nil {
		return err
	}
	if err := p.validateTransforms(); err != nil {
		return err
	}
	if err := p.validateJoinRefs(); err != nil {
		return err
	}
	if err := p.validateResourcesRefs(); err != nil {
		return err
	}
	return nil
}

func (p pipelineJSON) validateSources() error {
	if len(p.Sources) == 0 {
		return fmt.Errorf("pipeline must have at least one source")
	}
	if len(p.Sources) > internal.MaxStreamsSupportedWithJoin {
		return fmt.Errorf("pipeline must have at most %d sources", internal.MaxStreamsSupportedWithJoin)
	}

	seen := make(map[string]struct{}, len(p.Sources))
	var kafkaCount, otlpCount int
	for i, s := range p.Sources {
		id := strings.TrimSpace(s.SourceID)
		if id == "" {
			return fmt.Errorf("source at index %d has empty source_id", i)
		}
		if _, dup := seen[id]; dup {
			return fmt.Errorf("duplicate source_id %q", id)
		}
		seen[id] = struct{}{}

		st := models.SourceType(strings.ToLower(strings.TrimSpace(s.Type)))
		if !st.Valid() {
			return fmt.Errorf("source %q: unsupported type %q", id, s.Type)
		}
		switch {
		case st.IsKafka():
			kafkaCount++
			if s.ConnectionParams == nil {
				return fmt.Errorf("source %q: kafka source must declare connection_params", id)
			}
			if strings.TrimSpace(s.Topic) == "" {
				return fmt.Errorf("source %q: kafka source must declare topic", id)
			}
		case st.IsOTLP():
			otlpCount++
			if s.ConnectionParams != nil {
				return fmt.Errorf("source %q: OTLP source must not declare connection_params", id)
			}
			if s.Topic != "" {
				return fmt.Errorf("source %q: OTLP source must not declare topic", id)
			}
			if len(s.SchemaFields) > 0 {
				return fmt.Errorf("source %q: OTLP source must not declare schema_fields", id)
			}
			if s.SchemaRegistry != nil {
				return fmt.Errorf("source %q: OTLP source must not declare schema_registry", id)
			}
		}
	}

	if kafkaCount > 0 && otlpCount > 0 {
		return fmt.Errorf("mixed kafka and OTLP sources are not supported")
	}
	if otlpCount > 1 {
		return fmt.Errorf("at most one OTLP source is supported")
	}

	// Two kafka sources require the same connection_params.
	// TODO: if we add support for more than two sources in the future, we need to store it separately
	if kafkaCount == 2 {
		if !reflect.DeepEqual(p.Sources[0].ConnectionParams, p.Sources[1].ConnectionParams) {
			return fmt.Errorf("kafka sources must share identical connection_params")
		}
	}

	// Join presence mirrors source count.
	joinEnabled := p.Join != nil && p.Join.Enabled
	if kafkaCount == 2 && !joinEnabled {
		return fmt.Errorf("two kafka sources require join.enabled=true")
	}
	if (kafkaCount <= 1) && joinEnabled {
		return fmt.Errorf("join.enabled=true requires exactly two kafka sources")
	}
	if otlpCount > 0 && joinEnabled {
		return fmt.Errorf("join is not supported for OTLP pipelines")
	}

	return nil
}

func (p pipelineJSON) validateTransforms() error {
	sourceIDs := p.sourceIDSet()

	var dedupPerSource = make(map[string]int)
	var filterCount, statelessCount int

	for i, t := range p.Transforms {
		if _, ok := sourceIDs[t.SourceID]; !ok {
			return fmt.Errorf("transform at index %d references unknown source_id %q", i, t.SourceID)
		}
		switch t.Type {
		case transformTypeDedup:
			dedupPerSource[t.SourceID]++
			if dedupPerSource[t.SourceID] > 1 {
				return fmt.Errorf("source %q has more than one dedup transform", t.SourceID)
			}
		case transformTypeFilter:
			filterCount++
			if filterCount > 1 {
				return fmt.Errorf("at most one filter transform is supported")
			}
		case transformTypeStateless:
			statelessCount++
			if statelessCount > 1 {
				return fmt.Errorf("at most one stateless transform is supported")
			}
		default:
			return fmt.Errorf("transform at index %d has unsupported type %q", i, t.Type)
		}
	}

	if (filterCount > 0 || statelessCount > 0) && p.Join != nil && p.Join.Enabled {
		return fmt.Errorf("filter/stateless transforms are not supported with join")
	}
	return nil
}

func (p pipelineJSON) validateJoinRefs() error {
	if p.Join == nil || !p.Join.Enabled {
		return nil
	}
	ids := p.sourceIDSet()
	if _, ok := ids[p.Join.LeftSource.SourceID]; !ok {
		return fmt.Errorf("join.left_source.source_id %q does not match any source", p.Join.LeftSource.SourceID)
	}
	if _, ok := ids[p.Join.RightSource.SourceID]; !ok {
		return fmt.Errorf("join.right_source.source_id %q does not match any source", p.Join.RightSource.SourceID)
	}
	if p.Join.LeftSource.SourceID == p.Join.RightSource.SourceID {
		return fmt.Errorf("join.left_source and join.right_source must differ")
	}
	for i, f := range p.Join.OutputFields {
		if _, ok := ids[f.SourceID]; !ok {
			return fmt.Errorf("join.output_fields[%d].source_id %q does not match any source", i, f.SourceID)
		}
		if strings.TrimSpace(f.Name) == "" {
			return fmt.Errorf("join.output_fields[%d].name cannot be empty", i)
		}
	}
	return nil
}

func (p pipelineJSON) validateResourcesRefs() error {
	ids := p.sourceIDSet()
	otlpIDs := make(map[string]struct{})
	for _, s := range p.Sources {
		if models.SourceType(strings.ToLower(s.Type)).IsOTLP() {
			otlpIDs[s.SourceID] = struct{}{}
		}
	}

	dedupBySource := make(map[string]struct{})
	for _, t := range p.Transforms {
		if t.Type == transformTypeDedup {
			dedupBySource[t.SourceID] = struct{}{}
		}
	}

	for i, sr := range p.Resources.Sources {
		_, ok := ids[sr.SourceID]
		if !ok {
			return fmt.Errorf("resources.sources[%d].source_id %q does not match any source", i, sr.SourceID)
		}

		_, isOTLP := otlpIDs[sr.SourceID]
		if isOTLP {
			return fmt.Errorf("resources.sources[%d]: per-source resources are not supported for OTLP source %q", i, sr.SourceID)
		}
	}
	for i, tr := range p.Resources.Transform {
		_, ok := ids[tr.SourceID]
		if !ok {
			return fmt.Errorf("resources.transform[%d].source_id %q does not match any source", i, tr.SourceID)
		}
		if tr.Storage != nil {
			_, hasDedup := dedupBySource[tr.SourceID]
			if !hasDedup {
				return fmt.Errorf("resources.transform[%d]: storage is only allowed when a dedup transform is defined for source %q", i, tr.SourceID)
			}
		}
	}
	return nil
}

func (p pipelineJSON) sourceIDSet() map[string]struct{} {
	ids := make(map[string]struct{}, len(p.Sources))
	for _, s := range p.Sources {
		ids[s.SourceID] = struct{}{}
	}
	return ids
}

// resolveSourceType returns the SourceType of sources[0]. Validation already
// guaranteed homogeneity and validity.
func (p pipelineJSON) resolveSourceType() models.SourceType {
	return models.SourceType(strings.ToLower(strings.TrimSpace(p.Sources[0].Type)))
}

// seedSchemaVersions builds the source_id → SchemaVersion map in one pass
// before any component config is built. Downstream builders look up schemas
// by source_id.
func (p pipelineJSON) seedSchemaVersions() map[string]models.SchemaVersion {
	schemaVersions := make(map[string]models.SchemaVersion, len(p.Sources))
	for _, s := range p.Sources {
		st := models.SourceType(strings.ToLower(strings.TrimSpace(s.Type)))
		switch {
		case st.IsKafka():
			if len(s.SchemaFields) == 0 {
				continue
			}
			version := s.SchemaVersion
			if version == "" {
				version = "1"
			}
			schemaVersions[s.SourceID] = models.SchemaVersion{
				SourceID:  s.SourceID,
				VersionID: version,
				Fields:    s.SchemaFields,
			}
		case st.IsOTLP():
			fields := st.SchemaFields()
			if len(fields) == 0 {
				continue
			}
			schemaVersions[s.SourceID] = models.SchemaVersion{
				SourceID:  s.SourceID,
				VersionID: "1",
				Fields:    fields,
			}
		}
	}
	return schemaVersions
}

func (p pipelineJSON) newIngestorComponentConfig() (zero models.IngestorComponentConfig, _ error) {
	st := p.resolveSourceType()
	if !st.IsKafka() {
		return zero, nil
	}

	conn := p.Sources[0].ConnectionParams
	kafkaConn := models.KafkaConnectionParamsConfig{
		Brokers:             conn.Brokers,
		SkipAuth:            conn.SkipAuth,
		SASLProtocol:        conn.SASLProtocol,
		SASLMechanism:       conn.SASLMechanism,
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

	dedupBySource, err := p.dedupConfigsBySourceID()
	if err != nil {
		return zero, err
	}
	replicasBySource := p.ingestorReplicasBySourceID()

	topics := make([]models.KafkaTopicsConfig, 0, len(p.Sources))
	for _, s := range p.Sources {
		replicas := 1
		if r, ok := replicasBySource[s.SourceID]; ok && r != nil && *r > 0 {
			replicas = int(*r)
		}

		srConfig := s.SchemaRegistry
		if srConfig == nil {
			srConfig = &models.SchemaRegistryConfig{}
		}

		topic := models.KafkaTopicsConfig{
			Name:                       s.Topic,
			ID:                         s.SourceID,
			ConsumerGroupName:          models.GetKafkaConsumerGroupName(p.PipelineID),
			ConsumerGroupInitialOffset: s.ConsumerGroupInitialOffset,
			Replicas:                   replicas,
			SchemaRegistryConfig:       *srConfig,
		}
		if d, ok := dedupBySource[s.SourceID]; ok {
			// Validate the dedup key against the source schema.
			if len(s.SchemaFields) > 0 && !hasFieldNamed(s.SchemaFields, d.Key) {
				return zero, fmt.Errorf("dedup key %q not found in schema_fields for source %q", d.Key, s.SourceID)
			}
			topic.Deduplication = models.DeduplicationConfig{
				Enabled: true,
				ID:      d.Key,
				Window:  d.TimeWindow,
			}
		}
		topics = append(topics, topic)
	}

	cfg, err := models.NewIngestorComponentConfig("", kafkaConn, topics)
	if err != nil {
		return zero, fmt.Errorf("create ingestor config: %w", err)
	}
	return cfg, nil
}

func (p pipelineJSON) newOTLPSourceConfig() models.OTLPSourceConfig {
	if !p.resolveSourceType().IsOTLP() {
		return models.OTLPSourceConfig{}
	}
	s := p.Sources[0]
	cfg := models.OTLPSourceConfig{ID: s.SourceID}

	for _, t := range p.Transforms {
		if t.Type != transformTypeDedup || t.SourceID != s.SourceID {
			continue
		}
		cfg.Deduplication = models.DeduplicationConfig{
			Enabled: true,
			ID:      t.Config.Key,
			Window:  t.Config.TimeWindow,
		}
	}
	return cfg
}

func (p pipelineJSON) newJoinComponentConfig(schemaVersions map[string]models.SchemaVersion) (zero models.JoinComponentConfig, _ error) {
	if p.Join == nil || !p.Join.Enabled {
		return zero, nil
	}

	joinID := p.PipelineID + internal.JoinIDSuffix
	kind := p.Join.Type
	if kind == "" {
		kind = internal.TemporalJoinType
	}

	sources := []models.JoinSourceConfig{
		{
			SourceID:    p.Join.LeftSource.SourceID,
			JoinKey:     p.Join.LeftSource.Key,
			Window:      p.Join.LeftSource.TimeWindow,
			Orientation: internal.JoinLeft,
		},
		{
			SourceID:    p.Join.RightSource.SourceID,
			JoinKey:     p.Join.RightSource.Key,
			Window:      p.Join.RightSource.TimeWindow,
			Orientation: internal.JoinRight,
		},
	}

	// Validate join keys against schemas.
	for _, js := range sources {
		sv, ok := schemaVersions[js.SourceID]
		if !ok {
			continue
		}
		if !sv.HasField(js.JoinKey) {
			return zero, fmt.Errorf("join key %q not found in schema_fields for source %q", js.JoinKey, js.SourceID)
		}
	}

	rules := make([]models.JoinRule, 0, len(p.Join.OutputFields))
	for _, f := range p.Join.OutputFields {
		rules = append(rules, models.JoinRule{
			SourceID:   f.SourceID,
			SourceName: f.Name,
			OutputName: f.OutputName,
		})
	}

	cfg, err := models.NewJoinComponentConfig(kind, joinID, sources, rules)
	if err != nil {
		return zero, fmt.Errorf("create join config: %w", err)
	}

	// Seed the join output schema
	joinFields := make([]models.Field, 0, len(rules))
	for _, r := range rules {
		sv, ok := schemaVersions[r.SourceID]
		if !ok {
			return zero, fmt.Errorf("schema version for join source_id %q not found", r.SourceID)
		}
		sourceField, found := sv.GetField(r.SourceName)
		if !found {
			return zero, fmt.Errorf("join output field %q not found in schema for source %q", r.SourceName, r.SourceID)
		}
		outputName := r.OutputName
		if outputName == "" {
			outputName = r.SourceName
		}
		joinFields = append(joinFields, models.Field{Name: outputName, Type: sourceField.Type})
	}
	if len(joinFields) > 0 {
		schemaVersions[joinID] = models.SchemaVersion{
			SourceID: joinID,
			Fields:   joinFields,
		}
	}
	return cfg, nil
}

func (p pipelineJSON) newFilterConfig(schemaVersions map[string]models.SchemaVersion) (models.FilterComponentConfig, error) {
	t, ok, err := p.findFilterTransform()
	if err != nil {
		return models.FilterComponentConfig{}, err
	}
	if !ok {
		return models.FilterComponentConfig{}, nil
	}

	if sv, has := schemaVersions[t.SourceID]; has {
		if err := filter.ValidateFilterExpressionV2(t.Config.Expression, sv.Fields); err != nil {
			return models.FilterComponentConfig{}, fmt.Errorf("filter validation against schema: %w", err)
		}
	}

	return models.FilterComponentConfig{
		Enabled:    true,
		Expression: t.Config.Expression,
	}, nil
}

func (p pipelineJSON) newStatelessTransformationConfig(schemaVersions map[string]models.SchemaVersion) (models.StatelessTransformation, error) {
	t, ok, err := p.findStatelessTransform()
	if err != nil {
		return models.StatelessTransformation{}, err
	}
	if !ok || len(t.Config.Transforms) == 0 {
		return models.StatelessTransformation{}, nil
	}

	if _, err := jsonTransformer.NewTransformer(t.Config.Transforms); err != nil {
		return models.StatelessTransformation{}, fmt.Errorf("stateless transformation: %w", err)
	}

	sv, found := schemaVersions[t.SourceID]
	if !found {
		return models.StatelessTransformation{}, fmt.Errorf("schema version for stateless transformation source_id %q not found", t.SourceID)
	}
	if err := jsonTransformer.ValidateTransformationAgainstSchema(t.Config.Transforms, sv.Fields); err != nil {
		return models.StatelessTransformation{}, fmt.Errorf("validate stateless transformation: %w", err)
	}

	statelessID := p.PipelineID + internal.StatelessIDSuffix
	outputFields := make([]models.Field, 0, len(t.Config.Transforms))
	for _, tr := range t.Config.Transforms {
		outputFields = append(outputFields, models.Field{Name: tr.OutputName, Type: tr.OutputType})
	}
	if len(outputFields) > 0 {
		schemaVersions[statelessID] = models.SchemaVersion{
			SourceID: statelessID,
			Fields:   outputFields,
		}
	}

	return models.StatelessTransformation{
		ID:       statelessID,
		Enabled:  true,
		SourceID: t.SourceID,
		Config: models.StatelessTransformationsConfig{
			Transform: t.Config.Transforms,
		},
	}, nil
}

func (p pipelineJSON) newSinkComponentConfig(schemaVersions map[string]models.SchemaVersion) (zero models.SinkComponentConfig, _ error) {
	sinkSourceID := p.sinkSourceID()

	mappings := make([]models.Mapping, 0, len(p.Sink.Mapping))
	if len(p.Sink.Mapping) > 0 {
		sv, found := schemaVersions[sinkSourceID]
		if !found {
			return zero, fmt.Errorf("schema version for sink source_id %q not found", sinkSourceID)
		}
		for _, m := range p.Sink.Mapping {
			sourceField, ok := sv.GetField(m.Name)
			if !ok {
				return zero, fmt.Errorf("mapping field %q not found in schema for source_id %q", m.Name, sinkSourceID)
			}

			err := mapper.ValidateClickHouseColumnType(m.ColumnType)
			if err != nil {
				return zero, fmt.Errorf("field %q (column %q): %w", m.Name, m.ColumnName, err)
			}
			mappings = append(mappings, models.Mapping{
				SourceField:      sourceField.Name,
				SourceType:       sourceField.Type,
				DestinationField: m.ColumnName,
				DestinationType:  m.ColumnType,
			})
		}
	}

	maxDelay := p.Sink.MaxDelayTime
	if maxDelay.Duration() == 0 {
		maxDelay = *models.NewJSONDuration(60 * time.Second)
	}

	out, err := models.NewClickhouseSinkComponent(models.ClickhouseSinkArgs{
		Host:                 p.Sink.ConnectionParams.Host,
		Port:                 p.Sink.ConnectionParams.Port,
		HttpPort:             p.Sink.ConnectionParams.HTTPPort,
		DB:                   p.Sink.ConnectionParams.Database,
		User:                 p.Sink.ConnectionParams.Username,
		Password:             p.Sink.ConnectionParams.Password,
		Secure:               p.Sink.ConnectionParams.Secure,
		SkipCertificateCheck: p.Sink.ConnectionParams.SkipCertificateVerification,
		Table:                p.Sink.Table,
		MaxBatchSize:         p.Sink.MaxBatchSize,
		MaxDelayTime:         maxDelay,
		Mappings:             mappings,
	})
	if err != nil {
		return zero, fmt.Errorf("create sink config: %w", err)
	}
	out.NATSConsumerName = models.GetNATSSinkConsumerName(p.PipelineID)
	out.SourceID = sinkSourceID
	out.Config = mappings
	return out, nil
}

// sinkSourceID returns the upstream source_id that feeds the sink.
// Join pipelines feed from the synthesized join output; single-source
// pipelines feed from that source's ID; stateless-transformed pipelines
// feed from the stateless output.
func (p pipelineJSON) sinkSourceID() string {
	if p.Join != nil && p.Join.Enabled {
		return p.PipelineID + internal.JoinIDSuffix
	}
	for _, t := range p.Transforms {
		if t.Type == transformTypeStateless {
			return p.PipelineID + internal.StatelessIDSuffix
		}
	}
	return p.Sources[0].SourceID
}

// toPipelineResources translates the v3 resources block into the internal
// PipelineResources shape. Fields left unset by the caller fall back to the
// internal defaults applied later in the service layer.
func (p pipelineJSON) toPipelineResources() models.PipelineResources {
	var out models.PipelineResources
	out.Nats = p.Resources.NATS
	out.Sink = p.Resources.Sink

	if len(p.Resources.Sources) > 0 {
		ing := &models.IngestorResources{}
		if p.Join != nil && p.Join.Enabled {
			for _, sr := range p.Resources.Sources {
				cr := toComponentResources(sr.Replicas, sr.Requests, sr.Limits, nil)
				switch sr.SourceID {
				case p.Join.LeftSource.SourceID:
					ing.Left = cr
				case p.Join.RightSource.SourceID:
					ing.Right = cr
				}
			}
		} else {
			// Single-source pipeline: attach to .Base.
			sr := p.Resources.Sources[0]
			ing.Base = toComponentResources(sr.Replicas, sr.Requests, sr.Limits, nil)
		}
		out.Ingestor = ing
	}

	if len(p.Resources.Transform) > 0 {
		// Internal model carries one Transform block. If multiple entries
		// are present (e.g. per-source dedup resources for a join), pick
		// the first; validation already constrained correctness.
		tr := p.Resources.Transform[0]
		out.Transform = toComponentResources(tr.Replicas, tr.Requests, tr.Limits, tr.Storage)
	}

	return out
}

// ---- transform accessors --------------------------------------------------

func (p pipelineJSON) dedupConfigsBySourceID() (map[string]transformParams, error) {
	out := make(map[string]transformParams)
	for i, t := range p.Transforms {
		if t.Type != transformTypeDedup {
			continue
		}
		if strings.TrimSpace(t.Config.Key) == "" {
			return nil, fmt.Errorf("transforms[%d] (dedup): key cannot be empty", i)
		}
		if t.Config.TimeWindow.Duration() == 0 {
			return nil, fmt.Errorf("transforms[%d] (dedup): time_window must be greater than zero", i)
		}
		out[t.SourceID] = t.Config
	}
	return out, nil
}

func (p pipelineJSON) findFilterTransform() (pipelineTransform, bool, error) {
	for i, t := range p.Transforms {
		if t.Type != transformTypeFilter {
			continue
		}
		if strings.TrimSpace(t.Config.Expression) == "" {
			return pipelineTransform{}, false, fmt.Errorf("transforms[%d] (filter): expression cannot be empty", i)
		}
		return t, true, nil
	}
	return pipelineTransform{}, false, nil
}

func (p pipelineJSON) findStatelessTransform() (pipelineTransform, bool, error) {
	for _, t := range p.Transforms {
		if t.Type != transformTypeStateless {
			continue
		}
		return t, true, nil
	}
	return pipelineTransform{}, false, nil
}

func hasFieldNamed(fields []models.Field, name string) bool {
	for _, f := range fields {
		if f.Name == name {
			return true
		}
	}
	return false
}

func toComponentResources(replicas *int64, req, lim *models.ResourceList, storage *models.StorageConfig) *models.ComponentResources {
	if replicas == nil && req == nil && lim == nil && storage == nil {
		return nil
	}
	return &models.ComponentResources{
		Replicas: replicas,
		Requests: req,
		Limits:   lim,
		Storage:  storage,
	}
}

// ingestorReplicasBySourceID builds a source_id → replicas lookup from the
// v3 resources.sources[] entries so ingestor topics inherit the correct count.
func (p pipelineJSON) ingestorReplicasBySourceID() map[string]*int64 {
	out := make(map[string]*int64, len(p.Resources.Sources))
	for _, sr := range p.Resources.Sources {
		out[sr.SourceID] = sr.Replicas
	}
	return out
}
