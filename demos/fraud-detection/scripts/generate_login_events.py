#!/usr/bin/env python3
"""Generate sample login events for the Glassflow fraud detection tutorial."""

from __future__ import annotations

import argparse
import json
import random
import sys
from collections import Counter
from datetime import UTC, datetime, timedelta
from pathlib import Path
from uuid import UUID


NORMAL_USERS = [
    "alice",
    "bob",
    "charlie",
    "diana",
    "eve",
    "frank",
]

SUSPICIOUS_USERS = [
    "vip-admin",
    "payroll-admin",
]

COUNTRIES = ["US", "GB", "DE", "IN", "SG", "BR"]
FAILURE_REASONS = ["invalid_password", "mfa_failed", "account_locked"]
DEFAULT_START_TIME = datetime(2026, 3, 21, 16, 40, 0, tzinfo=UTC)


def isoformat_z(dt: datetime) -> str:
    return dt.astimezone(UTC).strftime("%Y-%m-%dT%H:%M:%SZ")


def make_event(
    rng: random.Random,
    event_time: datetime,
    user_id: str,
    ip_address: str,
    device_id: str,
    country: str,
    status: str,
    failure_reason: str = "",
) -> dict[str, str]:
    return {
        "event_id": str(UUID(int=rng.getrandbits(128), version=4)),
        "event_time": isoformat_z(event_time),
        "user_id": user_id,
        "ip_address": ip_address,
        "device_id": device_id,
        "country": country,
        "status": status,
        "failure_reason": failure_reason,
    }


def generate_normal_events(rng: random.Random, start_time: datetime, count: int) -> list[dict[str, str]]:
    events: list[dict[str, str]] = []
    for index in range(count):
        status = "failed" if rng.random() < 0.22 else "success"
        event_time = start_time + timedelta(seconds=index * rng.randint(2, 6))
        event = make_event(
            rng=rng,
            event_time=event_time,
            user_id=rng.choice(NORMAL_USERS),
            ip_address=f"203.0.113.{rng.randint(10, 200)}",
            device_id=f"device-{rng.randint(1000, 9999)}",
            country=rng.choice(COUNTRIES),
            status=status,
            failure_reason=rng.choice(FAILURE_REASONS) if status == "failed" else "",
        )
        events.append(event)
    return events


def generate_burst_events(rng: random.Random, start_time: datetime) -> list[dict[str, str]]:
    burst_user = rng.choice(SUSPICIOUS_USERS)
    burst_ip = f"198.51.100.{rng.randint(20, 40)}"
    events: list[dict[str, str]] = []
    burst_start = start_time + timedelta(minutes=5)

    for second in range(0, 40, 4):
        events.append(
            make_event(
                rng=rng,
                event_time=burst_start + timedelta(seconds=second),
                user_id=burst_user,
                ip_address=burst_ip,
                device_id=f"device-{9000 + second}",
                country="US",
                status="failed",
                failure_reason="invalid_password",
            )
        )

    return events


def add_duplicate_retries(
    rng: random.Random, events: list[dict[str, str]], duplicate_count: int
) -> list[dict[str, str]]:
    duplicates: list[dict[str, str]] = []
    failed_events = [event for event in events if event["status"] == "failed"]
    if not failed_events:
        return duplicates

    for _ in range(min(duplicate_count, len(failed_events))):
        duplicate = dict(rng.choice(failed_events))
        duplicates.append(duplicate)

    return duplicates


def build_events(count: int, seed: int, duplicate_count: int) -> list[dict[str, str]]:
    rng = random.Random(seed)
    start_time = DEFAULT_START_TIME

    normal_count = max(count - 10, 5)
    events = generate_normal_events(rng, start_time, normal_count)
    events.extend(generate_burst_events(rng, start_time))
    events.extend(add_duplicate_retries(rng, events, duplicate_count))
    events.sort(key=lambda event: event["event_time"])
    return events


def write_events(events: list[dict[str, str]], output_path: Path | None) -> None:
    payload = "\n".join(json.dumps(event) for event in events) + "\n"
    if output_path is None:
        print(payload, end="")
        return

    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(payload, encoding="utf-8")


def summarize_events(events: list[dict[str, str]]) -> str:
    status_counts = Counter(event["status"] for event in events)
    unique_ids = len({event["event_id"] for event in events})
    duplicate_rows = len(events) - unique_ids
    return (
        f"Generated {len(events)} events "
        f"({status_counts['failed']} failed, {status_counts['success']} success, "
        f"{duplicate_rows} duplicate retries)."
    )


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Generate login events for the Glassflow fraud detection tutorial."
    )
    parser.add_argument(
        "--count",
        type=int,
        default=40,
        help="Approximate number of base events before duplicates are added.",
    )
    parser.add_argument(
        "--duplicates",
        type=int,
        default=6,
        help="Number of duplicate failed-login rows to replay.",
    )
    parser.add_argument(
        "--seed",
        type=int,
        default=7,
        help="Random seed for deterministic output.",
    )
    parser.add_argument(
        "--output",
        type=Path,
        help="Write NDJSON events to this file instead of stdout.",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    events = build_events(
        count=max(args.count, 10),
        seed=args.seed,
        duplicate_count=max(args.duplicates, 0),
    )
    write_events(events, args.output)
    print(summarize_events(events), file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
