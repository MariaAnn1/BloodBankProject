'use strict';
const express = require('express');
const router = express.Router();
const { getDonors, donate } = require('../controllers/donorController');

// GET  /api/donors
router.get('/', getDonors);

// POST /api/donate
router.post('/donate', donate);

module.exports = router;
