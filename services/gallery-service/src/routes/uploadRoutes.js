const express = require('express');
const router = express.Router();
const uploadController = require('../controllers/uploadController');
const { authenticate } = require('../middleware/auth');

router.post('/generate-url', authenticate, uploadController.generateUploadUrl);
router.post('/confirm', authenticate, uploadController.confirmUpload);

module.exports = router;
