/* ═══════════════════════════════════════════
   LIFEFLOW — Blood Bank Management System
   Main JavaScript — All Interactive Logic
   ═══════════════════════════════════════════ */

'use strict';

/* ────────────────────────────────────────────
   DATA MANAGERS (LocalStorage persistence)
   ──────────────────────────────────────────── */

const DonorManager = {
    KEY: 'lf_donors',
    getAll() {
        try { return JSON.parse(localStorage.getItem(this.KEY)) || []; }
        catch { return []; }
    },
    add(donor) {
        const donors = this.getAll();
        donor.id = Date.now();
        donor.date = new Date().toLocaleDateString('en-IN');
        donors.push(donor);
        localStorage.setItem(this.KEY, JSON.stringify(donors));
        return donor;
    },
    remove(id) {
        const donors = this.getAll().filter(d => d.id !== id);
        localStorage.setItem(this.KEY, JSON.stringify(donors));
    },
    getByBloodGroup(bg) {
        if (bg === 'ALL') return this.getAll();
        return this.getAll().filter(d => d.blood === bg);
    }
};

const RequestManager = {
    KEY: 'lf_requests',
    getAll() {
        try { return JSON.parse(localStorage.getItem(this.KEY)) || []; }
        catch { return []; }
    },
    add(req) {
        const reqs = this.getAll();
        req.id = Date.now();
        req.date = new Date().toLocaleDateString('en-IN');
        req.status = 'Pending';
        reqs.push(req);
        localStorage.setItem(this.KEY, JSON.stringify(reqs));
        return req;
    },
    fulfill(id) {
        const reqs = this.getAll().map(r => r.id === id ? { ...r, status: 'Fulfilled' } : r);
        localStorage.setItem(this.KEY, JSON.stringify(reqs));
    },
    remove(id) {
        const reqs = this.getAll().filter(r => r.id !== id);
        localStorage.setItem(this.KEY, JSON.stringify(reqs));
    }
};

const InventoryManager = {
    KEY: 'lf_inventory',
    DEFAULT: { 'A+': 42, 'A-': 18, 'B+': 55, 'B-': 12, 'AB+': 30, 'AB-': 8, 'O+': 68, 'O-': 22 },
    getAll() {
        try {
            const saved = JSON.parse(localStorage.getItem(this.KEY));
            return saved || { ...this.DEFAULT };
        } catch { return { ...this.DEFAULT }; }
    },
    update(blood, delta) {
        const inv = this.getAll();
        inv[blood] = Math.max(0, (inv[blood] || 0) + delta);
        localStorage.setItem(this.KEY, JSON.stringify(inv));
        return inv[blood];
    },
    set(blood, val) {
        const inv = this.getAll();
        inv[blood] = Math.max(0, val);
        localStorage.setItem(this.KEY, JSON.stringify(inv));
    }
};

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
   BLOOD INVENTORY RENDER
   ──────────────────────────────────────────── */

function getStatus(units) {
    if (units >= 30) return { label: 'Available', cls: 'status-good' };
    if (units >= 10) return { label: 'Low Stock', cls: 'status-low' };
    return { label: 'Critical', cls: 'status-critical' };
}

