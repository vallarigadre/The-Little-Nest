// The Little Nest: static site builder.
// Reads posts/*.md and pages/*.md, writes a complete site to dist/.
// Run locally with `npm run build`. Netlify runs the same command on every deploy.

const fs = require("fs");
const CSS_VERSION = require("crypto").createHash("md5").update(require("fs").readFileSync(require("path").join(__dirname, "static/style.css"))).digest("hex").slice(0, 10);
const path = require("path");
const T_VERSION = require("crypto").createHash("md5").update(fs.readFileSync(path.join(__dirname, "static/t.js"))).digest("hex").slice(0, 10);
const matter = require("gray-matter");
const { marked } = require("marked");

const ROOT = __dirname;
const OUT = path.join(ROOT, "dist");
const site = JSON.parse(fs.readFileSync(path.join(ROOT, "site.config.json"), "utf8"));
const SITE_URL = site.url.replace(/\/$/, "");

marked.setOptions({ gfm: true });

// ---------- helpers ----------
const esc = (s = "") =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const slugify = (s) =>
  String(s).toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "")
    .replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);

const stripEmDashes = (s) => s.replace(/\s*—\s*/g, ", ");

function write(rel, html) {
  const file = path.join(OUT, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, html);
}

function formatDate(d) {
  return d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" });
}

function sectionFor(name) {
  const found = site.sections.find((s) => s.name.toLowerCase() === String(name || "").toLowerCase());
  return found || site.sections[0];
}

// Guess a section when a post file has no category in its front matter.
function guessSection(text) {
  const t = text.toLowerCase();
  const score = (words) => words.reduce((n, w) => n + (t.split(w).length - 1), 0);
  const school = score(["tot school", "preschool", "letter", "alphabet", "counting", "lesson", "learning", "printable", "worksheet", "homeschool"]);
  const meals = score(["snack", "meal", "lunch", "breakfast", "recipe", "picky", "food", "dinner", "bite"]);
  const mom = score(["routine", "mom", "motherhood", "self-care", "sleep", "bedtime", "discipline", "gentle"]);
  const play = score(["play", "activity", "activities", "toy", "sensory", "craft", "busy", "gift", "montessori"]);
  const best = Math.max(school, meals, mom, play);
  if (best === school && school > 0) return "Tot School";
  if (best === meals && meals > 0) return "Meals";
  if (best === mom && mom > 0) return "Motherhood";
  return "Play";
}

// Clean up a raw file from the scheduled task if it was dropped in as is:
// remove the private "Editor notes" block and pull the title from the first H1.
function cleanRawMarkdown(body) {
  let b = body.replace(/\r\n/g, "\n");
  b = b.replace(/^#{1,3}[^\n]*editor notes[\s\S]*?(?=^---\s*$|^#\s)/im, "");
  b = b.replace(/^---\s*\n/, "");
  return b.trim();
}

// Tag Amazon links, mark them sponsored, and open outside links in a new tab.
function processLinks(html) {
  return html.replace(/<a href="([^"]+)"([^>]*)>/g, (m, href, rest) => {
    let url = href.replace(/&amp;/g, "&");
    const isAmazon = /^https?:\/\/(www\.)?(amazon\.com|amzn\.to|a\.co|link\.amazon)\//i.test(url);
    if (isAmazon && /amazon\.com/i.test(url) && site.amazonTag) {
      if (/[?&]tag=/.test(url)) url = url.replace(/([?&])tag=[^&#]*/, "$1tag=" + site.amazonTag);
      else url += (url.includes("?") ? "&" : "?") + "tag=" + site.amazonTag;
    }
    const external = /^https?:\/\//i.test(url) && !url.startsWith(SITE_URL);
    let attrs = "";
    if (isAmazon) attrs = ' rel="sponsored nofollow noopener" target="_blank" class="shop-link"';
    else if (external) attrs = ' rel="noopener" target="_blank"';
    return `<a href="${esc(url)}"${rest}${attrs}>`;
  });
}

