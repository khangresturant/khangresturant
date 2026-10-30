"use client";

import { useState, useEffect, Suspense } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { getEffectiveTierId } from "@/lib/planMatrix";
import {
  Building2,
  Mail,
  Lock,
  User,
  ShoppingBag,
  Scissors,
  Pill,
  Fuel,
  Smartphone,
  ChevronRight,
  ChevronLeft,
  CheckCircle2,
  Loader2,
  Car,
  Wrench,
  Shirt,
  Coffee,
  Store,
  Leaf,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  CheckSquare,
  Eye,
  EyeOff,
  KeyRound,
  ArrowLeft,
  ChefHat,
  Gem,
  FileText,
  FlaskConical,
  Boxes,
  Truck,
  Clock,
  AlertTriangle
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { industries as industryPacks } from "@/components/landing/industries-data";

/** Single source of truth — Ready vs Coming Soon matches landing catalog */
const INDUSTRIES = industryPacks.map((p) => ({
  id: p.id,
  name: p.title,
  icon: p.icon,
  status: p.status as "ready" | "development",
  desc: p.desc,
  covers: p.covers,
  features: p.features,
}));

function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const refParam = searchParams.get("ref");
  const supabase = createClient();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [existingUser, setExistingUser] = useState<any>(null);
  const [registeredUserId, setRegisteredUserId] = useState<string | null>(null);
  const [hasEmi, setHasEmi] = useState(false);
  const [verificationSent, setVerificationSent] = useState(false);
  
  // Password visual feedback & validation states
  const [showPassword, setShowPassword] = useState(false);
  const [showPwErrors, setShowPwErrors] = useState(false);

  // OTP Verification details
  const [otpCode, setOtpCode] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [timer, setTimer] = useState(60);

  // Timer countdown hook for Register OTP
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (verificationSent && timer > 0) {
      interval = setInterval(() => {
        setTimer((prev) => prev - 1);
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [verificationSent, timer]);

  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
    supabase.auth.getUser().then(async ({ data }: any) => {
      if (data.user) {
        const userId = data.user.id;
        
        // Fetch shops owned by this user
        const { data: userShops, error: userShopsError } = await supabase
          .from("shops")
          .select("id, subscription_tier, subscription_expires_at, created_at")
          .eq("owner_id", userId);

        // Fetch user profile
        const { data: userProfile } = await supabase
          .from("user_profiles")
          .select("id, shop_id")
          .eq("id", userId)
          .maybeSingle();

        // Self-healing: if shops exist but user_profiles is missing
        if (!userShopsError && userShops && userShops.length >= 1 && !userProfile) {
          const targetShopId = userShops[0].id;
          
          // Re-create the missing profile pointing to their first shop
          await supabase
            .from("user_profiles")
            .upsert({
              id: userId,
              shop_id: targetShopId,
              name: data.user.user_metadata?.full_name || "Admin",
              role: "superadmin"
            }, { onConflict: "id" });

          // Also ensure user_shops entry is present
          await supabase
            .from("user_shops")
            .upsert({
              user_id: userId,
              shop_id: targetShopId,
              role: "superadmin"
            }, { onConflict: "user_id,shop_id" });

          // Redirect to dashboard now that profile exists
          if (typeof window !== "undefined") {
            window.location.href = "/dashboard";
          } else {
            router.push("/dashboard");
          }
          return;
        }

        const isAddNew = searchParams.get("new") === "true";

        // If they already have a profile and own shops, let them go to dashboard
        if (!isAddNew && userProfile && userShops && userShops.length >= 1) {
          router.push("/dashboard");
          return;
        }

        if (!userShopsError && userShops && userShops.length >= 1) {
          const cannotRegister = userShops.every((s: { subscription_tier: string | null; subscription_expires_at: string | null; created_at: string | null }) => {
            const effectiveTier = getEffectiveTierId(s.subscription_tier, s.subscription_expires_at);
            // Free tier eliminated

            // Check if shop is in the initial 14-day trial period
            if (s.subscription_expires_at && s.created_at) {
              const expiresAt = new Date(s.subscription_expires_at);
              const createdAt = new Date(s.created_at);
              const totalDurationDays = (expiresAt.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24);
              if (totalDurationDays <= 15) {
                return true; // Still on trial
              }
            }
            return false;
          });

          if (cannotRegister) {
            toast.error("You can only register 1 business on business limit. To add a business, upgrade to Starter/Premium plan.");
            router.push("/dashboard");
            return;
          }
        }

        setExistingUser(data.user);
        setStep(2);
        setFormData(prev => ({ ...prev, email: data.user.email || "" }));
      }
    });
  }, [supabase.auth, router]);

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    shopName: "",
    shopPhone: "",
    shopAddress: "",
    industryType: "",
  });

  // Calculate password strength variables synchronously
  const hasMinLength = formData.password.length >= 8;
  const hasLetter = /[A-Za-z]/.test(formData.password);
  const hasNumber = /\d/.test(formData.password);
  const pwStrengthScore = (hasMinLength ? 1 : 0) + (hasLetter ? 1 : 0) + (hasNumber ? 1 : 0);
  const isPasswordValid = pwStrengthScore === 3;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleRegister = async () => {
    if (!formData.industryType) {
      toast.error("Please select an industry");
      return;
    }

    // Password policy (AUTH-02) for new accounts
    if (!existingUser?.id) {
      if (!isPasswordValid) {
        setShowPwErrors(true);
        toast.error("Please meet all password requirements before completing setup.");
        return;
      }
    }
    
    setLoading(true);
    try {
      let userId = existingUser?.id || registeredUserId;
      const isExistingUser = !!userId;

      let emailVerificationRequired = false;

      if (!userId) {
        const { data: authData, error: authError } = await supabase.auth.signUp({
          email: formData.email,
          password: formData.password,
        });
        if (authError) throw authError;
        userId = authData.user?.id;
        if (userId) {
          setRegisteredUserId(userId);
        }

        // If email confirmation is enabled and session is not created
        if (!authData.session) {
          emailVerificationRequired = true;
        }
      }

      if (!userId) throw new Error("Authentication failed");

      // Free plan & trial limit check: prevent registering multiple businesses on Free tier or Trial period
      if (isExistingUser) {
        const { data: userShops, error: userShopsError } = await supabase
          .from("shops")
          .select("id, subscription_tier, subscription_expires_at, created_at")
          .eq("owner_id", userId);

        if (!userShopsError && userShops && userShops.length >= 1) {
          const cannotRegister = userShops.every((s: { subscription_tier: string | null; subscription_expires_at: string | null; created_at: string | null }) => {
            const effectiveTier = getEffectiveTierId(s.subscription_tier, s.subscription_expires_at);
            // Free tier eliminated

            // Check if shop is in the initial 14-day trial period
            if (s.subscription_expires_at && s.created_at) {
              const expiresAt = new Date(s.subscription_expires_at);
              const createdAt = new Date(s.created_at);
              const totalDurationDays = (expiresAt.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24);
              if (totalDurationDays <= 15) {
                return true; // Still on trial
              }
            }
            return false;
          });

          if (cannotRegister) {
            toast.error("You can only register 1 business on business limit. To add a business, upgrade to Starter/Premium plan.");
            setLoading(false);
            return;
          }
        }
      }

      // Check if user already has registered shops (free trial is only given once per user account)
      let hasPreviousShops = false;
      const { count: ownedCount, error: ownedCountError } = await supabase
        .from("shops")
        .select("*", { count: "exact", head: true })
        .eq("owner_id", userId);

      if (!ownedCountError && typeof ownedCount === "number" && ownedCount > 0) {
        hasPreviousShops = true;
      }

      if (!hasPreviousShops) {
        const { count: memberCount, error: memberCountError } = await supabase
          .from("user_shops")
          .select("*", { count: "exact", head: true })
          .eq("user_id", userId);

        if (!memberCountError && typeof memberCount === "number" && memberCount > 0) {
          hasPreviousShops = true;
        }
      }

      const trialDays = hasPreviousShops ? 0 : 14;
      const initialTier = "premium";
      const initialExpiry = trialDays > 0 
        ? new Date(Date.now() + trialDays * 24 * 60 * 60 * 1000).toISOString()
        : new Date().toISOString();

      const { data: shopData, error: shopError } = await supabase
        .from('shops')
        .insert({
          name: formData.shopName,
          phone: formData.shopPhone,
          address: formData.shopAddress,
          industry_type: formData.industryType,
          owner_id: userId,
          has_emi: formData.industryType === "crockery" ? hasEmi : (formData.industryType === "electronics" ? true : false),
          subscription_tier: initialTier,
          subscription_expires_at: initialExpiry,
          referred_by_shop_id: refParam || null
        })
        .select()
        .single();

      if (shopError) throw shopError;

      // Check if user has an existing profile in the database
      const { data: existingProfile } = await supabase
        .from("user_profiles")
        .select("id")
        .eq("id", userId)
        .maybeSingle();

      if (existingProfile) {
        // For existing users adding a new business (primary shop exists):
        // Do NOT overwrite user_profiles.shop_id — it should stay pointing to their
        // original/active shop. The shop-switcher reads user_shops, so just upsert there.
        const { error: userShopError } = await supabase
          .from('user_shops')
          .upsert({
            user_id: userId,
            shop_id: shopData.id,
            role: 'superadmin'
          }, { onConflict: 'user_id,shop_id' });
        if (userShopError) throw userShopError;
      } else {
        // Brand-new user or recovery from partial signup (no profile exists yet):
        // Create profile pointing to their first shop safely via upsert
        const { error: profileError } = await supabase
          .from('user_profiles')
          .upsert({
            id: userId,
            shop_id: shopData.id,
            name: formData.name || "Admin",
            role: 'superadmin'
          }, { onConflict: 'id' });

        if (profileError) throw profileError;

        const { error: userShopError } = await supabase
          .from('user_shops')
          .upsert({
            user_id: userId,
            shop_id: shopData.id,
            role: 'superadmin'
          }, { onConflict: 'user_id,shop_id' });

        if (userShopError) throw userShopError;
      }

      if (emailVerificationRequired) {
        toast.info("📩 A confirmation link has been sent to your email. Please verify to access your dashboard!");
        setVerificationSent(true);
      } else {
        toast.success(isExistingUser ? "New business registered successfully!" : "Welcome to The Accounts! Setup Completed.");
        if (typeof window !== "undefined") {
          window.location.href = "/dashboard";
        } else {
          router.push("/dashboard");
        }
      }

    } catch (error: any) {
      const errMsg = error.message || "An error occurred during registration";
      toast.error(errMsg);
      if (
        errMsg.toLowerCase().includes("already registered") || 
        errMsg.toLowerCase().includes("already exists") ||
        errMsg.toLowerCase().includes("conflict")
      ) {
        setStep(1);
      }
    } finally {
      setLoading(false);
    }
  };

  const nextStep = async () => {
    if (step === 1) {
      if (!formData.name.trim()) {
        toast.error("Please enter your full name");
        return;
      }
      if (!formData.email.trim() || !formData.email.includes("@")) {
        toast.error("Please enter a valid email address");
        return;
      }
      if (!existingUser?.id) {
        if (!isPasswordValid) {
          setShowPwErrors(true);
          toast.error("Please satisfy all password requirements before continuing.");
          return;
        }
      }
      setStep(2);
    } else if (step === 2) {
      if (!formData.shopName.trim()) {
        toast.error("Please enter your business/shop name");
        return;
      }
      if (!formData.shopPhone.trim()) {
        toast.error("Please enter your phone number");
        return;
      }
      setStep(3);
    } else if (step === 3 && formData.industryType === "crockery") {
      setStep(4);
    } else if (step === 3) {
      handleRegister();
    } else if (step === 4) {
      handleRegister();
    }
  };

  const prevStep = () => {
    if (step === 4) {
      setStep(3);
    } else {
      setStep((s) => Math.max(s - 1, 1));
    }
  };

  const handleResendRegisterOtp = async () => {
    if (timer > 0) return;
    setLoading(true);
    try {
      const { error } = await supabase.auth.resend({
        type: "signup",
        email: formData.email,
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

  const handleVerifyRegisterOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otpCode || otpCode.length < 6) {
      toast.error("Please enter a valid 6-digit verification code.");
      return;
    }

    setVerifying(true);
    try {
      const { data, error } = await supabase.auth.verifyOtp({
        email: formData.email,
        token: otpCode,
        type: "signup",
      });

      if (error) throw error;

      toast.success("Email verified successfully! Completing setup...");
      
      // Now that the user is authenticated, complete the database setup
      const userId = data.user?.id;
      if (!userId) throw new Error("Verification succeeded but user ID is missing.");

      // Check if user already owns any shops (free trial is only given once per user account)
      let hasPreviousShops = false;
      const { count: ownedCount, error: ownedCountError } = await supabase
        .from("shops")
        .select("*", { count: "exact", head: true })
        .eq("owner_id", userId);

      if (!ownedCountError && typeof ownedCount === "number" && ownedCount > 0) {
        hasPreviousShops = true;
      }

      if (!hasPreviousShops) {
        const { count: memberCount, error: memberCountError } = await supabase
          .from("user_shops")
          .select("*", { count: "exact", head: true })
          .eq("user_id", userId);

        if (!memberCountError && typeof memberCount === "number" && memberCount > 0) {
          hasPreviousShops = true;
        }
      }

      const trialDays = hasPreviousShops ? 0 : 14;
      const initialTier = "premium";
      const initialExpiry = trialDays > 0 
        ? new Date(Date.now() + trialDays * 24 * 60 * 60 * 1000).toISOString()
        : new Date().toISOString();

      // Check if shop was already created during handleRegister (prevents duplicate 2nd shop creation)
      let targetShopId: string | null = null;
      const { data: existingShop } = await supabase
        .from('shops')
        .select('id')
        .eq('owner_id', userId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (existingShop?.id) {
        targetShopId = existingShop.id;
      } else {
        // Insert shop only if not already created
        const { data: shopData, error: shopError } = await supabase
          .from('shops')
          .insert({
            name: formData.shopName,
            phone: formData.shopPhone,
            address: formData.shopAddress,
            industry_type: formData.industryType,
            owner_id: userId,
            has_emi: formData.industryType === "crockery" ? hasEmi : (formData.industryType === "electronics" ? true : false),
            subscription_tier: initialTier,
            subscription_expires_at: initialExpiry
          })
          .select()
          .single();

        if (shopError) throw shopError;
        targetShopId = shopData.id;
      }

      // Upsert profile safely (handles existing profile or trigger-created profiles)
      const { error: profileError } = await supabase
        .from('user_profiles')
        .upsert({
          id: userId,
          shop_id: targetShopId,
          name: formData.name || "Admin",
          role: 'superadmin'
        }, { onConflict: 'id' });

      if (profileError) throw profileError;

      // Upsert user_shop entry
      const { error: userShopError } = await supabase
        .from('user_shops')
        .upsert({
          user_id: userId,
          shop_id: targetShopId,
          role: 'superadmin'
        }, { onConflict: 'user_id,shop_id' });

      if (userShopError) throw userShopError;

      toast.success("Welcome to The Accounts! Setup Completed.");
      
      if (typeof window !== "undefined") {
        window.location.href = "/dashboard";
      } else {
        router.push("/dashboard");
      }

    } catch (err: any) {
      toast.error(err.message || "Failed to verify or complete registration.");
    } finally {
      setVerifying(false);
    }
  };

  if (!mounted) {
    return (
      <div className="min-h-screen bg-[#fafafa] flex flex-col items-center justify-center text-slate-500 font-sans">
        <Loader2 className="animate-spin h-8 w-8 text-[#1e3a5f] mb-3" />
        <p className="text-xs font-semibold">Loading Setup Wizard...</p>
      </div>
    );
  }

  if (verificationSent) {
    return (
      <div className="min-h-screen bg-[#fafafa] flex items-center justify-center p-4 md:p-8 font-sans relative overflow-hidden">
        <div className="absolute top-0 inset-x-0 h-[600px] bg-gradient-to-br from-blue-100/40 via-indigo-100/40 to-pink-100/40 opacity-80 blur-3xl -z-10 pointer-events-none" />
        <div className="absolute inset-0 bg-[radial-gradient(#6366f1_0.08rem,transparent_0.08rem)] [background-size:2rem_2rem] opacity-[0.06] pointer-events-none" />

        <div className="w-full max-w-md bg-white border border-slate-200 rounded-[2.5rem] p-10 md:p-12 shadow-2xl relative z-10 text-center flex flex-col items-center animate-in fade-in zoom-in-95 duration-300">
          <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mb-6 border border-blue-100 animate-pulse">
            <Mail size={30} className="stroke-[2]" />
          </div>

          <h1 className="text-2xl font-black text-[#1e3a5f] tracking-tight mb-3">
            Confirm Your Email
          </h1>
          <p className="text-slate-500 font-semibold text-xs leading-relaxed mb-6">
            We have sent a verification code to <strong className="text-slate-700">{formData.email}</strong>. Enter it below to verify and complete your setup.
          </p>

          <form onSubmit={handleVerifyRegisterOtp} className="w-full space-y-6">
            <div className="space-y-1.5 text-left">
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
              {verifying ? <Loader2 className="h-4.5 w-4.5 animate-spin" /> : "Verify & Complete Setup"}
            </Button>

            <div className="flex flex-col items-center justify-center gap-3 pt-2 text-center">
              <div className="text-xs text-slate-500 font-semibold">
                {timer > 0 ? (
                  <span>Resend code in <strong className="text-indigo-600 font-bold">{timer}s</strong></span>
                ) : (
                  <button 
                    type="button" 
                    onClick={handleResendRegisterOtp}
                    disabled={loading}
                    className="text-indigo-600 hover:text-indigo-800 font-bold hover:underline transition-colors cursor-pointer"
                  >
                    {loading ? "Resending..." : "Resend Verification Code"}
                  </button>
                )}
              </div>

              <div className="border-t border-slate-100 w-full pt-4 flex justify-center">
                <button 
                  type="button" 
                  onClick={() => setVerificationSent(false)} 
                  className="flex items-center gap-1.5 text-[10px] font-black text-slate-400 hover:text-[#1e3a5f] uppercase tracking-wider transition-colors cursor-pointer"
                >
                  <ArrowLeft size={12} /> Edit Details / Go Back
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#fafafa] flex items-center justify-center p-4 md:p-8 font-sans relative overflow-hidden">
      
      {/* Mesh gradients for background depth */}
      <div className="absolute top-0 inset-x-0 h-[600px] bg-gradient-to-br from-blue-100/40 via-indigo-100/40 to-pink-100/40 opacity-80 blur-3xl -z-10 pointer-events-none" />
      <div className="absolute inset-0 bg-[radial-gradient(#6366f1_0.08rem,transparent_0.08rem)] [background-size:2rem_2rem] opacity-[0.06] pointer-events-none" />

      <div className={`w-full ${step === 3 ? 'max-w-6xl' : 'max-w-2xl'} bg-white border border-slate-200 rounded-[2.5rem] p-8 md:p-12 shadow-2xl relative z-10 overflow-hidden transition-all duration-500`}>
        
        {/* Header Logo */}
        <div className="mb-10 text-center flex flex-col items-center">
          <img 
            src="/the-accounts-brand.png" 
            alt="The Accounts Logo" 
            className="h-16 w-auto object-contain mix-blend-multiply mb-3" 
          />
          <div className="inline-flex items-center gap-1 bg-indigo-50 border border-indigo-150 text-indigo-700 text-[10px] font-black uppercase tracking-wider px-3.5 py-1.5 rounded-full">
            <Sparkles size={11} className="animate-spin" /> Setup Wizard
          </div>
        </div>

        {/* Progress Bar / Steps indicator */}
        <div className="flex gap-3 mb-10 max-w-md mx-auto">
          {(formData.industryType === "crockery" ? [1, 2, 3, 4] : [1, 2, 3]).map((i) => (
            <div key={i} className="flex-1">
              <div className={`h-1.5 rounded-full transition-all duration-500 ${step >= i ? 'bg-gradient-to-r from-[#1e3a5f] to-indigo-650' : 'bg-slate-200'}`} />
            </div>
          ))}
        </div>

        <div className="mb-8 text-center max-w-lg mx-auto">
          <h1 className="text-3xl font-black text-[#1e3a5f] tracking-tight mb-2">
            {step === 1 && "Create Your Account"}
            {step === 2 && "Configure Business details"}
            {step === 3 && "Select Your Industry"}
            {step === 4 && "Configure Features"}
          </h1>
          <p className="text-slate-500 font-semibold text-sm">
            {step === 1 && "Start managing your business smartly today."}
            {step === 2 && "Tell us about your shop to customize your experience."}
            {step === 3 && "We will set up features tailored for your specific business."}
            {step === 4 && "Set up additional features for your business."}
          </p>
        </div>

        <div className="min-h-[280px]">
          <AnimatePresence mode="wait">
            
            {/* STEP 1: ADMIN PROFILE */}
            {step === 1 && (
              <motion.div
                key="step1"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-5 max-w-md mx-auto"
              >
                <div className="space-y-1.5">
                  <label className="text-xs font-black text-slate-500 uppercase tracking-wider">Full Name</label>
                  <div className="relative" suppressHydrationWarning>
                    <User className="absolute left-3.5 top-3.5 h-5 w-5 text-slate-400" />
                    <Input name="name" value={formData.name} onChange={handleChange} className="pl-11 bg-slate-50 border-slate-200 text-slate-900 focus-visible:ring-indigo-600 h-12 rounded-xl text-sm" placeholder="Ali Raza" />
                  </div>
                </div>
                
                <div className="space-y-1.5">
                  <label className="text-xs font-black text-slate-500 uppercase tracking-wider">Email Address</label>
                  <div className="relative" suppressHydrationWarning>
                    <Mail className="absolute left-3.5 top-3.5 h-5 w-5 text-slate-400" />
                    <Input name="email" type="email" value={formData.email} onChange={handleChange} className="pl-11 bg-slate-50 border-slate-200 text-slate-900 focus-visible:ring-indigo-600 h-12 rounded-xl text-sm" placeholder="admin@shop.com" />
                  </div>
                </div>
                
                <div className="space-y-1.5">
                  <label className="text-xs font-black text-slate-500 uppercase tracking-wider">Password</label>
                  <div className="relative" suppressHydrationWarning>
                    <Lock className="absolute left-3.5 top-3.5 h-5 w-5 text-slate-400" />
                    <Input 
                      name="password" 
                      type={showPassword ? "text" : "password"} 
                      value={formData.password} 
                      onChange={(e) => {
                        handleChange(e);
                        if (showPwErrors) setShowPwErrors(false);
                      }} 
                      className={`pl-11 pr-11 bg-slate-50 text-slate-900 h-12 rounded-xl text-sm transition-all duration-350 focus-visible:ring-2 ${
                        showPwErrors && !isPasswordValid
                          ? "border-red-500 focus-visible:ring-red-500" 
                          : isPasswordValid
                            ? "border-emerald-500 focus-visible:ring-emerald-500 animate-pulse-subtle"
                            : "border-slate-200 focus-visible:ring-indigo-600"
                      }`}
                      placeholder="Min 8 chars + number" 
                      minLength={8} 
                      autoComplete="new-password" 
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3.5 top-3.5 text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
                      title={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </button>
                  </div>

                  {/* Dynamic Password Feedback Checklist */}
                  {!existingUser?.id && formData.password.length > 0 && (
                    <div className="mt-3.5 p-4 bg-slate-50 border border-slate-100 rounded-2xl space-y-2.5 animate-in fade-in slide-in-from-top-2 duration-200">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Password Requirements:</p>
                      
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2 text-xs">
                          {hasMinLength ? (
                            <CheckCircle2 className="h-4.5 w-4.5 text-emerald-500 shrink-0" />
                          ) : (
                            <div className="h-4.5 w-4.5 rounded-full border border-slate-300 shrink-0 flex items-center justify-center text-[10px] text-slate-400 font-black">×</div>
                          )}
                          <span className={`font-semibold transition-colors duration-200 ${hasMinLength ? "text-slate-700" : "text-slate-400"}`}>
                            At least 8 characters ({formData.password.length}/8)
                          </span>
                        </div>
                        
                        <div className="flex items-center gap-2 text-xs">
                          {hasLetter ? (
                            <CheckCircle2 className="h-4.5 w-4.5 text-emerald-500 shrink-0" />
                          ) : (
                            <div className="h-4.5 w-4.5 rounded-full border border-slate-300 shrink-0 flex items-center justify-center text-[10px] text-slate-400 font-black">×</div>
                          )}
                          <span className={`font-semibold transition-colors duration-200 ${hasLetter ? "text-slate-700" : "text-slate-400"}`}>
                            At least one letter (a-z, A-Z)
                          </span>
                        </div>
                        
                        <div className="flex items-center gap-2 text-xs">
                          {hasNumber ? (
                            <CheckCircle2 className="h-4.5 w-4.5 text-emerald-500 shrink-0" />
                          ) : (
                            <div className="h-4.5 w-4.5 rounded-full border border-slate-300 shrink-0 flex items-center justify-center text-[10px] text-slate-400 font-black">×</div>
                          )}
                          <span className={`font-semibold transition-colors duration-200 ${hasNumber ? "text-slate-700" : "text-slate-400"}`}>
                            At least one number (0-9)
                          </span>
                        </div>
                      </div>
                      
                      {/* Visual Strength Progress Bar */}
                      <div className="h-1.5 w-full bg-slate-200 rounded-full overflow-hidden mt-1">
                        <div 
                          className={`h-full transition-all duration-500 ${
                            pwStrengthScore === 3 ? "bg-emerald-500 w-full" :
                            pwStrengthScore === 2 ? "bg-amber-500 w-2/3" :
                            pwStrengthScore === 1 ? "bg-rose-500 w-1/3" : "w-0"
                          }`}
                        />
                      </div>
                    </div>
                  )}
                </div>

                <div className="text-center pt-4 text-xs text-slate-500 font-semibold">
                  Already have an account?{" "}
                  <Link href="/login" className="text-indigo-650 hover:text-indigo-850 hover:underline font-bold transition-colors">
                    Sign In
                  </Link>
                </div>
              </motion.div>
            )}

            {/* STEP 2: BUSINESS DETAILS */}
            {step === 2 && (
              <motion.div
                key="step2"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-5 max-w-md mx-auto"
              >
                <div className="space-y-1.5">
                  <label className="text-xs font-black text-slate-500 uppercase tracking-wider">Shop Name</label>
                  <div className="relative" suppressHydrationWarning>
                    <Building2 className="absolute left-3.5 top-3.5 h-5 w-5 text-slate-400" />
                    <Input name="shopName" value={formData.shopName} onChange={handleChange} className="pl-11 bg-slate-50 border-slate-200 text-slate-900 focus-visible:ring-indigo-600 h-12 rounded-xl text-sm" placeholder="Ali Super Store" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-black text-slate-500 uppercase tracking-wider">Phone Number</label>
                  <Input name="shopPhone" value={formData.shopPhone} onChange={handleChange} className="bg-slate-50 border-slate-200 text-slate-900 focus-visible:ring-indigo-600 h-12 rounded-xl text-sm" placeholder="0300 1234567" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-black text-slate-500 uppercase tracking-wider">Shop Address (Optional)</label>
                  <Input name="shopAddress" value={formData.shopAddress} onChange={handleChange} className="bg-slate-50 border-slate-200 text-slate-900 focus-visible:ring-indigo-600 h-12 rounded-xl text-sm" placeholder="Main Market..." />
                </div>
              </motion.div>
            )}

            {/* STEP 3: INDUSTRY SELECTION */}
            {step === 3 && (
              <motion.div
                key="step3"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-8"
              >
                {/* SECTION 1: READY & OPERATIONAL MODULES */}
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3 bg-emerald-50/70 p-4 rounded-2xl border border-emerald-200">
                    <div className="flex items-center gap-2.5">
                      <div className="p-2 bg-emerald-600 text-white rounded-xl shadow-sm">
                        <CheckCircle2 size={18} />
                      </div>
                      <div>
                        <h2 className="text-sm font-black text-[#1e3a5f]">Ready & Operational Modules</h2>
                        <p className="text-[11px] text-slate-500 font-semibold">Fully built & available for instant operational shop setup.</p>
                      </div>
                    </div>
                    <span className="bg-emerald-600 text-white font-black text-[11px] px-3 py-1 rounded-full shadow-sm">
                      {INDUSTRIES.filter(i => i.status === "ready").length} Active Modules
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                    {INDUSTRIES.filter(i => i.status === "ready").map((ind) => {
                      const Icon = ind.icon;
                      const isSelected = formData.industryType === ind.id;

                      return (
                        <div
                          key={ind.id}
                          onClick={() => setFormData({ ...formData, industryType: ind.id })}
                          className={`p-6 rounded-3xl border cursor-pointer transition-all duration-300 relative overflow-hidden flex flex-col justify-between ${
                            isSelected 
                              ? 'border-indigo-600 bg-indigo-50/20 shadow-xl scale-[1.01] ring-2 ring-indigo-500/20' 
                              : 'border-slate-200 hover:border-slate-350 hover:bg-slate-50/80 bg-white shadow-sm'
                          }`}
                        >
                          <div className="space-y-4">
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex items-center gap-3">
                                <div className={`p-3 rounded-2xl shrink-0 ${isSelected ? 'bg-indigo-600 text-white shadow-md' : 'bg-slate-100 text-slate-700'}`}>
                                  <Icon className="h-5 w-5" />
                                </div>
                                <div>
                                  <h3 className="font-black text-sm text-[#1e3a5f] leading-snug">{ind.name}</h3>
                                  <p className="text-[10px] text-slate-500 font-semibold mt-0.5">{ind.desc}</p>
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center justify-between pt-1 border-t border-slate-100">
                              <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-black px-2.5 py-0.5 rounded-full">
                                <CheckCircle2 size={11} className="text-emerald-600" /> Ready
                              </span>

                              {isSelected && (
                                <span className="inline-flex items-center gap-1 bg-indigo-600 text-white text-[10px] font-black px-2.5 py-0.5 rounded-full shadow-sm">
                                  <CheckCircle2 size={11} /> Selected
                                </span>
                              )}
                            </div>

                            <div className="space-y-3 pt-1">
                              <div>
                                <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest block mb-1">Covers:</span>
                                <div className="flex flex-wrap gap-1.5">
                                  {ind.covers.map((c, i) => (
                                    <span key={i} className="text-[9px] px-2 py-0.5 rounded-md font-bold bg-slate-100 text-slate-600 border border-slate-200/50">
                                      {c}
                                    </span>
                                  ))}
                                </div>
                              </div>

                              <div>
                                <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest block mb-1">Features:</span>
                                <div className="space-y-1">
                                  {ind.features.slice(0, 4).map((f, i) => (
                                    <div key={i} className="flex items-center text-[10px] font-semibold text-slate-600">
                                      <CheckSquare className="h-3 w-3 mr-1.5 text-indigo-500 shrink-0" />
                                      <span>{f}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* SECTION 2: COMING SOON / UNDER DEVELOPMENT MODULES */}
                <div className="space-y-4 pt-4 border-t-2 border-dashed border-slate-200">
                  <div className="flex flex-wrap items-center justify-between gap-3 bg-amber-50/70 p-4 rounded-2xl border border-amber-250">
                    <div className="flex items-center gap-2.5">
                      <div className="p-2 bg-amber-500 text-white rounded-xl shadow-sm">
                        <Clock size={18} className="animate-pulse" />
                      </div>
                      <div>
                        <h2 className="text-sm font-black text-[#1e3a5f]">Coming Soon / Under Development</h2>
                        <p className="text-[11px] text-slate-500 font-semibold">Undergoing final enhancements. Core POS & Khata active upon registration.</p>
                      </div>
                    </div>
                    <span className="bg-amber-500 text-white font-black text-[11px] px-3 py-1 rounded-full shadow-sm">
                      {INDUSTRIES.filter(i => i.status === "development").length} Coming Soon
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                    {INDUSTRIES.filter(i => i.status === "development").map((ind) => {
                      const Icon = ind.icon;
                      const isSelected = formData.industryType === ind.id;

                      return (
                        <div
                          key={ind.id}
                          onClick={() => {
                            setFormData({ ...formData, industryType: ind.id });
                            toast.info(`${ind.name} is Coming Soon (Under Development). Core POS & Khata will be active for your shop.`);
                          }}
                          className={`p-6 rounded-3xl border cursor-pointer transition-all duration-300 relative overflow-hidden flex flex-col justify-between ${
                            isSelected 
                              ? 'border-amber-600 bg-amber-50/20 shadow-xl scale-[1.01] ring-2 ring-amber-500/20' 
                              : 'border-amber-200/60 hover:border-amber-300 hover:bg-amber-50/30 bg-white/90 shadow-sm'
                          }`}
                        >
                          <div className="space-y-4">
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex items-center gap-3">
                                <div className={`p-3 rounded-2xl shrink-0 ${isSelected ? 'bg-amber-600 text-white shadow-md' : 'bg-amber-100 text-amber-800'}`}>
                                  <Icon className="h-5 w-5" />
                                </div>
                                <div>
                                  <h3 className="font-black text-sm text-[#1e3a5f] leading-snug">{ind.name}</h3>
                                  <p className="text-[10px] text-slate-500 font-semibold mt-0.5">{ind.desc}</p>
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center justify-between pt-1 border-t border-slate-100">
                              <span className="inline-flex items-center gap-1 bg-amber-100 text-amber-800 border border-amber-300 text-[10px] font-black px-2.5 py-0.5 rounded-full">
                                <Clock size={11} className="text-amber-600 animate-pulse" /> Coming Soon
                              </span>

                              {isSelected && (
                                <span className="inline-flex items-center gap-1 bg-amber-600 text-white text-[10px] font-black px-2.5 py-0.5 rounded-full shadow-sm">
                                  <CheckCircle2 size={11} /> Selected
                                </span>
                              )}
                            </div>

                            <div className="space-y-3 pt-1">
                              <div>
                                <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest block mb-1">Covers:</span>
                                <div className="flex flex-wrap gap-1.5">
                                  {ind.covers.map((c, i) => (
                                    <span key={i} className="text-[9px] px-2 py-0.5 rounded-md font-bold bg-amber-50 text-amber-800 border border-amber-200/50">
                                      {c}
                                    </span>
                                  ))}
                                </div>
                              </div>

                              <div>
                                <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest block mb-1">Features:</span>
                                <div className="space-y-1">
                                  {ind.features.slice(0, 4).map((f, i) => (
                                    <div key={i} className="flex items-center text-[10px] font-semibold text-slate-600">
                                      <CheckSquare className="h-3 w-3 mr-1.5 text-amber-600 shrink-0" />
                                      <span>{f}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </motion.div>
            )}

            {/* STEP 4: EXTRA FEATURES */}
            {step === 4 && formData.industryType === "crockery" && (
              <motion.div
                key="step4"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-6 max-w-lg mx-auto"
              >
                <div className="text-center mb-6">
                  <h2 className="text-xl font-bold text-[#1e3a5f]">Installment / EMI Settings (اقساط کی ترتیبات)</h2>
                  <p className="text-xs text-slate-500 font-semibold mt-1">
                    Choose whether you want to sell crockery items on monthly/weekly installments.
                  </p>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div
                    onClick={() => setHasEmi(false)}
                    className={`p-5 rounded-2xl border cursor-pointer transition-all duration-200 ${
                      !hasEmi 
                        ? 'border-indigo-600 bg-indigo-50/20 shadow-md scale-[1.01]' 
                        : 'border-slate-200 hover:bg-slate-50 bg-white'
                    }`}
                  >
                    <div className="flex items-center gap-3 mb-2">
                      <div className={`p-2 rounded-lg ${!hasEmi ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
                        <ShoppingBag className="h-5 w-5" />
                      </div>
                      <h3 className="font-black text-sm text-slate-800">No Installments</h3>
                    </div>
                    <p className="text-xs text-slate-500 leading-relaxed pl-10 font-medium">
                      Standard retail POS and invoicing only. Best for cash/credit sales.
                    </p>
                    <p className="text-[10px] text-slate-450 pl-10 mt-1.5 font-urdu font-black">
                      صرف نقد اور ادھار سیلز (کوئی اقساط نہیں)
                    </p>
                  </div>

                  <div
                    onClick={() => setHasEmi(true)}
                    className={`p-5 rounded-2xl border cursor-pointer transition-all duration-200 ${
                      hasEmi 
                        ? 'border-indigo-600 bg-indigo-50/20 shadow-md scale-[1.01]' 
                        : 'border-slate-200 hover:bg-slate-50 bg-white'
                    }`}
                  >
                    <div className="flex items-center gap-3 mb-2">
                      <div className={`p-2 rounded-lg ${hasEmi ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
                        <Smartphone className="h-5 w-5" />
                      </div>
                      <h3 className="font-black text-sm text-slate-800">Enable EMI / Installments</h3>
                    </div>
                    <p className="text-xs text-slate-500 leading-relaxed pl-10 font-medium">
                      Track installments, create schedules, down payments, and markup.
                    </p>
                    <p className="text-[10px] text-slate-450 pl-10 mt-1.5 font-urdu font-black">
                      اقساط کا مکمل نظام (شیڈول، ڈاؤن پیمنٹ اور منافع)
                    </p>
                  </div>
                </div>

                <div className="bg-amber-50 border border-amber-250 rounded-2xl p-4 text-xs text-amber-800 flex items-start gap-2.5">
                  <span className="font-bold text-sm leading-none mt-0.5">⚠️</span>
                  <div>
                    <p className="font-black text-xs">Note on Subscription (سبسکرپشن نوٹ):</p>
                    <p className="mt-1 font-semibold leading-relaxed">
                      Installment feature requires a premium plan. If you enable it now, it will work in the trial period and might depend on subscription later.
                    </p>
                    <p className="mt-1 font-urdu font-bold text-[10px] leading-relaxed">
                      اقساط کا فیچر پریمیم پلان کا حصہ ہے۔ اگر آپ اسے ابھی آن کرتے ہیں تو یہ ٹرائل میں چلے گا، بعد میں سبسکرپشن پلان پر لاگو ہوگا۔
                    </p>
                  </div>
                </div>
              </motion.div>
            )}

          </AnimatePresence>
        </div>

        {/* Navigation Buttons */}
        <div className="flex justify-between mt-10 pt-6 border-t border-slate-150 max-w-md mx-auto md:max-w-none">
          <Button
            variant="ghost"
            onClick={prevStep}
            disabled={step === 1 || loading}
            className="text-slate-500 hover:text-slate-800 hover:bg-slate-100 h-12 px-6 rounded-xl font-bold text-xs"
          >
            <ChevronLeft className="mr-2 h-4 w-4" /> Back
          </Button>
          
          {step < 3 || (step === 3 && formData.industryType === "crockery") ? (
            <Button onClick={nextStep} className="bg-[#1e3a5f] hover:bg-[#152a46] text-white h-12 px-8 text-xs font-black shadow-lg rounded-xl flex items-center gap-1.5">
              Continue <ChevronRight className="h-4 w-4" />
            </Button>
          ) : (
            <Button onClick={handleRegister} disabled={loading} className="bg-[#1e3a5f] hover:bg-[#152a46] text-white h-12 px-8 text-xs font-black shadow-lg rounded-xl flex items-center gap-1.5">
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Complete Setup <CheckCircle2 className="h-4 w-4" />
            </Button>
          )}
        </div>

      </div>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={
      <div className="h-screen bg-slate-900 flex flex-col justify-center items-center text-slate-400">
        <Loader2 className="h-10 w-10 animate-spin text-indigo-650 mb-3" />
        <p className="font-semibold text-sm">Loading registration setup...</p>
      </div>
    }>
      <RegisterForm />
    </Suspense>
  );
}
