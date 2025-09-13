#!/usr/bin/env node

const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { performance } = require('perf_hooks');

// Configuration
const CONFIG = {
  API_BASE: `${process.env.APP_BASE_URL}/api`,
  CONCURRENT_JOBS: 6, // Increased for higher CPU load
  DURATION_MINUTES: 6, // Keep 6 minutes for sustained load
  JOB_INTERVAL_MS: 5000, // Submit new job every 5 seconds
  VIDEO_FORMATS: ['mp4', 'webm', 'avi'],
  RESOLUTIONS: ['1080p'], // Use only 1080p for maximum CPU load
  TARGET_CPU_PERCENT: 80, // Target CPU usage
  
  // Safety limits to prevent instance crashes
  MAX_CPU_PERCENT: 95, // Emergency CPU limit
  MAX_MEMORY_PERCENT: 85, // Emergency memory limit  
  MIN_FREE_DISK_GB: 2, // Minimum free disk space
  EMERGENCY_COOLDOWN_MS: 30000, // 30 second cooldown when limits hit
  
  // Use only one sample video to minimize file creation
  SAMPLE_VIDEOS: [
    process.env.SAMPLE_VIDEO_URL || 'http://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4',
  ],
};

class LoadTester {
  constructor(authToken = null) {
    this.jobs = new Map();
    this.stats = {
      submitted: 0,
      completed: 0,
      failed: 0,
      startTime: null,
      endTime: null
    };
    this.authToken = authToken;
    
    // Safety monitoring
    this.emergencyMode = false;
    this.lastEmergencyTime = 0;
    this.safetyInterval = null;
  }

  async authenticate() {
    try {
      console.log('Authenticating...');
      const response = await axios.post(`${process.env.APP_BASE_URL}/api/auth/login`, {
        email: 'test@example.com',
        password: 'testpass123',
      });
      
      this.authToken = response.data.token;
      console.log('Authentication successful');
      return true;
    } catch (error) {
      // Try to register if login fails
      try {
        console.log('Registering new user...');
        console.log(`${CONFIG.API_BASE}/auth/register`);
        await axios.post(`${CONFIG.API_BASE}/auth/register`, {
          email: 'test@example.com',
          password: 'testpass123'
        });
        
        const loginResponse = await axios.post(
          `${CONFIG.API_BASE}/auth/login`,
          {
            email: 'test@example.com',
            password: 'testpass123',
          }
        );
        
        this.authToken = loginResponse.data.token;
        console.log('Registration and authentication successful');
        return true;
      } catch (regError) {
        console.error('Authentication failed:', regError.message);
        return false;
      }
    }
  }

  async submitJob(jobId) {
    try {
      const videoUrl = CONFIG.SAMPLE_VIDEOS[Math.floor(Math.random() * CONFIG.SAMPLE_VIDEOS.length)];
      const outputFormats = [CONFIG.RESOLUTIONS[Math.floor(Math.random() * CONFIG.RESOLUTIONS.length)]];

      const response = await axios.post(`${CONFIG.API_BASE}/jobs`, {
        inputSource: videoUrl,
        outputFormats: outputFormats
      }, {
        headers: {
          'Authorization': `Bearer ${this.authToken}`,
          'Content-Type': 'application/json'
        }
      });

      const job = {
        id: response.data.job.id,
        jobId: jobId,
        status: 'PENDING',
        submitTime: performance.now(),
        videoUrl,
        outputFormats
      };

      this.jobs.set(jobId, job);
      this.stats.submitted++;
      
      console.log(`Job ${jobId} submitted`);
      return job;
      
    } catch (error) {
      console.error(`Failed to submit job ${jobId}:`, error.message);
      this.stats.failed++;
      return null;
    }
  }

