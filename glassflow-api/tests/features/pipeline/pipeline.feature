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
                            "consumer_group_initial_offset": "earliest",
                            "consumer_group_name": "glassflow-consumer-group-kafka-to-clickhouse-pipeline-b00001",
                            "deduplication": {
                                "enabled": true,
                                "id_field": "id",
                                "id_field_type": "string",
                                "time_window": "1h"
                            },
                            "output_stream_id": "gf-3e00534f-test_topic",
                            "output_stream_subject": "gf-3e00534f-test_topic.input"
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
                    "stream_id": "gf-3e00534f-test_topic"
                }
            }
            """
        And I shutdown the glassflow pipeline after "1s"

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
                        "skip_auth": true,
                        "protocol": "SASL_PLAINTEXT",
                        "mechanism": "",
                        "username": "",
                        "password": "",
                        "root_ca": ""
                    },
                    "kafka_topics": [
                        {
                            "name": "test_emails",
                            "consumer_group_initial_offset": "earliest",
                            "consumer_group_name": "glassflow-consumer-group-kafka-to-clickhouse-pipeline-b00002",
                            "deduplication": {
                                "enabled": false
                            },
                            "output_stream_id": "gf-609e6e0a-test_emails",
                            "output_stream_subject": "gf-609e6e0a-test_emails.input"
                        },
                        {
                            "name": "test_users",
                            "consumer_group_initial_offset": "earliest",
                            "consumer_group_name": "glassflow-consumer-group-kafka-to-clickhouse-pipeline-b00002",
                            "deduplication": {
                                "enabled": false
                            },
                            "output_stream_id": "gf-609e6e0a-test_users",
                            "output_stream_subject": "gf-609e6e0a-test_users.input"
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
                            "stream_id": "gf-609e6e0a-test_emails"
                        },
                        {
                            "source_id": "test_users",
                            "join_key": "id",
                            "time_window": "1h",
                            "orientation": "right",
                            "stream_id": "gf-609e6e0a-test_users"
                        }
                    ],
                    "output_stream_id": "gf-609e6e0a-joined"
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
                    "stream_id": "gf-609e6e0a-joined"
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

        And I shutdown the glassflow pipeline after "2s"
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
                        "skip_auth": true,
                        "protocol": "SASL_PLAINTEXT",
                        "mechanism": "",
                        "username": "",
                        "password": "",
                        "root_ca": ""
                    },
                    "kafka_topics": [
                        {
                            "name": "test_emails",
                            "consumer_group_initial_offset": "earliest",
                            "consumer_group_name": "glassflow-consumer-group-kafka-to-clickhouse-pipeline-b00003",
                            "deduplication": {
                                "enabled": true,
                                "id_field": "user_id",
                                "id_field_type": "string",
                                "time_window": "1h"
                            },
                            "output_stream_id": "gf-a75779b0-test_emails",
                            "output_stream_subject": "gf-a75779b0-test_emails.input"
                        },
                        {
                            "name": "test_users",
                            "consumer_group_initial_offset": "earliest",
                            "consumer_group_name": "glassflow-consumer-group-kafka-to-clickhouse-pipeline-b00003",
                            "deduplication": {
                                "enabled": true,
                                "id_field": "id",
                                "id_field_type": "string",
                                "time_window": "1h"
                            },
                            "output_stream_id": "gf-a75779b0-test_users",
                            "output_stream_subject": "gf-a75779b0-test_users.input"
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
                            "stream_id": "gf-a75779b0-test_emails"
                        },
                        {
                            "source_id": "test_users",
                            "join_key": "id",
                            "time_window": "1h",
                            "orientation": "right",
                            "stream_id": "gf-a75779b0-test_users"
                        }
                    ],
                    "output_stream_id": "gf-a75779b0-joined"
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
                    "stream_id": "gf-a75779b0-joined"
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

        And I shutdown the glassflow pipeline after "2s"
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
                            "consumer_group_initial_offset": "earliest",
                            "consumer_group_name": "glassflow-consumer-group-kafka-to-clickhouse-pipeline-b00004",
                            "deduplication": {
                                "enabled": false
                            },
                            "output_stream_id": "gf-13bea286-test_topic",
                            "output_stream_subject": "gf-13bea286-test_topic.input"
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
                    "stream_id": "gf-13bea286-test_topic"
                }
            }
            """
        And I shutdown the glassflow pipeline after "1s"
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
                        "skip_auth": true,
                        "protocol": "SASL_PLAINTEXT",
                        "mechanism": "",
                        "username": "",
                        "password": "",
                        "root_ca": ""
                    },
                    "kafka_topics": [
                        {
                            "name": "test_measurments",
                            "consumer_group_initial_offset": "earliest",
                            "consumer_group_name": "glassflow-consumer-group-kafka-to-clickhouse-pipeline-b00005",
                            "deduplication": {
                                "enabled": true,
                                "id_field": "id",
                                "id_field_type": "string",
                                "time_window": "1h"
                            },
                            "output_stream_id": "gf-29bfc94d-test_measurments",
                            "output_stream_subject": "gf-29bfc94d-test_measurments.input"
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
                    "stream_id": "gf-29bfc94d-test_measurments"
                }
            }
            """
        And I shutdown the glassflow pipeline after "1s"

        Then the ClickHouse table "default.test" should contain 3 rows
        And the ClickHouse table "default.test" should contain:
            | id  | measurment | COUNT |
            | 123 | red        | 1     |
            | 124 | blue       | 1     |
            | 125 | green      | 1     |
