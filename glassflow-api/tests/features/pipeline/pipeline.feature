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
                "pipeline_id": "6038879f-cd67-5c2c-a261-1f46413838f7",
                "mapper": {
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
                            "stream_name": "test_topic",
                            "field_name": "id",
                            "column_name": "id",
                            "column_type": "String"
                        },
                        {
                            "stream_name": "test_topic",
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
                        "mechanism": "NO_AUTH",
                        "username": "",
                        "password": "",
                        "root_ca": ""
                    },
                    "kafka_topics": [
                        {
                            "name": "test_topic",
                            "consumer_group_initial_offset": "earliest",
                            "consumer_group_name": "glassflow-consumer-group-6038879f-cd67-5c2c-a261-1f46413838f7",
                            "deduplication": {
                                "enabled": true,
                                "id_field": "id",
                                "id_field_type": "string",
                                "time_window": "1h"
                            },
                            "output_stream_id": "gf-c56aeff3-test_topic",
                            "output_stream_subject": "gf-c56aeff3-test_topic.input"
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
                        "max_delay_time": "1s"
                    },
                    "clickhouse_connection_params": {
                        "database": "default",
                        "secure": false,
                        "table": "events_test"
                    },
                    "stream_id": "gf-c56aeff3-test_topic",
                    "nats_consumer_name": "gf-nats-si-c56aeff3"
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
                "pipeline_id": "8e26ed05-1c65-5d95-a286-2201078f95c5",
                "mapper": {
                    "type": "jsonToClickhouse",
                    "streams": {
                        "test_users": {
                            "fields": [
                                {
                                    "field_name": "id",
                                    "field_type": "string"
                                },
                                {
                                    "field_name": "name",
                                    "field_type": "string"
                                }
                            ],
                            "join_key_field": "id",
                            "join_window": "1h",
                            "join_orientation": "right"
                        },
                        "test_emails": {
                            "fields": [
                                {
                                    "field_name": "user_id",
                                    "field_type": "string"
                                },
                                {
                                    "field_name": "email",
                                    "field_type": "string"
                                }
                            ],
                            "join_key_field": "user_id",
                            "join_window": "1h",
                            "join_orientation": "left"
                        }
                    },
                    "sink_mapping": [
                        {
                            "stream_name": "test_users",
                            "field_name": "name",
                            "column_name": "name",
                            "column_type": "String"
                        },
                        {
                            "stream_name": "test_emails",
                            "field_name": "email",
                            "column_name": "email",
                            "column_type": "String"
                        }
                    ]
                },
                "ingestor": {
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
                            "name": "test_emails",
                            "consumer_group_initial_offset": "earliest",
                            "consumer_group_name": "glassflow-consumer-group-8e26ed05-1c65-5d95-a286-2201078f95c5",
                            "deduplication": {
                                "enabled": false
                            },
                            "output_stream_id": "gf-3f151721-test_emails",
                            "output_stream_subject": "gf-3f151721-test_emails.input"
                        },
                        {
                            "name": "test_users",
                            "consumer_group_initial_offset": "earliest",
                            "consumer_group_name": "glassflow-consumer-group-8e26ed05-1c65-5d95-a286-2201078f95c5",
                            "deduplication": {
                                "enabled": false
                            },
                            "output_stream_id": "gf-3f151721-test_users",
                            "output_stream_subject": "gf-3f151721-test_users.input"
                        }
                    ]
                },
                "join": {
                    "enabled": true,
                    "type": "temporal",
                    "sources": [
                        {
                            "source_id": "test_emails",
                            "join_key": "user_id",
                            "time_window": "1h",
                            "orientation": "left",
                            "stream_id": "gf-3f151721-test_emails"
                        },
                        {
                            "source_id": "test_users",
                            "join_key": "id",
                            "time_window": "1h",
                            "orientation": "right",
                            "stream_id": "gf-3f151721-test_users"
                        }
                    ],
                    "output_stream_id": "gf-3f151721-joined",
                    "nats_left_consumer_name": "gf-nats-jl-3f151721",
                    "nats_right_consumer_name": "gf-nats-jr-3f151721"
                },
                "sink": {
                    "type": "clickhouse",
                    "batch": {
                        "max_batch_size": 1000,
                        "max_delay_time": "1s"
                    },
                    "clickhouse_connection_params": {
                        "database": "default",
                        "secure": false,
                        "table": "test_users"
                    },
                    "stream_id": "gf-3f151721-joined",
                    "nats_consumer_name": "gf-nats-si-3f151721"
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
                "pipeline_id": "af354ec4-a349-513a-922a-e2a58cc2b6db",
                "mapper": {
                    "type": "jsonToClickhouse",
                    "streams": {
                        "test_users": {
                            "fields": [
                                {
                                    "field_name": "id",
                                    "field_type": "string"
                                },
                                {
                                    "field_name": "name",
                                    "field_type": "string"
                                }
                            ],
                            "join_key_field": "id",
                            "join_window": "1h",
                            "join_orientation": "right"
                        },
                        "test_emails": {
                            "fields": [
                                {
                                    "field_name": "user_id",
                                    "field_type": "string"
                                },
                                {
                                    "field_name": "email",
                                    "field_type": "string"
                                }
                            ],
                            "join_key_field": "user_id",
                            "join_window": "1h",
                            "join_orientation": "left"
                        }
                    },
                    "sink_mapping": [
                        {
                            "stream_name": "test_users",
                            "field_name": "name",
                            "column_name": "name",
                            "column_type": "String"
                        },
                        {
                            "stream_name": "test_emails",
                            "field_name": "email",
                            "column_name": "email",
                            "column_type": "String"
                        }
                    ]
                },
                "ingestor": {
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
                            "name": "test_emails",
                            "consumer_group_initial_offset": "earliest",
                            "consumer_group_name": "glassflow-consumer-group-af354ec4-a349-513a-922a-e2a58cc2b6db",
                            "deduplication": {
                                "enabled": true,
                                "id_field": "user_id",
                                "id_field_type": "string",
                                "time_window": "1h"
                            },
                            "output_stream_id": "gf-58bcb8e8-test_emails",
                            "output_stream_subject": "gf-58bcb8e8-test_emails.input"
                        },
                        {
                            "name": "test_users",
                            "consumer_group_initial_offset": "earliest",
                            "consumer_group_name": "glassflow-consumer-group-af354ec4-a349-513a-922a-e2a58cc2b6db",
                            "deduplication": {
                                "enabled": true,
                                "id_field": "id",
                                "id_field_type": "string",
                                "time_window": "1h"
                            },
                            "output_stream_id": "gf-58bcb8e8-test_users",
                            "output_stream_subject": "gf-58bcb8e8-test_users.input"
                        }
                    ]
                },
                "join": {
                    "enabled": true,
                    "type": "temporal",
                    "sources": [
                        {
                            "source_id": "test_emails",
                            "join_key": "user_id",
                            "time_window": "1h",
                            "orientation": "left",
                            "stream_id": "gf-58bcb8e8-test_emails"
                        },
                        {
                            "source_id": "test_users",
                            "join_key": "id",
                            "time_window": "1h",
                            "orientation": "right",
                            "stream_id": "gf-58bcb8e8-test_users"
                        }
                    ],
                    "output_stream_id": "gf-58bcb8e8-joined",
                    "nats_left_consumer_name": "gf-nats-jl-58bcb8e8",
                    "nats_right_consumer_name": "gf-nats-jr-58bcb8e8"
                },
                "sink": {
                    "type": "clickhouse",
                    "batch": {
                        "max_batch_size": 1000,
                        "max_delay_time": "1s"
                    },
                    "clickhouse_connection_params": {
                        "database": "default",
                        "secure": false,
                        "table": "test_users"
                    },
                    "stream_id": "gf-58bcb8e8-joined",
                    "nats_consumer_name": "gf-nats-si-58bcb8e8"
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
                "pipeline_id": "9a55db8d-d2e9-55a8-a4e3-4820b124a151",
                "mapper": {
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
                            "stream_name": "test_topic",
                            "field_name": "id",
                            "column_name": "id",
                            "column_type": "String"
                        },
                        {
                            "stream_name": "test_topic",
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
                        "mechanism": "NO_AUTH",
                        "username": "",
                        "password": "",
                        "root_ca": ""
                    },
                    "kafka_topics": [
                        {
                            "name": "test_topic",
                            "consumer_group_initial_offset": "earliest",
                            "consumer_group_name": "glassflow-consumer-group-9a55db8d-d2e9-55a8-a4e3-4820b124a151",
                            "deduplication": {
                                "enabled": false
                            },
                            "output_stream_id": "gf-1ccde4cc-test_topic",
                            "output_stream_subject": "gf-1ccde4cc-test_topic.input"
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
                        "max_delay_time": "1s"
                    },
                    "clickhouse_connection_params": {
                        "database": "default",
                        "secure": false,
                        "table": "events_test"
                    },
                    "stream_id": "gf-1ccde4cc-test_topic",
                    "nats_consumer_name": "gf-nats-si-1ccde4cc"
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
                "pipeline_id": "4e58aa0f-8800-564c-a936-27cf29e8f0fb",
                "mapper": {
                    "type": "jsonToClickhouse",
                    "streams": {
                        "test_measurments": {
                            "fields": [
                                {
                                    "field_name": "id",
                                    "field_type": "string"
                                },
                                {
                                    "field_name": "measurment",
                                    "field_type": "string"
                                }
                            ]
                        }
                    },
                    "sink_mapping": [
                        {
                            "stream_name": "test_measurments",
                            "field_name": "id",
                            "column_name": "id",
                            "column_type": "String"
                        },
                        {
                            "stream_name": "test_measurments",
                            "field_name": "measurment",
                            "column_name": "measurment",
                            "column_type": "String"
                        }
                    ]
                },
                "ingestor": {
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
                            "name": "test_measurments",
                            "consumer_group_initial_offset": "earliest",
                            "consumer_group_name": "glassflow-consumer-group-4e58aa0f-8800-564c-a936-27cf29e8f0fb",
                            "deduplication": {
                                "enabled": true,
                                "id_field": "id",
                                "id_field_type": "string",
                                "time_window": "1h"
                            },
                            "output_stream_id": "gf-1c63761f-test_measurments",
                            "output_stream_subject": "gf-1c63761f-test_measurments.input"
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
                        "max_delay_time": "1s"
                    },
                    "clickhouse_connection_params": {
                        "database": "default",
                        "secure": false,
                        "table": "test"
                    },
                    "stream_id": "gf-1c63761f-test_measurments",
                    "nats_consumer_name": "gf-nats-si-1c63761f"
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
                "pipeline_id": "9c947608-2318-5b6e-99df-e1dc06068e2d",
                "mapper": {
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
                            "stream_name": "test_topic",
                            "field_name": "id",
                            "column_name": "id",
                            "column_type": "String"
                        },
                        {
                            "stream_name": "test_topic",
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
                        "mechanism": "NO_AUTH",
                        "username": "",
                        "password": "",
                        "root_ca": ""
                    },
                    "kafka_topics": [
                        {
                            "name": "test_topic",
                            "consumer_group_initial_offset": "earliest",
                            "consumer_group_name": "glassflow-consumer-group-9c947608-2318-5b6e-99df-e1dc06068e2d",
                            "deduplication": {
                                "enabled": false
                            },
                            "output_stream_id": "gf-bd3e8842-test_topic",
                            "output_stream_subject": "gf-bd3e8842-test_topic.*",
                            "replicas": 3
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
                        "max_delay_time": "1s"
                    },
                    "clickhouse_connection_params": {
                        "database": "default",
                        "secure": false,
                        "table": "events_test"
                    },
                    "stream_id": "gf-bd3e8842-test_topic",
                    "nats_consumer_name": "gf-nats-si-bd3e8842"
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
                "pipeline_id": "d8710de9-c72a-5129-9f4e-dba409e15716",
                "mapper": {
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
                            "stream_name": "test_topic",
                            "field_name": "id",
                            "column_name": "id",
                            "column_type": "String"
                        },
                        {
                            "stream_name": "test_topic",
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
                        "mechanism": "NO_AUTH",
                        "username": "",
                        "password": "",
                        "root_ca": ""
                    },
                    "kafka_topics": [
                        {
                            "name": "test_topic",
                            "consumer_group_initial_offset": "earliest",
                            "consumer_group_name": "glassflow-consumer-group-d8710de9-c72a-5129-9f4e-dba409e15716",
                            "deduplication": {
                                "enabled": false
                            },
                            "output_stream_id": "gf-baeea748-test_topic",
                            "output_stream_subject": "gf-baeea748-test_topic.*",
                            "replicas": 1
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
                        "max_delay_time": "1s"
                    },
                    "clickhouse_connection_params": {
                        "database": "default",
                        "secure": false,
                        "table": "events_test"
                    },
                    "stream_id": "gf-baeea748-test_topic",
                    "nats_consumer_name": "gf-nats-si-baeea748"
                }
            }
            """
        And I shutdown the glassflow pipeline after "4s"
        Then the ClickHouse table "default.events_test" should contain 6 rows
        And the ClickHouse table "default.events_test" should contain:
            | id  | COUNT |
            | 123 | 5     |
            | 890 | 1     |

