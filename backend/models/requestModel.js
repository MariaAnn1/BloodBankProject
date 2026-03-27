/* ═══════════════════════════════
   BLOOD REQUEST MODEL — MySQL Edition
   ═══════════════════════════════ */
'use strict';

const { query, getClient } = require('../db');

const RequestModel = {
    async createRequest({ blood_group, location, units_required, urgency_level, requested_by }) {
        const result = await query(
            `INSERT INTO blood_requests
               (blood_group, location, units_required, urgency_level, requested_by)
             VALUES (?, ?, ?, ?, ?)`,
            [blood_group, location, units_required, urgency_level, requested_by || null]
        );
        const { rows } = await query(
            'SELECT * FROM blood_requests WHERE request_id = ?',
            [result.rows[0]?.insertId ?? result.rows.insertId]
        );
        return rows[0];
    },

    async getAllRequests() {
        const { rows } = await query(
            `SELECT r.*, u.full_name AS requester_name
             FROM blood_requests r
             LEFT JOIN users u ON u.user_id = r.requested_by
             ORDER BY r.request_date DESC`
        );
        return rows;
    },

    async findById(request_id) {
        const { rows } = await query(
            'SELECT * FROM blood_requests WHERE request_id = ?',
            [request_id]
        );
        return rows[0] || null;
    },

    async approveRequest(request_id) {
        const client = await getClient();
        try {
            await client.query('BEGIN');

            // Fetch request with lock
            const { rows: reqRows } = await client.query(
                'SELECT * FROM blood_requests WHERE request_id = ? FOR UPDATE',
                [request_id]
            );
            const req = reqRows[0];

            if (!req) {
                await client.query('ROLLBACK');
                return { success: false, message: 'Request not found.' };
            }

            if (req.status !== 'Pending') {
                await client.query('ROLLBACK');
                return { success: false, message: `Request is already ${req.status}.` };
            }

            // Lock blood bank row
            const { rows: bankRows } = await client.query(
                'SELECT * FROM blood_banks WHERE blood_group = ? FOR UPDATE',
                [req.blood_group]
            );
            const bank = bankRows[0];

            if (!bank) {
                await client.query('ROLLBACK');
                return { success: false, message: `No blood bank entry for group ${req.blood_group}.` };
            }

            if (bank.available_units < req.units_required) {
                await client.query('ROLLBACK');
                return {
                    success: false,
                    message: `Insufficient stock. Available: ${bank.available_units} units of ${req.blood_group}, Required: ${req.units_required} units.`
                };
            }

            // Deduct stock
            await client.query(
                'UPDATE blood_banks SET available_units = available_units - ? WHERE blood_group = ?',
                [req.units_required, req.blood_group]
            );

            // Mark as Completed
            await client.query(
                `UPDATE blood_requests SET status = 'Completed' WHERE request_id = ?`,
                [request_id]
            );

            await client.query('COMMIT');

            // Fetch updated request to return
            const { rows: updatedRows } = await query(
                'SELECT * FROM blood_requests WHERE request_id = ?',
                [request_id]
            );
            return { success: true, message: 'Request approved and inventory updated.', request: updatedRows[0] };

        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }
    }
};

module.exports = RequestModel;
