/* ═══════════════════════════════════════════════════
   BLOOD EXPIRY AUTO-SCHEDULER — MySQL Edition
   ═══════════════════════════════════════════════════ */

'use strict';

const { getClient } = require('./db');

async function runExpiryJob() {
    const client = await getClient();
    try {
        await client.query('BEGIN');

        // Step 1 — Find all overdue Available units
        const { rows: overdueUnits } = await client.query(`
            SELECT unit_id, blood_group,
                   DATE_FORMAT(expiry_date, '%Y-%m-%d') AS expiry_date
            FROM blood_stock
            WHERE status = 'Available'
              AND expiry_date < CURDATE()
        `);

        if (overdueUnits.length === 0) {
            await client.query('ROLLBACK');
            console.log(`[ExpiryJob ${new Date().toISOString()}] ✅ No units to expire.`);
            return { expired: 0 };
        }

        // Step 2 — Mark them all Expired (MySQL IN with a list)
        const unitIds = overdueUnits.map(u => u.unit_id);
        // mysql2 expands arrays for IN(?) placeholders
        await client.query(
            `UPDATE blood_stock SET status = 'Expired' WHERE unit_id IN (?)`,
            [unitIds]
        );

        // Step 3 — Decrement blood_banks per blood group
        const groupCounts = {};
        overdueUnits.forEach(u => {
            groupCounts[u.blood_group] = (groupCounts[u.blood_group] || 0) + 1;
        });

        for (const [bg, count] of Object.entries(groupCounts)) {
            await client.query(
                `UPDATE blood_banks
                 SET available_units = GREATEST(0, available_units - ?)
                 WHERE blood_group = ?`,
                [count, bg]
            );
        }

        // Step 4 — Write audit log
        for (const unit of overdueUnits) {
            await client.query(
                `INSERT INTO expiry_log (unit_id, blood_group, expiry_date, trigger_source)
                 VALUES (?, ?, ?, 'auto-scheduler')`,
                [unit.unit_id, unit.blood_group, unit.expiry_date]
            );
        }

        await client.query('COMMIT');

        const summary = Object.entries(groupCounts).map(([bg, n]) => `${bg}:${n}`).join(', ');
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

function msUntilMidnight() {
    const now = new Date();
    const midnight = new Date(now);
    midnight.setHours(24, 0, 2, 0);
    return midnight - now;
}

async function startExpiryScheduler() {
    console.log('⏰  Blood expiry scheduler started.');
    try { await runExpiryJob(); } catch (err) { console.error('[ExpiryJob] Startup run failed:', err.message); }

    function scheduleMidnightRun() {
        const delay = msUntilMidnight();
        console.log(`[ExpiryJob] Next run in ${Math.round(delay / 1000 / 60)} min (midnight).`);
        setTimeout(async () => {
            try { await runExpiryJob(); } catch (e) { console.error(e); }
            scheduleMidnightRun();
        }, delay);
    }
    scheduleMidnightRun();
}

module.exports = { startExpiryScheduler, runExpiryJob };
