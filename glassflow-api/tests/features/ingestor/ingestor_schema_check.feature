@ingestor
Feature: Ingestor supports schema registry with multiple schemas

    Scenario: Ingestor validates messages using different schemas from registry
        Given a Kafka topic "test_topic" with 1 partition
        And a schema registry contains schema with id 1101 and fields:
            | name     | type   |
            | event_id | string |
            | user_id  | string |
        And a schema registry contains schema with id 1102 and fields:
            | name     | type   |
            | event_id | string |
            | user_id  | string |
            | email    | string |
        And pipeline config with configuration
            """json
            {
                "pipeline_id": "test-pipeline-5",
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
                            "name": "test_topic",
                            "id": "topic_topic",
                            "consumer_group_name": "glassflow-consumer-group-pipeline-123",
                            "partitions": 1,
                            "deduplication": {
                                "enabled": false
                            }
                        }
                    ]
                },
                "join": {
                    "enabled": false
                },
                "sink": {
                    "type": "clickhouse",
                    "source_id": "test_topic"
                },
                "schema_versions": {
                    "test_topic": {
                        "source_id": "test_topic",
                        "version_id": "1101",
                        "data_type": "json",
                        "fields": [
                            {
                                "name": "event_id",
                                "type": "string"
                            },
                            {
                                "name": "user_id",
                                "type": "string"
                            }
                        ]
                    }
                }
            }
            """
        When I write these events to Kafka topic "test_topic":
            | key | schema_id | value                                           |
            | 1   | 1101      | {"event_id": "123", "user_id": "John Doe"}      |
            | 2   | 1101      | {"event_id": "456", "user_id": "Jane Smith"}    |
            | 3   | 1102      | {"event_id": "789", "user_id": "Bob Johnson"}   |
            | 4   | 1102      | {"event_id": "789", "user_id": "Ulm Petterson"} |

        And I run the ingestor component

        Then I check results stream with lag 0 and content
            | NATS-Schema-Version-Id | event_id | user_id       |
            | 1101                   | 123      | John Doe      |
            | 1101                   | 456      | Jane Smith    |
            | 1102                   | 789      | Bob Johnson   |
            | 1102                   | 789      | Ulm Petterson |

    Scenario: Ingestor validates messages with absent schema id with registry
        Given a Kafka topic "test_topic" with 1 partition
        And a schema registry contains schema with id 1101 and fields:
            | name     | type   |
            | event_id | string |
            | user_id  | string |
        And a schema registry contains schema with id 1102 and fields:
            | name     | type   |
            | event_id | string |
            | user_id  | string |
            | email    | string |
        And pipeline config with configuration
            """json
            {
                "pipeline_id": "test-pipeline-6",
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
                            "name": "test_topic",
                            "id": "topic_topic",
                            "consumer_group_name": "glassflow-consumer-group-pipeline-123",
                            "partitions": 1,
                            "deduplication": {
                                "enabled": false
                            }
                        }
                    ]
                },
                "join": {
                    "enabled": false
                },
                "sink": {
                    "type": "clickhouse",
                    "source_id": "test_topic"
                },
                "schema_versions": {
                    "test_topic": {
                        "source_id": "test_topic",
                        "version_id": "1101",
                        "data_type": "json",
                        "fields": [
                            {
                                "name": "event_id",
                                "type": "string"
                            },
                            {
                                "name": "user_id",
                                "type": "string"
                            }
                        ]
                    }
                }
            }
            """
        When I write these events to Kafka topic "test_topic":
            | key | schema_id | value                                           |
            | 1   | 1101      | {"event_id": "123", "user_id": "John Doe"}      |
            | 2   | 1101      | {"event_id": "456", "user_id": "Jane Smith"}    |
            | 3   | 1102      | {"event_id": "789", "user_id": "Bob Johnson"}   |
            | 4   | 1103      | {"event_id": "789", "user_id": "Ulm Petterson"} |

        And I run the ingestor component

        Then I check results stream with lag 1 and content
            | NATS-Schema-Version-Id | event_id | user_id     |
            | 1101                   | 123      | John Doe    |
            | 1101                   | 456      | Jane Smith  |
            | 1102                   | 789      | Bob Johnson |

        Then I check signal stream with content
            | pipeline_id     | reason           | text                             | component |
            | test-pipeline-6 | schema not found | schema id 1103 validation failed | ingestor  |
