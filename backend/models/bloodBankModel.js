/* ═══════════════════════════════
   BLOOD BANK MODEL — MySQL Edition
   ═══════════════════════════════ */
'use strict';

const { query, getClient } = require('../db');

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
            'SELECT * FROM blood_banks WHERE blood_group = ?',
            [blood_group]
        );
        return rows[0] || null;
    },

    async getBloodStock() {
        const { rows } = await query(
            `SELECT unit_id, blood_group,
                    DATE_FORMAT(donation_date, '%Y-%m-%d') AS donation_date,
                    DATE_FORMAT(expiry_date,   '%Y-%m-%d') AS expiry_date,
                    status
             FROM blood_stock
             WHERE status IN ('Available', 'Expired')
             ORDER BY expiry_date ASC`
        );
        return rows;
    },

    async removeBloodUnit(unit_id) {
        const client = await getClient();
        try {
            await client.query('BEGIN');

            // 1. Mark unit as Expired (only if currently Available)
            const result = await client.query(
                `UPDATE blood_stock
                 SET status = 'Expired'
                 WHERE unit_id = ? AND status = 'Available'`,
                [unit_id]
            );

            if (result.rowCount === 0) {
                await client.query('ROLLBACK');
                return false;
            }

            // 2. Fetch the blood group to decrement bank summary
            const { rows } = await client.query(
                'SELECT blood_group FROM blood_stock WHERE unit_id = ?',
                [unit_id]
            );
            const blood_group = rows[0]?.blood_group;

            if (blood_group) {
                await client.query(
                    `UPDATE blood_banks
                     SET available_units = GREATEST(0, available_units - 1)
                     WHERE blood_group = ?`,
                    [blood_group]
                );
            }

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
