"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { ShopProvider } from "@/context/ShopContext";
import { Sidebar } from "@/components/dashboard/Sidebar";
import { Bell, Search, Globe, Menu } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useLanguage } from "@/context/LanguageContext";
import { motion } from "framer-motion";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { language, setLanguage, t } = useLanguage();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const saved = localStorage.getItem("sidebar_collapsed");
    if (saved === "true") {
      setSidebarCollapsed(true);
    }
  }, []);

  const toggleCollapsed = () => {
    setSidebarCollapsed(prev => {
      const newVal = !prev;
      localStorage.setItem("sidebar_collapsed", String(newVal));
      return newVal;
    });
  };

  return (
    <ShopProvider>
      <div className="flex h-screen w-full bg-zinc-50 overflow-hidden font-sans">
        
        {/* Dynamic Client-Side Sidebar */}
        <Sidebar 
          isOpen={sidebarOpen}
          isCollapsed={sidebarCollapsed}
          onClose={() => setSidebarOpen(false)}
          onToggleCollapsed={toggleCollapsed}
        />

        {/* Main Content Area */}
        <main className="flex-1 flex flex-col min-w-0">
          
          {/* Top Navbar */}
          {pathname !== "/dashboard/pos" && (
            <header className="h-16 bg-white border-b border-zinc-200 flex items-center justify-between px-6 shrink-0 shadow-sm z-10">
              <div className="flex items-center gap-4 w-full max-w-md">
                {/* Hamburger Toggle Button (Mobile Only) */}
                <button 
                  onClick={() => setSidebarOpen(true)}
                  className="md:hidden p-2 -ml-2 rounded-xl text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors"
                  aria-label="Open Sidebar"
                >
                  <Menu size={20} />
                </button>
                
                <div className="relative w-full">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
                  <Input 
                    type="search" 
                    placeholder={t("search_placeholder")} 
                    className="w-full bg-slate-50 pl-10 border-slate-200 focus-visible:ring-blue-600 h-10 rounded-full text-sm" 
                  />
                </div>
              </div>
              
              <div className="flex items-center gap-4">
                {/* Language Switcher Pill */}
                <div className="flex items-center bg-slate-100 p-1 rounded-full border border-slate-200 shadow-inner">
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

                {/* Notifications */}
                <button className="relative p-2 rounded-full hover:bg-slate-100 transition-colors">
                  <Bell size={20} className="text-slate-600" />
                  <span className="absolute top-1.5 right-1.5 h-2.5 w-2.5 rounded-full bg-red-500 border-2 border-white"></span>
                </button>
              </div>
            </header>
          )}

          {/* Page Content */}
          <div className={`flex-1 overflow-auto ${pathname === "/dashboard/pos" ? "p-0" : "p-6 md:p-8"}`}>
            {children}
          </div>
          
        </main>
      </div>
    </ShopProvider>
  );
}

