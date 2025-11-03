export type BlockType = 
  | 'hero'
  | 'text'
  | 'image'
  | 'button'
  | 'divider'
  | 'spacer'
  | 'columns'
  | 'gallery'
  | 'social'
  | 'footer';

export interface BlockStyle {
  backgroundColor?: string;
  textColor?: string;
  fontSize?: string;
  fontFamily?: string;
  padding?: string;
  margin?: string;
  borderRadius?: string;
  textAlign?: 'left' | 'center' | 'right';
  fontWeight?: string;
}

export interface BaseBlock {
  id: string;
  type: BlockType;
  style?: BlockStyle;
}

export interface HeroBlock extends BaseBlock {
  type: 'hero';
  title: string;
  subtitle?: string;
  imageUrl?: string;
  buttonText?: string;
  buttonUrl?: string;
}

export interface TextBlock extends BaseBlock {
  type: 'text';
  content: string;
}

export interface ImageBlock extends BaseBlock {
  type: 'image';
  url: string;
  alt?: string;
  link?: string;
}

export interface ButtonBlock extends BaseBlock {
  type: 'button';
  text: string;
  url: string;
  variant?: 'primary' | 'secondary' | 'outline';
}

export interface DividerBlock extends BaseBlock {
  type: 'divider';
  height?: string;
  color?: string;
}

export interface SpacerBlock extends BaseBlock {
  type: 'spacer';
  height: string;
}

export interface ColumnBlock {
  id: string;
  blocks: NewsletterBlock[];
  width?: string;
}

export interface ColumnsBlock extends BaseBlock {
  type: 'columns';
  columns: ColumnBlock[];
}

export interface GalleryBlock extends BaseBlock {
  type: 'gallery';
  images: Array<{
    url: string;
    alt?: string;
    link?: string;
  }>;
  columns?: number;
}

export interface SocialBlock extends BaseBlock {
  type: 'social';
  links: Array<{
    platform: 'facebook' | 'twitter' | 'instagram' | 'linkedin' | 'youtube';
    url: string;
  }>;
}

export interface FooterBlock extends BaseBlock {
  type: 'footer';
  companyName?: string;
  address?: string;
  unsubscribeText?: string;
}

export type NewsletterBlock = 
  | HeroBlock
  | TextBlock
  | ImageBlock
  | ButtonBlock
  | DividerBlock
  | SpacerBlock
  | ColumnsBlock
  | GalleryBlock
  | SocialBlock
  | FooterBlock;

export interface NewsletterTemplate {
  id: string;
  name: string;
  blocks: NewsletterBlock[];
  globalStyle?: {
    fontFamily?: string;
    backgroundColor?: string;
    primaryColor?: string;
    secondaryColor?: string;
  };
}

export interface NewsletterEditorState {
  blocks: NewsletterBlock[];
  selectedBlockId: string | null;
  template: NewsletterTemplate | null;
  globalStyle: NewsletterTemplate['globalStyle'];
}
