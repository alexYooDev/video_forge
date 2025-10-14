const express = require('express');
const {authenticate, requireAuth, optionalAuth} = require('../middleware/auth');
const jobController = require('../controllers/jobController');

const router = express.Router();

// Public routes with optional auth (for viewing public videos)
router.get('/:id/stream', optionalAuth, jobController.streamVideo);
router.get('/:id', optionalAuth, jobController.getJobById);

// All other routes require authentication
router.use(authenticate);

router.get('/', jobController.getAllJobs);
router.post('/', jobController.createJob);
router.get('/stats', jobController.getUserStats);
router.get('/process-stats', jobController.getProcessingStatus);
router.get('/events', jobController.getJobEvents);
// load testing purpose
router.post('/load-test', jobController.runLoadTest);

// Admin routes
router.get('/admin/stats', requireAuth('admin'), jobController.getAdminJobStats);
router.get('/admin/all', requireAuth('admin'), jobController.getAllJobsAdmin);
router.get('/admin/processing-status', requireAuth('admin'), jobController.getProcessingStatus);
router.get('/admin/recent-activity', requireAuth('admin'), jobController.getRecentActivity);
router.post('/admin/restart-failed', requireAuth('admin'), jobController.restartFailedJobs);
router.delete('/admin/cleanup-old', requireAuth('admin'), jobController.cleanupOldJobs);
router.delete('/admin/:id', requireAuth('admin'), jobController.deleteJobAdmin);

// video processing (authenticated)
router.put('/:id', jobController.updateJob);
router.delete('/:id', jobController.deleteJob);
router.get('/:id/assets', jobController.getJobAssets);
router.get('/:id/assets/:assetId/download', jobController.downloadAsset.bind(jobController));

module.exports = router;