// In-story photos: show the ones that exist in static/images, hide the rest until uploaded.
function inlinePhotos(html) {
  return html.replace(/<p>\s*<img src="(\/images\/[^"]+)" alt="([^"]*)"[^>]*>\s*<\/p>/g, (m, src, alt) =>
    fs.existsSync(path.join(ROOT, "static", src))
      ? `<figure class="story-photo"><img src="${src}" alt="${alt}" loading="lazy"></figure>`
      : "");
}

// ---------- load posts ----------
function loadPosts() {
  const dir = path.join(ROOT, "posts");
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter((f) => f.endsWith(".md") && !f.startsWith("_"))
    .map((file) => {
      const raw = fs.readFileSync(path.join(dir, file), "utf8");
      const { data, content } = matter(raw);
      let body = cleanRawMarkdown(content);

      let title = data.title;
      if (!title) {
        const h1 = body.match(/^#\s+(.+)$/m);
        if (h1) { title = h1[1].trim(); body = body.replace(h1[0], "").trim(); }
      }
      // A post that repeats its title as an H1 at the top: drop the duplicate.
      if (title) body = body.replace(new RegExp("^#\\s+" + title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\s*\\n"), "");

      const fileDate = file.match(/(\d{4}-\d{2}-\d{2})/);
      const date = data.date instanceof Date ? data.date : new Date(data.date ? String(data.date).slice(0, 10) : fileDate ? fileDate[1] : Date.now());

      const fileSlug = file.replace(/\.md$/, "").replace(/^blog-/, "").replace(/^\d{4}-\d{2}-\d{2}-/, "");
      const slug = data.slug || fileSlug || slugify(title);
      const section = sectionFor(data.category || guessSection(body));

      body = stripEmDashes(body);
      const html = inlinePhotos(processLinks(marked.parse(body)))
        .replace(/^\s*<p><em>([^<]*Amazon Associate[^<]*)<\/em><\/p>/i, '<p class="disclosure">$1</p>');
      const text = html.replace(/<[^>]+>/g, " ");
      const words = text.split(/\s+/).filter(Boolean).length;
      const firstPara = (html.match(/<p>([\s\S]*?)<\/p>/) || [, ""])[1].replace(/<[^>]+>/g, "");

      return {
        file, slug, title: stripEmDashes(title || slug), date,
        subtitle: data.subtitle ? stripEmDashes(data.subtitle) : "",
        description: stripEmDashes(data.description || firstPara.slice(0, 155)),
        section, tags: data.tags || [], cover: data.cover || "", coverAlt: data.cover_alt || "",
        pinTitle: data.pin_title || "", pinDescription: data.pin_description || "",
        draft: data.draft === true,
        hasDisclosure: /amazon associate/i.test(body),
        hasShopLinks: /class="shop-link"/.test(html),
        readMinutes: Math.max(3, Math.round(words / 230)),
        html, url: `/posts/${slug}/`,
      };
    })
    .sort((a, b) => b.date - a.date);
}

function loadPages() {
  const dir = path.join(ROOT, "pages");
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((f) => f.endsWith(".md")).map((file) => {
    const { data, content } = matter(fs.readFileSync(path.join(dir, file), "utf8"));
    const slug = data.slug || file.replace(/\.md$/, "");
    return { slug, title: data.title || slug, description: data.description || "", html: processLinks(marked.parse(stripEmDashes(content))) };
  });
}

// ---------- pieces ----------
const motifs = {
  "tot-school": `<svg viewBox="0 0 160 160" aria-hidden="true"><path d="M20 140V60l60-40 60 40v80z"/><path d="M60 140v-40h40v40M20 60h120"/></svg>`,
  play: `<svg viewBox="0 0 160 160" aria-hidden="true"><circle cx="80" cy="80" r="62"/><path d="M18 80h124M80 18c-26 30-26 94 0 124M80 18c26 30 26 94 0 124"/></svg>`,
  meals: `<svg viewBox="0 0 160 120" aria-hidden="true"><path d="M10 50h140a70 60 0 0 1-140 0z"/><path d="M60 40c0-12 10-12 10-24M90 40c0-12 10-12 10-24"/></svg>`,
  motherhood: `<svg viewBox="0 0 160 160" aria-hidden="true"><path d="M80 140C30 105 15 80 15 55a32 32 0 0 1 65-12 32 32 0 0 1 65 12c0 25-15 50-65 85z"/></svg>`,
};

function cover(post, size = "md") {
  const s = post.section.slug;
  const coverReady = post.cover && (!post.cover.startsWith("/") || fs.existsSync(path.join(ROOT, "static", post.cover)));
  if (coverReady) {
    return `<div class="cover cover--${size} cover--photo"><img src="${esc(post.cover)}" alt="${esc(post.coverAlt || post.title)}" loading="${size === "lg" ? "eager" : "lazy"}"></div>`;
  }
  return `<div class="cover cover--${size} cover--${s}" aria-hidden="true">
    <span class="cover__section">${esc(post.section.name)}</span>
    <span class="cover__motif">${motifs[s] || motifs.play}</span>
    <span class="cover__title">${esc(post.title)}</span>
  </div>`;
}

function meta(post) {
  return `<p class="meta"><time datetime="${post.date.toISOString().slice(0, 10)}">${formatDate(post.date)}</time>, in <a href="/${post.section.slug}/">${esc(post.section.name)}</a>, ${post.readMinutes} min read</p>`;
}

function card(post) {
  return `<article class="card">
    <a class="card__link" href="${post.url}">${cover(post, "sm")}
      <h3 class="card__title">${esc(post.title)}</h3></a>
    <p class="card__dek">${esc(post.subtitle || post.description)}</p>
    ${meta(post)}
  </article>`;
}

const newsletter = `<section class="letter" aria-labelledby="letter-h">
  <div class="letter__inner">
    <p class="kicker">Sign up for Nest Notes</p>
    <h2 id="letter-h">Calm ideas in your inbox, every Sunday</h2>
    <p>The week's new ideas, a free printable now and then, and the few finds we actually use. One short letter, never spam.</p>
    <form name="newsletter" method="POST" action="/thanks/" data-netlify="true" netlify-honeypot="company" class="letter__form">
      <input type="hidden" name="form-name" value="newsletter">
      <p class="hp"><label>Company <input name="company"></label></p>
      <label for="email" class="sr">Email address</label>
      <input id="email" type="email" name="email" placeholder="you@example.com" required autocomplete="email">
      <button type="submit">Sign me up</button>
    </form>
  </div>
</section>`;

const PREVIEW = {};
function layout({ title, description, body, path: pagePath = "/", image = "", imageAlt = "", type = "website", jsonld = "", noindex = false, published = null, tags = [] }) {
  if (!noindex) PREVIEW[pagePath] = { title: title || site.name, body };
  if (image && image.startsWith("/")) image = SITE_URL + image;
  const fullTitle = title ? `${title} | ${site.name}` : `${site.name}: ${site.tagline}`;
  const canonical = SITE_URL + pagePath;
  const nav = site.sections.map((s) => `<a href="/${s.slug}/"${pagePath.startsWith("/" + s.slug + "/") ? ' aria-current="page"' : ""}>${s.name}</a>`).join("");
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(fullTitle)}</title>
<meta name="description" content="${esc(description || site.description)}">
${noindex ? '<meta name="robots" content="noindex, nofollow">' : ""}
<link rel="canonical" href="${canonical}">
<meta property="og:site_name" content="${esc(site.name)}">
<meta property="og:title" content="${esc(title || site.name)}">
<meta property="og:description" content="${esc(description || site.description)}">
<meta property="og:type" content="${type}">
<meta property="og:url" content="${canonical}">
${image ? `<meta property="og:image" content="${esc(image)}">` : ""}
${image && imageAlt ? `<meta property="og:image:alt" content="${esc(imageAlt)}">` : ""}
<meta property="og:locale" content="en_US">
${published ? `<meta property="article:published_time" content="${published.toISOString()}">\n<meta property="article:author" content="${esc(site.author)}">` : ""}
${tags.map((t) => `<meta property="article:tag" content="${esc(t)}">`).join("\n")}
<meta name="twitter:card" content="${image ? "summary_large_image" : "summary"}">
<meta name="twitter:title" content="${esc(title || site.name)}">
<meta name="twitter:description" content="${esc(description || site.description)}">
${image ? `<meta name="twitter:image" content="${esc(image)}">` : ""}
${noindex ? "" : '<meta name="robots" content="index, follow, max-image-preview:large">'}
${site.googleSiteVerification ? `<meta name="google-site-verification" content="${esc(site.googleSiteVerification)}">` : ""}
${site.pinterestVerification ? `<meta name="p:domain_verify" content="${esc(site.pinterestVerification)}">` : ""}
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="alternate" type="application/rss+xml" title="${esc(site.name)}" href="/rss.xml">
<link rel="preload" href="/fonts/josefin-sans-latin-300-normal.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="/fonts/nunito-sans-latin-wght-normal.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="/style.css?v=${CSS_VERSION}">
${jsonld}
${/^G-[A-Z0-9]+$/.test(site.googleAnalyticsId || "") ? `<script async src="https://www.googletagmanager.com/gtag/js?id=${site.googleAnalyticsId}"></script>
<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag("js",new Date());gtag("config","${site.googleAnalyticsId}");
document.addEventListener("click",function(e){var a=e.target.closest&&e.target.closest("a.shop-link");if(a)gtag("event","affiliate_click",{link_url:a.href,link_text:(a.textContent||"").trim().slice(0,100)});});</script>` : ""}
${noindex ? "" : `<script defer src="/t.js?v=${T_VERSION}"></script>`}
${site.cloudflareAnalyticsToken ? `<script defer src="https://static.cloudflareinsights.com/beacon.min.js" data-cf-beacon='{"token": "${esc(site.cloudflareAnalyticsToken)}"}'></script>` : ""}
</head>
<body>
<a class="skip" href="#main">Skip to content</a>
<header class="masthead">
  <div class="masthead__inner">
    <a class="wordmark" href="/"><svg class="wordmark__mark" viewBox="0 0 40 40" aria-hidden="true"><path d="M5 22c4 9 26 9 30 0" /><path d="M8 24c5 5 19 5 24 0M11 27c4 3 14 3 18 0"/><circle cx="16" cy="18" r="3.4"/><circle cx="23" cy="17" r="3.4"/></svg><span>${esc(site.name)}</span></a>
    <nav class="nav" aria-label="Sections">${nav}<a href="/about/"${pagePath === "/about/" ? ' aria-current="page"' : ""}>About</a></nav>
  </div>
</header>
<main id="main">
${body}
</main>
<footer class="foot">
  <div class="foot__inner">
    <div>
      <p class="wordmark wordmark--small">${esc(site.name)}</p>
      <p class="foot__tag">${esc(site.tagline)}</p>
    </div>
    <nav aria-label="Site">
      ${site.sections.map((s) => `<a href="/${s.slug}/">${s.name}</a>`).join("")}
      <a href="/archive/">All stories</a>
      <a href="/about/">About</a>
      <a href="/disclosure/">Affiliate disclosure</a>
      <a href="/privacy/">Privacy</a>
      <a href="/rss.xml">RSS</a>
    </nav>
    <p class="foot__fine">As an Amazon Associate I earn from qualifying purchases. &copy; ${new Date().getFullYear()} ${esc(site.name)}</p>
  </div>
</footer>
</body>
</html>`;
}

// ---------- pages ----------
function mini(post) {
  return `<article class="mini">
    <a class="mini__link" href="${post.url}">${cover(post, "sm")}<span class="mini__text"><span class="mini__section mini__section--${post.section.slug}">${esc(post.section.name)}</span><span class="mini__title">${esc(post.title)}</span></span></a>
  </article>`;
}

function homePage(posts) {
  const img = (f) => fs.existsSync(path.join(ROOT, "static/images", f));
  const latest = posts.slice(0, 6);
  const heroImg = img("hero.jpg")
    ? `<img src="/images/hero.jpg" alt="${esc(site.heroAlt)}" fetchpriority="high">`
    : `<div class="ph ph--sage" aria-hidden="true">${motifs.play}</div>`;
  const aboutImg = img("about.jpg")
    ? `<img src="/images/about.jpg" alt="A cozy reading nook with picture books, a knit blanket and wooden toys" loading="lazy">`
    : `<div class="ph ph--oat" aria-hidden="true">${motifs.motherhood}</div>`;

  const hero = `<section class="hero wrap" aria-labelledby="hero-h">
  <div class="hero__text">
    <h1 id="hero-h" class="hero__title"><span>Slow, screen-free</span><strong>Toddler days</strong><span>at home</span></h1>
    <p class="hero__lede">Simple tot school ideas, calm play and easy routines for moms of little ones aged 1 to 4. Fifteen minutes at a time.</p>
    <div class="hero__actions">
      <a class="btn btn--peach" href="/tot-school/">Start with tot school</a>
      <a class="btn btn--line" href="#letter-h">Get Nest Notes</a>
    </div>
  </div>
  <div class="hero__media"><div class="hero__frame">${heroImg}</div></div>
</section>`;

  const welcome = `<section class="welcome wrap narrow">
  <p>Welcome to The Little Nest, a cozy corner of the internet for slower toddler days.</p>
  <p>Here you will find gentle tot school rhythms, screen-free play ideas that use what you already have, easy toddler meals and the few things worth buying. No pressure, no perfect playrooms, just small moments that add up.</p>
  <blockquote class="quote"><span aria-hidden="true">&ldquo;</span>Little hands, slow days,<br>and a lot of growing.</blockquote>
</section>`;

  const meet = `<section class="meet wrap">
  <div class="meet__img">${aboutImg}</div>
  <div class="meet__card">
    <h2>Hi, I'm Vallari</h2>
    <p class="meet__role">Mom, maker, tot school fan</p>
    <hr>
    <p>I'm raising a busy toddler and sharing the simple ideas that make our days calmer: what we play, what we eat, and the few things that actually earn their place in our home.</p>
    <a class="btn btn--light" href="/about/">Read my story</a>
  </div>
</section>`;

  const sections = `<section class="topics wrap" aria-labelledby="topics-h">
  <p class="kicker">Learn how to</p>
  <h2 id="topics-h" class="h-sec">Explore the nest</h2>
  <div class="topics__grid">${site.sections.map((s) => {
    const f = [`section-${s.slug}.jpg`, s.image].filter(Boolean).find(img);
    return `<a class="topic" href="/${s.slug}/">
      <span class="topic__img">${f ? `<img src="/images/${f}" alt="" loading="lazy">` : `<span class="ph ph--${s.slug}" aria-hidden="true">${motifs[s.slug] || motifs.play}</span>`}</span>
      <span class="topic__name">${s.name}</span>
      <span class="topic__blurb">${esc(s.blurb)}</span>
    </a>`;
  }).join("")}</div>
</section>`;

  const blog = !latest.length ? "" : `<section class="latest wrap" aria-labelledby="latest-h">
  <p class="kicker">Fresh from the blog</p>
  <h2 id="latest-h" class="h-sec">Latest ideas</h2>
  <div class="grid">${latest.map(card).join("")}</div>
  ${posts.length > 6 ? `<p class="center"><a class="btn btn--line" href="/archive/">See every post</a></p>` : ""}
</section>`;

  const freebies = `<section class="free">
  <div class="free__inner wrap">
    <div class="free__item">
      <p class="kicker">Just for you</p>
      <h2 class="h-sec">Free printables</h2>
      <p>Busy book pages, tot school planners and activity cards. Join Nest Notes and get every new freebie first.</p>
      <a class="btn btn--sage" href="#letter-h">Get the freebies</a>
    </div>
    <div class="free__item free__item--peach">
      <p class="kicker">Coming soon</p>
      <h2 class="h-sec">The Christmas toddler activity book</h2>
      <p>25 cozy, print-at-home pages of tracing, matching and counting for little hands this holiday season.</p>
      <a class="btn btn--light" href="#letter-h">Tell me when it's ready</a>
    </div>
  </div>
</section>`;

  const body = `${hero}\n${welcome}\n${meet}\n${sections}\n${blog}\n${freebies}\n${newsletter}`;
  write("index.html", layout({ path: "/", body, description: site.description }));
}

function sectionPages(posts) {
  for (const s of site.sections) {
    const list = posts.filter((p) => p.section.slug === s.slug);
    const body = `<section class="wrap listing">
      <header class="listing__head listing__head--${s.slug}"><h1>${s.name}</h1><p>${esc(s.blurb)}</p></header>
      ${list.length ? `<div class="grid">${list.map(card).join("")}</div>` : `<p class="empty-note">The first ${s.name.toLowerCase()} story is on its way. Meanwhile, <a href="/archive/">browse every story</a>.</p>`}
    </section>${newsletter}`;
    write(`${s.slug}/index.html`, layout({ title: s.name, description: s.blurb, path: `/${s.slug}/`, body }));
  }
}

function archivePage(posts) {
  const byMonth = {};
  posts.forEach((p) => {
    const k = p.date.toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
    (byMonth[k] = byMonth[k] || []).push(p);
  });
  const body = `<section class="wrap narrow archive"><h1>All stories</h1>
    ${Object.entries(byMonth).map(([m, list]) => `<h2>${m}</h2><ul>${list.map((p) => `<li><a href="${p.url}">${esc(p.title)}</a><span>${esc(p.section.name)}</span></li>`).join("")}</ul>`).join("") || "<p>No stories yet.</p>"}
  </section>`;
  write("archive/index.html", layout({ title: "All stories", path: "/archive/", body }));
}

function postPages(posts, drafts = []) {
  [...posts, ...drafts].forEach((post, i) => {
    const related = posts.filter((p) => p !== post && p.section.slug === post.section.slug).slice(0, 3);
    const more = related.length ? related : posts.filter((p) => p !== post).slice(0, 3);
    const pageUrl = SITE_URL + post.url;
    const coverAbs = post.cover ? (post.cover.startsWith("/") ? SITE_URL + post.cover : post.cover) : "";
    const pinText = post.pinDescription || post.description;
    const pinHref = `https://www.pinterest.com/pin/create/button/?url=${encodeURIComponent(pageUrl)}&description=${encodeURIComponent((post.pinTitle || post.title) + ". " + pinText)}${coverAbs ? "&media=" + encodeURIComponent(coverAbs) : ""}`;
    const disclosure = post.hasShopLinks && !post.hasDisclosure
      ? `<p class="disclosure">This post contains affiliate links. As an Amazon Associate I earn from qualifying purchases, at no extra cost to you. <a href="/disclosure/">Read the disclosure</a>.</p>` : "";

    const jsonld = `<script type="application/ld+json">${JSON.stringify({
      "@context": "https://schema.org", "@type": "BlogPosting", headline: post.title, description: post.description,
      datePublished: post.date.toISOString(), dateModified: post.date.toISOString(), author: { "@type": "Person", name: site.author, url: SITE_URL + "/about/" },
      publisher: { "@type": "Organization", name: site.name, url: SITE_URL + "/", logo: { "@type": "ImageObject", url: SITE_URL + "/favicon.svg" } },
      mainEntityOfPage: { "@type": "WebPage", "@id": pageUrl }, url: pageUrl, articleSection: post.section.name,
      ...(post.tags.length ? { keywords: post.tags.join(", ") } : {}), ...(coverAbs ? { image: [coverAbs] } : {}),
    })}</script>`;

    const banner = post.draft ? `<div class="draft-banner wrap">Draft preview: only people with this link can see it. It is not on the home page, the section pages or Google yet.</div>` : "";
    const body = `${banner}<article class="post">
  <header class="post__head wrap">
    <a class="post__section post__section--${post.section.slug}" href="/${post.section.slug}/">${esc(post.section.name)}</a>
    <h1>${esc(post.title)}</h1>
    ${post.subtitle ? `<p class="post__dek">${esc(post.subtitle)}</p>` : ""}
    <p class="meta">By ${esc(site.author)}. <time datetime="${post.date.toISOString().slice(0, 10)}">${formatDate(post.date)}</time>, ${post.readMinutes} min read</p>
  </header>
  <div class="post__cover wrap">${cover(post, "lg")}</div>
  <div class="prose">
    ${disclosure}
    ${post.html}
  </div>
  <footer class="post__foot prose">
    ${post.tags.length ? `<p class="tags">${post.tags.map((t) => `<span>${esc(t)}</span>`).join("")}</p>` : ""}
    <a class="button button--ghost" href="${pinHref}" target="_blank" rel="noopener">Save this story to Pinterest</a>
  </footer>
</article>
${more.length ? `<section class="wrap recent" aria-labelledby="more-h"><h2 id="more-h" class="rule-h">Keep reading</h2><div class="grid">${more.map(card).join("")}</div></section>` : ""}
${newsletter}`;
    write(`posts/${post.slug}/index.html`, layout({ title: post.title, description: post.description, path: post.url, body, image: post.cover, imageAlt: post.coverAlt, type: "article", jsonld, noindex: post.draft, published: post.date, tags: post.tags }));
  });
}

