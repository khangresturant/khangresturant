"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Leaf, Search, PlusCircle, Trash2, Edit, 
  Loader2, X, Beaker
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { useShop } from "@/context/ShopContext";
import { createClient } from "@/lib/supabase/client";

type Product = {
  id: string;
  name: string;
};

type FertBatch = {
  id: string;
  product_id: string;
  batch_number: string;
  expiry_date: string;
  stock_quantity: number;
  purchase_price: number;
  products?: Product;
};

export default function FertilizerBatchesPage() {
  const { shopId } = useShop();
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [batches, setBatches] = useState<FertBatch[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Form State
  const [editingBatch, setEditingBatch] = useState<FertBatch | null>(null);
  const [formData, setFormData] = useState({
    product_id: "",
    batch_number: "",
    expiry_date: "",
    stock_quantity: 100,
    purchase_price: 0
  });

  useEffect(() => {
    if (shopId) {
      fetchData();
    }
  }, [shopId]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // 1. Fetch products to associate with batches
      const { data: prodData, error: prodErr } = await supabase
        .from("products")
        .select("id, name")
        .eq("shop_id", shopId)
        .order("name");
      if (prodErr) throw prodErr;
      setProducts(prodData || []);

      // 2. Fetch batches
      const { data: batchData, error: batchErr } = await supabase
        .from("product_batches")
        .select(`
          id,
          product_id,
          batch_number,
          expiry_date,
          stock_quantity,
          purchase_price,
          products (id, name)
        `)
        .eq("shop_id", shopId)
        .order("created_at", { ascending: false });
      if (batchErr) throw batchErr;
      
      const formattedBatches = (batchData || []).map((b: any) => ({
        id: b.id,
        product_id: b.product_id,
        batch_number: b.batch_number,
        expiry_date: b.expiry_date || "",
        stock_quantity: Number(b.stock_quantity) || 0,
        purchase_price: Number(b.purchase_price) || 0,
        products: b.products || { id: "", name: "Unknown Product" }
      }));

      setBatches(formattedBatches);
    } catch (err: any) {
      toast.error("Failed to load batches: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenAddModal = () => {
    setEditingBatch(null);
    const exp = new Date();
    exp.setFullYear(exp.getFullYear() + 2);
    
    setFormData({
      product_id: products[0]?.id || "",
      batch_number: "",
      expiry_date: exp.toISOString().split("T")[0],
      stock_quantity: 150,
      purchase_price: 0
    });
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (b: FertBatch) => {
    setEditingBatch(b);
    setFormData({
      product_id: b.product_id,
      batch_number: b.batch_number,
      expiry_date: b.expiry_date,
      stock_quantity: b.stock_quantity,
      purchase_price: b.purchase_price
    });
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    if (!formData.product_id || !formData.batch_number) {
      toast.error("Please select a product and enter a batch number.");
      return;
    }

    try {
      if (editingBatch) {
        const { error } = await supabase
          .from("product_batches")
          .update({
            product_id: formData.product_id,
            batch_number: formData.batch_number,
            expiry_date: formData.expiry_date || null,
            stock_quantity: formData.stock_quantity,
            purchase_price: formData.purchase_price
          })
          .eq("id", editingBatch.id);

        if (error) throw error;
        toast.success("Batch credentials updated!");
      } else {
        const { error } = await supabase
          .from("product_batches")
          .insert({
            shop_id: shopId,
            product_id: formData.product_id,
            batch_number: formData.batch_number,
            expiry_date: formData.expiry_date || null,
            stock_quantity: formData.stock_quantity,
            purchase_price: formData.purchase_price
          });

        if (error) throw error;
        toast.success("New product batch cataloged!");
      }
      setIsModalOpen(false);
      fetchData();
    } catch (err: any) {
      toast.error("Failed to save batch: " + err.message);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this batch from inventory logs?")) return;
    try {
      const { error } = await supabase
        .from("product_batches")
        .delete()
        .eq("id", id);
      if (error) throw error;
      toast.success("Batch profile deleted.");
      fetchData();
    } catch (err: any) {
      toast.error("Failed to delete batch: " + err.message);
    }
  };

  const filtered = batches.filter(b => 
    (b.products?.name || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
    b.batch_number.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-500 font-sans">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-black tracking-tight text-slate-900">Seeds & Fertilizer Batches</h2>
          <p className="text-slate-500 mt-1">Audit chemical properties, trace manufacturer serial keys, and log stock sacks.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input 
              placeholder="Search batches..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 w-[250px] bg-white border-slate-200 text-slate-900"
            />
          </div>
          <Button onClick={handleOpenAddModal} className="bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-200">
            <PlusCircle className="mr-2 h-4 w-4" /> Add Batch
          </Button>
        </div>
      </div>

      {/* Batches Grid */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <Loader2 className="h-10 w-10 text-emerald-500 animate-spin" />
          <p className="text-sm font-semibold text-slate-500">Loading batch details...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 bg-slate-50 border border-dashed rounded-2xl">
          <p className="text-sm font-semibold text-slate-400">No batches cataloged yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {filtered.map(item => (
            <motion.div 
              whileHover={{ y: -3 }}
              key={item.id} 
              className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden flex flex-col justify-between"
            >
              <div className="absolute top-0 left-0 w-1.5 h-full bg-emerald-500"></div>

              <div>
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h3 className="font-bold text-slate-800 text-base flex items-center gap-1.5">
                      <Leaf size={18} className="text-emerald-500" /> {item.products?.name}
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">Batch: {item.batch_number}</p>
                  </div>
                  <span className="bg-emerald-50 text-emerald-800 text-[10px] px-2 py-0.5 rounded font-black uppercase">
                    Verified
                  </span>
                </div>

                <p className="text-xs text-slate-500 flex items-center gap-1 mb-4">
                  <Beaker size={12} className="text-blue-500" /> Purchase Price: <strong>Rs. {item.purchase_price}</strong>
                </p>

                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 flex items-center justify-between mb-4 text-xs font-mono">
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-sans font-semibold block">Total Stock</span>
                    <p className="text-base font-black text-slate-800">{item.stock_quantity} Bags</p>
                  </div>
                  <div className="text-right">
                    <span className="text-[9px] text-slate-400 font-sans font-semibold block">Expiry Date</span>
                    <span className="font-bold text-slate-700">
                      {item.expiry_date ? new Date(item.expiry_date).toLocaleDateString() : "No Expiry"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => handleOpenEditModal(item)}
                  className="text-slate-500 hover:text-blue-600 hover:bg-slate-100 text-xs font-bold"
                >
                  <Edit size={14} className="mr-1" /> Edit specs
                </Button>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => handleDelete(item.id)}
                  className="text-slate-500 hover:text-red-600 hover:bg-slate-100 text-xs font-bold"
                >
                  <Trash2 size={14} className="mr-1" /> Delete
                </Button>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
              onClick={() => setIsModalOpen(false)}
            />
            
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm relative z-10 font-sans text-slate-800"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-slate-800 text-lg">
                  {editingBatch ? "Edit Batch Specs" : "Add Fertilizer/Seed Batch"}
                </h3>
                <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                  <X size={18} />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Select Product</label>
                  <SearchableSelect
                    options={products.map(p => ({ value: p.id, label: p.name }))}
                    value={formData.product_id}
                    onChange={(val) => setFormData({...formData, product_id: val})}
                    placeholder="Search & choose product..."
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Batch Code / Serial</label>
                  <Input 
                    placeholder="e.g. UR-100-26" 
                    value={formData.batch_number}
                    onChange={(e) => setFormData({...formData, batch_number: e.target.value})}
                    className="text-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Expiry Date</label>
                  <Input 
                    type="date" 
                    value={formData.expiry_date}
                    onChange={(e) => setFormData({...formData, expiry_date: e.target.value})}
                    className="text-slate-900"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Purchase Price</label>
                    <Input 
                      type="number"
                      value={formData.purchase_price || ""}
                      onChange={(e) => setFormData({...formData, purchase_price: Number(e.target.value) || 0})}
                      className="text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Opening Stock</label>
                    <Input 
                      type="number"
                      value={formData.stock_quantity || ""}
                      onChange={(e) => setFormData({...formData, stock_quantity: Number(e.target.value) || 0})}
                      className="text-slate-900"
                    />
                  </div>
                </div>

                <Button onClick={handleSave} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold h-11">
                  Save Batch Specifications
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
