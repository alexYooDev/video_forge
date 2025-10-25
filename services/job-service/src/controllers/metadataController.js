const metadataService = require('../services/metadataService');
const { apiLogger } = require('../utils/logger');

class MetadataController {
  /**
   * Extract metadata from video in S3
   * POST /api/metadata/extract
   * Body: { s3Key: string }
   */
  async extractMetadata(req, res, next) {
    try {
      const { s3Key } = req.body;

      if (!s3Key) {
        return res.status(400).json({
          error: 's3Key is required'
        });
      }

      apiLogger.info('Metadata extraction requested', { s3Key, user: req.user?.id });

      const metadata = await metadataService.extractMetadata(s3Key);

      res.status(200).json({
        success: true,
        metadata
      });
    } catch (error) {
      apiLogger.error('Metadata extraction failed', error, { s3Key: req.body?.s3Key });
      next(error);
    }
  }
}

module.exports = new MetadataController();
