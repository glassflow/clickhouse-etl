FROM python:3.12-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends git unzip \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY emitter.py .

ENV DATASET_DIR=/data/5Gdataset \
    OTEL_ENDPOINT_A=http://otel-collector-a.otel.svc.cluster.local:4318/v1/metrics \
    OTEL_ENDPOINT_B=http://otel-collector-b.otel.svc.cluster.local:4318/v1/metrics \
    REPLAY_BATCH_SIZE=50 \
    REPLAY_DELAY_MS=100 \
    HEALTHCHECK_RATIO=0.05

ENTRYPOINT ["python", "-u", "emitter.py"]
