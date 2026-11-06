#!/bin/bash
# The Little Nest moved to Cloudflare Pages (thelittlenest.blog) in Nov 2026.
# Netlify only serves the 301 redirect from the old netlify.app address now,
# so it never needs to build again. Exit 0 = skip the build (costs no credits).
echo "Site lives on Cloudflare Pages now. Skipping the Netlify build."
exit 0
