const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const fs = require('fs');

const dir = path.join(__dirname, '..', 'data');
fs.mkdirSync(dir, { recursive: true });

const db = new DatabaseSync(path.join(dir, 'kataverse.db'));
db.exec('PRAGMA journal_mode = WAL;');

db.exec(`
  CREATE TABLE IF NOT EXISTS scores (
    guild_id TEXT NOT NULL,
    user_id  TEXT NOT NULL,
    points   INTEGER NOT NULL DEFAULT 0,
    games    INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (guild_id, user_id)
  )
`);

const upsert = db.prepare(`
  INSERT INTO scores (guild_id, user_id, points, games) VALUES (?, ?, ?, 1)
  ON CONFLICT(guild_id, user_id) DO UPDATE SET
    points = points + excluded.points,
    games  = games + 1
`);

const topGuildStmt = db.prepare(`
  SELECT user_id, points, games FROM scores
  WHERE guild_id = ? ORDER BY points DESC, games DESC LIMIT ?
`);

const topGlobalStmt = db.prepare(`
  SELECT user_id, SUM(points) AS points, SUM(games) AS games FROM scores
  GROUP BY user_id ORDER BY points DESC, games DESC LIMIT ?
`);

// Simpan skor satu game dalam satu transaksi. Hanya member yang mencetak poin.
function recordGame(guildId, scores) {
  const entries = [...scores.entries()].filter(([, p]) => p > 0);
  if (!entries.length) return;

  db.exec('BEGIN');
  try {
    for (const [userId, pts] of entries) upsert.run(guildId, userId, pts);
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

const topGuild = (guildId, limit = 10) => topGuildStmt.all(guildId, limit);
const topGlobal = (limit = 10) => topGlobalStmt.all(limit);

module.exports = { recordGame, topGuild, topGlobal };
