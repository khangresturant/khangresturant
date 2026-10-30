'use client';

import React, { useEffect, useState, use } from "react";
import Link from "next/link";
import { 
  ShoppingBag, 
  Search, 
  Store, 
  MapPin, 
  Phone, 
  Plus, 
  Minus, 
  Trash2, 
  Download, 
  Sparkles, 
  X, 
  CheckCircle2, 
  User, 
  Send,
  Building2,
  Clock,
  Truck,
  XCircle,
  PackageCheck,
  UserCheck,
  LogOut,
  ListOrdered
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { StoreProductVisual } from "@/components/store/StoreProductVisual";

interface Product {
  id: string;
  name: string;
  base_price?: number;
  sale_price_single?: number;
  sale_price_pack?: number;
  current_stock: number;
  unit?: string;
  image_url?: string | null;
  category_id?: string;
}

interface Category {
  id: string;
  name: string;
}

interface Shop {
  id: string;
  name: string;
  industry_type: string;
  store_slug?: string;
  store_banner_url?: string;
  store_tagline?: string;
  store_theme_color?: string;
  delivery_charges?: number;
  min_order_amount?: number;
  phone?: string;
  address?: string;
}

interface CartItem {
  product: Product;
  quantity: number;
  unitPrice: number;
}

interface Customer {
  id?: string;
  name: string;
  phone: string;
  address: string;
}

interface CustomerOrder {
  id: string;
  total_amount: number;
  status: string;
  created_at: string;
  items: any[];
}

const STATUS_BADGES: Record<string, { label: string; bg: string; text: string; icon: any }> = {
  pending: { label: "Order Pending", bg: "bg-amber-100", text: "text-amber-800", icon: Clock },
  accepted: { label: "Accepted & Packing", bg: "bg-blue-100", text: "text-blue-800", icon: PackageCheck },
  out_for_delivery: { label: "Out for Delivery", bg: "bg-purple-100", text: "text-purple-800", icon: Truck },
  delivered: { label: "Delivered", bg: "bg-emerald-100", text: "text-emerald-800", icon: CheckCircle2 },
  cancelled: { label: "Cancelled", bg: "bg-rose-100", text: "text-rose-800", icon: XCircle },
};

export default function VipStorefrontPage({ params }: { params: Promise<{ slug: string }> }) {
  const resolvedParams = use(params);
  const slug = resolvedParams.slug;
  const supabase = createClient();

  const [shop, setShop] = useState<Shop | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);

  // Customer Auth & Portal State
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "signup">("signup");
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [authForm, setAuthForm] = useState({ name: "", phone: "", address: "", password: "" });

  // Customer My Orders Drawer State
  const [isMyOrdersOpen, setIsMyOrdersOpen] = useState(false);
  const [myOrders, setMyOrders] = useState<CustomerOrder[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);

  // PWA Deferred Prompt State
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [canInstallPwa, setCanInstallPwa] = useState(false);

  useEffect(() => {
    setMounted(true);
    fetchStoreData();

    // Listen for PWA install prompt
    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setCanInstallPwa(true);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    return () => window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
  }, [slug]);

  const fetchStoreData = async () => {
    setLoading(true);
    try {
      // 1. Fetch shop by slug or ID
      let { data: shopData } = await supabase
        .from("shops")
        .select("*")
        .eq("store_slug", slug)
        .maybeSingle();

      if (!shopData) {
        const { data: shopById } = await supabase
          .from("shops")
          .select("*")
          .eq("id", slug)
          .maybeSingle();
        shopData = shopById;
      }

      if (!shopData) {
        toast.error("Store not found!");
        setLoading(false);
        return;
      }

      setShop(shopData);

      // Restore Customer Session for this shop
      const savedSession = localStorage.getItem(`theaccounts_customer_${shopData.id}`);
      if (savedSession) {
        try {
          const parsedCustomer = JSON.parse(savedSession);
          setCustomer(parsedCustomer);
        } catch (e) {
          console.error("Session parse error", e);
        }
      }

      // 2. Fetch categories for this shop
      const { data: catData } = await supabase
        .from("categories")
        .select("id, name")
        .eq("shop_id", shopData.id)
        .order("name", { ascending: true });

      if (catData) {
        setCategories(catData);
      }

      // 3. Fetch active products for this shop
      const { data: prodData } = await supabase
        .from("products")
        .select("id, name, base_price, sale_price_single, sale_price_pack, current_stock, unit, image_url, category_id")
        .eq("shop_id", shopData.id)
        .order("name", { ascending: true });

      if (prodData) {
        setProducts(prodData);
      }
    } catch (err) {
      console.error("Error loading store data:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchCustomerOrders = async (phoneNum: string) => {
    if (!shop || !phoneNum) return;
    setLoadingOrders(true);
    try {
      const { data } = await supabase
        .from("online_orders")
        .select("*")
        .eq("shop_id", shop.id)
        .eq("customer_phone", phoneNum)
        .order("created_at", { ascending: false });

      if (data) setMyOrders(data);
    } catch (err) {
      console.error("Error fetching customer orders:", err);
    } finally {
      setLoadingOrders(false);
    }
  };

  const getProductPrice = (p: Product): number => {
    return Number(p.sale_price_single || p.base_price || p.sale_price_pack || 0);
  };

  const handleAddToCart = (product: Product) => {
    const price = getProductPrice(product);
    setCart((prev) => {
      const existing = prev.find((item) => item.product.id === product.id);
      if (existing) {
        return prev.map((item) =>
          item.product.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [...prev, { product, quantity: 1, unitPrice: price }];
    });
    toast.success(`Added ${product.name} to cart!`);
  };

  const updateQuantity = (productId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.product.id === productId) {
            const newQty = item.quantity + delta;
            return newQty > 0 ? { ...item, quantity: newQty } : null;
          }
          return item;
        })
        .filter(Boolean) as CartItem[]
    );
  };

  const subtotal = cart.reduce((acc, item) => acc + item.unitPrice * item.quantity, 0);
  const deliveryFee = shop?.delivery_charges || 0;
  const grandTotal = subtotal + deliveryFee;

  // 1. Direct Online Order -> Goes to E-Commerce Database & Merchant Desk
  const handleDirectOnlineCheckout = async () => {
    if (!customer) {
      setIsAuthOpen(true);
      return;
    }

    if (cart.length === 0) {
      toast.error("Your cart is empty!");
      return;
    }

    try {
      const orderPayload = {
        shop_id: shop!.id,
        customer_name: customer.name,
        customer_phone: customer.phone,
        delivery_address: customer.address,
        total_amount: grandTotal,
        delivery_fee: deliveryFee,
        payment_mode: "cod",
        status: "pending",
        items: cart.map((i) => ({
          product_id: i.product.id,
          name: i.product.name,
          quantity: i.quantity,
          unit_price: i.unitPrice,
          subtotal: i.unitPrice * i.quantity,
        })),
      };

      const { error } = await supabase.from("online_orders").insert([orderPayload]);
      if (error) throw error;

      toast.success("Order submitted to merchant! Track status in My Orders.");
      setCart([]);
      setIsCartOpen(false);
      fetchCustomerOrders(customer.phone);
    } catch (err: any) {
      toast.error("Failed to place order: " + err.message);
    }
  };

  // 2. Direct WhatsApp Order -> ONLY opens WhatsApp chat (does NOT save to E-Commerce Database)
  const handleWhatsAppCheckout = () => {
    if (cart.length === 0) {
      toast.error("Your cart is empty!");
      return;
    }

    const itemsList = cart.map((i) => `• ${i.product.name} (x${i.quantity}) - Rs ${i.unitPrice * i.quantity}`).join("%0A");
    const custInfo = customer ? `*Customer:* ${customer.name} (${customer.phone})%0A*Address:* ${customer.address}%0A%0A` : "";
    const waMsg = `*NEW WHATSAPP ORDER - ${shop!.name}*%0A%0A${custInfo}*Items:*%0A${itemsList}%0A%0A*Subtotal:* Rs ${subtotal}%0A*Delivery Fee:* Rs ${deliveryFee}%0A*Grand Total:* Rs ${grandTotal}`;

    if (shop?.phone) {
      const cleanPhone = shop.phone.replace(/[^0-9]/g, "");
      window.open(`https://wa.me/${cleanPhone}?text=${waMsg}`, "_blank");
    } else {
      toast.error("Shop WhatsApp number not configured!");
      return;
    }

    toast.success("Opened WhatsApp with cart details!");
    setCart([]);
    setIsCartOpen(false);
  };

  const handleSaveCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authForm.phone || !authForm.name) {
      toast.error("Please enter required name and phone number!");
      return;
    }

    try {
      // 1. Check existing customer or insert
      const { data: existingCust } = await supabase
        .from("online_customers")
        .select("*")
        .eq("phone", authForm.phone)
        .maybeSingle();

      let currentCustomer: Customer;

      if (existingCust) {
        currentCustomer = {
          id: existingCust.id,
          name: existingCust.name,
          phone: existingCust.phone,
          address: existingCust.address || authForm.address,
        };
      } else {
        const { data: newCust, error: insertErr } = await supabase
          .from("online_customers")
          .insert([{
            shop_id: shop!.id,
            name: authForm.name,
            phone: authForm.phone,
            address: authForm.address,
            password_hash: authForm.password || "123456"
          }])
          .select()
          .single();

        if (insertErr) throw insertErr;

        currentCustomer = {
          id: newCust.id,
          name: newCust.name,
          phone: newCust.phone,
          address: newCust.address,
        };
      }

      setCustomer(currentCustomer);
      localStorage.setItem(`theaccounts_customer_${shop!.id}`, JSON.stringify(currentCustomer));
      setIsAuthOpen(false);
      toast.success(`Welcome ${currentCustomer.name}!`);
      fetchCustomerOrders(currentCustomer.phone);
    } catch (err: any) {
      toast.error("Account error: " + err.message);
    }
  };

  const handleLogoutCustomer = () => {
    setCustomer(null);
    if (shop) {
      localStorage.removeItem(`theaccounts_customer_${shop.id}`);
    }
    toast.success("Logged out successfully.");
  };

  const handleInstallPwa = () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      deferredPrompt.userChoice.then((choiceResult: any) => {
        if (choiceResult.outcome === "accepted") {
          toast.success("App installed on your home screen!");
        }
        setDeferredPrompt(null);
        setCanInstallPwa(false);
      });
    }
  };

  const filteredProducts = products.filter((p) => {
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCat = selectedCategory === "all" || p.category_id === selectedCategory;
    return matchesSearch && matchesCat;
  });

  if (!mounted || loading) {
    return (
      <div className="min-h-screen bg-[#07080b] flex items-center justify-center text-amber-100 font-sans">
        <div className="flex items-center gap-3">
          <Sparkles className="animate-spin text-amber-300" size={24} />
          <span className="font-bold text-sm tracking-widest uppercase">Opening the collection...</span>
        </div>
      </div>
    );
  }

  if (!shop) {
    return (
      <div className="min-h-screen bg-[#07080b] text-amber-100 font-sans flex flex-col items-center justify-center p-6 text-center">
        <Store size={48} className="text-amber-300/70 mb-3" />
        <h2 className="text-xl font-black text-white">Store Not Found</h2>
        <p className="text-xs text-white/50 mt-1 max-w-sm">The requested store URL is invalid or inactive.</p>
        <Link href="/shops" className="mt-4 px-4 py-2 bg-amber-300 text-[#14110b] font-extrabold rounded-xl text-xs shadow-md shadow-amber-300/20">
          Browse Marketplace
        </Link>
      </div>
    );
  }

  return (
    <div className="store-vip min-h-screen bg-[#07080b] text-white font-sans selection:bg-amber-300 selection:text-black pb-24">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-24 left-1/2 h-72 w-[42rem] -translate-x-1/2 rounded-full bg-amber-300/8 blur-3xl" />
        <div className="absolute top-80 -left-20 h-64 w-64 rounded-full bg-emerald-500/10 blur-3xl" />
        <div className="absolute bottom-0 right-0 h-80 w-80 rounded-full bg-amber-600/8 blur-3xl" />
      </div>

      <header className="sticky top-0 z-40 border-b border-white/10 bg-[#07080b]/80 px-6 py-4 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-full bg-gradient-to-br from-amber-200 via-amber-400 to-emerald-500 text-[#14110b] flex items-center justify-center font-black text-lg shadow-[0_0_24px_rgba(232,195,106,0.35)] ring-1 ring-white/20">
              {shop.name.charAt(0)}
            </div>
            <div>
              <h1 className="text-base font-black text-white flex items-center gap-1.5">
                {shop.name}
                <CheckCircle2 size={15} className="text-amber-300 shrink-0" />
              </h1>
              <p className="text-[11px] text-white/50 font-medium tracking-wide">{shop.store_tagline || shop.address || "Official Online House"}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {canInstallPwa && (
              <button
                onClick={handleInstallPwa}
                className="hidden sm:inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-white/5 hover:bg-white/10 text-amber-100 border border-white/15 rounded-full text-xs font-bold transition-all"
              >
                <Download size={14} /> Install App
              </button>
            )}

            {customer ? (
              <button
                onClick={() => {
                  fetchCustomerOrders(customer.phone);
                  setIsMyOrdersOpen(true);
                }}
                className="flex items-center gap-1.5 px-3 py-2 bg-white/5 hover:bg-white/10 border border-white/15 rounded-full text-xs font-bold text-white/80 transition-colors"
              >
                <ListOrdered size={16} className="text-amber-300" />
                <span className="hidden sm:inline">My Orders</span>
              </button>
            ) : (
              <button
                onClick={() => setIsAuthOpen(true)}
                className="flex items-center gap-1.5 px-3 py-2 bg-amber-300/10 hover:bg-amber-300/20 border border-amber-300/30 rounded-full text-xs font-bold text-amber-100 transition-colors"
              >
                <User size={16} /> Login / Register
              </button>
            )}

            <button
              onClick={() => setIsCartOpen(true)}
              className="relative p-2.5 bg-white/5 hover:bg-white/10 border border-white/15 rounded-full text-amber-200 transition-colors"
            >
              <ShoppingBag size={20} />
              {cart.length > 0 && (
                <span className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-amber-300 text-[#14110b] font-black text-[10px] rounded-full flex items-center justify-center">
                  {cart.reduce((a, b) => a + b.quantity, 0)}
                </span>
              )}
            </button>
          </div>
        </div>
      </header>

      <div className="relative border-b border-white/10 px-6 py-10">
        <div className="max-w-6xl mx-auto space-y-7">
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
            <div className="max-w-2xl">
              <span className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.28em] px-3 py-1 bg-amber-300/10 text-amber-200 border border-amber-300/25 rounded-full">
                <Sparkles size={11} /> Live POS catalog · {products.length} pieces
              </span>
              <h2 className="mt-4 text-3xl sm:text-5xl font-black tracking-tight text-white leading-[1.05]">
                The house of
                <span className="block bg-gradient-to-r from-amber-200 via-white to-emerald-300 bg-clip-text text-transparent">
                  {shop.name}
                </span>
              </h2>
              <p className="text-sm text-white/55 mt-3 max-w-lg font-medium leading-relaxed">
                Studio-grade catalog with live stock and prices — fast, modern, and ready to order.
              </p>
            </div>

            <div className="w-full lg:w-[22rem]">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-amber-200/70" size={16} />
                <input
                  suppressHydrationWarning
                  type="text"
                  placeholder="Search the collection..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-11 pr-4 py-3 bg-white/5 border border-white/15 rounded-full text-sm text-white placeholder-white/35 focus:outline-none focus:border-amber-300/60 focus:ring-2 focus:ring-amber-300/15 font-medium"
                />
              </div>
            </div>
          </div>

          {categories.length > 0 && (
            <div className="flex items-center gap-2 overflow-x-auto pb-1 custom-scrollbar">
              <button
                onClick={() => setSelectedCategory("all")}
                className={`px-4 py-1.5 rounded-full text-xs font-extrabold transition-all shrink-0 ${
                  selectedCategory === "all"
                    ? "bg-amber-300 text-[#14110b] shadow-[0_0_18px_rgba(232,195,106,0.35)]"
                    : "bg-white/5 text-white/70 border border-white/10 hover:bg-white/10"
                }`}
              >
                All Products ({products.length})
              </button>
              {categories.map((cat) => {
                const count = products.filter((p) => p.category_id === cat.id).length;
                return (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedCategory(cat.id)}
                    className={`px-4 py-1.5 rounded-full text-xs font-extrabold transition-all shrink-0 ${
                      selectedCategory === cat.id
                        ? "bg-amber-300 text-[#14110b] shadow-[0_0_18px_rgba(232,195,106,0.35)]"
                        : "bg-white/5 text-white/70 border border-white/10 hover:bg-white/10"
                    }`}
                  >
                    {cat.name} ({count})
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <main className="relative max-w-6xl mx-auto px-6 py-8">
        {filteredProducts.length === 0 ? (
          <div className="text-center py-16 bg-white/5 rounded-3xl border border-white/10 max-w-md mx-auto">
            <Store size={40} className="mx-auto text-amber-200/50 mb-2" />
            <h3 className="text-sm font-bold text-white">No Products Found</h3>
            <p className="text-xs text-white/50 mt-1">Try selecting a different category or clearing search filter.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {filteredProducts.map((product) => {
              const price = getProductPrice(product);
              const inCart = cart.find((i) => i.product.id === product.id);
              const categoryName = categories.find((c) => c.id === product.category_id)?.name;

              return (
                <div
                  key={product.id}
                  className="group relative flex flex-col overflow-hidden rounded-3xl border border-white/10 bg-[#101218] shadow-[0_18px_40px_rgba(0,0,0,0.35)] transition-all duration-300 hover:-translate-y-1 hover:border-amber-300/40 hover:shadow-[0_22px_50px_rgba(232,195,106,0.12)]"
                >
                  <StoreProductVisual
                    name={product.name}
                    categoryName={categoryName}
                    unit={product.unit}
                    imageUrl={product.image_url}
                  />

                  <div className="flex flex-1 flex-col justify-between p-3.5">
                    <div>
                      {categoryName && (
                        <p className="mb-1 text-[9px] font-black uppercase tracking-[0.16em] text-white/35">
                          {categoryName}
                        </p>
                      )}
                      <h4 className="text-[13px] font-black leading-snug text-white line-clamp-2 group-hover:text-amber-100 transition-colors">
                        {product.name}
                      </h4>
                      <p className="mt-1.5 text-sm font-black tracking-wide text-amber-300">
                        Rs {price.toLocaleString()}
                      </p>
                    </div>

                    <div className="mt-3">
                      {inCart ? (
                        <div className="flex items-center justify-between bg-amber-300/10 border border-amber-300/25 rounded-full p-1">
                          <button
                            onClick={() => updateQuantity(product.id, -1)}
                            className="w-7 h-7 rounded-full bg-amber-300 text-[#14110b] font-black flex items-center justify-center hover:bg-amber-200"
                          >
                            <Minus size={12} />
                          </button>
                          <span className="text-xs font-black text-amber-100">{inCart.quantity}</span>
                          <button
                            onClick={() => updateQuantity(product.id, 1)}
                            className="w-7 h-7 rounded-full bg-amber-300 text-[#14110b] font-black flex items-center justify-center hover:bg-amber-200"
                          >
                            <Plus size={12} />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => handleAddToCart(product)}
                          className="w-full py-2 bg-white/8 hover:bg-amber-300 hover:text-[#14110b] text-white text-xs font-extrabold rounded-full transition-all flex items-center justify-center gap-1.5 border border-white/10 hover:border-amber-300"
                        >
                          <Plus size={14} /> Add to Cart
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Cart Drawer */}
      {isCartOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-[#101218] border-l border-white/10 h-full flex flex-col justify-between p-6 shadow-2xl">
            <div>
              <div className="flex items-center justify-between border-b border-white/10 pb-4">
                <h3 className="text-base font-black text-white flex items-center gap-2">
                  <ShoppingBag className="text-amber-300" size={18} /> Your Shopping Cart
                </h3>
                <button onClick={() => setIsCartOpen(false)} className="text-white/40 hover:text-white p-1">
                  <X size={18} />
                </button>
              </div>

              <div className="divide-y divide-white/8 max-h-[55vh] overflow-y-auto custom-scrollbar my-4 pr-1">
                {cart.length === 0 ? (
                  <div className="text-center py-12 text-white/40 text-xs font-medium">Your cart is empty</div>
                ) : (
                  cart.map((item) => (
                    <div key={item.product.id} className="py-3 flex items-center justify-between gap-3">
                      <div>
                        <h5 className="text-xs font-bold text-white line-clamp-1">{item.product.name}</h5>
                        <p className="text-[11px] text-amber-300 font-extrabold">Rs {item.unitPrice.toLocaleString()}</p>
                      </div>

                      <div className="flex items-center gap-2">
                        <button onClick={() => updateQuantity(item.product.id, -1)} className="p-1 bg-white/8 text-white/70 rounded-md hover:bg-white/15">
                          <Minus size={12} />
                        </button>
                        <span className="text-xs font-bold text-white w-4 text-center">{item.quantity}</span>
                        <button onClick={() => updateQuantity(item.product.id, 1)} className="p-1 bg-white/8 text-white/70 rounded-md hover:bg-white/15">
                          <Plus size={12} />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="border-t border-white/10 pt-4 space-y-3">
              <div className="space-y-1.5 text-xs text-white/55">
                <div className="flex justify-between">
                  <span>Subtotal:</span>
                  <span className="font-bold text-white">Rs {subtotal.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span>Delivery Fee:</span>
                  <span className="font-bold text-amber-300">{deliveryFee > 0 ? `Rs ${deliveryFee}` : "Free"}</span>
                </div>
                <div className="flex justify-between text-sm font-black text-white pt-2 border-t border-white/10">
                  <span>Grand Total:</span>
                  <span className="text-amber-300">Rs {grandTotal.toLocaleString()}</span>
                </div>
              </div>

              {customer ? (
                <div className="p-3 bg-white/5 rounded-xl border border-white/10 text-xs space-y-1">
                  <div className="flex justify-between items-center text-white font-bold">
                    <span className="flex items-center gap-1.5"><UserCheck size={14} className="text-amber-300" /> {customer.name} ({customer.phone})</span>
                    <button onClick={handleLogoutCustomer} className="text-[10px] text-rose-300 hover:underline flex items-center gap-1">
                      <LogOut size={10} /> Logout
                    </button>
                  </div>
                  <p className="text-[11px] text-white/45 line-clamp-1">{customer.address}</p>
                </div>
              ) : (
                <button
                  onClick={() => setIsAuthOpen(true)}
                  className="w-full py-2.5 bg-white/8 hover:bg-white/12 text-white text-xs font-bold rounded-xl border border-white/10"
                >
                  Sign Up / Login to Order
                </button>
              )}

              <div className="space-y-2 pt-1">
                <button
                  onClick={handleDirectOnlineCheckout}
                  disabled={cart.length === 0}
                  className="w-full py-3 bg-amber-300 hover:bg-amber-200 text-[#14110b] text-xs font-black rounded-xl shadow-lg shadow-amber-300/15 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
                >
                  <Send size={14} /> Place Direct Online Order (آن لائن آرڈرمحفوظ کریں)
                </button>

                <button
                  onClick={handleWhatsAppCheckout}
                  disabled={cart.length === 0}
                  className="w-full py-2.5 bg-white/5 hover:bg-white/10 text-emerald-300 text-xs font-black rounded-xl border border-white/10 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
                >
                  <Phone size={14} /> Order via WhatsApp Only (صرف واٹس ایپ پرآرڈر)
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Customer My Orders Drawer */}
      {isMyOrdersOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-[#101218] border-l border-white/10 h-full flex flex-col justify-between p-6 shadow-2xl">
            <div>
              <div className="flex items-center justify-between border-b border-white/10 pb-4">
                <h3 className="text-base font-black text-white flex items-center gap-2">
                  <ListOrdered className="text-amber-300" size={18} /> My Online Orders
                </h3>
                <button onClick={() => setIsMyOrdersOpen(false)} className="text-white/40 hover:text-white p-1">
                  <X size={18} />
                </button>
              </div>

              <div className="max-h-[75vh] overflow-y-auto custom-scrollbar my-4 pr-1 space-y-3">
                {loadingOrders ? (
                  <div className="text-center py-12 text-white/40 text-xs">Loading your orders...</div>
                ) : myOrders.length === 0 ? (
                  <div className="text-center py-12 text-white/40 text-xs">No orders placed yet.</div>
                ) : (
                  myOrders.map((ord) => {
                    const badge = STATUS_BADGES[ord.status] || STATUS_BADGES.pending;
                    const StatusIcon = badge.icon;

                    return (
                      <div key={ord.id} className="p-3 bg-white/5 border border-white/10 rounded-2xl space-y-2">
                        <div className="flex justify-between items-center">
                          <span className={`inline-flex items-center gap-1 text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${badge.bg} ${badge.text}`}>
                            <StatusIcon size={10} /> {badge.label}
                          </span>
                          <span className="text-[10px] font-mono text-white/35">
                            {new Date(ord.created_at).toLocaleDateString()}
                          </span>
                        </div>

                        <div className="text-xs font-bold text-white flex justify-between">
                          <span>Order Total:</span>
                          <span className="text-amber-300">Rs {ord.total_amount.toLocaleString()}</span>
                        </div>

                        <div className="text-[11px] text-white/50 space-y-0.5 pt-1 border-t border-white/10">
                          {Array.isArray(ord.items) && ord.items.map((i: any, idx: number) => (
                            <div key={idx} className="flex justify-between">
                              <span>• {i.name} (x{i.quantity})</span>
                              <span>Rs {(i.subtotal || i.unit_price * i.quantity).toLocaleString()}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Customer Auth / Address Modal */}
      {isAuthOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm bg-[#101218] border border-white/10 rounded-3xl p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h4 className="text-sm font-black text-white">
                {authMode === "signup" ? "Customer Registration / Account" : "Customer Login"}
              </h4>
              <button onClick={() => setIsAuthOpen(false)} className="text-white/40 hover:text-white">
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveCustomer} className="space-y-3">
              <div>
                <label className="block text-[10px] font-bold text-white/45 uppercase mb-1">Full Name</label>
                <input
                  suppressHydrationWarning
                  type="text"
                  required
                  placeholder="e.g. Muhammad Usman"
                  value={authForm.name}
                  onChange={(e) => setAuthForm({ ...authForm, name: e.target.value })}
                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-xs text-white focus:border-amber-300 outline-none font-medium"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-white/45 uppercase mb-1">Phone Number (WhatsApp)</label>
                <input
                  suppressHydrationWarning
                  type="text"
                  required
                  placeholder="e.g. 03245836626"
                  value={authForm.phone}
                  onChange={(e) => setAuthForm({ ...authForm, phone: e.target.value })}
                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-xs text-white focus:border-amber-300 outline-none font-medium"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-white/45 uppercase mb-1">Full Delivery Address</label>
                <textarea
                  suppressHydrationWarning
                  required
                  rows={2}
                  placeholder="House #, Street #, Area, City"
                  value={authForm.address}
                  onChange={(e) => setAuthForm({ ...authForm, address: e.target.value })}
                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-xs text-white focus:border-amber-300 outline-none font-medium"
                />
              </div>

              <button
                type="submit"
                className="w-full py-2.5 bg-amber-300 hover:bg-amber-200 text-[#14110b] text-xs font-black rounded-xl shadow-md transition-all mt-2"
              >
                Save Account & Continue
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
