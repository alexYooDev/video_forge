const express = require('express');
// AWS SDK v3 clients (better SSO support)
const { CognitoIdentityProviderClient, ListUsersCommand, AdminDeleteUserCommand } = require('@aws-sdk/client-cognito-identity-provider');
const { SQSClient, GetQueueAttributesCommand } = require('@aws-sdk/client-sqs');
const { S3Client, ListObjectsV2Command, DeleteObjectsCommand } = require('@aws-sdk/client-s3');

const router = express.Router();

// AWS SDK setup (all values from Parameter Store/Secrets Manager)
const AWS_REGION = process.env.AWS_REGION || 'ap-southeast-2';
const cognito = new CognitoIdentityProviderClient({ region: AWS_REGION });
const sqs = new SQSClient({ region: AWS_REGION });
const s3 = new S3Client({ region: AWS_REGION });

// Database configuration (will connect to same RDS as job-service)
// All values loaded from AWS Parameter Store and Secrets Manager
// Support both PG_* (new) and DB_* (old ECS task definition) naming
const { Pool } = require('pg');

// Create a function to get pool config with current environment variables
function getPoolConfig() {
  return {
    host: process.env.PG_HOST || process.env.DB_HOST,
    database: process.env.PG_DATABASE || process.env.DB_NAME,
    user: process.env.PG_USERNAME || process.env.DB_USER,
    password: process.env.PG_PASSWORD || process.env.DB_PASSWORD,
    port: parseInt(process.env.PG_PORT || process.env.DB_PORT || '5432'),
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000
  };
}

// Lazy initialization - pool will be created on first use
let pool;
function getPool() {
  if (!pool) {
    pool = new Pool(getPoolConfig());
  }
  return pool;
}

// Configuration (all values from AWS Parameter Store)
const COGNITO_USER_POOL_ID = process.env.COGNITO_USER_POOL_ID;
const S3_BUCKET_NAME = process.env.S3_BUCKET_NAME;
const SQS_QUEUE_URL = process.env.SQS_QUEUE_URL;

/**
 * Jobs Admin - Get stats
 * GET /api/admin/jobs/stats
 */
router.get('/jobs/stats', async (req, res, next) => {
  try {
    // Get total users from Cognito (AWS SDK v3)
    const cognitoUsersResponse = await cognito.send(new ListUsersCommand({
      UserPoolId: COGNITO_USER_POOL_ID
    }));

    const totalUsers = cognitoUsersResponse.Users.length;

    // Get job stats from database
    const jobStatsQuery = `
      SELECT
        status,
        COUNT(*) as count,
        SUM(CASE WHEN created_at > NOW() - INTERVAL '24 hours' THEN 1 ELSE 0 END) as recent_count
      FROM jobs
      GROUP BY status
    `;

    const jobStatsResult = await getPool().query(jobStatsQuery);

    const jobStats = {};
    let recentJobs = 0;

    jobStatsResult.rows.forEach(row => {
      jobStats[row.status] = {
        count: parseInt(row.count),
        recentCount: parseInt(row.recent_count)
      };
      recentJobs += parseInt(row.recent_count);
    });

    res.json({
      stats: {
        totalUsers,
        recentJobs,
        jobStats
      }
    });
  } catch (error) {
    console.error('Get admin stats error:', error);
    next(error);
  }
});

/**
 * Jobs Admin - Get all jobs
 * GET /api/admin/jobs/all
 */
router.get('/jobs/all', async (req, res, next) => {
  try {
    const limit = req.query.limit || 10;

    const result = await getPool().query(
      'SELECT * FROM jobs ORDER BY created_at DESC LIMIT $1',
      [limit]
    );

    res.json({ jobs: result.rows });
  } catch (error) {
    console.error('Get all jobs error:', error);
    next(error);
  }
});

/**
 * Jobs Admin - Get processing status
 * GET /api/admin/jobs/processing-status
 */
