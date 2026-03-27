/* ═══════════════════════════════════════════
   LIFEFLOW — Blood Bank Management System
   Full-Stack JavaScript — REST API Edition
   ═══════════════════════════════════════════ */

'use strict';

/* ────────────────────────────────────────────
   API CONFIGURATION
   ──────────────────────────────────────────── */

// When served via backend (http://localhost:3000), same origin. Works for both local + cloud.
const API = window.location.port === '5500' || window.location.protocol === 'file:'
    ? 'http://localhost:3000/api'   // VSCode Live Server / file:// dev mode
    : '/api';                        // Served by Express (production / npm start)

/* ────────────────────────────────────────────
   GENERIC FETCH HELPER
   ──────────────────────────────────────────── */

async function apiFetch(endpoint, options = {}) {
    const res = await fetch(`${API}${endpoint}`, {
        headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
        ...options,
        body: options.body ? JSON.stringify(options.body) : undefined
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
    return data;
}

/* ────────────────────────────────────────────
   TOAST NOTIFICATION SYSTEM
   ──────────────────────────────────────────── */

const Toast = {
    container: null,
    icons: {
        success: `<svg class="toast-icon" viewBox="0 0 24 24" fill="none"><path d="M22 11.08V12a10 10 0 11-5.93-9.14" stroke="#22C55E" stroke-width="2" stroke-linecap="round"/><polyline points="22,4 12,14.01 9,11.01" stroke="#22C55E" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
        error: `<svg class="toast-icon" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="#EF4444" stroke-width="2"/><line x1="15" y1="9" x2="9" y2="15" stroke="#EF4444" stroke-width="2" stroke-linecap="round"/><line x1="9" y1="9" x2="15" y2="15" stroke="#EF4444" stroke-width="2" stroke-linecap="round"/></svg>`,
        warning: `<svg class="toast-icon" viewBox="0 0 24 24" fill="none"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" stroke="#F59E0B" stroke-width="2"/><line x1="12" y1="9" x2="12" y2="13" stroke="#F59E0B" stroke-width="2" stroke-linecap="round"/><line x1="12" y1="17" x2="12.01" y2="17" stroke="#F59E0B" stroke-width="2" stroke-linecap="round"/></svg>`,
        info: `<svg class="toast-icon" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="#818CF8" stroke-width="2"/><line x1="12" y1="8" x2="12" y2="12" stroke="#818CF8" stroke-width="2" stroke-linecap="round"/><line x1="12" y1="16" x2="12.01" y2="16" stroke="#818CF8" stroke-width="2" stroke-linecap="round"/></svg>`,
    },
    show(message, type = 'success', duration = 4000) {
        if (!this.container) this.container = document.getElementById('toastContainer');
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.innerHTML = `
      ${this.icons[type] || this.icons.info}
      <span class="toast-message">${message}</span>
      <button class="toast-close" onclick="this.parentElement.remove()">×</button>
    `;
        this.container.appendChild(toast);
        const remove = () => {
            toast.classList.add('leaving');
            toast.addEventListener('animationend', () => toast.remove());
        };
        setTimeout(remove, duration);
    }
};

/* ────────────────────────────────────────────
   ANIMATED COUNTER
   ──────────────────────────────────────────── */

function animateCounter(el, target, duration = 2000) {
    let start = 0;
    const step = target / (duration / 16);
    const timer = setInterval(() => {
        start += step;
        if (start >= target) { el.textContent = target.toLocaleString('en-IN'); clearInterval(timer); }
        else el.textContent = Math.floor(start).toLocaleString('en-IN');
    }, 16);
}

/* ────────────────────────────────────────────
   BLOOD INVENTORY RENDER (from API)
   ──────────────────────────────────────────── */

function getStatus(units) {
    if (units >= 30) return { label: 'Available', cls: 'status-good' };
    if (units >= 10) return { label: 'Low Stock', cls: 'status-low' };
    return { label: 'Critical', cls: 'status-critical' };
}

async function renderInventory() {
    const grid = document.getElementById('bloodInventoryGrid');
    if (!grid) return;

    try {
        const { inventory } = await apiFetch('/inventory');
        const groups = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
        grid.innerHTML = groups.map(bg => {
            const units = inventory[bg] ?? 0;
            const s = getStatus(units);
            return `
        <div class="blood-card reveal">
          <div class="blood-group-label">${bg}</div>
          <div class="blood-units">${units} <span>units</span></div>
          <div class="blood-status ${s.cls}">${s.label}</div>
        </div>`;
        }).join('');
        setTimeout(initReveal, 50);

        // Update total units stat counter value
        const total = Object.values(inventory).reduce((a, b) => a + b, 0);
        const unitsStatEl = document.querySelector('.stat-number[data-target="5200"]');
        if (unitsStatEl) unitsStatEl.dataset.target = total;

        return inventory;

    } catch (err) {
        grid.innerHTML = `<div style="color:var(--crimson);text-align:center;padding:2rem;grid-column:1/-1">
            ⚠️ Could not load inventory — make sure the backend server is running.<br>
            <small>${err.message}</small>
        </div>`;
    }
}

/* ────────────────────────────────────────────
   FORM VALIDATION HELPERS
   ──────────────────────────────────────────── */

function setError(inputId, errId, message) {
    const input = document.getElementById(inputId);
    const err = document.getElementById(errId);
    if (input) input.classList.toggle('error', !!message);
    if (err) err.textContent = message || '';
}

function clearErrors(pairs) {
    pairs.forEach(([inputId, errId]) => setError(inputId, errId, ''));
}

function validatePhone(phone) { return /^\d{10}$/.test(phone); }
function validateEmail(email) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email); }

