// Shared helpers for the Cloudflare Pages Functions (reader stats, the letter signup and the contact form).
// Data lives in the D1 database bound as DB (see wrangler.toml).
export async function ensureTables(db) {
  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY AUTOINCREMENT, day TEXT NOT NULL, t TEXT NOT NULL, p TEXT NOT NULL,
      ti TEXT, s TEXT, d TEXT, c TEXT, h TEXT, x TEXT, w TEXT)`),
    db.prepare(`CREATE INDEX IF NOT EXISTS events_day ON events(day)`),
    db.prepare(`CREATE TABLE IF NOT EXISTS subscribers (
      email TEXT PRIMARY KEY, created TEXT NOT NULL, page TEXT)`),
    db.prepare(`CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT, created TEXT NOT NULL, name TEXT, email TEXT NOT NULL,
      topic TEXT, message TEXT NOT NULL)`),
  ]);
}
