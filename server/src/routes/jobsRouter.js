const express = require('express');
const {authenticate} = require('../middleware/auth');
const jobController = require('../controllers/jobController');

const router = express.Router();

router.use(authenticate);

router.get('/', jobController.getAllJobs);
router.post('/', jobController.createJob);
router.get('/stats', jobController.getUserStats);
// load testing purpose
router.post('/process-sample', jobController.processSample);


// video processing
router.get('/:id', jobController.getJobById);
router.get('/:id', jobController.updateJob);
router.delete('/:id', jobController.deleteJob);
router.get('/:id/assets', jobController.getJobAssets);

module.exports = router;