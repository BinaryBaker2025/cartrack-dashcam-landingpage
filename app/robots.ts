import type { MetadataRoute } from 'next';
import { isIndexable } from '@/lib/hosting';
import { siteUrl } from '@/lib/config';
export default function robots(): MetadataRoute.Robots {
  const allow = isIndexable();
  return {
    rules: { userAgent: '*', ...(allow ? { allow: '/', disallow: ['/api/'] } : { disallow: '/' }) },
    ...(allow ? { sitemap: `${siteUrl()}/sitemap.xml` } : {}),
  };
}
