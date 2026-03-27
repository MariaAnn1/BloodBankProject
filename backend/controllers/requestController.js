/* ═══════════════════════════════
   REQUEST CONTROLLER
   POST /api/request
   PUT  /api/request/approve
   GET  /api/requests
   ═══════════════════════════════ */
'use strict';

const RequestModel = require('../models/requestModel');

const VALID_BG = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
const VALID_URGENCY = ['Critical', 'Urgent', 'Normal'];

/**
 * GET /api/requests
 * Returns all blood requests ordered by date DESC.
 */
async function getRequests(req, res) {
    try {
        const requests = await RequestModel.getAllRequests();
        return res.json({ requests });
    } catch (err) {
        console.error('getRequests error:', err);
        return res.status(500).json({ error: 'Internal server error.' });
    }
}

/**
 * POST /api/request
 * Body: { blood_group, location, units_required, urgency_level, requested_by? }
 */
async function createRequest(req, res) {
    try {
        const { blood_group, location, units_required, urgency_level, requested_by } = req.body;

        const missing = [];
        if (!blood_group) missing.push('blood_group');
        if (!location?.trim()) missing.push('location');
        if (!units_required) missing.push('units_required');
        if (!urgency_level) missing.push('urgency_level');

        if (missing.length) {
            return res.status(400).json({ error: `Missing required fields: ${missing.join(', ')}` });
        }

        if (!VALID_BG.includes(blood_group)) {
            return res.status(400).json({ error: 'Invalid blood_group.' });
        }

        if (!VALID_URGENCY.includes(urgency_level)) {
            return res.status(400).json({ error: `urgency_level must be one of: ${VALID_URGENCY.join(', ')}` });
        }

        const unitsNum = parseInt(units_required, 10);
        if (isNaN(unitsNum) || unitsNum < 1) {
            return res.status(400).json({ error: 'units_required must be a positive integer.' });
        }

        const request = await RequestModel.createRequest({
            blood_group,
            location: location.trim(),
            units_required: unitsNum,
            urgency_level,
            requested_by: requested_by ? parseInt(requested_by, 10) : null
        });

        return res.status(201).json({
            message: 'Blood request submitted successfully.',
            request
        });

    } catch (err) {
        console.error('createRequest error:', err);
        return res.status(500).json({ error: 'Internal server error.' });
    }
}

/**
 * PUT /api/request/approve
 * Body: { request_id }
 * Atomically checks stock, deducts, and marks Completed.
 */
async function approveRequest(req, res) {
    try {
        const { request_id } = req.body;

        if (!request_id) {
            return res.status(400).json({ error: 'request_id is required.' });
        }

        const result = await RequestModel.approveRequest(parseInt(request_id, 10));

        if (!result.success) {
            return res.status(400).json({ error: result.message });
        }

        return res.json({ message: result.message, request: result.request });

    } catch (err) {
        console.error('approveRequest error:', err);
        return res.status(500).json({ error: 'Internal server error.' });
    }
}

module.exports = { getRequests, createRequest, approveRequest };
