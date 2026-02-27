@pipeline
Feature: Kafka to CH pipeline

    Scenario: Kafka to ClickHouse pipeline with deduplication only
        Given a Kafka topic "test_topic" with 1 partition
        And the ClickHouse table "events_test" on database "default" already exists with schema
            | column_name | data_type |
            | id          | String    |
            | name        | String    |

        And I write these events to Kafka topic "test_topic":
            | key | value                                  |
            | 1   | {"id": "123", "name": "John Doe"}      |
            | 2   | {"id": "456", "name": "Jane Smith"}    |
            | 3   | {"id": "789", "name": "Bob Johnson"}   |
            | 4   | {"id": "789", "name": "Ulm Petterson"} |

        And a glassflow pipeline with next configuration:
            """json
            {
                "pipeline_id": "kafka-to-clickhouse-pipeline-b00001",
                "name": "kafka-to-clickhouse-pipeline-b00001",
                "ingestor": {
                    "type": "kafka",
                    "kafka_topics": [
                        {
                            "id": "test_topic",
                            "output_stream_id": "gf-test-topic",
                            "output_stream_subject": "gf-test-topic.input",
                            "consumer_group_initial_offset": "earliest",
                            "consumer_group_name": "glassflow-consumer-group-kafka-to-clickhouse-pipeline-b00001",
                            "name": "test_topic",
                            "replicas": 1,
                            "deduplication": {
                                "enabled": true,
                                "id_field": "id",
                                "id_field_type": "string",
                                "time_window": "1h"
                            }
                        }
                    ]
                },
                "sink": {
                    "type": "clickhouse",
                    "source_id": "test_topic",
                    "stream_id": "gf-test-topic",
                    "batch": {
                        "max_batch_size": 1000,
                        "max_delay_time": "1s"
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
        And I shutdown the glassflow pipeline after "4s"

        Then the ClickHouse table "default.events_test" should contain:
            | id  | name          | COUNT |
            | 123 | John Doe      | 1     |
            | 456 | Jane Smith    | 1     |
            | 789 | Bob Johnson   | 1     |
            | 007 | James Bond    | 0     |
            | 789 | Ulm Petterson | 0     |

    Scenario: Kafka to ClickHouse pipeline with join only
        Given a Kafka topic "test_emails" with 1 partition
        And a Kafka topic "test_users" with 1 partition
        And the ClickHouse table "test_users" on database "default" already exists with schema
            | column_name | data_type |
            | name        | String    |
            | email       | String    |

        And a glassflow pipeline with next configuration:
            """json
            {
                "pipeline_id": "kafka-to-clickhouse-pipeline-b00002",
                "name": "kafka-to-clickhouse-pipeline-b00002",
                "ingestor": {
                    "type": "kafka",
                    "kafka_topics": [
                        {
                            "id": "test_emails",
                            "output_stream_id": "gf-test_emails",
                            "output_stream_subject": "gf-test_emails.input",
                            "name": "test_emails",
                            "replicas": 1,
                            "consumer_group_initial_offset": "earliest",
                            "consumer_group_name": "glassflow-consumer-group-kafka-to-clickhouse-pipeline-b00002",
                            "deduplication": {
                                "enabled": false
                            }
                        },
                        {
                            "id": "test_users",
                            "output_stream_id": "gf-test_users",
                            "output_stream_subject": "gf-test_users.input",
                            "name": "test_users",
                            "replicas": 1,
                            "consumer_group_initial_offset": "earliest",
                            "consumer_group_name": "glassflow-consumer-group-kafka-to-clickhouse-pipeline-b00002",
                            "deduplication": {
                                "enabled": false
                            }
                        }
                    ]
                },
                "join": {
                    "enabled": true,
                    "type": "temporal",
                    "id": "join-1",
                    "sources": [
                        {
                            "source_id": "test_emails",
                            "stream_id": "gf-test_emails",
                            "join_key": "user_id",
                            "time_window": "1h",
                            "orientation": "left"
                        },
                        {
                            "source_id": "test_users",
                            "stream_id": "gf-test_users",
                            "join_key": "id",
                            "time_window": "1h",
                            "orientation": "right"
                        }
                    ],
                    "config": [
                        {
                            "source_id": "test_users",
                            "source_name": "name",
                            "output_name": "name"
                        },
                        {
                            "source_id": "test_emails",
                            "source_name": "email",
                            "output_name": "email"
                        }
                    ]
                },
                "sink": {
                    "type": "clickhouse",
                    "source_id": "join-1",
                    "stream_id": "gf-join-1-stream",
                    "batch": {
                        "max_batch_size": 1000,
                        "max_delay_time": "1s"
                    },
                    "config": [
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
                        }
                    ]
                },
                "schema_versions": {
                    "test_emails": {
                        "source_id": "test_emails",
                        "version_id": "1",
                        "data_type": "json",
                        "fields": [
                            {
                                "name": "user_id",
                                "type": "string"
                            },
                            {
                                "name": "email",
                                "type": "string"
                            }
                        ]
                    },
                    "test_users": {
                        "source_id": "test_users",
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
                    "join-1": {
                        "source_id": "join-1",
                        "version_id": "1",
                        "data_type": "json",
                        "fields": [
                            {
                                "name": "name",
                                "type": "string"
                            },
                            {
                                "name": "email",
                                "type": "string"
                            }
                        ]
                    }
                }
            }
            """
        And I write these events to Kafka topic "test_emails":
            | key | value                                               |
            | 1   | {"user_id": "123", "email": "john.doe@mailbox.com"} |
            | 2   | {"user_id": "480", "email": "zahng.chow@gmail.com"} |
            | 3   | {"user_id": "789", "email": "b.johnson@gmail.com"}  |
            | 4   | {"user_id": "789", "email": "b.johnson@yahoo.com"}  |

        And I write these events to Kafka topic "test_users":
            | key | value                                |
            | 1   | {"id": "123", "name": "John Doe"}    |
            | 2   | {"id": "456", "name": "Jane Smith"}  |
            | 3   | {"id": "789", "name": "Bob Johnson"} |

        And I shutdown the glassflow pipeline after "4s"
        Then the ClickHouse table "default.test_users" should contain:
            | name        | email                | COUNT |
            | John Doe    | john.doe@mailbox.com | 1     |
            | Bob Johnson | b.johnson@gmail.com  | 1     |
            | Bob Johnson | b.johnson@yahoo.com  | 1     |

    Scenario: Kafka to ClickHouse pipeline with deduplication and join
        Given a Kafka topic "test_emails" with 1 partition
        And a Kafka topic "test_users" with 1 partition
        And the ClickHouse table "test_users" on database "default" already exists with schema
            | column_name | data_type |
            | name        | String    |
            | email       | String    |

        And a glassflow pipeline with next configuration:
            """json
            {
                "pipeline_id": "kafka-to-clickhouse-pipeline-b00003",
                "name": "kafka-to-clickhouse-pipeline-b00003",
                "ingestor": {
                    "type": "kafka",
                    "kafka_topics": [
                        {
                            "id": "test_emails",
                            "output_stream_id": "gf-test_emails",
                            "output_stream_subject": "gf-test_emails.input",
                            "name": "test_emails",
                            "replicas": 1,
                            "consumer_group_initial_offset": "earliest",
                            "consumer_group_name": "glassflow-consumer-group-kafka-to-clickhouse-pipeline-b00003",
                            "deduplication": {
                                "enabled": true,
                                "id_field": "user_id",
                                "id_field_type": "string",
                                "time_window": "1h"
                            }
                        },
                        {
                            "id": "test_users",
                            "output_stream_id": "gf-test_users",
                            "output_stream_subject": "gf-test_users.input",
                            "name": "test_users",
                            "replicas": 1,
                            "consumer_group_initial_offset": "earliest",
                            "consumer_group_name": "glassflow-consumer-group-kafka-to-clickhouse-pipeline-b00003",
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
                    "enabled": true,
                    "type": "temporal",
                    "id": "join-1",
                    "sources": [
                        {
                            "source_id": "test_emails",
                            "stream_id": "gf-test_emails",
                            "join_key": "user_id",
                            "time_window": "1h",
                            "orientation": "left"
                        },
                        {
                            "source_id": "test_users",
                            "stream_id": "gf-test_users",
                            "join_key": "id",
                            "time_window": "1h",
                            "orientation": "right"
                        }
                    ],
                    "config": [
                        {
                            "source_id": "test_users",
                            "source_name": "name",
                            "output_name": "name"
                        },
                        {
                            "source_id": "test_emails",
                            "source_name": "email",
                            "output_name": "email"
                        }
                    ]
                },
                "sink": {
                    "type": "clickhouse",
                    "source_id": "join-1",
                    "stream_id": "gf-join-1-stream",
                    "batch": {
                        "max_batch_size": 1000,
                        "max_delay_time": "1s"
                    },
                    "config": [
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
                        }
                    ]
                },
                "schema_versions": {
                    "test_emails": {
                        "source_id": "test_emails",
                        "version_id": "1",
                        "data_type": "json",
                        "fields": [
                            {
                                "name": "user_id",
                                "type": "string"
                            },
                            {
                                "name": "email",
                                "type": "string"
                            }
                        ]
                    },
                    "test_users": {
                        "source_id": "test_users",
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
                    "join-1": {
                        "source_id": "join-1",
                        "version_id": "1",
                        "data_type": "json",
                        "fields": [
                            {
                                "name": "name",
                                "type": "string"
                            },
                            {
                                "name": "email",
                                "type": "string"
                            }
                        ]
                    }
                }
            }
            """
        And I write these events to Kafka topic "test_emails":
            | key | value                                               |
            | 1   | {"user_id": "123", "email": "john.doe@mailbox.com"} |
            | 2   | {"user_id": "480", "email": "zahng.chow@gmail.com"} |
            | 3   | {"user_id": "789", "email": "b.johnson@gmail.com"}  |
            | 4   | {"user_id": "789", "email": "b.johnson@yahoo.com"}  |

        And I write these events to Kafka topic "test_users":
            | key | value                                |
            | 1   | {"id": "123", "name": "John Doe"}    |
            | 2   | {"id": "456", "name": "Jane Smith"}  |
            | 3   | {"id": "789", "name": "Bob Johnson"} |

        And I shutdown the glassflow pipeline after "4s"
        Then the ClickHouse table "default.test_users" should contain:
            | name        | email                | COUNT |
            | John Doe    | john.doe@mailbox.com | 1     |
            | Bob Johnson | b.johnson@gmail.com  | 1     |
            | Bob Johnson | b.johnson@yahoo.com  | 0     |

    Scenario: Kafka to ClickHouse pipeline without deduplication or join
        Given a Kafka topic "test_topic" with 1 partition
        And the ClickHouse table "events_test" on database "default" already exists with schema
            | column_name | data_type |
            | id          | String    |
            | name        | String    |

        And I write these events to Kafka topic "test_topic":
            | key | value                                   |
            | 1   | {"id": "123", "name": "John Doe"}       |
            | 2   | {"id": "123", "name": "Jane Smith"}     |
            | 3   | {"id": "123", "name": "Bob Johnson"}    |
            | 4   | {"id": "123", "name": "Ulm Petterson"}  |
            | 5   | {"id": "567", "name": "Richard Miller"} |

        And a glassflow pipeline with next configuration:
            """json
            {
                "pipeline_id": "kafka-to-clickhouse-pipeline-b00004",
                "name": "kafka-to-clickhouse-pipeline-b00004",
                "ingestor": {
                    "type": "kafka",
                    "kafka_topics": [
                        {
                            "id": "test_topic",
                            "output_stream_id": "gf-test-topic",
                            "output_stream_subject": "gf-test-topic.input",
                            "consumer_group_initial_offset": "earliest",
                            "consumer_group_name": "glassflow-consumer-group-kafka-to-clickhouse-pipeline-b00004",
                            "name": "test_topic",
                            "replicas": 1,
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
                    "source_id": "test_topic",
                    "stream_id": "gf-test-topic",
                    "batch": {
                        "max_batch_size": 1000,
                        "max_delay_time": "1s"
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
        And I shutdown the glassflow pipeline after "4s"
        Then the ClickHouse table "default.events_test" should contain 5 rows
        And the ClickHouse table "default.events_test" should contain:
            | id  | COUNT |
            | 123 | 4     |
            | 567 | 1     |

    Scenario: Insert LowCardinality(String) data type to ClickHouse from Kafka
        Given a Kafka topic "test_measurments" with 1 partition
        And the ClickHouse table "test" on database "default" already exists with schema
            | column_name | data_type              |
            | id          | String                 |
            | measurment  | LowCardinality(String) |

        And I write these events to Kafka topic "test_measurments":
            | key | value                                |
            | 1   | {"id": "123", "measurment": "red"}   |
            | 2   | {"id": "124", "measurment": "blue"}  |
            | 3   | {"id": "125", "measurment": "green"} |

        And a glassflow pipeline with next configuration:
            """json
            {
                "pipeline_id": "kafka-to-clickhouse-pipeline-b00005",
                "name": "kafka-to-clickhouse-pipeline-b00005",
                "ingestor": {
                    "type": "kafka",
                    "kafka_topics": [
                        {
                            "id": "test_measurments",
                            "output_stream_id": "gf-test_measurments",
                            "output_stream_subject": "gf-test_measurments.input",
                            "consumer_group_initial_offset": "earliest",
                            "consumer_group_name": "glassflow-consumer-group-kafka-to-clickhouse-pipeline-b00005",
                            "name": "test_measurments",
                            "replicas": 1,
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
                    "source_id": "test_measurments",
                    "stream_id": "gf-test_measurments",
                    "batch": {
                        "max_batch_size": 1000,
                        "max_delay_time": "1s"
                    },
                    "config": [
                        {
                            "source_field": "id",
                            "source_type": "string",
                            "destination_field": "id",
                            "destination_type": "String"
                        },
                        {
                            "source_field": "measurment",
                            "source_type": "string",
                            "destination_field": "measurment",
                            "destination_type": "String"
                        }
                    ]
                },
                "schema_versions": {
                    "test_measurments": {
                        "source_id": "test_measurments",
                        "version_id": "1",
                        "data_type": "json",
                        "fields": [
                            {
                                "name": "id",
                                "type": "string"
                            },
                            {
                                "name": "measurment",
                                "type": "string"
                            }
                        ]
                    }
                }
            }
            """
        And I shutdown the glassflow pipeline after "4s"

        Then the ClickHouse table "default.test" should contain 3 rows
        And the ClickHouse table "default.test" should contain:
            | id  | measurment | COUNT |
            | 123 | red        | 1     |
            | 124 | blue       | 1     |
            | 125 | green      | 1     |

    Scenario: Kafka topic with 3 partitions to ClickHouse with 3 replicas
        Given a Kafka topic "test_topic" with 3 partitions
        And the ClickHouse table "events_test" on database "default" already exists with schema
            | column_name | data_type |
            | id          | String    |
            | name        | String    |

        And I write these events to Kafka topic "test_topic":
            | partition | key | value                                   |
            | 0         | 1   | {"id": "123", "name": "John Doe"}       |
            | 1         | 2   | {"id": "123", "name": "Jane Smith"}     |
            | 2         | 3   | {"id": "123", "name": "Bob Johnson"}    |
            | 0         | 4   | {"id": "123", "name": "Ulm Petterson"}  |
            | 1         | 5   | {"id": "123", "name": "Richard Miller"} |
            | 2         | 6   | {"id": "890", "name": "Alice Cooper"}   |

        And a glassflow pipeline with next configuration:
            """json
            {
                "pipeline_id": "kafka-to-clickhouse-pipeline-b00006",
                "name": "kafka-to-clickhouse-pipeline-b00006",
                "ingestor": {
                    "type": "kafka",
                    "kafka_topics": [
                        {
                            "id": "test_topic",
                            "output_stream_id": "gf-test_topic",
                            "output_stream_subject": "gf-test_topic.*",
                            "consumer_group_initial_offset": "earliest",
                            "consumer_group_name": "glassflow-consumer-group-kafka-to-clickhouse-pipeline-b00006",
                            "name": "test_topic",
                            "replicas": 3,
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
                    "source_id": "test_topic",
                    "stream_id": "gf-test_topic",
                    "batch": {
                        "max_batch_size": 1000,
                        "max_delay_time": "1s"
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
        And I shutdown the glassflow pipeline after "4s"
        Then the ClickHouse table "default.events_test" should contain 6 rows
        And the ClickHouse table "default.events_test" should contain:
            | id  | COUNT |
            | 123 | 5     |
            | 890 | 1     |

    Scenario: Kafka topic with 3 partitions to ClickHouse with 1 replica
        Given a Kafka topic "test_topic" with 3 partitions
        And the ClickHouse table "events_test" on database "default" already exists with schema
            | column_name | data_type |
            | id          | String    |
            | name        | String    |

        And I write these events to Kafka topic "test_topic":
            | partition | key | value                                   |
            | 0         | 1   | {"id": "123", "name": "John Doe"}       |
            | 1         | 2   | {"id": "123", "name": "Jane Smith"}     |
            | 2         | 3   | {"id": "123", "name": "Bob Johnson"}    |
            | 0         | 4   | {"id": "123", "name": "Ulm Petterson"}  |
            | 1         | 5   | {"id": "123", "name": "Richard Miller"} |
            | 2         | 6   | {"id": "890", "name": "Alice Cooper"}   |

        And a glassflow pipeline with next configuration:
            """json
            {
                "pipeline_id": "kafka-to-clickhouse-pipeline-b00007",
                "name": "kafka-to-clickhouse-pipeline-b00007",
                "ingestor": {
                    "type": "kafka",
                    "kafka_topics": [
                        {
                            "id": "test_topic",
                            "output_stream_id": "gf-test_topic",
                            "output_stream_subject": "gf-test_topic.*",
                            "consumer_group_initial_offset": "earliest",
                            "consumer_group_name": "glassflow-consumer-group-kafka-to-clickhouse-pipeline-b00007",
                            "name": "test_topic",
                            "replicas": 1,
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
                    "source_id": "test_topic",
                    "stream_id": "gf-test_topic",
                    "batch": {
                        "max_batch_size": 1000,
                        "max_delay_time": "1s"
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
        And I shutdown the glassflow pipeline after "4s"
        Then the ClickHouse table "default.events_test" should contain 6 rows
        And the ClickHouse table "default.events_test" should contain:
            | id  | COUNT |
            | 123 | 5     |
            | 890 | 1     |
