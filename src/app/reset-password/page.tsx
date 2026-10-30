"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Lock, Eye, EyeOff, CheckCircle2, Loader2, Sparkles, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

export default function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  
  const [sessionLoading, setSessionLoading] = useState(true);
  const [hasSession, setHasSession] = useState(false);

  const supabase = createClient();
  const router = useRouter();

  // Password requirements helper flags
  const hasMinLength = password.length >= 8;
  const hasLetter = /[A-Za-z]/.test(password);
  const hasNumber = /\d/.test(password);
  const isValid = hasMinLength && hasLetter && hasNumber;

  // Session verification and code exchange
  useEffect(() => {
    const verifySession = async () => {
      try {
        const searchParams = new URLSearchParams(window.location.search);
        const code = searchParams.get("code");

        if (code) {
          // Exchange PKCE code for session
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;
          setHasSession(true);
          toast.success("Secure reset session established!");
        } else {
          // Check if session already exists (e.g. from manual OTP verification)
          const { data: { session } } = await supabase.auth.getSession();
          if (session) {
            setHasSession(true);
          }
        }
      } catch (err: any) {
        console.error("Session exchange error:", err);
        toast.error("Failed to verify secure session: " + (err.message || "Invalid or expired link"));
      } finally {
        setSessionLoading(false);
      }
    };

    verifySession();
  }, [supabase.auth]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid) {
      toast.error("Please satisfy all password requirements.");
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: password
      });

      if (error) throw error;
      setSuccess(true);
      toast.success("Password reset successfully!");
    } catch (err: any) {
      toast.error(err.message || "Failed to update password.");
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
            <Sparkles size={11} className="text-indigo-500" /> Password Security
          </div>
        </div>

        {sessionLoading ? (
          <div className="text-center py-10 space-y-4 flex flex-col items-center">
            <Loader2 className="h-8 w-8 animate-spin text-[#1e3a5f]" />
            <p className="text-slate-500 font-bold text-xs">Verifying security session...</p>
          </div>
        ) : success ? (
          <div className="text-center space-y-4">
            <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto border border-emerald-100">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <h2 className="text-2xl font-black text-[#1e3a5f]">Password Updated!</h2>
            <p className="text-slate-500 font-semibold text-xs leading-relaxed max-w-[280px] mx-auto">
              Your password has been changed successfully. You can now use your new password to log in.
            </p>
            <div className="pt-4">
              <Link href="/login">
                <Button className="w-full bg-[#1e3a5f] hover:bg-[#152a46] text-white h-11 text-xs font-black rounded-xl shadow-lg">
                  Go to Login
                </Button>
              </Link>
            </div>
          </div>
        ) : !hasSession ? (
          <div className="text-center space-y-4 py-4">
            <div className="w-12 h-12 bg-rose-50 text-rose-600 rounded-full flex items-center justify-center mx-auto border border-rose-100">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <h2 className="text-xl font-black text-[#1e3a5f]">Reset Link Expired</h2>
            <p className="text-slate-500 font-semibold text-xs leading-relaxed max-w-[290px] mx-auto">
              This password reset link is invalid or has expired. Please go back to request a new link or verification code.
            </p>
            <div className="pt-4">
              <Link href="/forgot-password">
                <Button className="w-full bg-[#1e3a5f] hover:bg-[#152a46] text-white h-11 text-xs font-black rounded-xl shadow-lg">
                  Forgot Password Page
                </Button>
              </Link>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="text-center">
              <h2 className="text-2xl font-black text-[#1e3a5f]">Reset Password</h2>
              <p className="text-slate-500 font-semibold text-xs mt-1.5 leading-relaxed">
                Choose a strong and secure password for your account to protect your store and financial logs.
              </p>
            </div>

            <div className="space-y-2.5">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">New Password</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-3.5 h-4.5 w-4.5 text-slate-400" />
                <Input 
                  type={showPassword ? "text" : "password"} 
                  placeholder="••••••••" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-12 pl-11 pr-11 border-slate-200 rounded-xl bg-slate-50 text-slate-900 focus-visible:ring-2 focus-visible:ring-indigo-500 text-sm font-semibold"
                  required 
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-3.5 text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
                >
                  {showPassword ? <EyeOff className="h-4.5 w-4.5" /> : <Eye className="h-4.5 w-4.5" />}
                </button>
              </div>

              {/* Password strength visual guidelines */}
              <div className="space-y-1.5 bg-slate-50 rounded-2xl p-3 border border-slate-150 text-[10px] font-semibold text-slate-500">
                <p className="font-bold text-slate-650 uppercase tracking-wider pb-1">Requirements:</p>
                <div className="flex items-center gap-1.5">
                  <span className={hasMinLength ? "text-emerald-600" : "text-slate-350"}>{hasMinLength ? "✓" : "○"}</span>
                  <span className={hasMinLength ? "text-slate-700 font-bold" : "text-slate-450"}>At least 8 characters</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className={hasLetter ? "text-emerald-600" : "text-slate-350"}>{hasLetter ? "✓" : "○"}</span>
                  <span className={hasLetter ? "text-slate-700 font-bold" : "text-slate-450"}>Include at least one letter</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className={hasNumber ? "text-emerald-600" : "text-slate-350"}>{hasNumber ? "✓" : "○"}</span>
                  <span className={hasNumber ? "text-slate-700 font-bold" : "text-slate-450"}>Include at least one number</span>
                </div>
              </div>
            </div>

            <Button 
              type="submit" 
              className="w-full bg-[#1e3a5f] hover:bg-[#152a46] text-white transition-all h-12 text-xs font-black rounded-xl shadow-lg flex items-center justify-center gap-2 cursor-pointer"
              disabled={loading || !isValid}
            >
              {loading ? <Loader2 className="h-4.5 w-4.5 animate-spin" /> : "Save New Password"}
            </Button>
          </form>
        )}

      </div>
    </div>
  );
}
