.PHONY: repos ns install telemetry uninstall status pf-hyperdx pf-glassflow deploy-pipelines create-clickhouse-tables create-kafka-topics

# Use a single shell per recipe to allow multi-line loops/conditionals
SHELL := /bin/bash
.ONESHELL:

# Namespace configuration
KAFKA_NS ?= kafka
OTEL_NS ?= otel
GLASSFLOW_NS ?= glassflow
HYPERDX_NS ?= hyperdx

# Chart releases
KAFKA_CHART_RELEASE ?= kafka
OTEL_CHART_RELEASE ?= opentelemetry-collector
GLASSFLOW_CHART_RELEASE ?= glassflow
HYPERDX_CHART_RELEASE ?= hyperdx

HELM_VALUES := k8s/helm-values

repos:
	helm repo add bitnami https://charts.bitnami.com/bitnami || true
	helm repo add opentelemetry https://open-telemetry.github.io/opentelemetry-helm-charts || true
	helm repo add glassflow https://glassflow.github.io/charts || true
	helm repo add hyperdx https://hyperdxio.github.io/helm-charts || true
	helm repo update

repos-remove:
	helm repo remove bitnami || true
	helm repo remove opentelemetry || true
	helm repo remove glassflow || true
	helm repo remove hyperdx || true

ns:
	kubectl create namespace $(KAFKA_NS) --dry-run=client -o yaml | kubectl apply -f -
	kubectl create namespace $(OTEL_NS) --dry-run=client -o yaml | kubectl apply -f -
	kubectl create namespace $(GLASSFLOW_NS) --dry-run=client -o yaml | kubectl apply -f -
	kubectl create namespace $(HYPERDX_NS) --dry-run=client -o yaml | kubectl apply -f -

ns-remove:
	kubectl delete namespace $(KAFKA_NS) || true
	kubectl delete namespace $(OTEL_NS) || true
	kubectl delete namespace $(GLASSFLOW_NS) || true
	kubectl delete namespace $(HYPERDX_NS) || true

install:
	# Kafka (Bitnami)
	helm install $(KAFKA_CHART_RELEASE) oci://registry-1.docker.io/bitnamicharts/kafka -n $(KAFKA_NS) -f $(HELM_VALUES)/kafka.values.yaml --create-namespace=false || true
	
	# OpenTelemetry Collector
	helm install $(OTEL_CHART_RELEASE) opentelemetry/opentelemetry-collector -n $(OTEL_NS) -f $(HELM_VALUES)/otel-collector.values.yaml --create-namespace=false || true
	
	# Glassflow
	helm install $(GLASSFLOW_CHART_RELEASE) glassflow/glassflow-etl -n $(GLASSFLOW_NS) --create-namespace=false -f $(HELM_VALUES)/glassflow.values.yaml --version=0.3.4 || true
	
	# HyperDX (with embedded ClickHouse)
	helm install $(HYPERDX_CHART_RELEASE) hyperdx/hdx-oss-v2 -n $(HYPERDX_NS) -f $(HELM_VALUES)/hyperdx.values.yaml --create-namespace=false || true

telemetry:
	kubectl apply -f k8s/telemetry/

telemetry-remove:
	kubectl delete -f k8s/telemetry/ || true

uninstall:
	-helm uninstall $(HYPERDX_CHART_RELEASE) -n $(HYPERDX_NS)
	-helm uninstall $(GLASSFLOW_CHART_RELEASE) -n $(GLASSFLOW_NS)
	-helm uninstall $(OTEL_CHART_RELEASE) -n $(OTEL_NS)
	-helm uninstall $(KAFKA_CHART_RELEASE) -n $(KAFKA_NS)

status:
	kubectl get pods -n $(KAFKA_NS)
	kubectl get pods -n $(OTEL_NS)
	kubectl get pods -n $(GLASSFLOW_NS)
	kubectl get pods -n $(HYPERDX_NS)

pf-hyperdx:
	kubectl -n $(HYPERDX_NS) port-forward svc/$(HYPERDX_CHART_RELEASE)-hdx-oss-v2-app 3000:3000

