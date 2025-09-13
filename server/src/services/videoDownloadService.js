/**
 * VideoDownloadService - Single Responsibility: Download videos from various sources
 * SOLID: Single responsibility for video acquisition
 * DRY: Centralized download logic
 */

const fs = require('fs-extra');
const path = require('path');
const axios = require('axios');
const {v4: uuidv4} = require('uuid');
const { InternalServerError, BadRequest } = require('../utils/errors');

class VideoDownloadService {
  
  async analyzeInputSource(inputSource) {
    if (!inputSource || typeof inputSource !== 'string') {
      throw BadRequest('Input source is required and must be a string');
    }

    const trimmedSource = inputSource.trim();

    // Check if it's a URL
    if (trimmedSource.startsWith('http://') || trimmedSource.startsWith('https://')) {
      return { type: 'EXTERNAL_URL', source: trimmedSource };
    }

    // Check if it's a local file path
    if (trimmedSource.startsWith('/') || trimmedSource.includes('./') || trimmedSource.includes('../')) {
      return { type: 'LOCAL_FILE', source: trimmedSource };
    }

    // Default to treating as URL for backward compatibility
    return { type: 'EXTERNAL_URL', source: trimmedSource };
  }

  async downloadVideo(inputSource, jobId) {
    let sourceInfo = await this.analyzeInputSource(inputSource);
    const fileName = `input_${jobId}_${uuidv4()}.mp4`;
    const targetPath = path.join('/tmp', fileName);

    // Handle special sample video case
    if (inputSource === 'local-sample.mp4') {
      if (!process.env.SAMPLE_VIDEO_URL) {
        throw InternalServerError('SAMPLE_VIDEO_URL environment variable not configured');
      }
      sourceInfo.source = process.env.SAMPLE_VIDEO_URL;
      sourceInfo = await this.analyzeInputSource(sourceInfo.source);
    }

    console.log(`Downloading ${sourceInfo.type} source: ${sourceInfo.source}`);

    try {
      switch (sourceInfo.type) {
        case 'LOCAL_FILE':
          return await this.handleLocalFile(sourceInfo.source, targetPath);
        case 'EXTERNAL_URL':
          return await this.handleExternalUrlDownload(sourceInfo, targetPath, jobId);
        default:
          // Try as URL first, fallback to local if fails
          try {
            return await this.handleExternalUrlDownload(sourceInfo, targetPath, jobId);
          } catch (urlError) {
            console.warn(`URL download failed, trying local file: ${urlError.message}`);
            return await this.handleLocalFile(sourceInfo.source, targetPath);
          }
      }
    } catch (error) {
      // Clean up partial downloads
      try {
        if (await fs.pathExists(targetPath)) {
          await fs.remove(targetPath);
        }
      } catch (cleanupError) {
        console.error('Failed to clean up partial download:', cleanupError.message);
      }
      throw error;
    }
  }

  async handleLocalFile(sourcePath, targetPath) {
    const resolvedPath = path.resolve(sourcePath);
    
    if (!(await fs.pathExists(resolvedPath))) {
      throw BadRequest(`Local file not found: ${resolvedPath}`);
    }

    await fs.copy(resolvedPath, targetPath);
    console.log(`Using local file: ${resolvedPath}`);
    return targetPath;
  }

  async handleExternalUrlDownload(sourceInfo, targetPath, jobId) {
    const maxRetries = 3;
    let lastError;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`Download attempt ${attempt}/${maxRetries} for job ${jobId}`);
        return await this.downloadFromUrl(sourceInfo.source, targetPath, {}, 300000, jobId);
      } catch (error) {
        lastError = error;
        console.error(`Download attempt ${attempt} failed:`, error.message);
        
        if (attempt < maxRetries) {
          const delay = Math.pow(2, attempt) * 1000; // Exponential backoff
          console.log(`Retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw InternalServerError(`Failed to download after ${maxRetries} attempts: ${lastError.message}`);
  }

  async downloadFromUrl(url, filePath, headers = {}, timeout = 300000, jobId = null) {
    try {
      console.log(`Starting download from ${url}${jobId ? ` for job ${jobId}` : ''}`);

      const response = await axios({
        method: 'GET',
        url: url,
        responseType: 'stream',
        headers,
        timeout: timeout,
        maxRedirects: 5
      });

      if (response.status !== 200) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const writer = fs.createWriteStream(filePath);
      response.data.pipe(writer);

      return new Promise((resolve, reject) => {
        writer.on('finish', () => {
          console.log(`Download completed: ${filePath}`);
          resolve(filePath);
        });

        writer.on('error', (error) => {
          console.error('Write stream error:', error);
          reject(new Error(`Failed to write file: ${error.message}`));
        });

        response.data.on('error', (error) => {
          console.error('Response stream error:', error);
          reject(new Error(`Download stream error: ${error.message}`));
        });
      });
    } catch (error) {
      if (error.code === 'ECONNABORTED') {
        throw new Error(`Download timeout after ${timeout}ms`);
      }
      if (error.response) {
        throw new Error(`HTTP ${error.response.status}: ${error.response.statusText}`);
      }
      throw new Error(`Download failed: ${error.message}`);
    }
  }
}

module.exports = new VideoDownloadService();