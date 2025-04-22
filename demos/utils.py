import json
import base64
import re

import clickhouse_connect
from kafka.admin import KafkaAdminClient, NewTopic
from kafka.errors import TopicAlreadyExistsError
from glassflow_clickhouse_etl import errors, models, Pipeline
from rich import print, box
from rich.table import Table



def create_clickhouse_client(sink_config: models.SinkConfig):
    """Create a ClickHouse client"""
    # GlassFlow uses Clickhouse native port while the python client uses http
    if sink_config.host == "clickhouse":
        host = "localhost"
        port = 8123
    else:
        host = sink_config.host
        port = 8443

    return clickhouse_connect.get_client(
        host=host,
        username=sink_config.username,
        password=base64.b64decode(sink_config.password).decode('utf-8'),
        database=sink_config.database,
        port=port
    )


def create_table_if_not_exists(sink_config: models.SinkConfig, client):
    """Create a table in ClickHouse if it doesn't exist"""
    if client.command(f"EXISTS TABLE {sink_config.table}"):
        log(message=f"Sink [italic u]{sink_config.table}[/italic u]", status="Already exists", is_success=True, component="Clickhouse")
        return
    
    columns_def = [f"{m.column_name} {m.column_type}" for m in sink_config.table_mapping]
    client.command(
        f"""
        CREATE TABLE IF NOT EXISTS {sink_config.table} ({','.join(columns_def)})
        ENGINE = MergeTree
        ORDER BY event_id;
        """
    )
    log(message=f"Sink [italic u]{sink_config.table}[/italic u]", status="Created", is_success=True, component="Clickhouse")


def read_clickhouse_table_size(sink_config: models.SinkConfig, client) -> int:
    """Read the size of a table in ClickHouse"""
    return client.command(
        f"SELECT count() FROM {sink_config.table}"
    )
    
    
def truncate_table(sink_config: models.SinkConfig, client):
    """Truncate a table in ClickHouse"""
    client.command(
        f"TRUNCATE TABLE {sink_config.table}"
    )


def load_conf(path: str) -> models.PipelineConfig:
    """Load pipeline configuration from a JSON file"""
    return models.PipelineConfig(**json.load(open(path)))


def create_topics_if_not_exists(source_config: models.SourceConfig):
    """Create topics in Kafka"""
    
    if source_config.connection_params.brokers[0] == "kafka:9094":
        brokers = ["localhost:9093"]
    else:
        brokers = source_config.connection_params.brokers
    
    # Create Kafka admin client
    admin_client = KafkaAdminClient(
        bootstrap_servers=brokers,
        security_protocol=source_config.connection_params.protocol.value,
        sasl_mechanism=source_config.connection_params.mechanism.value,
        sasl_plain_username=source_config.connection_params.username,
        sasl_plain_password=source_config.connection_params.password,
    )

    # Create topic configuration
    for topic_config in source_config.topics:
        topic_name = topic_config.name
        try:
            # Create new topic with default configuration
            new_topic = NewTopic(
                name=topic_name,
                num_partitions=1,
                replication_factor=1
            )
            admin_client.create_topics([new_topic])
            log(message=f"Topic [italic u]{topic_name}[/italic u]", status="Created", is_success=True, component="Kafka")
        except TopicAlreadyExistsError:
            log(message=f"Topic [italic u]{topic_name}[/italic u]", status="Already exists", is_success=True, component="Kafka")
        except Exception as e:
            log(message=f"Error creating topic [italic u]{topic_name}[/italic u]", status=str(e), is_success=False, component="Kafka")
    admin_client.close()


def check_if_pipeline_exists(config: models.PipelineConfig) -> tuple[bool, str | None]:
    """
    Check if a pipeline exists
    
    Returns:
        bool: True if the pipeline exists, False otherwise
        str | None: Pipeline ID of existing pipeline, None if it doesn't exist
    """
    try:
        pipeline_id = Pipeline().get_running_pipeline()
        if pipeline_id == config.pipeline_id:
            return True, pipeline_id
        else:
            return False, pipeline_id
    except errors.ConnectionError:
        log(message="Looks like [bold orange3]GlassFlow[/bold orange3] is not running locally!", status="", is_success=False, component="GlassFlow")
        print("\nRun the following command to start it:\n  > `docker compose up -d`\n")
        exit(1)
    except errors.PipelineNotFoundError:
        return False, None
    except Exception as e:
        log(message=f"Error checking if pipeline exists", status=str(e), is_success=False, component="GlassFlow")
        raise e


