"use strict";

const { InlineKeyboard } = require("grammy");

function buildWelcomeText(firstName = "Pemain") {
  return [
    `🌃 *SELAMAT DATANG DI MIDNIGHT SHIFT, ${String(firstName).toUpperCase()}!*`,
    "━━━━━━━━━━━━━━━━━━━━━━",
    "Gedung perkantoran sudah tutup, lampu mulai dipadamkan, dan shift malam baru saja dimulai...",
    "",
    "Di game *Multiplayer Pixel Prop-Hunt & Social Deduction* ini (4–20 pemain), kamu bisa:",
    "📦 *Menyamar jadi benda* (galon, cone, pot, printer, sofa)",
    "🛠 *Menyelesaikan tugas* untuk membuka pintu darurat",
    "🔦 *Berpatroli sebagai Satpam* mencari penyamar",
    "🐍 *Menyabotase dari dalam* sebagai Cepu pengkhianat!",
    "",
    "👇 *Mulai main sekarang atau baca panduan lengkap di bawah:*"
  ].join("\n");
}

function buildGroupWelcomeText() {
  return [
    "🔦 *MIDNIGHT SHIFT TELAH HADIR DI GRUP INI!*",
    "━━━━━━━━━━━━━━━━━━━━━━",
    "Siap mabar petak umpet & adu fitnah bareng satu grup?",
    "",
    "*Cara Mulai Mabar Grup:*",
    "1️⃣ Ketik `/play` untuk membuka kartu pendaftaran lobi.",
    "2️⃣ Anggota grup klik tombol *✋ IKUT MAIN* (maks. 20 orang).",
    "3️⃣ Klik *🎮 BUKA MINI APP* lalu Host menekan *🚀 MULAI GAME*!",
    "",
    "Ketik `/help` kapan saja untuk melihat daftar peran & aturan main."
  ].join("\n");
}

const GUIDE_PAGES = {
  flow: {
    title: "📖 *PANDUAN 1/4 — ALUR PERMAINAN*",
    body: [
      "*1. Fase Sembunyi (15 Detik Awal)*",
      "Satpam tertahan di pos jaga. Warga & Cepu segera berpencar, mencari tempat aman, dan tekan *NYAMAR* untuk berubah menjadi benda di sekitar.",
      "",
      "*2. Fase Patroli & Tugas (4 Menit 30 Detik)*",
      "• *Warga* berkeliling mencari terminal berkedip untuk mengerjakan 6 mini-game tugas.",
      "• *Satpam* menyusuri ruangan memakai senter dan memukul benda yang mencurigakan. *Hati-hati:* salah pukul benda asli bikin Satpam kena *Stun 1.5 detik*!",
      "• *Cepu* berpura-pura jadi Warga sambil diam-diam menyabotase tugas yang sudah selesai.",
      "",
      "*3. Rapat Darurat (Voting)*",
      "Tekan tombol merah di *Koridor Tengah* untuk memanggil rapat dan mengusir pemain yang dicurigai sebagai Cepu.",
      "",
      "*4. Pintu Darurat Terbuka (35 Detik Terakhir)*",
      "Saat kuota tugas terpenuhi, 2 pintu darurat di sisi kanan gedung terbuka. Warga harus berlari keluar sebelum waktu habis!"
    ].join("\n")
  },
  roles: {
    title: "🎭 *PANDUAN 2/4 — DAFTAR PERAN & SKILL*",
    body: [
      "🟢 *TIM WARGA (Menang jika kuota tugas selesai & kabur)*",
      "• *WARGA* — Menyamar jadi benda, kerjakan tugas, dan kabur.",
      "• *TEKNISI* — Mini-game tugas lebih cepat/mudah + Skill *Radar* untuk mendeteksi posisi Satpam selama 6 detik.",
      "• *PENYUSUP* — Lari (*Sprint*) lebih cepat dan cooldown lebih singkat.",
      "• *DOKTER* — Skill *Sembuhkan* untuk memulihkan 1 nyawa rekan setim di dekatnya.",
      "",
      "🔴 *TIM SATPAM (Menang jika semua Warga tertangkap / waktu habis)*",
      "• *SATPAM* — Punya senter jarak jauh, kebal penyamaran, dan serangan pentungan (2x pukul untuk menangkap Warga).",
      "",
      "🟣 *TIM PENGKHIANAT & NETRAL*",
      "• *CEPU (Traitor)* — Menyamar sebagai Warga, punya skill *Sabotase* (menggagalkan tugas selesai; 4x sabotase = Satpam langsung menang).",
      "• *BADUT (Neutral - Mode Chaos)* — Menang sendirian jika berhasil memancing pemain lain mengusirnya saat Rapat Darurat!"
    ].join("\n")
  },
  modes: {
    title: "⚙️ *PANDUAN 3/4 — MODE & FITUR*",
    body: [
      "*Pilihan Mode Permainan (Diatur Host):*",
      "• *CLASSIC* — Mode standar seimbang: Warga, Satpam, dan Cepu + Rapat Darurat aktif.",
      "• *QUICK HUNT* — Petak umpet murni tanpa Cepu & tanpa Rapat Darurat. Cocok untuk ronde cepat!",
      "• *CHAOS* — Kekacauan penuh! Peran spesial lengkap + kemunculan peran *Badut*.",
      "",
      "*Fitur Lainnya:*",
      "• *Bot Pengisi Otomatis:* Jika pemain kurang dari 6 orang, Host bisa mengaktifkan Bot agar lobi tetap ramai.",
      "• *Kustomisasi Avatar & Koin:* Kumpulkan koin dari setiap ronde untuk membuka gaya rambut, baju, dan aksesoris baru.",
      "• *Anti-Wallhack:* Pemain hanya melihat area dalam jarak pandang (*Line of Sight*)."
    ].join("\n")
  },
  commands: {
    title: "⌨️ *PANDUAN 4/4 — DAFTAR COMMAND BOT*",
    body: [
      "*Perintah Umum & Grup:*",
      "• `/start` — Membuka menu utama & tombol masuk Mini App",
      "• `/play` — Membuka lobi pendaftaran mabar di grup chat",
      "• `/join KODE` — Bergabung ke room tertentu (contoh: `/join MX7K2P`)",
      "• `/leave` — Batal ikut / keluar dari lobi grup",
      "• `/kick` — Mengeluarkan pemain AFK (balas pesan pemain, khusus Host)",
      "• `/profile` — Cek level, XP, koin, dan statistik kemenanganmu",
      "• `/rank` — Menampilkan papan peringkat Top 10 pemain",
      "• `/help` — Membuka buku panduan lengkap ini"
    ].join("\n")
  }
};

