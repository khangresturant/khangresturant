"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useLanguage } from "@/context/LanguageContext";

export default function LoginPage() {
  const supabase = createClient();
  const [email, setEmail] = useState("superadmin@hisabx.com");
  const [password, setPassword] = useState("admin123");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { t, language, setLanguage } = useLanguage();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        toast.error(t("login_failed"), {
          description: error.message,
        });
        return;
      }

      toast.success(t("login_success"), {
        description: t("admin_mode"),
      });
      
      router.push('/dashboard');
    } catch (err: any) {
      toast.error(t("login_failed"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50 p-4 relative">
      
      {/* Top Right Language Switcher */}
      <div className="absolute top-4 right-4 z-10 flex items-center bg-white p-1 rounded-full border border-slate-200 shadow-sm">
        <button
          onClick={() => setLanguage("en")}
          className={`px-3 py-1 text-xs font-bold rounded-full transition-all duration-200 ${
            language === "en"
              ? "bg-blue-600 text-white shadow-sm"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          English
        </button>
        <button
          onClick={() => setLanguage("ur")}
          className={`px-3 py-1 text-xs font-bold rounded-full transition-all duration-200 font-sans ${
            language === "ur"
              ? "bg-blue-600 text-white shadow-sm"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          اردو
        </button>
      </div>

      <div className="w-full max-w-md animate-in fade-in zoom-in-95 duration-500 ease-out">
        <Card className="shadow-xl border-zinc-200">
          <CardHeader className="space-y-2 text-center pb-8">
            <div className="flex justify-center mb-2">
              <div className="h-14 w-14 bg-zinc-900 rounded-xl flex items-center justify-center shadow-md transform transition-transform hover:scale-105 duration-300">
                <span className="text-white font-black text-2xl tracking-tighter">HX</span>
              </div>
            </div>
            <CardTitle className="text-2xl font-bold tracking-tight text-zinc-900">{t("login_title")}</CardTitle>
            <CardDescription className="text-zinc-500 font-medium">
              {t("login_subtitle")}
            </CardDescription>
          </CardHeader>
          <form onSubmit={handleLogin}>
            <CardContent className="space-y-5">
              <div className="space-y-2 group">
                <Label 
                  htmlFor="email" 
                  className="block text-zinc-700 font-semibold transition-colors group-focus-within:text-zinc-900"
                >
                  {t("email_label")}
                </Label>
                <Input 
                  id="email" 
                  type="email" 
                  placeholder="admin@hisabx.com" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-11 transition-all duration-300 border-zinc-300 focus-visible:ring-1 focus-visible:ring-zinc-900 focus-visible:border-zinc-900"
                  required 
                />
              </div>
              <div className="space-y-2 group">
                <div className="flex items-center justify-between">
                  <Label 
                    htmlFor="password" 
                    className="text-zinc-700 font-semibold transition-colors group-focus-within:text-zinc-900"
                  >
                    {t("password_label")}
                  </Label>
                </div>
                <Input 
                  id="password" 
                  type="password" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-11 transition-all duration-300 border-zinc-300 focus-visible:ring-1 focus-visible:ring-zinc-900 focus-visible:border-zinc-900"
                  required 
                />
              </div>
            </CardContent>
            <CardFooter className="pt-2 pb-6">
              <Button 
                type="submit" 
                className="w-full bg-zinc-900 hover:bg-zinc-800 text-white transition-all duration-300 h-11 shadow-md hover:shadow-lg" 
                disabled={loading}
              >
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : t("login_btn")}
              </Button>
            </CardFooter>
          </form>
        </Card>
        <p className="text-center text-xs font-medium text-zinc-400 mt-8 tracking-wide uppercase">
          &copy; {new Date().getFullYear()} Hisab X Global. All rights reserved.
        </p>
      </div>
    </div>
  );
}

