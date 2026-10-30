"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Search, ChevronDown, ChevronUp, Package, Barcode, Trash2, Edit, Save, X, Loader2 } from "lucide-react";
import { useShop } from "@/context/ShopContext";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// Types based on database schema
type Product = {
  id: string;
  name: string;
  category_id?: string;
  variants: Variant[];
};

type Variant = {
  id: string;
  packing_name: string;
  purchase_price: number;
  sale_price: number;
  stock_quantity: number;
  barcodes: { barcode: string }[];
};

export default function KaryanaVariationsPage() {
  const { shopId } = useShop();
  const supabase = createClient();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // New Product Form State
  const [newProduct, setNewProduct] = useState({
    name: "",
    variants: [
      {
        packing_name: "",
        purchase_price: 0,
        sale_price: 0,
        stock_quantity: 0,
        barcodes: [""],
      },
    ],
  });

  useEffect(() => {
    if (shopId) fetchProducts();
  }, [shopId]);

  const fetchProducts = async () => {
    setLoading(true);
    try {
      // Fetch Products with Variants and Barcodes
      // Since PostgREST supports nested relationships
      const { data, error } = await supabase
        .from('products')
        .select(`
          id, name, category_id,
          product_variants (
            id, packing_name, purchase_price, sale_price, stock_quantity,
            product_barcodes ( barcode )
          )
        `)
        .eq('shop_id', shopId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Transform data to match our types
      const formattedData: Product[] = data.map((p: any) => ({
        id: p.id,
        name: p.name,
        category_id: p.category_id,
        variants: p.product_variants.map((v: any) => ({
          id: v.id,
          packing_name: v.packing_name,
          purchase_price: v.purchase_price,
          sale_price: v.sale_price,
          stock_quantity: v.stock_quantity,
          barcodes: v.product_barcodes || []
        }))
      }));

      setProducts(formattedData);
    } catch (error: any) {
      toast.error("Failed to load products: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const toggleRow = (id: string) => {
    setExpandedRows(prev => ({ ...prev, [id]: !prev[id] }));
  };

  // ---- Form Handlers ----
  const addVariant = () => {
    setNewProduct(prev => ({
      ...prev,
      variants: [...prev.variants, { packing_name: "", purchase_price: 0, sale_price: 0, stock_quantity: 0, barcodes: [""] }]
    }));
  };

  const removeVariant = (index: number) => {
    setNewProduct(prev => ({
      ...prev,
      variants: prev.variants.filter((_, i) => i !== index)
    }));
  };

  const updateVariant = (index: number, field: keyof Variant, value: any) => {
    setNewProduct(prev => {
      const updated = [...prev.variants];
      updated[index] = { ...updated[index], [field]: value };
      return { ...prev, variants: updated };
    });
  };

  const addBarcode = (variantIndex: number) => {
    setNewProduct(prev => {
      const updated = [...prev.variants];
      updated[variantIndex].barcodes.push("");
      return { ...prev, variants: updated };
    });
  };

  const updateBarcode = (variantIndex: number, barcodeIndex: number, value: string) => {
    setNewProduct(prev => {
      const updated = [...prev.variants];
      updated[variantIndex].barcodes[barcodeIndex] = value;
      return { ...prev, variants: updated };
    });
  };

  const removeBarcode = (variantIndex: number, barcodeIndex: number) => {
    setNewProduct(prev => {
      const updated = [...prev.variants];
      updated[variantIndex].barcodes = updated[variantIndex].barcodes.filter((_, i) => i !== barcodeIndex);
      return { ...prev, variants: updated };
    });
  };

  const handleSaveProduct = async () => {
    if (!newProduct.name || newProduct.variants.length === 0) {
      toast.error("Please enter product name and at least one packing variation.");
      return;
    }

    setIsSubmitting(true);
    try {
      // 1. Insert Product
      const { data: productData, error: productError } = await supabase
        .from('products')
        .insert({ name: newProduct.name, shop_id: shopId })
        .select()
        .single();

      if (productError) throw productError;

      // 2. Insert Variants
      for (const variant of newProduct.variants) {
        if (!variant.packing_name) continue;

        const { data: variantData, error: variantError } = await supabase
          .from('product_variants')
          .insert({
            product_id: productData.id,
            packing_name: variant.packing_name,
            purchase_price: variant.purchase_price,
            sale_price: variant.sale_price,
            stock_quantity: variant.stock_quantity
          })
          .select()
          .single();

        if (variantError) throw variantError;

        // 3. Insert Barcodes
        const validBarcodes = variant.barcodes.filter(b => b.trim() !== "");
        if (validBarcodes.length > 0) {
          const barcodesToInsert = validBarcodes.map(b => ({
            product_id: productData.id,
            variant_id: variantData.id,
            barcode: b
          }));

          const { error: barcodeError } = await supabase
            .from('product_barcodes')
            .insert(barcodesToInsert);

          if (barcodeError) throw barcodeError;
        }
      }

      toast.success("Product and Variations saved successfully!");
      setIsModalOpen(false);
      setNewProduct({ name: "", variants: [{ packing_name: "", purchase_price: 0, sale_price: 0, stock_quantity: 0, barcodes: [""] }] });
      fetchProducts(); // Reload data

    } catch (error: any) {
      toast.error("Error saving product: " + error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredProducts = products.filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase()));

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      
      {/* Header Area */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-black tracking-tight text-slate-900">Packing Variations</h2>
          
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input 
              placeholder="Search products..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 w-[250px] bg-white border-slate-200"
            />
          </div>
          <Button onClick={() => setIsModalOpen(true)} className="bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-200">
            <Plus className="mr-2 h-4 w-4" /> Add Product
          </Button>
        </div>
      </div>

      {/* Main Data Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200 uppercase tracking-wider text-[11px]">
              <tr>
                <th className="px-6 py-4 w-10"></th>
                <th className="px-6 py-4">Product Name</th>
                <th className="px-6 py-4 text-center">Total Variations</th>
                <th className="px-6 py-4 text-center">Total Stock</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-10 text-center text-slate-400">Loading products...</td>
                </tr>
              ) : filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-10 text-center text-slate-400 flex flex-col items-center">
                    <Package className="h-10 w-10 text-slate-300 mb-2" />
                    <p>No products found. Add your first product!</p>
                  </td>
                </tr>
              ) : (
                filteredProducts.map((product) => (
                  <React.Fragment key={product.id}>
                    {/* Parent Row */}
                    <tr className={`hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors transition-colors ${expandedRows[product.id] ? 'bg-blue-50/30' : ''}`}>
                      <td className="px-6 py-4">
                        <button onClick={() => toggleRow(product.id)} className="p-1 rounded-full hover:bg-slate-200 transition-colors text-slate-500">
                          {expandedRows[product.id] ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                        </button>
                      </td>
                      <td className="px-6 py-4 font-semibold text-slate-800 text-base">{product.name}</td>
                      <td className="px-6 py-4 text-center">
                        <span className="bg-blue-100 text-blue-700 px-2.5 py-1 rounded-full font-medium text-xs">
                          {product.variants.length} Packings
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center font-medium">
                        {product.variants.reduce((acc, v) => acc + v.stock_quantity, 0)} Units
                      </td>
                      <td className="px-6 py-4 text-right">
                        <Button variant="ghost" size="sm" className="text-blue-600 hover:text-blue-700 hover:bg-blue-50">
                          <Edit className="h-4 w-4 mr-2" /> Edit
                        </Button>
                      </td>
                    </tr>
                    
                    {/* Child Rows (Variations) */}
                    <AnimatePresence>
                      {expandedRows[product.id] && (
                        <motion.tr
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          className="bg-slate-50/80 border-b border-slate-100"
                        >
                          <td colSpan={5} className="px-12 py-6">
                            <div className="grid gap-4 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
                              {product.variants.map((variant) => (
                                <div key={variant.id} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm relative overflow-hidden group">
                                  <div className="absolute top-0 left-0 w-1 h-full bg-blue-500"></div>
                                  <div className="flex justify-between items-start mb-3">
                                    <div>
                                      <h4 className="font-bold text-slate-800">{variant.packing_name}</h4>
                                      <p className="text-xs text-slate-500 mt-0.5">Stock: {variant.stock_quantity} units</p>
                                    </div>
                                    <div className="text-right">
                                      <p className="font-semibold text-emerald-600">Rs {variant.sale_price}</p>
                                      <p className="text-xs text-slate-400 line-through">Rs {variant.purchase_price}</p>
                                    </div>
                                  </div>
                                  
                                  <div className="border-t border-slate-100 pt-3">
                                    <p className="text-[10px] uppercase font-semibold text-slate-400 mb-2 flex items-center">
                                      <Barcode className="h-3 w-3 mr-1" /> Linked Barcodes
                                    </p>
                                    <div className="flex flex-wrap gap-2">
                                      {variant.barcodes.map((b, idx) => (
                                        <span key={idx} className="bg-slate-100 text-slate-600 px-2 py-1 rounded-md text-xs font-mono border border-slate-200">
                                          {b.barcode}
                                        </span>
                                      ))}
                                      {variant.barcodes.length === 0 && <span className="text-xs text-slate-400 italic">No barcodes</span>}
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </td>
                        </motion.tr>
                      )}
                    </AnimatePresence>
                  </React.Fragment>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ADD PRODUCT MODAL (VIP BUILDER) */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
              onClick={() => setIsModalOpen(false)}
            />
            
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white w-full max-w-4xl max-h-[90vh] overflow-hidden rounded-3xl shadow-2xl relative z-10 flex flex-col"
            >
              {/* Modal Header */}
              <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50 shrink-0">
                <div>
                  <h3 className="text-xl font-bold text-slate-900">Add New Product</h3>
                  <p className="text-sm text-slate-500">Create product and multiple packings simultaneously.</p>
                </div>
                <button onClick={() => setIsModalOpen(false)} className="p-2 bg-white rounded-full hover:bg-slate-100 text-slate-500 shadow-sm border border-slate-200">
                  <X size={20} />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-6 overflow-y-auto flex-1 custom-scrollbar bg-slate-50/30">
                
                {/* Base Product */}
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm mb-6">
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Base Product Name</label>
                  <Input 
                    placeholder="e.g. Sunsilk Shampoo" 
                    value={newProduct.name}
                    onChange={(e) => setNewProduct({...newProduct, name: e.target.value})}
                    className="h-12 text-lg border-slate-200 focus-visible:ring-blue-600 bg-slate-50 font-medium"
                  />
                </div>

                {/* Variations Builder */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-slate-800 text-lg flex items-center">
                      <Package className="mr-2 h-5 w-5 text-blue-600" /> Packing Variations
                    </h4>
                    <Button onClick={addVariant} variant="outline" size="sm" className="text-blue-600 border-blue-200 hover:bg-blue-50">
                      <Plus className="h-4 w-4 mr-1" /> Add Packing
                    </Button>
                  </div>

                  {newProduct.variants.map((variant, vIdx) => (
                    <motion.div 
                      key={vIdx} 
                      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                      className="bg-white border border-blue-100 rounded-2xl p-5 shadow-sm relative group"
                    >
                      {newProduct.variants.length > 1 && (
                        <button onClick={() => removeVariant(vIdx)} className="absolute top-4 right-4 text-red-400 hover:text-red-600 p-1 bg-red-50 rounded-md opacity-0 group-hover:opacity-100 transition-opacity">
                          <Trash2 size={16} />
                        </button>
                      )}
                      
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                        <div className="md:col-span-2">
                          <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase">Packing Name</label>
                          <Input placeholder="e.g. 100ml Bottle" value={variant.packing_name} onChange={(e) => updateVariant(vIdx, 'packing_name', e.target.value)} className="bg-slate-50 border-slate-200 h-10" />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase">Purchase (Rs)</label>
                          <Input type="number" placeholder="0" value={variant.purchase_price || ""} onChange={(e) => updateVariant(vIdx, 'purchase_price', parseFloat(e.target.value) || 0)} className="bg-slate-50 border-slate-200 h-10" />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase">Sale (Rs)</label>
                          <Input type="number" placeholder="0" value={variant.sale_price || ""} onChange={(e) => updateVariant(vIdx, 'sale_price', parseFloat(e.target.value) || 0)} className="bg-slate-50 border-slate-200 h-10" />
                        </div>
                      </div>

                      {/* Barcodes Sub-array */}
                      <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 mt-4">
                        <div className="flex items-center justify-between mb-3">
                          <label className="text-xs font-bold text-slate-600 uppercase flex items-center">
                            <Barcode className="h-3.5 w-3.5 mr-1" /> Associated Barcodes
                          </label>
                          <button onClick={() => addBarcode(vIdx)} className="text-xs font-semibold text-blue-600 hover:text-blue-800">
                            + Add Barcode
                          </button>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                          {variant.barcodes.map((barcode, bIdx) => (
                            <div key={bIdx} className="relative flex items-center">
                              <Input 
                                placeholder="Scan or type barcode..." 
                                value={barcode} 
                                onChange={(e) => updateBarcode(vIdx, bIdx, e.target.value)}
                                className="pr-8 bg-white border-slate-200 h-9 text-sm font-mono shadow-sm"
                              />
                              {variant.barcodes.length > 1 && (
                                <button onClick={() => removeBarcode(vIdx, bIdx)} className="absolute right-2 text-slate-300 hover:text-red-500">
                                  <X size={14} />
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>

                    </motion.div>
                  ))}
                </div>

              </div>

              {/* Modal Footer */}
              <div className="px-6 py-4 border-t border-slate-100 bg-white flex justify-end gap-3 shrink-0">
                <Button variant="ghost" onClick={() => setIsModalOpen(false)} className="text-slate-500">Cancel</Button>
                <Button onClick={handleSaveProduct} disabled={isSubmitting} className="bg-blue-600 hover:bg-blue-700 text-white px-8">
                  {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                  Save Complete Product
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
