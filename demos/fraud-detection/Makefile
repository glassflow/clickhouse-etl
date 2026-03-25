.PHONY: repos ns install uninstall status \
        pf-glassflow-api pf-glassflow-ui \
        setup create-table create-pipeline generate-events publish-events \
        query-fraud query-burst query-hourly \
        install-stack delete-stack deploy-demo delete-demo

SHELL := /bin/bash
.ONESHELL:

# ── Namespace configuration ───────────────────────────────────────────────────
KAFKA_NS         ?= kafka
CLICKHOUSE_NS    ?= clickhouse
GLASSFLOW_NS     ?= glassflow

# ── Helm chart releases ───────────────────────────────────────────────────────
KAFKA_RELEASE        ?= kafka
CLICKHOUSE_RELEASE   ?= clickhouse
GLASSFLOW_RELEASE    ?= glassflow

HELM_VALUES := k8s/helm-values
TIMEOUT     ?= 10m

# ── Service / auth configuration ─────────────────────────────────────────────
CLICKHOUSE_SVC   ?= $(CLICKHOUSE_RELEASE)
CLICKHOUSE_USER  ?= default
CLICKHOUSE_PASS  ?= secret

KAFKA_SVC        ?= $(KAFKA_RELEASE)
KAFKA_TOPIC      ?= login-attempts

GLASSFLOW_SVC    ?= $(GLASSFLOW_RELEASE)-api
GLASSFLOW_PORT   ?= 8081
GLASSFLOW_HOST   ?= http://localhost:$(GLASSFLOW_PORT)

# ── File paths ────────────────────────────────────────────────────────────────
PIPELINE_JSON    ?= glassflow/fraud_detection_pipeline.json
SQL_FILE         ?= sql/fraud_detection_queries.sql
EVENT_FILE       ?= data/login-events.ndjson
VENV             ?= .venv

# ════════════════════════════════════════════════════════════════════════════
# Stack management (Helm)
# ════════════════════════════════════════════════════════════════════════════

repos:
	helm repo add bitnami https://charts.bitnami.com/bitnami || true
	helm repo add glassflow https://glassflow.github.io/charts || true
	helm repo update

repos-remove:
	helm repo remove bitnami || true
	helm repo remove glassflow || true

ns:
	kubectl create namespace $(KAFKA_NS)        --dry-run=client -o yaml | kubectl apply -f -
	kubectl create namespace $(CLICKHOUSE_NS)   --dry-run=client -o yaml | kubectl apply -f -
	kubectl create namespace $(GLASSFLOW_NS)    --dry-run=client -o yaml | kubectl apply -f -

ns-remove:
	kubectl delete namespace $(KAFKA_NS)      || true
	kubectl delete namespace $(CLICKHOUSE_NS) || true
	kubectl delete namespace $(GLASSFLOW_NS)  || true

install:
	# Kafka (Bitnami, no auth)
	helm install $(KAFKA_RELEASE) oci://registry-1.docker.io/bitnamicharts/kafka \
	  -n $(KAFKA_NS) -f $(HELM_VALUES)/kafka.values.yaml --create-namespace=false || true

	# ClickHouse (Bitnami)
	helm install $(CLICKHOUSE_RELEASE) oci://registry-1.docker.io/bitnamicharts/clickhouse \
	  -n $(CLICKHOUSE_NS) -f $(HELM_VALUES)/clickhouse.values.yaml --create-namespace=false || true

	# GlassFlow
	helm install $(GLASSFLOW_RELEASE) glassflow/glassflow-etl \
	  -n $(GLASSFLOW_NS) -f $(HELM_VALUES)/glassflow.values.yaml --create-namespace=false || true

uninstall:
	-helm uninstall $(GLASSFLOW_RELEASE)   -n $(GLASSFLOW_NS)
	-helm uninstall $(CLICKHOUSE_RELEASE)  -n $(CLICKHOUSE_NS)
	-helm uninstall $(KAFKA_RELEASE)       -n $(KAFKA_NS)

status:
	kubectl get pods -n $(KAFKA_NS)
	kubectl get pods -n $(CLICKHOUSE_NS)
	kubectl get pods -n $(GLASSFLOW_NS)

pf-glassflow-api:
	kubectl -n $(GLASSFLOW_NS) port-forward svc/$(GLASSFLOW_SVC) $(GLASSFLOW_PORT):8081

pf-glassflow-ui:
	kubectl -n $(GLASSFLOW_NS) port-forward svc/$(GLASSFLOW_RELEASE)-ui 8080:8080

# ── Full stack install (with readiness waits) ─────────────────────────────────
install-stack: repos ns install
	# Wait for Kafka
	kubectl rollout status -n $(KAFKA_NS) statefulset/$(KAFKA_RELEASE)-controller --timeout=$(TIMEOUT)
	# Wait for ClickHouse
	kubectl rollout status -n $(CLICKHOUSE_NS) statefulset/$(CLICKHOUSE_RELEASE)-shard0 --timeout=$(TIMEOUT)
	# Wait for GlassFlow API
	kubectl rollout status -n $(GLASSFLOW_NS) deploy/$(GLASSFLOW_RELEASE)-api --timeout=$(TIMEOUT)
	@echo "✓ Stack is ready"

