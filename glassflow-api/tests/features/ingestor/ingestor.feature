@ingestor
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
        And pipeline config with configuration
            """json
            {
                "pipeline_id": "test-pipeline-1",
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
                            "id": "test_topic",
                            "consumer_group_name": "glassflow-consumer-group-pipeline-123",
                            "partitions": 1,
                            "deduplication": {
                                "enabled": true,
                                "id_field": "id",
                                "id_field_type": "string",
                                "time_window": "1h"
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

        When I write these events to Kafka topic "test_topic":
            | key | value                                  |
            | 1   | {"id": "123", "name": "John Doe"}      |
            | 2   | {"id": "456", "name": "Jane Smith"}    |
            | 3   | {"id": "789", "name": "Bob Johnson"}   |
            | 4   | {"id": "789", "name": "Ulm Petterson"} |

        And I run the ingestor component

        Then I check results stream with lag 0 and content
            | id  | name        |
            | 123 | John Doe    |
            | 456 | Jane Smith  |
            | 789 | Bob Johnson |

    Scenario: Kafka Ingestor without deduplication
        Given a Kafka topic "test_topic" with 1 partition
        And pipeline config with configuration
            """json
            {
                "pipeline_id": "test-pipeline-1",
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

        When I write these events to Kafka topic "test_topic":
            | key | value                                   |
            | 1   | {"id": "123", "name": "Sir Paul"}       |
            | 2   | {"id": "456", "name": "Judy Smith"}     |
            | 3   | {"id": "789", "name": "Bob Bishop"}     |
            | 4   | {"id": "789", "name": "Uliana Gromova"} |

        And I run the ingestor component

        Then I check results stream with lag 0 and content
            | id  | name           |
            | 123 | Sir Paul       |
            | 456 | Judy Smith     |
            | 789 | Bob Bishop     |
            | 789 | Uliana Gromova |

    Scenario: Kafka Ingestor with deduplication and multiple partitions
        Given a Kafka topic "test_topic" with 3 partitions
        And pipeline config with configuration
            """json
            {
                "pipeline_id": "test-pipeline-1",
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
                                "enabled": true,
                                "id_field": "id",
                                "id_field_type": "string",
                                "time_window": "1h"
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

        When I write these events to Kafka topic "test_topic":
            | partition | key | value                                |
            | 0         | 1   | {"id": "123", "name":"Max Wilson"}   |
            | 1         | 2   | {"id": "456", "name":"Pete Roller"}  |
            | 2         | 3   | {"id": "789", "name":"Fedor Smolov"} |
            | 0         | 4   | {"id": "789", "name":"Fedor Smolov"} |

        And I run the ingestor component

        Then I check results stream with lag 0 and content
            | id  | name         |
            | 123 | Max Wilson   |
            | 456 | Pete Roller  |
            | 789 | Fedor Smolov |

    Scenario: Kafka Ingestor with validation
        Given a Kafka topic "test_topic" with 1 partition
        And pipeline config with configuration
            """json
            {
                "pipeline_id": "test-pipeline-1",
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
        When I write these events to Kafka topic "test_topic":
            | key | value                          |
            | 1   | {"id": "123", "name": "Alice"} |
            | 2   | {"id": "456", "name": "Bob"}   |
            | 3   | {"key": "value"}               |

        And I run the ingestor component

        Then I check results stream with lag 0 and content
            | id  | name  |
            | 123 | Alice |
            | 456 | Bob   |

        And I check DLQ stream with content
            | component | error                                                                                            | original_message |
            | ingestor  | failed to validate data: validate json data against fields: field 'id' is missing in the message | {"key": "value"} |

    Scenario: Run 2 ingestor from 2 separate pipelines for the one kafka topic
        Given a Kafka topic "test_topic" with 1 partition
        And pipeline config with configuration
            """json
            {
                "pipeline_id": "test-pipeline-1",
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
        When I write these events to Kafka topic "test_topic":
            | key | value                                  |
            | 1   | {"id": "123", "name": "John Doe"}      |
            | 2   | {"id": "456", "name": "Jane Smith"}    |
            | 3   | {"id": "789", "name": "Bob Johnson"}   |
            | 4   | {"id": "789", "name": "Ulm Petterson"} |

        And I run the ingestor component

        Then I check results stream with lag 0 and content
            | id  | name          |
            | 123 | John Doe      |
            | 456 | Jane Smith    |
            | 789 | Bob Johnson   |
            | 789 | Ulm Petterson |

        And I stop the ingestor component

        Then I flush all NATS streams

        And pipeline config with configuration
            """json
            {
                "pipeline_id": "test-pipeline-2",
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
                            "consumer_group_name": "glassflow-consumer-group-pipeline-456",
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

        And I run the ingestor component

        Then I check results stream with lag 0 and content
            | id  | name          |
            | 123 | John Doe      |
            | 456 | Jane Smith    |
            | 789 | Bob Johnson   |
            | 789 | Ulm Petterson |

    Scenario: Check deduplication within 2 batches
        Given a Kafka topic "test_topic" with 1 partition
        And pipeline config with configuration
            """json
            {
                "pipeline_id": "test-pipeline-3",
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
                                "enabled": true,
                                "id_field": "id",
                                "id_field_type": "string",
                                "time_window": "1h"
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

        When I write these events to Kafka topic "test_topic":
            | key | value                                 |
            | 1   | {"id": "123", "name": "John Doe"}     |
            | 2   | {"id": "456", "name": "Jane Smith"}   |
            | 3   | {"id": "123", "name": "Johnny Doe"}   |
            | 4   | {"id": "789", "name": "Bob Johnson"}  |
            | 5   | {"id": "456",  "name": "Janet Smith"} |

        And I run the ingestor component
        Then I check results stream with lag 0 and content
            | id  | name        |
            | 123 | John Doe    |
            | 456 | Jane Smith  |
            | 789 | Bob Johnson |

        When I write these events to Kafka topic "test_topic":
            | key | value                                   |
            | 6   | {"id": "101", "name": "Robert Johnson"} |
            | 7   | {"id": "111", "name": "Alice Brown"}    |
            | 8   | {"id": "101", "name": "Johnny Doe"}     |

        Then I check results stream with lag 0 and content
            | id  | name           |
            | 111 | Alice Brown    |
            | 101 | Robert Johnson |

    Scenario: Check kafka partitions read
        Given a Kafka topic "test_topic" with 3 partitions
        And pipeline config with configuration
            """json
            {
                "pipeline_id": "test-pipeline-4",
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
                                "enabled": true,
                                "id_field": "id",
                                "id_field_type": "string",
                                "time_window": "1h"
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

        When I write these events to Kafka topic "test_topic":
            | partition | key | value                                |
            | 0         | 1   | {"id": "123", "name":"Max Wilson"}   |
            | 1         | 2   | {"id": "130", "name":"Pete Roller"}  |
            | 2         | 3   | {"id": "789", "name":"Fedor Smolov"} |
            | 0         | 4   | {"id": "124", "name":"Max Wilson"}   |
            | 0         | 5   | {"id": "125", "name":"Ed Brown"}     |
            | 0         | 6   | {"id": "126", "name":"Sam Green"}    |
            | 0         | 7   | {"id": "127", "name":"Tom White"}    |
            | 0         | 8   | {"id": "128", "name":"Jim Black"}    |
            | 0         | 9   | {"id": "129", "name":"Tim Blue"}     |
            | 0         | 10  | {"id": "130", "name":"Pete Roller"}  |

        And I run the ingestor component

        Then I check results stream with lag 0 and content
            | id  | name         |
            | 123 | Max Wilson   |
            | 130 | Pete Roller  |
            | 789 | Fedor Smolov |
            | 124 | Max Wilson   |
            | 125 | Ed Brown     |
            | 126 | Sam Green    |
            | 127 | Tom White    |
            | 128 | Jim Black    |
            | 129 | Tim Blue     |

    Scenario: Kafka Ingestor with transfromation and deduplication
        Given a Kafka topic "test_topic" with 1 partition
        And pipeline config with configuration
            """json
            {
                "pipeline_id": "test-pipeline-11",
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
                                "enabled": true,
                                "id_field": "id",
                                "id_field_type": "string",
                                "time_window": "1h"
                            }
                        }
                    ]
                },
                "stateless_transformation": {
                    "id": "test-transform",
                    "type": "expr_lang_transform",
                    "enabled": true,
                    "source_id": "test_topic",
                    "config": {
                        "transform": [
                            {
                                "field_name": "name",
                                "expression": "concat(name, '!!!')"
                            }
                        ]
                    }
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
                    },
                    "test-transform": {
                        "source_id": "test-transform",
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
        When I write these events to Kafka topic "test_topic":
            | key | value                                |
            | 1   | {"id": "123", "name": "John Doe"}    |
            | 2   | {"id": "456", "name": "Jane Smith"}  |
            | 3   | {"id": "789", "name": "Bob Johnson"} |

        And I run the ingestor component

        Then I check results stream with lag 0 and content
            | id  | name        | NATS-Nats-Msg-Id |
            | 123 | John Doe    | 123              |
            | 456 | Jane Smith  | 456              |
            | 789 | Bob Johnson | 789              |