"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles,
  Bot,
  X,
  Send,
  User,
  ExternalLink,
  Maximize2,
  Minimize2,
  GripVertical,
  Database,
  Building2,
  Globe,
  Loader2,
  RefreshCw,
  HelpCircle,
  TrendingUp,
  Package,
  Users
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

interface ChatMessage {
  id: string;
  sender: "ai" | "user";
  text: string;
  timestamp: string;
  links?: { label: string; url: string }[];
}

const POS_STORAGE_KEY = "accounts-ai-widget-position";
const DRAG_THRESHOLD_PX = 6;

type WidgetPosition = { x: number; y: number };

type DragSession = {
  startX: number;
  startY: number;
  origX: number;
  origY: number;
  moved: boolean;
  width: number;
  height: number;
};

function clampPosition(x: number, y: number, width: number, height: number): WidgetPosition {
  if (typeof window === "undefined") return { x, y };
  const margin = 8;
  const maxX = Math.max(margin, window.innerWidth - width - margin);
  const maxY = Math.max(margin, window.innerHeight - height - margin);
  return {
    x: Math.min(Math.max(margin, x), maxX),
    y: Math.min(Math.max(margin, y), maxY),
  };
}

function defaultPosition(width: number, height: number): WidgetPosition {
  if (typeof window === "undefined") return { x: 16, y: 16 };
  return clampPosition(window.innerWidth - width - 20, window.innerHeight - height - 20, width, height);
}

const LOGGED_IN_SUGGESTIONS = [
  "📈 Aaj ki sale kitni hui?",
  "⚠️ Low stock medicines / items?",
  "👥 Udhaar khata kis kis ka baqi hai?",
  "💰 Cash & bank balance kitna hai?",
  "🚀 POS Bill kaise banayein?",
  "📊 Profit & Loss GL Report dekhein"
];

const GUEST_SUGGESTIONS = [
  "💳 Plans & Pricing kya hain?",
  "🎁 14-Day Free Trial kaise shuru karein?",
  "💊 Pharmacy vs Restaurant features?",
  "💬 WhatsApp Sales Support"
];

