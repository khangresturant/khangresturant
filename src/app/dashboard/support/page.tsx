"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useShop } from "@/context/ShopContext";
import { shouldHideSupportTickets } from "@/lib/deployment/flame9-brand";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { 
  MessageSquare, Send, PlusCircle, CheckCircle2, 
  HelpCircle, Loader2, X, AlertCircle, Paperclip, Image as ImageIcon, FileText, XCircle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SubscriptionBlocker } from "@/components/dashboard/SubscriptionBlocker";

interface Ticket {
  id: string;
  subject: string;
  status: "open" | "replied" | "closed";
  created_at: string;
}

interface Reply {
  id: string;
  sender_role: "user" | "admin";
  sender_name: string;
  message: string;
  attachment: string | null;
  created_at: string;
}

export default function SupportPage() {
  const router = useRouter();
  const { shopId, subscriptionTier, userName } = useShop();
  const supabase = createClient();

  useEffect(() => {
    if (shouldHideSupportTickets()) {
      router.replace("/dashboard/restaurant/pos");
    }
  }, [router]);

  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [activeTicket, setActiveTicket] = useState<Ticket | null>(null);
  const [replies, setReplies] = useState<Reply[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  
  // Create Form State
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newSubject, setNewSubject] = useState("");
  const [initialMessage, setInitialMessage] = useState("");
  const [creating, setCreating] = useState(false);

  // Chat Input State
  const [replyText, setReplyText] = useState("");
  const [attachedFile, setAttachedFile] = useState<File | null>(null);
  const [attachPreview, setAttachPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (shopId && subscriptionTier !== "free") {
      fetchTickets();
    }
  }, [shopId, subscriptionTier]);

  useEffect(() => {
    if (activeTicket) {
      fetchReplies(activeTicket.id);
      
      const channel = supabase
        .channel(`replies:${activeTicket.id}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "support_ticket_replies",
            filter: `ticket_id=eq.${activeTicket.id}`
          },
          (payload: any) => {
            setReplies((prev) => [...prev, payload.new as Reply]);
            setTimeout(scrollToBottom, 100);
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [activeTicket]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const fetchTickets = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("support_tickets")
        .select("*")
        .eq("shop_id", shopId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setTickets(data || []);
    } catch (err: any) {
      toast.error("Failed to load support tickets: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchReplies = async (ticketId: string) => {
    try {
      const { data, error } = await supabase
        .from("support_ticket_replies")
        .select("*")
        .eq("ticket_id", ticketId)
        .order("created_at", { ascending: true });

      if (error) throw error;
      setReplies(data || []);
      setTimeout(scrollToBottom, 100);
    } catch (err: any) {
      toast.error("Failed to load replies: " + err.message);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      toast.error("File too large. Maximum allowed size is 10MB.");
      return;
    }
    setAttachedFile(file);
    if (file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = (ev) => setAttachPreview(ev.target?.result as string);
      reader.readAsDataURL(file);
    } else {
      setAttachPreview(null);
    }
    // reset input so re-selecting same file works
    e.target.value = "";
  };

  const uploadAttachment = async (file: File): Promise<string | null> => {
    const ext = file.name.split(".").pop();
    const path = `support/${shopId}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage
      .from("support-attachments")
      .upload(path, file, { upsert: false, contentType: file.type });
    if (error) {
      toast.error("File upload failed: " + error.message);
      return null;
    }
    const { data } = supabase.storage
      .from("support-attachments")
      .getPublicUrl(path);
    return data.publicUrl;
  };

  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubject.trim() || !initialMessage.trim()) {
      toast.error("Please fill in both subject and description.");
      return;
    }

    setCreating(true);
    try {
      const { data: ticket, error: ticketError } = await supabase
        .from("support_tickets")
        .insert({
          shop_id: shopId,
          subject: newSubject.trim(),
          status: "open"
        })
        .select()
        .single();

      if (ticketError) throw ticketError;

      const { error: replyError } = await supabase
        .from("support_ticket_replies")
        .insert({
          ticket_id: ticket.id,
          sender_role: "user",
          sender_name: userName || "Shop Owner",
          message: initialMessage.trim()
        });

      if (replyError) throw replyError;

      toast.success("Support ticket created successfully!");
      setIsCreateOpen(false);
      setNewSubject("");
      setInitialMessage("");
      fetchTickets();
      setActiveTicket(ticket);
    } catch (err: any) {
      toast.error("Failed to create ticket: " + err.message);
    } finally {
      setCreating(false);
    }
  };

  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeTicket || activeTicket.status === "closed") return;
    if (!replyText.trim() && !attachedFile) return;

    setSending(true);
    setUploading(!!attachedFile);
    try {
      let attachmentUrl: string | null = null;
      if (attachedFile) {
        attachmentUrl = await uploadAttachment(attachedFile);
        if (!attachmentUrl) { setSending(false); setUploading(false); return; }
      }

      const { error: replyError } = await supabase
        .from("support_ticket_replies")
        .insert({
          ticket_id: activeTicket.id,
          sender_role: "user",
          sender_name: userName || "Shop Owner",
          message: replyText.trim() || (attachedFile ? `📎 ${attachedFile.name}` : ""),
          attachment: attachmentUrl
        });

      if (replyError) throw replyError;

      await supabase
        .from("support_tickets")
        .update({ status: "open", updated_at: new Date().toISOString() })
        .eq("id", activeTicket.id);

      setReplyText("");
      setAttachedFile(null);
      setAttachPreview(null);
      setTickets(prev => prev.map(t => t.id === activeTicket.id ? { ...t, status: "open" } : t));
    } catch (err: any) {
      toast.error("Failed to send message: " + err.message);
    } finally {
      setSending(false);
      setUploading(false);
    }
  };

  const handleCloseTicket = async () => {
    if (!activeTicket) return;
    try {
      const { error } = await supabase
        .from("support_tickets")
        .update({ status: "closed", updated_at: new Date().toISOString() })
        .eq("id", activeTicket.id);

      if (error) throw error;
      toast.success("Ticket closed successfully.");
      setActiveTicket(prev => prev ? { ...prev, status: "closed" } : null);
      setTickets(prev => prev.map(t => t.id === activeTicket.id ? { ...t, status: "closed" } : t));
    } catch (err: any) {
      toast.error("Failed to close ticket: " + err.message);
    }
  };

  const isImageUrl = (url: string) => /\.(jpg|jpeg|png|gif|webp|svg)(\?|$)/i.test(url);

  if (subscriptionTier === "free") {
    return (
      <SubscriptionBlocker 
        featureName="Superadmin Support Help Desk"
        requiredPlan="Starter"
        description="Premium Ticketing and customer support communication is only available to subscribed paid partners."
      />
    );
  }

  return (
    <div className="h-[82vh] flex gap-5">
      {/* Left Pane: Tickets list */}
      <div className="w-80 bg-white border border-slate-200/80 rounded-3xl shadow-sm flex flex-col overflow-hidden shrink-0">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h2 className="font-extrabold text-slate-800 text-sm tracking-wide">SUPPORT TICKETS</h2>
            <p className="text-[10px] text-slate-400 font-semibold uppercase">Help desk communications</p>
          </div>
          <Button 
            onClick={() => setIsCreateOpen(true)}
            size="sm" 
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-[10px] h-8 rounded-xl flex items-center gap-1 shadow-sm shadow-blue-500/10 cursor-pointer"
          >
            <PlusCircle size={13} /> New Ticket
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-slate-50 p-2 space-y-1">
          {loading ? (
            <div className="h-48 flex items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
            </div>
          ) : tickets.length === 0 ? (
            <div className="h-48 flex flex-col items-center justify-center text-slate-400 text-center p-4">
              <HelpCircle size={32} className="text-slate-300 mb-2" />
              <p className="text-xs font-bold">No tickets yet.</p>
              <p className="text-[10px] text-slate-400 mt-1">Need help? Create a new support ticket above.</p>
            </div>
          ) : (
            tickets.map((t) => (
              <button
                key={t.id}
                onClick={() => setActiveTicket(t)}
                className={`w-full text-left p-3.5 rounded-2xl transition-all cursor-pointer border flex flex-col ${
                  activeTicket?.id === t.id
                    ? "bg-slate-50 border-blue-200/80 shadow-xs"
                    : "bg-transparent border-transparent hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors/50"
                }`}
              >
                <div className="flex items-start justify-between gap-2 mb-1.5">
                  <span className="font-extrabold text-slate-800 text-[11px] line-clamp-1 flex-1 leading-snug">{t.subject}</span>
                  <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded border ${
                    t.status === "closed"
                      ? "bg-slate-100 text-slate-500 border-slate-200"
                      : t.status === "replied"
                        ? "bg-emerald-50 text-emerald-600 border-emerald-100"
                        : "bg-amber-50 text-amber-600 border-amber-100"
                  }`}>
                    {t.status}
                  </span>
                </div>
                <div className="flex items-center justify-between text-[9px] text-slate-450 font-medium">
                  <span>ID: #{t.id.slice(0, 8).toUpperCase()}</span>
                  <span>{new Date(t.created_at).toLocaleDateString()}</span>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Right Pane: Chat/Thread */}
      <div className="flex-1 bg-white border border-slate-200/80 rounded-3xl shadow-sm flex flex-col overflow-hidden">
        {activeTicket ? (
          <>
            {/* Thread Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div>
                <span className="text-[9px] text-blue-600 font-black tracking-widest uppercase">Ticket Conversation</span>
                <h2 className="font-black text-slate-800 text-sm mt-0.5 leading-snug">{activeTicket.subject}</h2>
              </div>
              <div className="flex items-center gap-3">
                <span className={`text-[9px] font-black uppercase px-2.5 py-0.5 rounded-full border ${
                  activeTicket.status === "closed"
                    ? "bg-slate-150 text-slate-500 border-slate-200"
                    : activeTicket.status === "replied"
                      ? "bg-emerald-50 text-emerald-600 border-emerald-100"
                      : "bg-amber-50 text-amber-600 border-amber-100 animate-pulse"
                }`}>
                  {activeTicket.status === "closed" ? "Resolved / Closed" : `Status: ${activeTicket.status}`}
                </span>
                
                {activeTicket.status !== "closed" && (
                  <Button
                    onClick={handleCloseTicket}
                    variant="outline"
                    className="border-slate-200 text-rose-600 hover:bg-rose-50 hover:border-rose-100 font-extrabold text-[10px] h-8 rounded-xl cursor-pointer"
                  >
                    <CheckCircle2 size={13} className="mr-1" /> Close Ticket
                  </Button>
                )}
              </div>
            </div>

            {/* Conversation Messages */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-slate-50/20">
              {replies.map((r) => {
                const isAdmin = r.sender_role === "admin";
                return (
                  <div key={r.id} className={`flex ${isAdmin ? "justify-start" : "justify-end"}`}>
                    <div className={`max-w-[70%] rounded-3xl p-4 shadow-sm border ${
                      isAdmin
                        ? "bg-white text-slate-800 rounded-tl-sm border-slate-100"
                        : "bg-blue-600 text-white rounded-tr-sm border-blue-500/20 shadow-blue-500/5"
                    }`}>
                      <div className="flex justify-between items-center gap-4 mb-1 border-b pb-1 border-slate-100/10">
                        <span className={`text-[8px] font-black uppercase tracking-wider ${isAdmin ? "text-indigo-600" : "text-blue-200"}`}>
                          {isAdmin ? "Admin (The Accounts Team)" : "You"}
                        </span>
                        <span className={`text-[8px] ${isAdmin ? "text-slate-400" : "text-blue-200"}`}>
                          {new Date(r.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      {r.message && (
                        <p className="text-[11px] leading-relaxed whitespace-pre-wrap font-semibold mb-2">{r.message}</p>
                      )}
                      {r.attachment && (
                        <div className="mt-1">
                          {isImageUrl(r.attachment) ? (
                            <a href={r.attachment} target="_blank" rel="noopener noreferrer">
                              <img
                                src={r.attachment}
                                alt="attachment"
                                className="max-w-full max-h-56 rounded-2xl object-cover border border-white/20 hover:opacity-90 transition-opacity cursor-zoom-in"
                              />
                            </a>
                          ) : (
                            <a
                              href={r.attachment}
                              target="_blank"
                              rel="noopener noreferrer"
                              className={`flex items-center gap-2 p-2 rounded-xl border text-[10px] font-bold hover:opacity-80 transition-opacity ${
                                isAdmin ? "border-slate-200 text-slate-600 bg-slate-50" : "border-blue-400/30 text-blue-100 bg-blue-500/30"
                              }`}
                            >
                              <FileText size={14} /> View Attachment
                            </a>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* Thread Input Footer */}
            {activeTicket.status === "closed" ? (
              <div className="p-4 border-t border-slate-100 bg-slate-50 text-center text-[10px] text-slate-500 font-bold flex items-center justify-center gap-1.5">
                <AlertCircle size={14} className="text-slate-400" />
                This ticket has been marked as Resolved & Closed. Create a new support ticket if you have other queries.
              </div>
            ) : (
              <div className="border-t border-slate-100 bg-white">
                {/* Attachment Preview */}
                {attachedFile && (
                  <div className="px-4 pt-3 flex items-center gap-2">
                    <div className="flex items-center gap-2 bg-blue-50 border border-blue-100 rounded-xl px-3 py-1.5 text-xs text-blue-700 font-bold max-w-xs">
                      {attachPreview ? (
                        <img src={attachPreview} className="h-8 w-8 rounded-lg object-cover shrink-0" alt="preview" />
                      ) : (
                        <FileText size={16} className="shrink-0" />
                      )}
                      <span className="truncate max-w-[160px]">{attachedFile.name}</span>
                      <button
                        type="button"
                        onClick={() => { setAttachedFile(null); setAttachPreview(null); }}
                        className="text-blue-400 hover:text-rose-500 cursor-pointer ml-1"
                      >
                        <XCircle size={14} />
                      </button>
                    </div>
                  </div>
                )}
                <form onSubmit={handleSendReply} className="p-4 flex gap-2.5 items-center">
                  {/* Hidden file input */}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*,.pdf,.doc,.docx,.txt,.xlsx,.csv"
                    className="hidden"
                    onChange={handleFileSelect}
                  />
                  {/* Attachment button */}
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-10 h-10 rounded-full border border-slate-200 bg-slate-50 flex items-center justify-center text-slate-500 hover:text-blue-600 hover:border-blue-200 hover:bg-blue-50 transition-colors cursor-pointer shrink-0"
                    title="Attach image or file"
                  >
                    <Paperclip size={16} />
                  </button>
                  <Input
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    placeholder="Type your message or attach a file..."
                    className="flex-1 text-xs border-slate-200 h-10 px-4 rounded-full bg-slate-50/50"
                    disabled={sending}
                  />
                  <Button 
                    type="submit" 
                    disabled={sending || (!replyText.trim() && !attachedFile)}
                    className="bg-blue-600 hover:bg-blue-700 text-white w-10 h-10 p-0 rounded-full flex items-center justify-center shadow-md shadow-blue-500/20 cursor-pointer shrink-0"
                  >
                    {uploading ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
                  </Button>
                </form>
              </div>
            )}
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-400 text-center">
            <MessageSquare size={48} className="text-slate-350 mb-3 animate-pulse" />
            <h3 className="font-extrabold text-slate-800 text-sm">SELECT A SUPPORT TICKET</h3>
            <p className="text-[11px] text-slate-450 mt-1 max-w-xs leading-relaxed">
              Click on a ticket from the left panel to review past conversations or send updates to the Superadmin support team.
            </p>
          </div>
        )}
      </div>

      {/* Modal: Create Ticket */}
      <AnimatePresence>
        {isCreateOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl shadow-2xl p-6 w-full max-w-md relative z-10 border border-slate-150"
            >
              <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-100">
                <h3 className="font-extrabold text-slate-850 text-base flex items-center gap-1.5">
                  <MessageSquare className="text-blue-500" size={18} /> Open New Support Ticket
                </h3>
                <button 
                  onClick={() => setIsCreateOpen(false)} 
                  className="text-slate-400 hover:text-slate-650 cursor-pointer bg-transparent border-none"
                >
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleCreateTicket} className="space-y-4">
                <div className="space-y-1">
                  <label className="block text-[10px] font-black text-slate-600 uppercase tracking-wider">
                    Subject / Title
                  </label>
                  <Input 
                    type="text"
                    required
                    placeholder="e.g., Question about printer setup, billing issue..."
                    value={newSubject}
                    onChange={(e) => setNewSubject(e.target.value)}
                    className="text-xs border-slate-200 bg-white"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-[10px] font-black text-slate-600 uppercase tracking-wider">
                    Detailed Message
                  </label>
                  <textarea
                    required
                    rows={4}
                    placeholder="Please explain your question or issue in detail so our support team can assist you immediately..."
                    value={initialMessage}
                    onChange={(e) => setInitialMessage(e.target.value)}
                    className="w-full text-xs border border-slate-200 bg-white rounded-xl p-3 focus:outline-none focus:ring-1 focus:ring-blue-600 font-semibold"
                  />
                </div>

                <div className="pt-2 flex justify-end gap-2.5">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsCreateOpen(false)}
                    className="border-slate-200 text-slate-600 font-extrabold text-xs h-10 rounded-xl cursor-pointer"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={creating}
                    className="bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs h-10 rounded-xl cursor-pointer flex items-center gap-1 shadow-md shadow-blue-500/15"
                  >
                    {creating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send size={12} />}
                    Submit Ticket
                  </Button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
