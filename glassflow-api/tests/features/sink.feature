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
                "fields": {
                    "event_id": "string",
                    "name": "string",
                    "email": "string",
                    "timestamp": "datetime",
                    "action": "string"
                },
                "primary_key_field": "event_id",
                "clickhouse_mapping": [
                    {
                        "column_name": "event_id",
                        "field_name": "event_id",
                        "column_type": "UUID"
                    },
                    {
                        "column_name": "name",
                        "field_name": "name",
                        "column_type": "String"
                    },
                    {
                        "column_name": "email",
                        "field_name": "email",
                        "column_type": "String"
                    },
                    {
                        "column_name": "timestamp",
                        "field_name": "timestamp",
                        "column_type": "DateTime"
                    },
                    {
                        "column_name": "action",
                        "field_name": "action",
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
                "fields": {
                    "event_id": "string",
                    "name": "string",
                    "email": "string",
                    "timestamp": "datetime",
                    "action": "string"
                },
                "primary_key_field": "event_id",
                "clickhouse_mapping": [
                    {
                        "column_name": "event_id",
                        "field_name": "event_id",
                        "column_type": "UUID"
                    },
                    {
                        "column_name": "name",
                        "field_name": "name",
                        "column_type": "String"
                    },
                    {
                        "column_name": "email",
                        "field_name": "email",
                        "column_type": "String"
                    },
                    {
                        "column_name": "timestamp",
                        "field_name": "timestamp",
                        "column_type": "DateTime"
                    },
                    {
                        "column_name": "action",
                        "field_name": "action",
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
