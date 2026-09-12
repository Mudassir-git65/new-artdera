/**
 * Centralized SEO & Structured Data (JSON-LD) Utility Engine for ArtDera (artdera.com)
 */

export const SITE_URL = "https://www.artdera.com";
export const DEFAULT_SITE_TITLE = "ArtDera | Buy Original Art, Calligraphy, Photography & Decor";
export const DEFAULT_SITE_DESCRIPTION =
  "ArtDera is a global art marketplace connecting independent artists, creators and galleries with buyers looking for original art, prints, photography, calligraphy and curated decor.";
export const DEFAULT_OG_IMAGE = `${SITE_URL}/images/hero-interior.jpg`;

export interface SEOProps {
  title?: string;
  description?: string;
  canonicalPath?: string;
  ogImage?: string;
  ogType?: "website" | "article" | "product" | "profile";
  noIndex?: boolean;
}

export function buildCanonicalUrl(path?: string): string {
  if (!path) return SITE_URL;
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  return `${SITE_URL}${cleanPath}`;
}

export function generateMeta({
  title = DEFAULT_SITE_TITLE,
  description = DEFAULT_SITE_DESCRIPTION,
  canonicalPath,
  ogImage = DEFAULT_OG_IMAGE,
  ogType = "website",
  noIndex = false,
}: SEOProps = {}) {
  const canonicalUrl = buildCanonicalUrl(canonicalPath);
  const formattedTitle = title.includes("ArtDera") ? title : `${title} | ArtDera`;

  const meta = [
    { title: formattedTitle },
    { name: "description", content: description },
    { name: "robots", content: noIndex ? "noindex, follow" : "index, follow" },
    { property: "og:site_name", content: "ArtDera" },
    { property: "og:title", content: formattedTitle },
    { property: "og:description", content: description },
    { property: "og:type", content: ogType },
    { property: "og:url", content: canonicalUrl },
    { property: "og:image", content: ogImage },
    { name: "twitter:card", content: "summary_large_image" },
    { name: "twitter:title", content: formattedTitle },
    { name: "twitter:description", content: description },
    { name: "twitter:image", content: ogImage },
  ];

  const links = [
    { rel: "canonical", href: canonicalUrl },
    { rel: "alternate", hrefLang: "x-default", href: canonicalUrl },
    { rel: "alternate", hrefLang: "en", href: canonicalUrl },
  ];

  return { meta, links };
}

// ---------------------------------------------------------------------------
// Structured Data (JSON-LD) Generators
// ---------------------------------------------------------------------------

export function generateOrganizationSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": `${SITE_URL}/#organization`,
    name: "ArtDera",
    legalName: "ArtDera Global Canvas",
    url: SITE_URL,
    logo: {
      "@type": "ImageObject",
      url: `${SITE_URL}/favicon.svg`,
    },
    description: DEFAULT_SITE_DESCRIPTION,
    foundingDate: "2024",
    sameAs: [
      "https://www.youtube.com/@ArtDera",
      "https://www.instagram.com/artdera.official/",
      "https://www.linkedin.com/company/artdera",
      "https://facebook.com/artdera",
    ],
    contactPoint: {
      "@type": "ContactPoint",
      contactType: "customer service",
      email: "support@artdera.com",
      availableLanguage: ["English", "Urdu"],
    },
  };
}

export function generateWebSiteSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${SITE_URL}/#website`,
    url: SITE_URL,
    name: "ArtDera",
    description: DEFAULT_SITE_DESCRIPTION,
    publisher: {
      "@id": `${SITE_URL}/#organization`,
    },
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${SITE_URL}/discover?q={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  };
}

export function generateProductSchema(product: {
  title: string;
  description: string;
  slug: string;
  images: string[];
  price: number;
  currency?: string;
  medium?: string;
  dimensions?: string;
  kind?: string;
  creatorName?: string;
  creatorSlug?: string;
  framed?: boolean;
  inStock?: boolean;
}) {
  const productUrl = `${SITE_URL}/product/${product.slug}`;
  const creatorUrl = product.creatorSlug ? `${SITE_URL}/creator/${product.creatorSlug}` : undefined;

  return {
    "@context": "https://schema.org",
    "@type": "Product",
    "@id": `${productUrl}/#product`,
    name: product.title,
    description: product.description,
    image: product.images,
    category: product.medium ?? "Visual Art",
    offers: {
      "@type": "Offer",
      url: productUrl,
      priceCurrency: product.currency ?? "PKR",
      price: product.price,
      itemCondition: "https://schema.org/NewCondition",
      availability:
        product.inStock !== false ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
      seller: product.creatorName
        ? {
            "@type": "Person",
            name: product.creatorName,
            url: creatorUrl,
          }
        : {
            "@id": `${SITE_URL}/#organization`,
          },
      hasMerchantReturnPolicy: {
        "@type": "MerchantReturnPolicy",
        applicableCountry: "PK",
        returnPolicyCategory: "https://schema.org/MerchantReturnFiniteReturnWindow",
        merchantReturnDays: 7,
        returnMethod: "https://schema.org/ReturnByMail",
      },
    },
    brand: product.creatorName
      ? {
          "@type": "Person",
          name: product.creatorName,
          url: creatorUrl,
        }
      : {
          "@id": `${SITE_URL}/#organization`,
        },
  };
}

export function generatePersonSchema(creator: {
  name: string;
  slug: string;
  bio: string;
  location?: string;
  discipline?: string;
  portrait?: string;
  verified?: boolean;
}) {
  const profileUrl = `${SITE_URL}/creator/${creator.slug}`;

  return {
    "@context": "https://schema.org",
    "@type": "ProfilePage",
    "@id": `${profileUrl}/#webpage`,
    url: profileUrl,
    name: `${creator.name} — Artist Profile`,
    mainEntity: {
      "@type": "Person",
      "@id": `${profileUrl}/#person`,
      name: creator.name,
      description: creator.bio,
      jobTitle: creator.discipline ?? "Artist",
      address: creator.location
        ? {
            "@type": "PostalAddress",
            addressLocality: creator.location,
          }
        : undefined,
      image: creator.portrait,
      url: profileUrl,
    },
  };
}

export function generateGallerySchema(gallery: {
  name: string;
  slug: string;
  bio: string;
  location?: string;
  portrait?: string;
}) {
  const galleryUrl = `${SITE_URL}/store/${gallery.slug}`;

  return {
    "@context": "https://schema.org",
    "@type": "ProfilePage",
    "@id": `${galleryUrl}/#webpage`,
    url: galleryUrl,
    name: `${gallery.name} — Gallery Profile`,
    mainEntity: {
      "@type": "ArtGallery",
      "@id": `${galleryUrl}/#gallery`,
      name: gallery.name,
      description: gallery.bio,
      address: gallery.location
        ? {
            "@type": "PostalAddress",
            addressLocality: gallery.location,
          }
        : undefined,
      logo: gallery.portrait,
      url: galleryUrl,
    },
  };
}

export function generateItemListSchema(
  name: string,
  description: string,
  items: Array<{ title: string; slug: string; image?: string; price?: number }>,
) {
  return {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name,
    description,
    mainEntity: {
      "@type": "ItemList",
      numberOfItems: items.length,
      itemListElement: items.map((item, index) => ({
        "@type": "ListItem",
        position: index + 1,
        url: `${SITE_URL}/product/${item.slug}`,
        name: item.title,
        image: item.image,
      })),
    },
  };
}

export function generateBreadcrumbSchema(items: Array<{ name: string; path: string }>) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: buildCanonicalUrl(item.path),
    })),
  };
}
