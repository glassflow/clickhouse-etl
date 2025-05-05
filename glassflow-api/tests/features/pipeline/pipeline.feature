@pipeline
Feature: Kafka to CH pipeline

    Background: Run setup before each scenario
        Given a Kafka topic "test_topic" with 1 partition
        And a running NATS stream "test_stream" with subject "test_subject"
        And a ClickHouse client with db "default" and table "events_test"

    Scenario: Kafka to ClickHouse pipeline
        # Given a glassflow pipeline with next configuration:
        #     """json
        #     {
        #         "pipeline_id": "kafka-to-clickhouse-pipeline-b00001",
        #         "source": {
        #             "type": "kafka",
        #             "provider": "aiven",
        #             "connection_params": {
        #                 "brokers": [
        #                     "localhost:9093"
        #                 ],
        #             },
        #             "topics": [
        #                 {
        #                     "consumer_group_initial_offset": "earliest",
        #                     "name": "mariam_customers",
        #                     "schema": {
        #                         "type": "json",
        #                         "fields": [
        #                             {
        #                                 "name": "id",
        #                                 "type": "string"
        #                             },
        #                             {
        #                                 "name": "name",
        #                                 "type": "string"
        #                             }
        #                         ]
        #                     },
        #                     "deduplication": {
        #                         "enabled": true,
        #                         "id_field": "id",
        #                         "id_field_type": "string",
        #                         "time_window": "12h"
        #                     }
        #                 }
        #             ]
        #         },
        #         "sink": {
        #             "type": "clickhouse",
        #             "provider": "aiven",
        #             "host": "clickhouse-347ce90c-glassflow-2908.h.aivencloud.com",
        #             "port": "12753",
        #             "database": "default",
        #             "username": "<1pwd>",
        #             "password": "<1pwd>",
        #             "secure": true,
        #             "max_batch_size": 1000,
        #             "max_delay_time": "1s",
        #             "table": "mariam_customers",
        #             "table_mapping": [
        #                 {
        #                     "source_id": "mariam_customers",
        #                     "field_name": "id",
        #                     "column_name": "id",
        #                     "column_type": "UUID"
        #                 },
        #                 {
        #                     "source_id": "mariam_customers",
        #                     "field_name": "name",
        #                     "column_name": "name",
        #                     "column_type": "String"
        #                 }
        #             ]
        #         },
        #         "join": {
        #             "enabled": false
        #         }
        #     }
        #     """
        When I write these events to Kafka topic "test_topic":
            | key | value                                |
            | 1   | {"id": "123", "name": "John Doe"}    |
            | 2   | {"id": "456", "name": "Jane Smith"}  |
            | 3   | {"id": "789", "name": "Bob Johnson"} |