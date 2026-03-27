'use strict';
const express = require('express');
const router = express.Router();
const { getInventory, getDetailedStock, removeExpiredUnit, getExpiryLog, getExpiringSoon } = require('../controllers/inventoryController');

// GET /api/inventory
router.get('/', getInventory);

// GET /api/inventory/expiry-log
router.get('/expiry-log', getExpiryLog);

// GET /api/inventory/expiring-soon?days=3
router.get('/expiring-soon', getExpiringSoon);

// GET /api/inventory/stock
router.get('/stock', getDetailedStock);

// DELETE /api/inventory/stock/:id
router.delete('/stock/:id', removeExpiredUnit);

module.exports = router;
