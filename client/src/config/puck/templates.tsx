import type { Data } from "@puckeditor/core";

/**
 * Pre-built newsletter templates for the Puck editor.
 * Each template is a Puck Data object ready to load.
 *
 * We use the generic `Data` type (not the stricter `UserData`) because
 * Puck's `setData` action accepts `Partial<Data>` and the component
 * props are validated at render-time by each block's config.
 */

export interface NewsletterTemplate {
  id: string;
  name: string;
  description: string;
  category: "newsletter" | "product";
  thumbnail: string;
  data: Data;
}

// ─── Helper: generate a unique component ID ───
let _idCounter = 0;
function uid(): string {
  _idCounter += 1;
  return `tpl-${Date.now().toString(36)}-${_idCounter}`;
}

// ─── Template 1: Company Update Newsletter ───
function companyUpdateTemplate(): Data {
  return {
    root: { props: { title: "Company Update Newsletter" } },
    zones: {},
    content: [
      {
        type: "Hero",
        props: {
          id: uid(),
          title: "Monthly Company Update",
          description:
            "Here's what's been happening this month — product launches, team wins, and what's coming next.",
          buttons: [{ label: "Read More", href: "#" }],
          padding: "64px",
          align: "left",
        },
      },
      { type: "Space", props: { id: uid(), size: "24px", direction: "vertical" } },
      {
        type: "Heading",
        props: { id: uid(), text: "What's New", level: "2", size: "m", align: "left" },
      },
      {
        type: "RichText",
        props: {
          id: uid(),
          html: "<p>We've been hard at work shipping new features and improvements. Here are the highlights from this month:</p><ul><li><strong>New dashboard redesign</strong> — A cleaner, faster experience for all users.</li><li><strong>API v2 launch</strong> — More endpoints, better docs, higher rate limits.</li><li><strong>Mobile app update</strong> — Push notifications and offline support are here.</li></ul>",
        },
      },
      { type: "Space", props: { id: uid(), size: "32px", direction: "vertical" } },
      {
        type: "FeaturedArticle",
        props: {
          id: uid(),
          label: "Featured",
          title: "Behind the Scenes: Our Engineering Culture",
          description:
            "A look at how our engineering team ships fast without breaking things — from code review to deploy.",
          image: { url: "https://placehold.co/600x340/e2e8f0/64748b?text=Engineering+Culture", alt: "Engineering culture" },
          buttonText: "Read the full story",
          buttonHref: "#",
          buttonColor: "#2563eb",
          borderRadius: 8,
        },
      },
      { type: "Space", props: { id: uid(), size: "32px", direction: "vertical" } },
      {
        type: "Heading",
        props: { id: uid(), text: "Upcoming Events", level: "2", size: "m", align: "left" },
      },
      {
        type: "RichText",
        props: {
          id: uid(),
          html: "<p>Mark your calendars for these upcoming events:</p><ol><li><strong>March 25</strong> — Product webinar: What's new in Q1</li><li><strong>April 2</strong> — Community meetup (virtual)</li><li><strong>April 10</strong> — Open office hours with the founders</li></ol>",
        },
      },
      { type: "Space", props: { id: uid(), size: "24px", direction: "vertical" } },
      {
        type: "Button",
        props: { id: uid(), label: "View All Events", href: "#", variant: "primary" },
      },
    ],
  };
}

