"use client";

import React, { useState, useEffect, useRef } from "react";
import { Mic, MicOff, Sparkles, CheckCircle2, X, ShoppingCart, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

interface AIVoicePosControllerProps {
  products: any[];
  onAddToCart: (product: any, quantity: number) => void;
}

export function AIVoicePosController({ products, onAddToCart }: AIVoicePosControllerProps) {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [lang, setLang] = useState<"ur-PK" | "en-US">("ur-PK");
  const [lastMatched, setLastMatched] = useState<{ name: string; qty: number } | null>(null);

  // Multi-match Modal States
  const [isMultiMatchOpen, setIsMultiMatchOpen] = useState(false);
  const [matchedResults, setMatchedResults] = useState<any[]>([]);
  const [voiceQuery, setVoiceQuery] = useState("");
  const [requestedQty, setRequestedQty] = useState(1);

  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = false;
        recognition.lang = lang;

        recognition.onstart = () => {
          setIsListening(true);
          setTranscript("");
        };

        recognition.onresult = (event: any) => {
          const spokenText = event.results[0][0].transcript;
          setTranscript(spokenText);
          processVoiceCommand(spokenText);
        };

        recognition.onerror = (event: any) => {
          console.error("Speech recognition error:", event.error);
          setIsListening(false);
          if (event.error !== "no-speech") {
            toast.error("Voice recognition error: " + event.error);
          }
        };

        recognition.onend = () => {
          setIsListening(false);
        };

        recognitionRef.current = recognition;
      }
    }
  }, [lang, products]);

  const toggleListening = () => {
    if (!recognitionRef.current) {
      toast.error("Voice Recognition is not supported on this browser. Please use Google Chrome or Edge.");
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
    } else {
      try {
        recognitionRef.current.lang = lang;
        recognitionRef.current.start();
      } catch (e) {
        console.error(e);
      }
    }
  };

  // Urdu & English Number Word Resolver
  const parseQuantityFromText = (text: string): { qty: number; cleanQuery: string } => {
    const urduNumbers: Record<string, number> = {
      "ek": 1, "aik": 1, "do": 2, "doo": 2, "teen": 3, "chaar": 4, "char": 4,
      "paanch": 5, "panch": 5, "che": 6, "chey": 6, "saat": 7, "aath": 8,
      "nau": 9, "das": 10, "gyara": 11, "bara": 12, "pandra": 15, "bees": 20, "pachas": 50, "sau": 100
    };

    const words = text.toLowerCase().split(/\s+/);
    let qty = 1;
    const remainingWords: string[] = [];

    for (let word of words) {
      const numMatch = word.match(/\d+/);
      if (numMatch) {
        qty = parseInt(numMatch[0], 10);
      } else if (urduNumbers[word]) {
        qty = urduNumbers[word];
      } else if (word !== "kilo" && word !== "packet" && word !== "bottle" && word !== "pcs" && word !== "aur" && word !== "and") {
        remainingWords.push(word);
      }
    }

    return {
      qty: Math.max(1, qty),
      cleanQuery: remainingWords.join(" ").trim()
    };
  };

  // Process Voice Command Text
  const processVoiceCommand = (text: string) => {
    if (!text || text.trim() === "") return;

    // Split compound voice queries
    const subQueries = text.split(/aur|and|,/i);

    subQueries.forEach((subText) => {
      const { qty, cleanQuery } = parseQuantityFromText(subText);
      if (!cleanQuery) return;

      const searchLower = cleanQuery.toLowerCase();
      
      // Filter ALL products containing the search keyword
      const allMatches = products.filter((p) => {
        const pName = (p.name || "").toLowerCase();
        const pCode = (p.code || "").toLowerCase();
        return pName.includes(searchLower) || (pCode && pCode === searchLower);
      });

      if (allMatches.length === 1) {
        // Single exact match -> Add directly to cart
        onAddToCart(allMatches[0], qty);
        setLastMatched({ name: allMatches[0].name, qty });
        toast.success(`AI Voice Added: ${qty} x ${allMatches[0].name}`);
      } else if (allMatches.length > 1) {
        // Multiple matches found -> Open AI Product Picker Modal!
        setMatchedResults(allMatches);
        setVoiceQuery(cleanQuery);
        setRequestedQty(qty);
        setIsMultiMatchOpen(true);
        toast.info(`Found ${allMatches.length} items matching "${cleanQuery}". Select your item.`);
      } else {
        toast.error(`Could not find product matching "${cleanQuery}"`);
      }
    });
  };

  const handlePickProductFromModal = (prod: any) => {
    onAddToCart(prod, requestedQty);
    setLastMatched({ name: prod.name, qty: requestedQty });
    toast.success(`AI Voice Added: ${requestedQty} x ${prod.name}`);
    setIsMultiMatchOpen(false);
  };

  return (
    <>
      <div className="flex items-center gap-1.5 bg-slate-900 text-white p-1 sm:p-1.5 px-2 sm:px-3 rounded-xl sm:rounded-2xl shadow-md border border-slate-800 shrink-0">
        <div className="flex items-center gap-0.5 sm:gap-1">
          <button
            onClick={() => setLang("ur-PK")}
            className={`px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-md sm:rounded-lg text-[9px] sm:text-[10px] font-black uppercase transition cursor-pointer ${
              lang === "ur-PK" ? "bg-indigo-600 text-white shadow-sm" : "text-slate-400 hover:text-white"
            }`}
            title="Urdu Voice Recognition"
          >
            <span className="sm:hidden">UR</span>
            <span className="hidden sm:inline">Urdu</span>
          </button>
          <button
            onClick={() => setLang("en-US")}
            className={`px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-md sm:rounded-lg text-[9px] sm:text-[10px] font-black uppercase transition cursor-pointer ${
              lang === "en-US" ? "bg-indigo-600 text-white shadow-sm" : "text-slate-400 hover:text-white"
            }`}
            title="English Voice Recognition"
          >
            <span className="sm:hidden">EN</span>
            <span className="hidden sm:inline">Eng</span>
          </button>
        </div>

        <Button
          onClick={toggleListening}
          size="sm"
          className={`h-6.5 sm:h-8 px-2 sm:px-3 rounded-lg sm:rounded-xl font-bold text-[10.5px] sm:text-xs flex items-center gap-1 sm:gap-1.5 transition cursor-pointer ${
            isListening
              ? "bg-rose-600 hover:bg-rose-700 text-white animate-pulse shadow-md shadow-rose-500/20"
              : "bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white shadow-md shadow-purple-500/20"
          }`}
        >
          {isListening ? (
            <>
              <MicOff size={13} className="animate-spin" />
              <span className="hidden sm:inline">Listening...</span>
            </>
          ) : (
            <>
              <Mic size={13} />
              <span className="hidden sm:inline">Voice POS</span>
            </>
          )}
        </Button>

        {lastMatched && (
          <span className="text-[9px] sm:text-[10px] font-bold bg-emerald-950 text-emerald-400 border border-emerald-800/80 px-1.5 sm:px-2.5 py-0.5 sm:py-1 rounded-lg flex items-center gap-1 animate-fadeIn max-w-[120px] truncate">
            <CheckCircle2 size={11} className="shrink-0" /> +{lastMatched.qty} {lastMatched.name}
          </span>
        )}
      </div>

      {/* Multi-Match Product Selection Popup Modal */}
      <AnimatePresence>
        {isMultiMatchOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white w-full max-w-xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[80vh]"
            >
              {/* Header */}
              <div className="p-5 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex justify-between items-center">
                <div>
                  <div className="flex items-center gap-2 text-indigo-400 font-extrabold text-xs uppercase tracking-widest">
                    <Sparkles size={16} /> AI Voice Smart Search
                  </div>
                  <h3 className="text-xl font-black tracking-tight mt-0.5">
                    Select Product for "{voiceQuery}" (Qty: {requestedQty})
                  </h3>
                  <p className="text-slate-300 text-xs mt-0.5">
                    Found {matchedResults.length} matching products. Click to add to cart:
                  </p>
                </div>

                <button
                  onClick={() => setIsMultiMatchOpen(false)}
                  className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Items List */}
              <div className="p-4 overflow-y-auto space-y-2 flex-1 bg-slate-50">
                {matchedResults.map((p) => (
                  <div
                    key={p.id}
                    onClick={() => handlePickProductFromModal(p)}
                    className="p-3.5 bg-white hover:bg-indigo-50/80 border border-slate-200 hover:border-indigo-500 rounded-2xl flex items-center justify-between transition cursor-pointer group shadow-sm"
                  >
                    <div>
                      <span className="font-extrabold text-sm text-slate-900 group-hover:text-indigo-900 block">
                        {p.name}
                      </span>
                      <span className="text-xs text-slate-500 font-medium">
                        Stock: {p.current_stock || 0} {p.unit || "Pcs"} • Cost: Rs {p.purchase_price_single || 0}
                      </span>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="font-black text-sm text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded-xl border border-indigo-100">
                        Rs {p.sale_price_single || 0}
                      </span>

                      <Button
                        size="sm"
                        className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-md cursor-pointer"
                      >
                        <ShoppingCart size={14} className="mr-1" /> + Add ({requestedQty})
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Footer */}
              <div className="p-3 bg-white border-t border-slate-200 flex justify-end">
                <Button
                  onClick={() => setIsMultiMatchOpen(false)}
                  variant="outline"
                  size="sm"
                  className="text-xs font-bold rounded-xl px-5"
                >
                  Cancel
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