pf-glassflow-ui:
	kubectl -n $(GLASSFLOW_NS) port-forward svc/$(GLASSFLOW_CHART_RELEASE)-ui 8080:8080 >/dev/null 2>&1 & echo $$! > /tmp/gf_ui.pid

pf-glassflow-api:
	kubectl -n $(GLASSFLOW_NS) port-forward svc/$(GLASSFLOW_CHART_RELEASE)-api 8081:8081 >/dev/null 2>&1 & echo $$! > /tmp/gf_api.pid

deploy-pipelines:
	# Port-forward Glassflow API and deploy all pipelines
	set -e; \
	( kubectl -n $(GLASSFLOW_NS) port-forward svc/$(GLASSFLOW_CHART_RELEASE)-api 8081:8081 >/dev/null 2>&1 & echo $$! > /tmp/gf_pf.pid ); \
	sleep 3; \
	for f in glassflow-pipelines/*.json; do \
		echo "Deploying $$f"; \
		curl -sfS -X POST \
		  -H 'Content-Type: application/json' \
		  -d @"$$f" \
		  http://127.0.0.1:8081/api/v1/pipeline; \
	done; \
	kill $$(cat /tmp/gf_pf.pid) || true; \
	rm -f /tmp/gf_pf.pid

create-clickhouse-tables:
	# Create OpenTelemetry tables in ClickHouse
	kubectl exec -i -n $(HYPERDX_NS) deploy/$(HYPERDX_CHART_RELEASE)-hdx-oss-v2-clickhouse -- \
		clickhouse-client --multiquery < clickhouse/create_otel_tables.sql

create-kafka-topics:
	# Create all OpenTelemetry Kafka topics
	@echo "Creating Kafka topics..."
	@for topic in otel-logs otel-traces otel-metrics-sum otel-metrics-gauge otel-metrics-histogram otel-metrics-summary otel-metrics-exponential-histogram; do \
		echo "Checking if topic $$topic exists..."; \
		if kubectl exec -n $(KAFKA_NS) $(KAFKA_CHART_RELEASE)-controller-0 -- \
			kafka-topics.sh --bootstrap-server $(KAFKA_CHART_RELEASE).$(KAFKA_NS).svc.cluster.local:9092 --list 2>/dev/null | grep -q "$$topic"; then \
			echo "Topic $$topic already exists"; \
		else \
			echo "Creating topic $$topic..."; \
			kubectl exec -n $(KAFKA_NS) $(KAFKA_CHART_RELEASE)-controller-0 -- \
				kafka-topics.sh --bootstrap-server $(KAFKA_CHART_RELEASE).$(KAFKA_NS).svc.cluster.local:9092 --create \
				--topic $$topic --partitions 3 --replication-factor 1 2>&1 || true; \
		fi; \
	done

deploy-stack:
	# Prepare repos, namespaces and install stack
	$(MAKE) repos ns install

	# Wait for Kafka to be ready and make sure Kafka topics are created
	kubectl rollout status -n $(KAFKA_NS) statefulset/$(KAFKA_CHART_RELEASE)-controller --timeout=5m
	$(MAKE) create-kafka-topics

	# Wait for HyperDX and ClickHouse to be ready
	kubectl rollout status -n $(HYPERDX_NS) deploy/$(HYPERDX_CHART_RELEASE)-hdx-oss-v2-clickhouse --timeout=5m
	$(MAKE) create-clickhouse-tables

	# Wait for GlassFlow API to be ready
	kubectl rollout status -n $(GLASSFLOW_NS) deploy/$(GLASSFLOW_CHART_RELEASE)-api --timeout=5m
	$(MAKE) deploy-pipelines

	# Deploy telemetry generators
	$(MAKE) telemetry

delete-stack:
	# Uninstall stack
	$(MAKE) uninstall

	# Delete telemetry generators
	$(MAKE) telemetry-remove

	# Remove namespaces
	$(MAKE) ns-remove

	# Remove repos
	$(MAKE) repos-remove