def create_pipeline_if_not_exists(config: models.PipelineConfig, clickhouse_client, skip_confirmation: bool, cleanup: bool) -> Pipeline:
    """
    Create GlassFlow pipeline
    
    Args:
        config (models.PipelineConfig): Pipeline configuration
        clickhouse_client (clickhouse_connect.Client): ClickHouse client
        skip_confirmation (bool): Skip confirmation prompt
        cleanup (bool): Cleanup Clickhouse table before creating the pipeline
        
    Returns:
        Pipeline: GlassFlow pipeline
    """
    pipeline = Pipeline(config)
    
    exists, pipeline_id = check_if_pipeline_exists(config)
    if exists:
        log(message=f"Pipeline [italic u]{config.pipeline_id}[/italic u]", status="Already exists", is_success=True, component="GlassFlow")
        if cleanup:
            truncate_table(config.sink, clickhouse_client)
            log(message=f"Truncate table [italic u]{config.sink.table}[/italic u]", status="Success", is_success=True, component="Clickhouse")
    else:
        if pipeline_id:
            if not skip_confirmation:
                resp = query_yes_no(
                    question=f"[yellow]⚠[/yellow][[bold orange3]GlassFlow[/bold orange3]] Pipeline [italic u]{pipeline_id}[/italic u] is running. "
                    f"Do you want to delete it and create a new pipeline with ID [italic u]{config.pipeline_id}[/italic u]?", 
                    default_yes=True
                )
            else:
                resp = True

            if resp:
                pipeline = Pipeline(config)
                
                pipeline.delete()
                log(message=f"Delete pipeline [italic u]{config.pipeline_id}[/italic u]", status="Success", is_success=True, component="GlassFlow")
            else:
                log(message=f"Exited! Delete current pipeline or update config to send events to existing pipeline", status="", is_success=False, component="GlassFlow")
                exit(0)
        
        create_table_if_not_exists(config.sink, clickhouse_client)
        create_topics_if_not_exists(config.source)
        
        try:
            pipeline.create()
            log(message=f"Pipeline [italic u]{config.pipeline_id}[/italic u]", status="Created", is_success=True, component="GlassFlow")
        except errors.PipelineAlreadyExistsError:
            log(message=f"Pipeline [italic u]{config.pipeline_id}[/italic u]", status="Already exists", is_success=False, component="GlassFlow")
        except Exception as e:
            log(message=f"Error creating pipeline [italic u]{config.pipeline_id}[/italic u]", status=str(e), is_success=False, component="GlassFlow")
            raise e
        
    return pipeline


def time_window_to_seconds(time_window: str) -> int:
    """Convert time window string to seconds.
    
    Args:
        time_window (str): Time window string in format like '1s', '1m', '1h', '1d'
        
    Returns:
        int: Number of seconds
    """
    if not time_window:
        return 0
        
    # Use regex to match the number and unit
    match = re.match(r'^(\d+)([smhd])$', time_window)
    if not match:
        raise ValueError(f"Invalid time window format: {time_window}. Use format like '1s', '1m', '1h', '1d'")
        
    value = int(match.group(1))
    unit = match.group(2)
    
    if unit == 's':
        return value
    elif unit == 'm':
        return value * 60
    elif unit == 'h':
        return value * 3600
    elif unit == 'd':
        return value * 86400  # 24 * 60 * 60
    else:
        raise ValueError(f"Invalid time unit: {unit}. Use 's' for seconds, 'm' for minutes, 'h' for hours, 'd' for days")


def query_yes_no(question, default_yes: bool | None = None):
    if default_yes is None:
        prompt = " [y/n] "
    elif default_yes:
        prompt = " [Y/n] "
    else:
        prompt = " [y/N] "

    while True:
        try:
            print(question + prompt, end="")
            resp = input().strip().lower()
            if default_yes is not None and resp == '':
                return default_yes
            else:
                return resp == 'y' or resp == 'yes'
        except ValueError:
            print("Please respond with 'yes' or 'no' (or 'y' or 'n').\n")

def log(message: str, status: str = "Success", is_success: bool = True, component: str = "GlassFlow"):
    if is_success:
        status_icon = "[green]✔[/green]"
        status_message = f"[green]{status}[/green]"
    else:
        status_icon = "[red]✗[/red]"
        status_message = f"[red]{status}[/red]"
    
    if component == "GlassFlow":
        component_str = "[bold orange_red1][GlassFlow][/bold orange_red1]"
    elif component == "Kafka":
        component_str = "[bold sky_blue3][Kafka][/bold sky_blue3]"
    elif component == "Clickhouse":
        component_str = "[bold yellow][Clickhouse][/bold yellow]"
    
    table = Table(show_header=False, show_edge=False, padding=(0, 1), show_lines=False, box=box.SIMPLE_HEAD)
    table.add_column("Status", justify="left", width=2)
    table.add_column("Component", justify="left", width=12)
    table.add_column("Message", justify="left", width=70)
    table.add_column("Status", justify="left", width=20)
    table.add_row(status_icon, component_str, message, status_message)
    print(table)
    
def print_gen_stats(stats: dict, title: str = "Generation Stats"):
    """Print generation statistics in a table format
    
    Args:
        stats (dict): Generation statistics dictionary
        title (str, optional): Title for the table. Defaults to "Generation Stats".
    """
    table = Table(show_header=True, style="sky_blue3", show_edge=True, expand=False, padding=(0, 1), title=title)
    table.add_column("Total Events", justify="right")
    table.add_column("Total Duplicates", justify="right")
    table.add_column("Total Unique Events", justify="right")
    table.add_column("Duplication Rate", justify="right")
    table.add_column("Time taken", justify="right")
    table.add_row(
        str(stats["num_records"]),
        str(stats["total_duplicates"]),
        str(stats["total_generated"]),
        f"{stats['duplication_ratio']:.1%}",
        f"{stats['time_taken_ms']} ms"
    )
    print("")
    print(table)
    print("")
