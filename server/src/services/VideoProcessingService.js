const ffmpeg = require('fluent-ffmpeg');
const fs = require('fs-extra');
const path = require('path');
const axios = require('axios');
const {v4: uuidv4} = require('uuid');
const database = require('../config/database');
const { JOB_STATUS, ASSET_TYPES } = require('../utils/constants');

class VideoProcessingService {
  constructor() {
    this.inputDir = process.env.PROCESSING_INPUT_DIR || './data/inputs';
    this.outputDir = process.env.PROCESSING_OUTPUT_DIR || './data/outputs';
    this.tempDir = process.env.PROCESSING_TEMP_DIR || './data/temp';
    this.maxConcurrentJobs = parseInt(process.env.MAX_CONCURRENT_JOBS) || 2;
    this.processingQueue = [];
    this.currentJobs = 0;

    this.initializeDirectories();
  }

  async initializeDirectories() {
    try {
      await fs.ensureDir(this.inputDir);
      await fs.ensureDir(this.outputDir);
      await fs.ensureDir(this.tempDir);

      console.log('Video processing directories initialized');
    } catch (err) {
      console.error('Failed to initialize directories', err);
    }
  }

  async processJob(jobId) {
    if (this.currentJobs >= this.maxConcurrentJobs) {
      this.processingQueue.push(jobId);
      console.log(
        `Job ${jobId} queued. Current queue length: ${this.processingQueue.length}`
      );
      return;
    }

    this.currentJobs++;

    console.log(`Starting processing for job ${jobId}`);

    try {
      await this.executeProcessing(jobId);
    } catch (err) {
      console.error(`Processing failed for job ${jobId}: `, err);
      await this.handleProcesseingError(jobId, err);
    } finally {
      this.currentJobs--;
      this.processNextInQueue();
    }
  }

  async executeProcessing(jobId) {
    const job = await this.getJobById(jobId);

    if (!job) {
      throw new Error(`Job ${jobId} not found`);
    }

    console.log(`Processing job ${jobId}: ${job.input_source}`);

    await this.updateJobStatus(jobId, JOB_STATUS.DOWNLOADING, 10);

    const inputVideoPath = await this.downloadVideo(job.input_source, jobId);

    const metadata = await this.getVideoMetadata(inputVideoPath);
    await this.saveMetadata(jobId, metadata);

    await this.updateJobStatus(jobId, JOB_STATUS.PROCESSING, 20);

    const outputFormats = ['1080p', '720p', '480p'];
    const totalSteps = outputFormats.length + 2;
    let currentStep = 0;

    for (const format of outputFormats) {
      console.log(`Transcoding to ${format} for job ${jobId}`);
      await this.transcodeVideo(inputVideoPath, format, jobId);
      currentStep++;

      const progress = 20 + (currentStep / totalSteps) * 60;

      await this.updateJobStatus(
        jobId,
        JOB_STATUS.PROCESSING,
        Math.round(progress)
      );
    }

    console.log(`Generating GIF for job ${jobId}`);

    await this.generateGif(inputVideoPath, jobId);
    currentStep++;
    const gifProgress = 20 + (currentStep / totalSteps) * 60;

    await this.updateJobStatus(
      jobId,
      JOB_STATUS.PROCESSING,
      Math.round(gifProgress)
    );

    console.log(`Generating thumbnail for job ${jobId}`);
    await this.generateThumbnail(inputVideoPath, jobId);
    currentStep++;
    const thumbnailProgress = 20 + (currentStep / totalSteps) * 60;
    await this.updateJobStatus(
      jobId,
      JOB_STATUS.PROCESSING,
      Math.round(thumbnailProgress)
    );

    await this.updateJobStatus(jobId, JOB_STATUS.UPLOADING, 90);

    // clean up input file
    await fs.remove(inputVideoPath);

    await this.updateJobStatus(jobId, JOB_STATUS.COMPLETED, 100);
    console.log(`Job ${jobId} completed successfully.`);
  }

