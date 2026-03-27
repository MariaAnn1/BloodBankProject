'use strict';
const express = require('express');
const router = express.Router();
const { getRequests, createRequest, approveRequest } = require('../controllers/requestController');

// GET  /api/requests
router.get('/', getRequests);

// POST /api/request
router.post('/', createRequest);

// PUT  /api/request/approve
router.put('/approve', approveRequest);

module.exports = router;
