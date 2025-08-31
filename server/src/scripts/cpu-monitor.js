#!/usr/bin/env node

const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

class CPUMonitor {
  constructor(options = {}) {
    this.interval = options.interval || 5000; // 5 seconds default
    this.logFile = options.logFile || path.join(__dirname, '../logs/cpu-usage.log');
    this.targetUsage = options.targetUsage || 80; // 80% target
    this.running = false;
    this.stats = {
      samples: [],
      startTime: null,
      peakUsage: 0,
      averageUsage: 0,
      timeAboveTarget: 0
    };
  }

  async getCurrentCPUUsage() {
    return new Promise((resolve) => {
      // For macOS, use top command
      if (process.platform === 'darwin') {
        exec("top -l 1 -n 0 | grep 'CPU usage' | awk '{print $3}' | sed 's/%//'", (error, stdout) => {
          if (error) {
            resolve(0);
          } else {
            const usage = parseFloat(stdout.trim()) || 0;
            resolve(usage);
          }
        });
      } 
      // For Linux, use different approach
      else if (process.platform === 'linux') {
        exec("grep 'cpu ' /proc/stat | awk '{usage=($2+$4)*100/($2+$3+$4+$5)} END {print usage}'", (error, stdout) => {
          if (error) {
            resolve(0);
          } else {
            const usage = parseFloat(stdout.trim()) || 0;
            resolve(usage);
          }
        });
      }
      // Fallback
      else {
        resolve(0);
      }
    });
  }

  async getDockerContainerStats() {
    return new Promise((resolve) => {
      exec('docker stats --no-stream --format "table {{.Name}}\\t{{.CPUPerc}}"', (error, stdout) => {
        if (error) {
          resolve([]);
        } else {
          const lines = stdout.trim().split('\n').slice(1); // Skip header
          const containerStats = lines.map(line => {
            const parts = line.split('\t');
            return {
              name: parts[0],
              cpuUsage: parseFloat(parts[1]?.replace('%', '')) || 0
            };
          });
          resolve(containerStats);
        }
      });
    });
  }

  logUsage(systemCPU, containerStats, timestamp) {
    const logEntry = {
      timestamp,
      systemCPU,
      containerStats,
      aboveTarget: systemCPU >= this.targetUsage
    };

    this.stats.samples.push(logEntry);
    
    // Update peak usage
    if (systemCPU > this.stats.peakUsage) {
      this.stats.peakUsage = systemCPU;
    }

    // Count time above target
    if (logEntry.aboveTarget) {
      this.stats.timeAboveTarget += this.interval;
    }

    // Calculate running average
    const totalUsage = this.stats.samples.reduce((sum, sample) => sum + sample.systemCPU, 0);
    this.stats.averageUsage = totalUsage / this.stats.samples.length;

    // Log to console with colors
    const cpuColor = systemCPU >= this.targetUsage ? '\x1b[32m' : '\x1b[33m'; // Green if above target, yellow otherwise
    const resetColor = '\x1b[0m';
    
    console.log(`${cpuColor} CPU: ${systemCPU.toFixed(1)}%${resetColor} | Peak: ${this.stats.peakUsage.toFixed(1)}% | Avg: ${this.stats.averageUsage.toFixed(1)}%`);
    
    if (containerStats.length > 0) {
      containerStats.forEach(container => {
        if (container.cpuUsage > 0) {
          console.log(`${container.name}: ${container.cpuUsage.toFixed(1)}%`);
        }
      });
    }

    // Log to file
    const logLine = `${new Date(timestamp).toISOString()},${systemCPU.toFixed(2)},${JSON.stringify(containerStats)}\n`;
    fs.appendFileSync(this.logFile, logLine);
  }

  start() {
    if (this.running) {
      console.log('CPU Monitor is already running');
      return;
    }

    console.log(`Starting CPU Monitor (Target: ${this.targetUsage}%)`);
    console.log(`Logging to: ${this.logFile}`);
    console.log(`Sample interval: ${this.interval}ms`);
    console.log('');

    // Initialize log file
    const header = 'timestamp,system_cpu,container_stats\n';
    fs.writeFileSync(this.logFile, header);

    this.running = true;
    this.stats.startTime = Date.now();

    const monitorInterval = setInterval(async () => {
      if (!this.running) {
        clearInterval(monitorInterval);
        return;
      }

      const timestamp = Date.now();
      const systemCPU = await this.getCurrentCPUUsage();
      const containerStats = await this.getDockerContainerStats();

      this.logUsage(systemCPU, containerStats, timestamp);

      // Print summary every minute
      if (this.stats.samples.length % (60000 / this.interval) === 0) {
        this.printSummary();
      }
    }, this.interval);

    // Handle graceful shutdown
    process.on('SIGINT', () => {
      console.log('\nStopping CPU Monitor...');
      this.stop();
      process.exit(0);
    });
  }

  stop() {
    this.running = false;
    console.log('CPU Monitor stopped');
    this.printSummary();
  }

  printSummary() {
    const runtime = (Date.now() - this.stats.startTime) / 1000 / 60; // minutes
    const targetTimeMinutes = this.stats.timeAboveTarget / 1000 / 60;
    const targetPercentage = (targetTimeMinutes / runtime) * 100;

    console.log('\nCPU Monitor Summary:');
    console.log(`Runtime: ${runtime.toFixed(2)} minutes`);
    console.log(`Peak CPU: ${this.stats.peakUsage.toFixed(1)}%`);
    console.log(`Average CPU: ${this.stats.averageUsage.toFixed(1)}%`);
    console.log(`Time above ${this.targetUsage}%: ${targetTimeMinutes.toFixed(2)} min (${targetPercentage.toFixed(1)}%)`);
    console.log(`Samples collected: ${this.stats.samples.length}`);
    
    if (targetTimeMinutes >= 5) {
      console.log('SUCCESS: CPU usage above 80% for 5+ minutes achieved');
    } else {
      console.log(`Need ${(5 - targetTimeMinutes).toFixed(2)} more minutes above ${this.targetUsage}%`);
    }
    console.log('');
  }

  getStats() {
    return { ...this.stats };
  }
}

// CLI usage
if (require.main === module) {
  const monitor = new CPUMonitor({
    interval: 5000, // 5 seconds
    targetUsage: 80, // 80%
    logFile: path.join(__dirname, '../logs/cpu-load-test.log')
  });
  
  monitor.start();
}

module.exports = CPUMonitor;