function buildGuideKeyboard(activeKey) {
  return new InlineKeyboard()
    .text(activeKey === "flow" ? "• Alur Main •" : "Alur Main", "guide_flow")
    .text(activeKey === "roles" ? "• Daftar Peran •" : "Daftar Peran", "guide_roles")
    .row()
    .text(activeKey === "modes" ? "• Mode & Fitur •" : "Mode & Fitur", "guide_modes")
    .text(activeKey === "commands" ? "• Command •" : "Command", "guide_commands");
}

function formatGuidePage(key = "flow") {
  const page = GUIDE_PAGES[key] || GUIDE_PAGES.flow;
  return `${page.title}\n━━━━━━━━━━━━━━━━━━━━━━\n\n${page.body}`;
}

function registerGuideHandlers(bot, webappUrl) {
  bot.callbackQuery(/^guide_(flow|roles|modes|commands)$/, async (ctx) => {
    const key = ctx.match[1];
    const kb = buildGuideKeyboard(key);
    if (ctx.chat && ctx.chat.type === "private" && webappUrl) {
      kb.row().webApp("🎮 LANGSUNG MAIN SEKARANG", webappUrl);
    }

    try {
      await ctx.editMessageText(formatGuidePage(key), {
        parse_mode: "Markdown",
        reply_markup: kb
      });
    } catch (e) {}
    await ctx.answerCallbackQuery();
  });

  bot.on("my_chat_member", async (ctx) => {
    const status = ctx.myChatMember?.new_chat_member?.status;
    const isGroup = ctx.chat.type === "group" || ctx.chat.type === "supergroup";
    if (isGroup && (status === "member" || status === "administrator")) {
      await ctx.reply(buildGroupWelcomeText(), { parse_mode: "Markdown" });
    }
  });
}

module.exports = {
  buildWelcomeText,
  buildGroupWelcomeText,
  buildGuideKeyboard,
  formatGuidePage,
  registerGuideHandlers
};
