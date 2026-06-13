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

# Curated, fixed selection of real 5Gdataset traces replayed by default.
#
# These three driving traces are chosen so the verification queries return
# rich, deterministic results every run:
#   * Signal degradation: multiple cells whose 1-minute RSRP average drops
#     below -110 dBm (with dozens of samples per bucket, not just one).
#   * Throughput SLA: a wide spread of p95 DL bitrate across cells
#     (from a few Mbps up to ~160 Mbps).
#   * Dedup inflation: enough cells/rows to make the ~2x inflation obvious.
# Paths are relative to the extracted dataset root and matched as suffixes,
# so the emitter replays the exact same rows in the exact same order on every
# run. Override with the REPLAY_FILES env var (newline- or comma-separated).
DEFAULT_REPLAY_FILES = [
    "Amazon_Prime/Driving/animated-AdventureTime/B_2019.11.29_09.37.23.csv",
    "Download/Driving/B_2019.12.14_10.16.30.csv",
    "Download/Driving/B_2019.12.16_12.27.05.csv",
]


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


def all_csv_files(dataset_dir: Path) -> list[Path]:
    """Every usable CSV under the dataset root, in stable sorted order."""
    return [
        path
        for path in sorted(dataset_dir.rglob("*.csv"))
        if "__MACOSX" not in str(path) and not path.name.startswith(".")
    ]


def resolve_replay_files(dataset_dir: Path, rel_paths: list[str]) -> list[Path]:
    """Map curated relative paths to concrete files under the dataset root.

    Each entry is matched as a path suffix so it resolves regardless of how the
    archive nests the files (e.g. under a ``5G-production-dataset`` directory).
    Order is preserved exactly, which keeps replay — and therefore the resulting
    ClickHouse rows and query outputs — deterministic across runs. Missing files
    raise immediately so a broken selection fails loudly instead of silently
    changing the result set.
    """
    available = all_csv_files(dataset_dir)
    resolved: list[Path] = []
    for rel in rel_paths:
        wanted = rel.strip().replace("\\", "/")
        if not wanted:
            continue
        match = next(
            (p for p in available if str(p).replace("\\", "/").endswith(wanted)),
            None,
        )
        if match is None:
            raise RuntimeError(
                f"Curated replay file not found in dataset: {wanted}. "
                f"Adjust REPLAY_FILES or the dataset contents."
            )
        resolved.append(match)
    return resolved


def iter_rows(
    csv_paths: list[Path], max_rows: int | None
) -> Iterator[dict[str, str]]:
    """Yield CSV rows from an explicit, ordered list of files.

    The file list and the row order within each file are fixed, so the same
    rows are replayed in the same order on every run.
    """
    count = 0
    for csv_path in csv_paths:
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
    # Jitter defaults to 0 so both collectors stamp an observation with the
    # identical TimeUnix. A single shared jitter per row (below) keeps the two
    # collector copies byte-identical, which makes the stored TimeUnix — and
    # therefore the query results — deterministic no matter which copy GlassFlow
    # keeps after deduplication.
    jitter_max_ms = int(env("JITTER_MAX_MS", "0"))
    request_timeout = float(env("REQUEST_TIMEOUT", "30"))
    # Seed the RNG so healthcheck sampling and jitter are reproducible run to run.
    seed = int(env("RANDOM_SEED", "42"))
    random.seed(seed)

    replay_files_env = env("REPLAY_FILES", "")
    if replay_files_env.strip():
        rel_paths = [
            part
            for chunk in replay_files_env.splitlines()
            for part in chunk.split(",")
            if part.strip()
        ]
    else:
        rel_paths = DEFAULT_REPLAY_FILES

    log("5G telemetry emitter starting")
    log(f"  dataset_dir={dataset_dir}")
    log(f"  endpoint_a={endpoint_a}")
    log(f"  endpoint_b={endpoint_b}")
    log(f"  random_seed={seed} jitter_max_ms={jitter_max_ms}")

    ensure_dataset(dataset_dir)

    csv_paths = resolve_replay_files(dataset_dir, rel_paths)
    log(f"  replay files ({len(csv_paths)}):")
    for path in csv_paths:
        log(f"    - {path}")

    sent = 0
    for row in iter_rows(csv_paths, max_rows):
        base_ts = parse_timestamp(row["Timestamp"])
        # One shared jitter per row keeps collectors A and B identical, so the
        # deduplicated row that lands in ClickHouse is deterministic.
        jitter = random.randint(0, jitter_max_ms) * 1_000_000
        include_healthcheck = random.random() < healthcheck_ratio

        payload_a = build_payload(
            row,
            vendor="a",
            timestamp_ns=base_ts + jitter,
            base_ts_ns=base_ts,
            include_healthcheck=include_healthcheck,
        )
        payload_b = build_payload(
            row,
            vendor="b",
            timestamp_ns=base_ts + jitter,
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
