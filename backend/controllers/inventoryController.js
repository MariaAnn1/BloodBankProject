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

/**
 * GET /api/inventory/expiry-log
 * Returns the audit log of all auto-expired units (most recent first).
 */
async function getExpiryLog(req, res) {
    try {
        const { rows } = await require('../db').query(`
            SELECT log_id, unit_id, blood_group,
                   TO_CHAR(expiry_date, 'YYYY-MM-DD')        AS expiry_date,
                   TO_CHAR(auto_expired_at, 'YYYY-MM-DD HH24:MI:SS') AS auto_expired_at,
                   trigger_source
            FROM expiry_log
            ORDER BY auto_expired_at DESC
            LIMIT 200
        `);
        return res.json({ log: rows });
    } catch (err) {
        console.error('getExpiryLog error:', err);
        return res.status(500).json({ error: 'Internal server error.' });
    }
}

/**
 * GET /api/inventory/expiring-soon?days=3
 * Shows units that will expire within the next `days` days.
 */
async function getExpiringSoon(req, res) {
    try {
        const days = parseInt(req.query.days || '3', 10);
        const { rows } = await require('../db').query(`
            SELECT unit_id, blood_group,
                   TO_CHAR(donation_date, 'YYYY-MM-DD') AS donation_date,
                   TO_CHAR(expiry_date, 'YYYY-MM-DD')   AS expiry_date,
                   (expiry_date - CURRENT_DATE)          AS days_left
            FROM blood_stock
            WHERE status = 'Available'
              AND expiry_date >= CURRENT_DATE
              AND expiry_date <= CURRENT_DATE + ($1 * INTERVAL '1 day')
            ORDER BY expiry_date ASC
        `, [days]);
        return res.json({ expiring_soon: rows });
    } catch (err) {
        console.error('getExpiringSoon error:', err);
        return res.status(500).json({ error: 'Internal server error.' });
    }
}

module.exports = { getInventory, getDetailedStock, removeExpiredUnit, getExpiryLog, getExpiringSoon };
