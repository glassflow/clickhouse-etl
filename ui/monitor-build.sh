#!/bin/bash

# Monitor Docker build progress
# Run this in a separate terminal while building

echo "🔍 Docker Build Monitor"
echo "======================="
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to format bytes
format_bytes() {
    local bytes=$1
    if [ $bytes -gt 1073741824 ]; then
        echo "$(($bytes / 1073741824))GB"
    elif [ $bytes -gt 1048576 ]; then
        echo "$(($bytes / 1048576))MB"
    elif [ $bytes -gt 1024 ]; then
        echo "$(($bytes / 1024))KB"
    else
        echo "${bytes}B"
    fi
}

# Watch loop
watch_count=0
start_time=$(date +%s)

while true; do
    clear
    current_time=$(date +%s)
    elapsed=$((current_time - start_time))
    
    echo -e "${BLUE}🔍 Docker Build Monitor${NC}"
    echo "======================="
    echo "Time elapsed: ${elapsed}s"
    echo ""
    
    # Docker system info
    echo -e "${GREEN}📊 Docker System:${NC}"
    docker system df 2>/dev/null | tail -n +2
    echo ""
    
    # Running containers
    echo -e "${GREEN}🏃 Build Processes:${NC}"
    docker ps --filter "ancestor=node:20-bullseye-slim" --format "table {{.ID}}\t{{.Image}}\t{{.Status}}" 2>/dev/null || echo "No build containers running"
    echo ""
    
    # Recent images
    echo -e "${GREEN}🖼️  Recent Images:${NC}"
    docker images --format "table {{.Repository}}\t{{.Tag}}\t{{.Size}}\t{{.CreatedAt}}" | head -n 6
    echo ""
    
    # Build cache
    echo -e "${GREEN}💾 Build Cache:${NC}"
    docker buildx du 2>/dev/null | head -n 5 || echo "BuildKit cache info not available"
    echo ""
    
    # Tips
    echo -e "${YELLOW}💡 Tips:${NC}"
    echo "  • First build: 10-15 minutes is normal"
    echo "  • Subsequent builds: 1-3 minutes (cached)"
    echo "  • Press Ctrl+C to stop monitoring"
    echo ""
    
    # Update counter
    ((watch_count++))
    echo "Updates: $watch_count"
    
    # Wait 5 seconds
    sleep 5
done

