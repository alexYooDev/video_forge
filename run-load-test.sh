#!/bin/bash

# VideoForge CPU Load Test Runner
# This script will run intensive video processing to achieve 80%+ CPU usage for 5+ minutes

echo "🚀 VideoForge CPU Load Test Runner"
echo "=================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo -e "${RED}❌ Docker is not running. Please start Docker and try again.${NC}"
    exit 1
fi

# Check if services are running
echo -e "${BLUE}🔍 Checking if VideoForge services are running...${NC}"
if ! docker ps | grep -q videoforge_server_dev; then
    echo -e "${YELLOW}⚠️  VideoForge server not running. Starting services...${NC}"
    docker compose -f docker-compose.dev.yml up -d
    echo -e "${GREEN}⏱️  Waiting 30 seconds for services to start...${NC}"
    sleep 30
fi

# Install load test dependencies
echo -e "${BLUE}📦 Installing load test dependencies...${NC}"
if [ ! -d "node_modules" ]; then
    cp load-test-package.json package.json
    npm install
fi

# Restart server with higher concurrent job limit
echo -e "${BLUE}🔄 Restarting server with optimized configuration for CPU load...${NC}"
docker compose -f docker-compose.dev.yml restart server

echo -e "${GREEN}⏱️  Waiting 15 seconds for server restart...${NC}"
sleep 15

# Function to run CPU monitoring in background
start_cpu_monitor() {
    echo -e "${BLUE}🖥️  Starting CPU monitor...${NC}"
    node cpu-monitor.js > cpu-monitor.log 2>&1 &
    CPU_MONITOR_PID=$!
    echo "CPU Monitor PID: $CPU_MONITOR_PID"
}

# Function to stop CPU monitoring
stop_cpu_monitor() {
    if [ ! -z "$CPU_MONITOR_PID" ]; then
        echo -e "${YELLOW}⏹️  Stopping CPU monitor...${NC}"
        kill $CPU_MONITOR_PID 2>/dev/null
        wait $CPU_MONITOR_PID 2>/dev/null
    fi
}

# Function to check system resources
check_system_resources() {
    echo -e "${BLUE}💻 System Resources:${NC}"
    echo "CPU Cores: $(sysctl -n hw.ncpu 2>/dev/null || nproc)"
    echo "Memory: $(sysctl -n hw.memsize 2>/dev/null | awk '{print $1/1024/1024/1024 " GB"}' || free -g | awk '/^Mem:/{print $2 " GB"}')"
    echo ""
}

# Function to show Docker stats
show_docker_stats() {
    echo -e "${BLUE}📊 Docker Container Stats:${NC}"
    docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}"
    echo ""
}

# Trap to handle script interruption
trap 'echo -e "\n${YELLOW}🛑 Load test interrupted. Cleaning up...${NC}"; stop_cpu_monitor; exit 130' INT TERM

# Check system resources
check_system_resources

# Start CPU monitoring
start_cpu_monitor

# Show initial Docker stats
show_docker_stats

echo -e "${GREEN}🔥 Starting intensive CPU load test...${NC}"
echo -e "${GREEN}🎯 Target: 80%+ CPU usage for 5+ minutes${NC}"
echo -e "${GREEN}⏱️  Duration: 6 minutes${NC}"
echo -e "${GREEN}🔧 Configuration: 6 concurrent video processing jobs${NC}"
echo ""
echo -e "${YELLOW}Press Ctrl+C to stop the test early${NC}"
echo ""

# Run the load test
node load-test.js

# Stop CPU monitoring
stop_cpu_monitor

echo ""
echo -e "${GREEN}✅ Load test completed!${NC}"
echo ""
echo -e "${BLUE}📊 Results Summary:${NC}"

# Show final Docker stats
show_docker_stats

# Show CPU monitoring results if available
if [ -f "cpu-load-test.log" ]; then
    echo -e "${BLUE}📈 CPU Usage Analysis:${NC}"
    echo "Log file: cpu-load-test.log"
    
    # Simple analysis of CPU usage
    if command -v awk > /dev/null; then
        PEAK_CPU=$(tail -n +2 cpu-load-test.log | cut -d',' -f2 | sort -nr | head -1)
        AVG_CPU=$(tail -n +2 cpu-load-test.log | cut -d',' -f2 | awk '{sum+=$1; n++} END {if(n>0) print sum/n; else print 0}')
        HIGH_CPU_SAMPLES=$(tail -n +2 cpu-load-test.log | awk -F',' '$2 >= 80 {count++} END {print count+0}')
        TOTAL_SAMPLES=$(tail -n +2 cpu-load-test.log | wc -l)
        
        echo "Peak CPU Usage: ${PEAK_CPU}%"
        echo "Average CPU Usage: ${AVG_CPU}%"
        echo "Samples above 80%: ${HIGH_CPU_SAMPLES}/${TOTAL_SAMPLES}"
        
        if (( $(echo "$HIGH_CPU_SAMPLES >= 60" | bc -l 2>/dev/null || echo "0") )); then
            echo -e "${GREEN}🎉 SUCCESS: Sustained high CPU usage achieved!${NC}"
        else
            echo -e "${YELLOW}⚠️  May need longer duration or more concurrent jobs${NC}"
        fi
    fi
fi

echo ""
echo -e "${BLUE}📁 Generated Files:${NC}"
echo "- load-test.js (Load testing script)"
echo "- cpu-monitor.js (CPU monitoring tool)"  
echo "- cpu-monitor.log (CPU monitor output)"
echo "- cpu-load-test.log (Detailed CPU usage data)"
echo ""
echo -e "${GREEN}🏁 Load test runner completed!${NC}"