function staticPages(pages) {
  pages.forEach((pg) => {
    const body = `<article class="post"><header class="post__head wrap"><h1>${esc(pg.title)}</h1></header><div class="prose">${pg.html}</div></article>`;
    write(`${pg.slug}/index.html`, layout({ title: pg.title, description: pg.description, path: `/${pg.slug}/`, body }));
  });
  write("thanks/index.html", layout({ title: "You're on the list", path: "/thanks/", body: `<section class="wrap narrow empty"><h1>You're on the list</h1><p>The next Sunday letter will land in your inbox. Until then, <a href="/">read the latest story</a>.</p></section>` }));
  write("404.html", layout({ title: "Page not found", path: "/404/", body: `<section class="wrap narrow empty"><h1>This page has moved or never existed</h1><p>Try the <a href="/archive/">full list of stories</a> or head back to the <a href="/">front page</a>.</p></section>` }));
}

function feeds(posts, pages) {
  const items = posts.slice(0, 30).map((p) => `<item><title>${esc(p.title)}</title><link>${SITE_URL}${p.url}</link><guid>${SITE_URL}${p.url}</guid><pubDate>${p.date.toUTCString()}</pubDate><category>${esc(p.section.name)}</category><description>${esc(p.description)}</description></item>`).join("");
  write("rss.xml", `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>${esc(site.name)}</title><link>${SITE_URL}/</link><description>${esc(site.description)}</description><language>en-us</language>${items}</channel></rss>`);
  const day = (d) => d.toISOString().slice(0, 10);
  const latest = posts.length ? day(posts[0].date) : "";
  const urls = [
    ...["/", "/archive/", ...site.sections.map((s) => `/${s.slug}/`)].map((u) => ({ u, lastmod: latest })),
    ...pages.map((p) => ({ u: `/${p.slug}/` })),
    ...posts.map((p) => ({ u: p.url, lastmod: day(p.date), img: p.cover && fs.existsSync(path.join(ROOT, "static", p.cover)) ? SITE_URL + p.cover : "" })),
  ];
  write("sitemap.xml", `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">${urls.map(({ u, lastmod, img }) => `<url><loc>${SITE_URL}${u}</loc>${lastmod ? `<lastmod>${lastmod}</lastmod>` : ""}${img ? `<image:image><image:loc>${esc(img)}</image:loc></image:image>` : ""}</url>`).join("")}</urlset>`);
  write("robots.txt", `User-agent: *\nAllow: /\nDisallow: /admin/\nSitemap: ${SITE_URL}/sitemap.xml\n`);
}

