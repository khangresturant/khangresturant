"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Mail, ArrowLeft, Loader2, Sparkles, KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [showOtpScreen, setShowOtpScreen] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [timer, setTimer] = useState(60);
  
  const supabase = createClient();
  const router = useRouter();

  // Timer countdown hook
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (showOtpScreen && timer > 0) {
      interval = setInterval(() => {
        setTimer((prev) => prev - 1);
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [showOtpScreen, timer]);

  const handleSendResetEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (error) throw error;
      setShowOtpScreen(true);
      setTimer(60);
      toast.success("Verification code sent to your email!");
    } catch (err: any) {
      toast.error(err.message || "Failed to send verification link.");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otpCode || otpCode.length < 6) {
      toast.error("Please enter a valid 6-digit verification code.");
      return;
    }

    setVerifying(true);
    try {
      const { error } = await supabase.auth.verifyOtp({
        email,
        token: otpCode,
        type: "recovery",
      });

      if (error) throw error;

      toast.success("OTP verified successfully!");
      // Redirect to the reset password page now that the session is active
      router.push("/reset-password");
    } catch (err: any) {
      toast.error(err.message || "Invalid or expired verification code.");
    } finally {
      setVerifying(false);
    }
  };

  const handleResendOtp = async () => {
    if (timer > 0) return;
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (error) throw error;
      setTimer(60);
      toast.success("New verification code sent!");
    } catch (err: any) {
      toast.error(err.message || "Failed to resend code.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#fafafa] flex items-center justify-center p-4 md:p-8 font-sans relative overflow-hidden">
      {/* Background gradients */}
      <div className="absolute top-0 inset-x-0 h-[600px] bg-gradient-to-br from-blue-100/40 via-indigo-100/40 to-pink-100/40 opacity-80 blur-3xl -z-10 pointer-events-none" />
      <div className="absolute inset-0 bg-[radial-gradient(#6366f1_0.08rem,transparent_0.08rem)] [background-size:2rem_2rem] opacity-[0.06] pointer-events-none" />

      <div className="w-full max-w-md bg-white border border-slate-200 rounded-[2.5rem] p-8 md:p-10 shadow-2xl relative z-10 overflow-hidden">
        
        {/* Header Logo */}
        <div className="mb-8 text-center flex flex-col items-center">
          <img 
            src="/the-accounts-brand.png" 
            alt="The Accounts Logo" 
            className="h-14 w-auto object-contain mix-blend-multiply mb-3" 
          />
          <div className="inline-flex items-center gap-1 bg-indigo-50 border border-indigo-100 text-indigo-700 text-[10px] font-black uppercase tracking-wider px-3.5 py-1 rounded-full">
            <Sparkles size={11} className="text-indigo-500" /> Account Recovery
          </div>
        </div>

        {showOtpScreen ? (
          <form onSubmit={handleVerifyOtp} className="space-y-6">
            <div className="text-center">
              <h2 className="text-2xl font-black text-[#1e3a5f]">Enter Verification Code</h2>
              <p className="text-slate-500 font-semibold text-xs mt-1.5 leading-relaxed">
                We've sent a 6-digit code to <strong className="text-slate-700">{email}</strong>. Enter it below to verify and reset your password.
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Verification Code</label>
              <div className="relative">
                <KeyRound className="absolute left-3.5 top-3.5 h-4.5 w-4.5 text-slate-400" />
                <Input 
                  type="text" 
                  maxLength={6}
                  placeholder="123456" 
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ""))}
                  className="h-12 pl-11 tracking-[0.25em] text-center border-slate-200 rounded-xl bg-slate-50 text-slate-900 focus-visible:ring-2 focus-visible:ring-indigo-500 text-base font-bold"
                  required 
                />
              </div>
            </div>

            <Button 
              type="submit" 
              className="w-full bg-[#1e3a5f] hover:bg-[#152a46] text-white transition-all h-12 text-xs font-black rounded-xl shadow-lg flex items-center justify-center gap-2 cursor-pointer"
              disabled={verifying || otpCode.length !== 6}
            >
              {verifying ? <Loader2 className="h-4.5 w-4.5 animate-spin" /> : "Verify Code"}
            </Button>

            <div className="flex flex-col items-center justify-center gap-3 pt-2 text-center">
              <div className="text-xs text-slate-500 font-semibold">
                {timer > 0 ? (
                  <span>Resend code in <strong className="text-indigo-600 font-bold">{timer}s</strong></span>
                ) : (
                  <button 
                    type="button" 
                    onClick={handleResendOtp}
                    disabled={loading}
                    className="text-indigo-600 hover:text-indigo-800 font-bold hover:underline transition-colors cursor-pointer"
                  >
                    {loading ? "Resending..." : "Resend OTP Code"}
                  </button>
                )}
              </div>

              <div className="border-t border-slate-100 w-full pt-4 flex justify-center">
                <button 
                  type="button" 
                  onClick={() => setShowOtpScreen(false)} 
                  className="flex items-center gap-1.5 text-[10px] font-black text-slate-400 hover:text-[#1e3a5f] uppercase tracking-wider transition-colors cursor-pointer"
                >
                  <ArrowLeft size={12} /> Back to email entry
                </button>
              </div>
            </div>
          </form>
        ) : (
          <form onSubmit={handleSendResetEmail} className="space-y-6">
            <div className="text-center">
              <h2 className="text-2xl font-black text-[#1e3a5f]">Forgot Password?</h2>
              <p className="text-slate-500 font-semibold text-xs mt-1.5 leading-relaxed">
                Enter your registered email address below, and we'll send you a link or verification code to reset your password.
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-3.5 h-4.5 w-4.5 text-slate-400" />
                <Input 
                  type="email" 
                  placeholder="admin@theaccounts.cloud" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-12 pl-11 border-slate-200 rounded-xl bg-slate-50 text-slate-900 focus-visible:ring-2 focus-visible:ring-indigo-500 text-sm font-semibold"
                  required 
                />
              </div>
            </div>

            <Button 
              type="submit" 
              className="w-full bg-[#1e3a5f] hover:bg-[#152a46] text-white transition-all h-12 text-xs font-black rounded-xl shadow-lg flex items-center justify-center gap-2 cursor-pointer"
              disabled={loading || !email}
            >
              {loading ? <Loader2 className="h-4.5 w-4.5 animate-spin" /> : "Send Reset Code / Link"}
            </Button>

            <div className="border-t border-slate-100 pt-4 flex justify-center">
              <Link href="/login" className="flex items-center gap-1.5 text-[10px] font-black text-slate-400 hover:text-[#1e3a5f] uppercase tracking-wider transition-colors">
                <ArrowLeft size={12} /> Back to Login
              </Link>
            </div>
          </form>
        )}

      </div>
    </div>
  );
}
