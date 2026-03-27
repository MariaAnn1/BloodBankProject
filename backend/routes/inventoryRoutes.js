'use strict';
const express = require('express');
const router = express.Router();
const { getInventory, getDetailedStock, removeExpiredUnit } = require('../controllers/inventoryController');

// GET /api/inventory
router.get('/', getInventory);

// GET /api/inventory/stock
router.get('/stock', getDetailedStock);

// DELETE /api/inventory/stock/:id
router.delete('/stock/:id', removeExpiredUnit);

module.exports = router;