export function AccountsAiAgentWidget() {
  const pathname = usePathname();
  const supabase = createClient();

  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [pos, setPos] = useState<WidgetPosition | null>(null);
  
  // Auth & Shop context
  const [shopId, setShopId] = useState<string | null>(null);
  const [shopName, setShopName] = useState<string | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const dragSessionRef = useRef<DragSession | null>(null);
  const tapAfterDragRef = useRef<(() => void) | null>(null);

  const bubbleSize = 56;
  const panelWidth = typeof window !== "undefined" && window.innerWidth < 640 ? Math.min(window.innerWidth * 0.94, 420) : 420;
  const panelHeight = isMinimized ? 70 : Math.min(600, typeof window !== "undefined" ? window.innerHeight * 0.85 : 600);

  const widgetWidth = isOpen ? panelWidth : bubbleSize;
  const widgetHeight = isOpen ? panelHeight : bubbleSize;

  const clampCurrent = useCallback(
    (x: number, y: number, w = widgetWidth, h = widgetHeight) => clampPosition(x, y, w, h),
    [widgetWidth, widgetHeight]
  );

  // Check user auth and shop context on mount & route change
  const refreshShopContext = useCallback(async () => {
    try {
      let resolvedShopId: string | null = null;
      let resolvedShopName: string | null = null;

      // 1. Try hisabx_shop_context from localStorage
      if (typeof window !== "undefined") {
        try {
          const cached = localStorage.getItem("hisabx_shop_context");
          if (cached) {
            const parsed = JSON.parse(cached);
            if (parsed.shopId) {
              resolvedShopId = parsed.shopId;
              resolvedShopName = parsed.shopName || null;
            }
          }
        } catch {}
        if (!resolvedShopId) {
          resolvedShopId = localStorage.getItem("current_shop_id");
        }
      }

      // 2. Check Supabase auth session
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;

      if (user) {
        setIsLoggedIn(true);

        if (!resolvedShopId) {
          const { data: profile } = await supabase
            .from("user_profiles")
            .select("shop_id")
            .eq("id", user.id)
            .maybeSingle();

          if (profile?.shop_id) {
            resolvedShopId = profile.shop_id;
          }
        }

        if (!resolvedShopId) {
          const { data: ownerShop } = await supabase
            .from("shops")
            .select("id, name")
            .eq("owner_id", user.id)
            .maybeSingle();

          if (ownerShop?.id) {
            resolvedShopId = ownerShop.id;
            resolvedShopName = ownerShop.name;
          }
        }
      } else {
        // If pathname is in dashboard, user is logged in
        if (typeof window !== "undefined" && window.location.pathname.startsWith("/dashboard")) {
          setIsLoggedIn(true);
        } else {
          setIsLoggedIn(false);
        }
      }

      // 3. Fallback for dashboard views
      if (!resolvedShopId && typeof window !== "undefined" && window.location.pathname.startsWith("/dashboard")) {
        const { data: firstShop } = await supabase
          .from("shops")
          .select("id, name")
          .limit(1)
          .maybeSingle();

        if (firstShop?.id) {
          resolvedShopId = firstShop.id;
          resolvedShopName = firstShop.name;
        }
      }

      if (resolvedShopId) {
        setShopId(resolvedShopId);
        setIsLoggedIn(true);
        if (!resolvedShopName) {
          const { data: comp } = await supabase
            .from("company_details")
            .select("company_name")
            .eq("shop_id", resolvedShopId)
            .maybeSingle();
          if (comp?.company_name) {
            resolvedShopName = comp.company_name;
          } else {
            const { data: sh } = await supabase
              .from("shops")
              .select("name")
              .eq("id", resolvedShopId)
              .maybeSingle();
            if (sh?.name) resolvedShopName = sh.name;
          }
        }
        setShopName(resolvedShopName || "My Business");
      }
    } catch (e) {
      console.warn("Failed to check auth in AI widget:", e);
    }
  }, [supabase]);

  useEffect(() => {
    refreshShopContext();
  }, [pathname, refreshShopContext]);

  // Position load / persist
  useEffect(() => {
    const w = bubbleSize;
    const h = bubbleSize;
    try {
      const raw = localStorage.getItem(POS_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as WidgetPosition;
        setPos(clampPosition(parsed.x, parsed.y, w, h));
        return;
      }
    } catch {
      /* ignore */
    }
    setPos(defaultPosition(w, h));
  }, []);

  useEffect(() => {
    if (!pos) return;
    try {
      localStorage.setItem(POS_STORAGE_KEY, JSON.stringify(pos));
    } catch {
      /* ignore */
    }
  }, [pos]);

  useEffect(() => {
    if (!pos) return;
    const onResize = () => setPos((p) => (p ? clampCurrent(p.x, p.y) : p));
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [pos, clampCurrent]);

  useEffect(() => {
    if (!pos || !isOpen) return;
    setPos((p) => (p ? clampCurrent(p.x, p.y, panelWidth, panelHeight) : p));
  }, [isOpen, isMinimized, panelWidth, panelHeight, clampCurrent]);

  const beginDrag = (clientX: number, clientY: number, onTap?: () => void) => {
    if (!pos) return;
    tapAfterDragRef.current = onTap ?? null;
    dragSessionRef.current = {
      startX: clientX,
      startY: clientY,
      origX: pos.x,
      origY: pos.y,
      moved: false,
      width: widgetWidth,
      height: widgetHeight,
    };
  };

  const moveDrag = (clientX: number, clientY: number) => {
    const session = dragSessionRef.current;
    if (!session) return;
    const dx = clientX - session.startX;
    const dy = clientY - session.startY;
    if (!session.moved && (Math.abs(dx) > DRAG_THRESHOLD_PX || Math.abs(dy) > DRAG_THRESHOLD_PX)) {
      session.moved = true;
    }
    if (session.moved) {
      setPos(clampPosition(session.origX + dx, session.origY + dy, session.width, session.height));
    }
  };

  const endDrag = () => {
    const session = dragSessionRef.current;
    const onTap = tapAfterDragRef.current;
    dragSessionRef.current = null;
    tapAfterDragRef.current = null;
    if (session && !session.moved && onTap) onTap();
  };

  const [messages, setMessages] = useState<ChatMessage[]>(() => [
    {
      id: "welcome-1",
      sender: "ai",
      text: "Assalam-o-Alaikum! 👋 Main **Accounts AI Agent** hoon — aap ka 24/7 AI Developer & Business Co-Pilot.\n\nAap mujh se apni **live sales, stock inventory, customer udhaar khata, POS billing, ya software ke kisi bhi feature** ke baray me pooch saktay hain!",
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      links: [
        { label: "🚀 POS Billing", url: "/dashboard/pos" },
        { label: "👥 Customer Khata", url: "/dashboard/khata" },
        { label: "📦 Products Stock", url: "/dashboard/products" }
      ],
    },
  ]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  const handleSend = async (textToSend?: string) => {
    const query = textToSend || input;
    if (!query.trim() || isTyping) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      sender: "user",
      text: query,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!textToSend) setInput("");
    setIsTyping(true);

    try {
      let effectiveShopId = shopId;
      if (!effectiveShopId && typeof window !== "undefined") {
        try {
          const cached = localStorage.getItem("hisabx_shop_context");
          if (cached) {
            const parsed = JSON.parse(cached);
            if (parsed.shopId) effectiveShopId = parsed.shopId;
          }
        } catch {}
        if (!effectiveShopId) {
          effectiveShopId = localStorage.getItem("current_shop_id");
        }
      }

      const res = await fetch("/api/ai-agent/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: query,
          history: messages.slice(-6).map((m) => ({ sender: m.sender, text: m.text })),
          shopId: effectiveShopId || undefined,
          pathname: typeof window !== "undefined" ? window.location.pathname : (pathname || "/dashboard"),
        }),
      });

      const data = await res.json();

      if (data?.connectedShop) {
        setShopName(data.connectedShop);
        setIsLoggedIn(true);
      }

      const aiMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        sender: "ai",
        text: data?.text || "Main aap ka sawal samajh nahi paya, baraye meherbani dobara try karein.",
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        links: data?.links || [],
      };

      setMessages((prev) => [...prev, aiMsg]);
    } catch (err) {
      console.error("AI Chat Error:", err);
      const errorMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        sender: "ai",
        text: "Network issue ki wajah se AI response nahi aa saka. Baraye meherbani internet connection check karein ya WhatsApp support se rabta karein.",
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        links: [{ label: "💬 WhatsApp Support", url: "https://wa.me/923241974677" }],
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsTyping(false);
    }
  };

  if (!pos) return null;

  const fixedStyle: React.CSSProperties = {
    position: "fixed",
    left: pos.x,
    top: pos.y,
    zIndex: isOpen ? 350 : 300,
    touchAction: "none",
  };

  const activeSuggestions = isLoggedIn ? LOGGED_IN_SUGGESTIONS : GUEST_SUGGESTIONS;

  return (
    <>
      {!isOpen && (
        <motion.div
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          style={fixedStyle}
          className="flex items-center gap-3 group cursor-grab active:cursor-grabbing"
          onPointerDown={(e) => {
            if (e.button !== 0) return;
            e.currentTarget.setPointerCapture(e.pointerId);
            beginDrag(e.clientX, e.clientY, () => setIsOpen(true));
          }}
          onPointerMove={(e) => moveDrag(e.clientX, e.clientY)}
          onPointerUp={(e) => {
            endDrag();
            try {
              e.currentTarget.releasePointerCapture(e.pointerId);
            } catch {
              /* already released */
            }
          }}
          onPointerCancel={(e) => {
            endDrag();
            try {
              e.currentTarget.releasePointerCapture(e.pointerId);
            } catch {
              /* already released */
            }
          }}
        >
          <div className="hidden sm:flex opacity-0 group-hover:opacity-100 transition-all duration-300 items-center gap-2 bg-slate-900/95 text-white text-xs px-3.5 py-2 rounded-2xl border border-slate-700/80 shadow-2xl backdrop-blur-xl pointer-events-none whitespace-nowrap">
            <Sparkles size={14} className="text-amber-400 animate-spin" />
            <span className="font-bold">Accounts AI · Live DB & Gemini</span>
          </div>

          <div
            className="relative w-14 h-14 rounded-full bg-gradient-to-tr from-emerald-600 via-teal-500 to-cyan-500 text-white shadow-2xl flex items-center justify-center select-none"
            title="Drag to move · Click to open Accounts AI Agent"
          >
            <span className="absolute -inset-1 rounded-full bg-gradient-to-r from-emerald-500 to-cyan-500 opacity-75 blur animate-pulse" />
            <Bot size={26} className="relative z-10 pointer-events-none" />
            <span className="absolute top-0 right-0 w-3.5 h-3.5 bg-emerald-400 border-2 border-white rounded-full z-20" />
          </div>
        </motion.div>
      )}

      {/* CHAT PANEL */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
            style={{ ...fixedStyle, width: panelWidth }}
            className={`bg-slate-900 text-white rounded-3xl shadow-2xl border border-slate-800 flex flex-col overflow-hidden backdrop-blur-2xl ${
              isMinimized ? "h-[70px]" : "max-h-[85vh]"
            }`}
          >
            {/* Header */}
            <div
              className="bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 p-4 border-b border-slate-800 flex items-center justify-between shrink-0 select-none cursor-grab active:cursor-grabbing"
              onPointerDown={(e) => {
                if (e.button !== 0) return;
                e.currentTarget.setPointerCapture(e.pointerId);
                beginDrag(e.clientX, e.clientY);
              }}
              onPointerMove={(e) => moveDrag(e.clientX, e.clientY)}
              onPointerUp={(e) => {
                endDrag();
                try {
                  e.currentTarget.releasePointerCapture(e.pointerId);
                } catch {
                  /* already released */
                }
              }}
              onPointerCancel={(e) => {
                endDrag();
                try {
                  e.currentTarget.releasePointerCapture(e.pointerId);
                } catch {
                  /* already released */
                }
              }}
            >
              <div className="flex items-center gap-2 min-w-0 flex-1 pointer-events-none">
                <GripVertical size={16} className="text-slate-500 shrink-0" />
                <div className="relative w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-500 to-cyan-500 flex items-center justify-center text-white font-black shadow-md shrink-0">
                  <Bot size={22} />
                  <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-400 border border-slate-950 rounded-full" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <h3 className="font-black text-sm text-white tracking-tight">Accounts AI Agent</h3>
                    <span className="px-1.5 py-0.5 bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 text-[9px] font-extrabold rounded-md uppercase flex items-center gap-0.5">
                      <Sparkles size={9} /> Gemini Powered
                    </span>
                  </div>
                  <div className="flex items-center gap-1 text-[10px] text-slate-400 font-medium truncate mt-0.5">
                    {isLoggedIn ? (
                      <span className="inline-flex items-center gap-1 text-emerald-400 font-bold">
                        <Database size={10} /> Live DB: {shopName || "My Business"}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-sky-400 font-bold">
                        <Globe size={10} /> Guest Mode · Plans & Features Guide
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={() => setIsMinimized(!isMinimized)}
                  className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-white rounded-xl transition cursor-pointer"
                  title={isMinimized ? "Expand Chat" : "Minimize Chat"}
                >
                  {isMinimized ? <Maximize2 size={15} /> : <Minimize2 size={15} />}
                </button>
                <button
                  type="button"
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={() => setIsOpen(false)}
                  className="p-1.5 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 rounded-xl transition cursor-pointer"
                  title="Close Assistant"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Chat Body */}
            {!isMinimized && (
              <>
                <div className="flex-1 min-h-[320px] p-4 overflow-y-auto space-y-4 bg-slate-950/60 custom-scrollbar">
                  {messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`flex flex-col ${msg.sender === "user" ? "items-end" : "items-start"}`}
                    >
                      <div className="flex items-end gap-2 max-w-[90%]">
                        {msg.sender === "ai" && (
                          <div className="w-7 h-7 rounded-xl bg-emerald-600/30 border border-emerald-500/40 text-emerald-400 flex items-center justify-center shrink-0 shadow-xs">
                            <Bot size={14} />
                          </div>
                        )}

                        <div
                          className={`p-3.5 rounded-2xl text-xs leading-relaxed font-medium shadow-md ${
                            msg.sender === "user"
                              ? "bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-br-none font-semibold"
                              : "bg-slate-900/90 border border-slate-800 text-slate-200 rounded-bl-none"
                          }`}
                        >
                          <div className="whitespace-pre-line leading-relaxed">
                            {msg.text}
                          </div>

                          {/* Interactive Action Links */}
                          {msg.links && msg.links.length > 0 && (
                            <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex flex-wrap gap-2">
                              {msg.links.map((link, idx) => (
                                <Link
                                  key={idx}
                                  href={link.url}
                                  target={link.url.startsWith("http") ? "_blank" : "_self"}
                                  className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-300 rounded-xl text-[11px] font-bold transition-all shadow-sm active:scale-95"
                                >
                                  {link.label} <ExternalLink size={10} />
                                </Link>
                              ))}
                            </div>
                          )}
                        </div>

                        {msg.sender === "user" && (
                          <div className="w-7 h-7 rounded-xl bg-slate-800 border border-slate-700 text-slate-300 flex items-center justify-center shrink-0">
                            <User size={14} />
                          </div>
                        )}
                      </div>

                      <span className="text-[9px] text-slate-500 mt-1 px-1">
                        {msg.timestamp}
                      </span>
                    </div>
                  ))}

                  {/* Thinking Indicator */}
                  {isTyping && (
                    <div className="flex items-center gap-2 text-slate-400 text-xs italic bg-slate-900/80 border border-slate-800 p-2.5 rounded-2xl w-fit animate-pulse">
                      <Loader2 size={14} className="text-emerald-400 animate-spin" />
                      <span>Accounts AI database aur Gemini analyze kar raha hai...</span>
                    </div>
                  )}

                  <div ref={messagesEndRef} />
                </div>

                {/* Quick Suggestion Chips */}
                <div className="p-2.5 bg-slate-950 border-t border-slate-800/80 overflow-x-auto whitespace-nowrap custom-scrollbar flex gap-2">
                  {activeSuggestions.map((sug, i) => (
                    <button
                      key={i}
                      onClick={() => handleSend(sug)}
                      disabled={isTyping}
                      className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-emerald-400 border border-slate-800 rounded-xl text-[10px] font-bold transition-all shrink-0 cursor-pointer disabled:opacity-40"
                    >
                      {sug}
                    </button>
                  ))}
                </div>

                {/* Input Bar */}
                <div className="p-3 bg-slate-950 border-t border-slate-800 flex items-center gap-2">
                  <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSend()}
                    disabled={isTyping}
                    placeholder={
                      isLoggedIn
                        ? "Poochhein (e.g. aaj ki sale, low stock, udhaar, POS bill)..."
                        : "Poochhein (e.g. pricing plans, features, trial)..."
                    }
                    className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition font-medium disabled:opacity-50"
                  />
                  <button
                    onClick={() => handleSend()}
                    disabled={!input.trim() || isTyping}
                    className="p-2 bg-gradient-to-tr from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white rounded-xl disabled:opacity-40 transition-all cursor-pointer shadow-md active:scale-95"
                  >
                    <Send size={15} />
                  </button>
                </div>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
