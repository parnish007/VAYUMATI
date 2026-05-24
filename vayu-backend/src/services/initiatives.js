const fs = require("fs");
const path = require("path");

const FILE = path.join(__dirname, "../../data/initiatives.json");

function read() {
  if (!fs.existsSync(FILE)) return [];
  return JSON.parse(fs.readFileSync(FILE, "utf8"));
}

function write(data) {
  fs.writeFileSync(FILE, JSON.stringify(data, null, 2), "utf8");
}

function genId() {
  return "init_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function getAll(ward_id) {
  const all = read();
  return ward_id ? all.filter((i) => i.ward_id === ward_id) : all;
}

function getById(id) {
  return read().find((i) => i.id === id) || null;
}

function create(data, user) {
  const all = read();
  const item = {
    id: genId(),
    title: data.title,
    description: data.description || "",
    category: data.category || "awareness_drive",
    lat: parseFloat(data.lat),
    lng: parseFloat(data.lng),
    location_name: data.location_name || "Ward 11",
    scheduled_at: data.scheduled_at,
    created_by: { id: user.id, name: user.name, avatar_url: user.avatar_url || null },
    joined_by: [],
    status: "upcoming",
    ward_id: data.ward_id || user.ward_id || "11",
    pa_points_init: 30,
    pa_points_join: 10,
    created_at: new Date().toISOString(),
  };
  all.push(item);
  write(all);
  return item;
}

function join(id, user) {
  const all = read();
  const idx = all.findIndex((i) => i.id === id);
  if (idx === -1) return null;
  const already = all[idx].joined_by.find((j) => j.id === user.id);
  if (already) return { initiative: all[idx], alreadyJoined: true };
  all[idx].joined_by.push({ id: user.id, name: user.name, avatar_url: user.avatar_url || null, joined_at: new Date().toISOString() });
  write(all);
  return { initiative: all[idx], alreadyJoined: false };
}

module.exports = { getAll, getById, create, join };
