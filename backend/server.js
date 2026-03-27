/* ═══════════════════════════════════════════
   LIFEFLOW — Blood Bank Management System
   Backend Entry Point — server.js
   ═══════════════════════════════════════════ */

'use strict';

const path = require('path');
const express = require('express');
const cors = require('cors');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const initDb = require('./initDb');
const { startExpiryScheduler } = require('./expiryScheduler');
const userRoutes = require('./routes/userRoutes');
const donorRoutes = require('./routes/donorRoutes');
const inventoryRoutes = require('./routes/inventoryRoutes');
const requestRoutes = require('./routes/requestRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

/* ── Middleware ─────────────────────────────── */
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/* ── Serve frontend as static files ─────────── */
// All HTML, CSS, JS files live in the project root (one level up from /backend)
app.use(express.static(path.join(__dirname, '..')));

/* ── API Routes ─────────────────────────────── */
app.use('/api', userRoutes);          // POST /api/register
app.use('/api/donors', donorRoutes);         // GET /api/donors, POST /api/donors/donate
app.use('/api/inventory', inventoryRoutes);     // GET /api/inventory
app.use('/api/requests', requestRoutes);       // GET /api/requests, POST /api/requests, PUT /api/requests/approve

/* ── Health Check ───────────────────────────── */
app.get('/api/health', (_req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

/* ── Catch-all: serve index.html for SPA ────── */
app.get('*', (_req, res) => {
    res.sendFile(path.join(__dirname, '..', 'index.html'));
});

/* ── Global Error Handler ───────────────────── */
app.use((err, _req, res, _next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({ error: 'Internal server error.' });
});

/* ── Start ──────────────────────────────────── */
async function start() {
    try {
        await initDb();
        app.listen(PORT, () => {
            console.log(`\n🩸  LifeFlow API running on http://localhost:${PORT}`);
            console.log(`📄  Frontend: http://localhost:${PORT}`);
            console.log(`🔧  Admin demo — username: admin | password: admin123\n`);
            // Start the blood expiry auto-scheduler after server is live
            startExpiryScheduler();
        });
    } catch (err) {
        console.error('❌  Failed to start server:', err.message);
        process.exit(1);
    }
}

start();
