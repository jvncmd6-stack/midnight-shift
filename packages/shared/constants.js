"use strict";

// Dimensi Dunia & Grid (Sinkron dengan render tile 16px)
const TILE_SIZE = 16;
const MAP_W = 64;
const MAP_H = 44;
const TICK_RATE = 20; // 20 Hz server simulation
const SNAPSHOT_RATE = 15; // 15 Hz state broadcast

// Daftar Prop & Ketahanan (Hits)
const PROPS = {
  cone: { name: "Cone Parkir", w: 12, h: 10, hits: 1, speedMult: 0.95 },
  galon: { name: "Dispenser", w: 12, h: 18, hits: 1, speedMult: 0.9 },
  pot: { name: "Pot Tanaman", w: 12, h: 12, hits: 1, speedMult: 0.9 },
  drum: { name: "Tong Sampah", w: 16, h: 20, hits: 2, speedMult: 0.82 },
  speaker: { name: "Printer", w: 16, h: 22, hits: 2, speedMult: 0.8 },
  palet: { name: "Sofa", w: 22, h: 14, hits: 2, speedMult: 0.78 }
};

// Zona Ruangan (Nama, x, y, w, h, daftar prop)
const ZONES = [
  { id: "lobby", name: "Lobi Gedung", x: 1, y: 33, w: 11, h: 10, props: [] },
  { id: "office", name: "Ruang Kantor", x: 2, y: 2, w: 20, h: 16, props: ["speaker", "drum", "galon", "pot", "palet"] },
  { id: "server", name: "Ruang Server", x: 14, y: 26, w: 16, h: 16, props: ["drum", "speaker", "cone"] },
  { id: "cafe", name: "Kafetaria", x: 34, y: 26, w: 18, h: 16, props: ["galon", "pot", "palet", "drum"] },
  { id: "hall", name: "Aula Rapat", x: 38, y: 2, w: 24, h: 16, props: ["palet", "pot", "galon"] }
];

// Kotak Solid (Tembok/Furnitur permanen) untuk Server Collision & LOS
const SOLIDS = [
  [41, 2, 18, 3], [36, 29, 5, 2], [44, 29, 5, 2],
  [16, 29, 4, 2], [23, 29, 4, 2], [5, 6, 4, 2],
  [14, 11, 4, 2], [9, 14, 4, 2], [19, 5, 3, 2],
  [2, 34, 6, 2],
  // Tiang lampu koridor
  [19.7, 19.05, 0.6, 0.5], [43.7, 19.05, 0.6, 0.5],
  [19.7, 24.15, 0.6, 0.5], [43.7, 24.15, 0.6, 0.5],
  [9.7, 21.55, 0.6, 0.5], [53.7, 21.55, 0.6, 0.5]
];

// Titik Terminal Tugas (x, z, tipe mini-game 0-5)
const TERMINALS = [
  { id: 0, x: 22, z: 34, kind: 0, name: "Kabel Server" },
  { id: 1, x: 43, z: 36, kind: 1, name: "Isi Galon" },
  { id: 2, x: 50, z: 10, kind: 2, name: "Proyektor" },
  { id: 3, x: 9, z: 10, kind: 3, name: "Printer" },
  { id: 4, x: 18, z: 5, kind: 4, name: "Brankas" },
  { id: 5, x: 56, z: 22, kind: 5, name: "Panel Listrik" }
];

const EXIT_GATES = [
  { id: "north", x: 62.5, z: 12.5 },
  { id: "south", x: 62.5, z: 31.5 }
];

const EMERGENCY_BUTTON = { x: 32, z: 22 };

// Katalog Peran & Faksi
const ROLES = {
  WARGA: { id: "WARGA", team: "CIVILIAN", name: "Warga", desc: "Selesaikan tugas & kabur lewat pintu darurat." },
  TEKNISI: { id: "TEKNISI", team: "CIVILIAN", name: "Teknisi", desc: "Skill PINDAI satpam & lebih cepat memperbaiki tugas." },
  PENYUSUP: { id: "PENYUSUP", team: "CIVILIAN", name: "Penyusup", desc: "Skill UMPAN suara & sprint lebih lama." },
  DOKTER: { id: "DOKTER", team: "CIVILIAN", name: "Dokter", desc: "Bisa menyembuhkan teman yang terluka (1 HP)." },
  SATPAM: { id: "SATPAM", team: "GUARD", name: "Satpam", desc: "Cari penyamar dengan senter dan tangkap semua sebelum kabur." },
  CEPU: { id: "CEPU", team: "TRAITOR", name: "Cepu", desc: "Menyamar sebagai warga, sabotase tugas, dan gagalkan pelarian." },
  BADUT: { id: "BADUT", team: "NEUTRAL", name: "Badut", desc: "Menang jika berhasil membuat dirimu diusir saat rapat darurat!" }
};

// Formula Pembagian Peran Otomatis Berdasarkan Jumlah Pemain (4 - 20)
function getRoleDistribution(playerCount, mode = "CLASSIC") {
  const n = Math.max(4, Math.min(20, playerCount));
  const guards = n < 10 ? 1 : n < 15 ? 2 : n < 20 ? 3 : 4;
  const traitors = mode === "QUICK" ? 0 : n >= 18 ? 2 : n >= 7 ? 1 : 0;
  const neutrals = mode === "CHAOS" && n >= 10 ? 1 : 0;
  const civilians = Math.max(1, n - guards - traitors - neutrals);
  return { guards, traitors, neutrals, civilians };
}

// Cek Tabrakan Tembok (Server & Client Identik)
function isBlocked(x, z) {
  if (x < 1.3 || x > 62.6 || z < 1.6 || z > 42.6) return true;
  for (let i = 0; i < SOLIDS.length; i++) {
    const s = SOLIDS[i];
    if (x > s[0] - 0.3 && x < s[0] + s[2] + 0.3 && z > s[1] - 0.1 && z < s[1] + s[3] + 0.3) {
      return true;
    }
  }
  return false;
}

// Raycast Line-of-Sight (Anti-Wallhack)
function hasLineOfSight(ax, az, bx, bz) {
  const dist = Math.hypot(bx - ax, bz - az);
  const steps = Math.ceil(dist / 0.55);
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    if (isBlocked(ax + (bx - ax) * t, az + (bz - az) * t)) return false;
  }
  return true;
}

module.exports = {
  TILE_SIZE,
  MAP_W,
  MAP_H,
  TICK_RATE,
  SNAPSHOT_RATE,
  PROPS,
  ZONES,
  SOLIDS,
  TERMINALS,
  EXIT_GATES,
  EMERGENCY_BUTTON,
  ROLES,
  getRoleDistribution,
  isBlocked,
  hasLineOfSight
};
