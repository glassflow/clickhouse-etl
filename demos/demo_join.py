import argparse
import time
import json
import uuid
from typing import Dict, Any
import glassgen
from glassflow_clickhouse_etl.models import TopicConfig, KafkaConnectionParams
from rich.console import Console
import itertools
import utils


console = Console()


class JoinEventSchema(glassgen.ConfigSchema):
    def __init__(self, schema_dict: dict, join_key: str, list_of_keys: list, **kwargs):
        fields = self._schema_dict_to_fields(schema_dict)
        super().__init__(fields=fields, **kwargs)
        self.validate()
        self._join_key = join_key
        self._join_key_select = itertools.cycle(list_of_keys)

    @property
    def join_key_select(self) -> itertools.cycle:
        return self._join_key_select

    @property
    def join_key(self) -> str:
        return self._join_key

    def _generate_record(self) -> Dict[str, Any]:
        """Generate a single record based on the schema"""
        record = super()._generate_record()
        record[self._join_key] = next(self.join_key_select)
        return record


def generate_events(
    source_connection_params: KafkaConnectionParams,
    topic_config: TopicConfig,
    generator_schema: str,
    duplication_rate: float,
    join_key: str,
    list_of_keys: list,
    num_records: int,
    rps: int,
):
    """Generate events with duplicates

    Args:
        source_connection_params (KafkaConnectionParams): Source connection parameters
        topic_config (TopicConfig): Topic configuration
        provider (str): Kafka provider
        duplication_rate (float, optional): Duplication rate. Defaults to 0.01.
        num_records (int, optional): Number of records to generate. Defaults to 10000.
        rps (int, optional): Records per second. Defaults to 1000.
        generator_schema (str, optional): Path to generator schema.
    """
    glassgen_config = {
        "generator": {
            "num_records": num_records,
            "rps": rps,
        }
    }

    if topic_config.deduplication.enabled:
        duplication_config = {
            "duplication": {
                "enabled": True,
                "ratio": duplication_rate,
                "key_field": topic_config.deduplication.id_field,
                "time_window": topic_config.deduplication.time_window,
            }
        }
    else:
        duplication_config = {"duplication": None}
    glassgen_config["generator"]["event_options"] = duplication_config

    if source_connection_params.brokers[0] == "kafka:9092":
        brokers = ["localhost:9092"]
    else:
        brokers = source_connection_params.brokers

    schema = JoinEventSchema(
        schema_dict=json.load(open(generator_schema)),
        join_key=join_key,
        list_of_keys=list_of_keys,
    )

    glassgen_config["sink"] = {
        "type": "kafka",
        "params": {"bootstrap.servers": ",".join(brokers), "topic": topic_config.name},
    }
    glassgen_resp = glassgen.generate(config=glassgen_config, schema=schema)
    return glassgen_resp


