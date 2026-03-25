#!/usr/bin/env python3
"""Delete the fraud detection GlassFlow pipeline."""

from __future__ import annotations

import argparse
import sys
import time


PIPELINE_ID = "fraud-detection-logins-tested"


def main() -> int:
    parser = argparse.ArgumentParser(description="Delete the fraud detection GlassFlow pipeline.")
    parser.add_argument(
        "--host",
        default="http://localhost:8081",
        help="GlassFlow API host (default: http://localhost:8081)",
    )
    parser.add_argument(
        "--pipeline-id",
        default=PIPELINE_ID,
        help=f"Pipeline ID to delete (default: {PIPELINE_ID})",
    )
    args = parser.parse_args()

    try:
        from glassflow.etl import Client  # type: ignore[import]
    except ImportError:
        print("glassflow package not found. Run: pip install -r requirements.txt", file=sys.stderr)
        return 1

    from glassflow.etl import Pipeline  # type: ignore[import]

    client = Client(host=args.host)
    found = False
    for pipeline in client.list_pipelines():
        pid = pipeline["pipeline_id"] if isinstance(pipeline, dict) else pipeline.pipeline_id
        if pid == args.pipeline_id:
            found = True
            p = Pipeline(host=args.host, pipeline_id=pid)
            current_status = p.get().status
            if current_status not in ("Stopped", "Error"):
                p.stop()
                print(f"  Stopping pipeline: {pid} ", end="", flush=True)
                for _ in range(30):
                    time.sleep(2)
                    current_status = p.get().status
                    print(".", end="", flush=True)
                    if current_status == "Stopped":
                        break
                print()
            p.delete()
            print(f"✓ Pipeline deleted: {pid}")
            break

    if not found:
        print(f"Pipeline '{args.pipeline_id}' not found — nothing to delete.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
