"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
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
  Leaf
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const INDUSTRIES = [
  { id: "karyana", name: "Karyana / Grocery", icon: ShoppingBag, desc: "Barcode scanning & packing variants" },
  { id: "pharmacy", name: "Pharmacy", icon: Pill, desc: "Formulations & expiry tracking" },
  { id: "tailor", name: "Tailor Shop", icon: Scissors, desc: "Measurements & karigar wages" },
  { id: "fuel", name: "Petrol Pump", icon: Fuel, desc: "Tank dips & shift meter readings" },
  { id: "electronics", name: "Electronics & Mobile", icon: Smartphone, desc: "Installments & EMI tracking" },
  { id: "fertilizer", name: "Fertilizer & Seeds", icon: Leaf, desc: "Batch tracking & seasonal udhaar" },
  { id: "showroom", name: "Car Showroom / Rental", icon: Car, desc: "Vehicle directory & rental tracking" },
  { id: "hardware", name: "Hardware & Sanitary", icon: Wrench, desc: "Bulk quantity & dimensions" },
  { id: "garments", name: "Garments & Boutique", icon: Shirt, desc: "Size & color variations" },
  { id: "restaurant", name: "Restaurant / Cafe", icon: Coffee, desc: "Table management & KOT" },
  { id: "general", name: "General Retail POS", icon: Store, desc: "Standard billing & inventory" },
];

