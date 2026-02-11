@sink
Feature: Clickhouse ETL sink
        Given a running NATS instance
        And a running ClickHouse instance

    Background: Run setup before each scenario
        Given a running NATS stream "test_stream" with subject "test_subject"
        And a ClickHouse client with db "default" and table "events_test"

    Scenario: Successfully import events from NATS to Clickhouse
        Given the ClickHouse table "default.events_test" already exists with schema
            | column_name | data_type |
            | event_id    | String    |
            | name        | String    |
            | email       | String    |
            | timestamp   | DateTime  |
            | action      | String    |
        And a stream consumer with config
            """json
            {
                "stream": "test_stream",
                "subject": "test_subject",
                "consumer": "test_consumer",
                "ack_wait": "1m"
            }
            """
        Given a pipeline with configuration
            """json
            {
                "pipeline_id": "test-pipline-1",
                "name": "test-pipline-1",
                "source": {
                    "type": "kafka",
                    "kafka_topics": []
                },
                "sink": {
                    "type": "clickhouse",
                    "stream_id": "test_stream",
                    "source_id": "topic-1",
                    "batch": {
                        "max_batch_size": 2
                    },
                    "config": [
                        {
                            "source_field": "event_id",
                            "source_type": "string",
                            "destination_field": "event_id",
                            "destination_type": "UUID"
                        },
                        {
                            "source_field": "name",
                            "source_type": "string",
                            "destination_field": "name",
                            "destination_type": "String"
                        },
                        {
                            "source_field": "email",
                            "source_type": "string",
                            "destination_field": "email",
                            "destination_type": "String"
                        },
                        {
                            "source_field": "timestamp",
                            "source_type": "string",
                            "destination_field": "timestamp",
                            "destination_type": "DateTime"
                        },
                        {
                            "source_field": "action",
                            "source_type": "string",
                            "destination_field": "action",
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
                            {
                                "name": "event_id",
                                "type": "string"
                            },
                            {
                                "name": "name",
                                "type": "string"
                            },
                            {
                                "name": "email",
                                "type": "string"
                            },
                            {
                                "name": "timestamp",
                                "type": "string"
                            },
                            {
                                "name": "action",
                                "type": "string"
                            }
                        ]
                    }
                }
            }
            """
        When I publish 2 events to the stream
            | event_id                             | name          | email              | timestamp                  | action | NATS-Schema-Version-Id |
            | 0a21ad20-8a70-4be2-8d29-533eb963d554 | Jessica Jones | msmith@example.com | 2025-02-21T07:45:48.823069 | login  | 1                      |
            | 72dea57a-ee36-4909-8b36-5be24b19804c | Jessica Jones | msmith@example.com | 2025-02-28T02:39:51.886367 | logout | 1                      |
        And I run ClickHouse sink
        And Wait until all messages are processed
        And I gracefully stop ClickHouse sink
        Then the ClickHouse table "default.events_test" should contain 2 rows

    Scenario: Events from NATS to Clickhouse synced after batch fulfillment
        Given the ClickHouse table "default.events_test" already exists with schema
            | column_name | data_type |
            | event_id    | String    |
            | name        | String    |
            | email       | String    |
            | timestamp   | DateTime  |
            | action      | String    |
        And a stream consumer with config
            """json
            {
                "stream": "test_stream",
                "subject": "test_subject",
                "consumer": "test_consumer",
                "ack_wait": "3s"
            }
            """
        And a pipeline with configuration
            """json
            {
                "pipeline_id": "test-pipeline-2",
                "name": "test-pipeline-2",
                "source": {
                    "type": "kafka",
                    "kafka_topics": []
                },
                "sink": {
                    "type": "clickhouse",
                    "stream_id": "test_stream",
                    "source_id": "topic-1",
                    "batch": {
                        "max_batch_size": 2,
                        "max_delay_time": "3s"
                    },
                    "config": [
                        {
                            "source_field": "event_id",
                            "source_type": "string",
                            "destination_field": "event_id",
                            "destination_type": "UUID"
                        },
                        {
                            "source_field": "name",
                            "source_type": "string",
                            "destination_field": "name",
                            "destination_type": "String"
                        },
                        {
                            "source_field": "email",
                            "source_type": "string",
                            "destination_field": "email",
                            "destination_type": "String"
                        },
                        {
                            "source_field": "timestamp",
                            "source_type": "string",
                            "destination_field": "timestamp",
                            "destination_type": "DateTime"
                        },
                        {
                            "source_field": "action",
                            "source_type": "string",
                            "destination_field": "action",
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
                            {
                                "name": "event_id",
                                "type": "string"
                            },
                            {
                                "name": "name",
                                "type": "string"
                            },
                            {
                                "name": "email",
                                "type": "string"
                            },
                            {
                                "name": "timestamp",
                                "type": "string"
                            },
                            {
                                "name": "action",
                                "type": "string"
                            }
                        ]
                    }
                }
            }
            """
        When I publish 1 events to the stream
            | event_id                             | name          | email              | timestamp                  | action | NATS-Schema-Version-Id |
            | 0a21ad20-8a70-4be2-8d29-533eb963d554 | Jessica Jones | msmith@example.com | 2025-02-21T07:45:48.823069 | login  | 1                      |
        And I run ClickHouse sink
        And I stop ClickHouse sink after "1s"
        Then the ClickHouse table "default.events_test" should contain 1 rows
        And I run ClickHouse sink
        When I publish 1 events to the stream
            | event_id                             | name          | email              | timestamp                  | action | NATS-Schema-Version-Id |
            | 72dea57a-ee36-4909-8b36-5be24b19804c | Jessica Jones | msmith@example.com | 2025-02-28T02:39:51.886367 | logout | 1                      |
        And Wait until all messages are processed
        And I gracefully stop ClickHouse sink
        Then the ClickHouse table "default.events_test" should contain 2 rows

    Scenario: Exports events after JOIN component
        Given the ClickHouse table "default.events_test" already exists with schema
            | column_name | data_type |
            | id          | String    |
            | name        | String    |
            | email       | String    |
        And a stream consumer with config
            """json
            {
                "stream": "test_stream",
                "subject": "test_subject",
                "consumer": "test_consumer",
                "ack_wait": "1m"
            }
            """
        And a pipeline with configuration
            """json
            {
                "pipeline_id": "test-pipeline-3",
                "name": "test-pipeline-3",
                "source": {
                    "type": "kafka",
                    "kafka_topics": []
                },
                "sink": {
                    "type": "clickhouse",
                    "stream_id": "test_stream",
                    "source_id": "topic-1",
                    "batch": {
                        "max_batch_size": 2
                    },
                    "config": [
                        {
                            "source_field": "left_stream.id",
                            "source_type": "string",
                            "destination_field": "id",
                            "destination_type": "String"
                        },
                        {
                            "source_field": "left_stream.name",
                            "source_type": "string",
                            "destination_field": "name",
                            "destination_type": "String"
                        },
                        {
                            "source_field": "right_stream.email",
                            "source_type": "string",
                            "destination_field": "email",
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
                            {
                                "name": "left_stream.id",
                                "type": "string"
                            },
                            {
                                "name": "left_stream.name",
                                "type": "string"
                            },
                            {
                                "name": "right_stream.email",
                                "type": "string"
                            }
                        ]
                    }
                }
            }
            """
        And I run ClickHouse sink
        When I publish 2 events to the stream
            | left_stream.id | left_stream.name | right_stream.email | NATS-Schema-Version-Id |
            | 1              | Alice            | alice@mailbox.com  | 1                      |
            | 2              | Bob              | bob@gmail.com      | 1                      |
        And Wait until all messages are processed
        And I gracefully stop ClickHouse sink
        Then the ClickHouse table "default.events_test" should contain 2 rows

    Scenario: Successfully import events from NATS to Clickhouse by max delay time
        Given the ClickHouse table "default.events_test" already exists with schema
            | column_name | data_type |
            | id          | String    |
            | name        | String    |
        And a stream consumer with config
            """json
            {
                "stream": "test_stream",
                "subject": "test_subject",
                "consumer": "test_consumer",
                "ack_wait": "6s"
            }
            """
        And a pipeline with configuration
            """json
            {
                "pipeline_id": "test-pipeline-4",
                "name": "test-pipeline-4",
                "source": {
                    "type": "kafka",
                    "kafka_topics": []
                },
                "sink": {
                    "type": "clickhouse",
                    "stream_id": "test_stream",
                    "source_id": "topic-1",
                    "batch": {
                        "max_batch_size": 100,
                        "max_delay_time": "3s"
                    },
                    "config": [
                        {
                            "source_field": "id",
                            "source_type": "string",
                            "destination_field": "id",
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
                            {
                                "name": "id",
                                "type": "string"
                            },
                            {
                                "name": "name",
                                "type": "string"
                            }
                        ]
                    }
                }
            }
            """
        When I publish 4 events to the stream
            | id | name    | NATS-Schema-Version-Id |
            | 1  | Alice   | 1                      |
            | 2  | Bob     | 1                      |
            | 3  | Charlie | 1                      |
            | 4  | David   | 1                      |
        And I run ClickHouse sink
        And I stop ClickHouse sink after "5s"
        Then the ClickHouse table "default.events_test" should contain 4 rows

    Scenario: Start and graceful sink stop for already existing events in stream
        Given the ClickHouse table "default.events_test" already exists with schema
            | column_name | data_type |
            | id          | String    |
            | name        | String    |
        And a pipeline with configuration
            """json
            {
                "pipeline_id": "test-pipeline-5",
                "name": "test-pipeline-5",
                "source": {
                    "type": "kafka",
                    "kafka_topics": []
                },
                "sink": {
                    "type": "clickhouse",
                    "stream_id": "test_stream",
                    "source_id": "topic-1",
                    "batch": {
                        "max_batch_size": 100,
                        "max_delay_time": "3s"
                    },
                    "config": [
                        {
                            "source_field": "id",
                            "source_type": "string",
                            "destination_field": "id",
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
                            {
                                "name": "id",
                                "type": "string"
                            },
                            {
                                "name": "name",
                                "type": "string"
                            }
                        ]
                    }
                }
            }
            """
        When I publish 7 events to the stream
            | id | name    | NATS-Schema-Version-Id |
            | 1  | Alice   | 1                      |
            | 2  | Bob     | 1                      |
            | 3  | Charlie | 1                      |
            | 4  | David   | 1                      |
            | 5  | Eve     | 1                      |
            | 6  | Frank   | 1                      |
            | 7  | Grace   | 1                      |
        And I run ClickHouse sink
        And I stop ClickHouse sink after "1s"
        Then the ClickHouse table "default.events_test" should contain 7 rows

    Scenario: Successfully import events from NATS to Clickhouse by max delay time #2
        Given the ClickHouse table "default.events_test" already exists with schema
            | column_name | data_type |
            | id          | String    |
            | name        | String    |
        And a stream consumer with config
            """json
            {
                "stream": "test_stream",
                "subject": "test_subject",
                "consumer": "test_consumer",
                "ack_wait": "5s"
            }
            """
        And a pipeline with configuration
            """json
            {
                "pipeline_id": "test-pipeline-6",
                "name": "test-pipeline-6",
                "source": {
                    "type": "kafka",
                    "kafka_topics": []
                },
                "sink": {
                    "type": "clickhouse",
                    "stream_id": "test_stream",
                    "source_id": "topic-1",
                    "batch": {
                        "max_batch_size": 5,
                        "max_delay_time": "6s"
                    },
                    "config": [
                        {
                            "source_field": "id",
                            "source_type": "string",
                            "destination_field": "id",
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
                            {
                                "name": "id",
                                "type": "string"
                            },
                            {
                                "name": "name",
                                "type": "string"
                            }
                        ]
                    }
                }
            }
            """
        When I publish 9 events to the stream
            | id | name    | NATS-Schema-Version-Id |
            | 1  | Alice   | 1                      |
            | 2  | Bob     | 1                      |
            | 3  | Charlie | 1                      |
            | 4  | David   | 1                      |
            | 5  | Eve     | 1                      |
            | 6  | Frank   | 1                      |
            | 7  | Grace   | 1                      |
            | 8  | Heidi   | 1                      |
            | 9  | Ivan    | 1                      |
        And I run ClickHouse sink
        And I stop ClickHouse sink after "10s"
        Then the ClickHouse table "default.events_test" should contain 9 rows

    Scenario: Successfully import events from NATS to Clickhouse by max delay time #3
        Given the ClickHouse table "default.events_test" already exists with schema
            | column_name | data_type |
            | id          | String    |
            | name        | String    |
        And a stream consumer with config
            """json
            {
                "stream": "test_stream",
                "subject": "test_subject",
                "consumer": "test_consumer",
                "ack_wait": "3s"
            }
            """
        And a pipeline with configuration
            """json
            {
                "pipeline_id": "test-pipeline-7",
                "name": "test-pipeline-7",
                "source": {
                    "type": "kafka",
                    "kafka_topics": []
                },
                "sink": {
                    "type": "clickhouse",
                    "stream_id": "test_stream",
                    "source_id": "topic-1",
                    "batch": {
                        "max_batch_size": 5,
                        "max_delay_time": "5s"
                    },
                    "config": [
                        {
                            "source_field": "id",
                            "source_type": "string",
                            "destination_field": "id",
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
                            {
                                "name": "id",
                                "type": "string"
                            },
                            {
                                "name": "name",
                                "type": "string"
                            }
                        ]
                    }
                }
            }
            """
        When I publish 4 events to the stream
            | id | name    | NATS-Schema-Version-Id |
            | 1  | Alice   | 1                      |
            | 2  | Bob     | 1                      |
            | 3  | Charlie | 1                      |
            | 4  | David   | 1                      |
        And I run ClickHouse sink
        And I stop ClickHouse sink after "6s"
        Then the ClickHouse table "default.events_test" should contain 4 rows

    Scenario: Import events with UUID
        Given the ClickHouse table "default.events_test" already exists with schema
            | column_name | data_type |
            | id          | UUID      |
            | name        | String    |
        And a stream consumer with config
            """json
            {
                "stream": "test_stream",
                "subject": "test_subject",
                "consumer": "test_consumer",
                "ack_wait": "3s"
            }
            """
        And a pipeline with configuration
            """json
            {
                "pipeline_id": "test-pipeline-8",
                "name": "test-pipeline-8",
                "source": {
                    "type": "kafka",
                    "kafka_topics": []
                },
                "sink": {
                    "type": "clickhouse",
                    "stream_id": "test_stream",
                    "source_id": "topic-1",
                    "batch": {
                        "max_batch_size": 2
                    },
                    "config": [
                        {
                            "source_field": "id",
                            "source_type": "string",
                            "destination_field": "id",
                            "destination_type": "UUID"
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
                            {
                                "name": "id",
                                "type": "string"
                            },
                            {
                                "name": "name",
                                "type": "string"
                            }
                        ]
                    }
                }
            }
            """
        When I publish 2 events to the stream
            | id                                   | name  | NATS-Schema-Version-Id |
            | 0a21ad20-8a70-4be2-8d29-533eb963d554 | Alice | 1                      |
            | 72dea57a-ee36-4909-8b36-5be24b19804c | Bob   | 1                      |
        And I run ClickHouse sink
        And Wait until all messages are processed
        And I gracefully stop ClickHouse sink
        Then the ClickHouse table "default.events_test" should contain 2 rows

    Scenario: Import events with float32
        Given the ClickHouse table "default.events_test" already exists with schema
            | column_name | data_type |
            | id          | Int32     |
            | amount      | Float32   |
        And a stream consumer with config
            """json
            {
                "stream": "test_stream",
                "subject": "test_subject",
                "consumer": "test_consumer",
                "ack_wait": "3s"
            }
            """
        And a pipeline with configuration
            """json
            {
                "pipeline_id": "test-pipeline-9",
                "name": "test-pipeline-9",
                "source": {
                    "type": "kafka",
                    "kafka_topics": []
                },
                "sink": {
                    "type": "clickhouse",
                    "stream_id": "test_stream",
                    "source_id": "topic-1",
                    "batch": {
                        "max_batch_size": 2
                    },
                    "config": [
                        {
                            "source_field": "id",
                            "source_type": "int32",
                            "destination_field": "id",
                            "destination_type": "Int32"
                        },
                        {
                            "source_field": "amount",
                            "source_type": "float32",
                            "destination_field": "amount",
                            "destination_type": "Float32"
                        }
                    ]
                },
                "schema_versions": {
                    "topic-1": {
                        "source_id": "topic-1",
                        "version_id": "1",
                        "data_type": "json",
                        "fields": [
                            {
                                "name": "id",
                                "type": "int32"
                            },
                            {
                                "name": "amount",
                                "type": "float32"
                            }
                        ]
                    }
                }
            }
            """
        When I publish 2 events to the stream
            | id      | amount  | NATS-Schema-Version-Id |
            | 150     | 3284.85 | 1                      |
            | 2067868 | 2.5     | 1                      |
        And I run ClickHouse sink
        And Wait until all messages are processed
        And I gracefully stop ClickHouse sink
        Then the ClickHouse table "default.events_test" should contain 2 rows

    Scenario: Import events with low cardinality string
        Given the ClickHouse table "default.events_test" already exists with schema
            | column_name | data_type              |
            | id          | Int32                  |
            | type        | LowCardinality(String) |
        And a stream consumer with config
            """json
            {
                "stream": "test_stream",
                "subject": "test_subject",
                "consumer": "test_consumer",
                "ack_wait": "3s"
            }
            """
        And a pipeline with configuration
            """json
            {
                "pipeline_id": "test-pipeline-10",
                "name": "test-pipeline-10",
                "source": {
                    "type": "kafka",
                    "kafka_topics": []
                },
                "sink": {
                    "type": "clickhouse",
                    "stream_id": "test_stream",
                    "source_id": "topic-1",
                    "batch": {
                        "max_batch_size": 2
                    },
                    "config": [
                        {
                            "source_field": "id",
                            "source_type": "int32",
                            "destination_field": "id",
                            "destination_type": "Int32"
                        },
                        {
                            "source_field": "type",
                            "source_type": "string",
                            "destination_field": "type",
                            "destination_type": "LowCardinality(String)"
                        }
                    ]
                },
                "schema_versions": {
                    "topic-1": {
                        "source_id": "topic-1",
                        "version_id": "1",
                        "data_type": "json",
                        "fields": [
                            {
                                "name": "id",
                                "type": "int32"
                            },
                            {
                                "name": "type",
                                "type": "string"
                            }
                        ]
                    }
                }
            }
            """
        When I publish 2 events to the stream
            | id      | type | NATS-Schema-Version-Id |
            | 150     | red  | 1                      |
            | 2067868 | blue | 1                      |
        And I run ClickHouse sink
        And Wait until all messages are processed
        And I gracefully stop ClickHouse sink
        Then the ClickHouse table "default.events_test" should contain 2 rows

    Scenario: Import events with Nullable string
        Given the ClickHouse table "default.events_test" already exists with schema
            | column_name | data_type              |
            | id          | Int32                  |
            | type        | Nullable(String) |
        And a stream consumer with config
            """json
            {
                "stream": "test_stream",
                "subject": "test_subject",
                "consumer": "test_consumer",
                "ack_wait": "3s"
            }
            """
        And a pipeline with configuration
            """json
            {
                "pipeline_id": "test-pipeline-10",
                "name": "test-pipeline-10",
                "source": {
                    "type": "kafka",
                    "kafka_topics": []
                },
                "sink": {
                    "type": "clickhouse",
                    "stream_id": "test_stream",
                    "source_id": "topic-1",
                    "batch": {
                        "max_batch_size": 2
                    },
                    "config": [
                        {
                            "source_field": "id",
                            "source_type": "int32",
                            "destination_field": "id",
                            "destination_type": "Int32"
                        },
                        {
                            "source_field": "type",
                            "source_type": "string",
                            "destination_field": "type",
                            "destination_type": "Nullable(String)"
                        }
                    ]
                },
                "schema_versions": {
                    "topic-1": {
                        "source_id": "topic-1",
                        "version_id": "2",
                        "data_type": "json",
                        "fields": [
                            {
                                "name": "id",
                                "type": "int32"
                            }
                        ]
                    }
                }
            }
            """
        When I publish 2 events to the stream
            | id      | NATS-Schema-Version-Id |
            | 150     | 2                      |
            | 2067868 | 2                      |
        And I run ClickHouse sink
        And Wait until all messages are processed
        And I gracefully stop ClickHouse sink
        Then the ClickHouse table "default.events_test" should contain 2 rows
