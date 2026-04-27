#!/usr/bin/env python3
"""Create the fraud detection pipeline via the GlassFlow Python SDK."""

import json
import os
import sys

from dotenv import load_dotenv
from glassflow.etl import Client

load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))


GLASSFLOW_API = os.environ.get("GLASSFLOW_API", "http://localhost:30180")
PIPELINE_JSON = os.path.join(
    os.path.dirname(__file__), "..", "glassflow", "fraud_detection_pipeline.json"
)

with open(PIPELINE_JSON) as f:
    raw = f.read()

replacements = {
    "${KAFKA_USERNAME}": os.environ["KAFKA_USERNAME"],
    "${KAFKA_PASSWORD}": os.environ["KAFKA_PASSWORD"],
    "${CLICKHOUSE_USER}": os.environ["CLICKHOUSE_USER"],
    "${CLICKHOUSE_PASSWORD}": os.environ["CLICKHOUSE_PASSWORD"],
}
for placeholder, value in replacements.items():
    raw = raw.replace(placeholder, value)

config = json.loads(raw)

client = Client(host=GLASSFLOW_API)
pipeline = client.create_pipeline(config)
print(f"Pipeline created: {pipeline.pipeline_id} ({pipeline.status})")
sys.exit(0)
