#!/bin/bash

# Test script dla Offer API

API_URL="${API_URL:-http://localhost:7077}"
API_KEY="${API_KEY:-devkey}"

echo "=========================================="
echo "Testing Offer Rendering API"
echo "=========================================="
echo "API URL: $API_URL"
echo ""

# Test 1: Health check
echo "1. Testing health endpoint..."
curl -s "$API_URL/health" | python3 -m json.tool
echo ""
echo ""

# Test 2: Simple render (first page only)
echo "2. Testing simple render (first page only)..."
curl -X POST "$API_URL/render" \
  -H "X-API-Key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d @examples/test_simple.json \
  -o test_output_simple.jpg \
  --write-out "\nHTTP Status: %{http_code}\n" \
  --silent --show-error

if [ -f test_output_simple.jpg ]; then
  echo "✅ SUCCESS! Output saved to: test_output_simple.jpg"
  ls -lh test_output_simple.jpg
  echo ""
  echo "Open the image:"
  echo "  open test_output_simple.jpg  # macOS"
  echo "  xdg-open test_output_simple.jpg  # Linux"
else
  echo "❌ FAILED! Check error above"
fi

echo ""
echo ""

# Test 3: Full render (ZIP)
echo "3. Testing full render with products (ZIP)..."
curl -X POST "$API_URL/render" \
  -H "X-API-Key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d @examples/request_oferta_podstawowa.json \
  -o test_output_full.zip \
  --write-out "\nHTTP Status: %{http_code}\n" \
  --silent --show-error

if [ -f test_output_full.zip ]; then
  echo "✅ SUCCESS! Output saved to: test_output_full.zip"
  ls -lh test_output_full.zip

  echo ""
  echo "Extract and view:"
  echo "  unzip -o test_output_full.zip -d test_output/"
  echo "  open test_output/page_001.jpg"

  # Auto extract
  mkdir -p test_output
  unzip -o test_output_full.zip -d test_output/ > /dev/null 2>&1
  echo ""
  echo "Extracted pages:"
  ls -1 test_output/*.jpg 2>/dev/null || echo "No JPG files extracted"
else
  echo "❌ FAILED! Check error above"
fi

echo ""
echo "=========================================="
echo "Tests complete!"
echo "=========================================="
