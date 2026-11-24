"use strict";

const { InlineKeyboard } = require("grammy");

function buildWelcomeText(firstName = "Pemain") {
  return (
    `🌃 *SELAMAT DATANG DI MIDNIGHT SHIFT, ${firstName.toUpperCase()}!*\n` +
    `━━━━━━━━━━━━━━━━━━━━━━\n` +
    `Gedung perkantoran sudah tutup, lampu mulai dipadamkan, dan shift malam baru saja dimulai...\n\n` +
    `Di game *Multiplayer Pixel Prop-Hunt & Social Deduction* ini (4–20 pemain), kamu bisa:\n` +
    `📦 *Menyamar jadi benda* (galon, cone, pot, printer, sofa)\n` +
    `🛠 *Menyelesaikan tugas* untuk membuka pintu darurat\n` +
    `🔦 *Berpatroli sebagai Satpam* mencari penyamar\n` +
    `🐍 *Menyabotase dari dalam* sebagai Cepu pengkhianat!\n\n` +
    `👇 *Mulai main sekarang atau baca panduan lengkap di bawah:*`
  );
}

function buildGroupWelcomeText() {
  return (
    `🔦 *MIDNIGHT SHIFT TELAH HADIR DI GRUP INI!*\n` +
    `━━━━━━━━━━━━━━━━━━━━━━\n` +
    `Siap mabar petak umpet & adu fitnah bareng satu grup?\n\n` +
    `*Cara Mulai Mabar Grup:*\n` +
    `1️⃣ Ketik \`/play\` untuk membuka kartu pendaftaran lobi.\n` +
    `2️⃣ Anggota grup klik tombol *✋ IKUT MAIN* (maks. 20 orang).\n` +
    `3️⃣ Klik *🎮 BUKA MINI APP* lalu Host menekan *🚀 MULAI GAME*!\n\n` +
    `Ketik \`/help\` kapan saja untuk melihat daftar peran & aturan main.`
  );
}

