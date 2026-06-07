.PHONY: cluster cluster-delete repos repos-remove ns ns-remove check-glassflow-chart \
        test-glassflow-chart test-clickstack-chart install uninstall build-emitter load-emitter \
        deploy-pipeline deploy-pipeline-no-dedup switch-collectors-dedup \
        switch-collectors-no-dedup create-clickhouse-tables \
        grafana-dashboard emitter emitter-remove deploy-stack status teardown \
        pf-grafana pf-glassflow pf-glassflow-api pf-clickhouse

_DEMO_ROOT := $(abspath $(dir $(lastword $(MAKEFILE_LIST))))

GLASSFLOW_API_URL       ?= http://localhost:8080
CLICKHOUSE_HOST         ?= localhost
CLICKHOUSE_PORT         ?= 9000
CLICKHOUSE_HTTP_PORT    ?= 8123
CLICKHOUSE_USER         ?= default
CLICKHOUSE_PASSWORD     ?=
CLICKHOUSE_SINK_USER    ?= otelcollector
CLICKHOUSE_SINK_PASSWORD ?= otelcollectorpass
CLICKHOUSE_DEPLOYMENT   ?= clickstack-clickhouse
CLICKHOUSE_SERVICE      ?= clickstack-clickhouse
CLUSTER_NAME            ?= 5g-telemetry
GLASSFLOW_CHART         ?= glassflow/glassflow-etl
GLASSFLOW_CHART_VERSION ?= 0.5.16
EMITTER_IMAGE           ?= 5g-emitter:latest
_GLASSFLOW_VERSION_ARG  := $(if $(filter %.tgz,$(GLASSFLOW_CHART)),,--version $(GLASSFLOW_CHART_VERSION))

# ---------------------------------------------------------------------------
# Kind cluster
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
	helm repo add grafana       https://grafana.github.io/helm-charts
	helm repo update opentelemetry glassflow clickstack grafana

repos-remove:
	-helm repo remove opentelemetry
	-helm repo remove glassflow
	-helm repo remove clickstack
	-helm repo remove grafana

# ---------------------------------------------------------------------------
# Namespaces
# ---------------------------------------------------------------------------
ns:
	kubectl create namespace otel        --dry-run=client -o yaml | kubectl apply -f -
	kubectl create namespace glassflow   --dry-run=client -o yaml | kubectl apply -f -
	kubectl create namespace clickhouse  --dry-run=client -o yaml | kubectl apply -f -
	kubectl create namespace grafana     --dry-run=client -o yaml | kubectl apply -f -

ns-remove:
	-kubectl delete namespace otel
	-kubectl delete namespace glassflow
	-kubectl delete namespace clickhouse
	-kubectl delete namespace grafana

# ---------------------------------------------------------------------------
# Chart smoke tests
# ---------------------------------------------------------------------------
check-glassflow-chart:
	@case "$(GLASSFLOW_CHART)" in *.tgz) \
	  test -f "$(GLASSFLOW_CHART)" || (echo "Missing GlassFlow chart file: $(GLASSFLOW_CHART)" >&2; exit 1); \
	  ;; esac

test-glassflow-chart: check-glassflow-chart
	helm template glassflow "$(GLASSFLOW_CHART)" \
	    $(_GLASSFLOW_VERSION_ARG) \
	    --namespace glassflow \
	    -f "$(_DEMO_ROOT)/k8s/helm-values/glassflow.values.yaml" >/dev/null
	@echo "helm template OK ($(GLASSFLOW_CHART))"

test-clickstack-chart:
	helm template clickstack clickstack/clickstack \
	    --namespace clickhouse \
	    -f "$(_DEMO_ROOT)/k8s/helm-values/clickstack.values.yaml" >/dev/null
	@echo "helm template OK (clickstack/clickstack)"

