package api

import (
	"context"
	"crypto/tls"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"strings"
	"time"

	"github.com/ClickHouse/clickhouse-go/v2"
	"github.com/ClickHouse/clickhouse-go/v2/lib/driver"
	"github.com/IBM/sarama"

	"github.com/glassflow/clickhouse-etl/glassflow-api/internal/kafka"
)

// ClickHouse request/response types
type clickhouseConnectionRequest struct {
	Host                        string `json:"host"`
	HTTPPort                    string `json:"httpPort"`
	NativePort                  string `json:"nativePort"`
	Username                    string `json:"username"`
	Password                    string `json:"password"`
	UseSSL                      bool   `json:"useSSL"`
	SkipCertificateVerification bool   `json:"skipCertificateVerification"`
	Database                    string `json:"database,omitempty"`
	Table                       string `json:"table,omitempty"`
}

type clickhouseConnectionRequestv2 struct {
	Host                        string `json:"host"`
	HTTPPort                    string `json:"httpPort"`
	NativePort                  int    `json:"nativePort"`
	Username                    string `json:"username"`
	Password                    string `json:"password"`
	UseSSL                      bool   `json:"useSSL"`
	SkipCertificateVerification bool   `json:"skipCertificateVerification"`
	Database                    string `json:"database,omitempty"`
	Table                       string `json:"table,omitempty"`
}

type clickhouseDatabasesResponse struct {
	Success   bool     `json:"success"`
	Databases []string `json:"databases,omitempty"`
	Error     string   `json:"error,omitempty"`
}

type clickhouseTablesResponse struct {
	Success bool     `json:"success"`
	Tables  []string `json:"tables,omitempty"`
	Error   string   `json:"error,omitempty"`
}

type clickhouseSchemaResponse struct {
	Success bool                     `json:"success"`
	Columns []map[string]interface{} `json:"columns,omitempty"`
	Error   string                   `json:"error,omitempty"`
}

type clickhouseTestConnectionRequest struct {
	clickhouseConnectionRequest
	TestType string `json:"testType,omitempty"`
}

type clickhouseTestConnectionResponse struct {
	Success   bool                     `json:"success"`
	Message   string                   `json:"message,omitempty"`
	Databases []string                 `json:"databases,omitempty"`
	Tables    []string                 `json:"tables,omitempty"`
	Sample    []map[string]interface{} `json:"sample,omitempty"`
	Error     string                   `json:"error,omitempty"`
}

// Kafka request/response types
type kafkaConnectionRequest struct {
	Servers          string   `json:"servers"` // Frontend sends as comma-separated string
	Brokers          []string `json:"brokers"`
	SecurityProtocol string   `json:"securityProtocol,omitempty"`
	AuthMethod       string   `json:"authMethod,omitempty"`
	Username         string   `json:"username,omitempty"`
	Password         string   `json:"password,omitempty"`
	Certificate      string   `json:"certificate,omitempty"`
	// Add other auth fields as needed
}

// getBrokers returns the brokers as a slice, converting from Servers string if needed
func (r *kafkaConnectionRequest) getBrokers() []string {
	if len(r.Brokers) > 0 {
		return r.Brokers
	}
	if r.Servers != "" {
		// Split comma-separated string into slice and filter out empty strings
		parts := strings.Split(r.Servers, ",")
		brokers := make([]string, 0, len(parts))
		for _, broker := range parts {
			broker = strings.TrimSpace(broker)
			if broker != "" {
				brokers = append(brokers, broker)
			}
		}
		return brokers
	}
	return []string{}
}

type kafkaTestConnectionResponse struct {
	Success bool   `json:"success"`
	Error   string `json:"error,omitempty"`
}

type kafkaTopicsResponse struct {
	Success bool     `json:"success"`
	Topics  []string `json:"topics,omitempty"`
	Error   string   `json:"error,omitempty"`
}

type kafkaTopicDetails struct {
	Name           string `json:"name"`
	PartitionCount int    `json:"partitionCount"`
}

type kafkaTopicDetailsResponse struct {
	Success bool                `json:"success"`
	Topics  []kafkaTopicDetails `json:"topics,omitempty"`
	Error   string              `json:"error,omitempty"`
}