const GUIDE_PAGES = {
  flow: {
    title: "📖 *PANDUAN 1/4 — ALUR PERMAINAN*",
    body:
      `*1. Fase Sembunyi (15 Detik Awal)*\n` +
      `Satpam tertahan di pos jaga. Warga & Cepu segera berpencar, mencari tempat aman, dan tekan *NYAMAR* untuk berubah menjadi benda di sekitar.\n\n` +
      `*2. Fase Patroli & Tugas (4 Menit 30 Detik)*\n` +
      `• *Warga* berkeliling mencari terminal berkedip untuk mengerjakan 6 mini-game tugas.\n` +
      `• *Satpam* menyusuri ruangan memakai senter dan memukul benda yang mencurigakan. *Hati-hati:* salah pukul benda asli bikin Satpam kena *Stun 1.5 detik*!\n` +
      `• *Cepu* berpura-pura jadi Warga sambil diam-diam menyabotase tugas yang sudah selesai.\n\n` +
      `*3. Rapat Darurat (Voting)*\n` +
      `Tekan tombol merah di *Koridor Tengah* untuk memanggil rapat dan mengusir pemain yang dicurigai sebagai Cepu.\n\n` +
      `*4. Pintu Darurat Terbuka (35 Detik Terakhir)*\n` +
      `Saat kuota tugas terpenuhi, 2 pintu darurat di sisi kanan gedung terbuka. Warga harus berlari keluar sebelum waktu habis!`
  },
  roles: {
    title: "🎭 *PANDUAN 2/4 — DAFTAR PERAN & SKILL*",
    body:
      `🟢 *TIM WARGA (Menang jika kuota tugas selesai & kabur)*\n` +
      `• *WARGA* — Menyamar jadi benda, kerjakan tugas, dan kabur.\n` +
      `• *TEKNISI* — Mini-game tugas lebih cepat/mudah + Skill *Radar* untuk mendeteksi posisi Satpam selama 6 detik.\n` +
      `• *PENYUSUP* — Lari (*Sprint*) lebih cepat dan cooldown lebih singkat.\n` +
      `• *DOKTER* — Skill *Sembuhkan* untuk memulihkan 1 nyawa rekan setim di dekatnya.\n\n` +
      `🔴 *TIM SATPAM (Menang jika semua Warga tertangkap / waktu habis)*\n` +
      `• *SATPAM* — Punya senter jarak jauh, kebal penyamaran, dan serangan pentungan (2x pukul untuk menangkap Warga).\n\n` +
      `🟣 *TIM PENGKHIANAT & NETRAL*\n` +
      `• *CEPU (Traitor)* — Menyamar sebagai Warga, punya skill *Sabotase* (menggagalkan tugas selesai; 4x sabotase = Satpam langsung menang).\n` +
      `• *BADUT (Neutral - Mode Chaos)* — Menang sendirian jika berhasil memancing pemain lain mengusirnya saat Rapat Darurat!`
  },
  modes: {
    title: "⚙️ *PANDUAN 3/4 — MODE & FITUR*",
    body:
      `*Pilihan Mode Permainan (Diatur Host):*\n` +
      `• *CLASSIC* — Mode standar seimbang: Warga, Satpam, dan Cepu + Rapat Darurat aktif.\n` +
      `• *QUICK HUNT* — Petak umpet murni tanpa Cepu & tanpa Rapat Darurat. Cocok untuk ronde cepat!\n` +
      `• *CHAOS* — Kekacauan penuh! Peran spesial lengkap + kemunculan peran *Badut*.\n\n` +
      `*Fitur Lainnya:*\n` +
      `• *Bot Pengisi Otomatis:* Jika pemain kurang dari 6 orang, Host bisa mengaktifkan Bot agar lobi tetap ramai.\n` +
      `• *Kustomisasi Avatar & Koin:* Kumpulkan koin dari setiap ronde untuk membuka gaya rambut, baju, dan aksesoris baru.\n` +
      `• *Anti-Wallhack:* Pemain hanya melihat area dalam jarak pandang (*Line of Sight*)."
  },
  commands: {
    title: "⌨️ *PANDUAN 4/4 — DAFTAR COMMAND BOT*",
    body:
      `*Perintah Umum & Grup:*\n` +
      `• \`/start\` — Membuka menu utama & tombol masuk Mini App\n` +
      `• \`/play\` — Membuka lobi pendaftaran mabar di grup chat\n` +
      `• \`/join KODE\` — Bergabung ke room tertentu (contoh: \`/join MX7K2P\`)\n` +
      `• \`/leave\` — Batal ikut / keluar dari lobi grup\n` +
      `• \`/kick\` — Mengeluarkan pemain AFK (balas pesan pemain, khusus Host)\n` +
      `• \`/profile\` — Cek level, XP, koin, dan statistik kemenanganmu\n` +
      `• \`/rank\` — Menampilkan papan peringkat Top 10 pemain\n` +
      `• \`/help\` — Membuka buku panduan lengkap ini`
  }
};

function buildGuideKeyboard(activeKey) {
  const kb = new InlineKeyboard()
    .text(activeKey === "flow" ? "• Alur Main •" : "Alur Main", "guide_flow")
    .text(activeKey === "roles" ? "• Daftar Peran •" : "Daftar Peran", "guide_roles")
    .row()
    .text(activeKey === "modes" ? "• Mode & Fitur •" : "Mode & Fitur", "guide_modes")
    .text(activeKey === "commands" ? "• Command •" : "Command", "guide_commands");
  return kb;
}

function formatGuidePage(key = "flow") {
  const page = GUIDE_PAGES[key] || GUIDE_PAGES.flow;
  return `${page.title}\n━━━━━━━━━━━━━━━━━━━━━━\n\n${page.body}`;
}

function registerGuideHandlers(bot, webappUrl) {
  // Callback navigasi halaman panduan
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

  // Sambutan otomatis saat bot baru ditambahkan ke grup
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
