/* ═══════════════════════════════════════════
   DATABASE CONNECTION — MySQL2 Pool
   ═══════════════════════════════════════════ */

'use strict';

const mysql = require('mysql2/promise');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const requiredVars = ['DB_HOST', 'DB_USER', 'DB_NAME'];
const missing = requiredVars.filter(v => !process.env[v]);
if (missing.length) {
    console.error(`❌  Missing environment variables: ${missing.join(', ')}`);
    console.error('    Please create a .env file — see .env.example for reference.');
    process.exit(1);
}

const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306', 10),
    user: process.env.DB_USER,
    password: process.env.DB_PASS || '',
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    timezone: '+00:00',            // Always store UTC
    dateStrings: true,                // Return DATE columns as 'YYYY-MM-DD' strings (no JS Date object)
});

// Verify connection on startup
pool.getConnection()
    .then(conn => {
        console.log('✅  MySQL connected');
        conn.release();
    })
    .catch(err => {
        console.error('❌  MySQL connection failed:', err.message);
        process.exit(1);
    });

/**
 * Execute a SQL query.
 * mysql2 returns [rows, fields] — we wrap to a pg-compatible { rows } shape
 * so the rest of the codebase needs zero changes to callers.
 */
async function query(sql, params) {
    const [rows] = await pool.query(sql, params);
    return { rows: Array.isArray(rows) ? rows : [rows] };
}

/**
 * Acquire a connection for manual transaction control.
 * Returns an object with .query(), .release(), matching the pg client API.
 */
async function getClient() {
    const conn = await pool.getConnection();
    return {
        query: async (sql, params) => {
            const [rows] = await conn.query(sql, params);
            // For DML (UPDATE/INSERT/DELETE) mysql2 returns an OkPacket — wrap sensibly
            if (Array.isArray(rows)) {
                return { rows, rowCount: rows.length };
            }
            // OkPacket
            return { rows: [], rowCount: rows.affectedRows, insertId: rows.insertId };
        },
        release: () => conn.release()
    };
}

module.exports = { query, getClient, pool };