/* ────────────────────────────────────────────
   DONOR REGISTRATION FORM
   POST /api/register  (creates user + donor + optional donation)
   ──────────────────────────────────────────── */

document.getElementById('donorForm')?.addEventListener('submit', async function (e) {
    e.preventDefault();

    const fields = [
        ['donorName', 'donorNameError'], ['donorBlood', 'donorBloodError'],
        ['donorPhone', 'donorPhoneError'], ['donorCity', 'donorCityError'],
        ['donorConsent', 'donorConsentError'], ['donorUnits', 'donorUnitsError']
    ];
    clearErrors(fields);

    const name = document.getElementById('donorName').value.trim();
    const blood = document.getElementById('donorBlood').value;
    const phone = document.getElementById('donorPhone').value.trim();
    const email = document.getElementById('donorEmail')?.value.trim() || '';
    const city = document.getElementById('donorCity').value.trim();
    const consent = document.getElementById('donorConsent').checked;
    const units = parseInt(document.getElementById('donorUnits')?.value || '1', 10);

    let valid = true;
    if (!name) { setError('donorName', 'donorNameError', 'Full name is required.'); valid = false; }
    if (!blood) { setError('donorBlood', 'donorBloodError', 'Please select a blood group.'); valid = false; }
    if (!validatePhone(phone)) { setError('donorPhone', 'donorPhoneError', 'Enter a valid 10-digit phone.'); valid = false; }
    if (email && !validateEmail(email)) { setError('donorEmail', 'donorEmailError', 'Enter a valid email address.'); valid = false; }
    if (!city) { setError('donorCity', 'donorCityError', 'City is required.'); valid = false; }
    if (!consent) { setError('donorConsent', 'donorConsentError', 'Consent is required to register.'); valid = false; }
    if (!units || units < 1) { setError('donorUnits', 'donorUnitsError', 'Enter at least 1 unit to donate.'); valid = false; }

    if (!valid) return;

    // Need email — generate a placeholder if not provided
    const emailVal = email || `${phone}@lifeflow.local`;

    const submitBtn = this.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Registering…';

    try {
        const data = await apiFetch('/register', {
            method: 'POST',
            body: { full_name: name, email: emailVal, phone_number: phone, blood_group: blood, location: city, units_donated: units }
        });

        Toast.show(`🎉 Welcome, ${name}! Registered as donor. ${units} unit(s) added to inventory.`, 'success');
        this.reset();
        await renderInventory();
        await renderDonorDirectory('ALL');
        if (document.getElementById('adminDashboard')?.style.display !== 'none') {
            await refreshAdminDashboard();
        }
    } catch (err) {
        if (err.message.includes('already registered')) {
            setError('donorEmail', 'donorEmailError', err.message);
            Toast.show(err.message, 'error');
        } else {
            Toast.show(`Registration failed: ${err.message}`, 'error');
        }
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none"><path d="M5 13l4 4L19 7" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg> Register as Donor`;
    }
});

/* ────────────────────────────────────────────
   BLOOD REQUEST FORM
   POST /api/requests
   ──────────────────────────────────────────── */

