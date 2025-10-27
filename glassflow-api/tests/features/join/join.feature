@join
Feature: Join component

    Background: Run setup before each join scenario
        # Given a consumer config for the "left" stream "left_stream" and subject "left_subject" and consumer "left_consumer"
        Given a "left" stream consumer with config
            """json
            {
                "stream": "left_stream",
                "subject": "left_subject",
                "consumer": "left_consumer"
            }
            """
        And a running "left" stream
        And a "right" stream consumer with config
            """json
            {
                "stream": "right_stream",
                "subject": "right_subject",
                "consumer": "right_consumer"
            }
            """
        And a running "right" stream
        And a "results" stream consumer with config
            """json
            {
                "stream": "results_stream",
                "subject": "results_subject",
                "consumer": "results_consumer"
            }
            """
        And a running "results" stream

    Scenario: Basic join of 2 streams
        Given an component schema config with mapping
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
        When I publish 3 events to the left stream
            | id | name    |
            | 1  | Alice   |
            | 2  | Bob     |
            | 3  | Charlie |
        And I publish 2 events to the right stream
            | id | email           |
            | 2  | bob@mailbox.com |
            | 1  | alice@gmail.com |
        And I run join component with left TTL "2s" right TTL "2s"
        And I gracefully stop join component after "0s"
        Then I check results with content
            | left_stream.id | left_stream.name | right_stream.email | right_stream.id |
            | 2              | Bob              | bob@mailbox.com    | 2               |
            | 1              | Alice            | alice@gmail.com    | 1               |

    Scenario: Join 2 streams with multiple events per same key
        Given an component schema config with mapping
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
        When I publish 3 events to the left stream
            | id | name    |
            | 1  | Alice   |
            | 2  | Bob     |
            | 1  | Charlie |
        And I publish 2 events to the right stream
            | id | email             |
            | 2  | bob@mailbox.com   |
            | 1  | service@gmail.com |
        And I run join component with left TTL "2s" right TTL "2s"
        And I gracefully stop join component after "0s"
        Then I check results with content
            | left_stream.id | left_stream.name | right_stream.email | right_stream.id |
            | 2              | Bob              | bob@mailbox.com    | 2               |
            | 1              | Alice            | service@gmail.com  | 1               |
            | 1              | Charlie          | service@gmail.com  | 1               |

    Scenario: Join 2 streams with no matching key
        Given an component schema config with mapping
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
        When I publish 3 events to the left stream
            | id | name    |
            | 1  | Alice   |
            | 2  | Bob     |
            | 3  | Charlie |
        And I publish 2 events to the right stream
            | id | name             |
            | 4  | box4@mailbox.com |
            | 5  | box4@mailbox.com |
        And I run join component with left TTL "2s" right TTL "2s"
        And I gracefully stop join component after "0s"
        Then I check results count is 0

    Scenario: Stop join gracefully
        Given an component schema config with mapping
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
        And I run join component with left TTL "2s" right TTL "2s"
        And I gracefully stop join component after "0s"
        Then I check results count is 2
