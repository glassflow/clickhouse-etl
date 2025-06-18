package models

import (
	"fmt"
	"strings"
	"time"
)

type ClickhouseSinkComponent struct {
	Host     string
	Port     string
	Database string
	Username string
	Password string
	Secure   bool
	Table    string
	Mapping  []clickhouseColumnMapping

	MaxBatchSize int
	MaxDelayTime time.Duration

	inputs  []Component
	outputs []Component
}

func (c *ClickhouseSinkComponent) SetInputs(comps []Component) {
	c.inputs = comps
}

func (c *ClickhouseSinkComponent) SetOutputs(comps []Component) {
	c.outputs = comps
}

func (c *ClickhouseSinkComponent) GetInputs() []Component {
	return c.inputs
}

func (c *ClickhouseSinkComponent) GetOutputs() []Component {
	return c.outputs
}

func (c *ClickhouseSinkComponent) ID() string {
	return fmt.Sprintf("clickhouse-sink-%s-%s", c.Database, c.Table)
}

const MinStreamsSupportedWithoutJoin = 1

func (c *ClickhouseSinkComponent) Validate() error {
	if len(c.inputs) > MinStreamsSupportedWithoutJoin {
		return fmt.Errorf("clickhouse sink only supports single source")
	}
	return nil
}

type ClickhouseSinkArgs struct {
	Host         string
	Port         string
	DB           string
	User         string
	Password     string
	Table        string
	Secure       bool
	MaxBatchSize int
	MaxDelayTime time.Duration
	ColMap       []ClickhouseColumnMappingArgs
}

func NewClickhouseSinkComponent(args ClickhouseSinkArgs) (*ClickhouseSinkComponent, error) {
	if len(strings.TrimSpace(args.Host)) == 0 {
		return nil, PipelineConfigError{msg: "clickhouse host cannot be empty"}
	}

	if len(strings.TrimSpace(args.Port)) == 0 {
		return nil, PipelineConfigError{msg: "clickhouse port cannot be empty"}
	}

	if len(strings.TrimSpace(args.DB)) == 0 {
		return nil, PipelineConfigError{msg: "clickhouse database cannot be empty"}
	}

	if len(strings.TrimSpace(args.User)) == 0 {
		return nil, PipelineConfigError{msg: "clickhouse user cannot be empty"}
	}

	if len(args.Password) == 0 {
		return nil, PipelineConfigError{msg: "clickhouse password cannot be empty"}
	}

	if len(strings.TrimSpace(args.Table)) == 0 {
		return nil, PipelineConfigError{msg: "clickhouse table cannot be empty"}
	}

	if args.MaxBatchSize == 0 {
		return nil, PipelineConfigError{msg: "clickhouse max_batch_size must be greater than 0"}
	}

	colMap, err := NewClickhouseColumnMapping(args.ColMap)
	if err != nil {
		return nil, PipelineConfigError{msg: err.Error()}
	}

	//nolint: exhaustruct // don't set private fields
	return &ClickhouseSinkComponent{
		Host:         args.Host,
		Port:         args.Port,
		Database:     args.DB,
		Username:     args.User,
		Password:     args.Password,
		Secure:       args.Secure,
		Table:        args.Table,
		Mapping:      colMap,
		MaxBatchSize: args.MaxBatchSize,
		MaxDelayTime: args.MaxDelayTime,
	}, nil
}

type clickhouseColumnMapping struct {
	Source     string
	FieldName  string
	ColumnName string
	ColumnType clickhouseDataType
}

type clickhouseDataType string

func (c clickhouseDataType) String() string {
	return string(c)
}

const (
	CH_Int8        clickhouseDataType = "int8"
	CH_Int16       clickhouseDataType = "int16"
	CH_Int32       clickhouseDataType = "int32"
	CH_Int64       clickhouseDataType = "int64"
	CH_Float32     clickhouseDataType = "float32"
	CH_Float64     clickhouseDataType = "float64"
	CH_String      clickhouseDataType = "string"
	CH_FixedString clickhouseDataType = "fixedstring"
	CH_Datetime    clickhouseDataType = "datetime"
	CH_Datetime64  clickhouseDataType = "datetime64"
	CH_Bool        clickhouseDataType = "bool"
	CH_UUID        clickhouseDataType = "uuid"
	CH_Enum8       clickhouseDataType = "enum8"
	CH_Enum16      clickhouseDataType = "enum16"
)

func newClickhouseDataType(s string) (zero clickhouseDataType, _ error) {
	switch strings.ToLower(s) {
	case CH_Int8.String():
		return CH_Int8, nil
	case CH_Int16.String():
		return CH_Int16, nil
	case CH_Int32.String():
		return CH_Int32, nil
	case CH_Int64.String():
		return CH_Int64, nil
	case CH_Float32.String():
		return CH_Float32, nil
	case CH_Float64.String():
		return CH_Float64, nil
	case CH_String.String():
		return CH_String, nil
	case CH_FixedString.String():
		return CH_FixedString, nil
	case CH_Datetime.String():
		return CH_Datetime, nil
	case CH_Datetime64.String():
		return CH_Datetime64, nil
	case CH_Bool.String():
		return CH_Bool, nil
	case CH_UUID.String():
		return CH_UUID, nil
	case CH_Enum8.String():
		return CH_Enum8, nil
	case CH_Enum16.String():
		return CH_Enum16, nil
	default:
		return zero, fmt.Errorf("unsupported clickhouse datatype")
	}
}

type ClickhouseColumnMappingArgs struct {
	Source     string
	Field      string
	ColumnName string
	ColumnType string
}

func NewClickhouseColumnMapping(args []ClickhouseColumnMappingArgs) ([]clickhouseColumnMapping, error) {
	mappings := make([]clickhouseColumnMapping, len(args))

	for i, arg := range args {
		if len(strings.TrimSpace(arg.Source)) == 0 {
			return nil, fmt.Errorf("clickhouse column source cannot be empty")
		}

		if len(strings.TrimSpace(arg.Field)) == 0 {
			return nil, fmt.Errorf("clickhouse column field cannot be empty")
		}

		if len(strings.TrimSpace(arg.ColumnName)) == 0 {
			return nil, fmt.Errorf("clickhouse column name cannot be empty")
		}

		// TODO: add validations for supported data types for column types
		if len(strings.TrimSpace(arg.ColumnType)) == 0 {
			return nil, fmt.Errorf("clickhouse column type cannot be empty")
		}

		colType, err := newClickhouseDataType(arg.ColumnType)
		if err != nil {
			return nil, fmt.Errorf("unsupported clickhouse column data type: %s", arg.ColumnType)
		}

		mappings[i] = clickhouseColumnMapping{
			Source:     arg.Source,
			FieldName:  arg.Field,
			ColumnName: arg.ColumnName,
			ColumnType: colType,
		}
	}

	return mappings, nil
}