type kafkaEventsRequest struct {
	kafkaConnectionRequest
	Topic           string                 `json:"topic"`
	Format          string                 `json:"format,omitempty"`
	GetNext         bool                   `json:"getNext,omitempty"`
	CurrentOffset   *int64                 `json:"currentOffset,omitempty"`
	Position        string                 `json:"position,omitempty"`
	Direction       string                 `json:"direction,omitempty"`
	CurrentPosition map[string]interface{} `json:"currentPosition,omitempty"`
}

type kafkaEventsResponse struct {
	Success       bool                   `json:"success"`
	Event         map[string]interface{} `json:"event,omitempty"`
	Metadata      map[string]interface{} `json:"metadata,omitempty"`
	Offset        *int64                 `json:"offset,omitempty"`
	HasMoreEvents bool                   `json:"hasMoreEvents"`
	IsAtLatest    bool                   `json:"isAtLatest"`
	IsAtEarliest  bool                   `json:"isAtEarliest"`
	IsEmptyTopic  bool                   `json:"isEmptyTopic"`
	Error         string                 `json:"error,omitempty"`
}

// ClickHouse handlers

func (h *handler) clickhouseDatabases(w http.ResponseWriter, r *http.Request) {
	var req clickhouseConnectionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonError(w, http.StatusBadRequest, "Invalid request body", nil)
		return
	}

	conn, err := createClickHouseConnection(r.Context(), req)
	if err != nil {
		jsonResponse(w, http.StatusOK, clickhouseDatabasesResponse{
			Success: false,
			Error:   err.Error(),
		})
		return
	}
	defer conn.Close()

	rows, err := conn.Query(r.Context(), "SHOW DATABASES")
	if err != nil {
		jsonResponse(w, http.StatusOK, clickhouseDatabasesResponse{
			Success: false,
			Error:   fmt.Sprintf("Failed to fetch databases: %v", err),
		})
		return
	}
	defer rows.Close()

	var databases []string
	for rows.Next() {
		var database string
		if err := rows.Scan(&database); err != nil {
			jsonResponse(w, http.StatusOK, clickhouseDatabasesResponse{
				Success: false,
				Error:   fmt.Sprintf("Failed to scan database: %v", err),
			})
			return
		}
		databases = append(databases, database)
	}

	if err := rows.Err(); err != nil {
		jsonResponse(w, http.StatusOK, clickhouseDatabasesResponse{
			Success: false,
			Error:   fmt.Sprintf("Error iterating databases: %v", err),
		})
		return
	}

	jsonResponse(w, http.StatusOK, clickhouseDatabasesResponse{
		Success:   true,
		Databases: databases,
	})
}

func (h *handler) clickhouseTables(w http.ResponseWriter, r *http.Request) {
	fmt.Println("clickhouseTables")
	var req struct {
		clickhouseConnectionRequestv2
		Database string `json:"database"`
	}
	bodyBytes, err := io.ReadAll(r.Body)
	if err != nil {
		jsonError(w, http.StatusBadRequest, "Failed to read request body", nil)
		return
	}

	// Convert to string (if you need to log/inspect it)
	bodyString := string(bodyBytes)
	log.Println("Request body:", bodyString)

	// Decode from bytes
	if err := json.Unmarshal(bodyBytes, &req); err != nil {
		jsonError(w, http.StatusBadRequest, "Invalid request body", nil)
		return
	}

	if req.Database == "" {
		jsonResponse(w, http.StatusBadRequest, clickhouseTablesResponse{
			Success: false,
			Error:   "Database name is required",
		})
		return
	}

	conn, err := createClickHouseConnection(r.Context(), clickhouseConnectionRequest{
		Host:                        req.Host,
		HTTPPort:                    req.HTTPPort,
		NativePort:                  fmt.Sprintf("%d", req.NativePort),
		Username:                    req.Username,
		Password:                    req.Password,
		UseSSL:                      req.UseSSL,
		SkipCertificateVerification: req.SkipCertificateVerification,
		Database:                    req.Database,
		Table:                       req.Table,
	})
	if err != nil {
		jsonResponse(w, http.StatusOK, clickhouseTablesResponse{
			Success: false,
			Error:   err.Error(),
		})
		return
	}
	defer conn.Close()

	query := fmt.Sprintf("SHOW TABLES FROM `%s`", req.Database)
	rows, err := conn.Query(r.Context(), query)
	if err != nil {
		jsonResponse(w, http.StatusOK, clickhouseTablesResponse{
			Success: false,
			Error:   fmt.Sprintf("Failed to fetch tables for database '%s': %v", req.Database, err),
		})
		return
	}
	defer rows.Close()

	var tables []string
	for rows.Next() {
		var table string
		if err := rows.Scan(&table); err != nil {
			jsonResponse(w, http.StatusOK, clickhouseTablesResponse{
				Success: false,
				Error:   fmt.Sprintf("Failed to scan table: %v", err),
			})
			return
		}
		tables = append(tables, table)
	}

	if err := rows.Err(); err != nil {
		jsonResponse(w, http.StatusOK, clickhouseTablesResponse{
			Success: false,
			Error:   fmt.Sprintf("Error iterating tables: %v", err),
		})
		return
	}

	jsonResponse(w, http.StatusOK, clickhouseTablesResponse{
		Success: true,
		Tables:  tables,
	})
}