// ---------- one-file preview (for reviewing the design inside Claude) ----------
function buildPreview() {
  const css = fs.readFileSync(path.join(ROOT, "static/style.css"), "utf8");
  const imgCache = {};
  const dataUri = (src) => {
    if (imgCache[src] !== undefined) return imgCache[src];
    const f = path.join(ROOT, "static", src);
    imgCache[src] = fs.existsSync(f) ? `data:image/${src.endsWith(".png") ? "png" : "jpeg"};base64,${fs.readFileSync(f).toString("base64")}` : "";
    return imgCache[src];
  };
  const fix = (html) => html
    .replace(/src="\/(images\/[^"]+)"/g, (m, src) => `src="${src}"`)
    .replace(/href="\/([^"]*)"/g, (m, rest) => /\.(xml|svg)$/.test(rest) ? `href="#/"` : `href="#/${rest}"`)
    .replace(/<form name="newsletter"[^>]*>/g, '<form class="letter__form" data-preview-form>');
  const sample = layout({ path: "/__shell__/", body: "@@BODY@@" });
  delete PREVIEW["/__shell__/"];
  const header = sample.slice(sample.indexOf('<header class="masthead">'), sample.indexOf('<main id="main">'));
  const footer = sample.slice(sample.indexOf('<footer class="foot">'), sample.indexOf("</body>"));
  const sections = Object.entries(PREVIEW).filter(([r]) => r !== "/404/")
    .map(([route, pg]) => `<section class="pv-page" data-route="${route}" data-title="${esc(pg.title)}" hidden>${fix(pg.body)}</section>`).join("\n");
  const html = `<title>${esc(site.name)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Josefin+Sans:wght@300;400;600;700&family=Nunito+Sans:opsz,wght@6..12,400;6..12,600;6..12,700&family=Courier+Prime:ital@0;1&display=swap" rel="stylesheet">
<style>${css}
.pv-banner{font:500 .85rem/1.4 var(--sans);background:var(--forest);color:var(--linen);text-align:center;padding:.55rem 1rem}
</style>
<div class="pv-banner">Design preview of ${esc(site.name)}. Every link works, so click around as a reader would.</div>
${fix(header)}
<main id="main">${sections}</main>
${fix(footer)}
<script>
(function(){
  var pages=[].slice.call(document.querySelectorAll('.pv-page'));
  function show(){
    var r=(location.hash||'#/').slice(1)||'/'; if(r.charAt(r.length-1)!=='/') r+='/';
    var hit=pages.filter(function(p){return p.dataset.route===r})[0]||pages.filter(function(p){return p.dataset.route==='/'})[0];
    pages.forEach(function(p){p.hidden=p!==hit});
    document.querySelectorAll('.nav a').forEach(function(a){
      var t=a.getAttribute('href').slice(1); if(r.indexOf(t)===0&&t!=='/') a.setAttribute('aria-current','page'); else a.removeAttribute('aria-current');});
    window.scrollTo(0,0);
  }
  window.addEventListener('hashchange',show); show();
  document.addEventListener('submit',function(e){
    if(!e.target.matches('[data-preview-form]'))return; e.preventDefault();
    e.target.innerHTML='<p class="letter__done">You\\'re on the list. On the live site this saves the email in Netlify.</p>';});
})();
</script>`;
  fs.mkdirSync(path.join(ROOT, "preview"), { recursive: true });
  fs.writeFileSync(path.join(ROOT, "preview/index.html"), html);
}

// ---------- run ----------
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
fs.cpSync(path.join(ROOT, "static"), OUT, { recursive: true });

// Drafts (draft: true) get a private preview page but stay off every list, the sitemap and RSS.
const allPosts = loadPosts();
const drafts = allPosts.filter((p) => p.draft);
const posts = allPosts.filter((p) => !p.draft && p.date <= new Date(Date.now() + 864e5));
const pages = loadPages();
homePage(posts);
sectionPages(posts);
archivePage(posts);
postPages(posts, drafts);
staticPages(pages);
feeds(posts, pages);

buildPreview();
console.log(`Built ${posts.length} post(s), ${drafts.length} draft preview(s) and ${pages.length} page(s) into dist/`);
