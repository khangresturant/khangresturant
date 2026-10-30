import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/client";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const resolvedParams = await params;
  const slug = resolvedParams.slug;
  const supabase = createClient();

  let { data: shop } = await supabase
    .from("shops")
    .select("id, name, store_slug, store_theme_color")
    .eq("store_slug", slug)
    .maybeSingle();

  if (!shop) {
    const { data: shopById } = await supabase
      .from("shops")
      .select("id, name, store_slug, store_theme_color")
      .eq("id", slug)
      .maybeSingle();
    shop = shopById;
  }

  const shopName = shop?.name || "The Accounts Store";
  const themeColor = shop?.store_theme_color || "#059669";

  const manifest = {
    name: shopName,
    short_name: shopName,
    description: `Official Online Store for ${shopName} powered by The Accounts`,
    start_url: `/store/${slug}`,
    display: "standalone",
    background_color: "#020617",
    theme_color: themeColor,
    icons: [
      {
        src: "/icon.png",
        sizes: "192x192",
        type: "image/png"
      },
      {
        src: "/icon.png",
        sizes: "512x512",
        type: "image/png"
      }
    ]
  };

  return NextResponse.json(manifest);
}