  async downloadVideo(videoUrl, jobId) {
    const fileName = `input_${jobId}_${uuidv4()}.mp4`;
    const filePath = path.join(this.inputDir, fileName);

    console.log(`Download video from: ${videoUrl}`);

    if (videoUrl === 'local-sample.mp4') {
      const samplePath = process.env.SAMPLE_VIDEO_URL;

      if (await fs.pathExists(samplePath)) {
        await fs.copy(samplePath, filePath);
        console.log('Using local sample video');
        return filePath;
      } else {
        throw new Error('Sample video not found.');
      }
    }

    try {
      const response = await axios({
        method: 'GET',
        url: videoUrl,
        responseType: 'stream',
        timeout: 30000,
        headers: {
          'User-Agent': 'VideoForge',
        },
      });

      const writer = fs.createWriteStream(filePath);
      response.data.pipe(writer);

      return new Promise((resolve, reject) => {
        writer.on('finish', () => {
          console.log(`Video downloaded to: ${filePath}`);
          resolve(filePath);
        });
        writer.on('error', reject);
      });
    } catch (err) {
      throw new Error(`Failed to download video: ${err.message}`);
    }
  }

  async transcodeVideo(inputPath, format, jobId) {
    const settings = this.getTranscodeSettings(format);
    const outputFileName = `${jobId}_${format.toLowerCase()}.mp4`;
    const outputPath = path.join(this.outputDir, outputFileName);

    return new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .videoCodec('libx264')
        .audioCodec('aac')
        .size(settings.resolution)
        .videoBitrate(settings.videoBitrate)
        .audioBitrate('128k')
        .fps(30)
        .preset(process.env.FFMPEG_PRESET || 'medium')
        .outputOptions([
          '-crf',
          process.env.FFMPEG_CRF || '23',
          '-maxrate',
          settings.maxrate,
          '-bufsize',
          settings.bufsize,
        ])
        .on('start', (commandLine) => {
          console.log(`FFmpeg command: ${commandLine}`);
        })
        .on('progress', (progress) => {
          console.log(
            `${format} transcoding: ${Math.round(progress.percent || 0)}%`
          );
        })
        .on('end', async () => {
          try {
            // Save asset info to database
            const stats = await fs.stat(outputPath);
            await this.saveMediaAsset(jobId, {
              type: `TRANSCODE_${format.replace('p', '').toUpperCase()}`,
              path: outputPath,
              size: stats.size,
              filename: outputFileName,
            });
            console.log(`${format} transcoding completed`);
            resolve();
          } catch (error) {
            reject(error);
          }
        })
        .on('error', (err) => {
          console.error(`${format} transcoding failed:`, err);
          reject(err);
        })
        .save(outputPath);
    });
  }

  async generateGif(inputPath, jobId) {
    const outputFileName = `${jobId}_preview.gif`;
    const outputPath = path.join(this.outputDir, outputFileName);

    return new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .complexFilter([
          // Extract 3 seconds starting from 10% of video duration
          '[0:v] trim=start_pts=PTS-STARTPTS+10:duration=3, scale=480:270, fps=10 [v1]',
          // Generate palette for better GIF quality
          '[v1] palettegen [palette]',
          '[v1][palette] paletteuse',
        ])
        .outputOptions(['-loop', '0']) // Infinite loop
        .on('end', async () => {
          try {
            const stats = await fs.stat(outputPath);
            await this.saveMediaAsset(jobId, {
              type: ASSET_TYPES.GIF,
              path: outputPath,
              size: stats.size,
              filename: outputFileName,
            });
            console.log(`GIF generation completed`);
            resolve();
          } catch (error) {
            reject(error);
          }
        })
        .on('error', reject)
        .save(outputPath);
    });
  }

  async generateThumbnail(inputPath, jobId) {
    const outputFileName = `${jobId}_thumbnail.jpg`;
    const outputPath = path.join(this.outputDir, outputFileName);

    return new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .screenshots({
          count: 1,
          folder: path.dirname(outputPath),
          filename: path.basename(outputPath),
          size: '320x180',
        })
        .on('end', async () => {
          try {
            const stats = await fs.stat(outputPath);
            await this.saveMediaAsset(jobId, {
              type: ASSET_TYPES.THUMBNAIL,
              path: outputPath,
              size: stats.size,
              filename: outputFileName,
            });
            console.log(`Thumbnail generation completed`);
            resolve();
          } catch (error) {
            reject(error);
          }
        })
        .on('error', reject);
    });
  }

  async getVideoMetadata(inputPath) {
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(inputPath, (err, metadata) => {
        if (err) {
          reject(err);
        } else {
          const videoStream = metadata.streams.find(
            (s) => s.codec_type === 'video'
          );
          const audioStream = metadata.streams.find(
            (s) => s.codec_type === 'audio'
          );

          resolve({
            duration: parseFloat(metadata.format.duration),
            filesize: parseInt(metadata.format.size),
            bitrate: parseInt(metadata.format.bit_rate),
            video: videoStream
              ? {
                  codec: videoStream.codec_name,
                  width: videoStream.width,
                  height: videoStream.height,
                  fps: eval(videoStream.r_frame_rate), // Convert "30/1" to 30
                  bitrate: parseInt(videoStream.bit_rate),
                }
              : null,
            audio: audioStream
              ? {
                  codec: audioStream.codec_name,
                  bitrate: parseInt(audioStream.bit_rate),
                  sample_rate: parseInt(audioStream.sample_rate),
                }
              : null,
          });
        }
      });
    });
  }

  getTranscodeSettings(format) {
    const settings = {
      '1080p': {
        resolution: '1920x1080',
        videoBitrate: '5000k',
        maxrate: '5350k',
        bufsize: '7500k',
      },
      '720p': {
        resolution: '1280x720',
        videoBitrate: '2500k',
        maxrate: '2675k',
        bufsize: '3750k',
      },
      '480p': {
        resolution: '854x480',
        videoBitrate: '1000k',
        maxrate: '1070k',
        bufsize: '1500k',
      },
    };

    return settings[format] || settings['720p']; // 720 as the default setting
  }

  async getJobById(jobId) {
    const jobs = await database.query('SELECT * FROM jobs WHERE id = ?', [
      jobId,
    ]);
    return jobs[0] || null;
  }

  async updateJobStatus(jobId, status, progress = null) {
    const updates = ['status = ?'];
    const params = [status];

    if (progress !== null) {
      updates.push('progress = ?');
      params.push(progress);
    }

    params.push(jobId);

    await database.query(
      `UPDATE jobs SET ${updates.join(
        ', '
      )}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      params
    );

    console.log(`Job ${jobId}: ${status} (${progress}%)`);
  }

  async saveMediaAsset(jobId, assetData) {
    await database.query(
      'INSERT INTO media_assets (job_id, asset_type, path, size_bytes) VALUES (?, ?, ?, ?)',
      [jobId, assetData.type, assetData.path, assetData.size]
    );
  }

  async saveMetadata(jobId, metadata) {
    const metadataJson = JSON.stringify(metadata, null, 2);
    const outputFileName = `${jobId}_metadata.json`;
    const outputPath = path.join(this.outputDir, outputFileName);

    await fs.writeJson(outputPath, metadata, { spaces: 2 });

    await this.saveMediaAsset(jobId, {
      type: ASSET_TYPES.METADATA_JSON,
      path: outputPath,
      size: Buffer.byteLength(metadataJson),
      filename: outputFileName,
    });
  }

  async handleProcessingError(jobId, error) {
    await database.query(
      'UPDATE jobs SET status = ?, error_text = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [JOB_STATUS.FAILED, error.message, jobId]
    );
  }

  processNextInQueue() {
    if (
      this.processingQueue.length > 0 &&
      this.currentJobs < this.maxConcurrentJobs
    ) {
      const nextJobId = this.processingQueue.shift();
      console.log(`Processing next job from queue: ${nextJobId}`);
      this.processJob(nextJobId);
    }
  }

  getProcessingStats() {
    return {
      currentJobs: this.currentJobs,
      queueLength: this.processingQueue.length,
      maxConcurrent: this.maxConcurrentJobs,
    };
  }
}

module.exports = new VideoProcessingService();