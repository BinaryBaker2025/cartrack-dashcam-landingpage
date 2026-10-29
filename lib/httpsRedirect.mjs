export function httpsRedirect(request) {
  const url = new URL(request.url);
  if (
    url.protocol !== 'http:' ||
    ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
  ) return null;
  url.protocol = 'https:';
  return Response.redirect(url.toString(), 308);
}