export default function RegisterPage() {
  const router = useRouter();
  const supabase = createClient();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [existingUser, setExistingUser] = useState<any>(null);

  useEffect(() => {
    // Check if user is already logged in
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        setExistingUser(data.user);
        setStep(2); // Skip step 1 if already logged in!
        setFormData(prev => ({ ...prev, email: data.user.email || "" }));
      }
    });
  }, [supabase.auth]);

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    shopName: "",
    shopPhone: "",
    shopAddress: "",
    industryType: "",
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleRegister = async () => {
    if (!formData.industryType) {
      toast.error("Please select an industry");
      return;
    }
    
    setLoading(true);
    try {
      let userId = existingUser?.id;
      const isExistingUser = !!userId;

      // 1. Sign Up Admin User ONLY if not already logged in
      if (!userId) {
        const { data: authData, error: authError } = await supabase.auth.signUp({
          email: formData.email,
          password: formData.password,
        });
        if (authError) throw authError;
        userId = authData.user?.id;
      }

      if (!userId) throw new Error("Authentication failed");

      // 2. Create Shop
      const { data: shopData, error: shopError } = await supabase
        .from('shops')
        .insert({
          name: formData.shopName,
          phone: formData.shopPhone,
          address: formData.shopAddress,
          industry_type: formData.industryType,
          owner_id: userId
        })
        .select()
        .single();

      if (shopError) throw shopError;

      // 3. Handle User Profile linking
      if (isExistingUser) {
        // Update active shop_id in user_profiles
        const { error: profileUpdateError } = await supabase
          .from('user_profiles')
          .update({ shop_id: shopData.id })
          .eq('id', userId);

        if (profileUpdateError) throw profileUpdateError;
      } else {
        // Create new user profile record
        const { error: profileError } = await supabase
          .from('user_profiles')
          .insert({
            id: userId,
            shop_id: shopData.id,
            name: formData.name || "Admin",
            role: 'superadmin'
          });

        if (profileError) throw profileError;
      }

      // 4. Map user-shop mapping record in user_shops
      const { error: userShopError } = await supabase
        .from('user_shops')
        .insert({
          user_id: userId,
          shop_id: shopData.id,
          role: 'superadmin'
        });

      if (userShopError) throw userShopError;

      toast.success(isExistingUser ? "New business registered successfully!" : "Registration Successful! Welcome to Hisab X.");
      
      // Redirect to dashboard (force a window reload/redirect to refresh the context shopId!)
      if (typeof window !== "undefined") {
        window.location.href = "/dashboard";
      } else {
        router.push("/dashboard");
      }

    } catch (error: any) {
      toast.error(error.message || "An error occurred during registration");
    } finally {
      setLoading(false);
    }
  };

  const nextStep = () => setStep((s) => Math.min(s + 1, 3));
  const prevStep = () => setStep((s) => Math.max(s - 1, 1));

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 font-sans">
      
      {/* Soft Background Accent */}
      <div className="absolute top-0 w-full h-80 bg-blue-600 rounded-b-[4rem] md:rounded-b-[8rem] shadow-lg pointer-events-none" />

      <div className="w-full max-w-3xl bg-white border border-slate-100 p-8 md:p-12 rounded-3xl shadow-xl relative z-10 overflow-hidden">
        
        {/* Logo or Brand */}
        <div className="mb-8 text-center">
          <h2 className="text-2xl font-bold text-blue-600 mb-1">Hisab X</h2>
          <p className="text-sm text-slate-500 font-medium tracking-wide uppercase">Business Setup</p>
        </div>

        {/* Progress Bar */}
        <div className="flex gap-3 mb-10">
          {[1, 2, 3].map((i) => (
            <div key={i} className={`h-2 flex-1 rounded-full transition-colors duration-500 ${step >= i ? 'bg-blue-600' : 'bg-slate-200'}`} />
          ))}
        </div>

        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-slate-800 mb-3">
            {step === 1 && "Create Your Account"}
            {step === 2 && "Business Details"}
            {step === 3 && "Select Your Industry"}
          </h1>
          <p className="text-slate-500">
            {step === 1 && "Start managing your business smartly today."}
            {step === 2 && "Tell us about your shop to customize your experience."}
            {step === 3 && "We will set up features tailored for your specific business."}
          </p>
        </div>

        <div className="min-h-[320px]">
          <AnimatePresence mode="wait">
            
            {/* STEP 1: ADMIN */}
            {step === 1 && (
              <motion.div
                key="step1"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-5 max-w-md mx-auto"
              >
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700">Full Name</label>
                  <div className="relative">
                    <User className="absolute left-3 top-3 h-5 w-5 text-slate-400" />
                    <Input name="name" value={formData.name} onChange={handleChange} className="pl-10 bg-slate-50 border-slate-200 text-slate-900 focus-visible:ring-blue-600 h-12" placeholder="Ali Raza" />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700">Email Address</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3 h-5 w-5 text-slate-400" />
                    <Input name="email" type="email" value={formData.email} onChange={handleChange} className="pl-10 bg-slate-50 border-slate-200 text-slate-900 focus-visible:ring-blue-600 h-12" placeholder="admin@shop.com" />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700">Password</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 h-5 w-5 text-slate-400" />
                    <Input name="password" type="password" value={formData.password} onChange={handleChange} className="pl-10 bg-slate-50 border-slate-200 text-slate-900 focus-visible:ring-blue-600 h-12" placeholder="••••••••" />
                  </div>
                </div>
              </motion.div>
            )}

            {/* STEP 2: BUSINESS */}
            {step === 2 && (
              <motion.div
                key="step2"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-5 max-w-md mx-auto"
              >
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700">Shop Name</label>
                  <div className="relative">
                    <Building2 className="absolute left-3 top-3 h-5 w-5 text-slate-400" />
                    <Input name="shopName" value={formData.shopName} onChange={handleChange} className="pl-10 bg-slate-50 border-slate-200 text-slate-900 focus-visible:ring-blue-600 h-12" placeholder="Ali Super Store" />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700">Phone Number</label>
                  <Input name="shopPhone" value={formData.shopPhone} onChange={handleChange} className="bg-slate-50 border-slate-200 text-slate-900 focus-visible:ring-blue-600 h-12" placeholder="0300 1234567" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700">Shop Address (Optional)</label>
                  <Input name="shopAddress" value={formData.shopAddress} onChange={handleChange} className="bg-slate-50 border-slate-200 text-slate-900 focus-visible:ring-blue-600 h-12" placeholder="Main Market..." />
                </div>
              </motion.div>
            )}

            {/* STEP 3: INDUSTRY */}
            {step === 3 && (
              <motion.div
                key="step3"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="grid grid-cols-1 sm:grid-cols-2 gap-4"
              >
                {INDUSTRIES.map((ind) => (
                  <div
                    key={ind.id}
                    onClick={() => setFormData({ ...formData, industryType: ind.id })}
                    className={`p-5 rounded-2xl border-2 cursor-pointer transition-all duration-200 ${
                      formData.industryType === ind.id 
                        ? 'border-blue-600 bg-blue-50 shadow-md transform scale-[1.02]' 
                        : 'border-slate-200 hover:border-blue-300 hover:bg-slate-50 bg-white'
                    }`}
                  >
                    <div className="flex items-center gap-4 mb-2 relative">
                      <div className={`p-2 rounded-lg ${formData.industryType === ind.id ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
                         <ind.icon className="h-6 w-6" />
                      </div>
                      <h3 className={`font-bold text-lg ${formData.industryType === ind.id ? 'text-blue-900' : 'text-slate-700'}`}>
                        {ind.name}
                      </h3>
                      {formData.industryType === ind.id && (
                        <CheckCircle2 className="absolute right-0 top-1 h-6 w-6 text-blue-600" />
                      )}
                    </div>
                    <p className="text-sm text-slate-500 pl-14">{ind.desc}</p>
                  </div>
                ))}
              </motion.div>
            )}

          </AnimatePresence>
        </div>

        {/* Navigation Buttons */}
        <div className="flex justify-between mt-10 pt-6 border-t border-slate-100 max-w-md mx-auto md:max-w-none">
          <Button
            variant="ghost"
            onClick={prevStep}
            disabled={step === 1 || loading}
            className="text-slate-500 hover:text-slate-800 hover:bg-slate-100 h-12 px-6"
          >
            <ChevronLeft className="mr-2 h-4 w-4" /> Back
          </Button>
          
          {step < 3 ? (
            <Button onClick={nextStep} className="bg-blue-600 hover:bg-blue-700 text-white h-12 px-8 text-md shadow-lg shadow-blue-200">
              Continue <ChevronRight className="ml-2 h-4 w-4" />
            </Button>
          ) : (
            <Button onClick={handleRegister} disabled={loading} className="bg-blue-600 hover:bg-blue-700 text-white h-12 px-8 text-md shadow-lg shadow-blue-200">
              {loading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : null}
              Complete Setup <CheckCircle2 className="ml-2 h-5 w-5" />
            </Button>
          )}
        </div>

      </div>
    </div>
  );
}
