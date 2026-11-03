import type { Metadata } from "next";
import FalconSwiftLanding from "@/components/branding/FalconSwiftLanding";

// ============================================================================
// Extra Multi-Business & Legacy Landing Pages commented out per user request:
// Only Restaurant-Centric "Falcon Swift" is active.
// ============================================================================
/*
import Flame9Landing from "@/components/branding/Flame9Landing";
import TheAccountsLabsLanding from "@/components/landing/TheAccountsLabsLanding";
import { FLAME9, isFlame9Brand } from "@/lib/deployment/flame9-brand";
import { buildHomePageJsonLd, homePageMetadata } from "@/lib/seo/home-page";
*/

export const metadata: Metadata = {
  title: "Falcon Swift | Restaurant POS & Kitchen Management System",
  description:
    "Falcon Swift is a high-performance Restaurant POS, KOT & KDS order workflow, table management, and dining operating system.",
  icons: {
    icon: "/falcon-swift-logo.jpg",
  },
};

export default function Home() {
  return <FalconSwiftLanding />;
}
