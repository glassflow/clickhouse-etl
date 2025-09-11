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
          "stream_id": "gf-pause-test-test_topic"
        }
      }
      """
    When I pause the glassflow pipeline
    Then the pipeline status should be "Paused"
    When I resume the glassflow pipeline
    Then the pipeline status should be "Running"
    And I shutdown the glassflow pipeline

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
          "stream_id": "gf-delay-test-test_topic"
        }
      }
      """
    And I produce messages to the Kafka topic "test_topic":
      | id  | name       |
      | 123 | John Doe   |
      | 456 | Jane Smith |
    And I wait for "2s"
    When I pause the glassflow pipeline after "1s"
    Then the pipeline status should be "Paused"
    And I produce messages to the Kafka topic "test_topic":
      | id  | name        |
      | 789 | Bob Johnson |
    When I resume the glassflow pipeline after "1s"
    Then the pipeline status should be "Running"
    And I wait for "3s"
    And I shutdown the glassflow pipeline after "1s"
    Then the ClickHouse table "default.test_table" should contain 3 rows