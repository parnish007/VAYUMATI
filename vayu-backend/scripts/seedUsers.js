require("dotenv").config();
const bcrypt = require("bcryptjs");
const fs = require("fs");
const path = require("path");

function genId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

const SALT_ROUNDS = 10;
const PASSWORD = "Ward11#2026";

async function seed() {
  const hash = await bcrypt.hash(PASSWORD, SALT_ROUNDS);
  const users = [
    {
      id: "u1",
      username: "anisha",
      name: "Anisha Tamang",
      role: "individual",
      ward_id: "11",
      phone: "+977-9800000001",
      status: "approved",
      avatar_url: null,
      created_at: new Date().toISOString(),
      password_hash: hash,
    },
    {
      id: "u2",
      username: "ram",
      name: "Ram Bahadur Shrestha",
      role: "farmer",
      ward_id: "11",
      phone: "+977-9800000002",
      status: "approved",
      avatar_url: null,
      created_at: new Date().toISOString(),
      password_hash: hash,
    },
    {
      id: "u3",
      username: "exec",
      name: "Ward 11 Executive",
      role: "executive",
      ward_id: "11",
      phone: "+977-9800000003",
      status: "approved",
      avatar_url: null,
      created_at: new Date().toISOString(),
      password_hash: hash,
    },
  ];

  const dataDir = path.join(__dirname, "../data");
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

  fs.writeFileSync(
    path.join(dataDir, "users.json"),
    JSON.stringify(users, null, 2),
    "utf8"
  );
  console.log("✅ Seeded 3 users to data/users.json");
  console.log("  anisha / Ward11#2026 (individual)");
  console.log("  ram    / Ward11#2026 (farmer)");
  console.log("  exec   / Ward11#2026 (executive)");
}

seed().catch(console.error);
