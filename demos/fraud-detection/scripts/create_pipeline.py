#!/usr/bin/env python3
"""Create the fraud detection GlassFlow pipeline."""

from __future__ import annotations

import argparse
import sys
from pathlib import Path


def main() -> int:
    parser = argparse.ArgumentParser(description="Create the fraud detection GlassFlow pipeline.")
    parser.add_argument(
        "--host",
        default="http://localhost:8081",
        help="GlassFlow API host (default: http://localhost:8081)",
    )
    parser.add_argument(
        "--pipeline-json",
        default="glassflow/fraud_detection_pipeline.json",
        type=Path,
        help="Path to the pipeline JSON config",
    )
    args = parser.parse_args()

    try:
        from glassflow.etl import Client  # type: ignore[import]
    except ImportError:
        print("glassflow package not found. Run: pip install -r requirements.txt", file=sys.stderr)
        return 1

    client = Client(host=args.host)
    pipeline = client.create_pipeline(pipeline_config_json_path=str(args.pipeline_json))
    print(f"✓ Pipeline created: {pipeline.pipeline_id}  status={pipeline.status}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
