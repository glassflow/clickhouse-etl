@sink
Feature: Clickhouse ETL sink
        Given a running NATS instance
        And a running ClickHouse instance

    Background: Run setup before each scenario
        Given a running NATS stream "test_stream" with subject "test_subject"
        And a ClickHouse client with db "default" and table "events_test"

    Scenario: Successfully import events from NATS to Clickhouse
        Given the ClickHouse table "default.events_test" already exists with schema
            | column_name | data_type |
            | event_id    | String    |
            | name        | String    |
            | email       | String    |
            | timestamp   | DateTime  |
            | action      | String    |
        And a stream consumer with config
            """json
            {
                "stream": "test_stream",
                "subject": "test_subject",
                "consumer": "test_consumer",
                "ack_wait": "1m"
            }
            """
        And a batch config with max size 2
        And a schema config with mapping
            """json
            {
                "type": "jsonToClickhouse",
                "streams": {
                    "default": {
                        "fields": [
                            {
                                "field_name": "event_id",
                                "field_type": "string"
                            },
                            {
                                "field_name": "name",
                                "field_type": "string"
                            },
                            {
                                "field_name": "email",
                                "field_type": "string"
                            },
                            {
                                "field_name": "timestamp",
                                "field_type": "string"
                            },
                            {
                                "field_name": "action",
                                "field_type": "string"
                            }
                        ]
                    }
                },
                "sink_mapping": [
                    {
                        "column_name": "event_id",
                        "field_name": "event_id",
                        "stream_name": "default",
                        "column_type": "UUID"
                    },
                    {
                        "column_name": "name",
                        "field_name": "name",
                        "stream_name": "default",
                        "column_type": "String"
                    },
                    {
                        "column_name": "email",
                        "field_name": "email",
                        "stream_name": "default",
                        "column_type": "String"
                    },
                    {
                        "column_name": "timestamp",
                        "field_name": "timestamp",
                        "stream_name": "default",
                        "column_type": "DateTime"
                    },
                    {
                        "column_name": "action",
                        "field_name": "action",
                        "stream_name": "default",
                        "column_type": "String"
                    }
                ]
            }
            """
        When I publish 2 events to the stream with data
            """json
            [
                {
                    "event_id": "0a21ad20-8a70-4be2-8d29-533eb963d554",
                    "name": "Jessica Jones",
                    "email": "msmith@example.com",
                    "timestamp": "2025-02-21T07:45:48.823069",
                    "action": "login"
                },
                {
                    "event_id": "72dea57a-ee36-4909-8b36-5be24b19804c",
                    "name": "Jessica Jones",
                    "email": "msmith@example.com",
                    "timestamp": "2025-02-28T02:39:51.886367",
                    "action": "logout"
                }
            ]
            """
        And I run ClickHouse sink
        And I gracefully stop ClickHouse sink
        Then the ClickHouse table "default.events_test" should contain 2 rows

    Scenario: Events from NATS to Clickhouse synced after batch fulfillment
        Given the ClickHouse table "default.events_test" already exists with schema
            | column_name | data_type |
            | event_id    | String    |
            | name        | String    |
            | email       | String    |
            | timestamp   | DateTime  |
            | action      | String    |
        And a stream consumer with config
            """json
            {
                "stream": "test_stream",
                "subject": "test_subject",
                "consumer": "test_consumer",
                "ack_wait": "3s"
            }
            """
        And a batch config with max size 2 and delay "3s"
        And a schema config with mapping
            """json
            {
                "type": "jsonToClickhouse",
                "streams": {
                    "default": {
                        "fields": [
                            {
                                "field_name": "event_id",
                                "field_type": "string"
                            },
                            {
                                "field_name": "name",
                                "field_type": "string"
                            },
                            {
                                "field_name": "email",
                                "field_type": "string"
                            },
                            {
                                "field_name": "timestamp",
                                "field_type": "string"
                            },
                            {
                                "field_name": "action",
                                "field_type": "string"
                            }
                        ]
                    }
                },
                "sink_mapping": [
                    {
                        "column_name": "event_id",
                        "field_name": "event_id",
                        "stream_name": "default",
                        "column_type": "UUID"
                    },
                    {
                        "column_name": "name",
                        "field_name": "name",
                        "stream_name": "default",
                        "column_type": "String"
                    },
                    {
                        "column_name": "email",
                        "field_name": "email",
                        "stream_name": "default",
                        "column_type": "String"
                    },
                    {
                        "column_name": "timestamp",
                        "field_name": "timestamp",
                        "stream_name": "default",
                        "column_type": "DateTime"
                    },
                    {
                        "column_name": "action",
                        "field_name": "action",
                        "stream_name": "default",
                        "column_type": "String"
                    }
                ]
            }
            """
        When I publish 1 events to the stream with data
            """json
            [
                {
                    "event_id": "0a21ad20-8a70-4be2-8d29-533eb963d554",
                    "name": "Jessica Jones",
                    "email": "msmith@example.com",
                    "timestamp": "2025-02-21T07:45:48.823069",
                    "action": "login"
                }
            ]
            """
        And I run ClickHouse sink
        And I stop ClickHouse sink after "1s"
        Then the ClickHouse table "default.events_test" should contain 1 rows
        And I run ClickHouse sink
        When I publish 1 events to the stream with data
            """json
            [
                {
                    "event_id": "72dea57a-ee36-4909-8b36-5be24b19804c",
                    "name": "Jessica Jones",
                    "email": "msmith@example.com",
                    "timestamp": "2025-02-28T02:39:51.886367",
                    "action": "logout"
                }
            ]
            """
        And I stop ClickHouse sink after "1s"
        Then the ClickHouse table "default.events_test" should contain 2 rows

    Scenario: Exports events after JOIN component
        Given the ClickHouse table "default.events_test" already exists with schema
            | column_name | data_type |
            | id          | String    |
            | name        | String    |
            | email       | String    |
        And a stream consumer with config
            """json
            {
                "stream": "test_stream",
                "subject": "test_subject",
                "consumer": "test_consumer",
                "ack_wait": "1m"
            }
            """
        And a batch config with max size 2
        And a schema config with mapping
            """json
            {
                "type": "jsonToClickhouse",
                "streams": {
                    "left_stream": {
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
                        "join_key_field": "id"
                    },
                    "right_stream": {
                        "fields": [
                            {
                                "field_name": "id",
                                "field_type": "string"
                            },
                            {
                                "field_name": "email",
                                "field_type": "string"
                            }
                        ],
                        "join_key_field": "id"
                    }
                },
                "sink_mapping": [
                    {
                        "column_name": "id",
                        "field_name": "id",
                        "stream_name": "left_stream",
                        "column_type": "String"
                    },
                    {
                        "column_name": "name",
                        "field_name": "name",
                        "stream_name": "left_stream",
                        "column_type": "String"
                    },
                    {
                        "column_name": "email",
                        "field_name": "email",
                        "stream_name": "right_stream",
                        "column_type": "String"
                    }
                ]
            }
            """
        And I run ClickHouse sink
        When I publish 2 events to the stream with data
            """json
            [
                {
                    "left_stream.id": "1",
                    "left_stream.name": "Alice",
                    "right_stream.email": "alice@mailbox.com"
                },
                {
                    "left_stream.id": "2",
                    "left_stream.name": "Bob",
                    "right_stream.email": "bob@gmail.com"
                }
            ]
            """
        And I gracefully stop ClickHouse sink
        Then the ClickHouse table "default.events_test" should contain 2 rows

    Scenario: Successfully import events from NATS to Clickhouse by max delay time
        Given the ClickHouse table "default.events_test" already exists with schema
            | column_name | data_type |
            | id          | String    |
            | name        | String    |
        And a stream consumer with config
            """json
            {
                "stream": "test_stream",
                "subject": "test_subject",
                "consumer": "test_consumer",
                "ack_wait": "6s"
            }
            """
        And a batch config with max size 100 and delay "3s"
        And a schema config with mapping
            """json
            {
                "type": "jsonToClickhouse",
                "streams": {
                    "default": {
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
                        "stream_name": "default",
                        "column_type": "String"
                    },
                    {
                        "column_name": "name",
                        "field_name": "name",
                        "stream_name": "default",
                        "column_type": "String"
                    }
                ]
            }
            """
        When I publish 4 events to the stream with data
            """json
            [
                {
                    "id": "1",
                    "name": "Alice"
                },
                {
                    "id": "2",
                    "name": "Bob"
                },
                {
                    "id": "3",
                    "name": "Charlie"
                },
                {
                    "id": "4",
                    "name": "David"
                }
            ]
            """
        And I run ClickHouse sink
        And I stop ClickHouse sink after "5s"
        Then the ClickHouse table "default.events_test" should contain 4 rows

    Scenario: Start and graceful sink stop for already existing events in stream
        Given the ClickHouse table "default.events_test" already exists with schema
            | column_name | data_type |
            | id          | String    |
            | name        | String    |
        And a batch config with max size 100 and delay "3s"
        And a schema config with mapping
            """json
            {
                "type": "jsonToClickhouse",
                "streams": {
                    "default": {
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
                        "stream_name": "default",
                        "column_type": "String"
                    },
                    {
                        "column_name": "name",
                        "field_name": "name",
                        "stream_name": "default",
                        "column_type": "String"
                    }
                ]
            }
            """
        When I publish 7 events to the stream with data
            """json
            [
                {
                    "id": "1",
                    "name": "Alice"
                },
                {
                    "id": "2",
                    "name": "Bob"
                },
                {
                    "id": "3",
                    "name": "Charlie"
                },
                {
                    "id": "4",
                    "name": "David"
                },
                {
                    "id": "5",
                    "name": "Eve"
                },
                {
                    "id": "6",
                    "name": "Frank"
                },
                {
                    "id": "7",
                    "name": "Grace"
                }
            ]
            """
        And I run ClickHouse sink
        And I gracefully stop ClickHouse sink
        Then the ClickHouse table "default.events_test" should contain 7 rows

    Scenario: Successfully import events from NATS to Clickhouse by max delay time #2
        Given the ClickHouse table "default.events_test" already exists with schema
            | column_name | data_type |
            | id          | String    |
            | name        | String    |
        And a stream consumer with config
            """json
            {
                "stream": "test_stream",
                "subject": "test_subject",
                "consumer": "test_consumer",
                "ack_wait": "5s"
            }
            """
        And a batch config with max size 5 and delay "6s"
        And a schema config with mapping
            """json
            {
                "type": "jsonToClickhouse",
                "streams": {
                    "default": {
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
                        "stream_name": "default",
                        "column_type": "String"
                    },
                    {
                        "column_name": "name",
                        "field_name": "name",
                        "stream_name": "default",
                        "column_type": "String"
                    }
                ]
            }
            """
        When I publish 9 events to the stream with data
            """json
            [
                {
                    "id": "1",
                    "name": "Alice"
                },
                {
                    "id": "2",
                    "name": "Bob"
                },
                {
                    "id": "3",
                    "name": "Charlie"
                },
                {
                    "id": "4",
                    "name": "David"
                },
                {
                    "id": "5",
                    "name": "Eve"
                },
                {
                    "id": "6",
                    "name": "Frank"
                },
                {
                    "id": "7",
                    "name": "Grace"
                },
                {
                    "id": "8",
                    "name": "Heidi"
                },
                {
                    "id": "9",
                    "name": "Ivan"
                }
            ]
            """
        And I run ClickHouse sink
        And I stop ClickHouse sink after "10s"
        Then the ClickHouse table "default.events_test" should contain 9 rows

    Scenario: Successfully import events from NATS to Clickhouse by max delay time #3
        Given the ClickHouse table "default.events_test" already exists with schema
            | column_name | data_type |
            | id          | String    |
            | name        | String    |
        And a stream consumer with config
            """json
            {
                "stream": "test_stream",
                "subject": "test_subject",
                "consumer": "test_consumer",
                "ack_wait": "3s"
            }
            """
        And a batch config with max size 5 and delay "5s"
        And a schema config with mapping
            """json
            {
                "type": "jsonToClickhouse",
                "streams": {
                    "default": {
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
                        "stream_name": "default",
                        "column_type": "String"
                    },
                    {
                        "column_name": "name",
                        "field_name": "name",
                        "stream_name": "default",
                        "column_type": "String"
                    }
                ]
            }
            """
        When I publish 4 events to the stream with data
            """json
            [
                {
                    "id": "1",
                    "name": "Alice"
                },
                {
                    "id": "2",
                    "name": "Bob"
                },
                {
                    "id": "3",
                    "name": "Charlie"
                },
                {
                    "id": "4",
                    "name": "David"
                }
            ]
            """
        And I run ClickHouse sink
        And I stop ClickHouse sink after "6s"
        Then the ClickHouse table "default.events_test" should contain 4 rows

    Scenario: Import events with UUID
        Given the ClickHouse table "default.events_test" already exists with schema
            | column_name | data_type |
            | id          | UUID      |
            | name        | String    |
        And a stream consumer with config
            """json
            {
                "stream": "test_stream",
                "subject": "test_subject",
                "consumer": "test_consumer",
                "ack_wait": "3s"
            }
            """
        And a batch config with max size 2
        And a schema config with mapping
            """json
            {
                "type": "jsonToClickhouse",
                "streams": {
                    "default": {
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
                        "stream_name": "default",
                        "column_type": "UUID"
                    },
                    {
                        "column_name": "name",
                        "field_name": "name",
                        "stream_name": "default",
                        "column_type": "String"
                    }
                ]
            }
            """
        When I publish 2 events to the stream with data
            """json
            [
                {
                    "id": "0a21ad20-8a70-4be2-8d29-533eb963d554",
                    "name": "Alice"
                },
                {
                    "id": "72dea57a-ee36-4909-8b36-5be24b19804c",
                    "name": "Bob"
                }
            ]
            """
        And I run ClickHouse sink
        And I stop ClickHouse sink after "1s"
        Then the ClickHouse table "default.events_test" should contain 2 rows

    Scenario: Import events with float32
        Given the ClickHouse table "default.events_test" already exists with schema
            | column_name | data_type |
            | id          | Int32     |
            | amount      | Float32   |
        And a stream consumer with config
            """json
            {
                "stream": "test_stream",
                "subject": "test_subject",
                "consumer": "test_consumer",
                "ack_wait": "3s"
            }
            """
        And a batch config with max size 2
        And a schema config with mapping
            """json
            {
                "type": "jsonToClickhouse",
                "streams": {
                    "default": {
                        "fields": [
                            {
                                "field_name": "id",
                                "field_type": "int32"
                            },
                            {
                                "field_name": "amount",
                                "field_type": "float32"
                            }
                        ]
                    }
                },
                "sink_mapping": [
                    {
                        "column_name": "id",
                        "field_name": "id",
                        "stream_name": "default",
                        "column_type": "Int32"
                    },
                    {
                        "column_name": "amount",
                        "field_name": "amount",
                        "stream_name": "default",
                        "column_type": "Float32"
                    }
                ]
            }
            """
        When I publish 2 events to the stream with data
            """json
            [
                {
                    "id": 150,
                    "amount": 3284.85
                },
                {
                    "id": 2067868,
                    "amount": 2.5
                }
            ]
            """
        And I run ClickHouse sink
        And I gracefully stop ClickHouse sink
        Then the ClickHouse table "default.events_test" should contain 2 rows

    Scenario: Import events with low cardinality string
        Given the ClickHouse table "default.events_test" already exists with schema
            | column_name | data_type              |
            | id          | Int32                  |
            | type        | LowCardinality(String) |
        And a stream consumer with config
            """json
            {
                "stream": "test_stream",
                "subject": "test_subject",
                "consumer": "test_consumer",
                "ack_wait": "3s"
            }
            """
        And a batch config with max size 2
        And a schema config with mapping
            """json
            {
                "streams": {
                    "default": {
                        "fields": [
                            {
                                "field_name": "id",
                                "field_type": "int32"
                            },
                            {
                                "field_name": "type",
                                "field_type": "string"
                            }
                        ]
                    }
                },
                "sink_mapping": [
                    {
                        "column_name": "id",
                        "field_name": "id",
                        "stream_name": "default",
                        "column_type": "Int32"
                    },
                    {
                        "column_name": "type",
                        "field_name": "type",
                        "stream_name": "default",
                        "column_type": "LowCardinality(String)"
                    }
                ]
            }
            """
        When I publish 2 events to the stream with data
            """json
            [
                {
                    "id": 150,
                    "amount": "red"
                },
                {
                    "id": 2067868,
                    "amount": "blue"
                }
            ]
            """
        And I run ClickHouse sink
        And I gracefully stop ClickHouse sink
        Then the ClickHouse table "default.events_test" should contain 2 rows
