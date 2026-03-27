/* ═══════════════════════════════════════════
   DATABASE INITIALISER
   Creates all tables and seeds Blood_Banks
   ═══════════════════════════════════════════ */

'use strict';

const { query } = require('./db');

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

async function initDb() {
    // ── 1. Users ──────────────────────────────
    await query(`
        CREATE TABLE IF NOT EXISTS users (
            user_id       SERIAL PRIMARY KEY,
            full_name     VARCHAR(150) NOT NULL,
            email         VARCHAR(200) UNIQUE NOT NULL,
            phone_number  VARCHAR(20)  NOT NULL,
            role          VARCHAR(20)  NOT NULL DEFAULT 'Donor'
                          CHECK (role IN ('Donor','Recipient')),
            created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
        )
    `);

    // ── 2. Donors ─────────────────────────────
    await query(`
        CREATE TABLE IF NOT EXISTS donors (
            donor_id            SERIAL PRIMARY KEY,
            user_id             INTEGER      NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
            blood_group         VARCHAR(5)   NOT NULL,
            location            VARCHAR(150) NOT NULL,
            total_units_donated INTEGER      NOT NULL DEFAULT 0,
            availability        BOOLEAN      NOT NULL DEFAULT TRUE
        )
    `);

    // ── 3. Blood_Banks ────────────────────────
    await query(`
        CREATE TABLE IF NOT EXISTS blood_banks (
            bank_id         SERIAL PRIMARY KEY,
            bank_name       VARCHAR(200) NOT NULL DEFAULT 'LifeFlow Central',
            location        VARCHAR(150) NOT NULL DEFAULT 'Delhi',
            blood_group     VARCHAR(5)   NOT NULL UNIQUE,
            available_units INTEGER      NOT NULL DEFAULT 0
                            CHECK (available_units >= 0),
            created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
        )
    `);

    // ── 4. Blood_Requests ─────────────────────
    await query(`
        CREATE TABLE IF NOT EXISTS blood_requests (
            request_id     SERIAL PRIMARY KEY,
            blood_group    VARCHAR(5)   NOT NULL,
            location       VARCHAR(150) NOT NULL,
            units_required INTEGER      NOT NULL CHECK (units_required > 0),
            urgency_level  VARCHAR(20)  NOT NULL
                           CHECK (urgency_level IN ('Critical','Urgent','Normal')),
            requested_by   INTEGER      REFERENCES users(user_id) ON DELETE SET NULL,
            status         VARCHAR(20)  NOT NULL DEFAULT 'Pending'
                           CHECK (status IN ('Pending','Approved','Completed')),
            request_date   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
        )
    `);

    // ── 4.5. Blood_Stock ──────────────────────
    await query(`
        CREATE TABLE IF NOT EXISTS blood_stock (
            unit_id       SERIAL PRIMARY KEY,
            blood_group   VARCHAR(5)   NOT NULL,
            donation_date DATE         NOT NULL DEFAULT CURRENT_DATE,
            expiry_date   DATE         NOT NULL,
            status        VARCHAR(20)  NOT NULL DEFAULT 'Available'
                          CHECK (status IN ('Available','Expired','Used')),
            donor_id      INTEGER      REFERENCES donors(donor_id) ON DELETE SET NULL
        )
    `);

    // ── 5. Seed Blood_Banks and Stock (skip if already populated) ──
    const { rows } = await query('SELECT COUNT(*) FROM blood_banks');
    if (parseInt(rows[0].count, 10) === 0) {
        for (const bg of BLOOD_GROUPS) {
            const units = Math.floor(Math.random() * 91) + 10; // 10 – 100
            await query(
                `INSERT INTO blood_banks (blood_group, available_units)
                 VALUES ($1, $2)
                 ON CONFLICT (blood_group) DO NOTHING`,
                [bg, units]
            );

            // Seed detailed stock
            for (let i = 0; i < units; i++) {
                // Random offset between -10 and +25 days
                const offsetDays = Math.floor(Math.random() * 36) - 10;
                await query(
                    `INSERT INTO blood_stock (blood_group, expiry_date, status)
                     VALUES ($1, CURRENT_DATE + $2 * INTERVAL '1 day', $3)`,
                    [bg, offsetDays, offsetDays < 0 ? 'Expired' : 'Available']
                );
            }
        }
        console.log('🩸  Blood bank inventory and stock seeded with random units (10–100 per group).');
    }

    console.log('📦  Database schema ready.');
}

module.exports = initDb;