router.get('/jobs/processing-status', async (req, res, next) => {
  try {
    // Get SQS queue attributes (AWS SDK v3)
    const queueAttrs = await sqs.send(new GetQueueAttributesCommand({
      QueueUrl: SQS_QUEUE_URL,
      AttributeNames: [
        'ApproximateNumberOfMessages',
        'ApproximateNumberOfMessagesNotVisible'
      ]
    }));

    // Get active jobs from database
    const activeJobsResult = await getPool().query(
      "SELECT COUNT(*) as count FROM jobs WHERE status = 'PROCESSING'"
    );

    res.json({
      status: {
        queue: {
          queuedJobs: parseInt(queueAttrs.Attributes.ApproximateNumberOfMessages),
          activeJobs: parseInt(activeJobsResult.rows[0].count),
          maxConcurrentJobs: 3
        },
        systemHealth: {
          database: { status: 'connected' },
          cache: { status: 'connected' }
        }
      }
    });
  } catch (error) {
    console.error('Get processing status error:', error);
    next(error);
  }
});

/**
 * Jobs Admin - Get recent activity
 * GET /api/admin/jobs/recent-activity
 */
router.get('/jobs/recent-activity', async (req, res, next) => {
  try {
    const result = await getPool().query(`
      SELECT
        id,
        status,
        user_email,
        created_at,
        updated_at
      FROM jobs
      ORDER BY updated_at DESC
      LIMIT 10
    `);

    const activities = result.rows.map(job => ({
      id: job.id,
      activity: `Job #${job.id} ${job.status.toLowerCase()} by ${job.user_email}`,
      timeAgo: getTimeAgo(job.updated_at),
      color: job.status === 'COMPLETED' ? 'green' : job.status === 'FAILED' ? 'red' : 'blue'
    }));

    res.json({ activities });
  } catch (error) {
    console.error('Get recent activity error:', error);
    next(error);
  }
});

/**
 * Jobs Admin - Restart failed jobs
 * POST /api/admin/jobs/restart-failed
 */
router.post('/jobs/restart-failed', async (req, res, next) => {
  try {
    const result = await getPool().query(`
      UPDATE jobs
      SET status = 'PENDING', updated_at = NOW()
      WHERE status = 'FAILED'
      RETURNING id
    `);

    res.json({
      success: true,
      message: `Restarted ${result.rowCount} failed jobs`,
      count: result.rowCount
    });
  } catch (error) {
    console.error('Restart failed jobs error:', error);
    next(error);
  }
});

/**
 * Jobs Admin - Cleanup old jobs
 * DELETE /api/admin/jobs/cleanup-old
 */
router.delete('/jobs/cleanup-old', async (req, res, next) => {
  try {
    const result = await getPool().query(`
      DELETE FROM jobs
      WHERE status = 'COMPLETED'
      AND created_at < NOW() - INTERVAL '30 days'
      RETURNING id
    `);

    res.json({
      success: true,
      message: `Deleted ${result.rowCount} old jobs`,
      count: result.rowCount
    });
  } catch (error) {
    console.error('Cleanup old jobs error:', error);
    next(error);
  }
});

/**
 * Jobs Admin - Delete specific job
 * DELETE /api/admin/jobs/:id
 */
router.delete('/jobs/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    const result = await getPool().query(
      'DELETE FROM jobs WHERE id = $1 RETURNING id',
      [id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Job not found' });
    }

    res.json({
      success: true,
      message: 'Job deleted successfully'
    });
  } catch (error) {
    console.error('Delete job error:', error);
    next(error);
  }
});

/**
 * Auth - Get all users
 * GET /api/admin/users
 */
router.get('/users', async (req, res, next) => {
  try {
    const cognitoUsersResponse = await cognito.send(new ListUsersCommand({
      UserPoolId: COGNITO_USER_POOL_ID
    }));

    const users = cognitoUsersResponse.Users.map(user => ({
      id: user.Username,
      username: user.Username,
      email: user.Attributes.find(attr => attr.Name === 'email')?.Value,
      status: user.UserStatus,
      enabled: user.Enabled,
      groups: user.Groups || [],
      createdDate: user.UserCreateDate,
      lastModifiedDate: user.UserLastModifiedDate
    }));

    res.json({ result: users });
  } catch (error) {
    console.error('Get users error:', error);
    next(error);
  }
});

/**
 * Auth - Delete user
 * DELETE /api/admin/users/:userId
 */
router.delete('/users/:userId', async (req, res, next) => {
  try {
    const { userId } = req.params;

    await cognito.send(new AdminDeleteUserCommand({
      UserPoolId: COGNITO_USER_POOL_ID,
      Username: userId
    }));

    res.json({
      success: true,
      message: 'User deleted successfully'
    });
  } catch (error) {
    console.error('Delete user error:', error);
    next(error);
  }
});

