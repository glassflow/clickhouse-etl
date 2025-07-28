#!/bin/bash

# Test script for mock API endpoints
BASE_URL="http://localhost:8080/api/mock"

echo "🧪 Testing Mock API Endpoints"
echo "=============================="

# Test pipeline endpoints
echo -e "\n📋 Testing Pipeline:"
echo "GET /pipeline (list pipelines)"
curl -s "$BASE_URL/pipeline" | jq '.success, .total, .pipelines[0].pipeline_id'

echo -e "\nGET /pipeline/pipeline-001 (detailed pipeline)"
curl -s "$BASE_URL/pipeline/pipeline-001" | jq '.success, .pipeline.name'

echo -e "\nPOST /pipeline (create pipeline)"
curl -s -X POST "$BASE_URL/pipeline" \
  -H "Content-Type: application/json" \
  -d '{"name": "Test Pipeline"}' | jq '.success, .pipeline.name'

# Test DLQ endpoints
echo -e "\n📊 Testing DLQ:"
echo "GET /pipeline/pipeline-001/dlq/state"
curl -s "$BASE_URL/pipeline/pipeline-001/dlq/state" | jq '.total_messages, .unconsumed_messages'

echo -e "\nGET /pipeline/pipeline-001/dlq"
curl -s "$BASE_URL/pipeline/pipeline-001/dlq" | jq '.success, .total'

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