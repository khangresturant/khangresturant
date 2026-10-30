import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getPlatformShopId } from "@/lib/config";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { imageBase64, mimeType = "image/jpeg", importType = "products", customInstructions } = body;

    if (!imageBase64) {
      return NextResponse.json(
        { success: false, error: "Image data (Base64) is required for AI Vision OCR" },
        { status: 400 }
      );
    }

    // 1. Clean base64 string
    const cleanBase64 = imageBase64.replace(/^data:image\/[a-zA-Z0-9+]+;base64,/, "").trim();

    // 2. Fetch Gemini API keys from Global Platform Settings & ENV
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://theaccounts.cloud/supabase";
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
    const serviceSupabase = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false },
    });

    let apiKeysList: string[] = [];
    let selectedModel = "gemini-2.5-flash";

    try {
      const { data: platformCompany } = await serviceSupabase
        .from("company_details")
        .select("website")
        .eq("shop_id", getPlatformShopId())
        .maybeSingle();

      if (platformCompany?.website) {
        const raw = platformCompany.website.trim();
        if (raw.startsWith("{")) {
          const cleaned = raw.replace(/[\u0000-\u001F\u007F-\u009F]/g, " ");
          const parsed = JSON.parse(cleaned);
          if (parsed.global_gemini_api_keys) {
            apiKeysList = parsed.global_gemini_api_keys.split("\n").map((k: string) => k.trim()).filter(Boolean);
          }
          if (parsed.global_gemini_model) {
            selectedModel = parsed.global_gemini_model;
          }
        }
      }
    } catch (e) {
      console.warn("Could not load SaaS global keys for OCR:", e);
    }

    if (process.env.GEMINI_API_KEY) {
      apiKeysList.push(process.env.GEMINI_API_KEY.trim());
    }
    if (process.env.NEXT_PUBLIC_GEMINI_API_KEY) {
      apiKeysList.push(process.env.NEXT_PUBLIC_GEMINI_API_KEY.trim());
    }
    apiKeysList = Array.from(new Set(apiKeysList.filter(Boolean)));

    if (apiKeysList.length === 0) {
      return NextResponse.json(
        { success: false, error: "No Gemini API keys configured on platform. Please add a key in Platform Settings." },
        { status: 500 }
      );
    }

    // 3. Build Specialized Vision OCR Prompt based on import type
    let targetHeaders: string[] = [];
    let fieldInstructions = "";

    if (importType === "products") {
      targetHeaders = ["Item Name", "Sale Price", "Cost Price", "Stock Qty", "Barcode", "Unit"];
      fieldInstructions = `
You are extracting a PRODUCT CATALOG / INVENTORY LIST from this handwritten register, typed list, invoice, or purchase bill.
Extract each row into the following standard fields:
- "Item Name": The full product / medicine / item name (transcribe Urdu, English, or Roman Urdu accurately).
- "Sale Price": Retail selling rate / sale price as a number (e.g. 350). If not present, default to 0.
- "Cost Price": Wholesale / purchase cost rate as a number (e.g. 280). If not present, default to 0.
- "Stock Qty": Available quantity or purchase quantity as a number (e.g. 10). If not present, default to 1.
- "Barcode": Product code, SKU, or batch number if written, otherwise "".
- "Unit": Unit of measure (e.g. "Pcs", "Box", "Pack", "Kg", "Ltr", "Strips"). Default to "Pcs" if not specified.
`;
    } else if (importType === "customers") {
      targetHeaders = ["Customer Name", "Phone", "Address", "Opening Balance"];
      fieldInstructions = `
You are extracting a CUSTOMER KHATA / UDHAAR LEDGER (گاہکوں کا ادھار کھاتہ) from this handwritten diary, register page, or customer list.
Extract each row into the following standard fields:
- "Customer Name": Name of the person, shop, or customer (e.g. "Muhammad Rashid", "چوہدری علی", "Rashid Tailor").
- "Phone": Mobile number if written (e.g. "03001234567"), otherwise "".
- "Address": City, shop location, or area if written, otherwise "".
- "Opening Balance": The pending receivable / udhaar balance as a numeric amount (e.g. 4500). If positive udhaar/receivable, write positive number.
`;
    } else {
      targetHeaders = ["Supplier Name", "Phone", "Address", "Opening Balance"];
      fieldInstructions = `
You are extracting a SUPPLIER / DISTRIBUTOR PAYABLES LIST from this handwritten register, distributor bill, or ledger.
Extract each row into the following standard fields:
- "Supplier Name": Distributor, vendor, or supplier company name (e.g. "Al-Rehman Traders", "رحمان میڈیسن ڈسٹری بیوٹرز").
- "Phone": Contact number if written, otherwise "".
- "Address": City or market location if written, otherwise "".
- "Opening Balance": The payable balance owed to this supplier as a numeric amount (e.g. 35000).
`;
    }

    const visionPrompt = `
You are the World's Best OCR & Handwriting Transcription AI Specialist for Business Ledgers, Khatas, Registers, Invoices, and Inventory Sheets in Urdu, English, Roman Urdu, and Arabic.

YOUR TASK:
Analyze the provided image carefully and transcribe all items/rows into structured JSON data.

GUIDELINES:
1. Transcribe handwritten text with extreme precision. If words are written in Urdu Nastaliq script (e.g. پیناڈول، شلوار قمیض، چاول، صابن، ادھار، کھاتہ), transcribe them accurately in Urdu script or English equivalent.
2. Convert Eastern Arabic/Urdu numerals (۰, ۱, ۲, ۳, ۴, ۵, ۶, ۷, ۸, ۹) into standard Western Arabic numbers (0, 1, 2, 3, 4, 5, 6, 7, 8, 9).
3. Do NOT skip any rows or items visible in the image.
4. Clean up noise: ignore stray page lines, ink stains, or doodles.
${customInstructions ? `Special User Instruction: ${customInstructions}` : ""}

${fieldInstructions}

OUTPUT FORMAT:
You MUST return ONLY valid raw JSON conforming exactly to this structure (no markdown fences, no conversational text):
{
  "detectedTitle": "Brief description of the document (e.g. 'Handwritten Customer Khata')",
  "detectedLanguage": "Urdu / English",
  "headers": ${JSON.stringify(targetHeaders)},
  "rows": [
    {
      ${targetHeaders.map(h => `"${h}": ...`).join(",\n      ")}
    }
  ]
}
`;

    // 4. Call Gemini Vision API with model fallback rotation
    const candidateModels = [
      selectedModel,
      "gemini-2.5-flash",
      "gemini-2.0-flash",
      "gemini-1.5-flash",
      "gemini-1.5-pro",
    ].filter((m, i, arr) => m && arr.indexOf(m) === i);

    let parsedResult: any = null;
    let rawAiText = "";
    let geminiSuccess = false;

    for (const apiKey of apiKeysList) {
      if (geminiSuccess) break;
      for (const modelToTry of candidateModels) {
        try {
          const res = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${modelToTry}:generateContent?key=${apiKey}`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                contents: [
                  {
                    role: "user",
                    parts: [
                      { text: visionPrompt },
                      {
                        inline_data: {
                          mime_type: mimeType,
                          data: cleanBase64,
                        },
                      },
                    ],
                  },
                ],
                generationConfig: {
                  temperature: 0.1,
                  maxOutputTokens: 8192,
                  responseMimeType: "application/json",
                },
              }),
            }
          );

          if (res.status === 429) {
            console.warn(`Gemini Vision key rate limited on ${modelToTry}. Trying next...`);
            continue;
          }

          if (!res.ok) {
            const errText = await res.text();
            console.warn(`Gemini Vision error on ${modelToTry}:`, errText);
            continue;
          }

          const data = await res.json();
          rawAiText = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";

          if (rawAiText) {
            // Clean markdown code blocks if wrapped
            const jsonText = rawAiText
              .replace(/^```json/i, "")
              .replace(/^```/i, "")
              .replace(/```$/i, "")
              .trim();

            parsedResult = JSON.parse(jsonText);
            geminiSuccess = true;
            break;
          }
        } catch (callErr) {
          console.error(`Gemini Vision call failed on model ${modelToTry}:`, callErr);
        }
      }
    }

    if (!geminiSuccess || !parsedResult) {
      return NextResponse.json(
        {
          success: false,
          error: "AI Vision could not extract structured records from the image. Please ensure the photo is clear, well-lit, and legible.",
          rawText: rawAiText,
        },
        { status: 422 }
      );
    }

    // Ensure rows array exists
    const rows = Array.isArray(parsedResult.rows) ? parsedResult.rows : [];
    const headers = Array.isArray(parsedResult.headers) && parsedResult.headers.length > 0 
      ? parsedResult.headers 
      : targetHeaders;

    return NextResponse.json({
      success: true,
      detectedTitle: parsedResult.detectedTitle || "Scanned Document",
      detectedLanguage: parsedResult.detectedLanguage || "Multi-lingual",
      headers,
      rows,
      extractedCount: rows.length,
    });
  } catch (err: any) {
    console.error("AI Vision OCR scan error:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to process image with AI Vision" },
      { status: 500 }
    );
  }
}