document.getElementById('requestForm')?.addEventListener('submit', async function (e) {
    e.preventDefault();

    const fields = [
        ['reqPatient', 'reqPatientError'], ['reqBlood', 'reqBloodError'],
        ['reqUnits', 'reqUnitsError'], ['reqUrgency', 'reqUrgencyError'],
        ['reqHospital', 'reqHospitalError'], ['reqPhone', 'reqPhoneError'], ['reqCity', 'reqCityError']
    ];
    clearErrors(fields);

    const patient = document.getElementById('reqPatient').value.trim();
    const blood = document.getElementById('reqBlood').value;
    const units = parseInt(document.getElementById('reqUnits').value, 10);
    const urgency = document.getElementById('reqUrgency').value;
    const hospital = document.getElementById('reqHospital').value.trim();
    const phone = document.getElementById('reqPhone').value.trim();
    const city = document.getElementById('reqCity').value.trim();

    let valid = true;
    if (!patient) { setError('reqPatient', 'reqPatientError', 'Patient name is required.'); valid = false; }
    if (!blood) { setError('reqBlood', 'reqBloodError', 'Blood group is required.'); valid = false; }
    if (!units || units < 1) { setError('reqUnits', 'reqUnitsError', 'Enter number of units needed.'); valid = false; }
    if (!urgency) { setError('reqUrgency', 'reqUrgencyError', 'Please select urgency level.'); valid = false; }
    if (!hospital) { setError('reqHospital', 'reqHospitalError', 'Hospital name is required.'); valid = false; }
    if (!validatePhone(phone)) { setError('reqPhone', 'reqPhoneError', 'Enter a valid 10-digit phone.'); valid = false; }
    if (!city) { setError('reqCity', 'reqCityError', 'City is required.'); valid = false; }

    if (!valid) return;

    const submitBtn = this.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Submitting…';

    try {
        await apiFetch('/requests', {
            method: 'POST',
            body: { blood_group: blood, location: city, units_required: units, urgency_level: urgency }
        });

        const urgencyMessages = {
            Critical: '🚨 Critical request submitted! Our team will respond within the hour.',
            Urgent: '⚡ Urgent request submitted! We\'ll contact you soon.',
            Normal: '✅ Request submitted successfully! We\'ll arrange blood within 3 days.'
        };
        Toast.show(urgencyMessages[urgency] || 'Blood request submitted!', 'success');
        this.reset();
        if (document.getElementById('adminDashboard')?.style.display !== 'none') {
            await refreshAdminDashboard();
        }
    } catch (err) {
        Toast.show(`Request failed: ${err.message}`, 'error');
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg> Submit Blood Request`;
    }
});

/* ────────────────────────────────────────────
   BLOOD COMPATIBILITY CHECKER
   ──────────────────────────────────────────── */

const COMPAT = {
    'A+': { donate: ['A+', 'AB+'], receive: ['A+', 'A-', 'O+', 'O-'] },
    'A-': { donate: ['A+', 'A-', 'AB+', 'AB-'], receive: ['A-', 'O-'] },
    'B+': { donate: ['B+', 'AB+'], receive: ['B+', 'B-', 'O+', 'O-'] },
    'B-': { donate: ['B+', 'B-', 'AB+', 'AB-'], receive: ['B-', 'O-'] },
    'AB+': { donate: ['AB+'], receive: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'] },
    'AB-': { donate: ['AB+', 'AB-'], receive: ['A-', 'B-', 'AB-', 'O-'] },
    'O+': { donate: ['A+', 'B+', 'O+', 'AB+'], receive: ['O+', 'O-'] },
    'O-': { donate: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'], receive: ['O-'] },
};

const FUNFACTS = {
    'O-': 'O− is the universal donor! Your blood can be given to anyone.',
    'AB+': 'AB+ is the universal recipient — you can receive blood from all types!',
    'AB-': 'AB− donors are rare but can donate plasma to all blood types.',
    'O+': 'O+ is the most common blood type — about 37% of people have it.',
    'A+': 'A+ is the second most common blood type, found in ~36% of people.',
    'A-': 'A− donors are valuable — your blood can help A− and O− patients.',
    'B+': 'B+ donors help about 9% of the population who share this type.',
    'B-': 'B− is rare — only ~2% of people have it. Your donation is precious!',
};

document.getElementById('bloodTypeButtons')?.addEventListener('click', function (e) {
    const btn = e.target.closest('.blood-btn');
    if (!btn) return;
    document.querySelectorAll('.blood-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const bg = btn.dataset.group;
    const c = COMPAT[bg];
    const results = document.getElementById('compatResults');
    results.innerHTML = `
    <div class="compat-info-grid">
      <div class="compat-box">
        <h4 class="donate">
          <svg viewBox="0 0 24 24" fill="none" width="16" height="16"><path d="M12 5v14M5 12h14" stroke="#22C55E" stroke-width="2.5" stroke-linecap="round"/></svg>
          You Can Donate To
        </h4>
        <div class="compat-types">${c.donate.map(t => `<span class="compat-tag donate">${t}</span>`).join('')}</div>
      </div>
      <div class="compat-box">
        <h4 class="receive">
          <svg viewBox="0 0 24 24" fill="none" width="16" height="16"><path d="M19 12H5M12 5l-7 7 7 7" stroke="#FF6B6B" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
          You Can Receive From
        </h4>
        <div class="compat-types">${c.receive.map(t => `<span class="compat-tag receive">${t}</span>`).join('')}</div>
      </div>
    </div>
    <div class="compat-funfact">💡 ${FUNFACTS[bg] || ''}</div>
  `;
});

/* ────────────────────────────────────────────
   DONOR DIRECTORY & MAP VIEW (from API)
   ──────────────────────────────────────────── */

const CITY_COORDS = {
    'delhi': [28.7041, 77.1025],
    'new delhi': [28.6139, 77.2090],
    'mumbai': [19.0760, 72.8777],
    'bangalore': [12.9716, 77.5946],
    'bengaluru': [12.9716, 77.5946],
    'chennai': [13.0827, 80.2707],
    'kolkata': [22.5726, 88.3639],
    'hyderabad': [17.3850, 78.4867],
    'pune': [18.5204, 73.8567],
    'ahmedabad': [23.0225, 72.5714],
    'jaipur': [26.9124, 75.7873]
};

let _allDonors = [];
let donorMap = null;
let markerGroup = null;

function initDonorMap() {
    if (donorMap) return;
    const mapContainer = document.getElementById('donorMap');
    if (!mapContainer || typeof L === 'undefined') return;

    // Default center to India
    donorMap = L.map('donorMap').setView([20.5937, 78.9629], 5);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors'
    }).addTo(donorMap);

    // Modern dark tile overlay via CSS filter if desired, or standard tiles
    document.querySelector('.leaflet-tile-pane').style.filter = 'brightness(0.6) invert(1) contrast(3) hue-rotate(200deg) saturate(0.3) brightness(0.7)';

    markerGroup = L.layerGroup().addTo(donorMap);
}

document.querySelectorAll('.view-toggle-btn').forEach(btn => {
    btn.addEventListener('click', function () {
        document.querySelectorAll('.view-toggle-btn').forEach(b => b.classList.remove('active'));
        this.classList.add('active');

        const view = this.dataset.view;
        const listDiv = document.getElementById('donorList');
        const mapDiv = document.getElementById('donorMapWrapper');

        if (view === 'map') {
            listDiv.style.display = 'none';
            mapDiv.style.display = 'block';
            if (!donorMap) initDonorMap();
            setTimeout(() => { donorMap.invalidateSize(); renderMapMarkers(document.querySelector('.filter-btn.active').dataset.filter); }, 100);
        } else {
            listDiv.style.display = 'grid'; // .donor-list is grid from CSS
            mapDiv.style.display = 'none';
        }
    });
});

function renderMapMarkers(filter) {
    if (!markerGroup) return;
    markerGroup.clearLayers();

    const donors = filter === 'ALL' ? _allDonors : _allDonors.filter(d => d.blood_group === filter);

    // Group donors by city to slightly offset markers if they share same exact coordinate
    const cityCounts = {};

    donors.forEach(d => {
        const cityKey = (d.location || '').trim().toLowerCase();
        let coords = CITY_COORDS[cityKey];

        if (!coords) {
            // Unmapped city: scatter somewhat in central India
            const hash = cityKey.split('').reduce((a, b) => { a = ((a << 5) - a) + b.charCodeAt(0); return a & a }, 0);
            coords = [22 + (hash % 5), 79 + ((hash >> 3) % 5)];
        }

        cityCounts[cityKey] = (cityCounts[cityKey] || 0) + 1;
        // Jitter to prevent overlapping
        const latOffset = (Math.random() - 0.5) * 0.05 * cityCounts[cityKey];
        const lngOffset = (Math.random() - 0.5) * 0.05 * cityCounts[cityKey];

        const popupCtx = `
            <div class="donor-popup">
                <h4>${escapeHtml(d.full_name)}</h4>
                <p><span class="blood-badge">${d.blood_group}</span></p>
                <p>📍 ${escapeHtml(d.location)}</p>
                <p>📞 ${escapeHtml(d.phone_number)}</p>
                <p style="margin-top: 6px;">${d.availability ? '<span style="color:#22C55E">✅ Available</span>' : '<span style="color:#EF4444">❌ Unavailable</span>'}</p>
            </div>
        `;

        L.marker([coords[0] + latOffset, coords[1] + lngOffset])
            .addTo(markerGroup)
            .bindPopup(popupCtx);
    });

    if (donors.length > 0) {
        // Fit bounds to markers
        const group = new L.featureGroup(markerGroup.getLayers());
        if (Object.keys(group._layers).length > 0) donorMap.fitBounds(group.getBounds(), { padding: [50, 50], maxZoom: 10 });
    } else {
        donorMap.setView([20.5937, 78.9629], 5);
    }
}

async function renderDonorDirectory(filter = 'ALL') {
    const list = document.getElementById('donorList');
    if (!list) return;

    try {
        if (_allDonors.length === 0) {
            const { donors } = await apiFetch('/donors');
            _allDonors = donors;
        }
        const donors = filter === 'ALL' ? _allDonors : _allDonors.filter(d => d.blood_group === filter);

        if (donors.length === 0) {
            list.innerHTML = `
      <div class="no-donors">
        <svg viewBox="0 0 24 24" fill="none"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" stroke="currentColor" stroke-width="2"/><circle cx="9" cy="7" r="4" stroke="currentColor" stroke-width="2"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
        <p>No donors found${filter !== 'ALL' ? ` for blood group ${filter}` : ''}.</p>
        <p style="font-size:0.85rem">Be the first to register!</p>
      </div>`;
            return;
        }

        list.innerHTML = donors.map((d, i) => {
            const initials = d.full_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
            return `
      <div class="donor-card" style="animation-delay:${i * 0.06}s">
        <div class="donor-card-header">
          <div class="donor-avatar">${initials}</div>
          <div>
            <h4>${escapeHtml(d.full_name)}</h4>
            <div class="blood-badge">${d.blood_group}</div>
          </div>
        </div>
        <div class="donor-card-meta">
          <div class="donor-meta-item">📍 ${escapeHtml(d.location)}</div>
          <div class="donor-meta-item">🩸 Donated: ${d.total_units_donated} units</div>
          ${d.availability ? '<div class="donor-meta-item" style="color:#22C55E">✅ Available</div>' : '<div class="donor-meta-item" style="color:#EF4444">❌ Unavailable</div>'}
        </div>
      </div>`;
        }).join('');

        if (donorMap && document.getElementById('donorMapWrapper').style.display === 'block') {
            renderMapMarkers(filter);
        }

    } catch (err) {
        list.innerHTML = `<div style="color:var(--crimson);text-align:center;padding:2rem">⚠️ Could not load donors — ${err.message}</div>`;
    }
}

// Filter buttons
document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', async function () {
        document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
        this.classList.add('active');
        _allDonors = []; // Force refresh from API
        await renderDonorDirectory(this.dataset.filter);
        if (donorMap && document.getElementById('donorMapWrapper').style.display === 'block') {
            renderMapMarkers(this.dataset.filter);
        }
    });
});

/* ────────────────────────────────────────────
   ADMIN DASHBOARD
   ──────────────────────────────────────────── */

const ADMIN_CREDS = { user: 'admin', pass: 'admin123' };

document.getElementById('adminLoginForm')?.addEventListener('submit', async function (e) {
    e.preventDefault();
    const user = document.getElementById('adminUser').value.trim();
    const pass = document.getElementById('adminPass').value;
    const err = document.getElementById('adminError');
    if (user === ADMIN_CREDS.user && pass === ADMIN_CREDS.pass) {
        err.textContent = '';
        document.getElementById('adminLoginCard').style.display = 'none';
        document.getElementById('adminDashboard').style.display = 'block';
        await refreshAdminDashboard();
        Toast.show('Welcome back, Administrator!', 'success');
    } else {
        err.textContent = 'Invalid credentials. Try admin / admin123.';
        document.getElementById('adminPass').value = '';
    }
});

document.getElementById('adminLogout')?.addEventListener('click', function () {
    document.getElementById('adminDashboard').style.display = 'none';
    document.getElementById('adminLoginCard').style.display = 'block';
    document.getElementById('adminUser').value = '';
    document.getElementById('adminPass').value = '';
    Toast.show('Logged out successfully.', 'info');
});

// Tabs
document.querySelector('.dash-tabs')?.addEventListener('click', function (e) {
    const btn = e.target.closest('.tab-btn');
    if (!btn) return;
    const tab = btn.dataset.tab;
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('tabDonors').style.display = tab === 'donors' ? 'block' : 'none';
    document.getElementById('tabRequests').style.display = tab === 'requests' ? 'block' : 'none';
    document.getElementById('tabInventory').style.display = tab === 'inventory' ? 'block' : 'none';
    document.getElementById('tabExpiry').style.display = tab === 'expiry' ? 'block' : 'none';
});

async function refreshAdminDashboard() {
    await Promise.all([updateAdminStats(), renderAdminDonors(), renderAdminRequests(), renderAdminInventory(), renderExpirySoon(), renderExpiryLog()]);
}

async function updateAdminStats() {
    try {
        const [{ donors }, { requests }, { inventory }] = await Promise.all([
            apiFetch('/donors'),
            apiFetch('/requests'),
            apiFetch('/inventory')
        ]);
        const total = Object.values(inventory).reduce((a, b) => a + b, 0);
        const pending = requests.filter(r => r.status === 'Pending').length;
        document.getElementById('dashTotalDonors').textContent = donors.length;
        document.getElementById('dashPendingRequests').textContent = pending;
        document.getElementById('dashTotalUnits').textContent = total;
    } catch (err) {
        console.error('updateAdminStats:', err);
    }
}

async function renderAdminDonors() {
    const tbody = document.getElementById('adminDonorsTbody');
    if (!tbody) return;
    try {
        const { donors } = await apiFetch('/donors');
        if (donors.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--text-muted);padding:32px">No donors registered yet.</td></tr>';
            return;
        }
        tbody.innerHTML = donors.map((d, i) => `
    <tr>
      <td>${i + 1}</td>
      <td>${escapeHtml(d.full_name)}</td>
      <td><span class="blood-badge">${d.blood_group}</span></td>
      <td>${escapeHtml(d.phone_number)}</td>
      <td>${escapeHtml(d.location)}</td>
      <td>${d.total_units_donated} units</td>
    </tr>`).join('');
    } catch (err) {
        tbody.innerHTML = `<tr><td colspan="6" style="color:var(--crimson);text-align:center">Error loading donors.</td></tr>`;
    }
}

async function renderAdminRequests() {
    const tbody = document.getElementById('adminRequestsTbody');
    if (!tbody) return;
    try {
        const { requests } = await apiFetch('/requests');
        if (requests.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;color:var(--text-muted);padding:32px">No blood requests yet.</td></tr>';
            return;
        }
        tbody.innerHTML = requests.map((r, i) => `
    <tr>
      <td>${i + 1}</td>
      <td>${escapeHtml(r.requester_name || 'Unknown')}</td>
      <td><span class="blood-badge">${r.blood_group}</span></td>
      <td>${r.units_required}</td>
      <td><span class="urgency-badge urgency-${r.urgency_level}">${r.urgency_level}</span></td>
      <td>${escapeHtml(r.location)}</td>
      <td><span class="status-badge status-${r.status}">${r.status}</span></td>
      <td>
        ${r.status === 'Pending'
                ? `<button class="btn btn-sm" style="background:rgba(34,197,94,0.15);color:#22C55E;border:1px solid rgba(34,197,94,0.3)" onclick="approveRequest(${r.request_id})">Approve</button>`
                : '<span style="color:var(--text-muted);font-size:0.8rem">Done</span>'}
      </td>
    </tr>`).join('');
    } catch (err) {
        tbody.innerHTML = `<tr><td colspan="8" style="color:var(--crimson);text-align:center">Error loading requests.</td></tr>`;
    }
}

window.approveRequest = async function (request_id) {
    if (!confirm('Approve this request and deduct units from inventory?')) return;
    try {
        const data = await apiFetch('/requests/approve', { method: 'PUT', body: { request_id } });
        Toast.show(`✅ ${data.message}`, 'success');
        await renderInventory();
        await refreshAdminDashboard();
    } catch (err) {
        Toast.show(`❌ ${err.message}`, 'error');
    }
};

async function renderAdminInventory() {
    const editor = document.getElementById('inventoryEditor');
    const stockTbody = document.getElementById('adminStockTbody');
    if (!editor || !stockTbody) return;
    try {
        const { inventory } = await apiFetch('/inventory');
        const groups = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
        editor.innerHTML = groups.map(bg => `
    <div class="inv-item">
      <div class="inv-group">${bg}</div>
      <div class="inv-count" id="invCount_${bg.replace('+', 'p').replace('-', 'm')}">${inventory[bg] ?? 0} units</div>
      <div style="color:var(--text-muted);font-size:0.8rem;margin-top:4px">Managed via donations &amp; approvals</div>
    </div>`).join('');

        // Fetch detailed stock from backend
        const { stock } = await apiFetch('/inventory/stock');
        if (!stock || stock.length === 0) {
            stockTbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--text-muted);padding:32px">No detailed stock available.</td></tr>';
            return;
        }

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        stockTbody.innerHTML = stock.map(s => {
            const expDate = new Date(s.expiry_date);
            const isExpired = expDate < today;
            let statusBadge = `<span class="status-badge" style="background:rgba(34,197,94,0.15);color:#22C55E">Available</span>`;
            let trStyle = ``;
            if (s.status === 'Expired' || isExpired) {
                statusBadge = `<span class="status-badge" style="background:rgba(239,68,68,0.15);color:#EF4444">Expired</span>`;
                trStyle = `background: rgba(239, 68, 68, 0.05);`;
            } else if (s.status === 'Used') {
                statusBadge = `<span class="status-badge status-Completed">Used</span>`;
            }

            return `
            <tr style="${trStyle}">
              <td>#${s.unit_id}</td>
              <td><span class="blood-badge">${s.blood_group}</span></td>
              <td>${s.donation_date}</td>
              <td style="${isExpired ? 'color:var(--crimson);font-weight:bold;' : ''}">${s.expiry_date}</td>
              <td>${statusBadge}</td>
              <td>
                ${(s.status === 'Available' && isExpired)
                    ? `<button class="btn btn-sm" style="background:none; border:1px solid var(--crimson); color:var(--crimson);" onclick="removeBloodUnit(${s.unit_id})">Remove</button>`
                    : '<span style="color:var(--text-muted);font-size:0.8rem">-</span>'}
              </td>
            </tr>`;
        }).join('');

    } catch (err) {
        editor.innerHTML = `<div style="color:var(--crimson)">Error loading inventory.</div>`;
    }
}

window.removeBloodUnit = async function (unit_id) {
    if (!confirm('Remove this expired blood unit from stock?')) return;
    try {
        const data = await apiFetch(`/inventory/stock/${unit_id}`, { method: 'DELETE' });
        Toast.show(`✅ ${data.message}`, 'success');
        // Refresh everything
        await renderInventory();
        await refreshAdminDashboard();
    } catch (err) {
        Toast.show(`❌ ${err.message}`, 'error');
    }
};

/* ────────────────────────────────────────────
   EXPIRY ALERTS — Expiring Soon + Audit Log
   ──────────────────────────────────────────── */

async function renderExpirySoon() {
    const tbody = document.getElementById('expiringSoonTbody');
    const badge = document.getElementById('expiryAlertBadge');
    const banner = document.getElementById('expiringSoonBanner');
    const countEl = document.getElementById('expiringSoonCount');
    if (!tbody) return;
    try {
        const { expiring_soon } = await apiFetch('/inventory/expiring-soon?days=3');
        if (!expiring_soon || expiring_soon.length === 0) {
            tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:var(--text-muted);padding:24px">✅ No units expiring within 3 days.</td></tr>`;
            if (badge) badge.style.display = 'none';
            if (banner) banner.style.display = 'none';
            return;
        }
        // Red badge on the Expiry Alerts tab button
        if (badge) { badge.textContent = expiring_soon.length; badge.style.display = 'flex'; }
        if (banner) { banner.style.display = 'block'; }
        if (countEl) countEl.textContent = `${expiring_soon.length} unit(s) need urgent attention!`;

        tbody.innerHTML = expiring_soon.map(u => {
            const days = parseInt(u.days_left, 10);
            const dayColor = days === 0 ? '#EF4444' : days === 1 ? '#F59E0B' : '#F0C060';
            const dayLabel = days === 0 ? '🔴 TODAY' : days === 1 ? '🟠 Tomorrow' : `🟡 ${days} days`;
            return `<tr>
              <td>#${u.unit_id}</td>
              <td><span class="blood-badge">${u.blood_group}</span></td>
              <td>${u.donation_date}</td>
              <td style="color:${dayColor};font-weight:bold">${u.expiry_date}</td>
              <td style="color:${dayColor};font-weight:bold">${dayLabel}</td>
            </tr>`;
        }).join('');
    } catch (err) {
        if (tbody) tbody.innerHTML = `<tr><td colspan="5" style="color:var(--crimson)">Error: ${err.message}</td></tr>`;
    }
}

