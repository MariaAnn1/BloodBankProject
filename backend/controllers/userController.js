/* ═══════════════════════════════
   USER CONTROLLER
   POST /api/register
   ═══════════════════════════════ */
'use strict';

const UserModel = require('../models/userModel');
const DonorModel = require('../models/donorModel');

/**
 * Register a new user as a Donor.
 * Creates a row in `users` then a row in `donors`.
 * Body: { full_name, email, phone_number, blood_group, location, units_donated? }
 */
async function register(req, res) {
    try {
        const { full_name, email, phone_number, blood_group, location, units_donated } = req.body;

        // Basic validation
        const missing = [];
        if (!full_name?.trim()) missing.push('full_name');
        if (!email?.trim()) missing.push('email');
        if (!phone_number?.trim()) missing.push('phone_number');
        if (!blood_group?.trim()) missing.push('blood_group');
        if (!location?.trim()) missing.push('location');

        if (missing.length) {
            return res.status(400).json({ error: `Missing required fields: ${missing.join(', ')}` });
        }

        // Phone validation
        if (!/^\d{10}$/.test(phone_number.trim())) {
            return res.status(400).json({ error: 'phone_number must be exactly 10 digits.' });
        }

        // Valid blood groups
        const VALID_BG = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
        if (!VALID_BG.includes(blood_group.trim())) {
            return res.status(400).json({ error: `Invalid blood_group. Must be one of: ${VALID_BG.join(', ')}` });
        }

        // Duplicate email check
        const existing = await UserModel.findByEmail(email.trim().toLowerCase());
        if (existing) {
            return res.status(409).json({ error: 'A user with this email is already registered.' });
        }

        // Create user
        const user = await UserModel.createUser({
            full_name: full_name.trim(),
            email: email.trim().toLowerCase(),
            phone_number: phone_number.trim(),
            role: 'Donor'
        });

        const units = parseInt(units_donated, 10) || 0;

        // Create donor
        const donor = await DonorModel.createDonor({
            user_id: user.user_id,
            blood_group: blood_group.trim(),
            location: location.trim(),
            total_units_donated: 0
        });

        // If units donated at registration, record donation atomically
        if (units > 0) {
            await DonorModel.recordDonation(donor.donor_id, blood_group.trim(), units);
            donor.total_units_donated = units;
        }

        return res.status(201).json({
            message: 'Donor registered successfully.',
            user,
            donor
        });

    } catch (err) {
        if (err.code === '23505') {
            return res.status(409).json({ error: 'A user with this email is already registered.' });
        }
        console.error('register error:', err);
        return res.status(500).json({ error: 'Internal server error.' });
    }
}

module.exports = { register };