# ---------------------------------------------------------------------------
# Helm installs
# ---------------------------------------------------------------------------
install: ns check-glassflow-chart test-clickstack-chart
	helm upgrade --install clickstack clickstack/clickstack \
	    --namespace clickhouse \
	    -f "$(_DEMO_ROOT)/k8s/helm-values/clickstack.values.yaml" \
	    --wait --timeout 10m

	helm upgrade --install otel-collector-a opentelemetry/opentelemetry-collector \
	    --namespace otel \
	    -f "$(_DEMO_ROOT)/k8s/helm-values/otel-collector-a.values.yaml" \
	    --wait

	helm upgrade --install otel-collector-b opentelemetry/opentelemetry-collector \
	    --namespace otel \
	    -f "$(_DEMO_ROOT)/k8s/helm-values/otel-collector-b.values.yaml" \
	    --wait

	@echo "==> GlassFlow Helm chart: $(GLASSFLOW_CHART)"
	helm upgrade --install glassflow "$(GLASSFLOW_CHART)" \
	    $(_GLASSFLOW_VERSION_ARG) \
	    --namespace glassflow \
	    -f "$(_DEMO_ROOT)/k8s/helm-values/glassflow.values.yaml" \
	    --wait --timeout 10m

	$(MAKE) grafana-dashboard
	helm upgrade --install grafana grafana/grafana \
	    --namespace grafana \
	    -f "$(_DEMO_ROOT)/k8s/helm-values/grafana.values.yaml" \
	    --wait

uninstall:
	-helm uninstall grafana           --namespace grafana
	-helm uninstall glassflow          --namespace glassflow
	-helm uninstall otel-collector-b   --namespace otel
	-helm uninstall otel-collector-a   --namespace otel
	-helm uninstall clickstack         --namespace clickhouse

# ---------------------------------------------------------------------------
# Grafana dashboard ConfigMap
# ---------------------------------------------------------------------------
grafana-dashboard:
	kubectl create configmap 5g-grafana-dashboard \
	    --from-file=5g-dashboard.json="$(_DEMO_ROOT)/grafana/5g-dashboard.json" \
	    -n grafana --dry-run=client -o yaml | kubectl apply -f -

# ---------------------------------------------------------------------------
# GlassFlow pipelines
# ---------------------------------------------------------------------------
deploy-pipeline:
	@echo "Deploying 5G metrics pipeline (POST $(GLASSFLOW_API_URL)/api/v1/pipeline)..."
	@code=$$(curl -sS -o /tmp/glassflow-5g-pipeline-response.json -w "%{http_code}" \
	    -X POST "$(GLASSFLOW_API_URL)/api/v1/pipeline" \
	    -H "Content-Type: application/json" \
	    -d @"$(_DEMO_ROOT)/glassflow-pipelines/5g-metrics-pipeline.json"); \
	echo "HTTP $$code"; \
	cat /tmp/glassflow-5g-pipeline-response.json; echo; \
	if [ "$$code" -lt 200 ] || [ "$$code" -ge 300 ]; then \
	  echo "deploy-pipeline failed. Run make pf-glassflow-api first." >&2; \
	  exit 1; \
	fi
	@echo "Pipeline deployed."

deploy-pipeline-no-dedup:
	@echo "Deploying 5G metrics pipeline WITHOUT dedup..."
	@code=$$(curl -sS -o /tmp/glassflow-5g-pipeline-response.json -w "%{http_code}" \
	    -X POST "$(GLASSFLOW_API_URL)/api/v1/pipeline" \
	    -H "Content-Type: application/json" \
	    -d @"$(_DEMO_ROOT)/glassflow-pipelines/5g-metrics-pipeline-no-dedup.json"); \
	echo "HTTP $$code"; \
	cat /tmp/glassflow-5g-pipeline-response.json; echo; \
	if [ "$$code" -lt 200 ] || [ "$$code" -ge 300 ]; then exit 1; fi

switch-collectors-dedup:
	helm upgrade otel-collector-a opentelemetry/opentelemetry-collector \
	    --namespace otel \
	    -f "$(_DEMO_ROOT)/k8s/helm-values/otel-collector-a.values.yaml" \
	    --wait
	helm upgrade otel-collector-b opentelemetry/opentelemetry-collector \
	    --namespace otel \
	    -f "$(_DEMO_ROOT)/k8s/helm-values/otel-collector-b.values.yaml" \
	    --wait

