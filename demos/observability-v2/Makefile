.PHONY: cluster cluster-delete repos repos-remove ns ns-remove check-glassflow-chart \
        test-glassflow-chart install uninstall \
        telemetry telemetry-remove deploy-pipelines create-clickhouse-tables \
        deploy-stack status pf-hyperdx pf-glassflow pf-glassflow-api

# Directory of this Makefile — all relative assets resolve here so `make -f …/Makefile`
# or running from the repo root still finds k8s/, glassflow-pipelines/, etc.
_DEMO_ROOT := $(abspath $(dir $(lastword $(MAKEFILE_LIST))))

GLASSFLOW_API_URL      ?= http://localhost:8080
CLICKHOUSE_HOST        ?= localhost
CLICKHOUSE_PORT        ?= 9000
CLICKHOUSE_USER        ?= default
CLICKHOUSE_PASSWORD    ?=
CLICKHOUSE_ADMIN_USER  ?= default
CLICKHOUSE_ADMIN_PASSWORD ?=
CLICKHOUSE_DEPLOYMENT  ?= hyperdx-clickstack-clickhouse
CLUSTER_NAME           ?= observability-v2
GLASSFLOW_CHART        ?= glassflow/glassflow-etl
GLASSFLOW_CHART_VERSION ?= 0.5.16
_GLASSFLOW_VERSION_ARG := $(if $(filter %.tgz,$(GLASSFLOW_CHART)),,--version $(GLASSFLOW_CHART_VERSION))

# ---------------------------------------------------------------------------
# Kind cluster (Kubernetes v1.28, sized for the full stack)
# ---------------------------------------------------------------------------
cluster:
	kind create cluster --name $(CLUSTER_NAME) --image kindest/node:v1.28.15 \
	    --config "$(_DEMO_ROOT)/k8s/kind-cluster.yaml"
	kubectl cluster-info --context kind-$(CLUSTER_NAME)

cluster-delete:
	kind delete cluster --name $(CLUSTER_NAME)

# ---------------------------------------------------------------------------
# Helm repositories
# ---------------------------------------------------------------------------
repos:
	helm repo add opentelemetry https://open-telemetry.github.io/opentelemetry-helm-charts
	helm repo add glassflow     https://glassflow.github.io/charts
	helm repo add clickstack    https://hyperdxio.github.io/helm-charts
	helm repo update opentelemetry glassflow clickstack

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
# GlassFlow chart
# ---------------------------------------------------------------------------
check-glassflow-chart:
	@case "$(GLASSFLOW_CHART)" in *.tgz) \
	  test -f "$(GLASSFLOW_CHART)" || (echo "Missing GlassFlow chart file: $(GLASSFLOW_CHART)" >&2; echo "Use the default published chart or point GLASSFLOW_CHART at an existing local .tgz." >&2; exit 1); \
	  ;; esac

# Renders manifests with demo values (no cluster required).
test-glassflow-chart: check-glassflow-chart
	helm template glassflow "$(GLASSFLOW_CHART)" \
	    $(_GLASSFLOW_VERSION_ARG) \
	    --namespace glassflow \
	    -f "$(_DEMO_ROOT)/k8s/helm-values/glassflow.values.yaml" >/dev/null
	@echo "helm template OK ($(GLASSFLOW_CHART))"

# ---------------------------------------------------------------------------
# Helm installs
# ---------------------------------------------------------------------------
install: ns check-glassflow-chart
	helm upgrade --install otel opentelemetry/opentelemetry-collector \
	    --namespace otel \
	    -f "$(_DEMO_ROOT)/k8s/helm-values/otel-collector.values.yaml" \
	    --wait

	@echo "==> GlassFlow Helm chart: $(GLASSFLOW_CHART)"
	helm upgrade --install glassflow "$(GLASSFLOW_CHART)" \
	    $(_GLASSFLOW_VERSION_ARG) \
	    --namespace glassflow \
	    -f "$(_DEMO_ROOT)/k8s/helm-values/glassflow.values.yaml" \
	    --wait --timeout 10m

	helm upgrade --install hyperdx clickstack/clickstack \
	    --namespace hyperdx \
	    -f "$(_DEMO_ROOT)/k8s/helm-values/hyperdx.values.yaml" \
	    --wait

