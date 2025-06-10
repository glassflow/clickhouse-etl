package repository

import (
	"encoding/json"
	"fmt"
	"time"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/models"
)

type clickhouseSink struct {
	Kind string `json:"type"`
	// Add validation for null/empty values
	Host     string                  `json:"host"`
	Port     string                  `json:"port"`
	Database string                  `json:"database"`
	Username string                  `json:"username"`
	Password string                  `json:"password"`
	Table    string                  `json:"table"`
	Secure   bool                    `json:"secure"`
	Mapping  []clickhouseSinkMapping `json:"table_mapping"`

	MaxBatchSize int    `json:"max_batch_size"`
	MaxDelayTime string `json:"max_delay_time" default:"60s"`
}

type clickhouseSinkMapping struct {
	Source    string `json:"source_id"`
	FieldName string `json:"field_name"`

	ColumnName string `json:"column_name"`
	ColumnType string `json:"column_type"`
}

func newClickhouseSinkFromModel(m models.ClickhouseSinkComponent) (json.RawMessage, error) {
	mappings := []clickhouseSinkMapping{}

	for _, i := range m.Mapping {
		mapping := clickhouseSinkMapping{
			Source:     i.Source,
			FieldName:  i.FieldName,
			ColumnName: i.ColumnName,
			ColumnType: i.ColumnType.String(),
		}
		mappings = append(mappings, mapping)
	}

	cs := clickhouseSink{
		Kind:         "clickhouse",
		Host:         m.Host,
		Port:         m.Port,
		Database:     m.Database,
		Username:     m.Username,
		Password:     m.Password,
		Table:        m.Table,
		Secure:       m.Secure,
		Mapping:      mappings,
		MaxBatchSize: m.MaxBatchSize,
		MaxDelayTime: m.MaxDelayTime.String(),
	}

	//nolint: wrapcheck // no more context needed
	return json.Marshal(cs)
}

func (c clickhouseSink) ToComponent() (models.Component, error) {
	t, err := time.ParseDuration(c.MaxDelayTime)
	if err != nil {
		return nil, fmt.Errorf("parse max_delay_time for sink: %w", err)
	}

	colMap := []models.ClickhouseColumnMappingArgs{}
	for _, col := range c.Mapping {
		colMap = append(colMap, models.ClickhouseColumnMappingArgs{
			Source:     col.Source,
			Field:      col.FieldName,
			ColumnName: col.ColumnName,
			ColumnType: col.ColumnType,
		})
	}

	s, err := models.NewClickhouseSinkComponent(models.ClickhouseSinkArgs{
		Host:         c.Host,
		Port:         c.Port,
		DB:           c.Database,
		User:         c.Username,
		Password:     c.Password,
		Table:        c.Table,
		Secure:       c.Secure,
		MaxBatchSize: c.MaxBatchSize,
		MaxDelayTime: t,
		ColMap:       colMap,
	})
	if err != nil {
		return nil, fmt.Errorf("parse clickhouse sink from db: %w", err)
	}

	return s, nil
}
