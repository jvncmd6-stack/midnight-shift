"use strict";

const TICK_RATE = 20;
const MAP_W = 64;
const MAP_H = 44;

const EMERGENCY_BUTTON = { x: 32, z: 22 };

const EXIT_GATES = [
  { id: "gate_north", x: 62.5, z: 12.5 },
  { id: "gate_south", x: 62.5, z: 31.5 }
];

// 12 Properti Gedung (Semakin besar benda, semakin banyak HP samaran)
const PROPS = {
  cone:    { name: "Traffic Cone",   hits: 1, speedMult: 1.05 },
  bin:     { name: "Tong Sampah",    hits: 2, speedMult: 0.96 },
  box:     { name: "Kardus Arsip",   hits: 2, speedMult: 0.94 },
  plant:   { name: "Pot Monstera",   hits: 2, speedMult: 0.90 },
  chair:   { name: "Kursi Kantor",   hits: 2, speedMult: 0.95 },
  coffee:  { name: "Mesin Kopi",     hits: 2, speedMult: 0.88 },
  cooler:  { name: "Dispenser Air",  hits: 3, speedMult: 0.84 },
  printer: { name: "Mesin Fotokopi", hits: 3, speedMult: 0.80 },
  locker:  { name: "Loker Besi",     hits: 3, speedMult: 0.78 },
  server:  { name: "Rak Server",     hits: 3, speedMult: 0.76 },
  sofa:    { name: "Sofa Kulit",     hits: 4, speedMult: 0.72 },
  safe:    { name: "Brankas Baja",   hits: 4, speedMult: 0.68 }
};

const ZONES = [
  { id: "lobby",    name: "Lobi Utama",      x: 2,  y: 28, w: 18, h: 14, props: ["plant", "sofa", "cone", "bin"] },
  { id: "office",   name: "Ruang Kerja",     x: 2,  y: 2,  w: 22, h: 18, props: ["chair", "printer", "box", "cooler", "bin"] },
  { id: "pantry",   name: "Pantry & Kantin", x: 26, y: 2,  w: 14, h: 12, props: ["coffee", "cooler", "bin", "chair"] },
  { id: "server",   name: "Ruang Server",    x: 42, y: 2,  w: 20, h: 16, props: ["server", "box", "cone", "locker"] },
  { id: "vault",    name: "Ruang Brankas",   x: 42, y: 26, w: 20, h: 16, props: ["safe", "locker", "box", "plant"] },
  { id: "hallway",  name: "Koridor Tengah",  x: 22, y: 16, w: 20, h: 12, props: ["plant", "cone", "sofa", "chair"] }
];

const TERMINALS = [
  { id: 1, name: "Panel Lobi",     x: 8,  z: 31, type: "wiring" },
  { id: 2, name: "Server Utama",   x: 52, z: 7,  type: "server" },
  { id: 3, name: "Gardu Listrik",  x: 14, z: 6,  type: "fuse" },
  { id: 4, name: "Radio Keamanan", x: 33, z: 6,  type: "frequency" },
  { id: 5, name: "Scanner Brankas",x: 54, z: 34, type: "biometric" },
  { id: 6, name: "Terminal Arsip", x: 24, z: 36, type: "keypad" },
  { id: 7, name: "Panel Koridor",  x: 38, z: 20, type: "wiring" },
  { id: 8, name: "Relay Darurat",  x: 46, z: 14, type: "frequency" }
];

