import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/api/', '/dashboard/admin/'], // Hide sensitive paths
      },
      {
        userAgent: ['GPTBot', 'ChatGPT-User', 'Claude-Web', 'PerplexityBot'],
        allow: '/',
      },
    ],
    sitemap: 'https://nblm-linkstation.vercel.app/sitemap.xml',
  };
}