# ── Full stack teardown ───────────────────────────────────────────────────────
delete-stack: uninstall ns-remove repos-remove
	@echo "✓ Stack deleted"

# ════════════════════════════════════════════════════════════════════════════
# Demo steps
# ════════════════════════════════════════════════════════════════════════════

# ── 1. Python virtual environment ─────────────────────────────────────────────
setup:
	python3 -m venv $(VENV)
	$(VENV)/bin/pip install --quiet -r requirements.txt
	@echo "✓ Python environment ready"

# ── 2. Create the ClickHouse table ────────────────────────────────────────────
create-table:
	kubectl exec -i -n $(CLICKHOUSE_NS) svc/$(CLICKHOUSE_SVC) -- \
	  clickhouse-client \
	    --user $(CLICKHOUSE_USER) \
	    --password $(CLICKHOUSE_PASS) \
	    --multiquery \
	  < $(SQL_FILE)
	@echo "✓ ClickHouse table created"

# ── 3. Create the GlassFlow pipeline (requires port-forward to be running) ────
create-pipeline: setup
	$(VENV)/bin/python scripts/create_pipeline.py \
	  --host $(GLASSFLOW_HOST) \
	  --pipeline-json $(PIPELINE_JSON)

# ── 4. Generate a fresh event dataset ────────────────────────────────────────
generate-events:
	python3 scripts/generate_login_events.py --output $(EVENT_FILE)
	@echo "✓ Events written to $(EVENT_FILE)"

# ── 5. Publish events to Kafka ────────────────────────────────────────────────
publish-events:
	chmod +x scripts/publish_to_kafka.sh
	KAFKA_NS=$(KAFKA_NS) KAFKA_SVC=$(KAFKA_SVC) \
	  ./scripts/publish_to_kafka.sh $(EVENT_FILE) $(KAFKA_TOPIC)

# ── 6. Fraud detection queries ────────────────────────────────────────────────
query-fraud:
	@echo "── 5-minute brute-force window ──────────────────────────────────────"
	kubectl exec -n $(CLICKHOUSE_NS) svc/$(CLICKHOUSE_SVC) -- \
	  clickhouse-client \
	    --user $(CLICKHOUSE_USER) \
	    --password $(CLICKHOUSE_PASS) \
	    --query "\
	SELECT \
	    toStartOfInterval(event_time, INTERVAL 5 MINUTE) AS window_start, \
	    user_id, \
	    ip_address, \
	    count()              AS failed_attempts, \
	    uniqExact(device_id) AS distinct_devices \
	FROM fraud_login_events \
	GROUP BY window_start, user_id, ip_address \
	HAVING failed_attempts >= 5 \
	ORDER BY window_start DESC, failed_attempts DESC \
	FORMAT Vertical"

query-burst:
	@echo "── 30-second burst detection ────────────────────────────────────────"
	kubectl exec -n $(CLICKHOUSE_NS) svc/$(CLICKHOUSE_SVC) -- \
	  clickhouse-client \
	    --user $(CLICKHOUSE_USER) \
	    --password $(CLICKHOUSE_PASS) \
	    --query "\
	SELECT \
	    toStartOfInterval(event_time, INTERVAL 30 SECOND) AS window_start, \
	    user_id, \
	    ip_address, \
	    count() AS failed_attempts \
	FROM fraud_login_events \
	GROUP BY window_start, user_id, ip_address \
	HAVING failed_attempts >= 4 \
	ORDER BY window_start DESC, failed_attempts DESC \
	FORMAT Vertical"

query-hourly:
	@echo "── 1-hour distributed attack view ───────────────────────────────────"
	kubectl exec -n $(CLICKHOUSE_NS) svc/$(CLICKHOUSE_SVC) -- \
	  clickhouse-client \
	    --user $(CLICKHOUSE_USER) \
	    --password $(CLICKHOUSE_PASS) \
	    --query "\
	SELECT \
	    toStartOfInterval(event_time, INTERVAL 1 HOUR) AS hour_start, \
	    user_id, \
	    uniqExact(ip_address) AS unique_ips, \
	    count()               AS failed_attempts \
	FROM fraud_login_events \
	GROUP BY hour_start, user_id \
	HAVING failed_attempts >= 8 OR unique_ips >= 3 \
	ORDER BY hour_start DESC, failed_attempts DESC \
	FORMAT Vertical"

# ════════════════════════════════════════════════════════════════════════════
# Convenience targets
# ════════════════════════════════════════════════════════════════════════════

# Run the full demo end-to-end (stack must already be up; port-forward must be running)
deploy-demo: setup create-table create-pipeline publish-events
	@echo ""
	@echo "✓ Demo deployed. Run 'make query-fraud' to see results."

# Tear down the demo (drop table, delete pipeline). Does not remove the stack.
delete-demo:
	kubectl exec -n $(CLICKHOUSE_NS) svc/$(CLICKHOUSE_SVC) -- \
	  clickhouse-client \
	    --user $(CLICKHOUSE_USER) \
	    --password $(CLICKHOUSE_PASS) \
	    --query "DROP TABLE IF EXISTS fraud_login_events" || true
	@echo "✓ ClickHouse table dropped"
	$(VENV)/bin/python scripts/delete_pipeline.py --host $(GLASSFLOW_HOST) || true
