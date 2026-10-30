"use client";

import React, { useState, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { 
  MessageSquare, Send, CheckCircle2, 
  HelpCircle, Loader2, AlertCircle, Paperclip, FileText, XCircle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface Ticket {
  id: string;
  subject: string;
  status: "open" | "replied" | "closed";
  created_at: string;
  shop_id: string;
  shops?: {
    name: string;
    industry_type: string;
  };
}

interface Reply {
  id: string;
  sender_role: "user" | "admin";
  sender_name: string;
  message: string;
  attachment: string | null;
  created_at: string;
}

export default function AdminSupportPage() {
  const supabase = createClient();

  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [activeTicket, setActiveTicket] = useState<Ticket | null>(null);
  const [replies, setReplies] = useState<Reply[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [statusFilter, setStatusFilter] = useState<"all" | "open" | "replied" | "closed">("all");

  // Chat Input State
  const [replyText, setReplyText] = useState("");
  const [attachedFile, setAttachedFile] = useState<File | null>(null);
  const [attachPreview, setAttachPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchTickets();
  }, [statusFilter]);

  useEffect(() => {
    if (activeTicket) {
      fetchReplies(activeTicket.id);
      
      const channel = supabase
        .channel(`admin_replies:${activeTicket.id}`)
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
      let query = supabase
        .from("support_tickets")
        .select(`
          *,
          shops(name, industry_type)
        `)
        .order("created_at", { ascending: false });

      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }

      const { data, error } = await query;

      if (error) throw error;
      setTickets((data as any) || []);
    } catch (err: any) {
      toast.error("Failed to load tickets: " + err.message);
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
    e.target.value = "";
  };

  const uploadAttachment = async (file: File): Promise<string | null> => {
    const ext = file.name.split(".").pop();
    const path = `admin/${Date.now()}.${ext}`;
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
          sender_role: "admin",
          sender_name: "Super Admin Support",
          message: replyText.trim() || (attachedFile ? `📎 ${attachedFile.name}` : ""),
          attachment: attachmentUrl
        });

      if (replyError) throw replyError;

      await supabase
        .from("support_tickets")
        .update({ status: "replied", updated_at: new Date().toISOString() })
        .eq("id", activeTicket.id);

      setReplyText("");
      setAttachedFile(null);
      setAttachPreview(null);
      
      setTickets(prev => prev.map(t => t.id === activeTicket.id ? { ...t, status: "replied" } : t));
      setActiveTicket(prev => prev ? { ...prev, status: "replied" } : null);
    } catch (err: any) {
      toast.error("Failed to send reply: " + err.message);
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

  return (
    <div className="h-[80vh] flex gap-5">
      {/* Left Pane: Filter and Tickets */}
      <div className="w-88 bg-white border border-slate-200/80 rounded-3xl shadow-sm flex flex-col overflow-hidden shrink-0">
        <div className="p-4 border-b border-slate-100 space-y-3">
          <div>
            <h2 className="font-extrabold text-slate-800 text-sm tracking-wide">SUPPORT HELPDESK</h2>
            <p className="text-[10px] text-slate-400 font-semibold uppercase">Customer communications</p>
          </div>

          <div className="flex bg-slate-100 p-0.5 rounded-lg border border-slate-200">
            {(["all", "open", "replied", "closed"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setStatusFilter(tab)}
                className={`flex-1 text-[9px] font-black uppercase py-1 rounded transition-all cursor-pointer ${
                  statusFilter === tab
                    ? "bg-white text-indigo-600 shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-slate-50 p-2 space-y-1">
          {loading ? (
            <div className="h-48 flex items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-indigo-500" />
            </div>
          ) : tickets.length === 0 ? (
            <div className="h-48 flex flex-col items-center justify-center text-slate-400 text-center p-4">
              <HelpCircle size={32} className="text-slate-350 mb-2" />
              <p className="text-xs font-bold">No tickets match filter.</p>
            </div>
          ) : (
            tickets.map((t) => (
              <button
                key={t.id}
                onClick={() => setActiveTicket(t)}
                className={`w-full text-left p-3.5 rounded-2xl transition-all cursor-pointer border flex flex-col ${
                  activeTicket?.id === t.id
                    ? "bg-slate-50 border-indigo-200/85 shadow-xs"
                    : "bg-transparent border-transparent hover:bg-slate-50/50"
                }`}
              >
                <div className="flex items-start justify-between gap-2 mb-1">
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
                
                <div className="text-[10px] font-black text-indigo-600 font-sans tracking-wide">
                  {t.shops?.name || "Unknown Shop"} ({t.shops?.industry_type})
                </div>

                <div className="flex items-center justify-between text-[9px] text-slate-450 font-medium mt-1">
                  <span>ID: #{t.id.slice(0, 8).toUpperCase()}</span>
                  <span>{new Date(t.created_at).toLocaleDateString()}</span>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Right Pane: Conversation threads */}
      <div className="flex-1 bg-white border border-slate-200/80 rounded-3xl shadow-sm flex flex-col overflow-hidden">
        {activeTicket ? (
          <>
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div>
                <span className="text-[9px] text-indigo-600 font-black tracking-widest uppercase">
                  From: {activeTicket.shops?.name} ({activeTicket.shops?.industry_type})
                </span>
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
                  {activeTicket.status}
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

            <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-slate-50/20">
              {replies.map((r) => {
                const isAdmin = r.sender_role === "admin";
                return (
                  <div key={r.id} className={`flex ${isAdmin ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[70%] rounded-3xl p-4 shadow-sm border ${
                      isAdmin
                        ? "bg-indigo-600 text-white rounded-tr-sm border-indigo-500/20 shadow-indigo-500/5"
                        : "bg-white text-slate-800 rounded-tl-sm border-slate-100"
                    }`}>
                      <div className="flex justify-between items-center gap-4 mb-1 border-b pb-1 border-slate-100/10">
                        <span className={`text-[8px] font-black uppercase tracking-wider ${isAdmin ? "text-indigo-200" : "text-slate-450"}`}>
                          {isAdmin ? "You (Super Admin)" : r.sender_name}
                        </span>
                        <span className={`text-[8px] ${isAdmin ? "text-indigo-200" : "text-slate-400"}`}>
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
                                isAdmin ? "border-indigo-400/30 text-indigo-100 bg-indigo-500/30" : "border-slate-200 text-slate-600 bg-slate-50"
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

            {activeTicket.status === "closed" ? (
              <div className="p-4 border-t border-slate-100 bg-slate-50 text-center text-[10px] text-slate-500 font-bold flex items-center justify-center gap-1.5">
                <AlertCircle size={14} className="text-slate-400" />
                This ticket has been marked as Resolved & Closed.
              </div>
            ) : (
              <div className="border-t border-slate-100 bg-white">
                {/* Attachment Preview */}
                {attachedFile && (
                  <div className="px-4 pt-3 flex items-center gap-2">
                    <div className="flex items-center gap-2 bg-indigo-50 border border-indigo-100 rounded-xl px-3 py-1.5 text-xs text-indigo-700 font-bold max-w-xs">
                      {attachPreview ? (
                        <img src={attachPreview} className="h-8 w-8 rounded-lg object-cover shrink-0" alt="preview" />
                      ) : (
                        <FileText size={16} className="shrink-0" />
                      )}
                      <span className="truncate max-w-[160px]">{attachedFile.name}</span>
                      <button
                        type="button"
                        onClick={() => { setAttachedFile(null); setAttachPreview(null); }}
                        className="text-indigo-400 hover:text-rose-500 cursor-pointer ml-1"
                      >
                        <XCircle size={14} />
                      </button>
                    </div>
                  </div>
                )}
                <form onSubmit={handleSendReply} className="p-4 flex gap-2.5 items-center">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*,.pdf,.doc,.docx,.txt,.xlsx,.csv"
                    className="hidden"
                    onChange={handleFileSelect}
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-10 h-10 rounded-full border border-slate-200 bg-slate-50 flex items-center justify-center text-slate-500 hover:text-indigo-600 hover:border-indigo-200 hover:bg-indigo-50 transition-colors cursor-pointer shrink-0"
                    title="Attach image or file"
                  >
                    <Paperclip size={16} />
                  </button>
                  <Input
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    placeholder="Type your response to the user..."
                    className="flex-1 text-xs border-slate-200 h-10 px-4 rounded-full bg-slate-50/50"
                    disabled={sending}
                  />
                  <Button 
                    type="submit" 
                    disabled={sending || (!replyText.trim() && !attachedFile)}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white w-10 h-10 p-0 rounded-full flex items-center justify-center shadow-md shadow-indigo-500/20 cursor-pointer shrink-0"
                  >
                    {uploading ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
                  </Button>
                </form>
              </div>
            )}
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-400 text-center">
            <MessageSquare size={48} className="text-slate-350 mb-3" />
            <h3 className="font-extrabold text-slate-800 text-sm">SELECT A CONVERSATION</h3>
            <p className="text-[11px] text-slate-450 mt-1 max-w-xs leading-relaxed">
              Choose a support ticket from the list to respond to paid business owners and assist them with questions.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
