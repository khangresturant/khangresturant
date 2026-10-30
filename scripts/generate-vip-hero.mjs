import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://theaccounts.cloud/supabase";
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzgzNzA4NDg2LCJleHAiOjE5NDEzODg0ODZ9.utdOHNlj1uk6Xj4EjmshzijYzsSX6wqggmXdaa5TQZs";
  const supabase = createClient(supabaseUrl, supabaseAnonKey);

  let apiKeys = [];
  try {
    const { data } = await supabase.from("company_details").select("website").limit(5);
    if (data) {
      for (const row of data) {
        if (row.website && row.website.startsWith("{")) {
          const parsed = JSON.parse(row.website);
          if (parsed.global_gemini_api_keys) {
            apiKeys.push(...parsed.global_gemini_api_keys.split("\n").map(k => k.trim()).filter(Boolean));
          }
        }
      }
    }
  } catch (e) {}

  if (process.env.GEMINI_API_KEY) apiKeys.push(process.env.GEMINI_API_KEY.trim());
  if (process.env.NEXT_PUBLIC_GEMINI_API_KEY) apiKeys.push(process.env.NEXT_PUBLIC_GEMINI_API_KEY.trim());
  apiKeys = Array.from(new Set(apiKeys.filter(Boolean)));

  console.log("Found Gemini API Keys count:", apiKeys.length);

  const prompt = "Hyper-realistic 3D isometric render of an ultra-luxury SaaS software ecosystem for 'The Accounts' cloud ERP. In the center, an ultra-thin Apple Pro monitor displaying a glowing dark-mode business dashboard with sales trend graphs, inventory metrics, and financial KPIs. On the left, a titanium smartphone standing upright displaying a colorful mobile POS register. Floating dynamically in the air with realistic glassmorphism transparency and soft shadows are a crisp digital receipt invoice slip, an orange-red Khata Due Reminder card with a WhatsApp icon, and glowing 3D glass cube icons for pharmacy cross, money stack, and rocket. Polished black marble desk, dramatic studio neon rim lighting, 8k resolution.";

  for (const key of apiKeys) {
    try {
      console.log("Trying Imagen with key ending in...", key.slice(-6));
      const url = `https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-002:predict?key=${key}`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          instances: [{ prompt: prompt }],
          parameters: { sampleCount: 1, aspectRatio: "4:3", outputMimeType: "image/jpeg" }
        })
      });

      if (!res.ok) {
        const err = await res.text();
        console.warn("Key error on Imagen:", err.slice(0, 150));
        continue;
      }

      const json = await res.json();
      if (json.predictions && json.predictions[0]?.bytesBase64Encoded) {
        const buffer = Buffer.from(json.predictions[0].bytesBase64Encoded, "base64");
        const outPath = path.join(process.cwd(), "public/hero_mockup_3d.png");
        fs.writeFileSync(outPath, buffer);
        fs.writeFileSync(path.join(process.cwd(), "public/hero_preview.png"), buffer);
        fs.writeFileSync(path.join(process.cwd(), "public/images/theaccounts_pos_dashboard_monitor.png"), buffer);
        console.log("✅ Successfully generated brand new VIP 3D hero image! Size:", buffer.length, "bytes");
        return;
      }
    } catch (err) {
      console.error("Failed call:", err.message);
    }
  }

  console.log("No Imagen key succeeded, trying alternative...");
}

main();
