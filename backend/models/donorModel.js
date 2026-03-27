/* ═══════════════════════════════
   DONOR MODEL — MySQL Edition
   ═══════════════════════════════ */
'use strict';

const { query, getClient } = require('../db');

const DonorModel = {
    async createDonor({ user_id, blood_group, location, total_units_donated = 0 }) {
        const { rows } = await query(
            `INSERT INTO donors (user_id, blood_group, location, total_units_donated)
             VALUES (?, ?, ?, ?)`,
            [user_id, blood_group, location, total_units_donated]
        );
        // MySQL doesn't have RETURNING — fetch the inserted row using insertId
        const inserted = await query('SELECT * FROM donors WHERE donor_id = ?', [rows[0]?.insertId ?? rows.insertId]);
        return inserted.rows[0];
    },

    async getAllDonors() {
        const { rows } = await query(
            `SELECT d.*, u.full_name, u.email, u.phone_number
             FROM donors d
             JOIN users u ON u.user_id = d.user_id
             ORDER BY d.donor_id DESC`
        );
        return rows;
    },

    async findByUserId(user_id) {
        const { rows } = await query(
            'SELECT * FROM donors WHERE user_id = ?',
            [user_id]
        );
        return rows[0] || null;
    },

    async recordDonation(donor_id, blood_group, units) {
        const client = await getClient();
        try {
            await client.query('BEGIN');

            // Increment donor's total
            await client.query(
                `UPDATE donors
                 SET total_units_donated = total_units_donated + ?
                 WHERE donor_id = ?`,
                [units, donor_id]
            );

            // Insert into detailed blood_stock with 35-day expiry
            for (let i = 0; i < units; i++) {
                await client.query(
                    `INSERT INTO blood_stock (blood_group, donor_id, expiry_date)
                     VALUES (?, ?, DATE_ADD(CURDATE(), INTERVAL 35 DAY))`,
                    [blood_group, donor_id]
                );
            }

            // Increment blood bank inventory
            await client.query(
                `UPDATE blood_banks
                 SET available_units = available_units + ?
                 WHERE blood_group = ?`,
                [units, blood_group]
            );

            await client.query('COMMIT');
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }
    }
};

module.exports = DonorModel;