// 9 Peran Lengkap (Tim Sipil, Satpam, Pengkhianat, & Netral)
const ROLES = {
  SATPAM:   { name: "Satpam",   team: "GUARD",    desc: "Patroli & tangkap semua warga sebelum pintu darurat terbuka." },
  CEPU:     { name: "Cepu",     team: "TRAITOR",  desc: "Sabotase terminal yang sudah selesai agar Satpam menang." },
  PERETAS:  { name: "Peretas",  team: "TRAITOR",  desc: "Retas jaringan untuk memadamkan lampu & mengacak radar warga." },
  BADUT:    { name: "Badut",    team: "NEUTRAL",  desc: "Pancing kecurigaan agar kamu di-vote keluar saat Rapat Darurat!" },
  TEKNISI:  { name: "Teknisi",  team: "CIVILIAN", desc: "Selesaikan tugas 35% lebih cepat & aktifkan Radar X-Ray." },
  DOKTER:   { name: "Dokter",   team: "CIVILIAN", desc: "Lacak teman yang terluka & pulihkan nyawa mereka." },
  DETEKTIF: { name: "Detektif", team: "CIVILIAN", desc: "Lacak jejak kaki tersangka & analisis pelaku sabotase." },
  PENYUSUP: { name: "Penyusup", team: "CIVILIAN", desc: "Ahli kamuflase dengan durasi lari cepat ekstra lama." },
  WARGA:    { name: "Warga",    team: "CIVILIAN", desc: "Menyamar jadi properti gedung & selesaikan semua terminal." }
};

/**
 * Kategori Jumlah Pemain -> Menentukan Skala Tugas & Durasi Ronde
 */
function getTaskQuota(playerCount, mode = "CLASSIC") {
  let tier = "KECIL (4-6 PEMAIN)";
  let quota = 4;
  let timeLimit = 240;

  if (playerCount >= 15) {
    tier = "MEGA (15-20 PEMAIN)";
    quota = 8;
    timeLimit = 360;
  } else if (playerCount >= 10) {
    tier = "BESAR (10-14 PEMAIN)";
    quota = 7;
    timeLimit = 320;
  } else if (playerCount >= 7) {
    tier = "SEDANG (7-9 PEMAIN)";
    quota = 5;
    timeLimit = 280;
  }

  if (mode === "QUICK") {
    quota = Math.max(3, quota - 2);
    timeLimit = Math.max(150, timeLimit - 75);
  } else if (mode === "CHAOS") {
    quota = Math.min(8, quota + 1);
  }

  return { tier, quota, timeLimit };
}

/**
 * Distribusi Peran Otomatis Berdasarkan Jumlah Pemain
 */
function getRoleDistribution(count, mode = "CLASSIC") {
  const n = Math.max(4, count);
  const guards = n >= 14 ? 3 : n >= 8 ? 2 : 1;
  const traitors = n >= 12 ? 2 : 1; // 1 Cepu, jika >=12 tambah 1 Peretas
  const neutrals = n >= 6 ? 1 : 0;  // 1 Badut
  const civilians = Math.max(2, n - guards - traitors - neutrals);
  return { guards, traitors, neutrals, civilians, mode };
}

function isBlocked(x, z) {
  if (x < 1.2 || x > MAP_W - 1.2 || z < 1.2 || z > MAP_H - 1.2) return true;
  // Dinding pembatas ruangan dengan celah pintu lebar
  if (Math.abs(x - 24) < 0.6 && z < 18 && z > 6 && Math.abs(z - 12) > 2.2) return true;
  if (Math.abs(x - 41) < 0.6 && z < 18 && Math.abs(z - 10) > 2.2) return true;
  if (Math.abs(x - 41) < 0.6 && z > 25 && Math.abs(z - 33) > 2.2) return true;
  if (Math.abs(z - 26) < 0.6 && x > 41 && Math.abs(x - 51) > 2.4) return true;
  return false;
}

function hasLineOfSight(x1, z1, x2, z2) {
  const steps = Math.ceil(Math.hypot(x2 - x1, z2 - z1) * 2);
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    if (isBlocked(x1 + (x2 - x1) * t, z1 + (z2 - z1) * t)) return false;
  }
  return true;
}

module.exports = {
  TICK_RATE,
  MAP_W,
  MAP_H,
  PROPS,
  ZONES,
  TERMINALS,
  EXIT_GATES,
  ROLES,
  EMERGENCY_BUTTON,
  getTaskQuota,
  getRoleDistribution,
  isBlocked,
  hasLineOfSight
};
