/* ═══════════════════════════════
   DONOR MODEL
   ═══════════════════════════════ */
'use strict';

const { query, getClient } = require('../db');

const DonorModel = {
    async createDonor({ user_id, blood_group, location, total_units_donated = 0 }) {
        const { rows } = await query(
            `INSERT INTO donors (user_id, blood_group, location, total_units_donated)
             VALUES ($1, $2, $3, $4)
             RETURNING *`,
            [user_id, blood_group, location, total_units_donated]
        );
        return rows[0];
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
            'SELECT * FROM donors WHERE user_id = $1',
            [user_id]
        );
        return rows[0] || null;
    },

    /**
     * Atomically add donated units to donor record AND blood bank inventory.
     * @param {number} donor_id
     * @param {string} blood_group
     * @param {number} units
     */
    async recordDonation(donor_id, blood_group, units) {
        const client = await getClient();
        try {
            await client.query('BEGIN');

            // Increment donor's total
            await client.query(
                `UPDATE donors
                 SET total_units_donated = total_units_donated + $1
                 WHERE donor_id = $2`,
                [units, donor_id]
            );

            // Insert into detailed blood_stock
            for (let i = 0; i < units; i++) {
                await client.query(
                    `INSERT INTO blood_stock (blood_group, donor_id, expiry_date)
                     VALUES ($1, $2, CURRENT_DATE + INTERVAL '35 days')`,
                    [blood_group, donor_id]
                );
            }

            // Increment blood bank stock
            await client.query(
                `UPDATE blood_banks
                 SET available_units = available_units + $1
                 WHERE blood_group = $2`,
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
