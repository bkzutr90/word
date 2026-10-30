const { SlashCommandBuilder } = require('discord.js');

module.exports = [
  new SlashCommandBuilder()
    .setName('main')
    .setDescription('Mulai game')
    .addStringOption((o) =>
      o.setName('jenis')
        .setDescription('Pilih game')
        .setRequired(true)
        .addChoices(
          { name: 'Sambung kata', value: 'sambung-kata' },
          { name: 'Tebak kata', value: 'tebak-kata' },
          { name: 'Tebak gambar', value: 'tebak-gambar' },
          { name: 'Susun kata', value: 'susun-kata' },
        ))
    .addStringOption((o) =>
      o.setName('kesulitan')
        .setDescription('Tingkat kesulitan (untuk game kata)')
        .addChoices(
          { name: 'Mudah', value: 'mudah' },
          { name: 'Sedang', value: 'sedang' },
          { name: 'Sulit', value: 'sulit' },
        ))
    .addIntegerOption((o) =>
      o.setName('level')
        .setDescription('Level tebak gambar (1-207)')
        .setMinValue(1)
        .setMaxValue(207))
    .toJSON(),

  new SlashCommandBuilder().setName('hint').setDescription('Pakai hint (1x per ronde)').toJSON(),
  new SlashCommandBuilder().setName('skor').setDescription('Lihat skor game saat ini').toJSON(),
  new SlashCommandBuilder().setName('stop').setDescription('Hentikan game').toJSON(),
  new SlashCommandBuilder()
    .setName('leaderboard')
    .setDescription('Lihat leaderboard server ini')
    .setDMPermission(false)
    .toJSON(),
  new SlashCommandBuilder().setName('top').setDescription('Lihat leaderboard global semua server').toJSON(),
];