function renderInventory() {
    const grid = document.getElementById('bloodInventoryGrid');
    if (!grid) return;
    const inv = InventoryManager.getAll();
    const groups = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
    grid.innerHTML = groups.map(bg => {
        const units = inv[bg] || 0;
        const s = getStatus(units);
        return `
      <div class="blood-card reveal">
        <div class="blood-group-label">${bg}</div>
        <div class="blood-units">${units} <span>units</span></div>
        <div class="blood-status ${s.cls}">${s.label}</div>
      </div>`;
    }).join('');
    // Trigger reveal for freshly rendered cards
    setTimeout(initReveal, 50);
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
   DONOR FORM
   ──────────────────────────────────────────── */

document.getElementById('donorForm')?.addEventListener('submit', function (e) {
    e.preventDefault();
    let valid = true;
    const fields = [
        ['donorName', 'donorNameError'], ['donorAge', 'donorAgeError'],
        ['donorBlood', 'donorBloodError'], ['donorPhone', 'donorPhoneError'],
        ['donorCity', 'donorCityError'], ['donorConsent', 'donorConsentError']
    ];
    clearErrors(fields);

    const name = document.getElementById('donorName').value.trim();
    const age = parseInt(document.getElementById('donorAge').value);
    const blood = document.getElementById('donorBlood').value;
    const phone = document.getElementById('donorPhone').value.trim();
    const email = document.getElementById('donorEmail').value.trim();
    const city = document.getElementById('donorCity').value.trim();
    const consent = document.getElementById('donorConsent').checked;

    if (!name) { setError('donorName', 'donorNameError', 'Full name is required.'); valid = false; }
    if (!age || age < 18 || age > 65) { setError('donorAge', 'donorAgeError', 'Age must be between 18 and 65.'); valid = false; }
    if (!blood) { setError('donorBlood', 'donorBloodError', 'Please select a blood group.'); valid = false; }
    if (!validatePhone(phone)) { setError('donorPhone', 'donorPhoneError', 'Enter a valid 10-digit phone.'); valid = false; }
    if (email && !validateEmail(email)) { setError('donorEmail', 'donorEmailError', 'Enter a valid email address.'); valid = false; }
    if (!city) { setError('donorCity', 'donorCityError', 'City is required.'); valid = false; }
    if (!consent) { setError('donorConsent', 'donorConsentError', 'Consent is required to register.'); valid = false; }

    if (!valid) return;

    const donor = DonorManager.add({
        name, age, blood, phone, email, city,
        lastDate: document.getElementById('donorLastDate').value
    });

    Toast.show(`🎉 Welcome, ${name}! You are now a registered donor.`, 'success');
    this.reset();
    renderDonorDirectory('ALL');
    if (document.getElementById('adminDashboard')?.style.display !== 'none') updateAdminStats();
});

/* ────────────────────────────────────────────
   REQUEST FORM
   ──────────────────────────────────────────── */

document.getElementById('requestForm')?.addEventListener('submit', function (e) {
    e.preventDefault();
    let valid = true;
    const fields = [
        ['reqPatient', 'reqPatientError'], ['reqBlood', 'reqBloodError'],
        ['reqUnits', 'reqUnitsError'], ['reqUrgency', 'reqUrgencyError'],
        ['reqHospital', 'reqHospitalError'], ['reqPhone', 'reqPhoneError'], ['reqCity', 'reqCityError']
    ];
    clearErrors(fields);

    const patient = document.getElementById('reqPatient').value.trim();
    const blood = document.getElementById('reqBlood').value;
    const units = parseInt(document.getElementById('reqUnits').value);
    const urgency = document.getElementById('reqUrgency').value;
    const hospital = document.getElementById('reqHospital').value.trim();
    const doctor = document.getElementById('reqDoctor')?.value.trim() || '';
    const phone = document.getElementById('reqPhone').value.trim();
    const city = document.getElementById('reqCity').value.trim();

    if (!patient) { setError('reqPatient', 'reqPatientError', 'Patient name is required.'); valid = false; }
    if (!blood) { setError('reqBlood', 'reqBloodError', 'Blood group is required.'); valid = false; }
    if (!units || units < 1) { setError('reqUnits', 'reqUnitsError', 'Enter number of units needed.'); valid = false; }
    if (!urgency) { setError('reqUrgency', 'reqUrgencyError', 'Please select urgency level.'); valid = false; }
    if (!hospital) { setError('reqHospital', 'reqHospitalError', 'Hospital name is required.'); valid = false; }
    if (!validatePhone(phone)) { setError('reqPhone', 'reqPhoneError', 'Enter a valid 10-digit phone.'); valid = false; }
    if (!city) { setError('reqCity', 'reqCityError', 'City is required.'); valid = false; }

    if (!valid) return;

    RequestManager.add({ patient, blood, units, urgency, hospital, doctor, phone, city });

    const urgencyMessages = {
        Critical: '🚨 Critical request submitted! Our team will respond within the hour.',
        Urgent: '⚡ Urgent request submitted! We\'ll contact you soon.',
        Normal: '✅ Request submitted successfully! We\'ll arrange blood within 3 days.'
    };
    Toast.show(urgencyMessages[urgency] || 'Blood request submitted!', 'success');
    this.reset();
    if (document.getElementById('adminDashboard')?.style.display !== 'none') updateAdminStats();
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
   DONOR DIRECTORY
   ──────────────────────────────────────────── */

function renderDonorDirectory(filter = 'ALL') {
    const list = document.getElementById('donorList');
    if (!list) return;
    const donors = DonorManager.getByBloodGroup(filter);
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
        const initials = d.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
        return `
      <div class="donor-card" style="animation-delay:${i * 0.06}s">
        <div class="donor-card-header">
          <div class="donor-avatar">${initials}</div>
          <div>
            <h4>${escapeHtml(d.name)}</h4>
            <div class="blood-badge">${d.blood}</div>
          </div>
        </div>
        <div class="donor-card-meta">
          <div class="donor-meta-item">📍 ${escapeHtml(d.city)}</div>
          <div class="donor-meta-item">📅 Registered: ${d.date}</div>
          ${d.age ? `<div class="donor-meta-item">🎂 Age: ${d.age}</div>` : ''}
        </div>
      </div>`;
    }).join('');
}

document.getElementById('donorList')?.closest('section')?.querySelector('.dir-filters')
    ?.addEventListener('click', function (e) {
        const btn = e.target.closest('.filter-btn');
        if (!btn) return;
        document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        renderDonorDirectory(btn.dataset.filter);
    });

// Wire up filter buttons (they are outside closest)
document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', function () {
        document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
        this.classList.add('active');
        renderDonorDirectory(this.dataset.filter);
    });
});

