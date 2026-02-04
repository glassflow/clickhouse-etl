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
        Given a join pipeline with configuration
            """json
            {
                "pipeline_id": "join-test-basic",
                "name": "join-test-basic",
                "source": {
                    "type": "kafka",
                    "topics": []
                },
                "join": {
                    "enabled": true,
                    "type": "temporal",
                    "id": "join-1",
                    "sources": [
                        {
                            "source_id": "left_stream",
                            "join_key": "id",
                            "time_window": "2s",
                            "orientation": "left"
                        },
                        {
                            "source_id": "right_stream",
                            "join_key": "id",
                            "time_window": "2s",
                            "orientation": "right"
                        }
                    ],
                    "config": [
                        {
                            "source_id": "left_stream",
                            "source_name": "id",
                            "output_name": "id"
                        },
                        {
                            "source_id": "left_stream",
                            "source_name": "name",
                            "output_name": "name"
                        },
                        {
                            "source_id": "right_stream",
                            "source_name": "email",
                            "output_name": "email"
                        }
                    ]
                },
                "schema_versions": {
                    "left_stream": {
                        "source_id": "left_stream",
                        "version_id": "1",
                        "data_type": "json",
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
                    "right_stream": {
                        "source_id": "right_stream",
                        "version_id": "1",
                        "data_type": "json",
                        "fields": [
                            {
                                "name": "id",
                                "type": "string"
                            },
                            {
                                "name": "email",
                                "type": "string"
                            }
                        ]
                    },
                    "join-1": {
                        "source_id": "join-1",
                        "version_id": "1",
                        "data_type": "json",
                        "fields": [
                            {
                                "name": "id",
                                "type": "string"
                            },
                            {
                                "name": "name",
                                "type": "string"
                            },
                            {
                                "name": "email",
                                "type": "string"
                            }
                        ]
                    }
                },
                "sink": {
                    "type": "clickhouse",
                    "source_id": "join-1"
                }
            }
            """
        When I publish 3 events to the left stream
            | id | name    | NATS-Schema-Version-Id |
            | 1  | Alice   | 1                      |
            | 2  | Bob     | 1                      |
            | 3  | Charlie | 1                      |
        And I publish 2 events to the right stream
            | id | email           | NATS-Schema-Version-Id |
            | 2  | bob@mailbox.com | 1                      |
            | 1  | alice@gmail.com | 1                      |
        And I run join component with left TTL "2s" right TTL "2s"
        And I stop join component after "3s"
        Then I check results with content
            | id | name  | email           |
            | 2  | Bob   | bob@mailbox.com |
            | 1  | Alice | alice@gmail.com |

    Scenario: Join 2 streams with multiple events per same key
        Given a join pipeline with configuration
            """json
            {
                "pipeline_id": "join-test-multiple",
                "name": "join-test-multiple",
                "source": {
                    "type": "kafka",
                    "topics": []
                },
                "join": {
                    "enabled": true,
                    "type": "temporal",
                    "id": "join-1",
                    "sources": [
                        {
                            "source_id": "left_stream",
                            "join_key": "id",
                            "time_window": "2s",
                            "orientation": "left"
                        },
                        {
                            "source_id": "right_stream",
                            "join_key": "id",
                            "time_window": "2s",
                            "orientation": "right"
                        }
                    ],
                    "config": [
                        {
                            "source_id": "left_stream",
                            "source_name": "id",
                            "output_name": "id"
                        },
                        {
                            "source_id": "left_stream",
                            "source_name": "name",
                            "output_name": "name"
                        },
                        {
                            "source_id": "right_stream",
                            "source_name": "email",
                            "output_name": "email"
                        }
                    ]
                },
                "schema_versions": {
                    "left_stream": {
                        "source_id": "left_stream",
                        "version_id": "1",
                        "data_type": "json",
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
                    "right_stream": {
                        "source_id": "right_stream",
                        "version_id": "1",
                        "data_type": "json",
                        "fields": [
                            {
                                "name": "id",
                                "type": "string"
                            },
                            {
                                "name": "email",
                                "type": "string"
                            }
                        ]
                    },
                    "join-1": {
                        "source_id": "join-1",
                        "version_id": "5",
                        "data_type": "json",
                        "fields": [
                            {
                                "name": "id",
                                "type": "string"
                            },
                            {
                                "name": "name",
                                "type": "string"
                            },
                            {
                                "name": "email",
                                "type": "string"
                            }
                        ]
                    }
                },
                "sink": {
                    "type": "clickhouse",
                    "source_id": "join-1"
                }
            }
            """
        When I publish 3 events to the left stream
            | id | name    | NATS-Schema-Version-Id |
            | 1  | Alice   | 1                      |
            | 2  | Bob     | 1                      |
            | 1  | Charlie | 1                      |
        And I publish 2 events to the right stream
            | id | email             | NATS-Schema-Version-Id |
            | 2  | bob@mailbox.com   | 1                      |
            | 1  | service@gmail.com | 1                      |
        And I run join component with left TTL "2s" right TTL "2s"
        And I stop join component after "3s"
        Then I check results with content
            | id | name    | email             | NATS-Schema-Version-Id |
            | 2  | Bob     | bob@mailbox.com   | 5                      |
            | 1  | Alice   | service@gmail.com | 5                      |
            | 1  | Charlie | service@gmail.com | 5                      |

    Scenario: Join 2 streams with no matching key
        Given a join pipeline with configuration
            """json
            {
                "pipeline_id": "join-test-nomatch",
                "name": "join-test-nomatch",
                "source": {
                    "type": "kafka",
                    "topics": []
                },
                "join": {
                    "enabled": true,
                    "type": "temporal",
                    "id": "join-1",
                    "sources": [
                        {
                            "source_id": "left_stream",
                            "join_key": "id",
                            "time_window": "2s",
                            "orientation": "left"
                        },
                        {
                            "source_id": "right_stream",
                            "join_key": "id",
                            "time_window": "2s",
                            "orientation": "right"
                        }
                    ],
                    "config": [
                        {
                            "source_id": "left_stream",
                            "source_name": "id",
                            "output_name": "id"
                        },
                        {
                            "source_id": "left_stream",
                            "source_name": "name",
                            "output_name": "name"
                        },
                        {
                            "source_id": "right_stream",
                            "source_name": "email",
                            "output_name": "email"
                        }
                    ]
                },
                "schema_versions": {
                    "left_stream": {
                        "source_id": "left_stream",
                        "version_id": "1",
                        "data_type": "json",
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
                    "right_stream": {
                        "source_id": "right_stream",
                        "version_id": "1",
                        "data_type": "json",
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
                    "join-1": {
                        "source_id": "join-1",
                        "version_id": "1",
                        "data_type": "json",
                        "fields": [
                            {
                                "name": "id",
                                "type": "string"
                            },
                            {
                                "name": "name",
                                "type": "string"
                            },
                            {
                                "name": "email",
                                "type": "string"
                            }
                        ]
                    }
                },
                "sink": {
                    "type": "clickhouse",
                    "source_id": "join-1"
                }
            }
            """
        When I publish 3 events to the left stream
            | id | name    | NATS-Schema-Version-Id |
            | 1  | Alice   | 1                      |
            | 2  | Bob     | 1                      |
            | 1  | Charlie | 1                      |
        And I publish 2 events to the right stream
            | id | email             | NATS-Schema-Version-Id |
            | 3  | david@mailbox.com | 1                      |
            | 4  | dnc@gmail.com     | 1                      |
        And I run join component with left TTL "2s" right TTL "2s"
        And I stop join component after "3s"
        Then I check results count is 0

    Scenario: Stop join gracefully
        Given a join pipeline with configuration
            """json
            {
                "pipeline_id": "join-test-graceful",
                "name": "join-test-graceful",
                "source": {
                    "type": "kafka",
                    "topics": []
                },
                "join": {
                    "enabled": true,
                    "type": "temporal",
                    "id": "join-1",
                    "sources": [
                        {
                            "source_id": "left_stream",
                            "join_key": "id",
                            "time_window": "2s",
                            "orientation": "left"
                        },
                        {
                            "source_id": "right_stream",
                            "join_key": "id",
                            "time_window": "2s",
                            "orientation": "right"
                        }
                    ],
                    "config": [
                        {
                            "source_id": "left_stream",
                            "source_name": "id",
                            "output_name": "id"
                        },
                        {
                            "source_id": "left_stream",
                            "source_name": "name",
                            "output_name": "name"
                        },
                        {
                            "source_id": "right_stream",
                            "source_name": "email",
                            "output_name": "email"
                        }
                    ]
                },
                "schema_versions": {
                    "left_stream": {
                        "source_id": "left_stream",
                        "version_id": "1",
                        "data_type": "json",
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
                    "right_stream": {
                        "source_id": "right_stream",
                        "version_id": "1",
                        "data_type": "json",
                        "fields": [
                            {
                                "name": "id",
                                "type": "string"
                            },
                            {
                                "name": "email",
                                "type": "string"
                            }
                        ]
                    },
                    "join-1": {
                        "source_id": "join-1",
                        "version_id": "1",
                        "data_type": "json",
                        "fields": [
                            {
                                "name": "id",
                                "type": "string"
                            },
                            {
                                "name": "name",
                                "type": "string"
                            },
                            {
                                "name": "email",
                                "type": "string"
                            }
                        ]
                    }
                },
                "sink": {
                    "type": "clickhouse",
                    "source_id": "join-1"
                }
            }
            """
        When I publish 7 events to the left stream
            | id | name    | NATS-Schema-Version-Id |
            | 1  | Alice   | 1                      |
            | 2  | Bob     | 1                      |
            | 3  | Charlie | 1                      |
            | 4  | David   | 1                      |
            | 5  | Eve     | 1                      |
            | 6  | Frank   | 1                      |
            | 7  | Grace   | 1                      |
        And I publish 2 events to the right stream
            | id | email            | NATS-Schema-Version-Id |
            | 4  | box4@mailbox.com | 1                      |
            | 5  | box4@mailbox.com | 1                      |
        And I run join component with left TTL "2s" right TTL "2s"
        And I gracefully stop join component after "0s"
        Then I check results count is 2
