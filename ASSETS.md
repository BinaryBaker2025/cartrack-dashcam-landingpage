# Asset checklist and reference audit

Reference inspected on 14 September 2026: https://xsendr.com/landing/Cartrack, reached through the supplied offer 3046 / affiliate 27144 tracking URL. Desktop and mobile screenshots are saved locally under `artifacts/reference-*.png` (ignored by Git). The remote page was inspected without submitting its form.

## Retrieved assets

| Local file | Reference source | Actual dimensions | Use |
| --- | --- | --- | --- |
| `public/assets/cartrack-logo.jpg` | https://multimedia.xsendr.com/retur-t/photos/88f6831c-7b87-476d-b1cc-119f48bbcf56.jpg | 1118 × 300 | Centred header logo, displayed around 233 × 63 |
| `public/assets/dashcam-product.jpeg` | https://multimedia.xsendr.com/retur-t/photos/aa5f5307-8671-48a9-aae9-08d7e76a087a.jpeg | 1200 × 600 | Driver/dashcam photograph in the benefits section |
| `public/assets/fonts/montserrat-{0,1}.ttf` | Google Fonts, Montserrat 400 / 700 | Font files | Main headings and body |
| `public/assets/fonts/poppins-{0,1}.ttf` | Google Fonts, Poppins 400 / 700 | Font files | Form and final CTA section |
| `public/assets/fonts/questrial-0.ttf` | Google Fonts, Questrial 400 | Font file | CTA typography |
| `public/assets/fonts/nanum-pen-script-0.ttf` | Google Fonts, Nanum Pen Script 400 | Font file | “Did you know?” |

Font licences are included alongside the fonts as `*-OFL.txt`. Images are the publicly accessible assets from the user-specified campaign; they remain the property of their respective owners. Obtain campaign permission to republish the creative and copy before launch. Public accessibility is not a new licence grant.

## Missing assets

**None of the assets used in the visible reference page are missing. No placeholders, generated images, unrelated stock, fabricated logos or invented icons are used.** Check marks reproduce the reference's Unicode emoji; their appearance varies by platform. The form success check is an ordinary text glyph.

Optional brand favicon, if desired (not needed to reproduce the page):

| Desired file | Location | Recommended size | Transparency | Desktop/mobile variants |
| --- | --- | --- | --- | --- |
| `public/assets/cartrack-favicon.svg` | Browser tab / bookmark | Square SVG; raster fallback 32 × 32 or 48 × 48 | Yes | No |

The source favicon is a GetResponse platform icon, not a CarTrack asset. It is intentionally omitted. No favicon placeholder is referenced by the application.

## Layout findings and deliberate differences

1. Centred logo on white.
2. White desktop split hero: heading and campaign offer left, rounded quote card right. Mobile stacks heading then form.
3. Pale grey benefits section, centred heading/intro. Desktop has benefits and insurance callout on the left, photo on the right, callback button below. Mobile orders benefits → callback → insurance callout → photo.
4. Charcoal closing quote CTA.

The reference visibly advertises R199/month. The brief explicitly disallows a price, so its price block is replaced with the supplied campaign name, CarTrack Cameras. No price is advertised. The required qualification and consent controls make the quote form and hero taller. Mobile inputs are 16px to remain readable and avoid iOS focus zoom. CTA text and orange body text have increased contrast. A small legal footer is added. The 400px fixed source mobile canvas is replaced with fluid widths for 375px and wider displays. There are no live trust metrics, videos, hero background images, product cards or extra sections in the inspected page; unrelated unused template CSS is not reproduced.

## Replacing assets

Replace the local file and keep its name and aspect ratio, or update `app/page.tsx` and `app/layout.tsx`. The photograph uses `next/image`, responsive sizing and lazy loading. The logo has a fixed display size and preload priority. Keep font files and licences together. Do not use the reference's scripts, form action, pixels or API code; this project implements its own submission pipeline.
