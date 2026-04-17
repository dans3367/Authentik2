import type { ImageCandidate, StockImageProvider } from './index';

interface UnsplashPhoto {
  id: string;
  alt_description: string | null;
  description: string | null;
  urls: { regular: string; small: string; thumb: string };
  user: { name: string; links: { html: string } };
}

interface UnsplashSearchResponse {
  results: UnsplashPhoto[];
  total: number;
  total_pages: number;
}

function accessKey(): string | undefined {
  return process.env.UNSPLASH_ACCESS_KEY;
}

export const unsplashProvider: StockImageProvider = {
  name: 'unsplash',

  isConfigured() {
    return Boolean(accessKey());
  },

  async search(query: string, count: number): Promise<ImageCandidate[]> {
    const key = accessKey();
    if (!key) return [];

    const params = new URLSearchParams({
      query,
      per_page: String(Math.max(1, Math.min(count, 30))),
      orientation: 'landscape',
      content_filter: 'high',
    });

    const response = await fetch(`https://api.unsplash.com/search/photos?${params.toString()}`, {
      headers: {
        Authorization: `Client-ID ${key}`,
        'Accept-Version': 'v1',
      },
    });

    if (!response.ok) {
      throw new Error(`Unsplash search failed: ${response.status} ${response.statusText}`);
    }

    const data = (await response.json()) as UnsplashSearchResponse;

    return data.results.slice(0, count).map((photo) => ({
      provider: 'unsplash' as const,
      id: photo.id,
      url: photo.urls.regular,
      thumbUrl: photo.urls.small,
      alt: photo.alt_description || photo.description || query,
      attribution: {
        name: photo.user.name,
        profileUrl: photo.user.links.html,
      },
    }));
  },
};