async function renderExpiryLog() {
    const tbody = document.getElementById('expiryLogTbody');
    if (!tbody) return;
    try {
        const { log } = await apiFetch('/inventory/expiry-log');
        if (!log || log.length === 0) {
            tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;color:var(--text-muted);padding:24px">No auto-removal events yet. The scheduler will populate this log when units expire.</td></tr>`;
            return;
        }
        tbody.innerHTML = log.map(l => `
          <tr>
            <td>${l.log_id}</td>
            <td>#${l.unit_id}</td>
            <td><span class="blood-badge">${l.blood_group}</span></td>
            <td style="color:var(--crimson)">${l.expiry_date}</td>
            <td style="color:var(--text-muted);font-size:0.82rem">${l.auto_expired_at}</td>
            <td><span style="font-size:0.78rem;padding:2px 8px;background:rgba(192,3,44,0.1);border-radius:4px;color:var(--accent)">${l.trigger_source}</span></td>
          </tr>`).join('');
    } catch (err) {
        tbody.innerHTML = `<tr><td colspan="6" style="color:var(--crimson)">Error loading log: ${err.message}</td></tr>`;
    }
}



/* ────────────────────────────────────────────
   NAVBAR
   ──────────────────────────────────────────── */

window.addEventListener('scroll', () => {
    const navbar = document.getElementById('navbar');
    navbar?.classList.toggle('scrolled', window.scrollY > 40);

    const sections = document.querySelectorAll('section[id]');
    let current = '';
    sections.forEach(s => { if (window.scrollY >= s.offsetTop - 120) current = s.id; });
    document.querySelectorAll('.nav-link').forEach(l => {
        l.classList.toggle('active', l.getAttribute('href') === `#${current}`);
    });
    document.getElementById('scrollTopBtn')?.classList.toggle('visible', window.scrollY > 400);
});

