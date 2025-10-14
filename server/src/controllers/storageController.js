const s3Service = require('../services/s3Service');
const { MediaAsset, Job } = require('../models/index');
const { Op } = require('sequelize');
const { Sequelize } = require('sequelize');

class StorageController {
    async getStorageStats(req, res, next) {
        try {
            console.log('🗄️ Starting storage stats calculation...');

            // Get S3 bucket statistics
            console.log('📊 Getting S3 bucket stats...');
            const bucketStats = await s3Service.getBucketStats();
            console.log('✅ S3 bucket stats:', bucketStats);

            // Get database statistics with try-catch for each query
            console.log('📊 Getting database stats...');
            let totalAssets = 0;
            let totalJobs = 0;
            let recentAssets = 0;
            let assetsByType = [];

            try {
                totalAssets = await MediaAsset.count();
                console.log('✅ Total assets:', totalAssets);
            } catch (assetError) {
                console.error('❌ Error counting assets:', assetError.message);
            }

            try {
                totalJobs = await Job.count();
                console.log('✅ Total jobs:', totalJobs);
            } catch (jobError) {
                console.error('❌ Error counting jobs:', jobError.message);
            }

            // Get recent storage usage (last 30 days)
            console.log('📊 Getting recent assets...');
            try {
                recentAssets = await MediaAsset.count({
                    where: {
                        created_at: {
                            [Op.gte]: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
                        }
                    }
                });
                console.log('✅ Recent assets:', recentAssets);
            } catch (recentError) {
                console.error('❌ Error getting recent assets:', recentError.message);
            }

            // Calculate storage by type with simplified query
            console.log('📊 Getting assets by type...');
            try {
                // Try simple approach first
                const assets = await MediaAsset.findAll({
                    attributes: ['asset_type', 'file_size'],
                    raw: true
                });

                // Group manually to avoid SQL aggregation issues
                const typeMap = {};
                assets.forEach(asset => {
                    const type = asset.asset_type || 'unknown';
                    if (!typeMap[type]) {
                        typeMap[type] = { count: 0, total_size: 0 };
                    }
                    typeMap[type].count++;
                    typeMap[type].total_size += (asset.file_size || 0);
                });

                assetsByType = Object.entries(typeMap).map(([file_type, data]) => ({
                    file_type,
                    count: data.count,
                    total_size: data.total_size
                }));

                console.log('✅ Assets by type:', assetsByType);
            } catch (typeError) {
                console.error('❌ Error in assets by type query:', typeError.message);
                assetsByType = [];
            }

            const stats = {
                bucket: bucketStats,
                assets: {
                    total: totalAssets,
                    recent: recentAssets,
                    byType: assetsByType
                },
                jobs: {
                    total: totalJobs
                },
                lastUpdated: new Date().toISOString()
            };

            console.log('✅ Final stats object:', JSON.stringify(stats, null, 2));

            res.status(200).json({
                result: stats,
                message: 'Storage statistics retrieved successfully'
            });
        } catch (error) {
            console.error('❌ Storage stats error:', error);
            next(error);
        }
    }

    async cleanupTempFiles(req, res, next) {
        try {
            const result = await s3Service.cleanupTempFiles();

            res.status(200).json({
                result,
                message: `Cleanup completed. Removed ${result.deletedCount} temporary files, freed ${result.freedSpace} MB`
            });
        } catch (error) {
            next(error);
        }
    }

    async optimizeStorage(req, res, next) {
        try {
            // Find and remove orphaned S3 objects (files without database records)
            const orphanedFiles = await s3Service.findOrphanedFiles();
            const cleanupResult = await s3Service.removeOrphanedFiles(orphanedFiles);

            // Compress old media assets
            const compressionResult = await s3Service.compressOldAssets();

            res.status(200).json({
                result: {
                    orphanedFiles: cleanupResult,
                    compression: compressionResult
                },
                message: `Optimization completed. Removed ${cleanupResult.deletedCount} orphaned files, compressed ${compressionResult.compressedCount} assets`
            });
        } catch (error) {
            next(error);
        }
    }

    async generateStorageReport(req, res, next) {
        try {
            const { format = 'json', period = '30' } = req.query;

            const report = await s3Service.generateStorageReport({
                format,
                periodDays: parseInt(period)
            });

            if (format === 'csv') {
                res.setHeader('Content-Type', 'text/csv');
                res.setHeader('Content-Disposition', `attachment; filename=storage-report-${new Date().toISOString().split('T')[0]}.csv`);
                res.send(report);
            } else {
                res.status(200).json({
                    result: report,
                    message: 'Storage report generated successfully'
                });
            }
        } catch (error) {
            next(error);
        }
    }

    async getDetailedUsage(req, res, next) {
        try {
            const { userId } = req.params;

            let whereClause = {};
            if (userId) {
                whereClause.user_id = userId;
            }

            const userUsage = await MediaAsset.findAll({
                attributes: [
                    'job_id',
                    [Sequelize.fn('COUNT', Sequelize.col('id')), 'asset_count'],
                    [Sequelize.fn('SUM', Sequelize.col('file_size')), 'total_size']
                ],
                include: [{
                    model: Job,
                    as: 'job',
                    attributes: ['user_id', 'created_at'],
                    where: whereClause
                }],
                group: ['job_id', 'job.user_id', 'job.created_at'],
                raw: true
            });

            res.status(200).json({
                result: userUsage,
                message: 'Detailed usage statistics retrieved successfully'
            });
        } catch (error) {
            next(error);
        }
    }
}

module.exports = new StorageController();