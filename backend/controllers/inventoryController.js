/* ═══════════════════════════════
   INVENTORY CONTROLLER
   GET /api/inventory
   ═══════════════════════════════ */
'use strict';

const BloodBankModel = require('../models/bloodBankModel');

/**
 * GET /api/inventory
 * Returns current blood unit counts per blood group.
 */
async function getInventory(req, res) {
    try {
        const rows = await BloodBankModel.getInventory();
        // Build a clean object: { 'A+': 45, 'B-': 12, ... }
        const inventory = {};
        rows.forEach(row => {
            inventory[row.blood_group] = parseInt(row.available_units, 10);
        });
        return res.json({ inventory, raw: rows });
    } catch (err) {
        console.error('getInventory error:', err);
        return res.status(500).json({ error: 'Internal server error.' });
    }
}

/**
 * GET /api/inventory/stock
 * Returns detailed list of all blood units with their donation/expiry dates.
 */
async function getDetailedStock(req, res) {
    try {
        const rows = await BloodBankModel.getBloodStock();
        return res.json({ stock: rows });
    } catch (err) {
        console.error('getDetailedStock error:', err);
        return res.status(500).json({ error: 'Internal server error.' });
    }
}

/**
 * DELETE /api/inventory/stock/:id
 * Marks a blood unit as expired (or removes it from active inventory)
 */
async function removeExpiredUnit(req, res) {
    try {
        const { id } = req.params;
        const success = await BloodBankModel.removeBloodUnit(id);
        if (!success) {
            return res.status(400).json({ error: 'Unit already expired/removed or does not exist.' });
        }
        return res.json({ message: 'Blood unit removed successfully.' });
    } catch (err) {
        console.error('removeExpiredUnit error:', err);
        return res.status(500).json({ error: 'Internal server error.' });
    }
}

module.exports = { getInventory, getDetailedStock, removeExpiredUnit };
