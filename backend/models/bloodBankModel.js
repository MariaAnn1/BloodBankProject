/* ═══════════════════════════════
   BLOOD BANK MODEL
   ═══════════════════════════════ */
'use strict';

const { query } = require('../db');

const BloodBankModel = {
    async getInventory() {
        const { rows } = await query(
            `SELECT blood_group, available_units
             FROM blood_banks
             ORDER BY blood_group`
        );
        return rows;
    },

    async getByBloodGroup(blood_group) {
        const { rows } = await query(
            'SELECT * FROM blood_banks WHERE blood_group = $1',
            [blood_group]
        );
        return rows[0] || null;
    },

    async getBloodStock() {
        // Fetch all available units ordered by expiry date
        const { rows } = await query(
            `SELECT unit_id, blood_group,
                    TO_CHAR(donation_date, 'YYYY-MM-DD') AS donation_date,
                    TO_CHAR(expiry_date, 'YYYY-MM-DD') AS expiry_date,
                    status
             FROM blood_stock
             WHERE status = 'Available' OR status = 'Expired'
             ORDER BY expiry_date ASC`
        );
        return rows;
    },

    async removeBloodUnit(unit_id) {
        // Mark unit as expired and decrement inventory atomically under a transaction
        const { getClient } = require('../db');
        const client = await getClient();
        try {
            await client.query('BEGIN');

            // 1. Mark unit as expired (and only if currently 'Available')
            const result = await client.query(
                `UPDATE blood_stock
                 SET status = 'Expired'
                 WHERE unit_id = $1 AND status = 'Available'
                 RETURNING blood_group`,
                [unit_id]
            );

            // If it was already Expired or Used, do nothing
            if (result.rowCount === 0) {
                await client.query('ROLLBACK');
                return false;
            }

            const blood_group = result.rows[0].blood_group;

            // 2. Decrement available_units in blood_banks schema
            await client.query(
                `UPDATE blood_banks
                 SET available_units = available_units - 1
                 WHERE blood_group = $1`,
                [blood_group]
            );

            await client.query('COMMIT');
            return true;
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }
    }
};

module.exports = BloodBankModel;