switch-collectors-no-dedup:
	helm upgrade otel-collector-a opentelemetry/opentelemetry-collector \
	    --namespace otel \
	    -f "$(_DEMO_ROOT)/k8s/helm-values/otel-collector-a-no-dedup.values.yaml" \
	    --wait
	helm upgrade otel-collector-b opentelemetry/opentelemetry-collector \
	    --namespace otel \
	    -f "$(_DEMO_ROOT)/k8s/helm-values/otel-collector-b-no-dedup.values.yaml" \
	    --wait

# ---------------------------------------------------------------------------
# ClickHouse schema
# ---------------------------------------------------------------------------
create-clickhouse-tables:
	@echo "Creating ran_metrics table..."
	@auth_args="--user=$(CLICKHOUSE_USER)"; \
	if [ -n "$(CLICKHOUSE_PASSWORD)" ]; then \
	  auth_args="$$auth_args --password=$(CLICKHOUSE_PASSWORD)"; \
	fi; \
	if command -v clickhouse-client >/dev/null 2>&1; then \
	  clickhouse-client --host=$(CLICKHOUSE_HOST) --port=$(CLICKHOUSE_PORT) \
	    $$auth_args \
	    --multiquery < "$(_DEMO_ROOT)/clickhouse/create_otel_tables.sql"; \
	else \
	  echo "clickhouse-client not found locally; using in-cluster ClickHouse client."; \
	  kubectl exec -i -n clickhouse deploy/$(CLICKHOUSE_DEPLOYMENT) -- \
	    clickhouse-client $$auth_args \
	    --multiquery < "$(_DEMO_ROOT)/clickhouse/create_otel_tables.sql"; \
	fi
	@echo "Tables created."

# ---------------------------------------------------------------------------
# 5G emitter image + Job
# ---------------------------------------------------------------------------
build-emitter:
	docker build -t $(EMITTER_IMAGE) "$(_DEMO_ROOT)/emitter"

load-emitter: build-emitter
	kind load docker-image $(EMITTER_IMAGE) --name $(CLUSTER_NAME)

emitter: load-emitter
	-kubectl delete job 5g-emitter -n otel --ignore-not-found
	kubectl apply -f "$(_DEMO_ROOT)/k8s/telemetry/5g-emitter-job.yaml"
	@echo "Emitter Job submitted. Watch: kubectl logs -n otel -l app=5g-emitter -f"

emitter-remove:
	-kubectl delete -f "$(_DEMO_ROOT)/k8s/telemetry/5g-emitter-job.yaml"

# ---------------------------------------------------------------------------
# Full stack
# ---------------------------------------------------------------------------
deploy-stack: repos install create-clickhouse-tables deploy-pipeline emitter
	@echo ""
	@echo "Stack deployed."
	@echo "  GlassFlow API: make pf-glassflow-api  (http://localhost:8080)"
	@echo "  GlassFlow UI:  make pf-glassflow      (http://localhost:8081)"
	@echo "  Grafana:       make pf-grafana        (http://localhost:3000, admin/admin)"
	@echo "  ClickHouse:    make pf-clickhouse"

teardown: emitter-remove uninstall ns-remove

# ---------------------------------------------------------------------------
# Port-forwarding
# ---------------------------------------------------------------------------
pf-glassflow:
	kubectl port-forward -n glassflow svc/glassflow-ui 8081:8080

pf-glassflow-api:
	kubectl port-forward -n glassflow svc/glassflow-api 8080:8081

pf-grafana:
	kubectl port-forward -n grafana svc/grafana 3000:80

pf-clickhouse:
	kubectl port-forward -n clickhouse svc/$(CLICKHOUSE_SERVICE) $(CLICKHOUSE_HTTP_PORT):8123 $(CLICKHOUSE_PORT):9000

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
	@echo "=== clickhouse ==="
	kubectl get pods -n clickhouse
	@echo ""
	@echo "=== grafana ==="
	kubectl get pods -n grafana