  async checkJobStatus(job) {
    try {
      const response = await axios.get(`${CONFIG.API_BASE}/jobs/${job.id}`, {
        headers: {
          'Authorization': `Bearer ${this.authToken}`
        }
      });

      const status = response.data.job.status;
      const oldStatus = job.status;
      job.status = status;

      if (oldStatus !== status) {
        if (status === 'COMPLETED') {
          this.stats.completed++;
          console.log(`Job ${job.jobId} completed`);
        } else if (status === 'FAILED') {
          this.stats.failed++;
          console.log(`Job ${job.jobId} failed`);
        }
      }

      return status;
    } catch (error) {
      // Silent - don't log HTTP errors during load test
      return null;
    }
  }

  async monitorJobs() {
    console.log('Starting job monitoring (silent mode - check htop for CPU usage)...');
    
    const monitorInterval = setInterval(async () => {
      const activeJobs = Array.from(this.jobs.values()).filter(
        job => job.status === 'PENDING' || job.status === 'PROCESSING'
      );

      if (activeJobs.length === 0) {
        return;
      }
      
      for (const job of activeJobs) {
        await this.checkJobStatus(job);
      }

      // Only show summary stats every 30 seconds instead of detailed logs
      if (Date.now() % 30000 < 5000) {
        this.printStats();
      }
    }, 5000); // Check every 5 seconds

    return monitorInterval;
  }

  async startLoadTest() {
    console.log('Starting CPU Load Test for Video Processing');
    console.log(`   Configuration:`);
    console.log(`   - Duration: ${CONFIG.DURATION_MINUTES} minutes`);
    console.log(`   - Concurrent jobs: ${CONFIG.CONCURRENT_JOBS}`);
    console.log(`   - Job submission interval: ${CONFIG.JOB_INTERVAL_MS}ms`);
    console.log(`   - Formats: ${CONFIG.VIDEO_FORMATS.join(', ')}`);
    console.log(`   - Resolutions: ${CONFIG.RESOLUTIONS.join(', ')}`);
    console.log('');

    // Authenticate only if no token was provided
    if (!this.authToken) {
      const authSuccess = await this.authenticate();
      if (!authSuccess) {
        console.error(' Cannot proceed without authentication');
        return;
      }
    } else {
      console.log('Using provided authentication token');
    }

    this.stats.startTime = performance.now();
    
    // Start monitoring jobs
    const monitorInterval = await this.monitorJobs();
    
    // Submit jobs continuously for the specified duration with safety checks
    let jobCounter = 1;
    const endTime = Date.now() + (CONFIG.DURATION_MINUTES * 60 * 1000);
    
    const submitInterval = setInterval(async () => {
      if (Date.now() >= endTime) {
        console.log('Load test duration reached, stopping job submission');
        clearInterval(submitInterval);
        return;
      }

      // Safety check - pause if resources are critical
      if (this.checkSystemSafety()) {
        console.log('Skipping job submission due to safety limits');
        return;
      }

      // Maintain concurrent job limit
      const activeJobs = Array.from(this.jobs.values()).filter(
        job => job.status === 'PENDING' || job.status === 'PROCESSING'
      );

      if (activeJobs.length < CONFIG.CONCURRENT_JOBS) {
        await this.submitJob(jobCounter++);
      }
    }, CONFIG.JOB_INTERVAL_MS);

    // Wait for test duration + extra time for jobs to complete
    setTimeout(() => {
      clearInterval(submitInterval);
      console.log('Stopping job submission...');
      
      // Wait for remaining jobs to complete
      setTimeout(() => {
        clearInterval(monitorInterval);
        this.finishLoadTest();
      }, 60000); // Wait 1 minute for remaining jobs
      
    }, CONFIG.DURATION_MINUTES * 60 * 1000);
  }

  printStats() {
    const runtime = ((performance.now() - this.stats.startTime) / 1000 / 60).toFixed(2);
    console.log(`  Stats (${runtime}min runtime):`);
    console.log(`   - Submitted: ${this.stats.submitted}`);
    console.log(`   - Completed: ${this.stats.completed}`);
    console.log(`   - Failed: ${this.stats.failed}`);
    console.log(`   - Active: ${this.stats.submitted - this.stats.completed - this.stats.failed}`);
    console.log('');
  }

