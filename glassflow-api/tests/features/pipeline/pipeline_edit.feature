@pipelines
Feature: Edit Pipeline

    Scenario: Edit pipeline successfully when stopped
        Given a Kafka topic "edit_test_topic" with 1 partition
        And the ClickHouse table "edit_events_test" on database "default" already exists with schema
            | column_name | data_type |
            | id          | String    |
            | name        | String    |
            | updated_at  | DateTime  |

        And a glassflow pipeline with next configuration:
            """json
            {
                "pipeline_id": "edit-pipeline-test-001",
                "mapper": {
                    "type": "jsonToClickhouse",
                    "streams": {
                        "edit_test_topic": {
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
                            "stream_name": "edit_test_topic",
                            "field_name": "id",
                            "column_name": "id",
                            "column_type": "String"
                        },
                        {
                            "stream_name": "edit_test_topic",
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
                            "name": "edit_test_topic",
                            "consumer_group_initial_offset": "earliest",
                            "consumer_group_name": "glassflow-consumer-group-edit-pipeline-test-001",
                            "deduplication": {
                                "enabled": false
                            },
                            "output_stream_id": "gf-edit-test-edit_test_topic",
                            "output_stream_subject": "gf-edit-test-edit_test_topic.input"
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
                        "max_delay_time": "60s"
                    },
                    "clickhouse_connection_params": {
                        "database": "default",
                        "secure": false,
                        "table": "edit_events_test"
                    },
                    "stream_id": "gf-edit-test-edit_test_topic",
                    "nats_consumer_name": "gf-nats-si-edit-test"
                }
            }
            """

        And I wait for "10s" to let pipeline start

        And I stop the glassflow pipeline

        And I wait for "5s" to let stop operation complete

        And I edit the glassflow pipeline with next configuration:
            """json
            {
                "pipeline_id": "edit-pipeline-test-001",
                "name": "Updated Edit Test Pipeline",
                "source": {
                    "type": "kafka",
                    "provider": "confluent",
                    "connection_params": {
                        "brokers": ["localhost:9092"],
                        "skip_auth": true,
                        "protocol": "PLAINTEXT"
                    },
                    "topics": [
                        {
                            "name": "edit_test_topic",
                            "id": "edit-topic-1",
                            "schema": {
                                "type": "json",
                                "fields": [
                                    {"name": "id", "type": "string"},
                                    {"name": "name", "type": "string"},
                                    {"name": "updated_at", "type": "string"}
                                ]
                            },
                            "consumer_group_initial_offset": "earliest",
                            "replicas": 1,
                            "deduplication": {
                                "enabled": false
                            }
                        }
                    ]
                },
                "join": {
                    "type": "temporal",
                    "enabled": false
                },
                "sink": {
                    "type": "clickhouse",
                    "host": "localhost",
                    "port": "9000",
                    "database": "default",
                    "username": "default",
                    "password": "",
                    "table": "edit_events_test",
                    "secure": false,
                    "table_mapping": [
                        {
                            "source_id": "edit-topic-1",
                            "field_name": "id",
                            "column_name": "id",
                            "column_type": "String"
                        },
                        {
                            "source_id": "edit-topic-1",
                            "field_name": "name",
                            "column_name": "name",
                            "column_type": "String"
                        },
                        {
                            "source_id": "edit-topic-1",
                            "field_name": "updated_at",
                            "column_name": "updated_at",
                            "column_type": "DateTime"
                        }
                    ],
                    "max_batch_size": 2000,
                    "max_delay_time": "30s",
                    "skip_certificate_verification": false
                }
            }
            """

        And I wait for "10s" to let edit operation complete

        Then the pipeline status should be "Running"

    Scenario: Edit fails when pipeline is running
        Given a Kafka topic "edit_fail_topic" with 1 partition
        And the ClickHouse table "edit_fail_events_test" on database "default" already exists with schema
            | column_name | data_type |
            | id          | String    |
            | name        | String    |

        And a glassflow pipeline with next configuration:
            """json
            {
                "pipeline_id": "edit-fail-pipeline-test-001",
                "mapper": {
                    "type": "jsonToClickhouse",
                    "streams": {
                        "edit_fail_topic": {
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
                            "stream_name": "edit_fail_topic",
                            "field_name": "id",
                            "column_name": "id",
                            "column_type": "String"
                        },
                        {
                            "stream_name": "edit_fail_topic",
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
                            "name": "edit_fail_topic",
                            "consumer_group_initial_offset": "earliest",
                            "consumer_group_name": "glassflow-consumer-group-edit-fail-pipeline-test-001",
                            "deduplication": {
                                "enabled": false
                            },
                            "output_stream_id": "gf-edit-fail-edit_fail_topic",
                            "output_stream_subject": "gf-edit-fail-edit_fail_topic.input"
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
                        "max_delay_time": "60s"
                    },
                    "clickhouse_connection_params": {
                        "database": "default",
                        "secure": false,
                        "table": "edit_fail_events_test"
                    },
                    "stream_id": "gf-edit-fail-edit_fail_topic",
                    "nats_consumer_name": "gf-nats-si-edit-fail"
                }
            }
            """

        And I wait for "10s" to let pipeline start

        And I edit the glassflow pipeline and expect error:
            """json
            {
                "pipeline_id": "edit-fail-pipeline-test-001",
                "name": "Updated Edit Fail Test Pipeline",
                "source": {
                    "type": "kafka",
                    "provider": "confluent",
                    "connection_params": {
                        "brokers": ["localhost:9092"],
                        "skip_auth": true,
                        "protocol": "PLAINTEXT"
                    },
                    "topics": [
                        {
                            "name": "edit_fail_topic",
                            "id": "edit-fail-topic-1",
                            "schema": {
                                "type": "json",
                                "fields": [
                                    {"name": "id", "type": "string"},
                                    {"name": "name", "type": "string"}
                                ]
                            },
                            "consumer_group_initial_offset": "earliest",
                            "replicas": 1,
                            "deduplication": {
                                "enabled": false
                            }
                        }
                    ]
                },
                "join": {
                    "type": "temporal",
                    "enabled": false
                },
                "sink": {
                    "type": "clickhouse",
                    "host": "localhost",
                    "port": "9000",
                    "database": "default",
                    "username": "default",
                    "password": "",
                    "table": "edit_fail_events_test",
                    "secure": false,
                    "table_mapping": [
                        {
                            "source_id": "edit-fail-topic-1",
                            "field_name": "id",
                            "column_name": "id",
                            "column_type": "String"
                        },
                        {
                            "source_id": "edit-fail-topic-1",
                            "field_name": "name",
                            "column_name": "name",
                            "column_type": "String"
                        }
                    ],
                    "max_batch_size": 2000,
                    "max_delay_time": "30s",
                    "skip_certificate_verification": false
                }
            }
            """

        And I stop the glassflow pipeline

        And I wait for "5s" to let stop operation complete

    Scenario: Edit with name change is allowed
        Given a Kafka topic "edit_name_topic" with 1 partition
        And the ClickHouse table "edit_name_events_test" on database "default" already exists with schema
            | column_name | data_type |
            | id          | String    |
            | name        | String    |

        And a glassflow pipeline with next configuration:
            """json
            {
                "pipeline_id": "edit-name-pipeline-test-001",
                "mapper": {
                    "type": "jsonToClickhouse",
                    "streams": {
                        "edit_name_topic": {
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
                            "stream_name": "edit_name_topic",
                            "field_name": "id",
                            "column_name": "id",
                            "column_type": "String"
                        },
                        {
                            "stream_name": "edit_name_topic",
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
                            "name": "edit_name_topic",
                            "consumer_group_initial_offset": "earliest",
                            "consumer_group_name": "glassflow-consumer-group-edit-name-pipeline-test-001",
                            "deduplication": {
                                "enabled": false
                            },
                            "output_stream_id": "gf-edit-name-edit_name_topic",
                            "output_stream_subject": "gf-edit-name-edit_name_topic.input"
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
                        "max_delay_time": "60s"
                    },
                    "clickhouse_connection_params": {
                        "database": "default",
                        "secure": false,
                        "table": "edit_name_events_test"
                    },
                    "stream_id": "gf-edit-name-edit_name_topic",
                    "nats_consumer_name": "gf-nats-si-edit-name"
                }
            }
            """

        And I wait for "10s" to let pipeline start

        And I stop the glassflow pipeline

        And I wait for "5s" to let stop operation complete

        And I edit the glassflow pipeline with next configuration:
            """json
            {
                "pipeline_id": "edit-name-pipeline-test-001",
                "name": "Updated Name Pipeline",
                "source": {
                    "type": "kafka",
                    "provider": "confluent",
                    "connection_params": {
                        "brokers": ["localhost:9092"],
                        "skip_auth": true,
                        "protocol": "PLAINTEXT"
                    },
                    "topics": [
                        {
                            "name": "edit_name_topic",
                            "id": "edit-name-topic-1",
                            "schema": {
                                "type": "json",
                                "fields": [
                                    {"name": "id", "type": "string"},
                                    {"name": "name", "type": "string"}
                                ]
                            },
                            "consumer_group_initial_offset": "earliest",
                            "replicas": 1,
                            "deduplication": {
                                "enabled": false
                            }
                        }
                    ]
                },
                "join": {
                    "type": "temporal",
                    "enabled": false
                },
                "sink": {
                    "type": "clickhouse",
                    "host": "localhost",
                    "port": "9000",
                    "database": "default",
                    "username": "default",
                    "password": "",
                    "table": "edit_name_events_test",
                    "secure": false,
                    "table_mapping": [
                        {
                            "source_id": "edit-name-topic-1",
                            "field_name": "id",
                            "column_name": "id",
                            "column_type": "String"
                        },
                        {
                            "source_id": "edit-name-topic-1",
                            "field_name": "name",
                            "column_name": "name",
                            "column_type": "String"
                        }
                    ],
                    "max_batch_size": 1000,
                    "max_delay_time": "60s",
                    "skip_certificate_verification": false
                }
            }
            """

        And I wait for "10s" to let edit operation complete

        Then the pipeline status should be "Running"
