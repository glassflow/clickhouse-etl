@wip @ingestor
Feature: Kafka Ingestor

    Background: Run before each scenario
        Given the NATS stream config:
            """json
            {
                "stream": "ingestor_stream",
                "subject": "ingestor_subject",
                "consumer": "ingestor_consumer"
            }
            """

    Scenario: Kafka Ingestor with deduplication
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
                                "field_name": "name",
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
                        "column_name": "name",
                        "field_name": "name",
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
                        "id": "topic_id",
                        "partitions": 1,
                        "deduplication": {
                            "enabled": true,
                            "id_field": "id",
                            "id_field_type": "string",
                            "time_window": "1h"
                        }
                    }
                ]
            }
            """

        When I write these events to Kafka topic "test_topic":
            | key | value                                  |
            | 1   | {"id": "123", "name": "John Doe"}      |
            | 2   | {"id": "456", "name": "Jane Smith"}    |
            | 3   | {"id": "789", "name": "Bob Johnson"}   |
            | 4   | {"id": "789", "name": "Ulm Petterson"} |

        And a running ingestor component

        Then I check results stream with content
            | id  | name        |
            | 123 | John Doe    |
            | 456 | Jane Smith  |
            | 789 | Bob Johnson |

    Scenario: Kafka Ingestor without deduplication
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
                                "field_name": "name",
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
                        "column_name": "name",
                        "field_name": "name",
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
                        "id": "topic_id",
                        "partitions": 1,
                        "deduplication": {
                            "enabled": false
                        }
                    }
                ]
            }
            """

        When I write these events to Kafka topic "test_topic":
            | key | value                                   |
            | 1   | {"id": "123", "name": "Sir Paul"}       |
            | 2   | {"id": "456", "name": "Judy Smith"}     |
            | 3   | {"id": "789", "name": "Bob Bishop"}     |
            | 4   | {"id": "789", "name": "Uliana Gromova"} |

        And a running ingestor component

        Then I check results stream with content
            | id  | name           |
            | 123 | Sir Paul       |
            | 456 | Judy Smith     |
            | 789 | Bob Bishop     |
            | 789 | Uliana Gromova |

    Scenario: Kafka Ingestor with deduplication and multiple partitions
        Given a Kafka topic "test_topic" with 3 partitions
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
                                "field_name": "name",
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
                        "column_name": "name",
                        "field_name": "name",
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
                        "id": "topic_id",
                        "partitions": 1,
                        "deduplication": {
                            "enabled": true,
                            "id_field": "id",
                            "id_field_type": "string",
                            "time_window": "1h"
                        }
                    }
                ]
            }
            """

        When I write these events to Kafka topic "test_topic":
            | partition | key | value                                   |
            | 0         | 1   | {"id": "123", "name":"Max Wilson"}      |
            | 1         | 2   | {"id": "456", "name":"Pete Roller"}     |
            | 2         | 3   | {"id": "789", "name":"Fedor Smolov"}    |
            | 0         | 4   | {"id": "789", "name":"Victor Thurilla"} |

        And a running ingestor component

        Then I check results stream with content
            | id  | name         |
            | 123 | Max Wilson   |
            | 456 | Pete Roller  |
            | 789 | Fedor Smolov |

    Scenario: Kafka Ingestor with validation
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
                                "field_name": "name",
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
                        "column_name": "name",
                        "field_name": "name",
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
                        "id": "topic_id",
                        "partitions": 1,
                        "deduplication": {
                            "enabled": false
                        }
                    }
                ]
            }
            """
        When I write these events to Kafka topic "test_topic":
            | key | value                          |
            | 1   | {"id": "123", "name": "Alice"} |
            | 2   | {"id": "456", "name": "Bob"}   |
            | 3   | {"key": "value"}               |

        And a running ingestor component

        Then I check results stream with content
            | id  | name  |
            | 123 | Alice |
            | 456 | Bob   |

        And I check DLQ stream with content
            | component | error                   | original_message |
            | ingestor  | failed to validate data | {"key": "value"} |