// ─── Template 2: Weekly Digest Newsletter ───
function weeklyDigestTemplate(): Data {
  return {
    root: { props: { title: "Weekly Digest" } },
    zones: {},
    content: [
      {
        type: "Heading",
        props: { id: uid(), text: "This Week's Digest", level: "1", size: "xl", align: "center" },
      },
      {
        type: "Text",
        props: {
          id: uid(),
          text: "Your curated roundup of the most important stories, tips, and insights from this week.",
          size: "m",
          color: "muted",
          align: "center",
        },
      },
      { type: "Space", props: { id: uid(), size: "32px", direction: "vertical" } },
      {
        type: "FeaturedArticle",
        props: {
          id: uid(),
          label: "Top Story",
          title: "The Future of Remote Work in 2026",
          description:
            "New research shows hybrid models are winning — but the details matter more than ever.",
          image: { url: "https://placehold.co/600x340/dbeafe/3b82f6?text=Remote+Work", alt: "Remote work" },
          buttonText: "Read article",
          buttonHref: "#",
          buttonColor: "#2563eb",
          borderRadius: 8,
        },
      },
      { type: "Space", props: { id: uid(), size: "24px", direction: "vertical" } },
      {
        type: "ArticleSmall",
        props: {
          id: uid(),
          label: "Productivity",
          title: "5 Productivity Hacks You Haven't Tried",
          description:
            "Simple changes that can make your workday dramatically more effective.",
          image: { url: "https://placehold.co/200x200/fef3c7/d97706?text=Productivity", alt: "Productivity tips" },
          linkText: "Read more",
          linkHref: "#",
          linkColor: "#2563eb",
          imagePosition: "left",
          borderRadius: 8,
        },
      },
      { type: "Space", props: { id: uid(), size: "16px", direction: "vertical" } },
      {
        type: "ArticleSmall",
        props: {
          id: uid(),
          label: "Design",
          title: "Design Trends to Watch This Quarter",
          description:
            "From AI-generated visuals to bold typography — what's shaping digital design right now.",
          image: { url: "https://placehold.co/200x200/ede9fe/7c3aed?text=Design", alt: "Design trends" },
          linkText: "Read more",
          linkHref: "#",
          linkColor: "#2563eb",
          imagePosition: "right",
          borderRadius: 8,
        },
      },
      { type: "Space", props: { id: uid(), size: "16px", direction: "vertical" } },
      {
        type: "ArticleSmall",
        props: {
          id: uid(),
          label: "Lifestyle",
          title: "How to Build Better Habits in 30 Days",
          description:
            "A science-backed approach to making lasting changes, one small step at a time.",
          image: { url: "https://placehold.co/200x200/dcfce7/16a34a?text=Habits", alt: "Better habits" },
          linkText: "Read more",
          linkHref: "#",
          linkColor: "#2563eb",
          imagePosition: "left",
          borderRadius: 8,
        },
      },
      { type: "Space", props: { id: uid(), size: "32px", direction: "vertical" } },
      {
        type: "Testimonial",
        props: {
          id: uid(),
          quote: "This newsletter is the one email I actually look forward to every week. Always insightful, never boring.",
          authorName: "Sarah M.",
          authorTitle: "Marketing Director",
          authorImage: "https://placehold.co/80x80/f1f5f9/64748b?text=SM",
          align: "center",
          padding: "24px",
        },
      },
      { type: "Space", props: { id: uid(), size: "24px", direction: "vertical" } },
      {
        type: "Button",
        props: { id: uid(), label: "Share This Newsletter", href: "#", variant: "secondary" },
      },
    ],
  };
}

