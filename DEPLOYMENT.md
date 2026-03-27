# LifeFlow Blood Bank — Deployment Guide

## Prerequisites
- Node.js ≥ 18
- A PostgreSQL database (local, Supabase, or Neon)

---

## Step 1 — Get a PostgreSQL Database

### Option A — Local PostgreSQL
```bash
# Install PostgreSQL then create the database
psql -U postgres -c "CREATE DATABASE lifeflow;"
```
Your `DATABASE_URL`:
```
postgresql://postgres:yourpassword@localhost:5432/lifeflow
```

---

### Option B — Supabase (Free Tier)
1. Sign up at [supabase.com](https://supabase.com)
2. Create a new project → choose a region and a strong password
3. Go to **Settings → Database → Connection string → URI** tab
4. Copy the connection string (it looks like):
   ```
   postgresql://postgres:[YOUR-PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres
   ```
5. ⚠️ Replace `[YOUR-PASSWORD]` with the password you set during project creation

---

### Option C — Neon (Free Tier)
1. Sign up at [neon.tech](https://neon.tech)
2. Create a new project → choose a region
3. Go to **Dashboard → Connection Details**
4. Copy the connection string:
   ```
   postgresql://[USER]:[PASSWORD]@[HOST]/[DBNAME]?sslmode=require
   ```

---

## Step 2 — Configure Environment Variables

In the project root (`c:\Users\NIRANJANA\Desktop\BloodBankProject`), create a file named `.env`:

```env
DATABASE_URL=postgresql://postgres:yourpassword@localhost:5432/lifeflow
PORT=3000
```

> **⚠️ Never commit `.env` to Git.** It is already in `.gitignore`.

---

## Step 3 — Install Dependencies & Start

```bash
# From the project root
npm install
npm start
```

On first run, the server will:
1. Connect to PostgreSQL
2. Create all 4 tables (`users`, `donors`, `blood_banks`, `blood_requests`)
3. Seed `blood_banks` with random 10–100 units per blood group
4. Start the server at `http://localhost:3000`

Open your browser → `http://localhost:3000`

---

## Step 4 — Verify Everything Works

Run these PowerShell commands to smoke-test the API:

```powershell
# Health check
Invoke-RestMethod http://localhost:3000/api/health

# View inventory
Invoke-RestMethod http://localhost:3000/api/inventory

# Register a donor (donates 2 units of O+)
Invoke-RestMethod -Method POST -Uri http://localhost:3000/api/register `
  -ContentType "application/json" `
  -Body '{"full_name":"Test Donor","email":"donor@test.com","phone_number":"9876543210","blood_group":"O+","location":"Delhi","units_donated":2}'

# Submit a blood request
Invoke-RestMethod -Method POST -Uri http://localhost:3000/api/requests `
  -ContentType "application/json" `
  -Body '{"blood_group":"O+","location":"Delhi","units_required":1,"urgency_level":"Normal"}'

# Approve request (replace 1 with actual request_id)
Invoke-RestMethod -Method PUT -Uri http://localhost:3000/api/requests/approve `
  -ContentType "application/json" `
  -Body '{"request_id":1}'

# View all donors
Invoke-RestMethod http://localhost:3000/api/donors

# View all requests
Invoke-RestMethod http://localhost:3000/api/requests
```

---

## API Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/register` | Register a new donor |
| `POST` | `/api/donors/donate` | Record a donation (increments inventory) |
| `GET`  | `/api/donors` | List all donors |
| `GET`  | `/api/inventory` | Get blood units per group |
| `POST` | `/api/requests` | Submit a blood request |
| `PUT`  | `/api/requests/approve` | Approve request (atomic deduction) |
| `GET`  | `/api/requests` | List all blood requests |
| `GET`  | `/api/health` | Server health check |

---

## Production Deployment (Optional)

### Deploy to Railway or Render
1. Push your code to GitHub (make sure `.env` is in `.gitignore`)
2. Create a new web service on [Railway](https://railway.app) or [Render](https://render.com)
3. Set the `DATABASE_URL` environment variable in the dashboard
4. Set start command: `node backend/server.js`

### Environment Variables to Set in Production
| Variable | Value |
|----------|-------|
| `DATABASE_URL` | Your cloud PostgreSQL connection string |
| `PORT` | Usually set automatically by the platform |

---

## Admin Panel
- URL: `http://localhost:3000/#admin`
- Username: `admin`
- Password: `admin123`
