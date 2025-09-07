@pipeline @pause_resume
Feature: Pipeline Pause and Resume functionality

    Scenario: Complete pause and resume flow with message verification
        Given a Kafka topic "pause_resume_test" with 1 partition
        And the ClickHouse table "pause_resume_test" on database "default" already exists with schema
            | column_name | data_type |
            | id          | String    |
            | name        | String    |
            | timestamp   | DateTime  |

        And a glassflow pipeline with next configuration:
            """json
            {
                "pipeline_id": "pause-resume-test-pipeline",
                "mapper": {
                    "type": "jsonToClickhouse",
                    "streams": {
                        "pause_resume_test": {
                            "fields": [
                                {
                                    "field_name": "id",
                                    "field_type": "string"
                                },
                                {
                                    "field_name": "name",
                                    "field_type": "string"
                                },
                                {
                                    "field_name": "timestamp",
                                    "field_type": "string"
                                }
                            ]
                        }
                    },
                    "sink_mapping": [
                        {
                            "stream_name": "pause_resume_test",
                            "field_name": "id",
                            "column_name": "id",
                            "column_type": "String"
                        },
                        {
                            "stream_name": "pause_resume_test",
                            "field_name": "name",
                            "column_name": "name",
                            "column_type": "String"
                        },
                        {
                            "stream_name": "pause_resume_test",
                            "field_name": "timestamp",
                            "column_name": "timestamp",
                            "column_type": "DateTime"
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
                            "name": "pause_resume_test",
                            "consumer_group_initial_offset": "earliest",
                            "consumer_group_name": "glassflow-consumer-group-pause-resume-test-pipeline",
                            "deduplication": {
                                "enabled": true,
                                "id_field": "id",
                                "id_field_type": "string",
                                "time_window": "1m"
                            },
                            "output_stream_id": "gf-pause-resume-test",
                            "output_stream_subject": "gf-pause-resume-test.input"
                        }
                    ]
                },
                "join": {
                    "enabled": false
                },
                "sink": {
                    "type": "clickhouse",
                    "batch": {
                        "max_batch_size": 1,
                        "max_delay_time": "10s"
                    },
                    "clickhouse_connection_params": {
                        "database": "default",
                        "secure": false,
                        "table": "pause_resume_test"
                    },
                    "stream_id": "gf-pause-resume-test"
                }
            }
            """

        # Step 1: Produce initial messages and verify they reach ClickHouse
        When I produce these messages to Kafka topic "pause_resume_test":
            | key | value                                                      |
            | 1   | {"id": "msg1", "name": "Initial Message 1", "timestamp": "2024-01-01T10:00:00Z"} |
            | 2   | {"id": "msg2", "name": "Initial Message 2", "timestamp": "2024-01-01T10:01:00Z"} |

        And I wait for "3s" for messages to be processed
        Then the ClickHouse table "default.pause_resume_test" should contain:
            | id   | name              | COUNT |
            | msg1 | Initial Message 1 | 1     |
            | msg2 | Initial Message 2 | 1     |

        # Step 2: Pause the pipeline
        When I pause the pipeline "pause-resume-test-pipeline"
        And I wait for "10s" for the pipeline to transition to paused state
        Then the pipeline "pause-resume-test-pipeline" health status should be "Paused"

        # Step 3: Produce messages while paused and verify they don't reach ClickHouse
        When I produce these messages to Kafka topic "pause_resume_test":
            | key | value                                                      |
            | 3   | {"id": "msg3", "name": "Paused Message 1", "timestamp": "2024-01-01T10:02:00Z"} |
            | 4   | {"id": "msg4", "name": "Paused Message 2", "timestamp": "2024-01-01T10:03:00Z"} |

        And I wait for "3s" for any processing to complete
        Then the ClickHouse table "default.pause_resume_test" should contain:
            | id   | name              | COUNT |
            | msg1 | Initial Message 1 | 1     |
            | msg2 | Initial Message 2 | 1     |
            | msg3 | Paused Message 1  | 0     |
            | msg4 | Paused Message 2  | 0     |

        # Step 4: Resume the pipeline
        When I resume the pipeline "pause-resume-test-pipeline"
        And I wait for "5s" for the pipeline to transition to running state
        Then the pipeline "pause-resume-test-pipeline" health status should be "Running"

        # Step 5: Verify that messages produced during pause are now processed
        And I wait for "10s" for messages to be processed
        Then the ClickHouse table "default.pause_resume_test" should contain:
            | id   | name              | COUNT |
            | msg1 | Initial Message 1 | 1     |
            | msg2 | Initial Message 2 | 1     |
            | msg3 | Paused Message 1  | 1     |
            | msg4 | Paused Message 2  | 1     |

        # Step 6: Produce new messages after resume and verify they reach ClickHouse
        When I produce these messages to Kafka topic "pause_resume_test":
            | key | value                                                      |
            | 5   | {"id": "msg5", "name": "Resumed Message 1", "timestamp": "2024-01-01T10:04:00Z"} |
            | 6   | {"id": "msg6", "name": "Resumed Message 2", "timestamp": "2024-01-01T10:05:00Z"} |

        And I wait for "3s" for messages to be processed
        Then the ClickHouse table "default.pause_resume_test" should contain:
            | id   | name               | COUNT |
            | msg1 | Initial Message 1  | 1     |
            | msg2 | Initial Message 2  | 1     |
            | msg3 | Paused Message 1   | 1     |
            | msg4 | Paused Message 2   | 1     |
            | msg5 | Resumed Message 1  | 1     |
            | msg6 | Resumed Message 2  | 1     |

        # Cleanup
        And I shutdown the glassflow pipeline after "1s"
