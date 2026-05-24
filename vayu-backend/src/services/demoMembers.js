const pool = require("../db/postgres");

async function getDemoMembers(ward_id) {
  let query  = "SELECT * FROM demo_members ORDER BY added_at ASC";
  const params = [];
  if (ward_id) {
    query  = "SELECT * FROM demo_members WHERE ward_id = $1 ORDER BY added_at ASC";
    params.push(ward_id);
  }
  const { rows } = await pool.query(query, params);
  return rows;
}

async function addDemoMember({ name, phone, ward_id }) {
  const id = "dm" + Date.now().toString(36);
  const { rows } = await pool.query(
    `INSERT INTO demo_members (id, name, phone, ward_id, added_at)
     VALUES ($1,$2,$3,$4,NOW()) RETURNING *`,
    [id, name || "Demo Member", phone || null, ward_id || "11"]
  );
  return rows[0];
}

async function removeDemoMember(id) {
  const { rowCount } = await pool.query(
    "DELETE FROM demo_members WHERE id = $1",
    [id]
  );
  return rowCount > 0;
}

module.exports = { getDemoMembers, addDemoMember, removeDemoMember };
