/**
 * VideoTranscodeService - Single Responsibility: Video transcoding operations
 * SOLID: Single responsibility for FFmpeg operations
 * DRY: Centralized transcoding logic
 */

const ffmpeg = require('fluent-ffmpeg');
const fs = require('fs-extra');
const path = require('path');
const {v4: uuidv4} = require('uuid');
const { ASSET_TYPES } = require('../utils/constants');
const { InternalServerError } = require('../utils/errors');

class VideoTranscodeService {
  
  getTranscodeSettings(format) {
    const settings = {
      'TRANSCODE_1080': { resolution: '1920x1080', videoBitrate: '5000k' },
      'TRANSCODE_720': { resolution: '1280x720', videoBitrate: '2500k' },
      'TRANSCODE_480': { resolution: '854x480', videoBitrate: '1000k' }
    };

    return settings[format] || settings['TRANSCODE_720'];
  }

  async transcodeVideo(inputPath, format, jobId, progressCallback) {
    try {
      const settings = this.getTranscodeSettings(format);
      const outputFileName = `${jobId}_${format.toLowerCase()}.mp4`;
      const outputPath = path.join('/tmp', outputFileName);
      
      return new Promise((resolve, reject) => {
        ffmpeg(inputPath)
        .videoCodec('libx264')
        .audioCodec('aac')
        .size(settings.resolution)
        .videoBitrate(settings.videoBitrate)
        .audioBitrate('128k')
        .fps(30)
        .addOption('-preset', 'medium')
        .addOption('-crf', '23')
        .output(outputPath)
        .on('start', (commandLine) => {
          console.log(`Started FFmpeg for ${format}:`, commandLine);
        })
        .on('progress', (progress) => {
          if (progressCallback && progress.percent) {
            progressCallback(Math.round(progress.percent));
          }
        })
        .on('end', () => {
          console.log(`Transcoding completed for ${format}: ${outputPath}`);
          resolve({
            path: outputPath,
            format: format,
            filename: outputFileName
          });
        })
        .on('error', (err, stdout, stderr) => {
          console.error(`FFmpeg error for ${format}:`, err.message);
          console.error('FFmpeg stderr:', stderr);
          reject(new Error(`Transcoding failed for ${format}: ${err.message}`));
        })
        .run();
      });
    } catch (error) {
      console.error(`Error setting up transcoding for ${format}:`, error);
      throw InternalServerError(`Failed to start transcoding: ${error.message}`);
    }
  }

  async getVideoMetadata(inputPath) {
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(inputPath, (err, metadata) => {
        if (err) {
          console.error('FFprobe error:', err);
          reject(new Error(`Failed to get video metadata: ${err.message}`));
          return;
        }

        try {
          const videoStream = metadata.streams.find(stream => stream.codec_type === 'video');
          const audioStream = metadata.streams.find(stream => stream.codec_type === 'audio');

          const result = {
            format: metadata.format || {},
            video: videoStream || {},
            audio: audioStream || {},
            duration: metadata.format?.duration || 0,
            size: metadata.format?.size || 0,
            bitrate: metadata.format?.bit_rate || 0
          };

          console.log('Video metadata extracted successfully');
          resolve(result);
        } catch (parseError) {
          console.error('Error parsing metadata:', parseError);
          reject(new Error(`Failed to parse video metadata: ${parseError.message}`));
        }
      });
    });
  }

  async generateThumbnail(inputPath, jobId) {
    const outputFileName = `${jobId}_thumbnail.jpg`;
    const outputPath = path.join('/tmp', outputFileName);

    return new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .screenshots({
          timestamps: ['50%'],
          filename: outputFileName,
          folder: '/tmp',
          size: '320x240'
        })
        .on('end', () => {
          console.log('Thumbnail generated successfully');
          resolve({
            path: outputPath,
            format: 'THUMBNAIL',
            filename: outputFileName
          });
        })
        .on('error', (err) => {
          console.error('Thumbnail generation error:', err);
          reject(new Error(`Failed to generate thumbnail: ${err.message}`));
        });
    });
  }

  async generateGIF(inputPath, jobId) {
    const outputFileName = `${jobId}_preview.gif`;
    const outputPath = path.join('/tmp', outputFileName);

    return new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .outputOptions([
          '-vf', 'fps=10,scale=320:-1:flags=lanczos,palettegen',
          '-t', '3'
        ])
        .output(outputPath)
        .on('end', () => {
          console.log('GIF preview generated successfully');
          resolve({
            path: outputPath,
            format: 'GIF',
            filename: outputFileName
          });
        })
        .on('error', (err) => {
          console.error('GIF generation error:', err);
          reject(new Error(`Failed to generate GIF: ${err.message}`));
        })
        .run();
    });
  }

  // Cleanup temporary files
  async cleanup(filePaths) {
    const results = [];
    for (const filePath of filePaths) {
      try {
        if (await fs.pathExists(filePath)) {
          await fs.remove(filePath);
          console.log(`Cleaned up: ${filePath}`);
          results.push({ path: filePath, success: true });
        }
      } catch (error) {
        console.error(`Failed to cleanup ${filePath}:`, error.message);
        results.push({ path: filePath, success: false, error: error.message });
      }
    }
    return results;
  }
}

module.exports = new VideoTranscodeService();