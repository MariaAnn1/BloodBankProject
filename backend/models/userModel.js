/* ═══════════════════════════════
   USER MODEL — MySQL Edition
   ═══════════════════════════════ */
'use strict';

const { query } = require('../db');

const UserModel = {
    async createUser({ full_name, email, phone_number, role = 'Donor' }) {
        const result = await query(
            `INSERT INTO users (full_name, email, phone_number, role)
             VALUES (?, ?, ?, ?)`,
            [full_name, email, phone_number, role]
        );
        // MySQL has no RETURNING — fetch by insertId
        const { rows } = await query(
            'SELECT * FROM users WHERE user_id = ?',
            [result.rows[0]?.insertId ?? result.rows.insertId]
        );
        return rows[0];
    },

    async findByEmail(email) {
        const { rows } = await query(
            'SELECT * FROM users WHERE email = ?',
            [email]
        );
        return rows[0] || null;
    },

    async findById(user_id) {
        const { rows } = await query(
            'SELECT * FROM users WHERE user_id = ?',
            [user_id]
        );
        return rows[0] || null;
    }
};

module.exports = UserModel;
