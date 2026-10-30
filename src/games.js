const { EmbedBuilder } = require('discord.js');
const kbbi = require('./kbbi');
const gambar = require('./gambar');
const db = require('./db');

const TOTAL_ROUNDS = 10;
const ROUND_MS = 45_000;
const SAMBUNG_MS = 30_000;

// Rentang panjang kata per tingkat kesulitan
const LENGTH = { mudah: [4, 5], sedang: [6, 7], sulit: [8, 30] };
const SAMBUNG_LENGTH = { mudah: [3, 5], sedang: [6, 8], sulit: [9, 30] };
const POINTS = { mudah: 1, sedang: 2, sulit: 3 };

// Satu game per channel
const games = new Map();

const norm = (s) => s.toLowerCase().replace(/[^a-z]/g, '');

// Placeholder tampilan. '_' dihindari karena Discord menganggapnya italic.
const display = (chars) => chars.map((c) => (c === '_' ? '◻' : c.toUpperCase())).join(' ');

function shuffle(word) {
  const a = [...word];
  do {
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
  } while (a.join('') === word && word.length > 1);
  return a.join('');
}

// Buka beberapa huruf secara acak sebagai petunjuk awal
function revealLetters(word, count) {
  const chars = Array(word.length).fill('_');
  const positions = Array.from({ length: word.length }, (_, k) => k)
    .sort(() => Math.random() - 0.5)
    .slice(0, count);
  for (const k of positions) chars[k] = word[k];
  return chars;
}

const clearTimer = (st) => {
  if (st.timer) clearTimeout(st.timer);
  st.timer = null;
};

const arm = (st, ms, fn) => {
  clearTimer(st);
  st.timer = setTimeout(() => {
    if (games.get(st.channelId) === st) fn();
  }, ms);
};

function scoreEmbed(st, title = '📊 Skor saat ini') {
  const rows = [...st.scores.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([id, p], k) => `${k + 1}. <@${id}> — ${p} poin`);
  return new EmbedBuilder()
    .setTitle(title)
    .setDescription(rows.join('\n') || 'Belum ada yang mencetak poin.')
    .setFooter({ text: `${st.jenis} · ronde ${st.round}/${TOTAL_ROUNDS}` });
}

// ---------- START ----------

async function startGame(i) {
  if (games.has(i.channelId)) {
    return i.reply({ content: 'Masih ada game berjalan di channel ini. Pakai /stop dulu.', ephemeral: true });
  }

  const jenis = i.options.getString('jenis');
  if (jenis !== 'tebak-gambar' && kbbi.count() === 0) {
    return i.reply({ content: 'Daftar kata KBBI belum dimuat. Coba lagi beberapa saat.', ephemeral: true });
  }

  const st = {
    channelId: i.channelId,
    guildId: i.guildId,
    jenis,
    kesulitan: i.options.getString('kesulitan') ?? 'mudah',
    level: i.options.getInteger('level') ?? 1,
    scores: new Map(),
    round: 0,
    answer: null,
    answerNorm: null,
    chars: null,
    hintUsed: false,
    timer: null,
    used: new Set(),
    lastWord: null,
    lastUser: null,
  };
  games.set(i.channelId, st);

  const extra = jenis === 'tebak-gambar' ? ` · Level ${st.level}` : '';
  await i.reply(`🎮 Game **${jenis}** dimulai! Kesulitan: **${st.kesulitan}**${extra}`);

  if (jenis === 'sambung-kata') return startSambung(i.channel, st);
  return nextRound(i.channel, st);
}

// ---------- SAMBUNG KATA ----------

async function startSambung(channel, st) {
  const w = kbbi.randomWord(SAMBUNG_LENGTH[st.kesulitan], st.used, null, st.kesulitan);
  if (!w) {
    games.delete(st.channelId);
    return channel.send('Tidak ada kata yang cocok untuk tingkat ini.');
  }
  st.used.add(w);
  st.lastWord = w;
  await channel.send(
    `Kata pembuka: **${w}**\nSambung dengan kata yang diawali huruf **${w.slice(-1).toUpperCase()}**. ` +
    `Waktu 30 detik per giliran.`
  );
  arm(st, SAMBUNG_MS, () => endGame(channel, st));
}

async function handleSambung(m, st, text) {
  // Hanya proses pesan berupa satu kata
  if (/\s/.test(m.content.trim()) || text.length < 2) return;

  const need = st.lastWord.slice(-1);
  if (text[0] !== need) return;

  const [min, max] = SAMBUNG_LENGTH[st.kesulitan];
  if (text.length < min || text.length > max) return m.react('📏').catch(() => {});
  if (!kbbi.has(text)) return m.react('❌').catch(() => {});
  if (st.used.has(text)) return m.react('🔁').catch(() => {});
  if (m.author.id === st.lastUser) return m.react('⏳').catch(() => {});

  st.used.add(text);
  st.lastWord = text;
  st.lastUser = m.author.id;
  st.hintUsed = false;
  st.scores.set(m.author.id, (st.scores.get(m.author.id) || 0) + POINTS[st.kesulitan]);

  await m.reply(`✅ **${text}** · lanjut huruf **${text.slice(-1).toUpperCase()}**`);
  arm(st, SAMBUNG_MS, () => endGame(m.channel, st));
}

// ---------- TEBAK KATA / SUSUN KATA / TEBAK GAMBAR ----------

