const express = require('express');
const {authenticate, requireAuth} = require('../middleware/auth');
const jobController = require('../controllers/jobController');

const router = express.Router();

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
router.delete('/admin/:id', requireAuth('admin'), jobController.deleteJobAdmin);

// video processing
router.get('/:id', jobController.getJobById);
router.put('/:id', jobController.updateJob);
router.delete('/:id', jobController.deleteJob);

router.get('/:id/assets', jobController.getJobAssets);
router.get('/:id/assets/:assetId/download', jobController.downloadAsset.bind(jobController));

module.exports = router;