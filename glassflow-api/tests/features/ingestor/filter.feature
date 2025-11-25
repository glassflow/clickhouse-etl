@ingestor
Feature: Kafka Ingestor with Filter

    Background: Run before each scenario
        Given the NATS stream config:
            """json
            {
                "stream": "ingestor_stream",
                "subject": "ingestor_subject",
                "consumer": "ingestor_consumer"
            }
            """

    Scenario: Kafka Ingestor with filter enabled - filter by environment
        Given a Kafka topic "test_topic" with 1 partition
        And a schema mapper with config:
            """json
            {
                "type": "jsonToClickhouse",
                "streams": {
                    "test_topic": {
                        "fields": [
                            {
                                "field_name": "id",
                                "field_type": "string"
                            },
                            {
                                "field_name": "message",
                                "field_type": "string"
                            },
                            {
                                "field_name": "env",
                                "field_type": "string"
                            }
                        ]
                    }
                },
                "sink_mapping": [
                    {
                        "column_name": "id",
                        "field_name": "id",
                        "stream_name": "test_topic",
                        "column_type": "string"
                    },
                    {
                        "column_name": "message",
                        "field_name": "message",
                        "stream_name": "test_topic",
                        "column_type": "String"
                    },
                    {
                        "column_name": "env",
                        "field_name": "env",
                        "stream_name": "test_topic",
                        "column_type": "String"
                    }
                ]
            }
            """
        Given an ingestor component config:
            """json
            {
                "type": "kafka",
                "kafka_connection_params": {
                    "brokers": [],
                    "mechanism": "NO_AUTH",
                    "username": "",
                    "password": "",
                    "root_ca": ""
                },
                "kafka_topics": [
                    {
                        "name": "test_topic",
                        "id": "topic_id",
                        "consumer_group_name": "glassflow-consumer-group-pipeline-123",
                        "partitions": 1,
                        "deduplication": {
                            "enabled": false
                        }
                    }
                ]
            }
            """
        Given an filter component config:
            """
            {
                "expression": "env == \"test\"",
                "enabled": true
            }
            """

        When I write these events to Kafka topic "test_topic":
            | key | value                                                   |
            | 1   | {"id": "123", "message": "test event", "env": "test"}   |
            | 2   | {"id": "456", "message": "prod event", "env": "prod"}   |
            | 3   | {"id": "202", "message": "another test", "env": "test"} |

        And I run the ingestor component

        Then I check results stream with content
            | id  | message    | env  |
            | 456 | prod event | prod |


    Scenario: Kafka Ingestor with filter disabled
        Given a Kafka topic "test_topic" with 1 partition
        And a schema mapper with config:
            """json
            {
                "type": "jsonToClickhouse",
                "streams": {
                    "test_topic": {
                        "fields": [
                            {
                                "field_name": "id",
                                "field_type": "string"
                            },
                            {
                                "field_name": "message",
                                "field_type": "string"
                            },
                            {
                                "field_name": "env",
                                "field_type": "string"
                            }
                        ]
                    }
                },
                "sink_mapping": [
                    {
                        "column_name": "id",
                        "field_name": "id",
                        "stream_name": "test_topic",
                        "column_type": "string"
                    },
                    {
                        "column_name": "message",
                        "field_name": "message",
                        "stream_name": "test_topic",
                        "column_type": "String"
                    },
                    {
                        "column_name": "env",
                        "field_name": "env",
                        "stream_name": "test_topic",
                        "column_type": "String"
                    }
                ]
            }
            """
        Given an ingestor component config:
            """json
            {
                "type": "kafka",
                "kafka_connection_params": {
                    "brokers": [],
                    "mechanism": "NO_AUTH",
                    "username": "",
                    "password": "",
                    "root_ca": ""
                },
                "kafka_topics": [
                    {
                        "name": "test_topic",
                        "id": "topic_id",
                        "consumer_group_name": "glassflow-consumer-group-pipeline-123",
                        "partitions": 1,
                        "deduplication": {
                            "enabled": false
                        }
                    }
                ]
            }
            """
        Given an filter component config:
            """
            {
                "expression": "env == \"test\"",
                "enabled": false
            }
            """

        When I write these events to Kafka topic "test_topic":
            | key | value                                                   |
            | 1   | {"id": "124", "message": "test event", "env": "test"}   |
            | 2   | {"id": "457", "message": "prod event", "env": "prod"}   |
            | 3   | {"id": "203", "message": "another test", "env": "test"} |

        And I run the ingestor component

        Then I check results stream with content
            | id  | message      | env  |
            | 124 | test event   | test |
            | 457 | prod event   | prod |
            | 203 | another test | test |
