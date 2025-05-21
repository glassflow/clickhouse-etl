import uuid
import itertools
import datetime as dt

from clickhouse_connect import get_client
import glassgen
from kafka.admin import KafkaAdminClient, NewTopic
from kafka.errors import TopicAlreadyExistsError
from rich.console import Console
from rich.progress import track
from rich import print, box
from rich.table import Table

console = Console()

ORDERS_SCHEMA = {
    "order_id": "$uuid",
    "user_id": "$uuid",
    "product_id": "$uuid",
    "quantity": "$intrange(1, 10)",
    "price": "$price(1, 100)",
    "created_at": '$datetime(%Y-%m-%d %H:%M:%S)',
}

USERS_SCHEMA = {
    "user_id": "$uuid",
    "name": "$name",
    "email": "$email",
    "phone_number": "$phone_number",
    "address": "$address",
    "city": "$city",
    "zipcode": "$zipcode",
    "country": "$country",
    "created_at": '$datetime(%Y-%m-%d %H:%M:%S)',
}


def create_clickhouse_client():
    """Initialize ClickHouse client"""
    return get_client(
        host="<your-clickhouse-host>",
        username="<your-clickhouse-username>",
        password="<your-clickhouse-password>",
        database="<your-clickhouse-database>",
        port=8443,  # default port for Altinity ClickHouse
    )


def get_glassgen_generator(
    topic_name, 
    num_records, 
    rps=1000,
    deduplication_enabled=False, 
    duplication_key=None,
    duplication_ratio=0.5,
    schema_dict=None,
    schema=None,
    sink_type="kafka"
):
    """Get GlassGen configuration for event generation."""
    deduplication_config = {}
    if deduplication_enabled:
        deduplication_config = {
            "enabled": True,
            "ratio": duplication_ratio,
            "key_field": duplication_key,
            "time_window": "1h"
        }
    else:
        deduplication_config = None
    config = {
        "generator": {
            "num_records": num_records,
            "rps": rps,
            "event_options": {
                "duplication": deduplication_config
            },
        },
    }
    
    if sink_type == "kafka":
        sink = {
            "type": "kafka",
            "params": {
                "bootstrap.servers": "localhost:9092",
                "topic": topic_name,
                "security.protocol": "PLAINTEXT"
            },
        }
    elif sink_type == "yield":
        sink = {
            "type": "yield",
        }
    config["sink"] = sink
    
    if schema_dict:
        config["schema"] = schema_dict
        gen = glassgen.generate(config)
    elif schema:
        gen = glassgen.generate(config, schema=schema)
    else:
        raise ValueError("Either schema_dict or schema must be provided")
    
    return gen


def insert_events_to_clickhouse(client, gen, num_records):
    """Insert generated events into ClickHouse."""
    columns = [
        "order_id",
        "user_id",
        "product_id",
        "quantity",
        "price",
        "created_at"
    ]
    batch_size = 10000
    batch = []
    
    for event in track(gen, description="Inserting events into ClickHouse...", total=num_records):
        event_copy = event.copy()
        event_copy["created_at"] = dt.datetime.strptime(event_copy["created_at"], "%Y-%m-%d %H:%M:%S")
        event_list = [event_copy[c] for c in columns]
        batch.append(event_list)
        
        if len(batch) >= batch_size:
            client.insert(
                "orders",
                batch,
                column_names=columns
            )
            batch = []
    
    if batch:
        client.insert(
            "orders",
            batch,
            column_names=columns
        )


def check_duplicates(client, table_name: str, duplication_key: str):
    """Check the number of duplicates in the orders table."""
    total = client.command(f"SELECT count(*) FROM {table_name}")
    unique = client.command(f"SELECT count(DISTINCT {duplication_key}) FROM {table_name}")

    print(f"\nTotal: {total}")
    print(f"Unique: {unique}")
    print(f"Percentage of duplicates: {100 * (total - unique) / total:.2f}%\n")


class JoinEventSchema(glassgen.ConfigSchema):
    """Custom schema for join events."""
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

    def _generate_record(self):
        """Generate a single record based on the schema."""
        record = super()._generate_record()
        record[self._join_key] = next(self.join_key_select)
        return record


def create_kafka_topic(topic_name: str):
    """Create a Kafka topic."""
    admin_client = KafkaAdminClient(
        bootstrap_servers="localhost:9092",
        security_protocol="PLAINTEXT"
    )
    try:
        admin_client.create_topics([NewTopic(name=topic_name, num_partitions=1, replication_factor=1)])
        print(f"Topic [italic u]{topic_name}[/italic u] created")
    except TopicAlreadyExistsError:
        print(f"Topic [italic u]{topic_name}[/italic u] already exists")
    except Exception as e:
        print(f"Error creating topic [italic u]{topic_name}[/italic u]: {e}")
    admin_client.close()


