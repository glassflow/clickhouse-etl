@sink
Feature: Sink retry classification — retryable vs permanent errors

    Background: Run setup before each scenario
        Given a running NATS stream "test_stream" with subject "test_subject"
        And a ClickHouse client with db "default" and table "events_retry"
        And I set up metrics collection

    @retryable
    Scenario: Transient CH failure recovers without DLQ
        Given the ClickHouse table "default.events_retry" already exists with schema
            | column_name | data_type | constraint |
            | event_id    | String    |            |
            | name        | String    |            |
        And a stream consumer with config
            """json
            {
                "stream": "test_stream",
                "subject": "test_subject",
                "consumer": "test_consumer_retry",
                "ack_wait": "30s"
            }
            """
        And a pipeline with configuration
            """json
            {
                "pipeline_id": "test-pipeline-retry-1",
                "source_type": "kafka",
                "name": "test-pipeline-retry-1",
                "source": {
                    "type": "kafka",
                    "kafka_topics": []
                },
                "sink": {
                    "type": "clickhouse",
                    "clickhouse_connection_params": {
                        "database": "default",
                        "table": "events_retry"
                    },
                    "stream_id": "test_stream",
                    "source_id": "topic-1",
                    "batch": {
                        "max_batch_size": 5
                    },
                    "config": [
                        {
                            "source_field": "event_id",
                            "source_type": "string",
                            "destination_field": "event_id",
                            "destination_type": "String"
                        },
                        {
                            "source_field": "name",
                            "source_type": "string",
                            "destination_field": "name",
                            "destination_type": "String"
                        }
                    ]
                },
                "schema_versions": {
                    "topic-1": {
                        "source_id": "topic-1",
                        "version_id": "1",
                        "data_type": "json",
                        "fields": [
                            {"name": "event_id", "type": "string"},
                            {"name": "name", "type": "string"}
                        ]
                    }
                }
            }
            """
        # Start sink first so it can connect, then disrupt CH writes so batch sends fail with
        # QUOTA_EXPIRED (retryable). The non-blocking step returns immediately; the goroutine
        # restores writes after 15s. Events are published into the disrupted window so the
        # first batch attempt always fails and triggers NACKs.
        When I run ClickHouse sink
        And I disrupt ClickHouse writes and schedule restore after "15s"
        And I publish 10 events to the stream
            | event_id | name   | NATS-Schema-Version-Id |
            | id-01    | Alice  | 1                      |
            | id-02    | Bob    | 1                      |
            | id-03    | Carol  | 1                      |
            | id-04    | Dave   | 1                      |
            | id-05    | Eve    | 1                      |
            | id-06    | Frank  | 1                      |
            | id-07    | Grace  | 1                      |
            | id-08    | Hank   | 1                      |
            | id-09    | Iris   | 1                      |
            | id-10    | Jack   | 1                      |
        And Wait until ClickHouse table "default.events_retry" has 10 rows with timeout "2m"
        And I gracefully stop ClickHouse sink
        Then the ClickHouse table "default.events_retry" should contain 10 rows
        And dlq should contain 0 events
        And the sink nack metric should be greater than 0
        And the sink retryable error metric should be greater than 0

    @retryable
    Scenario: Permanent error sends all events to DLQ with zero NACKs
        And a stream consumer with config
            """json
            {
                "stream": "test_stream",
                "subject": "test_subject",
                "consumer": "test_consumer_perm",
                "ack_wait": "30s"
            }
            """
        And a pipeline with configuration
            """json
            {
                "pipeline_id": "test-pipeline-retry-2",
                "source_type": "kafka",
                "name": "test-pipeline-retry-2",
                "source": {
                    "type": "kafka",
                    "kafka_topics": []
                },
                "sink": {
                    "type": "clickhouse",
                    "clickhouse_connection_params": {
                        "database": "default",
                        "table": "does_not_exist_retry"
                    },
                    "stream_id": "test_stream",
                    "source_id": "topic-1",
                    "batch": {
                        "max_batch_size": 4
                    },
                    "config": [
                        {
                            "source_field": "event_id",
                            "source_type": "string",
                            "destination_field": "event_id",
                            "destination_type": "String"
                        },
                        {
                            "source_field": "name",
                            "source_type": "string",
                            "destination_field": "name",
                            "destination_type": "String"
                        }
                    ]
                },
                "schema_versions": {
                    "topic-1": {
                        "source_id": "topic-1",
                        "version_id": "1",
                        "data_type": "json",
                        "fields": [
                            {"name": "event_id", "type": "string"},
                            {"name": "name", "type": "string"}
                        ]
                    }
                }
            }
            """
        When I publish 4 events to the stream
            | event_id | name  | NATS-Schema-Version-Id |
            | id-01    | Alice | 1                      |
            | id-02    | Bob   | 1                      |
            | id-03    | Carol | 1                      |
            | id-04    | Dave  | 1                      |
        And I run ClickHouse sink
        And Wait until all messages are processed
        And I gracefully stop ClickHouse sink
        Then dlq should contain 4 events
        And the sink nack metric should be 0

    @retryable
    Scenario: Persistent retryable failure leaves orphans in stream after MaxDeliver
        Given the ClickHouse table "default.events_retry" already exists with schema
            | column_name | data_type | constraint |
            | event_id    | String    |            |
            | name        | String    |            |
        And a stream consumer with config
            """json
            {
                "stream": "test_stream",
                "subject": "test_subject",
                "consumer": "test_consumer_orphan",
                "ack_wait": "3s",
                "max_deliver": 3
            }
            """
        And a pipeline with configuration
            """json
            {
                "pipeline_id": "test-pipeline-retry-3",
                "source_type": "kafka",
                "name": "test-pipeline-retry-3",
                "source": {
                    "type": "kafka",
                    "kafka_topics": []
                },
                "sink": {
                    "type": "clickhouse",
                    "clickhouse_connection_params": {
                        "database": "default",
                        "table": "events_retry"
                    },
                    "stream_id": "test_stream",
                    "source_id": "topic-1",
                    "batch": {
                        "max_batch_size": 5
                    },
                    "config": [
                        {
                            "source_field": "event_id",
                            "source_type": "string",
                            "destination_field": "event_id",
                            "destination_type": "String"
                        },
                        {
                            "source_field": "name",
                            "source_type": "string",
                            "destination_field": "name",
                            "destination_type": "String"
                        }
                    ]
                },
                "schema_versions": {
                    "topic-1": {
                        "source_id": "topic-1",
                        "version_id": "1",
                        "data_type": "json",
                        "fields": [
                            {"name": "event_id", "type": "string"},
                            {"name": "name", "type": "string"}
                        ]
                    }
                }
            }
            """
        # Start sink while CH is up, then disrupt CH writes permanently so all batches fail.
        # MaxDeliver=3 + AckWait=3s means NATS stops redelivering after ~9s per batch.
        # NumPending+NumAckPending will drop to 0 once NATS exhausts all deliveries.
        When I run ClickHouse sink
        And I disrupt ClickHouse writes
        And I publish 5 events to the stream
            | event_id | name  | NATS-Schema-Version-Id |
            | id-01    | Alice | 1                      |
            | id-02    | Bob   | 1                      |
            | id-03    | Carol | 1                      |
            | id-04    | Dave  | 1                      |
            | id-05    | Eve   | 1                      |
        And Wait until all messages are processed with timeout "90s"
        And I restore ClickHouse writes
        And I gracefully stop ClickHouse sink
        Then the ClickHouse table "default.events_retry" should contain 0 rows
        And dlq should contain 0 events
        And the NATS stream should still contain 5 messages

    @retryable
    Scenario: Mixed batch — retryable and permanent errors do not cross-contaminate
        Given the ClickHouse table "default.events_retry" already exists with schema
            | column_name | data_type | constraint |
            | event_id    | String    |            |
            | name        | String    |            |
        And a stream consumer with config
            """json
            {
                "stream": "test_stream",
                "subject": "test_subject",
                "consumer": "test_consumer_mix_a",
                "ack_wait": "30s"
            }
            """
        And a pipeline with configuration
            """json
            {
                "pipeline_id": "test-pipeline-retry-4a",
                "source_type": "kafka",
                "name": "test-pipeline-retry-4a",
                "source": {
                    "type": "kafka",
                    "kafka_topics": []
                },
                "sink": {
                    "type": "clickhouse",
                    "clickhouse_connection_params": {
                        "database": "default",
                        "table": "events_retry"
                    },
                    "stream_id": "test_stream",
                    "source_id": "topic-1",
                    "batch": {
                        "max_batch_size": 4
                    },
                    "config": [
                        {
                            "source_field": "event_id",
                            "source_type": "string",
                            "destination_field": "event_id",
                            "destination_type": "String"
                        },
                        {
                            "source_field": "name",
                            "source_type": "string",
                            "destination_field": "name",
                            "destination_type": "String"
                        }
                    ]
                },
                "schema_versions": {
                    "topic-1": {
                        "source_id": "topic-1",
                        "version_id": "1",
                        "data_type": "json",
                        "fields": [
                            {"name": "event_id", "type": "string"},
                            {"name": "name", "type": "string"}
                        ]
                    }
                }
            }
            """
        And a second running NATS stream "test_stream_b" with subject "test_subject_b"
        And a second stream consumer "test_consumer_mix_b"
        And a second pipeline with configuration
            """json
            {
                "pipeline_id": "test-pipeline-retry-4b",
                "source_type": "kafka",
                "name": "test-pipeline-retry-4b",
                "source": {
                    "type": "kafka",
                    "kafka_topics": []
                },
                "sink": {
                    "type": "clickhouse",
                    "clickhouse_connection_params": {
                        "database": "default",
                        "table": "does_not_exist_retry_b"
                    },
                    "stream_id": "test_stream_b",
                    "source_id": "topic-1",
                    "batch": {
                        "max_batch_size": 4
                    },
                    "config": [
                        {
                            "source_field": "event_id",
                            "source_type": "string",
                            "destination_field": "event_id",
                            "destination_type": "String"
                        },
                        {
                            "source_field": "name",
                            "source_type": "string",
                            "destination_field": "name",
                            "destination_type": "String"
                        }
                    ]
                },
                "schema_versions": {
                    "topic-1": {
                        "source_id": "topic-1",
                        "version_id": "1",
                        "data_type": "json",
                        "fields": [
                            {"name": "event_id", "type": "string"},
                            {"name": "name", "type": "string"}
                        ]
                    }
                }
            }
            """
        # Both sinks start while CH is up. Sink A will experience a transient write disruption;
        # Sink B points at a non-existent table and gets a permanent error regardless.
        When I run ClickHouse sink
        And I run second ClickHouse sink
        And I disrupt ClickHouse writes and schedule restore after "15s"
        And I publish 4 events to the stream
            | event_id | name  | NATS-Schema-Version-Id |
            | id-01    | Alice | 1                      |
            | id-02    | Bob   | 1                      |
            | id-03    | Carol | 1                      |
            | id-04    | Dave  | 1                      |
        And I publish 4 events to the second stream
            | event_id | name  | NATS-Schema-Version-Id |
            | id-05    | Eve   | 1                      |
            | id-06    | Frank | 1                      |
            | id-07    | Grace | 1                      |
            | id-08    | Hank  | 1                      |
        And Wait until all messages on second sink are processed
        And Wait until all messages are processed with timeout "2m"
        And I gracefully stop ClickHouse sink
        And I gracefully stop second ClickHouse sink
        Then the ClickHouse table "default.events_retry" should contain 4 rows
        And dlq should contain 0 events
        And second dlq should contain 4 events
        And the sink nack metric should be greater than 0
