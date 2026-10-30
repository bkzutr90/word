require('dotenv').config();
const { Client, GatewayIntentBits, Events, REST, Routes } = require('discord.js');
const games = require('./games');
const kbbi = require('./kbbi');
const board = require('./leaderboard');
const commands = require('./command');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent, // wajib untuk membaca jawaban di chat
  ],
});

client.once(Events.ClientReady, async (c) => {
  console.log(`Login sebagai ${c.user.tag} — aktif di ${c.guilds.cache.size} server`);

  // Daftarkan slash command setiap bot start. Aman dijalankan berulang.
  try {
    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
    await rest.put(Routes.applicationCommands(c.user.id), { body: commands });
    console.log(`Slash command berhasil didaftarkan (${commands.length} command).`);
  } catch (err) {
    console.error('Gagal mendaftarkan slash command:', err);
  }
});

client.on(Events.InteractionCreate, async (i) => {
  if (!i.isChatInputCommand()) return;

  try {
    switch (i.commandName) {
      case 'main': return await games.startGame(i);
      case 'hint': return await games.useHint(i);
      case 'skor': return await games.showScore(i);
      case 'stop': return await games.stopGame(i);
      case 'leaderboard': return await board.serverBoard(i);
      case 'top': return await board.globalBoard(i);
    }
  } catch (err) {
    console.error(err);
    const payload = { content: 'Terjadi kesalahan.', ephemeral: true };
    if (i.replied || i.deferred) await i.followUp(payload).catch(() => {});
    else await i.reply(payload).catch(() => {});
  }
});

client.on(Events.MessageCreate, async (m) => {
  if (m.author.bot || !m.guild) return;
  try {
    await games.handleAnswer(m);
  } catch (err) {
    console.error(err);
  }
});

(async () => {
  try {
    await kbbi.load();
  } catch (err) {
    console.error('Gagal memuat KBBI:', err.message);
  }
  client.login(process.env.DISCORD_TOKEN);
})();