document.getElementById('hamburger')?.addEventListener('click', function () {
    this.classList.toggle('open');
    document.getElementById('navLinks')?.classList.toggle('open');
});

document.getElementById('navLinks')?.addEventListener('click', e => {
    if (e.target.classList.contains('nav-link')) {
        document.getElementById('hamburger')?.classList.remove('open');
        document.getElementById('navLinks')?.classList.remove('open');
    }
});

document.getElementById('scrollTopBtn')?.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
});

window.smoothScroll = function (id) {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
};

/* ────────────────────────────────────────────
   DARK / LIGHT MODE
   ──────────────────────────────────────────── */

function setTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('lf_theme', theme);
}

document.getElementById('themeToggle')?.addEventListener('click', function () {
    const curr = document.documentElement.getAttribute('data-theme');
    setTheme(curr === 'dark' ? 'light' : 'dark');
});

const savedTheme = localStorage.getItem('lf_theme') || 'dark';
setTheme(savedTheme);

/* ────────────────────────────────────────────
   REVEAL ON SCROLL
   ──────────────────────────────────────────── */

function initReveal() {
    const els = document.querySelectorAll('.reveal:not(.visible)');
    if (!els.length) return;
    const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry, i) => {
            if (entry.isIntersecting) {
                setTimeout(() => entry.target.classList.add('visible'), i * 80);
                observer.unobserve(entry.target);
            }
        });
    }, { threshold: 0.1 });
    els.forEach(el => observer.observe(el));
}

