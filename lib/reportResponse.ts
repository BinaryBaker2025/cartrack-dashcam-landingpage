export function privateReportResponse(upstream: Response) {
  const response = new Response(upstream.body, upstream);
  response.headers.set('Cache-Control', 'private, no-store');
  response.headers.set('X-Robots-Tag', 'noindex, nofollow');
  // Preserve Origin on same-origin sign-in POSTs; suppress referrers to other sites.
  response.headers.set('Referrer-Policy', 'same-origin');
  return response;
}