/**
 * Helper function to get storage stats
 */
async function getStorageStats() {
  const listParams = {
    Bucket: S3_BUCKET_NAME,
    Prefix: 'videos/'
  };

  let totalSize = 0;
  let totalFiles = 0;
  let continuationToken;

  do {
    if (continuationToken) {
      listParams.ContinuationToken = continuationToken;
    }

    const response = await s3.send(new ListObjectsV2Command(listParams));

    totalFiles += response.Contents?.length || 0;
    response.Contents?.forEach(obj => {
      totalSize += obj.Size;
    });

    continuationToken = response.NextContinuationToken;
  } while (continuationToken);

  const totalSizeGB = (totalSize / (1024 * 1024 * 1024)).toFixed(2);
  const totalSizeMB = (totalSize / (1024 * 1024)).toFixed(2);

  // Get recent assets (last 30 days)
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const recentResult = await getPool().query(
    'SELECT COUNT(*) as count FROM jobs WHERE created_at > $1',
    [thirtyDaysAgo]
  );

  return {
    bucket: {
      bucketName: S3_BUCKET_NAME,
      totalSize: totalSizeGB,
      totalSizeMB: totalSizeMB,
      totalFiles
    },
    assets: {
      total: totalFiles,
      recent: parseInt(recentResult.rows[0].count)
    },
    lastUpdated: new Date().toISOString()
  };
}

/**
 * Storage - Get stats
 * GET /api/storage/stats
 */
router.get('/storage/stats', async (req, res, next) => {
  try {
    const stats = await getStorageStats();
    res.json({ result: stats });
  } catch (error) {
    console.error('Get storage stats error:', error);
    next(error);
  }
});

/**
 * Storage - Cleanup temp files
 * POST /api/storage/cleanup-temp
 */
router.post('/storage/cleanup-temp', async (req, res, next) => {
  try {
    const tempPrefix = 'temp/';
    const oneDayAgo = new Date();
    oneDayAgo.setDate(oneDayAgo.getDate() - 1);

    const listResponse = await s3.send(new ListObjectsV2Command({
      Bucket: S3_BUCKET_NAME,
      Prefix: tempPrefix
    }));

    const oldObjects = listResponse.Contents?.filter(obj =>
      new Date(obj.LastModified) < oneDayAgo
    ) || [];

    let deletedCount = 0;
    let freedSpace = 0;

    if (oldObjects.length > 0) {
      const deleteParams = {
        Bucket: S3_BUCKET_NAME,
        Delete: {
          Objects: oldObjects.map(obj => ({ Key: obj.Key }))
        }
      };

      await s3.send(new DeleteObjectsCommand(deleteParams));
      deletedCount = oldObjects.length;
      freedSpace = (oldObjects.reduce((sum, obj) => sum + obj.Size, 0) / (1024 * 1024)).toFixed(2);
    }

    res.json({
      result: {
        deletedCount,
        freedSpace
      }
    });
  } catch (error) {
    console.error('Cleanup temp files error:', error);
    next(error);
  }
});

/**
 * Storage - Optimize storage
 * POST /api/storage/optimize
 */
router.post('/storage/optimize', async (req, res, next) => {
  try {
    // This is a placeholder - in production you'd implement actual optimization logic
    res.json({
      result: {
        orphanedFiles: {
          deletedCount: 0,
          freedSpace: '0'
        },
        compression: {
          compressedCount: 0
        }
      }
    });
  } catch (error) {
    console.error('Optimize storage error:', error);
    next(error);
  }
});

/**
 * Storage - Generate report
 * GET /api/storage/report
 */
router.get('/storage/report', async (req, res, next) => {
  try {
    const { format = 'json', period = 30 } = req.query;

    // Get storage stats using helper function
    const stats = await getStorageStats();

    if (format === 'csv') {
      const csv = `Bucket,Total Size (GB),Total Files\n${stats.bucket.bucketName},${stats.bucket.totalSize},${stats.bucket.totalFiles}`;
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=storage-report.csv');
      res.send(csv);
    } else {
      res.json({ result: stats });
    }
  } catch (error) {
    console.error('Generate storage report error:', error);
    next(error);
  }
});

// Helper function
function getTimeAgo(date) {
  const seconds = Math.floor((new Date() - new Date(date)) / 1000);

  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

module.exports = router;
