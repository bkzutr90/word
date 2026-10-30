const axios = require('axios');
const cheerio = require('cheerio');

const ABS_URL = 'https://jawabantebakgambar.net';
const REL_URL = '/all-answers/';
const TOTAL_LEVELS = 207;

let cache = null;
let loading = null;

async function loadCache() {
  if (cache) return cache;
  if (!loading) {
    loading = (async () => {
      const { data } = await axios.get(ABS_URL + REL_URL, { timeout: 15000 });
      const $ = cheerio.load(data);
      const list = [];

      $('#container > .content > #images > li:not(.clearleft)').each((_, el) => {
        const src = $(el).find('img').attr('data-src');
        const answer = $(el).find('span').first().text().trim();
        if (src && answer) {
          list.push({ soal: new URL(src, ABS_URL).href, jawaban: answer });
        }
      });

      cache = list;
      return list;
    })().catch((err) => {
      loading = null; // izinkan retry jika gagal
      throw err;
    });
  }
  return loading;
}

/**
 * Ambil soal acak dari level tertentu (1-207).
 * Asumsi: soal dibagi rata ke 207 level secara berurutan.
 */
async function randomQuestion(level) {
  const list = await loadCache();
  if (!list.length) throw new Error('Data tebak gambar kosong');
  const lv = Math.min(Math.max(level, 1), TOTAL_LEVELS);
  const per = Math.ceil(list.length / TOTAL_LEVELS);
  const start = (lv - 1) * per;
  const end = Math.min(start + per, list.length);
  return list[start + Math.floor(Math.random() * (end - start))];
}

module.exports = { randomQuestion };
