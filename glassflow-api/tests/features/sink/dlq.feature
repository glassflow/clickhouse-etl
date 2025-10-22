@sink
Feature: Clickhouse ETL sink dlq
Given a running NATS instance
And a running ClickHouse instance

  Background: Run setup before each scenario
    Given a running NATS stream "test_stream" with subject "test_subject"
    And a ClickHouse client with db "default" and table "events_test_dlq"

  Scenario: DLQ, publishing 4 messages, 4 should be in dlq, 0 in clickhouse
    Given the ClickHouse table "default.events_test_dlq" already exists with schema
      | column_name | data_type | constraint        |
      | event_id    | String    |                   |
      | name        | String    | length(name) <= 5 |
    And a stream consumer with config
            """json
            {
                "stream": "test_stream",
                "subject": "test_subject",
                "consumer": "test_consumer",
                "ack_wait": "1m"
            }
            """
    And a batch config with max size 4
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
                    }
                ]
            }
            """
    When I publish 4 events to the stream with data
            """json
            [
                {
                    "event_id": "c9e26b3f-b902-4fb4-91fd-87e6d5185a0c",
                    "name": "Joe"
                },
                {
                    "event_id": "123d97da-7e1f-4c81-b87b-23e741aa410a",
                    "name": "Michael"
                },
                {
                    "event_id": "5e76cfe8-3432-464b-9d85-272287df22e7",
                    "name": "Frank"
                },
                {
                    "event_id": "5e76cfe8-3432-464b-9d85-272287df22e7",
                    "name": "Elizabeth"
                }
            ]
            """
    And I run ClickHouse sink
    And Wait until all messages are processed
    And I gracefully stop ClickHouse sink
    Then the ClickHouse table "default.events_test_dlq" should contain 0 rows
    Then dlq should contain 4 events
