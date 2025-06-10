package models

import (
	"testing"
	"time"

	"github.com/stretchr/testify/require"
)

func TestNewClickhouseSinkComponent(t *testing.T) {
	testCases := []struct {
		desc                 string
		args                 ClickhouseSinkArgs
		expectedErr          error
		expectedComponentNil bool
	}{
		{
			desc: "valid sink",
			args: ClickhouseSinkArgs{
				Host:         "host",
				Port:         "port",
				DB:           "db",
				User:         "user",
				Password:     "password",
				Table:        "table",
				Secure:       false,
				MaxBatchSize: 100,
				MaxDelayTime: 5 * time.Second,
				ColMap: []ClickhouseColumnMappingArgs{{
					Source:     "stream_a",
					Field:      "order_id",
					ColumnName: "OrderID",
					ColumnType: "string",
				}},
			},
			expectedErr:          nil,
			expectedComponentNil: false,
		},
		{
			desc: "empty host",
			args: ClickhouseSinkArgs{
				Host:         " ",
				Port:         "port",
				DB:           "db",
				User:         "user",
				Password:     "password",
				Table:        "table",
				Secure:       false,
				MaxBatchSize: 100,
				MaxDelayTime: 5 * time.Second,
				ColMap: []ClickhouseColumnMappingArgs{{
					Source:     "stream_a",
					Field:      "order_id",
					ColumnName: "OrderID",
					ColumnType: "string",
				}},
			},
			expectedErr:          PipelineConfigError{msg: "clickhouse host cannot be empty"},
			expectedComponentNil: true,
		},
		{
			desc: "empty port",
			args: ClickhouseSinkArgs{
				Host:         "host",
				Port:         "  ",
				DB:           "db",
				User:         "user",
				Password:     "password",
				Table:        "table",
				Secure:       false,
				MaxBatchSize: 100,
				MaxDelayTime: 5 * time.Second,
				ColMap: []ClickhouseColumnMappingArgs{{
					Source:     "stream_a",
					Field:      "order_id",
					ColumnName: "OrderID",
					ColumnType: "string",
				}},
			},
			expectedErr:          PipelineConfigError{msg: "clickhouse port cannot be empty"},
			expectedComponentNil: true,
		},
		{
			desc: "empty db name",
			args: ClickhouseSinkArgs{
				Host:         "host",
				Port:         "port",
				DB:           "  ",
				User:         "user",
				Password:     "password",
				Table:        "table",
				Secure:       false,
				MaxBatchSize: 100,
				MaxDelayTime: 5 * time.Second,
				ColMap: []ClickhouseColumnMappingArgs{{
					Source:     "stream_a",
					Field:      "order_id",
					ColumnName: "OrderID",
					ColumnType: "string",
				}},
			},
			expectedErr:          PipelineConfigError{msg: "clickhouse database cannot be empty"},
			expectedComponentNil: true,
		},
		{
			desc: "empty username",
			args: ClickhouseSinkArgs{
				Host:         "host",
				Port:         "port",
				DB:           "db",
				User:         "",
				Password:     "password",
				Table:        "table",
				Secure:       false,
				MaxBatchSize: 100,
				MaxDelayTime: 5 * time.Second,
				ColMap: []ClickhouseColumnMappingArgs{{
					Source:     "stream_a",
					Field:      "order_id",
					ColumnName: "OrderID",
					ColumnType: "string",
				}},
			},
			expectedErr:          PipelineConfigError{msg: "clickhouse user cannot be empty"},
			expectedComponentNil: true,
		},
		{
			desc: "empty password",
			args: ClickhouseSinkArgs{
				Host:         "host",
				Port:         "port",
				DB:           "db",
				User:         "user",
				Password:     "",
				Table:        "table",
				Secure:       false,
				MaxBatchSize: 100,
				MaxDelayTime: 5 * time.Second,
				ColMap: []ClickhouseColumnMappingArgs{{
					Source:     "stream_a",
					Field:      "order_id",
					ColumnName: "OrderID",
					ColumnType: "string",
				}},
			},
			expectedErr:          PipelineConfigError{msg: "clickhouse password cannot be empty"},
			expectedComponentNil: true,
		},
		{
			desc: "empty table",
			args: ClickhouseSinkArgs{
				Host:         "host",
				Port:         "port",
				DB:           "db",
				User:         "user",
				Password:     "password",
				Table:        "  ",
				Secure:       false,
				MaxBatchSize: 100,
				MaxDelayTime: 5 * time.Second,
				ColMap: []ClickhouseColumnMappingArgs{{
					Source:     "stream_a",
					Field:      "order_id",
					ColumnName: "OrderID",
					ColumnType: "string",
				}},
			},
			expectedErr:          PipelineConfigError{msg: "clickhouse table cannot be empty"},
			expectedComponentNil: true,
		},
		{
			desc: "no maxBatchSize",
			args: ClickhouseSinkArgs{
				Host:         "host",
				Port:         "port",
				DB:           "db",
				User:         "user",
				Password:     "password",
				Table:        "table",
				Secure:       false,
				MaxBatchSize: 0,
				MaxDelayTime: 5 * time.Second,
				ColMap: []ClickhouseColumnMappingArgs{{
					Source:     "stream_a",
					Field:      "order_id",
					ColumnName: "OrderID",
					ColumnType: "string",
				}},
			},
			expectedErr:          PipelineConfigError{msg: "clickhouse max_batch_size must be greater than 0"},
			expectedComponentNil: true,
		},
		{
			desc: "unsupported column type",
			args: ClickhouseSinkArgs{
				Host:         "host",
				Port:         "port",
				DB:           "db",
				User:         "user",
				Password:     "password",
				Table:        "table",
				Secure:       false,
				MaxBatchSize: 100,
				MaxDelayTime: 5 * time.Second,
				ColMap: []ClickhouseColumnMappingArgs{{
					Source:     "stream_a",
					Field:      "order_id",
					ColumnName: "OrderID",
					ColumnType: "bson",
				}},
			},
			expectedErr:          PipelineConfigError{msg: "unsupported clickhouse column data type: bson"},
			expectedComponentNil: true,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.desc, func(t *testing.T) {
			component, err := NewClickhouseSinkComponent(tc.args)

			if tc.expectedErr != nil {
				require.EqualError(t, err, tc.expectedErr.Error())
			}
			require.Equal(t, tc.expectedComponentNil, component == nil)
		})
	}
}
