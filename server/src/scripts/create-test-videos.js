#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const axios = require('axios');

// Sample video URLs for testing (public domain)
const SAMPLE_VIDEOS = [
  {
    url: 'http://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
    name: 'sample_720p_5mb.mp4',
    description: '720p 5MB sample video',
  },
  {
    url: 'http://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
    name: 'sample_720p_10mb.mp4',
    description: '720p 10MB sample video',
  },
  {
    url: 'http://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4',
    name: 'sample_1080p_5mb.mp4',
    description: '1080p 5MB sample video',
  },
];

async function downloadVideo(videoInfo, outputDir) {
  try {
    console.log(`📥 Downloading ${videoInfo.description}...`);
    const response = await axios({
      method: 'GET',
      url: videoInfo.url,
      responseType: 'stream',
      timeout: 30000
    });

    const outputPath = path.join(outputDir, videoInfo.name);
    const writer = fs.createWriteStream(outputPath);

    response.data.pipe(writer);

    return new Promise((resolve, reject) => {
      writer.on('finish', () => {
        console.log(`Downloaded: ${videoInfo.name}`);
        resolve(outputPath);
      });
      writer.on('error', reject);
    });
  } catch (error) {
    console.error(`Failed to download ${videoInfo.name}:`, error.message);
    return null;
  }
}

async function createTestVideos() {
  const outputDir = path.join(__dirname, '../data/test-videos');
  
  // Create output directory
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
    console.log(`Created directory: ${outputDir}`);
  }

  console.log('Setting up test videos for CPU load testing...\n');

  // Download sample videos
  for (const video of SAMPLE_VIDEOS) {
    await downloadVideo(video, outputDir);
  }

  console.log('\nTest video setup complete!');
  console.log(`Videos saved to: ${outputDir}`);
  console.log('\nThese videos are ready for CPU-intensive transcoding tests');
}

if (require.main === module) {
  createTestVideos().catch(console.error);
}

module.exports = { createTestVideos };