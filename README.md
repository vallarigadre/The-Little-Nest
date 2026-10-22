# The Little Nest

A mom and toddler blog on tot school, screen-free play, toddler meals and slow motherhood, built as a fast static site for Netlify. Every post is a markdown file in the `posts/` folder.

## Put it online (one time, about 15 minutes)

1. **Create a GitHub repository.** Sign in at github.com, click New repository, name it `the-little-nest`, and create it.
2. **Upload the files.** On the new repo page, click "uploading an existing file", drag in everything from this folder (including the `posts`, `pages` and `static` folders), and commit.
3. **Connect Netlify.** In Netlify, choose Add new site, then Import an existing project, pick GitHub and the `the-little-nest` repo. Netlify reads `netlify.toml`, so the build settings fill themselves in. Click Deploy.
4. **Name the site.** In Site configuration, choose Change site name and enter `thelittlenest`. Your site is then at https://thelittlenest.netlify.app. If that name is taken, pick another and update `url` in `site.config.json` to match.
5. **Turn on the newsletter form.** In Netlify, open Forms and click Enable form detection, then redeploy once. Sign-ups appear under Forms, newsletter.
6. **Tell Amazon.** In Amazon Associates, go to Account settings, Edit your website list, and add the new site URL.

## Publish a new post (every Tuesday and Friday, automatic)

1. At 8:53 am IST the blog task writes the post and uploads it here as a draft (`draft: true`). The draft has its own preview page with a "Draft preview" banner, but it stays off the home page, section pages, sitemap, RSS and Google.
2. Photos: in a Claude desktop task on your laptop, attach the photos file and paste the photo request from the blog message. It makes the photos in ChatGPT with the built-in browser and uploads them to `static/images`.
3. Links: on the Link Swap page, paste a SiteStripe link for each product and press Publish. The "The Little Nest: publish post" task swaps the links, removes `draft: true` and pushes. The post is live a few minutes later.

You can still edit any post right on GitHub: open the file, click the pencil icon, change text or links, and commit.

Good to know:
- Amazon links without a tag get `creativedi03c-20` added automatically, and all Amazon links are marked as sponsored for Google.
- Em dashes are swapped for commas when the site builds.
- Posts dated in the future wait until their date.
- The homepage photo is `static/images/hero.jpg`. Replace it with any 1536 x 1024 JPG to change it.

## Post front matter

```yaml
---
title: "Post title"
subtitle: "One-line subtitle"
date: 2026-10-13
draft: true               # remove to publish
category: Hosting          # Tot School, Play, Meals or Motherhood
description: "Under 155 characters, used by Google and social shares"
tags: [fall decor, tablescape]
pin_title: "Optional Pinterest title"
pin_description: "Optional Pinterest description"
cover: "Optional image URL"   # leave out to use the colored cover
cover_alt: "Optional image description"
---
```

## Change site settings

`site.config.json` holds the name, tagline, site URL, author, Amazon tag and the four sections. `pages/` holds About, Affiliate disclosure and Privacy. `static/style.css` holds the design.

## Preview on your own computer (optional)

Install Node.js, then in this folder run `npm install` and `npm start`.

## See how many people read each post

The site is ready for Cloudflare Web Analytics, which is free and uses no cookies.

1. Create a free account at cloudflare.com and open Web Analytics.
2. Add a site, enter your Netlify address (for example thelittlenest.netlify.app), and choose the JavaScript snippet option.
3. Copy the token from the snippet. It is the long code after `"token":`.
4. Open `site.config.json` on GitHub, paste it between the quotes on the `cloudflareAnalyticsToken` line, and commit.

Netlify rebuilds the site and every page starts counting. Your numbers (page views, top posts, where readers came from, countries) appear in the Cloudflare dashboard.

### Google Analytics (GA4)

1. Go to analytics.google.com, create an account and a property for The Little Nest, then add a Web data stream with the address https://thelittlenest.netlify.app.
2. Copy the Measurement ID (it starts with `G-`).
3. Open `site.config.json` on GitHub, paste it between the quotes on the `googleAnalyticsId` line, and commit.

Every page starts reporting within a day. Clicks on Amazon links are also counted as an `affiliate_click` event, so you can see which posts send readers to shop.

## Get found on Google and Pinterest

Each post already gets a meta description (the `description:` line), social preview tags, article structured data and a sitemap with dates and cover photos.

1. Google Search Console: at search.google.com/search-console add a "URL prefix" property for https://thelittlenest.netlify.app, choose "HTML tag", and copy only the `content="..."` code into the `googleSiteVerification` line of `site.config.json`. Commit, press Verify, then submit `sitemap.xml` under Sitemaps.
2. Pinterest: in Pinterest business settings, claim the website with the HTML tag option and paste the code into the `pinterestVerification` line.

Write a description of 140 to 160 characters that uses the phrase people search for (for example "how to decorate with plaid").