/* ────────────────────────────────────────────
   ANIMATED STAT COUNTERS
   ──────────────────────────────────────────── */

function initCounters() {
    const counterEls = document.querySelectorAll('.stat-number[data-target]');
    const observer = new IntersectionObserver(entries => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const el = entry.target;
                const target = parseInt(el.dataset.target);
                animateCounter(el, target);
                observer.unobserve(el);
            }
        });
    }, { threshold: 0.3 });
    counterEls.forEach(el => observer.observe(el));
}

/* ────────────────────────────────────────────
   HERO PARTICLES
   ──────────────────────────────────────────── */

function createParticles() {
    const container = document.getElementById('heroParticles');
    if (!container) return;
    for (let i = 0; i < 22; i++) {
        const p = document.createElement('div');
        p.className = 'particle';
        p.style.left = `${Math.random() * 100}%`;
        p.style.width = p.style.height = `${Math.random() * 4 + 2}px`;
        p.style.animationDuration = `${Math.random() * 12 + 8}s`;
        p.style.animationDelay = `${Math.random() * 8}s`;
        p.style.background = Math.random() > 0.5 ? 'var(--crimson)' : 'var(--accent)';
        container.appendChild(p);
    }
}

/* ────────────────────────────────────────────
   UTILITY
   ──────────────────────────────────────────── */

function escapeHtml(str) {
    const d = document.createElement('div');
    d.textContent = str || '';
    return d.innerHTML;
}

/* ────────────────────────────────────────────
   INIT
   ──────────────────────────────────────────── */

document.addEventListener('DOMContentLoaded', async () => {
    createParticles();
    initReveal();
    initCounters();

    // Load live data from API
    await renderInventory();
    await renderDonorDirectory('ALL');

    // Re-init reveal after dynamic renders settle
    setTimeout(initReveal, 300);

    console.log('%c LifeFlow Blood Bank System (Full-Stack) ', 'background:#C0032C;color:white;font-size:14px;padding:4px 8px;border-radius:4px;');
    console.log('%c API Base:', 'color:#FF6B6B', API);
    console.log('%c Admin login → username: admin | password: admin123', 'color:#FF6B6B');
});
