/* ═══════════════════════════════════════════
   DATABASE CONNECTION — PostgreSQL Pool
   ═══════════════════════════════════════════ */

'use strict';

const { Pool } = require('pg');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

if (!process.env.DATABASE_URL) {
    console.error('❌  DATABASE_URL is not set. Please create a .env file at the project root.');
    process.exit(1);
}

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL.includes('localhost')
        ? false
        : { rejectUnauthorized: false }   // Required for Supabase / Neon
});

pool.on('connect', () => {
    if (process.env.NODE_ENV !== 'test') {
        console.log('✅  PostgreSQL connected');
    }
});

pool.on('error', (err) => {
    console.error('❌  Unexpected database error:', err.message);
});

/**
 * Execute a SQL query.
 * @param {string} text   — parameterised query string
 * @param {Array}  params — query parameters
 * @returns {Promise<import('pg').QueryResult>}
 */
const query = (text, params) => pool.query(text, params);

/**
 * Acquire a client for manual transaction control.
 * Remember to call client.release() when done.
 */
const getClient = () => pool.connect();

module.exports = { query, getClient, pool };