def main(
    config_path: str,
    left_num_records: int,
    right_num_records: int,
    rps: int,
    left_schema: str,
    right_schema: str,
    skip_confirmation: bool,
    cleanup: bool,
    print_n_rows: int,
):
    """Run join pipeline with configurable parameters

    Args:
        config_path (str): Path to pipeline configuration JSON file
        left_num_records (int): Number of records to generate for left events
        right_num_records (int): Number of records to generate for right events
        rps (int): Records per second
        left_schema (str): Path to left events generator schema JSON file
        right_schema (str): Path to right events generator schema JSON file
        skip_confirmation (bool): Skip confirmation prompt
        cleanup (bool): Cleanup Clickhouse table before running the pipeline
        print_n_rows (int): Number of records to print from Clickhouse table
    """
    pipeline_config = utils.load_conf(config_path)

    join_sources = {}
    for source in pipeline_config.join.sources:
        for topic in pipeline_config.source.topics:
            if topic.name == source.source_id:
                source_topic = topic
                break
        else:
            raise ValueError(f"Source topic {source.source_id} not found")

        join_sources[source.orientation] = {
            "source_topic": source_topic,
            "join_key": source.join_key,
            "name": source.source_id,
        }

    clickhouse_client = utils.create_clickhouse_client(pipeline_config.sink)

    utils.create_pipeline_if_not_exists(
        pipeline_config, clickhouse_client, skip_confirmation, cleanup
    )

    n_records_before = utils.read_clickhouse_table_size(
        pipeline_config.sink, clickhouse_client
    )

    # Generate list of join keys
    join_keys = [str(uuid.uuid4()) for _ in range(right_num_records)]

    with console.status(
        "[bold green]Generating and publishing "
        f"left ([italic u]{join_sources['left']['name']}[/italic u]) and "
        f"right ([italic u]{join_sources['right']['name']}[/italic u]) "
        "events to topics...[/bold green]",
        spinner="dots",
    ):
        right_stats = generate_events(
            source_connection_params=pipeline_config.source.connection_params,
            topic_config=join_sources["right"]["source_topic"],
            generator_schema=right_schema,
            duplication_rate=0,
            join_key=join_sources["right"]["join_key"],
            list_of_keys=join_keys,
            num_records=right_num_records,
            rps=rps,
        )

        left_stats = generate_events(
            source_connection_params=pipeline_config.source.connection_params,
            topic_config=join_sources["left"]["source_topic"],
            generator_schema=left_schema,
            duplication_rate=0,
            join_key=join_sources["left"]["join_key"],
            list_of_keys=join_keys,
            num_records=left_num_records,
            rps=rps,
        )

    utils.log(
        message=f"Generated and published user events to topic [italic u]{join_sources['left']['name']}[/italic u]",
        status="Success",
        is_success=True,
        component="Kafka",
    )

    utils.log(
        message=f"Generated and published order events to topic [italic u]{join_sources['right']['name']}[/italic u]",
        status="Success",
        is_success=True,
        component="Kafka",
    )

    utils.print_gen_stats(
        [left_stats, right_stats],
        [join_sources["left"]["name"], join_sources["right"]["name"]],
    )

    time_window_seconds = utils.time_window_to_seconds(
        pipeline_config.sink.max_delay_time
    )
    with console.status(
        f"[bold green]Waiting {time_window_seconds} seconds "
        "([italic u]max_delay_time[/italic u]) for sink to "
        "flush buffer before querying Clickhouse...[/bold green]",
        spinner="dots",
    ):
        time.sleep(time_window_seconds + 2)

    n_records_after = utils.read_clickhouse_table_size(
        pipeline_config.sink, clickhouse_client
    )

    rows = utils.get_clickhouse_table_rows(
        pipeline_config.sink, clickhouse_client, n_rows=print_n_rows
    )
    utils.print_clickhouse_record(
        rows,
        title=f"Records from table [italic u]{pipeline_config.sink.table}[/italic u]",
    )

    clickhouse_client.close()

    added_records = n_records_after - n_records_before
    expected_records = left_num_records
    if added_records != expected_records:
        utils.log(
            message=f"Expected {expected_records} records, but got {added_records} records",
            status="Failure",
            is_failure=True,
            component="Clickhouse",
        )
        exit(1)
    else:
        utils.log(
            message=f"Expected {expected_records} records, and got {added_records} records",
            status="Success",
            is_success=True,
            component="Clickhouse",
        )
        exit(0)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Run join pipeline with configurable parameters"
    )
    parser.add_argument(
        "--left-num-records",
        type=int,
        default=10000,
        help="Number of records to generate for left events (default: 10000)",
    )
    parser.add_argument(
        "--right-num-records",
        type=int,
        default=10000,
        help="Number of records to generate for right events (default: 10000)",
    )
    parser.add_argument(
        "--rps", type=int, default=1000, help="Records per second (default: 1000)"
    )
    parser.add_argument(
        "--config",
        type=str,
        default="config/glassflow/join_pipeline.json",
        help="Path to pipeline configuration file (default: config/glassflow/join_pipeline.json)",
    )
    parser.add_argument(
        "--left-schema",
        type=str,
        default="config/glassgen/order_event.json",
        help="Path to left events generator schema file (default: config/glassgen/order_event.json)",
    )
    parser.add_argument(
        "--right-schema",
        type=str,
        default="config/glassgen/user_event.json",
        help="Path to right events generator schema file (default: config/glassgen/user_event.json)",
    )
    parser.add_argument(
        "--yes", "-y", action="store_true", help="Skip confirmation prompt"
    )
    parser.add_argument(
        "--cleanup",
        "-c",
        action="store_true",
        help="Cleanup Clickhouse table before running the pipeline",
    )
    parser.add_argument(
        "--print-n-rows",
        "-p",
        type=int,
        default=5,
        help="Number of records to print from Clickhouse table (default: 5)",
    )
    args = parser.parse_args()

    main(
        left_num_records=args.left_num_records,
        right_num_records=args.right_num_records,
        rps=args.rps,
        config_path=args.config,
        left_schema=args.left_schema,
        right_schema=args.right_schema,
        skip_confirmation=args.yes,
        cleanup=args.cleanup,
        print_n_rows=args.print_n_rows,
    )