func (h *handler) clickhouseSchema(w http.ResponseWriter, r *http.Request) {
	var req struct {
		clickhouseConnectionRequest
		Database string `json:"database"`
		Table    string `json:"table"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonError(w, http.StatusBadRequest, "Invalid request body", nil)
		return
	}

	if req.Database == "" || req.Table == "" {
		jsonResponse(w, http.StatusBadRequest, clickhouseSchemaResponse{
			Success: false,
			Error:   "Database and table names are required",
		})
		return
	}

	conn, err := createClickHouseConnection(r.Context(), req.clickhouseConnectionRequest)
	if err != nil {
		jsonResponse(w, http.StatusOK, clickhouseSchemaResponse{
			Success: false,
			Error:   err.Error(),
		})
		return
	}
	defer conn.Close()

	// Build schema query based on database type
	var query string
	if req.Database == "information_schema" {
		query = fmt.Sprintf("SELECT column_name as name, data_type as type, is_nullable, column_default as default_expression FROM information_schema.columns WHERE table_schema = '%s' AND table_name = '%s'", req.Database, req.Table)
	} else if req.Database == "system" {
		query = fmt.Sprintf("SELECT name, type, default_kind, default_expression FROM system.columns WHERE database = '%s' AND table = '%s'", req.Database, req.Table)
	} else {
		query = fmt.Sprintf("DESCRIBE TABLE `%s`.`%s`", req.Database, req.Table)
	}

	rows, err := conn.Query(r.Context(), query)
	if err != nil {
		// Try fallback query without backticks for regular tables
		if req.Database != "information_schema" && req.Database != "system" {
			query = fmt.Sprintf("DESCRIBE TABLE %s.%s", req.Database, req.Table)
			rows, err = conn.Query(r.Context(), query)
			if err != nil {
				jsonResponse(w, http.StatusOK, clickhouseSchemaResponse{
					Success: false,
					Error:   fmt.Sprintf("Failed to fetch schema for table '%s' in database '%s': %v", req.Table, req.Database, err),
				})
				return
			}
		} else {
			jsonResponse(w, http.StatusOK, clickhouseSchemaResponse{
				Success: false,
				Error:   fmt.Sprintf("Failed to fetch schema for table '%s' in database '%s': %v", req.Table, req.Database, err),
			})
			return
		}
	}
	defer rows.Close()

	var columns []map[string]interface{}
	columnTypes := rows.ColumnTypes()

	for rows.Next() {
		// Create a slice to hold string pointers for all values
		values := make([]string, len(columnTypes))
		valuePtrs := make([]interface{}, len(columnTypes))
		for i := range values {
			valuePtrs[i] = &values[i]
		}

		if err := rows.Scan(valuePtrs...); err != nil {
			jsonResponse(w, http.StatusOK, clickhouseSchemaResponse{
				Success: false,
				Error:   fmt.Sprintf("Failed to scan column: %v", err),
			})
			return
		}

		// Build column map
		column := make(map[string]interface{})
		for i, ct := range columnTypes {
			column[ct.Name()] = values[i]
		}
		columns = append(columns, column)
	}

	if err := rows.Err(); err != nil {
		jsonResponse(w, http.StatusOK, clickhouseSchemaResponse{
			Success: false,
			Error:   fmt.Sprintf("Error iterating columns: %v", err),
		})
		return
	}

	jsonResponse(w, http.StatusOK, clickhouseSchemaResponse{
		Success: true,
		Columns: columns,
	})
}

func (h *handler) clickhouseTestConnection(w http.ResponseWriter, r *http.Request) {
	var req clickhouseTestConnectionRequest
	// Read body to bytes
	bodyBytes, err := io.ReadAll(r.Body)
	if err != nil {
		jsonError(w, http.StatusBadRequest, "Failed to read request body", nil)
		return
	}

	// Convert to string (if you need to log/inspect it)
	bodyString := string(bodyBytes)
	log.Println("Request body:", bodyString)

	// Decode from bytes
	if err := json.Unmarshal(bodyBytes, &req); err != nil {
		jsonError(w, http.StatusBadRequest, "Invalid request body", nil)
		return
	}

	testType := req.TestType
	if testType == "" {
		testType = "connection"
	}

	conn, err := createClickHouseConnection(r.Context(), req.clickhouseConnectionRequest)
	if err != nil {
		jsonResponse(w, http.StatusOK, clickhouseTestConnectionResponse{
			Success: false,
			Error:   err.Error(),
		})
		return
	}
	defer conn.Close()

	// Test connection
	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()

	if err := conn.Ping(ctx); err != nil {
		jsonResponse(w, http.StatusOK, clickhouseTestConnectionResponse{
			Success: false,
			Error:   fmt.Sprintf("Failed to connect to ClickHouse server: %v", err),
		})
		return
	}

	switch testType {
	case "connection":
		// Test connection and list databases
		rows, err := conn.Query(r.Context(), "SHOW DATABASES")
		if err != nil {
			jsonResponse(w, http.StatusOK, clickhouseTestConnectionResponse{
				Success: false,
				Error:   fmt.Sprintf("Failed to list databases: %v", err),
			})
			return
		}
		defer rows.Close()

		var databases []string
		for rows.Next() {
			var database string
			if err := rows.Scan(&database); err != nil {
				jsonResponse(w, http.StatusOK, clickhouseTestConnectionResponse{
					Success: false,
					Error:   fmt.Sprintf("Failed to scan database: %v", err),
				})
				return
			}
			databases = append(databases, database)
		}

		jsonResponse(w, http.StatusOK, clickhouseTestConnectionResponse{
			Success:   true,
			Message:   "Successfully connected to ClickHouse",
			Databases: databases,
		})

	case "database":
		if req.Database == "" {
			jsonResponse(w, http.StatusBadRequest, clickhouseTestConnectionResponse{
				Success: false,
				Error:   "Database name required for database test",
			})
			return
		}

		query := fmt.Sprintf("SHOW TABLES FROM `%s`", req.Database)
		rows, err := conn.Query(r.Context(), query)
		if err != nil {
			jsonResponse(w, http.StatusOK, clickhouseTestConnectionResponse{
				Success: false,
				Error:   fmt.Sprintf("Failed to list tables: %v", err),
			})
			return
		}
		defer rows.Close()

		var tables []string
		for rows.Next() {
			var table string
			if err := rows.Scan(&table); err != nil {
				jsonResponse(w, http.StatusOK, clickhouseTestConnectionResponse{
					Success: false,
					Error:   fmt.Sprintf("Failed to scan table: %v", err),
				})
				return
			}
			tables = append(tables, table)
		}

		jsonResponse(w, http.StatusOK, clickhouseTestConnectionResponse{
			Success: true,
			Message: fmt.Sprintf("Successfully connected to database '%s'", req.Database),
			Tables:  tables,
		})

	case "table":
		if req.Database == "" || req.Table == "" {
			jsonResponse(w, http.StatusBadRequest, clickhouseTestConnectionResponse{
				Success: false,
				Error:   "Database and table names required for table test",
			})
			return
		}

		query := fmt.Sprintf("SELECT * FROM `%s`.`%s` LIMIT 1", req.Database, req.Table)
		rows, err := conn.Query(r.Context(), query)
		if err != nil {
			jsonResponse(w, http.StatusOK, clickhouseTestConnectionResponse{
				Success: false,
				Error:   fmt.Sprintf("Failed to query table: %v", err),
			})
			return
		}
		defer rows.Close()

		var sample []map[string]interface{}
		columnTypes := rows.ColumnTypes()

		for rows.Next() {
			values := make([]interface{}, len(columnTypes))
			valuePtrs := make([]interface{}, len(columnTypes))
			for i := range values {
				valuePtrs[i] = &values[i]
			}

			if err := rows.Scan(valuePtrs...); err != nil {
				jsonResponse(w, http.StatusOK, clickhouseTestConnectionResponse{
					Success: false,
					Error:   fmt.Sprintf("Failed to scan row: %v", err),
				})
				return
			}

			row := make(map[string]interface{})
			for i, ct := range columnTypes {
				row[ct.Name()] = values[i]
			}
			sample = append(sample, row)
		}

		jsonResponse(w, http.StatusOK, clickhouseTestConnectionResponse{
			Success: true,
			Message: fmt.Sprintf("Successfully accessed table '%s' in database '%s'", req.Table, req.Database),
			Sample:  sample,
		})

	default:
		jsonResponse(w, http.StatusBadRequest, clickhouseTestConnectionResponse{
			Success: false,
			Error:   fmt.Sprintf("Invalid test type: %s", testType),
		})
	}
}

// Kafka handlers

func (h *handler) kafkaTestConnection(w http.ResponseWriter, r *http.Request) {
	var req kafkaConnectionRequest
	fmt.Println(r.Body)
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonError(w, http.StatusBadRequest, "Invalid request body", nil)
		return
	}

	config, err := createKafkaConfig(req)
	if err != nil {
		jsonResponse(w, http.StatusOK, kafkaTestConnectionResponse{
			Success: false,
			Error:   err.Error(),
		})
		return
	}

	brokers := req.getBrokers()
	client, err := sarama.NewClient(brokers, config)
	if err != nil {
		jsonResponse(w, http.StatusOK, kafkaTestConnectionResponse{
			Success: false,
			Error:   fmt.Sprintf("Failed to connect to Kafka cluster - Check your configuration or the Kafka cluster status: %v", err),
		})
		return
	}
	defer client.Close()

	// Test by listing topics
	_, err = client.Topics()
	if err != nil {
		jsonResponse(w, http.StatusOK, kafkaTestConnectionResponse{
			Success: false,
			Error:   fmt.Sprintf("Failed to list topics: %v", err),
		})
		return
	}

	jsonResponse(w, http.StatusOK, kafkaTestConnectionResponse{
		Success: true,
	})
}

func (h *handler) kafkaTopics(w http.ResponseWriter, r *http.Request) {
	var req kafkaConnectionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonError(w, http.StatusBadRequest, "Invalid request body", nil)
		return
	}

	config, err := createKafkaConfig(req)
	if err != nil {
		jsonResponse(w, http.StatusOK, kafkaTopicsResponse{
			Success: false,
			Error:   err.Error(),
		})
		return
	}

	brokers := req.getBrokers()
	client, err := sarama.NewClient(brokers, config)
	if err != nil {
		jsonResponse(w, http.StatusOK, kafkaTopicsResponse{
			Success: false,
			Error:   fmt.Sprintf("Failed to connect to Kafka cluster: %v", err),
		})
		return
	}
	defer client.Close()

	topics, err := client.Topics()
	if err != nil {
		jsonResponse(w, http.StatusOK, kafkaTopicsResponse{
			Success: false,
			Error:   fmt.Sprintf("Failed to fetch topics: %v", err),
		})
		return
	}

	jsonResponse(w, http.StatusOK, kafkaTopicsResponse{
		Success: true,
		Topics:  topics,
	})
}

func (h *handler) kafkaTopicDetails(w http.ResponseWriter, r *http.Request) {
	var req kafkaConnectionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonError(w, http.StatusBadRequest, "Invalid request body", nil)
		return
	}

	config, err := createKafkaConfig(req)
	if err != nil {
		jsonResponse(w, http.StatusOK, kafkaTopicDetailsResponse{
			Success: false,
			Error:   err.Error(),
		})
		return
	}

	brokers := req.getBrokers()
	client, err := sarama.NewClient(brokers, config)
	if err != nil {
		jsonResponse(w, http.StatusOK, kafkaTopicDetailsResponse{
			Success: false,
			Error:   fmt.Sprintf("Failed to connect to Kafka cluster: %v", err),
		})
		return
	}
	defer client.Close()

	topics, err := client.Topics()
	if err != nil {
		jsonResponse(w, http.StatusOK, kafkaTopicDetailsResponse{
			Success: false,
			Error:   fmt.Sprintf("Failed to fetch topics: %v", err),
		})
		return
	}

	var topicDetails []kafkaTopicDetails
	for _, topic := range topics {
		partitions, err := client.Partitions(topic)
		if err != nil {
			h.log.ErrorContext(r.Context(), "Failed to get partitions for topic", "topic", topic, "error", err)
			continue
		}

		topicDetails = append(topicDetails, kafkaTopicDetails{
			Name:           topic,
			PartitionCount: len(partitions),
		})
	}

	jsonResponse(w, http.StatusOK, kafkaTopicDetailsResponse{
		Success: true,
		Topics:  topicDetails,
	})
}

func (h *handler) kafkaEvents(w http.ResponseWriter, r *http.Request) {
	var req kafkaEventsRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonError(w, http.StatusBadRequest, "Invalid request body", nil)
		return
	}

	if req.Topic == "" {
		jsonResponse(w, http.StatusBadRequest, kafkaEventsResponse{
			Success:       false,
			Error:         "Missing required parameter: topic",
			HasMoreEvents: false,
			IsAtLatest:    false,
			IsAtEarliest:  false,
			IsEmptyTopic:  false,
		})
		return
	}

	config, err := createKafkaConfig(req.kafkaConnectionRequest)
	if err != nil {
		jsonResponse(w, http.StatusOK, kafkaEventsResponse{
			Success:       false,
			Error:         err.Error(),
			HasMoreEvents: false,
			IsAtLatest:    false,
			IsAtEarliest:  false,
			IsEmptyTopic:  false,
		})
		return
	}

	brokers := req.getBrokers()
	client, err := sarama.NewClient(brokers, config)
	if err != nil {
		jsonResponse(w, http.StatusOK, kafkaEventsResponse{
			Success:       false,
			Error:         fmt.Sprintf("Failed to connect to Kafka cluster: %v", err),
			HasMoreEvents: false,
			IsAtLatest:    false,
			IsAtEarliest:  false,
			IsEmptyTopic:  false,
		})
		return
	}
	defer client.Close()

	// Get partition information
	partitions, err := client.Partitions(req.Topic)
	if err != nil {
		jsonResponse(w, http.StatusOK, kafkaEventsResponse{
			Success:       false,
			Error:         fmt.Sprintf("Failed to get partitions for topic: %v", err),
			HasMoreEvents: false,
			IsAtLatest:    false,
			IsAtEarliest:  false,
			IsEmptyTopic:  false,
		})
		return
	}

	if len(partitions) == 0 {
		jsonResponse(w, http.StatusOK, kafkaEventsResponse{
			Success:       false,
			Error:         "Topic has no partitions",
			HasMoreEvents: false,
			IsAtLatest:    false,
			IsAtEarliest:  false,
			IsEmptyTopic:  true,
		})
		return
	}

	// Use first partition for simplicity (can be enhanced to support partition selection)
	targetPartition := partitions[0]

	// Get offset information
	newestOffset, err := client.GetOffset(req.Topic, targetPartition, sarama.OffsetNewest)
	if err != nil {
		jsonResponse(w, http.StatusOK, kafkaEventsResponse{
			Success:       false,
			Error:         fmt.Sprintf("Failed to get newest offset: %v", err),
			HasMoreEvents: false,
			IsAtLatest:    false,
			IsAtEarliest:  false,
			IsEmptyTopic:  false,
		})
		return
	}

	oldestOffset, err := client.GetOffset(req.Topic, targetPartition, sarama.OffsetOldest)
	if err != nil {
		jsonResponse(w, http.StatusOK, kafkaEventsResponse{
			Success:       false,
			Error:         fmt.Sprintf("Failed to get oldest offset: %v", err),
			HasMoreEvents: false,
			IsAtLatest:    false,
			IsAtEarliest:  false,
			IsEmptyTopic:  false,
		})
		return
	}

	// Check if topic is empty
	if newestOffset == oldestOffset {
		jsonResponse(w, http.StatusOK, kafkaEventsResponse{
			Success:       false,
			Error:         "No events found in this topic.",
			HasMoreEvents: false,
			IsAtLatest:    true,
			IsAtEarliest:  true,
			IsEmptyTopic:  true,
		})
		return
	}

	// Determine target offset based on position/direction
	var targetOffset int64
	switch req.Position {
	case "latest":
		// Last message is at newestOffset - 1
		targetOffset = newestOffset - 1
	case "earliest":
		targetOffset = oldestOffset
	default:
		if req.Direction == "previous" && req.CurrentOffset != nil {
			targetOffset = *req.CurrentOffset - 1
			if targetOffset < oldestOffset {
				jsonResponse(w, http.StatusOK, kafkaEventsResponse{
					Success:       false,
					Error:         "Beginning of topic reached. No previous events available.",
					HasMoreEvents: true,
					IsAtLatest:    false,
					IsAtEarliest:  true,
					IsEmptyTopic:  false,
				})
				return
			}
		} else if req.GetNext && req.CurrentOffset != nil {
			targetOffset = *req.CurrentOffset + 1
		} else {
			targetOffset = oldestOffset
		}
	}

	// Check if we're at the end
	if targetOffset >= newestOffset {
		jsonResponse(w, http.StatusOK, kafkaEventsResponse{
			Success:       false,
			Error:         "End of topic reached. No more events available.",
			HasMoreEvents: false,
			IsAtLatest:    true,
			IsAtEarliest:  false,
			IsEmptyTopic:  false,
		})
		return
	}

	// Create consumer to fetch the message
	consumer, err := sarama.NewConsumerFromClient(client)
	if err != nil {
		jsonResponse(w, http.StatusOK, kafkaEventsResponse{
			Success:       false,
			Error:         fmt.Sprintf("Failed to create consumer: %v", err),
			HasMoreEvents: false,
			IsAtLatest:    false,
			IsAtEarliest:  false,
			IsEmptyTopic:  false,
		})
		return
	}
	defer consumer.Close()

	partitionConsumer, err := consumer.ConsumePartition(req.Topic, targetPartition, targetOffset)
	if err != nil {
		jsonResponse(w, http.StatusOK, kafkaEventsResponse{
			Success:       false,
			Error:         fmt.Sprintf("Failed to consume partition: %v", err),
			HasMoreEvents: false,
			IsAtLatest:    false,
			IsAtEarliest:  false,
			IsEmptyTopic:  false,
		})
		return
	}
	defer partitionConsumer.Close()

	// Wait for message with timeout
	select {
	case msg := <-partitionConsumer.Messages():
		// Parse message value as JSON
		var parsedValue map[string]interface{}
		if req.Format == "JSON" || req.Format == "json" || req.Format == "" {
			if err := json.Unmarshal(msg.Value, &parsedValue); err != nil {
				// If parsing fails, return raw value
				parsedValue = map[string]interface{}{
					"_raw":   string(msg.Value),
					"_error": "Failed to parse as JSON",
					"_note":  "The message doesn't contain valid JSON",
				}
			}
		} else {
			parsedValue = map[string]interface{}{
				"_raw": string(msg.Value),
			}
		}

		// Add metadata
		metadata := map[string]interface{}{
			"topic":     msg.Topic,
			"partition": msg.Partition,
			"offset":    msg.Offset,
			"timestamp": msg.Timestamp.Format(time.RFC3339),
		}
		parsedValue["_metadata"] = metadata

		isAtLatest := req.Position == "latest" || msg.Offset >= newestOffset-1
		isAtEarliest := req.Position == "earliest" || msg.Offset == oldestOffset

		jsonResponse(w, http.StatusOK, kafkaEventsResponse{
			Success:       true,
			Event:         parsedValue,
			Metadata:      metadata,
			Offset:        &msg.Offset,
			HasMoreEvents: !isAtLatest,
			IsAtLatest:    isAtLatest,
			IsAtEarliest:  isAtEarliest,
			IsEmptyTopic:  false,
		})

	case err := <-partitionConsumer.Errors():
		jsonResponse(w, http.StatusOK, kafkaEventsResponse{
			Success:       false,
			Error:         fmt.Sprintf("Error consuming message: %v", err),
			HasMoreEvents: false,
			IsAtLatest:    false,
			IsAtEarliest:  false,
			IsEmptyTopic:  false,
		})

	case <-time.After(15 * time.Second):
		jsonResponse(w, http.StatusOK, kafkaEventsResponse{
			Success:       false,
			Error:         "Timeout waiting for message from topic",
			HasMoreEvents: false,
			IsAtLatest:    false,
			IsAtEarliest:  false,
			IsEmptyTopic:  false,
		})
	}
}

// Helper functions

func createClickHouseConnection(ctx context.Context, req clickhouseConnectionRequest) (driver.Conn, error) {
	fmt.Println(req)
	port := req.NativePort
	if port == "" {
		if req.UseSSL {
			port = "9440"
		} else {
			port = "9000"
		}
	}

	// Decode password from base64
	password := req.Password
	if decoded, err := base64.StdEncoding.DecodeString(req.Password); err == nil {
		password = string(decoded)
	}

	var tlsConfig *tls.Config
	if req.UseSSL {
		tlsConfig = &tls.Config{
			MinVersion: tls.VersionTLS12,
		}

		if req.SkipCertificateVerification {
			tlsConfig.InsecureSkipVerify = true
		}
	}

	conn, err := clickhouse.Open(&clickhouse.Options{
		Addr: []string{fmt.Sprintf("%s:%s", req.Host, port)},
		Auth: clickhouse.Auth{
			Database: req.Database,
			Username: req.Username,
			Password: password,
		},
		Protocol: clickhouse.Native,
		TLS:      tlsConfig,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to open clickhouse connection: %w", err)
	}

	// Test connection
	testCtx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	if err := conn.Ping(testCtx); err != nil {
		conn.Close()
		return nil, fmt.Errorf("ping failed: %w", err)
	}

	return conn, nil
}

func createKafkaConfig(req kafkaConnectionRequest) (*sarama.Config, error) {
	config := sarama.NewConfig()
	config.Version = sarama.V2_6_0_0
	config.Consumer.Return.Errors = true

	// Configure authentication based on authMethod
	if req.AuthMethod == "SASL/PLAIN" {
		config.Net.SASL.Enable = true
		config.Net.SASL.Mechanism = sarama.SASLTypePlaintext
		config.Net.SASL.User = req.Username
		config.Net.SASL.Password = req.Password
	} else if req.AuthMethod == "SASL/SCRAM-256" {
		config.Net.SASL.Enable = true
		config.Net.SASL.Mechanism = sarama.SASLTypeSCRAMSHA256
		config.Net.SASL.User = req.Username
		config.Net.SASL.Password = req.Password
		config.Net.SASL.SCRAMClientGeneratorFunc = func() sarama.SCRAMClient {
			return &kafka.XDGSCRAMClient{HashGeneratorFcn: kafka.SHA256}
		}
	} else if req.AuthMethod == "SASL/SCRAM-512" {
		config.Net.SASL.Enable = true
		config.Net.SASL.Mechanism = sarama.SASLTypeSCRAMSHA512
		config.Net.SASL.User = req.Username
		config.Net.SASL.Password = req.Password
		config.Net.SASL.SCRAMClientGeneratorFunc = func() sarama.SCRAMClient {
			return &kafka.XDGSCRAMClient{HashGeneratorFcn: kafka.SHA512}
		}
	}

	// Configure SSL/TLS
	if req.SecurityProtocol == "SASL_SSL" || req.SecurityProtocol == "SSL" {
		config.Net.TLS.Enable = true
		config.Net.TLS.Config = &tls.Config{
			InsecureSkipVerify: true, // Allow self-signed certificates
		}
	}

	return config, nil
}
