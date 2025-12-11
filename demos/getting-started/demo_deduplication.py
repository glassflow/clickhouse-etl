import argparse
import time
import json
import glassgen
from glassflow.etl import Client, SourceConfig
from rich.console import Console
import utils


console = Console()


def generate_events_with_duplicates(
    source_config: SourceConfig,
    generator_schema: str,
    duplication_rate: float = 0.1,
    num_records: int = 10000,
    rps: int = 1000,
):
    """Generate events with duplicates

    Args:
        source_config (SourceConfig): Source configuration
        duplication_rate (float, optional): Duplication rate. Defaults to 0.1.
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
    if source_config.topics[0].deduplication.enabled:
        duplication_config = {
            "duplication": {
                "enabled": True,
                "ratio": duplication_rate,
                "key_field": source_config.topics[0].deduplication.id_field,
                "time_window": source_config.topics[0].deduplication.time_window,
            }
        }
    else:
        duplication_config = {"duplication": None}

    glassgen_config["generator"]["event_options"] = duplication_config
    schema = json.load(open(generator_schema))
    glassgen_config["schema"] = schema

    kafka_params = {"topic": source_config.topics[0].name}
    # Handle both docker-compose and Kubernetes service names
    broker = source_config.connection_params.brokers[0]
    if "kafka.glassflow.svc.cluster.local" in broker:
        kafka_params["bootstrap.servers"] = "localhost:39092"
    else:
        kafka_params["bootstrap.servers"] = ",".join(
            source_config.connection_params.brokers
        )
    if not source_config.connection_params.mechanism == "NO_AUTH":
        kafka_params["security.protocol"] = source_config.connection_params.protocol
        kafka_params["sasl.mechanism"] = source_config.connection_params.mechanism
        kafka_params["sasl.username"] = source_config.connection_params.username
        kafka_params["sasl.password"] = source_config.connection_params.password

    glassgen_config["sink"] = {
        "type": "kafka",
        "params": kafka_params,
    }
    return glassgen.generate(config=glassgen_config)


def main(
    glassflow_host: str,
    num_records: int,
    duplication_rate: float,
    rps: int,
    config_path: str,
    generator_schema: str,
    skip_confirmation: bool,
    cleanup: bool,
    print_n_rows: int,
):
    """Run deduplication pipeline with configurable parameters

    Args:
        glassflow_host (str): GlassFlow host
        num_records (int): Number of records to generate
        duplication_rate (float): Duplication rate
        rps (int): Records per second
        config_path (str): Path to pipeline configuration JSON file
        generator_schema (str): Path to generator schema JSON file
        skip_confirmation (bool): Skip confirmation prompt
        cleanup (bool): Cleanup Clickhouse table before running the pipeline
        print_n_rows (int): Number of records to print from Clickhouse table
    """
    pipeline_config = utils.load_conf(config_path)
    clickhouse_client = utils.create_clickhouse_client(pipeline_config.sink)
    gf_client = Client(host=glassflow_host)
    
    utils.create_pipeline_if_not_exists(
        pipeline_config, gf_client, clickhouse_client, skip_confirmation, cleanup
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
        stats=[gen_stats],
        topics=[pipeline_config.source.topics[0].name],
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

    rows = utils.get_clickhouse_table_rows(
        pipeline_config.sink, clickhouse_client, n_rows=print_n_rows
    )
    utils.print_clickhouse_record(
        rows,
        title=f"Records from table [italic u]{pipeline_config.sink.table}[/italic u]",
    )

    clickhouse_client.close()

    added_records = n_records_after - n_records_before
    expected_records = gen_stats["total_generated"]
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
        description="Run deduplication pipeline with configurable parameters"
    )
    parser.add_argument(
        "--glassflow-host",
        type=str,
        default="http://localhost:30180",
        help="GlassFlow host (default: http://localhost:30180)",
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
        "--rps", type=int, default=3000, help="Records per second (default: 1000)"
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
    parser.add_argument(
        "--print-n-rows",
        "-p",
        type=int,
        default=5,
        help="Number of records to print from Clickhouse table (default: 5)",
    )
    args = parser.parse_args()

    main(
        args.glassflow_host,
        args.num_records,
        args.duplication_rate,
        args.rps,
        args.config,
        args.generator_schema,
        args.yes,
        args.cleanup,
        args.print_n_rows,
    )
