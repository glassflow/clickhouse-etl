@backpressure
Feature: Ingestor back-pressure propagation

    # Validates that the ingestor correctly back-pressures Kafka consumption when
    # the output NATS stream is full, and recovers cleanly when the stream drains.

    Background: Shared setup for every scenario
        Given I set up metrics collection
        And the NATS stream config:
            """json
            {
                "stream": "bp_output_stream",
                "subject": "bp_output_subject",
                "consumer": "bp_output_consumer"
            }
            """

    # Scenario 1: baseline — Kafka lag grows when the output stream is capped.
    Scenario: Back-pressure is applied when the ingestor output stream is full
        Given a Kafka topic "bp_topic_s1" with 1 partition
        And the NATS output stream has max messages 50
        And pipeline config with configuration
            """json
            {
                "pipeline_id": "bp-test-pipeline-s1",
                "source_type": "kafka",
                "ingestor": {
                    "type": "kafka",
                    "kafka_connection_params": {
                        "brokers": [],
                        "mechanism": "NO_AUTH",
                        "protocol": "SASL_PLAINTEXT",
                        "username": "",
                        "password": "",
                        "root_ca": ""
                    },
                    "kafka_topics": [
                        {
                            "name": "bp_topic_s1",
                            "id": "bp_topic_s1",
                            "consumer_group_name": "bp-cg-s1",
                            "replicas": 1,
                            "consumer_group_initial_offset": "earliest",
                            "deduplication": {
                                "enabled": false
                            }
                        }
                    ]
                },
                "join": {"enabled": false},
                "sink": {"type": "clickhouse", "source_id": "bp_topic_s1"},
                "schema_versions": {
                    "bp_topic_s1": {
                        "source_id": "bp_topic_s1",
                        "version_id": "1",
                        "data_type": "json",
                        "fields": [
                            {"name": "id", "type": "string"},
                            {"name": "val", "type": "string"}
                        ]
                    }
                }
            }
            """
        When I write 200 generated events to Kafka topic "bp_topic_s1"
        And I run the ingestor component
        Then Kafka consumer lag should grow above 50 within "20s"
        And the NATS output stream depth should be at most 50
        And the ingestor back-pressure events metric should be greater than 0

    # Scenario 5: recovery — after the stream is drained, the ingestor resumes and
    # Kafka lag returns to zero.
    Scenario: Ingestor recovers when back-pressure clears
        Given a Kafka topic "bp_topic_s5" with 1 partition
        And the NATS output stream has max messages 50
        And pipeline config with configuration
            """json
            {
                "pipeline_id": "bp-test-pipeline-s5",
                "source_type": "kafka",
                "ingestor": {
                    "type": "kafka",
                    "kafka_connection_params": {
                        "brokers": [],
                        "mechanism": "NO_AUTH",
                        "protocol": "SASL_PLAINTEXT",
                        "username": "",
                        "password": "",
                        "root_ca": ""
                    },
                    "kafka_topics": [
                        {
                            "name": "bp_topic_s5",
                            "id": "bp_topic_s5",
                            "consumer_group_name": "bp-cg-s5",
                            "replicas": 1,
                            "consumer_group_initial_offset": "earliest",
                            "deduplication": {
                                "enabled": false
                            }
                        }
                    ]
                },
                "join": {"enabled": false},
                "sink": {"type": "clickhouse", "source_id": "bp_topic_s5"},
                "schema_versions": {
                    "bp_topic_s5": {
                        "source_id": "bp_topic_s5",
                        "version_id": "1",
                        "data_type": "json",
                        "fields": [
                            {"name": "id", "type": "string"},
                            {"name": "val", "type": "string"}
                        ]
                    }
                }
            }
            """
        When I write 200 generated events to Kafka topic "bp_topic_s5"
        And I run the ingestor component
        And Kafka consumer lag grows above 50 within "20s"
        When I drain the NATS output stream
        Then Kafka consumer lag should return to 0 within "45s"

    # Scenario 6: stop during back-pressure — the ingestor stops cleanly when
    # signalled while it is in a back-pressure retry loop.
    Scenario: Ingestor stops cleanly during back-pressure
        Given a Kafka topic "bp_topic_s6" with 1 partition
        And the NATS output stream has max messages 50
        And pipeline config with configuration
            """json
            {
                "pipeline_id": "bp-test-pipeline-s6",
                "source_type": "kafka",
                "ingestor": {
                    "type": "kafka",
                    "kafka_connection_params": {
                        "brokers": [],
                        "mechanism": "NO_AUTH",
                        "protocol": "SASL_PLAINTEXT",
                        "username": "",
                        "password": "",
                        "root_ca": ""
                    },
                    "kafka_topics": [
                        {
                            "name": "bp_topic_s6",
                            "id": "bp_topic_s6",
                            "consumer_group_name": "bp-cg-s6",
                            "replicas": 1,
                            "consumer_group_initial_offset": "earliest",
                            "deduplication": {
                                "enabled": false
                            }
                        }
                    ]
                },
                "join": {"enabled": false},
                "sink": {"type": "clickhouse", "source_id": "bp_topic_s6"},
                "schema_versions": {
                    "bp_topic_s6": {
                        "source_id": "bp_topic_s6",
                        "version_id": "1",
                        "data_type": "json",
                        "fields": [
                            {"name": "id", "type": "string"},
                            {"name": "val", "type": "string"}
                        ]
                    }
                }
            }
            """
        When I write 200 generated events to Kafka topic "bp_topic_s6"
        And I run the ingestor component
        And Kafka consumer lag grows above 50 within "20s"
        Then I can stop the ingestor within "15s"
