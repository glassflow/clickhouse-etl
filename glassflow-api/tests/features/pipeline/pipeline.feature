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
                "source": {
                    "type": "kafka",
                    "connection_params": {
                        "brokers": [],
                        "skip_auth": true,
                        "protocol": "SASL_PLAINTEXT",
                        "mechanism": "",
                        "username": "",
                        "password": "",
                        "root_ca": ""
                    },
                    "topics": [
                        {
                            "consumer_group_initial_offset": "earliest",
                            "name": "test_topic",
                            "schema": {
                                "type": "json",
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
                    "database": "default",
                    "secure": false,
                    "max_batch_size": 1000,
                    "max_delay_time": "1s",
                    "table": "events_test",
                    "table_mapping": [
                        {
                            "source_id": "test_topic",
                            "field_name": "id",
                            "column_name": "id",
                            "column_type": "String"
                        },
                        {
                            "source_id": "test_topic",
                            "field_name": "name",
                            "column_name": "name",
                            "column_type": "String"
                        }
                    ]
                },
                "join": {
                    "enabled": false
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
                "pipeline_id": "kafka-to-clickhouse-pipeline-b00001",
                "source": {
                    "type": "kafka",
                    "connection_params": {
                        "brokers": [],
                        "skip_auth": true,
                        "protocol": "SASL_PLAINTEXT",
                        "mechanism": "",
                        "username": "",
                        "password": "",
                        "root_ca": ""
                    },
                    "topics": [
                        {
                            "consumer_group_initial_offset": "earliest",
                            "name": "test_emails",
                            "schema": {
                                "type": "json",
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
                            "deduplication": {
                                "enabled": false
                            }
                        },
                        {
                            "consumer_group_initial_offset": "earliest",
                            "name": "test_users",
                            "schema": {
                                "type": "json",
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
                            "deduplication": {
                                "enabled": false
                            }
                        }
                    ]
                },
                "sink": {
                    "type": "clickhouse",
                    "database": "default",
                    "secure": false,
                    "max_batch_size": 1000,
                    "max_delay_time": "1s",
                    "table": "test_users",
                    "table_mapping": [
                        {
                            "source_id": "test_users",
                            "field_name": "name",
                            "column_name": "name",
                            "column_type": "String"
                        },
                        {
                            "source_id": "test_emails",
                            "field_name": "email",
                            "column_name": "email",
                            "column_type": "String"
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
                            "orientation": "left"
                        },
                        {
                            "source_id": "test_users",
                            "join_key": "id",
                            "time_window": "1h",
                            "orientation": "right"
                        }
                    ]
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

        And I shutdown the glassflow pipeline after "1s"
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
                "pipeline_id": "kafka-to-clickhouse-pipeline-b00001",
                "source": {
                    "type": "kafka",
                    "connection_params": {
                        "brokers": [],
                        "skip_auth": true,
                        "protocol": "SASL_PLAINTEXT",
                        "mechanism": "",
                        "username": "",
                        "password": "",
                        "root_ca": ""
                    },
                    "topics": [
                        {
                            "consumer_group_initial_offset": "earliest",
                            "name": "test_emails",
                            "schema": {
                                "type": "json",
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
                            "deduplication": {
                                "enabled": true,
                                "id_field": "user_id",
                                "id_field_type": "string",
                                "time_window": "1h"
                            }
                        },
                        {
                            "consumer_group_initial_offset": "earliest",
                            "name": "test_users",
                            "schema": {
                                "type": "json",
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
                            "deduplication": {
                                "enabled": false
                            }
                        }
                    ]
                },
                "sink": {
                    "type": "clickhouse",
                    "database": "default",
                    "secure": false,
                    "max_batch_size": 1000,
                    "max_delay_time": "1s",
                    "table": "test_users",
                    "table_mapping": [
                        {
                            "source_id": "test_users",
                            "field_name": "name",
                            "column_name": "name",
                            "column_type": "String"
                        },
                        {
                            "source_id": "test_emails",
                            "field_name": "email",
                            "column_name": "email",
                            "column_type": "String"
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
                            "orientation": "left"
                        },
                        {
                            "source_id": "test_users",
                            "join_key": "id",
                            "time_window": "1h",
                            "orientation": "right"
                        }
                    ]
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

        And I shutdown the glassflow pipeline after "1s"
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
                "pipeline_id": "kafka-to-clickhouse-pipeline-b00001",
                "source": {
                    "type": "kafka",
                    "connection_params": {
                        "brokers": [],
                        "skip_auth": true,
                        "protocol": "SASL_PLAINTEXT",
                        "mechanism": "",
                        "username": "",
                        "password": "",
                        "root_ca": ""
                    },
                    "topics": [
                        {
                            "consumer_group_initial_offset": "earliest",
                            "name": "test_topic",
                            "schema": {
                                "type": "json",
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
                            "deduplication": {
                                "enabled": false
                            }
                        }
                    ]
                },
                "sink": {
                    "type": "clickhouse",
                    "database": "default",
                    "secure": false,
                    "max_batch_size": 1000,
                    "max_delay_time": "1s",
                    "table": "events_test",
                    "table_mapping": [
                        {
                            "source_id": "test_topic",
                            "field_name": "id",
                            "column_name": "id",
                            "column_type": "String"
                        },
                        {
                            "source_id": "test_topic",
                            "field_name": "name",
                            "column_name": "name",
                            "column_type": "String"
                        }
                    ]
                },
                "join": {
                    "enabled": false
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
        Given a Kafka topic "test" with 1 partition
        And the ClickHouse table "test" on database "default" already exists with schema
            | column_name | data_type              |
            | id          | String                 |
            | measurment  | LowCardinality(String) |

        And I write these events to Kafka topic "test_topic":
            | key | value                                |
            | 1   | {"id": "123", "measurment": "red"}   |
            | 2   | {"id": "124", "measurment": "blue"}  |
            | 3   | {"id": "125", "measurment": "green"} |

        And a glassflow pipeline with next configuration:
            """json
            {
                "pipeline_id": "kafka-to-clickhouse-pipeline-b00001",
                "source": {
                    "type": "kafka",
                    "connection_params": {
                        "brokers": [],
                        "skip_auth": true,
                        "protocol": "SASL_PLAINTEXT",
                        "mechanism": "",
                        "username": "",
                        "password": "",
                        "root_ca": ""
                    },
                    "topics": [
                        {
                            "consumer_group_initial_offset": "earliest",
                            "name": "test_topic",
                            "schema": {
                                "type": "json",
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
                            },
                            "deduplication": {
                                "enabled": false
                            }
                        }
                    ]
                },
                "sink": {
                    "type": "clickhouse",
                    "database": "default",
                    "secure": false,
                    "max_batch_size": 1000,
                    "max_delay_time": "1s",
                    "table": "test",
                    "table_mapping": [
                        {
                            "source_id": "test_topic",
                            "field_name": "id",
                            "column_name": "id",
                            "column_type": "String"
                        },
                        {
                            "source_id": "test_topic",
                            "field_name": "measurment",
                            "column_name": "measurment",
                            "column_type": "LowCardinality(String)"
                        }
                    ]
                },
                "join": {
                    "enabled": false
                }
            }
            """
        And I shutdown the glassflow pipeline after "5s"

        Then the ClickHouse table "default.test" should contain:
            | id  | measurment | COUNT |
            | 123 | red        | 1     |
            | 124 | blue       | 1     |
            | 125 | green      | 1     |
