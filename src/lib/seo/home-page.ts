import type { Metadata } from "next";
import { industries } from "@/components/landing/industries-data";
import { landingFaqs } from "@/lib/seo/landing-faqs";

export const SITE_URL = "https://theaccounts.cloud";
export const SITE_NAME = "The Accounts";
export const OG_IMAGE = "/images/theaccounts_pos_dashboard_monitor.png";

export const homePageMetadata: Metadata = {
  title: "The Accounts | Cloud POS, Khata & Accounting Software for Shops in Pakistan",
  description:
    "The Accounts (theaccounts.cloud) — cloud POS, inventory, customer khata, WhatsApp receipts, offline billing, AI invoice scan, and double-entry accounts for pharmacy, restaurant, karyana, tailor, showroom & more.",
  keywords: [
    "The Accounts",
    "theaccounts.cloud",
    "POS software Pakistan",
    "khata software",
    "cloud accounting software Pakistan",
    "retail billing software",
    "karyana POS",
    "pharmacy billing software",
    "restaurant KOT KDS software",
    "tailor shop software",
    "showroom vehicle rental software",
    "offline POS Pakistan",
    "WhatsApp invoice software",
    "AI invoice OCR POS",
    "multi shop ERP",
    "Urdu English POS",
    "thermal printer billing",
    "inventory management software",
    "double entry accounting Pakistan",
  ],
  alternates: {
    canonical: SITE_URL,
  },
  openGraph: {
    type: "website",
    locale: "en_PK",
    alternateLocale: ["en_US", "ur_PK"],
    url: SITE_URL,
    siteName: SITE_NAME,
    title: "The Accounts | Cloud POS, Khata & Accounting for Every Shop",
    description:
      "Run POS, stock, khata & accounts from one workspace. Offline-ready billing, WhatsApp receipts, AI invoice scan, and industry packs for Pakistani merchants.",
    images: [
      {
        url: OG_IMAGE,
        width: 1200,
        height: 630,
        alt: "The Accounts cloud POS dashboard and executive command center on monitor",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "The Accounts | Cloud POS, Khata & Accounting Software",
    description:
      "POS, inventory, khata & accounts for shops in Pakistan — offline billing, WhatsApp receipts, AI invoice scan, multi-industry ERP.",
    images: [OG_IMAGE],
    creator: "@theaccounts",
  },
  category: "Business Software",
  applicationName: SITE_NAME,
  other: {
    "geo.region": "PK",
    "geo.placename": "Pakistan",
    "content-language": "en, ur",
  },
};

export function buildHomePageJsonLd() {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        "@id": `${SITE_URL}/#website`,
        url: SITE_URL,
        name: SITE_NAME,
        description: homePageMetadata.description,
        publisher: { "@id": `${SITE_URL}/#organization` },
        inLanguage: ["en-PK", "ur-PK"],
      },
      {
        "@type": "WebPage",
        "@id": `${SITE_URL}/#webpage`,
        url: SITE_URL,
        name: "The Accounts — Cloud POS, Khata & Accounting Software",
        isPartOf: { "@id": `${SITE_URL}/#website` },
        about: { "@id": `${SITE_URL}/#software` },
        description: homePageMetadata.description,
        inLanguage: "en-PK",
      },
      {
        "@type": "Organization",
        "@id": `${SITE_URL}/#organization`,
        name: SITE_NAME,
        url: SITE_URL,
        logo: {
          "@type": "ImageObject",
          url: `${SITE_URL}/the-accounts-brand.png`,
        },
        sameAs: [
          "https://facebook.com/theaccounts",
          "https://twitter.com/theaccounts",
        ],
      },
      {
        "@type": "SoftwareApplication",
        "@id": `${SITE_URL}/#software`,
        name: SITE_NAME,
        url: SITE_URL,
        applicationCategory: "BusinessApplication",
        applicationSubCategory: "Point of Sale Software",
        operatingSystem: "Web, Windows, macOS, Android, iOS",
        description:
          "Cloud POS, inventory, customer khata ledger, WhatsApp receipts, offline billing, AI invoice OCR, and accounting for retail and service businesses.",
        featureList: [
          "Retail POS billing",
          "Customer khata ledger",
          "Inventory management",
          "Offline sales queue and sync",
          "WhatsApp invoice alerts",
          "AI invoice and product OCR",
          "Multi-shop management",
          "Double-entry accounts",
          "Thermal printer support",
          "Urdu and English interface",
        ],
        offers: {
          "@type": "AggregateOffer",
          priceCurrency: "PKR",
          lowPrice: "500",
          highPrice: "20000",
          offerCount: "3",
          url: `${SITE_URL}/#pricing`,
        },
        screenshot: `${SITE_URL}${OG_IMAGE}`,
        provider: { "@id": `${SITE_URL}/#organization` },
      },
      {
        "@type": "FAQPage",
        "@id": `${SITE_URL}/#faq`,
        mainEntity: landingFaqs.map((item) => ({
          "@type": "Question",
          name: item.q,
          acceptedAnswer: {
            "@type": "Answer",
            text: item.a,
          },
        })),
      },
      {
        "@type": "ItemList",
        "@id": `${SITE_URL}/#industries`,
        name: "Industry packs supported by The Accounts",
        numberOfItems: industries.length,
        itemListElement: industries.map((item, index) => ({
          "@type": "ListItem",
          position: index + 1,
          name: item.title,
          description: item.desc,
          url: `${SITE_URL}/register?industry=${item.id}`,
        })),
      },
      {
        "@type": "BreadcrumbList",
        "@id": `${SITE_URL}/#breadcrumb`,
        itemListElement: [
          {
            "@type": "ListItem",
            position: 1,
            name: "Home",
            item: SITE_URL,
          },
        ],
      },
      {
        "@type": "Product",
        "@id": `${SITE_URL}/#product-offering`,
        name: "The Accounts Cloud ERP Subscription",
        description:
          "SaaS subscription for POS, khata, inventory, and accounting with industry-specific modules.",
        brand: { "@id": `${SITE_URL}/#organization` },
        category: "Software > Business Software",
        offers: {
          "@type": "AggregateOffer",
          priceCurrency: "PKR",
          lowPrice: "500",
          highPrice: "20000",
          offerCount: "3",
          url: `${SITE_URL}/#pricing`,
          availability: "https://schema.org/InStock",
        },
      },
    ],
  };
}
