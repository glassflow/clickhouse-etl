#!/bin/bash

# Test script for mock API endpoints
BASE_URL="http://localhost:8080/api/mock"

echo "🧪 Testing Mock API Endpoints"
echo "=============================="

# Test pipelines endpoints
echo -e "\n📋 Testing Pipelines:"
echo "GET /pipelines"
curl -s "$BASE_URL/pipelines" | jq '.success, .total'

echo -e "\nGET /pipelines/pipeline-001"
curl -s "$BASE_URL/pipelines/pipeline-001" | jq '.success, .pipeline.name'

echo -e "\nPOST /pipelines"
curl -s -X POST "$BASE_URL/pipelines" \
  -H "Content-Type: application/json" \
  -d '{"name": "Test Pipeline"}' | jq '.success, .pipeline.name'

# Test DLQ endpoints
echo -e "\n📊 Testing DLQ:"
echo "GET /pipelines/pipeline-001/dlq/stats"
curl -s "$BASE_URL/pipelines/pipeline-001/dlq/stats" | jq '.success, .stats.total_failed_events'

echo -e "\nGET /pipelines/pipeline-001/dlq"
curl -s "$BASE_URL/pipelines/pipeline-001/dlq" | jq '.success, .total'

# Test schemas endpoints
echo -e "\n📝 Testing Schemas:"
echo "GET /schemas"
curl -s "$BASE_URL/schemas" | jq '.success, .total'

echo -e "\nGET /schemas/schema-001"
curl -s "$BASE_URL/schemas/schema-001" | jq '.success, .schema.name'

echo -e "\nPOST /schemas"
curl -s -X POST "$BASE_URL/schemas" \
  -H "Content-Type: application/json" \
  -d '{"name": "Test Schema", "version": "1.0.0"}' | jq '.success, .schema.name'

echo -e "\n✅ All tests completed!" 