uninstall:
	-helm uninstall otel      --namespace otel
	-helm uninstall glassflow --namespace glassflow
	-helm uninstall hyperdx   --namespace hyperdx

# ---------------------------------------------------------------------------
# GlassFlow pipelines (via GlassFlow API)
# ---------------------------------------------------------------------------
deploy-pipelines:
	@echo "Deploying GlassFlow OTLP traces pipeline (POST $(GLASSFLOW_API_URL)/api/v1/pipeline)..."
	@code=$$(curl -sS -o /tmp/glassflow-pipeline-response.json -w "%{http_code}" \
	    -X POST "$(GLASSFLOW_API_URL)/api/v1/pipeline" \
	    -H "Content-Type: application/json" \
	    -d @"$(_DEMO_ROOT)/glassflow-pipelines/traces-pipeline.json"); \
	echo "HTTP $$code"; \
	cat /tmp/glassflow-pipeline-response.json; echo; \
	if [ "$$code" -lt 200 ] || [ "$$code" -ge 300 ]; then \
	  echo "deploy-pipelines failed. Common cases: 409 = pipeline id already exists; 422 = JSON rejected (see body above); connection errors = run make pf-glassflow-api)." >&2; \
	  exit 1; \
	fi
	@echo "Pipeline deployed."

# ---------------------------------------------------------------------------
# ClickHouse schema
# ---------------------------------------------------------------------------
create-clickhouse-tables:
	@echo "Creating ClickHouse OTel tables..."
	@auth_args="--user=$(CLICKHOUSE_ADMIN_USER)"; \
	if [ -n "$(CLICKHOUSE_ADMIN_PASSWORD)" ]; then \
	  auth_args="$$auth_args --password=$(CLICKHOUSE_ADMIN_PASSWORD)"; \
	fi; \
	if command -v clickhouse-client >/dev/null 2>&1; then \
	  clickhouse-client --host=$(CLICKHOUSE_HOST) --port=$(CLICKHOUSE_PORT) \
	    $$auth_args \
	    --multiquery < "$(_DEMO_ROOT)/clickhouse/create_otel_tables.sql"; \
	else \
	  echo "clickhouse-client not found locally; using in-cluster ClickHouse client."; \
	  kubectl exec -i -n hyperdx deploy/$(CLICKHOUSE_DEPLOYMENT) -- \
	    clickhouse-client $$auth_args \
	    --multiquery < "$(_DEMO_ROOT)/clickhouse/create_otel_tables.sql"; \
	fi
	@echo "Tables created."

# ---------------------------------------------------------------------------
# Synthetic telemetry generators
# ---------------------------------------------------------------------------
telemetry:
	kubectl apply -f "$(_DEMO_ROOT)/k8s/telemetry/telemetrygen-traces.yaml"

telemetry-remove:
	-kubectl delete -f "$(_DEMO_ROOT)/k8s/telemetry/telemetrygen-traces.yaml"

# ---------------------------------------------------------------------------
# Full stack deployment
# ---------------------------------------------------------------------------
deploy-stack: repos install create-clickhouse-tables deploy-pipelines telemetry
	@echo ""
	@echo "Stack deployed. For pipelines/API: make pf-glassflow-api (then make deploy-pipelines if needed)."
	@echo "UIs: make pf-glassflow (GlassFlow) and make pf-hyperdx (HyperDX)."

# ---------------------------------------------------------------------------
# Port-forwarding
# ---------------------------------------------------------------------------
# GlassFlow UI (service port 8080) — use local 8081 so pf-glassflow-api can own localhost:8080
pf-glassflow:
	kubectl port-forward -n glassflow svc/glassflow-ui 8081:8080

# API listens on 8081 in-cluster; local 8080 → 8081 matches GLASSFLOW_API_URL=http://localhost:8080
pf-glassflow-api:
	kubectl port-forward -n glassflow svc/glassflow-api 8080:8081

pf-hyperdx:
	@if curl -fsS -I http://localhost:8090 >/dev/null 2>&1; then \
	  echo "HyperDX is already available at http://localhost:8090"; \
	else \
	  kubectl port-forward -n hyperdx svc/hyperdx-clickstack-app 8090:3000; \
	fi

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
