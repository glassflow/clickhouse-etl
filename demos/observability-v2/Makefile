.PHONY: repos repos-remove ns ns-remove install uninstall telemetry telemetry-remove \
        deploy-pipelines create-clickhouse-tables deploy-stack status \
        pf-hyperdx pf-glassflow

GLASSFLOW_API_URL ?= http://localhost:8080
CLICKHOUSE_HOST   ?= localhost
CLICKHOUSE_PORT   ?= 9000

# ---------------------------------------------------------------------------
# Helm repositories
# ---------------------------------------------------------------------------
repos:
	helm repo add opentelemetry https://open-telemetry.github.io/opentelemetry-helm-charts
	helm repo add glassflow     https://glassflow.github.io/helm-charts
	helm repo add clickstack    https://hyperdxio.github.io/helm-charts
	helm repo update

repos-remove:
	-helm repo remove opentelemetry
	-helm repo remove glassflow
	-helm repo remove clickstack

# ---------------------------------------------------------------------------
# Kubernetes namespaces (no kafka namespace needed in v2)
# ---------------------------------------------------------------------------
ns:
	kubectl create namespace otel      --dry-run=client -o yaml | kubectl apply -f -
	kubectl create namespace glassflow --dry-run=client -o yaml | kubectl apply -f -
	kubectl create namespace hyperdx   --dry-run=client -o yaml | kubectl apply -f -

ns-remove:
	-kubectl delete namespace otel
	-kubectl delete namespace glassflow
	-kubectl delete namespace hyperdx

# ---------------------------------------------------------------------------
# Helm installs
# ---------------------------------------------------------------------------
install: ns
	helm upgrade --install otel opentelemetry/opentelemetry-collector \
	    --namespace otel \
	    -f k8s/helm-values/otel-collector.values.yaml \
	    --wait

	helm upgrade --install glassflow glassflow/glassflow \
	    --namespace glassflow \
	    -f k8s/helm-values/glassflow.values.yaml \
	    --wait

	helm upgrade --install hyperdx clickstack/clickstack \
	    --namespace hyperdx \
	    -f k8s/helm-values/hyperdx.values.yaml \
	    --wait

uninstall:
	-helm uninstall otel      --namespace otel
	-helm uninstall glassflow --namespace glassflow
	-helm uninstall hyperdx   --namespace hyperdx

# ---------------------------------------------------------------------------
# GlassFlow pipelines (via GlassFlow API)
# ---------------------------------------------------------------------------
deploy-pipelines:
	@echo "Deploying GlassFlow OTLP pipelines..."
	curl -sf -X POST $(GLASSFLOW_API_URL)/api/v1/pipeline \
	    -H "Content-Type: application/json" \
	    -d @glassflow-pipelines/logs-pipeline.json
	curl -sf -X POST $(GLASSFLOW_API_URL)/api/v1/pipeline \
	    -H "Content-Type: application/json" \
	    -d @glassflow-pipelines/metrics-pipeline.json
	curl -sf -X POST $(GLASSFLOW_API_URL)/api/v1/pipeline \
	    -H "Content-Type: application/json" \
	    -d @glassflow-pipelines/traces-pipeline.json
	@echo "Pipelines deployed."

# ---------------------------------------------------------------------------
# ClickHouse schema
# ---------------------------------------------------------------------------
create-clickhouse-tables:
	@echo "Creating ClickHouse OTel tables..."
	clickhouse-client --host=$(CLICKHOUSE_HOST) --port=$(CLICKHOUSE_PORT) \
	    --multiquery < clickhouse/create_otel_tables.sql
	@echo "Tables created."

# ---------------------------------------------------------------------------
# Synthetic telemetry generators
# ---------------------------------------------------------------------------
telemetry:
	kubectl apply -f k8s/telemetry/telemetrygen-logs.yaml
	kubectl apply -f k8s/telemetry/telemetrygen-traces.yaml
	kubectl apply -f k8s/telemetry/telemetrygen-metrics-gauge.yaml
	kubectl apply -f k8s/telemetry/telemetrygen-metrics-sum.yaml

telemetry-remove:
	-kubectl delete -f k8s/telemetry/telemetrygen-logs.yaml
	-kubectl delete -f k8s/telemetry/telemetrygen-traces.yaml
	-kubectl delete -f k8s/telemetry/telemetrygen-metrics-gauge.yaml
	-kubectl delete -f k8s/telemetry/telemetrygen-metrics-sum.yaml

# ---------------------------------------------------------------------------
# Full stack deployment
# ---------------------------------------------------------------------------
deploy-stack: repos install deploy-pipelines create-clickhouse-tables telemetry
	@echo ""
	@echo "Stack deployed. Run 'make pf-glassflow' and 'make pf-hyperdx' to open the UIs."

# ---------------------------------------------------------------------------
# Port-forwarding
# ---------------------------------------------------------------------------
pf-glassflow:
	kubectl port-forward -n glassflow svc/glassflow-ui 8080:8080

pf-hyperdx:
	kubectl port-forward -n hyperdx svc/hyperdx-clickstack 8090:3000

# ---------------------------------------------------------------------------
# Status
# ---------------------------------------------------------------------------
status:
	@echo "=== otel ==="
	kubectl get pods -n otel
	@echo ""
	@echo "=== glassflow ==="
	kubectl get pods -n glassflow
	@echo ""
	@echo "=== hyperdx ==="
	kubectl get pods -n hyperdx