def send_sample_event(topic_name: str, schema: dict):
    """Send a sample event to the Kafka topic."""
    get_glassgen_generator(
        topic_name=topic_name,
        num_records=1,
        deduplication_enabled=False,
        schema_dict=schema,
        sink_type="kafka"
    )


def part1(client):
    print("Generating events with duplicates and insert them into ClickHouse ...")
    num_records = 100000
    
    gen = get_glassgen_generator(
        topic_name="orders",
        num_records=num_records,
        rps=10000,
        deduplication_enabled=True,
        duplication_key="order_id",
        duplication_ratio=0.5,
        schema_dict=ORDERS_SCHEMA,
        sink_type="yield"
    )
    
    insert_events_to_clickhouse(client, gen, num_records)
    
    check_duplicates(client, "orders", "order_id")
    print("As you can see, ReplacingMergeTree manages to remove some duplicates, [bold red]but not all of them.[/bold red]")
    

def part2(client):
    with console.status("Creating kafka topic `orders` ...", spinner="dots"):
        create_kafka_topic("orders")
        send_sample_event("orders", ORDERS_SCHEMA)
    
    print("\n[bold blue]Go to http://localhost:8080 to create the [red]deduplication pipeline[/red].[/bold blue]\n")
    
    print("Connect the kafka topic [bold yellow]orders[/bold yellow] to the clickhouse table [bold yellow]orders_glassflow[/bold yellow]. Here are the Kafka credentials:\n")
    
    table = Table( 
        show_header=False,
        show_edge=False,
        show_lines=False,
        box=box.SIMPLE_HEAD,
    )
    table.add_row("Bootstrap Servers", "kafka:9093")
    table.add_row("Security Protocol", "PLAINTEXT")
    table.add_row("Authentication Method", "No Authentication")
    table.add_row("Topic", "orders")
    console.print(table)
    input("\nOnce created, press enter to continue.")
    
    # Generate events
    with console.status("Generating events with duplicates and insert them into Kafka ...", spinner="dots"):
        get_glassgen_generator(
            topic_name="orders",
            num_records=100000,
            rps=10000,
            deduplication_enabled=True,
            duplication_key="order_id",
            duplication_ratio=0.5,  
            schema_dict=ORDERS_SCHEMA,
            sink_type="kafka"
        )
    
    # Check duplicates
    check_duplicates(client, "orders_glassflow", "order_id")
    print("As you can see, the deduplication pipeline manages to [bold green]remove all duplicates.[/bold green]")
    
def part3():
    with console.status("Creating kafka topic `users` ...", spinner="dots"):
        create_kafka_topic("users")
        send_sample_event("users", USERS_SCHEMA)
    
    print("\n[bold blue]Go to http://localhost:8080 to create the [red]join pipeline[/red] (delete the previous pipeline in order to create a new one).[/bold blue]\n")
    print("Connect the kafka left topic [bold yellow]orders[/bold yellow] and right topic [bold yellow]users[/bold yellow] to the clickhouse table [bold yellow]orders_enriched[/bold yellow]. Here are the Kafka credentials:\n")
    
    table = Table( 
        show_header=False,
        show_edge=False,
        show_lines=False,
        box=box.SIMPLE_HEAD,
    )
    table.add_row("Bootstrap Servers", "kafka:9093")
    table.add_row("Security Protocol", "PLAINTEXT")
    table.add_row("Authentication Method", "No Authentication")
    table.add_row("Topic", "orders")
    console.print(table)
    input("\nOnce created, press enter to continue.")
    
    join_keys = [str(uuid.uuid4()) for _ in range(10000)]
    
    # Generate user events
    with console.status("Generating user events ...", spinner="dots"):
        user_schema = JoinEventSchema(USERS_SCHEMA, "user_id", join_keys)
        get_glassgen_generator(
            topic_name="users",
            num_records=10000,
            rps=1000,
            schema=user_schema,
            sink_type="kafka"
        )
    
    # Generate order events
    with console.status("Generating order events ...", spinner="dots"):
        order_schema = JoinEventSchema(ORDERS_SCHEMA, "user_id", join_keys)
        get_glassgen_generator(
            topic_name="orders",
            num_records=100000,
            rps=10000,
            schema=order_schema,
            sink_type="kafka"
        )
    
    print("Go to your Altinity ClickHouse instance and check the table [bold yellow]orders_enriched[/bold yellow] to see the enriched data.")
    
def main():
    """Main function to run the demo."""

    # Initialize ClickHouse client
    client = create_clickhouse_client()

    # Part 1: Deduplication Problem
    print("\n=== [bold]Part 1: Deduplication Problem[/bold] ===")
    part1(client)
    
    # Part 2: Solution with GlassFlow
    print("\n=== [bold]Part 2: Solution with GlassFlow[/bold] ===")
    part2(client)
    
    # Part 3: Enrich Data with Joins
    print("\n=== [bold]Part 3: Enrich Data with Joins[/bold] ===")
    part3()

if __name__ == "__main__":
    main()
