export function isIndexable() {
  if (process.env.SITE_INDEXABLE !== 'true') return false;
  // Netlify's build context takes precedence, including Deploy Previews.
  if (process.env.CONTEXT) return process.env.CONTEXT === 'production';
  return process.env.VERCEL_ENV === 'production';
}

export function clientAddress(request: Request) {
  if (process.env.DEPLOY_PLATFORM === 'netlify') {
    return request.headers.get('x-nf-client-connection-ip')?.trim() || 'unknown';
  }
  if (process.env.VERCEL === '1') {
    return request.headers.get('x-vercel-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  }
  return 'local-shared';
}
