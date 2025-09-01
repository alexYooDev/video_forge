#!/usr/bin/env node

const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { performance } = require('perf_hooks');

// Configuration
const CONFIG = {
  API_BASE: `${process.env.APP_BASE_URL}/api`,
  CONCURRENT_JOBS: 4, // Number of simultaneous jobs
  DURATION_MINUTES: 6, // Run for 6 minutes
  JOB_INTERVAL_MS: 2000, // Submit new job every 2 seconds
  VIDEO_FORMATS: ['mp4', 'webm', 'avi'],
  RESOLUTIONS: ['1080p', '720p', '480p'],
  // Sample video URLs (public domain videos)
  SAMPLE_VIDEOS: [
    process.env.SAMPLE_VIDEO_URL,
    'http://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4',
    'http://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
  ],
};

class LoadTester {
  constructor() {
    this.jobs = new Map();
    this.stats = {
      submitted: 0,
      completed: 0,
      failed: 0,
      startTime: null,
      endTime: null
    };
    this.authToken = null;
  }

  async authenticate() {
    try {
      console.log('Authenticating...');
      const response = await axios.post('http//:localhost:8000/api/auth/login', {
        username: 'testuser',
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
          username: 'testuser',
          email: 'test@example.com',
          password: 'testpass123'
        });
        
        const loginResponse = await axios.post(
          `${CONFIG.API_BASE}/auth/login`,
          {
            username: 'testuser',
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
      const outputFormat = CONFIG.VIDEO_FORMATS[Math.floor(Math.random() * CONFIG.VIDEO_FORMATS.length)];
      const resolution = CONFIG.RESOLUTIONS[Math.floor(Math.random() * CONFIG.RESOLUTIONS.length)];

      console.log(`Submitting job ${jobId}: ${resolution} ${outputFormat}`);

      const response = await axios.post(`${CONFIG.API_BASE}/jobs`, {
        inputUrl: videoUrl,
        outputFormat: outputFormat,
        resolution: resolution,
        title: `Load Test Job ${jobId}`,
        description: `CPU load testing job ${jobId} - ${resolution} ${outputFormat}`
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
        outputFormat,
        resolution
      };

      this.jobs.set(jobId, job);
      this.stats.submitted++;
      
      console.log(`Job ${jobId} submitted successfully (Server ID: ${job.id})`);
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
        const duration = ((performance.now() - job.submitTime) / 1000).toFixed(2);
        console.log(`Job ${job.jobId} (${job.id}): ${oldStatus} → ${status} (${duration}s)`);
        
        if (status === 'COMPLETED') {
          this.stats.completed++;
        } else if (status === 'FAILED') {
          this.stats.failed++;
        }
      }

      return status;
    } catch (error) {
      console.error(`Failed to check job ${job.jobId} status:`, error.message);
      return null;
    }
  }

  async monitorJobs() {
    console.log('Starting job monitoring...');
    
    const monitorInterval = setInterval(async () => {
      const activeJobs = Array.from(this.jobs.values()).filter(
        job => job.status === 'PENDING' || job.status === 'PROCESSING'
      );

      if (activeJobs.length === 0) {
        return;
      }

      console.log(`Monitoring ${activeJobs.length} active jobs...`);
      
      for (const job of activeJobs) {
        await this.checkJobStatus(job);
      }

      this.printStats();
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

    // Authenticate
    const authSuccess = await this.authenticate();
    if (!authSuccess) {
      console.error(' Cannot proceed without authentication');
      return;
    }

    this.stats.startTime = performance.now();
    
    // Start monitoring jobs
    const monitorInterval = await this.monitorJobs();
    
    // Submit jobs continuously for the specified duration
    let jobCounter = 1;
    const endTime = Date.now() + (CONFIG.DURATION_MINUTES * 60 * 1000);
    
    const submitInterval = setInterval(async () => {
      if (Date.now() >= endTime) {
        console.log('Load test duration reached, stopping job submission');
        clearInterval(submitInterval);
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

  finishLoadTest() {
    this.stats.endTime = performance.now();
    const totalDuration = (this.stats.endTime - this.stats.startTime) / 1000 / 60;
    
    console.log('Load Test Completed!');
    console.log(`  Total Duration: ${totalDuration.toFixed(2)} minutes`);
    console.log(`  Final Statistics:`);
    console.log(`   - Jobs Submitted: ${this.stats.submitted}`);
    console.log(`   - Jobs Completed: ${this.stats.completed}`);
    console.log(`   - Jobs Failed: ${this.stats.failed}`);
    console.log(`   - Success Rate: ${((this.stats.completed / this.stats.submitted) * 100).toFixed(1)}%`);
    
    process.exit(0);
  }
}

// CPU monitoring function
function startCPUMonitoring() {
  console.log(' Starting CPU monitoring...');
  
  const cpuInterval = setInterval(() => {
    const usage = process.cpuUsage();
    // This is a simplified CPU monitoring - in real scenarios you'd use system tools
    console.log(` Process CPU: User=${usage.user}, System=${usage.system}`);
  }, 10000); // Every 10 seconds

  return cpuInterval;
}

// Main execution
async function main() {
  console.log('VideoForge Load Testing Tool');
  console.log('================================');
  
  // Start CPU monitoring
  const cpuInterval = startCPUMonitoring();
  
  // Create and start load tester
  const loadTester = new LoadTester();
  
  // Handle graceful shutdown
  process.on('SIGINT', () => {
    console.log('\nReceived SIGINT, shutting down gracefully...');
    clearInterval(cpuInterval);
    loadTester.finishLoadTest();
  });
  
  try {
    await loadTester.startLoadTest();
  } catch (error) {
    console.error('Load test failed:', error.message);
    clearInterval(cpuInterval);
    process.exit(1);
  }
}

// Run the load test
main().catch(console.error);