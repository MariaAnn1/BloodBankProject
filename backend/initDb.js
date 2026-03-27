/* ═══════════════════════════════════════════
   DATABASE INITIALISER — MySQL Edition
   Creates all tables, expiry log, and realistic dummy blood stock
   ═══════════════════════════════════════════ */

'use strict';

const { query } = require('./db');

async function initDb() {
    // ── 1. Users ──────────────────────────────
    await query(`
        CREATE TABLE IF NOT EXISTS users (
            user_id      INT          NOT NULL AUTO_INCREMENT PRIMARY KEY,
            full_name    VARCHAR(150) NOT NULL,
            email        VARCHAR(200) NOT NULL UNIQUE,
            phone_number VARCHAR(20)  NOT NULL,
            role         ENUM('Donor','Recipient') NOT NULL DEFAULT 'Donor',
            created_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB
    `);

    // ── 2. Donors ─────────────────────────────
    await query(`
        CREATE TABLE IF NOT EXISTS donors (
            donor_id            INT          NOT NULL AUTO_INCREMENT PRIMARY KEY,
            user_id             INT          NOT NULL,
            blood_group         VARCHAR(5)   NOT NULL,
            location            VARCHAR(150) NOT NULL,
            total_units_donated INT          NOT NULL DEFAULT 0,
            availability        TINYINT(1)   NOT NULL DEFAULT 1,
            CONSTRAINT fk_donors_user FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
        ) ENGINE=InnoDB
    `);

    // ── 3. Blood_Banks ────────────────────────
    await query(`
        CREATE TABLE IF NOT EXISTS blood_banks (
            bank_id         INT          NOT NULL AUTO_INCREMENT PRIMARY KEY,
            bank_name       VARCHAR(200) NOT NULL DEFAULT 'LifeFlow Central',
            location        VARCHAR(150) NOT NULL DEFAULT 'Delhi',
            blood_group     VARCHAR(5)   NOT NULL UNIQUE,
            available_units INT          NOT NULL DEFAULT 0,
            created_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB
    `);

    // ── 4. Blood_Requests ─────────────────────
    await query(`
        CREATE TABLE IF NOT EXISTS blood_requests (
            request_id     INT          NOT NULL AUTO_INCREMENT PRIMARY KEY,
            blood_group    VARCHAR(5)   NOT NULL,
            location       VARCHAR(150) NOT NULL,
            units_required INT          NOT NULL,
            urgency_level  ENUM('Critical','Urgent','Normal') NOT NULL,
            requested_by   INT          NULL,
            status         ENUM('Pending','Approved','Completed') NOT NULL DEFAULT 'Pending',
            request_date   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT fk_requests_user FOREIGN KEY (requested_by) REFERENCES users(user_id) ON DELETE SET NULL
        ) ENGINE=InnoDB
    `);

    // ── 5. Blood_Stock ────────────────────────
    await query(`
        CREATE TABLE IF NOT EXISTS blood_stock (
            unit_id       INT        NOT NULL AUTO_INCREMENT PRIMARY KEY,
            blood_group   VARCHAR(5) NOT NULL,
            donation_date DATE       NOT NULL DEFAULT (CURRENT_DATE),
            expiry_date   DATE       NOT NULL,
            status        ENUM('Available','Expired','Used') NOT NULL DEFAULT 'Available',
            donor_id      INT        NULL,
            CONSTRAINT fk_stock_donor FOREIGN KEY (donor_id) REFERENCES donors(donor_id) ON DELETE SET NULL
        ) ENGINE=InnoDB
    `);

    // ── 6. Expiry_Log ─────────────────────────
    await query(`
        CREATE TABLE IF NOT EXISTS expiry_log (
            log_id          INT          NOT NULL AUTO_INCREMENT PRIMARY KEY,
            unit_id         INT          NOT NULL,
            blood_group     VARCHAR(5)   NOT NULL,
            expiry_date     DATE         NOT NULL,
            auto_expired_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
            trigger_source  VARCHAR(50)  NOT NULL DEFAULT 'auto-scheduler'
        ) ENGINE=InnoDB
    `);

    // ── 7. Seed Blood_Banks and Realistic Stock (first boot only) ──
    const { rows } = await query('SELECT COUNT(*) AS cnt FROM blood_banks');
    if (parseInt(rows[0].cnt, 10) === 0) {
        console.log('🌱  Seeding realistic dummy blood stock...');

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
            const availableCount = plan.extras.filter(d => d >= 0).length;

            await query(
                `INSERT IGNORE INTO blood_banks (blood_group, available_units)
                 VALUES (?, ?)`,
                [plan.bg, availableCount]
            );

            for (const offsetDays of plan.extras) {
                const status = offsetDays < 0 ? 'Expired' : 'Available';
                await query(
                    `INSERT INTO blood_stock (blood_group, expiry_date, status)
                     VALUES (?, DATE_ADD(CURDATE(), INTERVAL ? DAY), ?)`,
                    [plan.bg, offsetDays, status]
                );
            }

            console.log(`   ✅ ${plan.bg}: ${plan.extras.length} units seeded`);
        }

        console.log('🩸  Dummy blood stock seeded (includes units expiring today, tomorrow, and beyond).');
    }

    console.log('📦  Database schema ready.');
}

module.exports = initDb;
