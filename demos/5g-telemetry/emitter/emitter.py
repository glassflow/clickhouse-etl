#!/usr/bin/env python3
"""Replay uccmisl/5Gdataset CSV rows as OTLP/HTTP JSON gauge metrics."""

from __future__ import annotations

import csv
import hashlib
import os
import random
import subprocess
import sys
import time
import zipfile
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterator
from urllib.request import urlretrieve

import requests

DATASET_REPO = "https://github.com/uccmisl/5Gdataset.git"
DATASET_ZIP_URL = (
    "https://github.com/uccmisl/5Gdataset/raw/master/5G-production-dataset.zip"
)

METRICS = [
    ("ran.rsrp", "RSRP", "dBm"),
    ("ran.rsrq", "RSRQ", "dB"),
    ("ran.snr", "SNR", "dB"),
    ("ran.cqi", "CQI", "1"),
    ("ran.dl_bitrate", "DL_bitrate", "kbps"),
    ("ran.ul_bitrate", "UL_bitrate", "kbps"),
]

MISSING = "-"


def env(name: str, default: str) -> str:
    return os.environ.get(name, default)


def log(msg: str) -> None:
    print(msg, flush=True)


def parse_timestamp(raw: str) -> int:
    """Parse G-NetTrack timestamp YYYY.MM.DD_HH.MM.SS to Unix nanoseconds."""
    dt = datetime.strptime(raw, "%Y.%m.%d_%H.%M.%S").replace(tzinfo=timezone.utc)
    return int(dt.timestamp() * 1_000_000_000)


def parse_float(value: str) -> float | None:
    if not value or value == MISSING:
        return None
    try:
        return float(value)
    except ValueError:
        return None


def ensure_dataset(dataset_dir: Path) -> Path:
    dataset_dir.mkdir(parents=True, exist_ok=True)
    csv_files = list(dataset_dir.rglob("*.csv"))
    if csv_files:
        log(f"Dataset ready: {len(csv_files)} CSV files under {dataset_dir}")
        return dataset_dir

    zip_path = dataset_dir / "5G-production-dataset.zip"
    extracted_root = dataset_dir / "5G-production-dataset"

    if not zip_path.exists():
        log(f"Downloading dataset zip from {DATASET_ZIP_URL}")
        urlretrieve(DATASET_ZIP_URL, zip_path)

    if not extracted_root.exists():
        log(f"Extracting {zip_path}")
        with zipfile.ZipFile(zip_path, "r") as archive:
            archive.extractall(dataset_dir)

    csv_files = list(dataset_dir.rglob("*.csv"))
    if not csv_files:
        log("Clone fallback: git clone uccmisl/5Gdataset")
        clone_dir = dataset_dir / "repo"
        if not clone_dir.exists():
            subprocess.run(
                ["git", "clone", "--depth", "1", DATASET_REPO, str(clone_dir)],
                check=True,
            )
        csv_files = list(clone_dir.rglob("*.csv"))

    if not csv_files:
        raise RuntimeError(
            "No CSV files found. Clone https://github.com/uccmisl/5Gdataset manually "
            f"into {dataset_dir}"
        )

    log(f"Dataset ready: {len(csv_files)} CSV files")
    return dataset_dir


def iter_rows(dataset_dir: Path, max_rows: int | None) -> Iterator[dict[str, str]]:
    count = 0
    for csv_path in sorted(dataset_dir.rglob("*.csv")):
        if "__MACOSX" in str(csv_path) or csv_path.name.startswith("."):
            continue
        with csv_path.open(newline="", encoding="utf-8") as handle:
            reader = csv.DictReader(handle)
            for row in reader:
                yield row
                count += 1
                if max_rows and count >= max_rows:
                    return


def attr(key: str, value: str | float) -> dict[str, Any]:
    if isinstance(value, float):
        return {"key": key, "value": {"doubleValue": value}}
    return {"key": key, "value": {"stringValue": str(value)}}


def measurement_id(cell_id: str, metric_name: str, base_ts_ns: int) -> str:
    """Stable identity for a single logical measurement.

    Identical across collectors A and B for the same row + metric, so GlassFlow's
    deduplication (keyed on attributes.measurement_id) removes the redundant copy
    emitted by the second collector. Derived from the unjittered base timestamp so
    per-collector batching jitter does not change the identity.
    """
    digest = hashlib.md5(f"{cell_id}|{metric_name}|{base_ts_ns}".encode()).hexdigest()
    return digest[:16]


def emission_id(cell_id: str, metric_name: str, base_ts_ns: int, vendor: str) -> str:
    """Unique identity for a single physical emission (per collector).

    Differs between collectors A and B for the same observation. The comparison
    ("no-dedup") pipeline keys deduplication on attributes.emission_id, which is
    always unique, so no records are ever removed and the redundant collector copy
    survives. This lets the demo contrast a clean stream against an inflated one
    while keeping a valid GlassFlow processing component in both pipelines.
    """
    return f"{measurement_id(cell_id, metric_name, base_ts_ns)}_{vendor}"


