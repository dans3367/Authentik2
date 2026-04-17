import { unsplashProvider } from './unsplashProvider';

export interface ImageCandidate {
  provider: 'unsplash' | 'pexels';
  id: string;
  url: string;
  thumbUrl: string;
  alt: string;
  attribution: {
    name: string;
    profileUrl: string;
  };
}

export interface StockImageProvider {
  readonly name: 'unsplash' | 'pexels';
  isConfigured(): boolean;
  search(query: string, count: number): Promise<ImageCandidate[]>;
}

export function getProviders(): StockImageProvider[] {
  return [unsplashProvider].filter((p) => p.isConfigured());
}

export { unsplashProvider };