// ─── Template 3: Newsletter + Product Marketing ───
function productMarketingTemplate(): Data {
  return {
    root: { props: { title: "Newsletter + Product Spotlight" } },
    zones: {},
    content: [
      {
        type: "Hero",
        props: {
          id: uid(),
          title: "Spring Collection is Here",
          description:
            "Discover our latest products hand-picked for the season. Plus, catch up on the latest news and tips from our team.",
          buttons: [{ label: "Shop Now", href: "#" }],
          padding: "64px",
          align: "center",
        },
      },
      { type: "Space", props: { id: uid(), size: "32px", direction: "vertical" } },
      {
        type: "Heading",
        props: { id: uid(), text: "Featured Product", level: "2", size: "m", align: "center" },
      },
      { type: "Space", props: { id: uid(), size: "8px", direction: "vertical" } },
      {
        type: "ProductShowcase",
        props: {
          id: uid(),
          title: "Artisan Ceramic Mug Set",
          description:
            "Hand-crafted from premium stoneware, these mugs keep your drinks warmer longer. Available in 4 earthy tones — perfect for gifting or elevating your morning routine.",
          ctaText: "Shop now \u2192",
          ctaUrl: "#",
          imageUrl: "https://placehold.co/260x280/d4c4a8/d4c4a8?text=+",
          imageAlt: "Ceramic mug set",
          backgroundColor: "#333333",
          textColor: "#ffffff",
          ctaColor: "#ffffff",
          borderRadius: 12,
          imageBorderRadius: 12,
        },
      },
      { type: "Space", props: { id: uid(), size: "40px", direction: "vertical" } },
      {
        type: "Heading",
        props: { id: uid(), text: "More From Our Collection", level: "2", size: "m", align: "center" },
      },
      { type: "Space", props: { id: uid(), size: "8px", direction: "vertical" } },
      {
        type: "ProductGrid",
        props: {
          id: uid(),
          products: [
            {
              image: "https://placehold.co/400x400/f5f5f5/999999?text=Candle+Set",
              title: "Soy Wax Candle Trio",
              description: "Hand-poured candles in lavender, vanilla, and cedarwood.",
              price: "$34.99",
            },
            {
              image: "https://placehold.co/400x400/f5f5f5/999999?text=Notebook",
              title: "Linen-Bound Journal",
              description: "160 pages of premium dotted paper with lay-flat binding.",
              price: "$24.00",
            },
            {
              image: "https://placehold.co/400x400/f5f5f5/999999?text=Tea+Set",
              title: "Herbal Tea Sampler",
              description: "12 single-origin blends in compostable sachets.",
              price: "$28.50",
            },
          ],
          columns: 3,
          gap: 24,
        },
      },
      { type: "Space", props: { id: uid(), size: "40px", direction: "vertical" } },
      {
        type: "Heading",
        props: { id: uid(), text: "From the Blog", level: "2", size: "m", align: "left" },
      },
      { type: "Space", props: { id: uid(), size: "8px", direction: "vertical" } },
      {
        type: "RichText",
        props: {
          id: uid(),
          html: "<p>Looking for inspiration? Check out our latest articles:</p>",
        },
      },
      {
        type: "ArticleSmall",
        props: {
          id: uid(),
          label: "Gift Guide",
          title: "How to Create the Perfect Gift Box",
          description:
            "Our step-by-step guide to curating thoughtful, beautiful gifts for any occasion.",
          image: { url: "https://placehold.co/200x200/fef3c7/d97706?text=Gift+Guide", alt: "Gift guide" },
          linkText: "Read more",
          linkHref: "#",
          linkColor: "#2563eb",
          imagePosition: "left",
          borderRadius: 8,
        },
      },
      { type: "Space", props: { id: uid(), size: "16px", direction: "vertical" } },
      {
        type: "ArticleSmall",
        props: {
          id: uid(),
          label: "Sustainability",
          title: "Sustainable Living: Small Changes, Big Impact",
          description:
            "Easy swaps you can make today to reduce waste and live more sustainably.",
          image: { url: "https://placehold.co/200x200/dcfce7/16a34a?text=Eco+Living", alt: "Eco living" },
          linkText: "Read more",
          linkHref: "#",
          linkColor: "#2563eb",
          imagePosition: "right",
          borderRadius: 8,
        },
      },
      { type: "Space", props: { id: uid(), size: "32px", direction: "vertical" } },
      {
        type: "Button",
        props: { id: uid(), label: "Visit Our Store", href: "#", variant: "primary" },
      },
    ],
  };
}

