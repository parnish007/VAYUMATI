/**
 * On every startup: ensure PostgreSQL tables exist and seed the 3 demo accounts.
 *
 * Safe to call repeatedly — uses CREATE TABLE IF NOT EXISTS and INSERT ON CONFLICT DO NOTHING.
 * Replace placeholder phone numbers with real Nepal numbers before demo day.
 * Default credentials are stored in CREDENTIALS.md (gitignored — never committed).
 */

const pool = require("../db/postgres");

// Pre-hashed "Ward11#2026" with bcrypt 10 rounds
const HASH = "$2b$10$/dVoh6daTfHnUVxnreMYDejouix1KRyR9ywRzydbOxlGoqfn9MlOe";

const SEED_USERS = [
  { id: "u1", username: "anisha", name: "Anisha Tamang",        role: "individual", ward_id: "11", phone: "+9779800000001" },
  { id: "u2", username: "ram",    name: "Ram Bahadur Shrestha", role: "farmer",     ward_id: "11", phone: "+9779800000002" },
  { id: "u3", username: "exec",   name: "Ward 11 Executive",    role: "executive",  ward_id: "11", phone: "+9779800000003" },
];

async function initData() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id           TEXT        PRIMARY KEY,
      username     TEXT        UNIQUE NOT NULL,
      name         TEXT        NOT NULL,
      role         TEXT        NOT NULL DEFAULT 'individual',
      ward_id      TEXT        NOT NULL DEFAULT '11',
      phone        TEXT,
      status       TEXT        NOT NULL DEFAULT 'pending',
      avatar_url   TEXT,
      password_hash TEXT       NOT NULL,
      created_at   TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS demo_members (
      id         TEXT        PRIMARY KEY,
      name       TEXT        NOT NULL,
      phone      TEXT,
      ward_id    TEXT        NOT NULL DEFAULT '11',
      added_at   TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  console.log("[INIT] PostgreSQL tables ready");

  for (const u of SEED_USERS) {
    await pool.query(
      `INSERT INTO users (id, username, name, role, ward_id, phone, status, avatar_url, password_hash, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,'approved',NULL,$7,NOW())
       ON CONFLICT (username) DO NOTHING`,
      [u.id, u.username, u.name, u.role, u.ward_id, u.phone, HASH]
    );
  }

  console.log("[INIT] Demo accounts ready — see CREDENTIALS.md for login details");
  console.log("[INIT] IMPORTANT: replace placeholder phones in SEED_USERS before demo day");
}

module.exports = { initData };
