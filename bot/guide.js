"use strict";

const { InlineKeyboard } = require("grammy");

function buildWelcomeText(firstName = "Pemain") {
  return [
    `🌃 *Halo, ${String(firstName)}! Selamat datang di Midnight Shift*`,
    "",
    "Gedung kantor sudah tutup, lampu mulai padam, dan shift malam baru saja dimulai...",
    "",
    "Main bareng *4–20 pemain* dalam game petak umpet & adu strategi:",
    "📦 *Menyamar* jadi galon, printer, cone, atau sofa",
    "🛠 *Selesaikan tugas* untuk membuka pintu darurat",
    "🔦 *Jadi Satpam* dan buru penyamar dengan senter",
    "🐍 *Jadi Cepu* dan sabotase tugas dari dalam!",
    "",
    "Tekan tombol di bawah untuk langsung main atau baca panduan singkatnya 👇"
  ].join("\n");
}

function buildGroupWelcomeText() {
  return [
    "🔦 *Midnight Shift siap dimainkan di grup ini!*",
    "",
    "Yuk mabar petak umpet & adu tuduh bareng satu grup:",
    "1️⃣ Ketik `/play` untuk membuka pendaftaran lobi",
    "2️⃣ Klik tombol *✋ IKUT MAIN* di kartu lobi (maks. 20 orang)",
    "3️⃣ Buka *Mini App* lalu Host menekan *🚀 MULAI GAME*",
    "",
    "Ketik `/help` kapan saja untuk melihat daftar peran & aturan main."
  ].join("\n");
}

const GUIDE_PAGES = {
  flow: {
    title: "📖 *1/4 · Alur Permainan*",
    body: [
      "*1. Fase Sembunyi (15 Detik)*",
      "Satpam tertahan di pos jaga. Warga & Cepu segera berpencar dan tekan *NYAMAR* untuk berubah jadi benda.",
      "",
      "*2. Fase Patroli & Tugas (4 Menit 30 Detik)*",
      "• *Warga:* Cari terminal berkedip dan selesaikan mini-game tugas.",
      "• *Satpam:* Patroli pakai senter dan pukul benda mencurigakan. Salah pukul benda asli = *Stun 1.5 detik*!",
      "• *Cepu:* Pura-pura jadi Warga sambil menyabotase tugas yang sudah beres.",
      "",
      "*3. Rapat Darurat*",
      "Tekan tombol merah di *Koridor Tengah* untuk voting mengusir pemain yang dicurigai.",
      "",
      "*4. Pintu Darurat Terbuka (35 Detik)*",
      "Setelah kuota tugas penuh, lari ke 2 pintu darurat di sisi kanan gedung sebelum waktu habis!"
    ].join("\n")
  },
  roles: {
    title: "🎭 *2/4 · Daftar Peran & Skill*",
    body: [
      "🟢 *TIM WARGA* _(Menang jika tugas selesai & berhasil kabur)_",
      "• *Warga:* Menyamar jadi benda & kerjakan tugas.",
      "• *Teknisi:* Tugas lebih cepat + *Radar* deteksi Satpam (6 detik).",
      "• *Penyusup:* Lari (*Sprint*) lebih cepat & cooldown singkat.",
      "• *Dokter:* *Sembuhkan* 1 nyawa rekan di dekatmu.",
      "",
      "🔴 *TIM SATPAM* _(Menang jika semua Warga tertangkap)_",
      "• *Satpam:* Senter jarak jauh & pentungan (2x pukul untuk menangkap).",
      "",
      "🟣 *PENGKHIANAT & NETRAL*",
      "• *Cepu:* Bisa *Sabotase* tugas (4x sabotase = Satpam menang).",
      "• *Badut (Mode Chaos):* Menang sendirian jika berhasil diusir saat voting!"
    ].join("\n")
  },
  modes: {
    title: "⚙️ *3/4 · Mode & Fitur*",
    body: [
      "*Pilihan Mode (Diatur Host):*",
      "• *Classic:* Mode standar (Warga, Satpam, Cepu + Rapat Darurat).",
      "• *Quick Hunt:* Petak umpet murni tanpa Cepu & tanpa voting.",
      "• *Chaos:* Semua peran spesial aktif + kemunculan *Badut*.",
      "",
      "*Fitur Tambahan:*",
      "• *Bot Pengisi:* Lobi otomatis diisi Bot jika pemain kurang dari 6 orang.",
      "• *Kustomisasi Avatar:* Kumpulkan koin untuk beli rambut, baju & aksesoris.",
      "• *Anti-Wallhack:* Jarak pandang realistis sesuai arah hadap (*Line of Sight*)."
    ].join("\n")
  },
  commands: {
    title: "⌨️ *4/4 · Daftar Command Bot*",
    body: [
      "• `/start` — Menu utama & tombol masuk game",
      "• `/play` — Buka pendaftaran mabar di grup",
      "• `/join KODE` — Gabung room pakai kode (misal: `/join MX7K2P`)",
      "• `/leave` — Batal ikut dari lobi grup",
      "• `/kick` — Keluarkan pemain (balas pesannya, khusus Host)",
      "• `/profile` — Cek level, XP, koin & statistikmu",
      "• `/rank` — Lihat Top 10 pemain terbaik",
      "• `/help` — Buka buku panduan ini"
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
  return `${page.title}\n\n${page.body}`;
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
