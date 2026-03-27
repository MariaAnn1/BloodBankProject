/* ═══════════════════════════════
   USER MODEL
   ═══════════════════════════════ */
'use strict';

const { query } = require('../db');

const UserModel = {
    async createUser({ full_name, email, phone_number, role = 'Donor' }) {
        const { rows } = await query(
            `INSERT INTO users (full_name, email, phone_number, role)
             VALUES ($1, $2, $3, $4)
             RETURNING *`,
            [full_name, email, phone_number, role]
        );
        return rows[0];
    },

    async findByEmail(email) {
        const { rows } = await query(
            'SELECT * FROM users WHERE email = $1',
            [email]
        );
        return rows[0] || null;
    },

    async findById(user_id) {
        const { rows } = await query(
            'SELECT * FROM users WHERE user_id = $1',
            [user_id]
        );
        return rows[0] || null;
    }
};

module.exports = UserModel;
