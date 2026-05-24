const pool = require("../db/postgres");

function safeUser(u) {
  const { password_hash, ...rest } = u;
  return rest;
}

async function findByUsername(username) {
  const { rows } = await pool.query(
    "SELECT * FROM users WHERE username = $1",
    [username]
  );
  return rows[0] || null;
}

async function findById(id) {
  const { rows } = await pool.query(
    "SELECT * FROM users WHERE id = $1",
    [id]
  );
  return rows[0] || null;
}

async function createUser(data) {
  const id = "u" + Date.now().toString(36);
  const { rows } = await pool.query(
    `INSERT INTO users
       (id, username, name, role, ward_id, phone, status, avatar_url, password_hash, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,'pending',NULL,$7,NOW())
     RETURNING *`,
    [id, data.username, data.name, data.role, data.ward_id || "11", data.phone || null, data.password_hash]
  );
  return rows[0];
}

async function approveUser(id) {
  const { rowCount } = await pool.query(
    "UPDATE users SET status = 'approved' WHERE id = $1",
    [id]
  );
  return rowCount > 0;
}

async function rejectUser(id) {
  const { rowCount } = await pool.query(
    "DELETE FROM users WHERE id = $1",
    [id]
  );
  return rowCount > 0;
}

async function getPending() {
  const { rows } = await pool.query(
    "SELECT * FROM users WHERE status = 'pending' ORDER BY created_at ASC"
  );
  return rows.map(safeUser);
}

async function getApproved(ward_id) {
  let query  = "SELECT * FROM users WHERE status = 'approved'";
  const params = [];
  if (ward_id) {
    query += " AND ward_id = $1";
    params.push(ward_id);
  }
  const { rows } = await pool.query(query, params);
  return rows.map(safeUser);
}

async function updateAvatar(id, avatar_url) {
  const { rowCount } = await pool.query(
    "UPDATE users SET avatar_url = $2 WHERE id = $1",
    [id, avatar_url]
  );
  return rowCount > 0;
}

module.exports = {
  findByUsername,
  findById,
  safeUser,
  createUser,
  approveUser,
  rejectUser,
  getPending,
  getApproved,
  updateAvatar,
};
