@wip @ingestor
Feature: Kafka Ingestor

    Background: Run before each scenario
        Given the NATS stream config:
            """json
            {
                "stream": "ingestor_stream",
                "subject": "ingestor_subject",
                "consumer": "ingestor_consumer"
            }
            """
        And run the NATS stream

    Scenario: Kafka Ingestor with deduplication
        Given a Kafka topic "test_topic" with 1 partition
        And a schema mapper with config:
            """json
            {
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
                        "column_name": "id",
                        "field_name": "id",
                        "stream_name": "test_topic",
                        "column_type": "string"
                    },
                    {
                        "column_name": "name",
                        "field_name": "name",
                        "stream_name": "test_topic",
                        "column_type": "String"
                    }
                ]
            }
            """
        Given an ingestor operator config:
            """json
            {
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
                        "id": "topic_id",
                        "partitions": 1,
                        "deduplication": {
                            "enabled": true,
                            "id_field": "id",
                            "id_field_type": "string",
                            "time_window": "1h"
                        }
                    }
                ]
            }
            """

        When I write these events to Kafka topic "test_topic":
            | key | value                                  |
            | 1   | {"id": "123", "name": "John Doe"}      |
            | 2   | {"id": "456", "name": "Jane Smith"}    |
            | 3   | {"id": "789", "name": "Bob Johnson"}   |
            | 4   | {"id": "789", "name": "Ulm Petterson"} |

        And a running ingestor operator

        Then I check results with content
            | id  | name        |
            | 123 | John Doe    |
            | 456 | Jane Smith  |
            | 789 | Bob Johnson |

# Scenario: Kafka Ingestor without deduplication
#     Given a Kafka topic "test_topic" with 1 partition
#     And a schema config with mapping:
#         """json
#         {
#             "streams": {
#                 "test_topic": {
#                     "fields": [
#                         {
#                             "field_name": "id",
#                             "field_type": "string"
#                         },
#                         {
#                             "field_name": "name",
#                             "field_type": "string"
#                         }
#                     ]
#                 }
#             },
#             "sink_mapping": [
#                 {
#                     "column_name": "id",
#                     "field_name": "id",
#                     "stream_name": "test_topic",
#                     "column_type": "string"
#                 },
#                 {
#                     "column_name": "name",
#                     "field_name": "name",
#                     "stream_name": "test_topic",
#                     "column_type": "String"
#                 }
#             ]
#         }
#         """
#     And a running ingestor operator with config:
#         """json
#         {
#             "type": "kafka",
#             "kafka_connection_params": {
#                 "brokers": [],
#                 "skip_auth": true,
#                 "protocol": "SASL_PLAINTEXT",
#                 "mechanism": "",
#                 "username": "",
#                 "password": "",
#                 "root_ca": ""
#             },
#             "topic_config": {
#                 "topic_name": "test_topic",
#                 "consumer_group_id": "test_group",
#                 "consumer_group_initial_offset": ""
#             },
#             "output_config": {
#                 "output_stream": "ingestor_stream",
#                 "output_subject": "ingestor_subject"
#             },
#             "deduplication": {
#                 "enabled": false
#             }
#         }
#         """

#     When I write these events to Kafka topic "test_topic":
#         | key | value                                  |
#         | 1   | {"id": "123", "name": "John Doe"}      |
#         | 2   | {"id": "456", "name": "Jane Smith"}    |
#         | 3   | {"id": "789", "name": "Bob Johnson"}   |
#         | 4   | {"id": "789", "name": "Ulm Petterson"} |

#     Then I check results with content
#         | id  | name          |
#         | 123 | John Doe      |
#         | 456 | Jane Smith    |
#         | 789 | Bob Johnson   |
#         | 789 | Ulm Petterson |

# Scenario: Kafka Ingestor with deduplication and multiple partitions
#     Given a Kafka topic "test_topic" with 3 partitions
#     And a schema config with mapping:
#         """json
#         {
#             "streams": {
#                 "test_topic": {
#                     "fields": [
#                         {
#                             "field_name": "id",
#                             "field_type": "string"
#                         },
#                         {
#                             "field_name": "name",
#                             "field_type": "string"
#                         }
#                     ]
#                 }
#             },
#             "sink_mapping": [
#                 {
#                     "column_name": "id",
#                     "field_name": "id",
#                     "stream_name": "test_topic",
#                     "column_type": "string"
#                 },
#                 {
#                     "column_name": "name",
#                     "field_name": "name",
#                     "stream_name": "test_topic",
#                     "column_type": "String"
#                 }
#             ]
#         }
#         """
#     And a running ingestor operator with config:
#         """json
#         {
#             "type": "kafka",
#             "kafka_connection_params": {
#                 "brokers": [],
#                 "skip_auth": true,
#                 "protocol": "SASL_PLAINTEXT",
#                 "mechanism": "",
#                 "username": "",
#                 "password": "",
#                 "root_ca": ""
#             },
#             "topic_config": {
#                 "topic_name": "test_topic",
#                 "consumer_group_id": "test_group",
#                 "consumer_group_initial_offset": ""
#             },
#             "output_config": {
#                 "output_stream": "ingestor_stream",
#                 "output_subject": "ingestor_subject"
#             },
#             "deduplication": {
#                 "enabled": true,
#                 "key_name": "id",
#                 "key_type": "string",
#                 "duration": "1h"
#             }
#         }
#         """

#     When I write these events to Kafka topic:
#         | partition | key | value                                 |
#         | 0         | 1   | {"id": "123", "name":"John Doe"}      |
#         | 1         | 2   | {"id": "456", "name":"Jane Smith"}    |
#         | 2         | 3   | {"id": "789", "name":"Bob Johnson"}   |
#         | 0         | 4   | {"id": "789", "name":"Ulm Petterson"} |

#     Then I check results with content
#         | id  | name        |
#         | 123 | John Doe    |
#         | 456 | Jane Smith  |
#         | 789 | Bob Johnson |

