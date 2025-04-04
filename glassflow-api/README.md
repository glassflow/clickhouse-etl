## Clickhouse ETL (internal)

## ClickHouse exporter tool (for testing purposes)

How to run:
>go run cmd/ch-etl/main.go -config <path_to_config>

Structure of config file exists in **config.example.json**.
Config have 4 sections:

- **stream_consumer** - configuration of NATS consumer
- **clickhouse_sink** - configuration of ClickHouse node
- **batch** - batch config
- **schema** - which have 3 sections too:

  - *fields* - map with fields and types of original event
  - *primary_key_field* - name of *primary key* field
  - *clickhouse_mapping* - mapping of ClickHouse column name, event field name and ClickHouse column type

Please, encode password of your CH database in base64 format, like this:
> echo -n password | base64

Example:

```JSON
{
"stream_consumer": {
    "url": "nats://localhost:4222",
 "stream": "<stream_name>",
 "consumer": "clickhouse_etl",
 "ack_wait_seconds": "60s"
},
"clickhouse_sink": {
 "host": "127.0.0.1",
 "port": "9000",
 "database": "default",
 "username": "default",
 "password": "<password_in_base64>",
 "tls_enabled": false,
 "table": "<table_name>"
},
"batch": {
 "max_batch_size": 10000
},
"schema": {
  "streams": {
  "default": {
   "fields": [
    {
     "field_name": "event_id",
     "field_type": "string"
    },
    {
     "field_name": "name",
     "field_type": "string"
    },
    {
     "field_name": "email",
     "field_type": "string"
    },
    {
     "field_name": "timestamp",
     "field_type": "datetime"
    },
    {
     "field_name": "action",
     "field_type": "string"
    }
   ]
  }
    },
 "sink_mapping": [
  {
   "column_name": "event_id",
   "field_name": "event_id",
   "stream_name": "default",
   "column_type": "UUID"
  },
  {
   "column_name": "name",
   "field_name": "name",
   "stream_name": "default",
   "column_type": "String"
  },
  {
   "column_name": "email",
   "field_name": "email",
   "stream_name": "default",
   "column_type": "String"
  },
  {
   "column_name": "timestamp",
   "field_name": "timestamp",
   "stream_name": "default",
   "column_type": "DateTime"
  },
  {
   "column_name": "action",
   "field_name": "action",
   "stream_name": "default",
   "column_type": "String"
  }
 ]
}
}
```
