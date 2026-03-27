/* ═══════════════════════════════
   BLOOD REQUEST MODEL
   ═══════════════════════════════ */
'use strict';

const { query, getClient } = require('../db');

const RequestModel = {
    async createRequest({ blood_group, location, units_required, urgency_level, requested_by }) {
        const { rows } = await query(
            `INSERT INTO blood_requests
               (blood_group, location, units_required, urgency_level, requested_by)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING *`,
            [blood_group, location, units_required, urgency_level, requested_by || null]
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
            'SELECT * FROM blood_requests WHERE request_id = $1',
            [request_id]
        );
        return rows[0] || null;
    },

    /**
     * Atomically approve a request:
     *  1. Lock the blood bank row for the requested blood group.
     *  2. Check sufficient units are available.
     *  3. Deduct units.
     *  4. Mark request as Completed.
     *
     * @param {number} request_id
     * @returns {{ success: boolean, message: string, request?: object }}
     */
    async approveRequest(request_id) {
        const client = await getClient();
        try {
            await client.query('BEGIN');

            // Fetch the request inside the transaction
            const { rows: reqRows } = await client.query(
                'SELECT * FROM blood_requests WHERE request_id = $1 FOR UPDATE',
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

            // Lock the blood bank row
            const { rows: bankRows } = await client.query(
                'SELECT * FROM blood_banks WHERE blood_group = $1 FOR UPDATE',
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
                'UPDATE blood_banks SET available_units = available_units - $1 WHERE blood_group = $2',
                [req.units_required, req.blood_group]
            );

            // Update request status
            const { rows: updatedRows } = await client.query(
                `UPDATE blood_requests
                 SET status = 'Completed'
                 WHERE request_id = $1
                 RETURNING *`,
                [request_id]
            );

            await client.query('COMMIT');
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
