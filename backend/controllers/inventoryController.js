/* ═══════════════════════════════
   INVENTORY CONTROLLER — MySQL Edition
   ═══════════════════════════════ */
'use strict';

const BloodBankModel = require('../models/bloodBankModel');
const { query } = require('../db');

async function getInventory(req, res) {
    try {
        const rows = await BloodBankModel.getInventory();
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

async function getDetailedStock(req, res) {
    try {
        const rows = await BloodBankModel.getBloodStock();
        return res.json({ stock: rows });
    } catch (err) {
        console.error('getDetailedStock error:', err);
        return res.status(500).json({ error: 'Internal server error.' });
    }
}

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

async function getExpiryLog(req, res) {
    try {
        const { rows } = await query(`
            SELECT log_id, unit_id, blood_group,
                   DATE_FORMAT(expiry_date,     '%Y-%m-%d')          AS expiry_date,
                   DATE_FORMAT(auto_expired_at, '%Y-%m-%d %H:%i:%s') AS auto_expired_at,
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

async function getExpiringSoon(req, res) {
    try {
        const days = parseInt(req.query.days || '3', 10);
        const { rows } = await query(`
            SELECT unit_id, blood_group,
                   DATE_FORMAT(donation_date, '%Y-%m-%d') AS donation_date,
                   DATE_FORMAT(expiry_date,   '%Y-%m-%d') AS expiry_date,
                   DATEDIFF(expiry_date, CURDATE())        AS days_left
            FROM blood_stock
            WHERE status = 'Available'
              AND expiry_date >= CURDATE()
              AND expiry_date <= DATE_ADD(CURDATE(), INTERVAL ? DAY)
            ORDER BY expiry_date ASC
        `, [days]);
        return res.json({ expiring_soon: rows });
    } catch (err) {
        console.error('getExpiringSoon error:', err);
        return res.status(500).json({ error: 'Internal server error.' });
    }
}

module.exports = { getInventory, getDetailedStock, removeExpiredUnit, getExpiryLog, getExpiringSoon };
