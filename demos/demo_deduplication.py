import argparse
import time
import json
import glassgen
from glassflow_clickhouse_etl import SourceConfig
from rich.console import Console

import utils


console = Console()


def generate_events_with_duplicates(
    source_config: SourceConfig,
    generator_schema: str,
    duplication_rate: float = 0.01,
    num_records: int = 10000,
    rps: int = 1000,
):
    """Generate events with duplicates

    Args:
        source_config (SourceConfig): Source configuration
        duplication_rate (float, optional): Duplication rate. Defaults to 0.01.
        num_records (int, optional): Number of records to generate. Defaults to 10000.
        rps (int, optional): Records per second. Defaults to 1000.
        generator_schema (str, optional): Path to generator schema.
    """
    if source_config.topics[0].deduplication.enabled:
        duplication_config = glassgen.config.DuplicationConfig(
            enabled=True,
            ratio=duplication_rate,
            key_field=source_config.topics[0].deduplication.id_field,
            time_window=source_config.topics[0].deduplication.time_window,
        )
    else:
        duplication_config = glassgen.config.DuplicationConfig(enabled=False)

    if source_config.connection_params.brokers[0] == "kafka:9094":
        brokers = ["localhost:9093"]
    else:
        brokers = source_config.connection_params.brokers

    schema = json.load(open(generator_schema))

    return glassgen.generate(
        config=glassgen.config.GlassGenConfig(
            sink=glassgen.config.SinkConfig(
                type=f"kafka.{source_config.provider}",
                params={
                    "bootstrap_servers": ",".join(brokers),
                    "topic": source_config.topics[0].name,
                    "security_protocol": source_config.connection_params.protocol,
                    "sasl_mechanism": source_config.connection_params.mechanism,
                    "username": source_config.connection_params.username,
                    "password": source_config.connection_params.password,
                },
            ),
            generator=glassgen.config.GeneratorConfig(
                num_records=num_records,
                rps=rps,
                event_options=glassgen.config.EventOptions(
                    duplication=duplication_config
                ),
            ),
            schema=schema,
        )
    )


def main(
    num_records: int,
    duplication_rate: float,
    rps: int,
    config_path: str,
    generator_schema: str,
    skip_confirmation: bool,
    cleanup: bool,
):
    pipeline_config = utils.load_conf(config_path)
    clickhouse_client = utils.create_clickhouse_client(pipeline_config.sink)

    utils.create_pipeline_if_not_exists(
        pipeline_config, clickhouse_client, skip_confirmation, cleanup
    )

    n_records_before = utils.read_clickhouse_table_size(
        pipeline_config.sink, clickhouse_client
    )

    with console.status(
        f"[bold green]Generating and publishing events to topic [italic u]{pipeline_config.source.topics[0].name}[/italic u]...[/bold green]",
        spinner="dots",
    ):
        gen_stats = generate_events_with_duplicates(
            source_config=pipeline_config.source,
            duplication_rate=duplication_rate,
            num_records=num_records,
            rps=rps,
            generator_schema=generator_schema,
        )

    utils.log(
        message=f"Generated and published events to topic [italic u]{pipeline_config.source.topics[0].name}[/italic u]",
        status="Success",
        is_success=True,
        component="Kafka",
    )
    utils.print_gen_stats(
        gen_stats,
        title=f"Generation stats for topic [bold]{pipeline_config.source.topics[0].name}[/bold]",
    )

    time_window_seconds = utils.time_window_to_seconds(
        pipeline_config.sink.max_delay_time
    )
    with console.status(
        f"[bold green]Waiting {time_window_seconds} seconds "
        f"([italic u]max_delay_time[/italic u]) for sink to "
        "flush buffer before querying Clickhouse...[/bold green]",
        spinner="dots",
    ):
        time.sleep(time_window_seconds + 2)

    n_records_after = utils.read_clickhouse_table_size(
        pipeline_config.sink, clickhouse_client
    )
    clickhouse_client.close()

    utils.log(
        message=f"Number of new rows to table [italic u]{pipeline_config.sink.table}[/italic u]: [bold]{n_records_after - n_records_before}[/bold]",
        status="",
        is_success=True,
        component="Clickhouse",
    )


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Run deduplication pipeline with configurable parameters"
    )
    parser.add_argument(
        "--num-records",
        type=int,
        default=10000,
        help="Number of records to generate (default: 10000)",
    )
    parser.add_argument(
        "--duplication-rate",
        type=float,
        default=0.1,
        help="Rate of duplication (default: 0.1)",
    )
    parser.add_argument(
        "--rps", type=int, default=1000, help="Records per second (default: 1000)"
    )
    parser.add_argument(
        "--config",
        type=str,
        default="config/glassflow/deduplication_pipeline.json",
        help="Path to pipeline configuration file (default: config/glassflow/deduplication_pipeline.json)",
    )
    parser.add_argument(
        "--generator-schema",
        type=str,
        default="config/glassgen/user_event.json",
        help="Path to generator schema file for GlassGen (default: config/glassgen/user_event.json) "
        "(Check https://github.com/glassflow/glassgen for more details)",
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
    args = parser.parse_args()

    main(
        args.num_records,
        args.duplication_rate,
        args.rps,
        args.config,
        args.generator_schema,
        args.yes,
        args.cleanup,
    )
