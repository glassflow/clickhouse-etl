@sink
Feature: Clickhouse ETL sink

    Background: Run setup before each scenario
        Given a running NATS instance
        And a running ClickHouse instance
        And a stream consumer config with stream "test_stream" and subject "test_subject" and consumer "test_consumer"
        And a running NATS stream "test_stream" with subject "test_subject"
        And a ClickHouse sink config with db "default" and table "events_test"

    Scenario: Successfully import events from NATS to Clickhouse
        Given the ClickHouse table "default.events_test" already exists with schema
            | column_name | data_type |
            | event_id    | String    |
            | name        | String    |
            | email       | String    |
            | timestamp   | DateTime  |
            | action      | String    |
        And a batch config with max size 2
        And a schema config with mapping
            """json
            {
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
                                "field_type": "datetime"
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
            | event_id                               | name            | email                | timestamp                  | action   |
            | "0a21ad20-8a70-4be2-8d29-533eb963d554" | "Jessica Jones" | "msmith@example.com" | 2025-02-21T07:45:48.823069 | "login"  |
            | "72dea57a-ee36-4909-8b36-5be24b19804c" | "Jessica Jones" | "msmith@example.com" | 2025-02-28T02:39:51.886367 | "logout" |
        And I run ClickHouse sink for the 5 seconds
        Then the ClickHouse table "default.events_test" should contain 2 rows

    Scenario: Events from NATS to Clickhouse synced after batch fulfillment
        Given the ClickHouse table "default.events_test" already exists with schema
            | column_name | data_type |
            | event_id    | String    |
            | name        | String    |
            | email       | String    |
            | timestamp   | DateTime  |
            | action      | String    |
        And a batch config with max size 2
        And a schema config with mapping
            """json
            {
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
                                "field_type": "datetime"
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
            | event_id                               | name            | email                | timestamp                  | action  |
            | "0a21ad20-8a70-4be2-8d29-533eb963d554" | "Jessica Jones" | "msmith@example.com" | 2025-02-21T07:45:48.823069 | "login" |
        And I run ClickHouse sink for the 3 seconds
        Then the ClickHouse table "default.events_test" should contain 0 rows
        When I publish 1 events to the stream with data
            | event_id                               | name            | email                | timestamp                  | action   |
            | "72dea57a-ee36-4909-8b36-5be24b19804c" | "Jessica Jones" | "msmith@example.com" | 2025-02-28T02:39:51.886367 | "logout" |
        And I run ClickHouse sink for the 3 seconds
        Then the ClickHouse table "default.events_test" should contain 2 rows

    Scenario: Exports events after JOIN operator
        Given the ClickHouse table "default.events_test" already exists with schema
            | column_name | data_type |
            | id          | String    |
            | name        | String    |
            | email       | String    |
        And a batch config with max size 2
        And a schema config with mapping
            """json
            {
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
        When I publish 2 events to the stream with data
            | left_stream.id | left_stream.name | right_stream.email |
            | 1              | Alice            | alice@mailbox.com  |
            | 2              | Bob              | bob@gmail.com      |
        And I run ClickHouse sink for the 2 seconds
        Then the ClickHouse table "default.events_test" should contain 2 rows

    Scenario: Successfully import events from NATS to Clickhouse by max delay time
        Given the ClickHouse table "default.events_test" already exists with schema
            | column_name | data_type |
            | id          | String    |
            | name        | String    |
        And a batch config with max size 100 and delay 3 seconds
        And a schema config with mapping
            """json
            {
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
            | id | name    |
            | 1  | Alice   |
            | 2  | Bob     |
            | 3  | Charlie |
            | 4  | David   |
        And I run ClickHouse sink for the 5 seconds
        Then the ClickHouse table "default.events_test" should contain 4 rows

