@join
Feature: Join Operator

    Scenario: Successfully join 2 streams
        Given a running NATS instance for operator test
        And a left stream consumer config "left_stream" and subject "left_subject" and consumer "left_consumer"
        And a running left stream
        And a right stream consumer config "right_stream" and subject "right_subject" and consumer "right_consumer"
        And a running right stream
        And a results consumer config "results_stream" and subject "results_subject" and consumer "results_consumer"
        And a running results stream
        And an operator schema config with mapping
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
        When I publish 3 events to the left stream
            | id | name    |
            | 1  | Alice   |
            | 2  | Bob     |
            | 3  | Charlie |
        And I publish 2 events to the right stream
            | id | email           |
            | 2  | bob@mailbox.com |
            | 1  | alice@gmail.com |
        And I run join operator with left TTL "2s" right TTL "2s" for "3s"
        Then I check results count is 2

