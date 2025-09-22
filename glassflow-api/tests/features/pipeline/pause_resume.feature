Feature: Pipeline Pause and Resume
  In order to manage pipeline lifecycle
  As a pipeline operator
  I want to be able to pause and resume pipelines

  Background:
    And the ClickHouse table "test_table" on database "default" already exists with schema
      | column_name | data_type |
      | id          | String    |
      | name        | String    |

  Scenario: Pause and resume a simple pipeline
    Given a glassflow pipeline with next configuration:
      """json
      {
        "pipeline_id": "pause-resume-test",
        "mapper": {
          "type": "jsonToClickhouse",
          "streams": {
            "test_topic": {
              "fields": [
                {
                  "field_name": "id",
                  "field_type": "string"
                },
                {
                  "field_name": "name",
                  "field_type": "string"
                }
              ]
            }
          },
          "sink_mapping": [
            {
              "stream_name": "test_topic",
              "field_name": "id",
              "column_name": "id",
              "column_type": "String"
            },
            {
              "stream_name": "test_topic",
              "field_name": "name",
              "column_name": "name",
              "column_type": "String"
            }
          ]
        },
        "ingestor": {
          "type": "kafka",
          "kafka_connection_params": {
            "brokers": [],
            "skip_auth": true,
            "protocol": "SASL_PLAINTEXT",
            "mechanism": "",
            "username": "",
            "password": "",
            "root_ca": ""
          },
          "kafka_topics": [
            {
              "name": "test_topic",
              "consumer_group_initial_offset": "earliest",
              "consumer_group_name": "glassflow-consumer-group-pause-resume-test",
              "deduplication": {
                "enabled": false,
                "id_field": "",
                "id_field_type": "",
                "time_window": "0s"
              },
              "output_stream_id": "gf-pause-test-test_topic",
              "output_stream_subject": "gf-pause-test-test_topic.input"
            }
          ]
        },
        "join": {
          "enabled": false
        },
        "sink": {
          "type": "clickhouse",
          "batch": {
            "max_batch_size": 1000,
            "max_delay_time": "1s"
          },
          "clickhouse_connection_params": {
            "database": "default",
            "secure": false,
            "table": "test_table"
          },
          "stream_id": "gf-pause-test-test_topic",
          "nats_consumer_name":"gf-nats-si-b7cffde7"
        }
      }
      """
    When I pause the glassflow pipeline
    And I wait for "2s" to let pause operation complete
    Then the pipeline status should be "Paused"
    When I resume the glassflow pipeline
    Then the pipeline status should be "Running"
    And I shutdown the glassflow pipeline after "2s"

  Scenario: Pause pipeline with delay and verify no data loss
    Given a Kafka topic "test_topic" with 1 partition
    And a glassflow pipeline with next configuration:
      """json
      {
        "pipeline_id": "pause-resume-delay-test",
        "mapper": {
          "type": "jsonToClickhouse",
          "streams": {
            "test_topic": {
              "fields": [
                {
                  "field_name": "id",
                  "field_type": "string"
                },
                {
                  "field_name": "name",
                  "field_type": "string"
                }
              ]
            }
          },
          "sink_mapping": [
            {
              "stream_name": "test_topic",
              "field_name": "id",
              "column_name": "id",
              "column_type": "String"
            },
            {
              "stream_name": "test_topic",
              "field_name": "name",
              "column_name": "name",
              "column_type": "String"
            }
          ]
        },
        "ingestor": {
          "type": "kafka",
          "kafka_connection_params": {
            "brokers": [],
            "skip_auth": true,
            "protocol": "SASL_PLAINTEXT",
            "mechanism": "",
            "username": "",
            "password": "",
            "root_ca": ""
          },
          "kafka_topics": [
            {
              "name": "test_topic",
              "consumer_group_initial_offset": "earliest",
              "consumer_group_name": "glassflow-consumer-group-pause-resume-delay-test",
              "deduplication": {
                "enabled": false,
                "id_field": "",
                "id_field_type": "",
                "time_window": "0s"
              },
              "output_stream_id": "gf-delay-test-test_topic",
              "output_stream_subject": "gf-delay-test-test_topic.input"
            }
          ]
        },
        "join": {
          "enabled": false
        },
        "sink": {
          "type": "clickhouse",
          "batch": {
            "max_batch_size": 1000,
            "max_delay_time": "1s"
          },
          "clickhouse_connection_params": {
            "database": "default",
            "secure": false,
            "table": "test_table"
          },
          "stream_id": "gf-delay-test-test_topic",
          "nats_consumer_name":"gf-nats-si-f62ac10c"
        }
      }
      """
    And I write these events to Kafka topic "test_topic":
      | key | value                        |
      | 1   | {"id": "123", "name": "John Doe"}    |
      | 2   | {"id": "456", "name": "Jane Smith"}  |
    And I wait for "2s"
    When I pause the glassflow pipeline after "1s"
    And I wait for "2s" to let pause operation complete
    Then the pipeline status should be "Paused"
    And I write these events to Kafka topic "test_topic":
      | key | value                           |
      | 3   | {"id": "789", "name": "Bob Johnson"} |
    When I resume the glassflow pipeline after "1s"
    Then the pipeline status should be "Running"
    And I wait for "3s"
    And I shutdown the glassflow pipeline after "1s"
    Then the ClickHouse table "default.test_table" should contain 3 rows

  Scenario: Pause and resume pipeline with join functionality
    Given a ClickHouse table "users_joined" on database "default" with schema
      | column_name | data_type |
      | name        | String    |
      | email       | String    |
    And a Kafka topic "users_topic" with 1 partition
    And a Kafka topic "emails_topic" with 1 partition
    And a glassflow pipeline with next configuration:
      """json
      {
        "pipeline_id": "pause-resume-join-test",
        "mapper": {
          "type": "jsonToClickhouse",
          "streams": {
            "users_topic": {
              "fields": [
                {
                  "field_name": "user_id",
                  "field_type": "string"
                },
                {
                  "field_name": "name",
                  "field_type": "string"
                }
              ],
              "join_key_field": "user_id",
              "join_window": "1h",
              "join_orientation": "left"
            },
            "emails_topic": {
              "fields": [
                {
                  "field_name": "user_id",
                  "field_type": "string"
                },
                {
                  "field_name": "email",
                  "field_type": "string"
                }
              ],
              "join_key_field": "user_id",
              "join_window": "1h",
              "join_orientation": "right"
            }
          },
          "sink_mapping": [
            {
              "stream_name": "users_topic",
              "field_name": "name",
              "column_name": "name",
              "column_type": "String"
            },
            {
              "stream_name": "emails_topic",
              "field_name": "email",
              "column_name": "email",
              "column_type": "String"
            }
          ]
        },
        "ingestor": {
          "type": "kafka",
          "kafka_connection_params": {
            "brokers": [],
            "skip_auth": true,
            "protocol": "SASL_PLAINTEXT",
            "mechanism": "",
            "username": "",
            "password": "",
            "root_ca": ""
          },
          "kafka_topics": [
            {
              "name": "users_topic",
              "consumer_group_initial_offset": "earliest",
              "consumer_group_name": "glassflow-consumer-group-pause-resume-join-test",
              "deduplication": {
                "enabled": false,
                "id_field": "",
                "id_field_type": "",
                "time_window": "0s"
              },
              "output_stream_id": "gf-join-test-users_topic",
              "output_stream_subject": "gf-join-test-users_topic.input"
            },
            {
              "name": "emails_topic",
              "consumer_group_initial_offset": "earliest",
              "consumer_group_name": "glassflow-consumer-group-pause-resume-join-test",
              "deduplication": {
                "enabled": false,
                "id_field": "",
                "id_field_type": "",
                "time_window": "0s"
              },
              "output_stream_id": "gf-join-test-emails_topic",
              "output_stream_subject": "gf-join-test-emails_topic.input"
            }
          ]
        },
        "join": {
          "enabled": true,
          "type": "temporal",
          "sources": [
            {
              "source_id": "users_topic",
              "join_key": "user_id",
              "time_window": "1h",
              "orientation": "left",
              "stream_id": "gf-join-test-users_topic"
            },
            {
              "source_id": "emails_topic",
              "join_key": "user_id",
              "time_window": "1h",
              "orientation": "right",
              "stream_id": "gf-join-test-emails_topic"
            }
          ],
          "output_stream_id": "gf-join-test-joined",
          "nats_left_consumer_name": "gf-nats-jl-3a37a8c8",
          "nats_right_consumer_name": "gf-nats-jr-3a37a8c8"
        },
        "sink": {
          "type": "clickhouse",
          "batch": {
            "max_batch_size": 1000,
            "max_delay_time": "1s"
          },
          "clickhouse_connection_params": {
            "database": "default",
            "secure": false,
            "table": "users_joined"
          },
          "stream_id": "gf-join-test-joined",
          "nats_consumer_name":"gf-nats-si-3a37a8c8"
        }
      }
      """
    And I write these events to Kafka topic "users_topic":
      | key | value                        |
      | 1   | {"user_id": "123", "name": "John Doe"}    |
      | 2   | {"user_id": "456", "name": "Jane Smith"}  |
    And I write these events to Kafka topic "emails_topic":
      | key | value                                           |
      | 1   | {"user_id": "123", "email": "john@example.com"} |
      | 2   | {"user_id": "456", "email": "jane@example.com"} |
    And I wait for "3s"
    When I pause the glassflow pipeline
    And I wait for "2s" to let pause operation complete
    Then the pipeline status should be "Paused"
    And I write these events to Kafka topic "users_topic":
      | key | value                           |
      | 3   | {"user_id": "789", "name": "Bob Johnson"} |
    And I write these events to Kafka topic "emails_topic":
      | key | value                                           |
      | 3   | {"user_id": "789", "email": "bob@example.com"}  |
    When I resume the glassflow pipeline
    Then the pipeline status should be "Running"
    And I wait for "3s"
    And I shutdown the glassflow pipeline after "1s"
    Then the ClickHouse table "default.users_joined" should contain 3 rows
    And the ClickHouse table "default.users_joined" should contain:
      | name       | email              | COUNT |
      | John Doe   | john@example.com   | 1     |
      | Jane Smith | jane@example.com   | 1     |
      | Bob Johnson| bob@example.com    | 1     |