async function nextRound(channel, st) {
  clearTimer(st);
  if (st.round >= TOTAL_ROUNDS) return endGame(channel, st);

  st.round++;
  st.hintUsed = false;
  st.answer = null;

  try {
    if (st.jenis === 'tebak-gambar') {
      const q = await gambar.randomQuestion(st.level);
      st.answer = q.jawaban;
      st.answerNorm = norm(q.jawaban);

      const embed = new EmbedBuilder()
        .setTitle(`Ronde ${st.round}/${TOTAL_ROUNDS} · Tebak Gambar`)
        .setDescription(`Ketik jawabanmu di chat! Jumlah huruf: ${st.answerNorm.length}`)
        .setImage(q.soal)
        .setFooter({ text: `Level ${st.level}` });
      await channel.send({ embeds: [embed] });
    } else {
      const word = kbbi.randomWord(LENGTH[st.kesulitan], st.used, null, st.kesulitan);
      if (!word) throw new Error('Kata habis untuk tingkat ini');

      st.used.add(word);
      st.answer = word;
      st.answerNorm = word;

      if (st.jenis === 'tebak-kata') {
        st.chars = revealLetters(word, Math.max(2, Math.floor(word.length / 3)));
        await channel.send(
          `Ronde ${st.round}/${TOTAL_ROUNDS} · Tebak kata\n\`${display(st.chars)}\` (${word.length} huruf)`
        );
      } else {
        await channel.send(
          `Ronde ${st.round}/${TOTAL_ROUNDS} · Susun kata\n**${shuffle(word)}** (${word.length} huruf)`
        );
      }
    }

    arm(st, ROUND_MS, () => timeoutRound(channel, st));
  } catch (err) {
    console.error(err);
    games.delete(st.channelId);
    await channel.send('⚠️ Gagal menyiapkan ronde. Game dihentikan.');
  }
}

async function timeoutRound(channel, st) {
  const ans = st.answer;
  st.answer = null;
  await channel.send(`⏰ Waktu habis! Jawabannya: **${ans}**`);
  await nextRound(channel, st);
}

async function handleAnswer(m) {
  const st = games.get(m.channelId);
  if (!st) return;

  const text = norm(m.content);
  if (!text) return;

  if (st.jenis === 'sambung-kata') return handleSambung(m, st, text);

  if (!st.answer || text !== st.answerNorm) return;

  const ans = st.answer;
  const pts = st.jenis === 'tebak-gambar' ? 1 : POINTS[st.kesulitan];
  st.answer = null; // cegah dua orang menjawab bersamaan
  clearTimer(st);

  st.scores.set(m.author.id, (st.scores.get(m.author.id) || 0) + pts);
  await m.reply(`✅ Benar! Jawabannya **${ans}**. ${m.author} +${pts} poin.`);
  await nextRound(m.channel, st);
}

// ---------- HINT (1x per ronde / giliran) ----------

async function useHint(i) {
  const st = games.get(i.channelId);
  if (!st) return i.reply({ content: 'Belum ada game berjalan.', ephemeral: true });
  if (st.hintUsed) return i.reply({ content: 'Hint sudah dipakai untuk ronde ini.', ephemeral: true });

  if (st.jenis === 'sambung-kata') {
    const need = st.lastWord.slice(-1);
    const w = kbbi.randomWord(SAMBUNG_LENGTH[st.kesulitan], st.used, need, st.kesulitan);
    if (!w) return i.reply({ content: 'Tidak ada contoh kata tersedia.', ephemeral: true });
    st.hintUsed = true;
    return i.reply(`💡 Contoh kata: **${w}**`);
  }

  if (!st.answer) return i.reply({ content: 'Tidak ada soal aktif.', ephemeral: true });
  st.hintUsed = true;

  if (st.jenis === 'tebak-kata') {
    const hidden = st.chars.map((c, k) => (c === '_' ? k : -1)).filter((k) => k >= 0);
    if (hidden.length) {
      const k = hidden[Math.floor(Math.random() * hidden.length)];
      st.chars[k] = st.answer[k];
    }
    return i.reply(`💡 Petunjuk: \`${display(st.chars)}\``);
  }

  if (st.jenis === 'susun-kata') {
    return i.reply(`💡 Huruf pertama: **${st.answer[0].toUpperCase()}**`);
  }

  // tebak-gambar
  return i.reply(`💡 Huruf pertama: **${st.answerNorm[0].toUpperCase()}** · ${st.answerNorm.length} huruf`);
}

// ---------- SKOR & STOP ----------

async function showScore(i) {
  const st = games.get(i.channelId);
  if (!st) return i.reply({ content: 'Tidak ada game berjalan.', ephemeral: true });
  return i.reply({ embeds: [scoreEmbed(st)] });
}

async function endGame(channel, st) {
  clearTimer(st);
  games.delete(st.channelId);
  try {
    db.recordGame(st.guildId, st.scores);
  } catch (err) {
    console.error('Gagal menyimpan skor:', err);
  }
  await channel.send({ embeds: [scoreEmbed(st, '🏁 Game selesai')] });
}

async function stopGame(i) {
  const st = games.get(i.channelId);
  if (!st) return i.reply({ content: 'Tidak ada game berjalan.', ephemeral: true });
  await i.reply('🛑 Game dihentikan.');
  return endGame(i.channel, st);
}

module.exports = { startGame, handleAnswer, useHint, showScore, stopGame };