/* ────────────────────────────────────────────
   ADMIN DASHBOARD
   ──────────────────────────────────────────── */

const ADMIN_CREDS = { user: 'admin', pass: 'admin123' };

document.getElementById('adminLoginForm')?.addEventListener('submit', function (e) {
    e.preventDefault();
    const user = document.getElementById('adminUser').value.trim();
    const pass = document.getElementById('adminPass').value;
    const err = document.getElementById('adminError');
    if (user === ADMIN_CREDS.user && pass === ADMIN_CREDS.pass) {
        err.textContent = '';
        document.getElementById('adminLoginCard').style.display = 'none';
        document.getElementById('adminDashboard').style.display = 'block';
        updateAdminStats();
        renderAdminDonors();
        renderAdminRequests();
        renderAdminInventory();
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
});

function updateAdminStats() {
    const donors = DonorManager.getAll();
    const reqs = RequestManager.getAll();
    const inv = InventoryManager.getAll();
    const total = Object.values(inv).reduce((a, b) => a + b, 0);
    const pending = reqs.filter(r => r.status === 'Pending').length;
    document.getElementById('dashTotalDonors').textContent = donors.length;
    document.getElementById('dashPendingRequests').textContent = pending;
    document.getElementById('dashTotalUnits').textContent = total;
}

function renderAdminDonors() {
    const tbody = document.getElementById('adminDonorsTbody');
    if (!tbody) return;
    const donors = DonorManager.getAll();
    if (donors.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:var(--text-muted);padding:32px">No donors registered yet.</td></tr>';
        return;
    }
    tbody.innerHTML = donors.map((d, i) => `
    <tr>
      <td>${i + 1}</td>
      <td>${escapeHtml(d.name)}</td>
      <td>${d.age}</td>
      <td><span class="blood-badge">${d.blood}</span></td>
      <td>${escapeHtml(d.phone)}</td>
      <td>${escapeHtml(d.city)}</td>
      <td><button class="btn btn-danger btn-sm" onclick="deleteDonor(${d.id})">Remove</button></td>
    </tr>`).join('');
}

window.deleteDonor = function (id) {
    if (!confirm('Remove this donor from the registry?')) return;
    DonorManager.remove(id);
    renderAdminDonors();
    renderDonorDirectory(document.querySelector('.filter-btn.active')?.dataset.filter || 'ALL');
    updateAdminStats();
    Toast.show('Donor removed from registry.', 'warning');
};

function renderAdminRequests() {
    const tbody = document.getElementById('adminRequestsTbody');
    if (!tbody) return;
    const reqs = RequestManager.getAll();
    if (reqs.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;color:var(--text-muted);padding:32px">No blood requests yet.</td></tr>';
        return;
    }
    tbody.innerHTML = reqs.map((r, i) => `
    <tr>
      <td>${i + 1}</td>
      <td>${escapeHtml(r.patient)}</td>
      <td><span class="blood-badge">${r.blood}</span></td>
      <td>${r.units}</td>
      <td><span class="urgency-badge urgency-${r.urgency}">${r.urgency}</span></td>
      <td>${escapeHtml(r.hospital)}</td>
      <td><span class="status-badge status-${r.status}">${r.status}</span></td>
      <td>
        ${r.status === 'Pending'
            ? `<button class="btn btn-sm" style="background:rgba(34,197,94,0.15);color:#22C55E;border:1px solid rgba(34,197,94,0.3)" onclick="fulfillRequest(${r.id})">Fulfill</button>`
            : '<span style="color:var(--text-muted);font-size:0.8rem">Done</span>'}
      </td>
    </tr>`).join('');
}

window.fulfillRequest = function (id) {
    RequestManager.fulfill(id);
    renderAdminRequests();
    updateAdminStats();
    Toast.show('Request marked as fulfilled!', 'success');
};

function renderAdminInventory() {
    const editor = document.getElementById('inventoryEditor');
    if (!editor) return;
    const inv = InventoryManager.getAll();
    const groups = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
    editor.innerHTML = groups.map(bg => `
    <div class="inv-item">
      <div class="inv-group">${bg}</div>
      <div class="inv-count" id="invCount_${bg.replace('+', 'p').replace('-', 'm')}">${inv[bg] || 0} units</div>
      <div class="inv-controls">
        <button class="inv-btn" onclick="updateInv('${bg}', -1)">−</button>
        <button class="inv-btn" onclick="updateInv('${bg}', +5)">+5</button>
        <button class="inv-btn" onclick="updateInv('${bg}', +1)">+</button>
      </div>
    </div>`).join('');
}

window.updateInv = function (bg, delta) {
    const newVal = InventoryManager.update(bg, delta);
    const key = bg.replace('+', 'p').replace('-', 'm');
    const el = document.getElementById(`invCount_${key}`);
    if (el) el.textContent = `${newVal} units`;
    renderInventory();
    updateAdminStats();
    Toast.show(`${bg} inventory updated to ${newVal} units.`, 'info');
};

/* ────────────────────────────────────────────
   NAVBAR
   ──────────────────────────────────────────── */

// Sticky + scroll behavior
window.addEventListener('scroll', () => {
    const navbar = document.getElementById('navbar');
    navbar?.classList.toggle('scrolled', window.scrollY > 40);

    // Active nav link
    const sections = document.querySelectorAll('section[id]');
    let current = '';
    sections.forEach(s => {
        if (window.scrollY >= s.offsetTop - 120) current = s.id;
    });
    document.querySelectorAll('.nav-link').forEach(l => {
        l.classList.toggle('active', l.getAttribute('href') === `#${current}`);
    });

    // Scroll to top button
    document.getElementById('scrollTopBtn')?.classList.toggle('visible', window.scrollY > 400);
});

// Hamburger menu
document.getElementById('hamburger')?.addEventListener('click', function () {
    this.classList.toggle('open');
    document.getElementById('navLinks')?.classList.toggle('open');
});

// Close mobile menu on link click
document.getElementById('navLinks')?.addEventListener('click', e => {
    if (e.target.classList.contains('nav-link')) {
        document.getElementById('hamburger')?.classList.remove('open');
        document.getElementById('navLinks')?.classList.remove('open');
    }
});

// Scroll to top
document.getElementById('scrollTopBtn')?.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
});

// Smooth scroll helper
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

// Persist theme
const savedTheme = localStorage.getItem('lf_theme') || 'dark';
setTheme(savedTheme);

/* ────────────────────────────────────────────
   REVEAL ON SCROLL (Intersection Observer)
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

document.addEventListener('DOMContentLoaded', () => {
    renderInventory();
    renderDonorDirectory('ALL');
    createParticles();
    initReveal();
    initCounters();

    // Re-init reveal after dynamic renders settle
    setTimeout(initReveal, 300);

    console.log('%c LifeFlow Blood Bank System ', 'background:#C0032C;color:white;font-size:14px;padding:4px 8px;border-radius:4px;');
    console.log('%c Admin login → username: admin | password: admin123', 'color:#FF6B6B');
});
