import type { MetadataRoute } from 'next';
import { siteUrl } from '@/lib/config';
import { isIndexable } from '@/lib/hosting';

export default function sitemap(): MetadataRoute.Sitemap {
  // Legal pages explicitly opt out of indexing; advertise only the landing page.
  return isIndexable() ? [{ url: `${siteUrl()}/` }] : [];
}