def build_payload(
    row: dict[str, str],
    *,
    vendor: str,
    timestamp_ns: int,
    base_ts_ns: int,
    include_healthcheck: bool,
) -> dict[str, Any]:
    cell_id = row.get("CellID", "")
    network_mode = row.get("NetworkMode", "")
    latitude = row.get("Latitude", "")
    longitude = row.get("Longitude", "")

    if vendor == "a":
        resource_attributes = [
            attr("cell.id", cell_id),
            attr("service.name", "5g-ran-collector-a"),
            attr("network.mode", network_mode),
            attr("location.latitude", latitude),
            attr("location.longitude", longitude),
        ]
    else:
        resource_attributes = [
            attr("ran.cell.id", cell_id),
            attr("service.name", "5g-ran-collector-b"),
            attr("network.mode", network_mode),
            attr("location.latitude", latitude),
            attr("location.longitude", longitude),
        ]

    metrics: list[dict[str, Any]] = []

    for metric_name, column, unit in METRICS:
        value = parse_float(row.get(column, ""))
        if value is None:
            continue
        metrics.append(
            {
                "name": metric_name,
                "unit": unit,
                "description": f"5G RAN {column} from G-NetTrack replay",
                "gauge": {
                    "dataPoints": [
                        {
                            "timeUnixNano": str(timestamp_ns),
                            "asDouble": value,
                            "attributes": [
                                attr("measurement_id", measurement_id(cell_id, metric_name, base_ts_ns)),
                                attr("emission_id", emission_id(cell_id, metric_name, base_ts_ns, vendor)),
                                attr("workload", row.get("State", "unknown")),
                                attr("mobility", "driving" if float(row.get("Speed", "0") or 0) > 0 else "static"),
                            ],
                        }
                    ]
                },
            }
        )

    if include_healthcheck:
        metrics.append(
            {
                "name": "ran.healthcheck",
                "unit": "1",
                "description": "Synthetic collector health-check probe",
                "gauge": {
                    "dataPoints": [
                        {
                            "timeUnixNano": str(timestamp_ns),
                            "asDouble": 1.0,
                            "attributes": [attr("event_kind", "healthcheck")],
                        }
                    ]
                },
            }
        )

    return {
        "resourceMetrics": [
            {
                "resource": {"attributes": resource_attributes},
                "scopeMetrics": [
                    {
                        "scope": {"name": "5g-emitter", "version": "1.0.0"},
                        "metrics": metrics,
                    }
                ],
            }
        ]
    }


def post_metrics(endpoint: str, payload: dict[str, Any], timeout: float) -> None:
    response = requests.post(
        endpoint,
        json=payload,
        headers={"Content-Type": "application/json"},
        timeout=timeout,
    )
    response.raise_for_status()


def main() -> int:
    dataset_dir = Path(env("DATASET_DIR", "/data/5Gdataset"))
    endpoint_a = env(
        "OTEL_ENDPOINT_A",
        "http://otel-collector-a.otel.svc.cluster.local:4318/v1/metrics",
    )
    endpoint_b = env(
        "OTEL_ENDPOINT_B",
        "http://otel-collector-b.otel.svc.cluster.local:4318/v1/metrics",
    )
    batch_size = int(env("REPLAY_BATCH_SIZE", "50"))
    delay_ms = int(env("REPLAY_DELAY_MS", "100"))
    healthcheck_ratio = float(env("HEALTHCHECK_RATIO", "0.05"))
    max_rows_env = env("MAX_ROWS", "")
    max_rows = int(max_rows_env) if max_rows_env else None
    jitter_max_ms = int(env("JITTER_MAX_MS", "500"))
    request_timeout = float(env("REQUEST_TIMEOUT", "30"))

    log("5G telemetry emitter starting")
    log(f"  dataset_dir={dataset_dir}")
    log(f"  endpoint_a={endpoint_a}")
    log(f"  endpoint_b={endpoint_b}")

    ensure_dataset(dataset_dir)

    sent = 0
    for row in iter_rows(dataset_dir, max_rows):
        base_ts = parse_timestamp(row["Timestamp"])
        jitter_a = random.randint(0, jitter_max_ms) * 1_000_000
        jitter_b = random.randint(0, jitter_max_ms) * 1_000_000
        include_healthcheck = random.random() < healthcheck_ratio

        payload_a = build_payload(
            row,
            vendor="a",
            timestamp_ns=base_ts + jitter_a,
            base_ts_ns=base_ts,
            include_healthcheck=include_healthcheck,
        )
        payload_b = build_payload(
            row,
            vendor="b",
            timestamp_ns=base_ts + jitter_b,
            base_ts_ns=base_ts,
            include_healthcheck=include_healthcheck,
        )

        post_metrics(endpoint_a, payload_a, request_timeout)
        post_metrics(endpoint_b, payload_b, request_timeout)

        sent += 1
        if sent % batch_size == 0:
            log(f"Replayed {sent} rows...")
            time.sleep(delay_ms / 1000.0)

    log(f"Done. Replayed {sent} rows to both collectors.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
