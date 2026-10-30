const axios = require('axios');

const URL_KBBI = process.env.KBBI_URL ||
  'https://raw.githubusercontent.com/aryakdaniswara/kbbi-v6-wordlist/main/all_entries_v6.1.0.txt';
const URL_FREQ = process.env.FREQ_URL ||
  'https://raw.githubusercontent.com/hermitdave/FrequencyWords/master/content/2018/id/id_50k.txt';

const VALID = /^[a-z]+$/; // hanya huruf a-z, tanpa spasi, tanda baca, atau angka

let words = [];
let wordSet = new Set();
let commonSet = new Set();
const memo = new Map();

// Ambil hanya entri yang berupa satu kata murni
function parseKbbi(text) {
  const set = new Set();
  for (const line of text.split(/\r?\n/)) {
    const w = line.trim().toLowerCase();
    if (VALID.test(w) && w.length >= 3) set.add(w);
  }
  return set;
}

// Ambil kolom pertama dari file frekuensi ("kata jumlah")
function parseFreq(text) {
  const set = new Set();
  for (const line of text.split(/\r?\n/)) {
    const w = line.split(' ')[0].trim().toLowerCase();
    if (VALID.test(w)) set.add(w);
  }
  return set;
}

async function fetchText(url) {
  const { data } = await axios.get(url, { responseType: 'text', timeout: 30000 });
  return data;
}

async function load() {
  const [kbbiText, freqText] = await Promise.all([
    fetchText(URL_KBBI),
    fetchText(URL_FREQ).catch((err) => {
      console.warn('Frekuensi kata gagal dimuat, tingkat kesulitan memakai fallback:', err.message);
      return '';
    }),
  ]);

  wordSet = parseKbbi(kbbiText);
  words = [...wordSet];

  const freq = parseFreq(freqText);
  commonSet = new Set(words.filter((w) => freq.has(w)));

  memo.clear();
  console.log(`KBBI dimuat: ${words.length} kata (${commonSet.size} kata umum)`);
}

// Kumpulan kata sesuai rentang panjang dan tingkat kesulitan
function pool(min, max, tier) {
  const key = `${min}-${max}-${tier}`;
  if (!memo.has(key)) {
    const base = words.filter((w) => w.length >= min && w.length <= max);
    let list = base;
    if (tier === 'mudah') list = base.filter((w) => commonSet.has(w));
    else if (tier === 'sulit') list = base.filter((w) => !commonSet.has(w));
    if (!list.length) list = base; // fallback jika kumpulan kosong
    memo.set(key, list);
  }
  return memo.get(key);
}

/**
 * range     : [min, max] panjang kata
 * exclude   : Set kata yang sudah dipakai
 * startsWith: huruf awal (opsional, untuk sambung kata)
 * tier      : 'mudah' | 'sedang' | 'sulit' (opsional)
 */
function randomWord(range, exclude = new Set(), startsWith = null, tier = null) {
  const [min, max] = range;
  let list = pool(min, max, tier);
  if (startsWith) list = list.filter((w) => w.startsWith(startsWith));
  const free = list.filter((w) => !exclude.has(w));
  if (!free.length) return null;
  return free[Math.floor(Math.random() * free.length)];
}

module.exports = {
  load,
  has: (w) => wordSet.has(w),
  count: () => words.length,
  randomWord,
};
