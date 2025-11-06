const express = require('express');
const {authenticate, requireAuth, optionalAuth} = require('../middleware/auth');
const jobController = require('../controllers/jobController');

const router = express.Router();

// ===== IMPORTANT: Route Order Matters! =====
// Specific routes MUST come before generic /:id routes
// Otherwise /:id will catch "/stats" and treat it as a job ID

// Authenticated routes with specific paths (defined BEFORE /:id)
router.get('/', authenticate, jobController.getAllJobs);
router.post('/', authenticate, jobController.createJob);
router.get('/stats', authenticate, jobController.getUserStats);
router.get('/process-stats', authenticate, jobController.getProcessingStatus);
router.get('/events', authenticate, jobController.getJobEvents);
router.post('/load-test', authenticate, jobController.runLoadTest);

// Admin routes (specific paths)
router.get('/admin/stats', requireAuth('admin'), jobController.getAdminJobStats);
router.get('/admin/all', requireAuth('admin'), jobController.getAllJobsAdmin);
router.get('/admin/processing-status', requireAuth('admin'), jobController.getProcessingStatus);
router.get('/admin/recent-activity', requireAuth('admin'), jobController.getRecentActivity);
router.post('/admin/restart-failed', requireAuth('admin'), jobController.restartFailedJobs);
router.delete('/admin/cleanup-old', requireAuth('admin'), jobController.cleanupOldJobs);
router.delete('/admin/:id', requireAuth('admin'), jobController.deleteJobAdmin);

// Generic /:id routes MUST come LAST (they match anything)
// These use optionalAuth for public video viewing
router.get('/:id/stream', optionalAuth, jobController.streamVideo);
router.get('/:id/assets', authenticate, jobController.getJobAssets);
router.get('/:id/assets/:assetId/download', authenticate, jobController.downloadAsset.bind(jobController));
router.get('/:id', optionalAuth, jobController.getJobById);
router.put('/:id', authenticate, jobController.updateJob);
router.delete('/:id', authenticate, jobController.deleteJob);

module.exports = router;