// Reuse the supplied brand asset; no invented favicon artwork.
export function GET() {
  return new Response(null, {
    status: 307,
    headers: { Location: '/assets/cartrack-logo.jpg', 'Cache-Control': 'public, max-age=86400' },
  });
}
