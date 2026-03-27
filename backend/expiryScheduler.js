/* ═══════════════════════════════════════════════════
   BLOOD EXPIRY AUTO-SCHEDULER
   Purpose: Automatically expires blood units whose
            expiry_date has passed. Runs once at startup
            then every day at midnight.
   ═══════════════════════════════════════════════════ */

'use strict';

const { query, getClient } = require('./db');

/**
 * Core expiry logic (transactional):
 * 1. Find all Available units whose expiry_date < TODAY
 * 2. Mark each as 'Expired'
 * 3. Decrement blood_banks.available_units for each
 * 4. Write an entry to expiry_log for the audit trail
 */
async function runExpiryJob() {
    const client = await getClient();
    try {
        await client.query('BEGIN');

        // Step 1 — Find all overdue Available units
        const { rows: overdueUnits } = await client.query(`
            SELECT unit_id, blood_group, expiry_date
            FROM blood_stock
            WHERE status = 'Available'
              AND expiry_date < CURRENT_DATE
        `);

        if (overdueUnits.length === 0) {
            await client.query('ROLLBACK');
            console.log(`[ExpiryJob ${new Date().toISOString()}] ✅ No units to expire.`);
            return { expired: 0 };
        }

        // Step 2 — Mark them all Expired in one shot
        const unitIds = overdueUnits.map(u => u.unit_id);
        await client.query(
            `UPDATE blood_stock
             SET status = 'Expired'
             WHERE unit_id = ANY($1::int[])`,
            [unitIds]
        );

        // Step 3 — Decrement blood_banks summary per blood group
        const groupCounts = {};
        overdueUnits.forEach(u => {
            groupCounts[u.blood_group] = (groupCounts[u.blood_group] || 0) + 1;
        });

        for (const [bg, count] of Object.entries(groupCounts)) {
            await client.query(
                `UPDATE blood_banks
                 SET available_units = GREATEST(0, available_units - $1)
                 WHERE blood_group = $2`,
                [count, bg]
            );
        }

        // Step 4 — Write audit log entries
        for (const unit of overdueUnits) {
            await client.query(
                `INSERT INTO expiry_log (unit_id, blood_group, expiry_date, trigger_source)
                 VALUES ($1, $2, $3, 'auto-scheduler')`,
                [unit.unit_id, unit.blood_group, unit.expiry_date]
            );
        }

        await client.query('COMMIT');

        const summary = Object.entries(groupCounts)
            .map(([bg, n]) => `${bg}:${n}`)
            .join(', ');

        console.log(`[ExpiryJob ${new Date().toISOString()}] 🗑️  Auto-expired ${overdueUnits.length} unit(s) — [${summary}]`);
        return { expired: overdueUnits.length, summary: groupCounts };

    } catch (err) {
        await client.query('ROLLBACK');
        console.error('[ExpiryJob] ❌ Transaction failed:', err.message);
        throw err;
    } finally {
        client.release();
    }
}

/**
 * Get ms until the next midnight (server local time).
 * Adding 2 seconds buffer ensures we never fire a millisecond early.
 */
function msUntilMidnight() {
    const now = new Date();
    const midnight = new Date(now);
    midnight.setHours(24, 0, 2, 0); // next midnight + 2s
    return midnight - now;
}

/**
 * Start the scheduler:
 *  - Run immediately on startup
 *  - Then re-schedule itself to run every midnight
 */
async function startExpiryScheduler() {
    console.log('⏰  Blood expiry scheduler started.');

    // Startup pass — catch anything that expired overnight
    try {
        await runExpiryJob();
    } catch (err) {
        console.error('[ExpiryJob] Startup run failed:', err.message);
    }

    // Schedule daily at midnight
    function scheduleMidnightRun() {
        const delay = msUntilMidnight();
        console.log(`[ExpiryJob] Next run in ${Math.round(delay / 1000 / 60)} min (midnight).`);
        setTimeout(async () => {
            try { await runExpiryJob(); } catch (e) { console.error(e); }
            scheduleMidnightRun(); // Re-schedule for following midnight
        }, delay);
    }

    scheduleMidnightRun();
}

module.exports = { startExpiryScheduler, runExpiryJob };
