# Search indexing

Production Cloudflare builds enable indexing through `SITE_INDEXABLE=true` and
`DEPLOY_ENV=production` in `wrangler.jsonc`. Local and preview environments remain
excluded by `lib/hosting.ts`. Run `npm run build:cloudflare` for the production
build settings to apply to the generated metadata, robots.txt and sitemap.

The landing page is listed at https://bestcardash.com/sitemap.xml and robots.txt
advertises that sitemap. Legal pages retain their explicit noindex metadata and
are excluded from the sitemap.

## Bing and Microsoft Edge search

1. Deploy the updated application using the project's existing deployment process.
2. Add `https://bestcardash.com` at https://www.bing.com/webmasters/.
3. Verify ownership using Bing's DNS option, or copy only the content value from
   its `msvalidate.01` meta tag into `BING_SITE_VERIFICATION`. Set this environment
   variable in the build environment (or add it to `wrangler.jsonc` vars; this is
   a public verification code). Rebuild and redeploy before clicking Verify.
4. Submit `https://bestcardash.com/sitemap.xml` in Bing Webmaster Tools, then use
   URL Inspection to request indexing of the homepage.

For Google Search Console, use DNS verification or supply
`GOOGLE_SITE_VERIFICATION` at build time and rebuild/redeploy, then submit the
same sitemap. Changing a runtime variable alone does not update prerendered HTML.

After deployment, confirm robots.txt allows `/`, lists the sitemap, and the
homepage has `index, follow` metadata with no `X-Robots-Tag: noindex` header.
Cloudflare access challenges or bot rules must also allow legitimate crawlers.

These changes make the site eligible for discovery; search engines decide whether
and when to index and rank it. No browser extension or Edge-specific page is needed.

Reference: https://www.bing.com/webmasters/help/add-and-verify-site-12184f8b
