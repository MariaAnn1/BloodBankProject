/* ═══════════════════════════════════════════
   DATABASE INITIALISER
   Creates all tables, expiry log, and realistic dummy blood stock
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

    // ── 5. Blood_Stock ────────────────────────
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

    // ── 6. Expiry_Log ─────────────────────────
    // Audit trail written every time the auto-scheduler expires a unit
    await query(`
        CREATE TABLE IF NOT EXISTS expiry_log (
            log_id          SERIAL PRIMARY KEY,
            unit_id         INTEGER     NOT NULL,
            blood_group     VARCHAR(5)  NOT NULL,
            expiry_date     DATE        NOT NULL,
            auto_expired_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            trigger_source  VARCHAR(50) NOT NULL DEFAULT 'auto-scheduler'
        )
    `);

    // ── 7. Seed Blood_Banks and Realistic Dummy Stock (first boot only) ──
    const { rows } = await query('SELECT COUNT(*) FROM blood_banks');
    if (parseInt(rows[0].count, 10) === 0) {
        console.log('🌱  Seeding realistic dummy blood stock with specific expiry scenarios...');

        /*
         * SEED PLAN — each plan entry includes "extras": specific expiry offsets (in days)
         *   Negative = already overdue (should be auto-expired on first startup)
         *   0        = expires TODAY
         *   1        = expires TOMORROW   ← admin will see this highlighted in orange
         *   2-3      = expires soon        ← admin will see this as a warning
         *   7+       = healthy stock
         */
        const SEED_PLAN = [
            { bg: 'O+', extras: [-5, -3, -1, 0, 1, 1, 2, 3, 5, 7, 10, 14, 20, 25, 30] },
            { bg: 'O-', extras: [-2, -1, 0, 1, 3, 7, 14, 21, 28] },
            { bg: 'A+', extras: [-4, -1, 1, 2, 4, 8, 12, 18, 25, 30] },
            { bg: 'A-', extras: [-1, 1, 5, 10, 20, 28] },
            { bg: 'B+', extras: [-3, -1, 0, 1, 3, 6, 9, 15, 22, 30, 35] },
            { bg: 'B-', extras: [1, 4, 12, 25, 35] },
            { bg: 'AB+', extras: [-2, 0, 1, 2, 6, 10, 18, 28, 35] },
            { bg: 'AB-', extras: [1, 8, 20, 35] },
        ];

        for (const plan of SEED_PLAN) {
            // Count units that will be Available at seed time (offset >= 0)
            const availableCount = plan.extras.filter(d => d >= 0).length;

            await query(
                `INSERT INTO blood_banks (blood_group, available_units)
                 VALUES ($1, $2) ON CONFLICT (blood_group) DO NOTHING`,
                [plan.bg, availableCount]
            );

            for (const offsetDays of plan.extras) {
                await query(
                    `INSERT INTO blood_stock (blood_group, expiry_date, status)
                     VALUES ($1, CURRENT_DATE + ($2 * INTERVAL '1 day'), $3)`,
                    [plan.bg, offsetDays, offsetDays < 0 ? 'Expired' : 'Available']
                );
            }

            console.log(`   ✅ ${plan.bg}: ${plan.extras.length} units seeded`);
        }

        console.log('🩸  Realistic dummy blood stock seeded (includes units expiring today, tomorrow, and beyond).');
    }

    console.log('📦  Database schema ready.');
}

module.exports = initDb;
