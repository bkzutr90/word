const { EmbedBuilder } = require('discord.js');
const db = require('./db');

const MEDALS = ['🥇', '🥈', '🥉'];

function formatRows(rows) {
  if (!rows.length) return 'Belum ada data. Mainkan game dulu dengan /main!';
  return rows
    .map((r, k) => `${MEDALS[k] ?? `${k + 1}.`} <@${r.user_id}> — ${r.points} poin (${r.games} game)`)
    .join('\n');
}

// /leaderboard: top 10 di server ini
async function serverBoard(i) {
  const rows = db.topGuild(i.guildId, 10);
  const embed = new EmbedBuilder()
    .setTitle(`🏆 Leaderboard ${i.guild.name}`)
    .setDescription(formatRows(rows))
    .setFooter({ text: 'Skor terkumpul dari semua game di server ini' });
  return i.reply({ embeds: [embed] });
}

// /top: top 10 lintas semua server
async function globalBoard(i) {
  const rows = db.topGlobal(10);
  const embed = new EmbedBuilder()
    .setTitle('🌍 Leaderboard Global Kataverse')
    .setDescription(formatRows(rows))
    .setFooter({ text: 'Skor dari semua server yang memakai Kataverse' });
  return i.reply({ embeds: [embed] });
}

module.exports = { serverBoard, globalBoard };
