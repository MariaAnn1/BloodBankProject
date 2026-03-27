/* ═══════════════════════════════
   DONOR CONTROLLER
   GET  /api/donors
   POST /api/donate
   ═══════════════════════════════ */
'use strict';

const DonorModel = require('../models/donorModel');

/**
 * GET /api/donors
 * Returns all donors with their user info.
 */
async function getDonors(req, res) {
    try {
        const donors = await DonorModel.getAllDonors();
        return res.json({ donors });
    } catch (err) {
        console.error('getDonors error:', err);
        return res.status(500).json({ error: 'Internal server error.' });
    }
}

/**
 * POST /api/donate
 * Records a donation: increments donor total + blood bank stock atomically.
 * Body: { donor_id, blood_group, units }
 */
async function donate(req, res) {
    try {
        const { donor_id, blood_group, units } = req.body;

        if (!donor_id || !blood_group || !units) {
            return res.status(400).json({ error: 'donor_id, blood_group, and units are required.' });
        }

        const unitsNum = parseInt(units, 10);
        if (isNaN(unitsNum) || unitsNum < 1) {
            return res.status(400).json({ error: 'units must be a positive integer.' });
        }

        const VALID_BG = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
        if (!VALID_BG.includes(blood_group)) {
            return res.status(400).json({ error: 'Invalid blood_group.' });
        }

        await DonorModel.recordDonation(parseInt(donor_id, 10), blood_group, unitsNum);

        return res.json({
            message: `Successfully recorded donation of ${unitsNum} unit(s) of ${blood_group}.`
        });

    } catch (err) {
        console.error('donate error:', err);
        return res.status(500).json({ error: 'Internal server error.' });
    }
}

module.exports = { getDonors, donate };
