import type { Metadata } from "next";
import { Bebas_Neue, DM_Sans, Plus_Jakarta_Sans } from "next/font/google";
import Flame9Landing from "@/components/branding/Flame9Landing";
import TheAccountsLabsLanding from "@/components/landing/TheAccountsLabsLanding";
import { FLAME9, isFlame9Brand } from "@/lib/deployment/flame9-brand";
import { buildHomePageJsonLd, homePageMetadata } from "@/lib/seo/home-page";

const landingFont = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-landing",
  display: "swap",
  weight: ["400", "500", "600", "700", "800"],
});

const flame9Display = Bebas_Neue({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-flame9-display",
});

const flame9Body = DM_Sans({
  subsets: ["latin"],
  variable: "--font-flame9-body",
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = isFlame9Brand()
  ? {
      title: `${FLAME9.fullName} | POS & Kitchen`,
      description: `${FLAME9.fullName} — pizza, café, tables, KDS and billing. ${FLAME9.tagline}`,
    }
  : homePageMetadata;

export default function Home() {
  if (isFlame9Brand()) {
    return (
      <div className={`${flame9Display.variable} ${flame9Body.variable} ${flame9Body.className}`}>
        <Flame9Landing />
      </div>
    );
  }

  const jsonLd = buildHomePageJsonLd();

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <div className={`${landingFont.variable} ${landingFont.className}`}>
        <TheAccountsLabsLanding />
      </div>
    </>
  );
}