// ─── Template 4: Blog Post Newsletter ───
function blogPostTemplate(): Data {
  return {
    root: { props: { title: "Blog Post Newsletter" } },
    zones: {},
    content: [
      {
        type: "Heading",
        props: {
          id: uid(),
          text: "Never let your memories be greater than your dreams",
          level: "1",
          size: "xxl",
          align: "left",
        },
      },
      { type: "Space", props: { id: uid(), size: "8px", direction: "vertical" } },
      {
        type: "RichText",
        props: {
          id: uid(),
          html: '<p style="color: #6b7280; font-size: 14px; margin: 0;">Apurba Talukdar &amp; Ishan Sharma &nbsp;&nbsp; May 2, 2022 &nbsp;&nbsp; 3 min read</p>',
        },
      },
      { type: "Space", props: { id: uid(), size: "20px", direction: "vertical" } },
      {
        type: "RichText",
        props: {
          id: uid(),
          html: "<p>Before long the searchlight discovered some distance away a schooner with all sails set, apparently the same vessel which had been noticed earlier in the evening. The wind had by this time backed to the east, and there was a shudder amongst the watchers on the cliff as they realized the terrible danger in which she now was. Between her and the port lay the great flat reef on which so many good ships have from time to time suffered, and, with the wind blowing from its present quarter, it would be quite impossible that she should fetch the entrance of the harbour.</p>",
        },
      },
      { type: "Space", props: { id: uid(), size: "16px", direction: "vertical" } },
      {
        type: "Heading",
        props: {
          id: uid(),
          text: "Wherever you go, go with all your heart",
          level: "2",
          size: "l",
          align: "left",
        },
      },
      { type: "Space", props: { id: uid(), size: "8px", direction: "vertical" } },
      {
        type: "RichText",
        props: {
          id: uid(),
          html: '<p>It was now nearly the hour of high tide, but the waves were so great that in their troughs the shallows of the shore were almost visible, and the schooner, with all sails set, was rushing with such speed that, in the words of one old salt, "she must fetch up somewhere, if it was only in hell.</p>',
        },
      },
      { type: "Space", props: { id: uid(), size: "24px", direction: "vertical" } },
      {
        type: "Image",
        props: {
          id: uid(),
          images: [
            {
              src: "https://placehold.co/552x350/87CEEB/87CEEB?text=+",
              alt: "Featured photo",
            },
          ],
          align: "center",
          sizing: "fill",
          borderRadius: 8,
          caption: "Photo by Jakob Owens / Unsplash",
        },
      },
      { type: "Space", props: { id: uid(), size: "24px", direction: "vertical" } },
      {
        type: "RichText",
        props: {
          id: uid(),
          html: "<p>Then came another rush of sea-fog, greater than any hitherto -- a mass of dank mist, which seemed to close on all things like a grey pall, and left available to men only the organ of hearing, for the roar of the tempest, and the crash of the thunder, and the booming of the mighty billows came through the damp oblivion even louder than before.</p>",
        },
      },
      { type: "Space", props: { id: uid(), size: "24px", direction: "vertical" } },
      {
        type: "RichText",
        props: {
          id: uid(),
          html: '<blockquote><p>A mind that is stretched by a new experience can never go back to its old dimensions</p></blockquote>',
        },
      },
      { type: "Space", props: { id: uid(), size: "24px", direction: "vertical" } },
      {
        type: "RichText",
        props: {
          id: uid(),
          html: "<p>The harbour lights of the port gleamed through the darkness, offering a beacon of hope for those aboard. The captain, weathered by years of such storms, stood firm at the helm, his eyes fixed on the narrow channel that would lead them to safety. Every soul aboard knew that the next few minutes would determine their fate.</p>",
        },
      },
    ],
  };
}

export const newsletterTemplates: NewsletterTemplate[] = [
  {
    id: "company-update",
    name: "Company Update",
    description: "Monthly company news with featured article, updates, and upcoming events.",
    category: "newsletter",
    thumbnail: "https://placehold.co/280x180/dbeafe/2563eb?text=Company+Update",
    data: companyUpdateTemplate(),
  },
  {
    id: "weekly-digest",
    name: "Weekly Digest",
    description: "Curated roundup with featured story, article cards, and reader testimonial.",
    category: "newsletter",
    thumbnail: "https://placehold.co/280x180/ede9fe/7c3aed?text=Weekly+Digest",
    data: weeklyDigestTemplate(),
  },
  {
    id: "product-marketing",
    name: "Product Spotlight",
    description: "Newsletter with featured product showcase, product grid, and blog content.",
    category: "product",
    thumbnail: "https://placehold.co/280x180/fef3c7/d97706?text=Product+Spotlight",
    data: productMarketingTemplate(),
  },
  {
    id: "blog-post",
    name: "Blog Post",
    description: "Clean article layout with title, metadata, body text, images, and blockquotes.",
    category: "newsletter",
    thumbnail: "https://placehold.co/280x180/f0fdf4/16a34a?text=Blog+Post",
    data: blogPostTemplate(),
  },
];