  async finishLoadTest() {
    this.stats.endTime = performance.now();
    const totalDuration = (this.stats.endTime - this.stats.startTime) / 1000 / 60;
    
    console.log('Load Test Completed!');
    console.log(`  Total Duration: ${totalDuration.toFixed(2)} minutes`);
    console.log(`  Final Statistics:`);
    console.log(`   - Jobs Submitted: ${this.stats.submitted}`);
    console.log(`   - Jobs Completed: ${this.stats.completed}`);
    console.log(`   - Jobs Failed: ${this.stats.failed}`);
    console.log(`   - Success Rate: ${((this.stats.completed / this.stats.submitted) * 100).toFixed(1)}%`);
    
    console.log('Cleaning up load test jobs...');
    await this.cleanupJobs();
    
    process.exit(0);
  }

  async cleanupJobs() {
    try {
      // Delete all jobs created during load test to free up disk space
      const jobsToCleanup = Array.from(this.jobs.values());
      
      for (const job of jobsToCleanup) {
        try {
          await axios.delete(`${CONFIG.API_BASE}/jobs/${job.id}`, {
            headers: {
              'Authorization': `Bearer ${this.authToken}`
            }
          });
          console.log(`Cleaned up job ${job.jobId}`);
        } catch (error) {
          // Silent - job might already be deleted or not deletable
        }
      }
      
      console.log(`Cleanup completed for ${jobsToCleanup.length} jobs`);
    } catch (error) {
      console.log('Cleanup completed with some errors (this is normal)');
    }
  }
}

// Enhanced CPU monitoring function
function startCPUMonitoring() {
  console.log('Starting enhanced CPU monitoring...');
  console.log(`TARGET: Maintain ${CONFIG.TARGET_CPU_PERCENT}%+ CPU usage for 5+ minutes`);
  console.log('IMPORTANT: Open a new terminal and run: htop');
  console.log('Or use Activity Monitor > CPU tab for visual graphs');
  
  const { spawn } = require('child_process');
  const os = require('os');
  
  // CPU tracking variables
  let previousCpuUsage = os.cpus();
  let highCpuDuration = 0;
  let lastHighCpuTime = Date.now();
  
  // Try multiple approaches to open htop
  try {
    if (os.platform() === 'darwin') {
      spawn('open', ['-a', 'Terminal'], { detached: true, stdio: 'ignore' });
      
      setTimeout(() => {
        spawn('osascript', [
          '-e', 'tell application "Terminal" to activate',
          '-e', 'tell application "Terminal" to do script "htop"'
        ], { detached: true, stdio: 'ignore' });
      }, 1000);
      
      console.log('Attempted to open Terminal with htop');
    }
  } catch (error) {
    console.log('Could not auto-open htop');
  }
  
  console.log('Manual steps:');
  console.log('1. Open new terminal: CMD+T');
  console.log('2. Run: htop');
  console.log('3. Watch CPU bars at the top');
  
  // Enhanced monitoring with CPU percentage calculation
  const cpuInterval = setInterval(() => {
    const currentCpuUsage = os.cpus();
    const loadAvg = os.loadavg();
    
    // Calculate CPU usage percentage
    let totalIdle = 0;
    let totalTick = 0;
    
    currentCpuUsage.forEach((cpu, index) => {
      const prevCpu = previousCpuUsage[index];
      
      const prevIdle = prevCpu.times.idle;
      const prevTotal = Object.values(prevCpu.times).reduce((a, b) => a + b, 0);
      
      const idle = cpu.times.idle;
      const total = Object.values(cpu.times).reduce((a, b) => a + b, 0);
      
      totalIdle += idle - prevIdle;
      totalTick += total - prevTotal;
    });
    
    const cpuUsage = Math.max(0, Math.min(100, 100 - ~~(100 * totalIdle / totalTick)));
    
    // Track high CPU duration
    const now = Date.now();
    if (cpuUsage >= CONFIG.TARGET_CPU_PERCENT) {
      if (now - lastHighCpuTime <= 15000) { // Within 15 seconds
        highCpuDuration += (now - lastHighCpuTime);
      } else {
        highCpuDuration = 0; // Reset if gap too long
      }
      lastHighCpuTime = now;
    }
    
    const highCpuMinutes = (highCpuDuration / 1000 / 60).toFixed(1);
    const status = cpuUsage >= CONFIG.TARGET_CPU_PERCENT ? 'TARGET MET' : 'below target';
    
    console.log(`CPU: ${cpuUsage}% | Load: ${loadAvg[0].toFixed(2)} | High CPU time: ${highCpuMinutes}min | Status: ${status}`);
    
    if (highCpuMinutes >= 5) {
      console.log('SUCCESS: Maintained 80%+ CPU for 5+ minutes!');
    }
    
    previousCpuUsage = currentCpuUsage;
  }, 5000); // Check every 5 seconds

  return cpuInterval;
}

