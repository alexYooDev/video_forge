#!/usr/bin/env node

// Simple CPU-intensive load test without API dependencies
// This will create CPU load through video processing simulation

const { spawn } = require('child_process');
const path = require('path');

console.log('🚀 Simple CPU Load Generator for VideoForge');
console.log('==========================================');

const DURATION_MINUTES = 6;
const CONCURRENT_PROCESSES = 6; // Match your CPU cores

console.log(`⚙️  Configuration:`);
console.log(`   - Duration: ${DURATION_MINUTES} minutes`);
console.log(`   - Concurrent processes: ${CONCURRENT_PROCESSES}`);
console.log(`   - Target: 80%+ CPU usage`);
console.log('');

function createCPULoad(processId) {
  console.log(`🔥 Starting CPU load process ${processId}`);
  
  // CPU-intensive calculation loop
  const worker = spawn('node', ['-e', `
    console.log('Process ${processId} starting CPU load...');
    const startTime = Date.now();
    const duration = ${DURATION_MINUTES} * 60 * 1000;
    
    function cpuIntensiveTask() {
      // Simulate video processing calculations
      const iterations = 1000000;
      let result = 0;
      
      for (let i = 0; i < iterations; i++) {
        // Math operations that simulate video encoding
        result += Math.sin(i) * Math.cos(i) * Math.sqrt(i);
        result = result % 1000000;
        
        // Simulate array operations (like pixel data)
        if (i % 10000 === 0) {
          const buffer = new Array(1000).fill(0).map((_, idx) => 
            Math.floor(Math.random() * 255)
          );
          const sum = buffer.reduce((a, b) => a + b, 0);
          result += sum % 1000;
        }
      }
      
      return result;
    }
    
    let iterationCount = 0;
    while (Date.now() - startTime < duration) {
      const result = cpuIntensiveTask();
      iterationCount++;
      
      if (iterationCount % 100 === 0) {
        const elapsed = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
        console.log(\`Process ${processId}: \${elapsed}min elapsed, iteration \${iterationCount}, result: \${result}\`);
      }
    }
    
    console.log(\`Process ${processId} completed after \${iterationCount} iterations\`);
  `], { stdio: ['inherit', 'inherit', 'inherit'] });

  return worker;
}

// Start all CPU load processes
const processes = [];
for (let i = 1; i <= CONCURRENT_PROCESSES; i++) {
  processes.push(createCPULoad(i));
}

console.log(`🔥 Started ${CONCURRENT_PROCESSES} CPU-intensive processes`);
console.log(`⏱️  Running for ${DURATION_MINUTES} minutes...`);
console.log('💡 Monitor CPU usage with: top, htop, or Activity Monitor');
console.log('');

// Monitor process completion
let completedProcesses = 0;
processes.forEach((process, index) => {
  process.on('exit', (code) => {
    completedProcesses++;
    console.log(`✅ Process ${index + 1} completed (code: ${code})`);
    
    if (completedProcesses === CONCURRENT_PROCESSES) {
      console.log('');
      console.log('🏁 All CPU load processes completed!');
      console.log(`⏱️  Total duration: ${DURATION_MINUTES} minutes`);
      console.log('📊 Check your system monitor for CPU usage results');
      process.exit(0);
    }
  });
  
  process.on('error', (err) => {
    console.error(`❌ Process ${index + 1} error:`, err.message);
  });
});

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Stopping CPU load test...');
  processes.forEach(proc => {
    proc.kill('SIGTERM');
  });
  setTimeout(() => {
    console.log('🏁 CPU load test stopped');
    process.exit(0);
  }, 2000);
});