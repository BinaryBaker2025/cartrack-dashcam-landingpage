# Netlify setup, no database

The page and `POST /api/leads` deploy together. Netlify's Next.js adapter automatically turns the API route into a Netlify Function. There is no PostgreSQL/Prisma setup, external storage subscription or cleanup cron.

1. Push this project to a Git repository, then import it into Netlify. Use a Git build, not a drag-and-drop static upload.
2. The included `netlify.toml` sets build command `npm run build`, publish directory `.next`, and Node 22. No separate functions directory or custom redirect is needed. Do not use `output: export` or Netlify Forms for this form.
3. In Project configuration > Environment variables, set the following for all scopes, or at least Builds and Functions. Replace the example site/operator/email with your own values.

```dotenv
NEXT_PUBLIC_SITE_URL=https://YOUR-PROJECT.netlify.app
DEPLOY_PLATFORM=netlify
LEADBYTE_ENDPOINT=https://returnxdigital.leadbyte.co.uk/api/submit.php
LEADBYTE_CAMPID=DASHCAMS
LEADBYTE_SID=27144
LEADBYTE_OFFER_ID=3046
LEADBYTE_ENABLED=false
LEADBYTE_TIMEOUT_MS=10000
RATE_LIMIT_MAX=10
RATE_LIMIT_WINDOW_SECONDS=600
SITE_INDEXABLE=false
CAMPAIGN_OPERATOR_NAME=YOUR_ACTUAL_OPERATOR_NAME
PRIVACY_CONTACT_EMAIL=YOUR_ACTUAL_PRIVACY_EMAIL
AWS_LAMBDA_JS_RUNTIME=nodejs22.x
```

4. Deploy. Local `.env` values are not automatically uploaded. Application settings in netlify.toml are not function runtime environment settings; use the dashboard. Redeploy after changing values.
5. Check the home/terms/privacy pages, robots.txt and inline validation. Functions should show the adapter-generated Next.js handler (its name is adapter-managed). There is no retention function anymore.
6. Obtain the approved campaign test number. Set `LEADBYTE_ENABLED=true` on the intended production deployment, redeploy and submit once using **Test / Testing**. Confirm receipt with the manager. Do not use the synthetic automated-test number.
7. Point the campaign tracking link at the approved site. When adding a custom domain, update NEXT_PUBLIC_SITE_URL and redeploy; redirect alternate domains to it. The API checks the request Origin. Keep preview/branch deployments on LEADBYTE_ENABLED=false. SITE_INDEXABLE can be true only when production indexing is wanted; previews remain noindex.

You can remove old DATABASE_URL, CRON_SECRET, LEAD_HASH_SECRET and DATA_RETENTION_DAYS variables from Netlify; they are no longer used. There are no database setup commands.

## Temporary storage

The browser uses sessionStorage for attribution, submission tokens, five-attempt/ten-minute cooldown and 30-minute success/duplicate receipts. Raw names/phone numbers are not saved there. The function uses bounded temporary memory for a basic per-IP rate limit and 30-minute same-token replay protection. Memory expires or disappears with a function restart, deployment or cold start; it is not shared across running instances.

Browser controls can be bypassed. These checks reduce accidental repeats and some abuse, but are not a globally enforced rate limit or guaranteed idempotency. LeadByte supplies the authoritative lead/duplicate outcome. There is no central lead/attribution database: obtain weekly reports from LeadByte or the campaign manager. Hosting diagnostic logs have their own retention settings.

## Verification

Local production build and mocked tests do not claim a hosted Netlify deployment was tested. Inspect the adapter build log, deployed form behavior and function logs after importing your repository. No Netlify account has been connected by this task and no real API lead has been sent.

Official references:
- [Next.js adapter](https://docs.netlify.com/build/frameworks/framework-setup-guides/nextjs/overview/)
- [Build settings](https://docs.netlify.com/snippets/frameworks/nextjs-config-values/)
- [Function environment variables](https://docs.netlify.com/build/functions/environment-variables/)
