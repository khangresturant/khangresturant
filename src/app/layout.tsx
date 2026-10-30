import { AccountsAiAgentWidget } from "@/components/ai/AccountsAiAgentWidget";
import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { LanguageProvider } from "@/context/LanguageContext";
import { RegisterSW } from "@/components/sync/RegisterSW";
import { isFlame9Brand } from "@/lib/deployment/flame9-brand";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
  adjustFontFallback: false,
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
  adjustFontFallback: false,
});

export const metadata: Metadata = {
  metadataBase: new URL("https://theaccounts.cloud"),
  title: {
    default: "The Accounts | #1 All-in-One Cloud ERP, Accounting & POS Software",
    template: "%s | The Accounts",
  },
  description: "The Accounts (theaccounts.cloud) is the ultimate cloud POS billing, stock inventory, customer credit ledger (Khata), and double-entry accounting software for retail, grocery, tailors, restaurants, pharmacy, and showrooms in Pakistan and globally.",
  keywords: [
    "The Accounts",
    "theaccounts.cloud",
    "POS software Pakistan",
    "Retail POS billing software",
    "Karyana store billing software",
    "Tailor measurement software",
    "Restaurant KOT KDS software",
    "Pharmacy expiry billing app",
    "Double entry accounting software",
    "Customer Khata ledger software",
    "WhatsApp thermal receipts POS",
    "Cloud ERP Pakistan",
    "Billing software for shops"
  ],
  authors: [{ name: "The Accounts Engineering Team", url: "https://theaccounts.cloud" }],
  creator: "The Accounts",
  publisher: "The Accounts",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/the-accounts-mark.png" },
      { url: "/favicon.ico" },
    ],
    shortcut: ["/the-accounts-mark.png"],
    apple: ["/the-accounts-mark.png"],
  },
  openGraph: {
    title: "The Accounts | #1 All-in-One Cloud ERP, Accounting & POS Software",
    description: "Run your entire business without paperwork! Fast POS checkout, customer credit ledger, tailor sizes, restaurant KDS, pharmacy batches, and WhatsApp thermal receipts.",
    url: "https://theaccounts.cloud",
    siteName: "The Accounts",
    images: [
      {
        url: "/images/theaccounts_pos_dashboard_monitor.png",
        width: 1200,
        height: 630,
        alt: "The Accounts Cloud ERP POS & Accounting Software",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "The Accounts | #1 All-in-One Cloud ERP, Accounting & POS Software",
    description: "Cloud POS billing, stock inventory, customer credit ledger, and double-entry accounting for retail and service stores.",
    images: ["/images/theaccounts_pos_dashboard_monitor.png"],
    creator: "@theaccounts",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "The Accounts",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#4f46e5" },
    { media: "(prefers-color-scheme: dark)", color: "#312e81" },
  ],
};

const jsonLdSchema = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "SoftwareApplication",
      "@id": "https://theaccounts.cloud/#software",
      "name": "The Accounts",
      "url": "https://theaccounts.cloud",
      "applicationCategory": "BusinessApplication",
      "operatingSystem": "Web, Windows, macOS, Android, iOS",
      "offers": {
        "@type": "AggregateOffer",
        "priceCurrency": "PKR",
        "lowPrice": "0",
        "highPrice": "35000",
        "offerCount": "3"
      },
      "description": "All-in-One Cloud ERP, Double-Entry Accounting, Inventory & POS Software for Merchants and Retailers."
    },
    {
      "@type": "Organization",
      "@id": "https://theaccounts.cloud/#organization",
      "name": "The Accounts",
      "url": "https://theaccounts.cloud",
      "logo": "https://theaccounts.cloud/the-accounts-brand.png",
      "sameAs": [
        "https://facebook.com/theaccounts",
        "https://twitter.com/theaccounts"
      ]
    }
  ]
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      data-brand={isFlame9Brand() ? "flame9" : undefined}
      suppressHydrationWarning
    >
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdSchema) }}
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `if(typeof Element!=="undefined"&&Element.prototype.releasePointerCapture){const orig=Element.prototype.releasePointerCapture;Element.prototype.releasePointerCapture=function(id){try{if(!this.hasPointerCapture||this.hasPointerCapture(id)){orig.call(this,id);}}catch(e){}};}`,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        <LanguageProvider>
          <RegisterSW />
          {children}
          <Toaster position="top-center" />
          <AccountsAiAgentWidget />
        </LanguageProvider>
      </body>
    </html>
  );
}
