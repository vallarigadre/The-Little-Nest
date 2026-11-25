// The contact form at /contact/. Saves each message in D1 and sends the reader to /contact/thanks/.
// Messages show on the private /admin/ page (GET /api/contact with the admin password in the x-key header).
import { ensureTables } from "./_db.js";
import { onRequestGet as statsGate } from "./stats.js";

const EMAIL = /^[^\s@<>"]{1,64}@[^\s@<>"]{1,190}\.[a-z]{2,}$/i;
const clip = (v, n) => (v || "").toString().trim().slice(0, n);

export async function onRequestPost({ request, env }) {
  const done = new URL("/contact/thanks/", request.url);
  try {
    const form = await request.formData();
    if (clip(form.get("company"), 100)) return Response.redirect(done, 303); // honeypot for bots
    const email = clip(form.get("email"), 254).toLowerCase();
    const message = clip(form.get("message"), 5000);
    if (!EMAIL.test(email) || message.length < 2) return Response.redirect(new URL("/contact/?error=1#contact-form", request.url), 303);
    await ensureTables(env.DB);
    await env.DB.prepare(`INSERT INTO messages (created, name, email, topic, message) VALUES (?,?,?,?,?)`)
      .bind(new Date().toISOString(), clip(form.get("name"), 120), email, clip(form.get("topic"), 60), message).run();
  } catch (e) {
    console.error("contact failed", e);
  }
  return Response.redirect(done, 303);
}

export async function onRequestGet(ctx) {
  const gate = await statsGate(ctx);
  if (gate.status !== 200) return gate;
  const { results } = await ctx.env.DB.prepare(`SELECT id, created, name, email, topic, message FROM messages ORDER BY created DESC LIMIT 200`).all();
  return Response.json({ messages: results }, { headers: { "cache-control": "no-store" } });
}