// Safety monitoring system to prevent instance crashes
LoadTester.prototype.checkSystemSafety = function() {
  const os = require('os');
  const fs = require('fs');
  
  try {
    // Check memory usage
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const memoryUsage = ((totalMem - freeMem) / totalMem) * 100;
    
    // Check disk space (approximate)
    let diskFree = 5; // Simplified for demo - would use proper disk space check
    
    // Calculate current CPU (simplified)
    const loadAvg = os.loadavg()[0];
    const cpuCount = os.cpus().length;
    const cpuUsage = Math.min(100, (loadAvg / cpuCount) * 100);
    
    // Check safety limits
    const memoryDanger = memoryUsage > CONFIG.MAX_MEMORY_PERCENT;
    const cpuDanger = cpuUsage > CONFIG.MAX_CPU_PERCENT;
    const diskDanger = diskFree < CONFIG.MIN_FREE_DISK_GB;
    
    if (memoryDanger || cpuDanger || diskDanger) {
      const now = Date.now();
      if (!this.emergencyMode || (now - this.lastEmergencyTime) > CONFIG.EMERGENCY_COOLDOWN_MS) {
        this.emergencyMode = true;
        this.lastEmergencyTime = now;
        
        console.log('EMERGENCY: Resource limits exceeded!');
        if (memoryDanger) console.log(`Memory: ${memoryUsage.toFixed(1)}% (limit: ${CONFIG.MAX_MEMORY_PERCENT}%)`);
        if (cpuDanger) console.log(`CPU: ${cpuUsage.toFixed(1)}% (limit: ${CONFIG.MAX_CPU_PERCENT}%)`);
        if (diskDanger) console.log(`Disk: ${diskFree}GB free (limit: ${CONFIG.MIN_FREE_DISK_GB}GB)`);
        
        console.log('Pausing job submission for safety...');
        return true; // Emergency detected
      }
    } else {
      if (this.emergencyMode) {
        console.log('Resource levels safe - resuming normal operation');
        this.emergencyMode = false;
      }
    }
    
    return false; // All safe
  } catch (error) {
    console.log('Safety check error:', error.message);
    return false; // Assume safe if can't check
  }
};

// Main execution
async function main() {
  console.log('VideoForge Load Testing Tool');
  console.log('================================');
  
  // Start CPU monitoring
  const cpuInterval = startCPUMonitoring();
  
  // Create and start load tester
  const loadTester = new LoadTester();
  
  // Handle graceful shutdown
  process.on('SIGINT', async () => {
    console.log('\nReceived SIGINT, shutting down gracefully...');
    clearInterval(cpuInterval);
    await loadTester.finishLoadTest();
  });
  
  try {
    await loadTester.startLoadTest();
  } catch (error) {
    console.error('Load test failed:', error.message);
    clearInterval(cpuInterval);
    process.exit(1);
  }
}

// Export the LoadTester class and functions for use in other modules
module.exports = {
  LoadTester,
  startCPUMonitoring,
  CONFIG
};

// Run the load test only if this file is executed directly
if (require.main === module) {
  main().catch(console.error);
}