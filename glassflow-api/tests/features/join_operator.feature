@join
Feature: Join Operator
    Background: Run setup before each scenario
        Given a running NATS instance for operator test

    Scenario: Basic join of 2 streams
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
        And I run join operator with left TTL "2s" right TTL "2s"
        And I stop join operator after "3s"
        Then I check results with content
            | left_stream.id | left_stream.name | right_stream.email | right_stream.id |
            | 2              | Bob              | bob@mailbox.com    | 2               |
            | 1              | Alice            | alice@gmail.com    | 1               |

    Scenario: Join 2 streams with multiple events per same key
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
            | 1  | Charlie |
        And I publish 2 events to the right stream
            | id | email             |
            | 2  | bob@mailbox.com   |
            | 1  | service@gmail.com |
        And I run join operator with left TTL "2s" right TTL "2s"
        And I stop join operator after "3s"
        Then I check results with content
            | left_stream.id | left_stream.name | right_stream.email | right_stream.id |
            | 2              | Bob              | bob@mailbox.com    | 2               |
            | 1              | Alice            | service@gmail.com  | 1               |
            | 1              | Charlie          | service@gmail.com  | 1               |

    Scenario: Join 2 streams with no matching key
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
            | id | name             |
            | 4  | box4@mailbox.com |
            | 5  | box4@mailbox.com |
        And I run join operator with left TTL "2s" right TTL "2s"
        And I stop join operator after "3s"
        Then I check results count is 0

    Scenario: Stop join gracefully
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
        When I publish 7 events to the left stream
            | id | name    |
            | 1  | Alice   |
            | 2  | Bob     |
            | 3  | Charlie |
            | 4  | David   |
            | 5  | Eve     |
            | 6  | Frank   |
            | 7  | Grace   |
        And I publish 2 events to the right stream
            | id | name             |
            | 4  | box4@mailbox.com |
            | 5  | box4@mailbox.com |
        And I run join operator with left TTL "2s" right TTL "2s"
        And I stop join operator gracefully after "0s"
        Then I check results count is 2
