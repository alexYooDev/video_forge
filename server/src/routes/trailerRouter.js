const express = require('express')

const router = express.Router();

router.get('/', getAll);
router.get('/:id', getVideoById);
router.post('/', uploadVideo);
router.put('/', editVideo);
router.delete('/', deleteVideo);
