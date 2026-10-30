"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Plus, Search, ChevronDown, ChevronUp, Package, Barcode, 
  Trash2, Edit, Save, X, Loader2, Layers, AlertCircle, 
  CheckCircle2, RefreshCw, Sparkles, Tag, DollarSign, Boxes
} from "lucide-react";
import { useShop } from "@/context/ShopContext";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// Types based on database schema
type Variant = {
  id?: string;
  packing_name: string;
  purchase_price: number;
  sale_price: number;
  stock_quantity: number;
  barcodes: { barcode: string }[];
};

type Product = {
  id: string;
  name: string;
  category_id?: string;
  categories?: { name: string } | null;
  variants: Variant[];
};

interface FormVariant {
  id?: string;
  packing_name: string;
  purchase_price: number;
  sale_price: number;
  stock_quantity: number;
  barcodes: string[];
}

export default function GeneralVariationsPage() {
  const { shopId } = useShop();
  const supabase = createClient();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});

  // Add Product Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isSubmittingAdd, setIsSubmittingAdd] = useState(false);
  const [newProduct, setNewProduct] = useState<{
    name: string;
    category_id: string;
    variants: FormVariant[];
  }>({
    name: "",
    category_id: "",
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

  // Edit Product & Variations Modal State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isSubmittingEdit, setIsSubmittingEdit] = useState(false);
  const [initialVariantIds, setInitialVariantIds] = useState<string[]>([]);
  const [editingProduct, setEditingProduct] = useState<{
    id: string;
    name: string;
    category_id: string;
    variants: FormVariant[];
  } | null>(null);

  // Deleting product state
  const [deletingProductId, setDeletingProductId] = useState<string | null>(null);

  useEffect(() => {
    if (shopId) {
      fetchProducts();
      fetchCategories();
    }
  }, [shopId]);

  const fetchCategories = async () => {
    if (!shopId) return;
    try {
      const { data } = await supabase
        .from("categories")
        .select("id, name")
        .eq("shop_id", shopId);
      setCategories(data || []);
    } catch (e) {
      console.error("Failed to load categories:", e);
    }
  };

  const fetchProducts = async () => {
    if (!shopId) return;
    setLoading(true);
    try {
      // Fetch Products with Variants and Barcodes
      const { data, error } = await supabase
        .from("products")
        .select(`
          id, name, category_id,
          categories ( name ),
          product_variants (
            id, packing_name, purchase_price, sale_price, stock_quantity,
            product_barcodes ( barcode )
          )
        `)
        .eq("shop_id", shopId)
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Transform data to match our types
      const formattedData: Product[] = (data || []).map((p: any) => ({
        id: p.id,
        name: p.name,
        category_id: p.category_id,
        categories: p.categories,
        variants: (p.product_variants || []).map((v: any) => ({
          id: v.id,
          packing_name: v.packing_name || "Standard",
          purchase_price: Number(v.purchase_price || 0),
          sale_price: Number(v.sale_price || 0),
          stock_quantity: Number(v.stock_quantity || 0),
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

  // ─── ADD MODAL FORM HANDLERS ───
  const addVariantToAddForm = () => {
    setNewProduct(prev => ({
      ...prev,
      variants: [
        ...prev.variants,
        { packing_name: "", purchase_price: 0, sale_price: 0, stock_quantity: 0, barcodes: [""] }
      ]
    }));
  };

  const removeVariantFromAddForm = (index: number) => {
    setNewProduct(prev => ({
      ...prev,
      variants: prev.variants.filter((_, i) => i !== index)
    }));
  };

  const updateVariantInAddForm = (index: number, field: keyof FormVariant, value: any) => {
    setNewProduct(prev => {
      const updated = [...prev.variants];
      updated[index] = { ...updated[index], [field]: value };
      return { ...prev, variants: updated };
    });
  };

  const addBarcodeToAddVariant = (variantIndex: number) => {
    setNewProduct(prev => {
      const updated = [...prev.variants];
      updated[variantIndex].barcodes.push("");
      return { ...prev, variants: updated };
    });
  };

  const updateBarcodeInAddVariant = (variantIndex: number, barcodeIndex: number, value: string) => {
    setNewProduct(prev => {
      const updated = [...prev.variants];
      updated[variantIndex].barcodes[barcodeIndex] = value;
      return { ...prev, variants: updated };
    });
  };

  const removeBarcodeFromAddVariant = (variantIndex: number, barcodeIndex: number) => {
    setNewProduct(prev => {
      const updated = [...prev.variants];
      updated[variantIndex].barcodes = updated[variantIndex].barcodes.filter((_, i) => i !== barcodeIndex);
      return { ...prev, variants: updated };
    });
  };

  const handleSaveNewProduct = async () => {
    if (!newProduct.name.trim()) {
      toast.error("Please enter product name.");
      return;
    }
    const validVariants = newProduct.variants.filter(v => v.packing_name.trim() !== "");
    if (validVariants.length === 0) {
      toast.error("Please add at least one packing variation with a name.");
      return;
    }

    setIsSubmittingAdd(true);
    try {
      // 1. Insert Base Product
      const productPayload: any = { 
        name: newProduct.name.trim(), 
        shop_id: shopId 
      };
      if (newProduct.category_id) {
        productPayload.category_id = newProduct.category_id;
      }

      const { data: productData, error: productError } = await supabase
        .from("products")
        .insert(productPayload)
        .select()
        .single();

      if (productError) throw productError;

      // 2. Insert Variants
      for (const variant of validVariants) {
        const { data: variantData, error: variantError } = await supabase
          .from("product_variants")
          .insert({
            product_id: productData.id,
            packing_name: variant.packing_name.trim(),
            purchase_price: variant.purchase_price,
            sale_price: variant.sale_price,
            stock_quantity: variant.stock_quantity
          })
          .select()
          .single();

        if (variantError) throw variantError;

        // 3. Insert Barcodes
        const cleanBarcodes = variant.barcodes.filter(b => b.trim() !== "");
        if (cleanBarcodes.length > 0) {
          const barcodesToInsert = cleanBarcodes.map(b => ({
            product_id: productData.id,
            variant_id: variantData.id,
            barcode: b.trim()
          }));

          const { error: barcodeError } = await supabase
            .from("product_barcodes")
            .insert(barcodesToInsert);

          if (barcodeError) throw barcodeError;
        }
      }

      toast.success(`"${newProduct.name}" and ${validVariants.length} variations saved! 🎉`);
      setIsAddModalOpen(false);
      setNewProduct({
        name: "",
        category_id: "",
        variants: [{ packing_name: "", purchase_price: 0, sale_price: 0, stock_quantity: 0, barcodes: [""] }]
      });
      fetchProducts();
    } catch (error: any) {
      toast.error("Error saving product: " + error.message);
    } finally {
      setIsSubmittingAdd(false);
    }
  };

  // ─── EDIT MODAL HANDLERS ───
  const openEditModal = (product: Product) => {
    const mappedVariants: FormVariant[] = product.variants.map(v => ({
      id: v.id,
      packing_name: v.packing_name,
      purchase_price: v.purchase_price,
      sale_price: v.sale_price,
      stock_quantity: v.stock_quantity,
      barcodes: v.barcodes.length > 0 ? v.barcodes.map(b => b.barcode) : [""]
    }));

    if (mappedVariants.length === 0) {
      mappedVariants.push({
        packing_name: "Standard Pack",
        purchase_price: 0,
        sale_price: 0,
        stock_quantity: 0,
        barcodes: [""]
      });
    }

    setInitialVariantIds(product.variants.map(v => v.id).filter(Boolean) as string[]);
    setEditingProduct({
      id: product.id,
      name: product.name,
      category_id: product.category_id || "",
      variants: mappedVariants
    });
    setIsEditModalOpen(true);
  };

  const addVariantToEditForm = () => {
    if (!editingProduct) return;
    setEditingProduct({
      ...editingProduct,
      variants: [
        ...editingProduct.variants,
        { packing_name: "", purchase_price: 0, sale_price: 0, stock_quantity: 0, barcodes: [""] }
      ]
    });
  };

  const removeVariantFromEditForm = (index: number) => {
    if (!editingProduct) return;
    setEditingProduct({
      ...editingProduct,
      variants: editingProduct.variants.filter((_, i) => i !== index)
    });
  };

  const updateVariantInEditForm = (index: number, field: keyof FormVariant, value: any) => {
    if (!editingProduct) return;
    const updated = [...editingProduct.variants];
    updated[index] = { ...updated[index], [field]: value };
    setEditingProduct({
      ...editingProduct,
      variants: updated
    });
  };

  const addBarcodeToEditVariant = (variantIndex: number) => {
    if (!editingProduct) return;
    const updated = [...editingProduct.variants];
    updated[variantIndex].barcodes.push("");
    setEditingProduct({
      ...editingProduct,
      variants: updated
    });
  };

  const updateBarcodeInEditVariant = (variantIndex: number, barcodeIndex: number, value: string) => {
    if (!editingProduct) return;
    const updated = [...editingProduct.variants];
    updated[variantIndex].barcodes[barcodeIndex] = value;
    setEditingProduct({
      ...editingProduct,
      variants: updated
    });
  };

  const removeBarcodeFromEditVariant = (variantIndex: number, barcodeIndex: number) => {
    if (!editingProduct) return;
    const updated = [...editingProduct.variants];
    updated[variantIndex].barcodes = updated[variantIndex].barcodes.filter((_, i) => i !== barcodeIndex);
    setEditingProduct({
      ...editingProduct,
      variants: updated
    });
  };

  const handleSaveEditedProduct = async () => {
    if (!editingProduct) return;
    if (!editingProduct.name.trim()) {
      toast.error("Product name cannot be empty.");
      return;
    }
    const validVariants = editingProduct.variants.filter(v => v.packing_name.trim() !== "");
    if (validVariants.length === 0) {
      toast.error("Please include at least one packing variation with a name.");
      return;
    }

    setIsSubmittingEdit(true);
    try {
      const productId = editingProduct.id;

      // 1. Update Base Product
      const productUpdatePayload: any = {
        name: editingProduct.name.trim()
      };
      if (editingProduct.category_id) {
        productUpdatePayload.category_id = editingProduct.category_id;
      } else {
        productUpdatePayload.category_id = null;
      }

      const { error: prodErr } = await supabase
        .from("products")
        .update(productUpdatePayload)
        .eq("id", productId);

      if (prodErr) throw prodErr;

      // 2. Identify variants to delete
      const currentVariantIds = validVariants.map(v => v.id).filter(Boolean) as string[];
      const variantsToDelete = initialVariantIds.filter(id => !currentVariantIds.includes(id));

      if (variantsToDelete.length > 0) {
        // Delete barcodes first
        await supabase
          .from("product_barcodes")
          .delete()
          .in("variant_id", variantsToDelete);

        // Delete variants
        await supabase
          .from("product_variants")
          .delete()
          .in("id", variantsToDelete);
      }

      // 3. Update existing or insert new variants
      for (const variant of validVariants) {
        let variantId = variant.id;

        if (variantId) {
          // Update existing variant
          const { error: updateVarErr } = await supabase
            .from("product_variants")
            .update({
              packing_name: variant.packing_name.trim(),
              purchase_price: variant.purchase_price,
              sale_price: variant.sale_price,
              stock_quantity: variant.stock_quantity
            })
            .eq("id", variantId);

          if (updateVarErr) throw updateVarErr;
        } else {
          // Insert new variant
          const { data: newVarData, error: newVarErr } = await supabase
            .from("product_variants")
            .insert({
              product_id: productId,
              packing_name: variant.packing_name.trim(),
              purchase_price: variant.purchase_price,
              sale_price: variant.sale_price,
              stock_quantity: variant.stock_quantity
            })
            .select("id")
            .single();

          if (newVarErr) throw newVarErr;
          variantId = newVarData.id;
        }

        // 4. Sync barcodes for this variant
        if (variantId) {
          // Delete old barcodes for this variant
          await supabase
            .from("product_barcodes")
            .delete()
            .eq("variant_id", variantId);

          // Insert clean barcodes
          const cleanBarcodes = variant.barcodes.filter(b => b && b.trim() !== "");
          if (cleanBarcodes.length > 0) {
            const barcodesToInsert = cleanBarcodes.map(b => ({
              product_id: productId,
              variant_id: variantId,
              barcode: b.trim()
            }));

            const { error: barErr } = await supabase
              .from("product_barcodes")
              .insert(barcodesToInsert);

            if (barErr) throw barErr;
          }
        }
      }

      toast.success(`"${editingProduct.name}" and variations updated successfully! ⚡`);
      setIsEditModalOpen(false);
      setEditingProduct(null);
      fetchProducts();
    } catch (error: any) {
      console.error("Error saving variations:", error);
      toast.error("Failed to update variations: " + error.message);
    } finally {
      setIsSubmittingEdit(false);
    }
  };

  // ─── DELETE PRODUCT HANDLER ───
  const handleDeleteProduct = async (productId: string, productName: string) => {
    if (!window.confirm(`Are you sure you want to delete "${productName}" and all its packing variations?`)) {
      return;
    }
    setDeletingProductId(productId);
    try {
      // 1. Delete barcodes
      await supabase.from("product_barcodes").delete().eq("product_id", productId);
      // 2. Delete variants
      await supabase.from("product_variants").delete().eq("product_id", productId);
      // 3. Delete product
      const { error } = await supabase.from("products").delete().eq("id", productId);
      if (error) throw error;

      toast.success(`"${productName}" deleted successfully.`);
      fetchProducts();
    } catch (error: any) {
      toast.error("Failed to delete product: " + error.message);
    } finally {
      setDeletingProductId(null);
    }
  };

  const filteredProducts = products.filter(p => {
    const q = searchQuery.toLowerCase();
    const nameMatch = p.name.toLowerCase().includes(q);
    const catMatch = p.categories?.name && p.categories.name.toLowerCase().includes(q);
    const variantMatch = p.variants.some(v => 
      v.packing_name.toLowerCase().includes(q) || 
      v.barcodes.some(b => b.barcode.toLowerCase().includes(q))
    );
    return nameMatch || catMatch || variantMatch;
  });

  return (
    <div className="space-y-6 font-sans text-slate-800 max-w-[1600px] mx-auto pb-16">
      
      {/* ─── Header Area ─── */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-4 sm:p-6 rounded-3xl border border-slate-200 shadow-xs">
        <div className="flex items-center gap-3">
          <span className="p-2.5 rounded-2xl bg-indigo-50 text-indigo-600 border border-indigo-100 shadow-xs">
            <Layers size={24} />
          </span>
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 flex items-center gap-2">
              Packing Variations & Multi-Barcodes
              <span className="text-xs font-black bg-indigo-100 text-indigo-700 px-2.5 py-0.5 rounded-full border border-indigo-200">
                {products.length} Products Configured
              </span>
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Manage multi-size packings, distinct cost/sale price tiers, and unique barcode matrices per variation.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          {/* Search Box */}
          <div className="relative min-w-[240px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input 
              placeholder="Search product, packing, or barcode..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-10 pl-9 pr-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:bg-white transition"
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
              >
                ✕
              </button>
            )}
          </div>

          {/* Refresh */}
          <button
            onClick={() => { fetchProducts(); fetchCategories(); }}
            className="p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-all cursor-pointer"
            title="Refresh Data"
          >
            <RefreshCw size={16} className={loading ? "animate-spin text-indigo-600" : ""} />
          </button>

          {/* Add Product Button */}
          <button 
            onClick={() => setIsAddModalOpen(true)} 
            className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black shadow-md shadow-indigo-200 transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <Plus size={15} /> Add Product with Variations
          </button>
        </div>
      </div>

      {/* ─── Main Data Table ─── */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs min-w-[850px]">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-100/70 text-slate-700 font-black uppercase text-[10px]">
                <th className="py-3.5 px-4 w-10 text-center"></th>
                <th className="py-3.5 px-4">Product Name & Category</th>
                <th className="py-3.5 px-4 text-center">Configured Variations</th>
                <th className="py-3.5 px-4 text-center">Total Combined Stock</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
              {loading ? (
                <tr>
                  <td colSpan={5} className="py-20 text-center text-slate-400">
                    <Loader2 className="h-8 w-8 animate-spin text-indigo-600 mx-auto mb-2" />
                    <p className="text-xs font-bold text-slate-600">Loading product packing variations...</p>
                  </td>
                </tr>
              ) : filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-20 text-center text-slate-400">
                    <div className="h-14 w-14 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto border border-indigo-100 mb-3">
                      <Package size={28} />
                    </div>
                    <h3 className="text-sm font-black text-slate-800">No Packing Variations Found</h3>
                    <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                      {searchQuery ? "No products match your search query." : "Click '+ Add Product with Variations' above to configure your first multi-pack item."}
                    </p>
                  </td>
                </tr>
              ) : (
                filteredProducts.map((product) => {
                  const isExpanded = !!expandedRows[product.id];
                  const totalStock = product.variants.reduce((acc, v) => acc + (v.stock_quantity || 0), 0);

                  return (
                    <React.Fragment key={product.id}>
                      {/* Parent Row */}
                      <tr className={`hover:bg-slate-50/80 transition-colors ${isExpanded ? 'bg-indigo-50/20' : ''}`}>
                        
                        {/* Expand/Collapse Chevron */}
                        <td className="py-3.5 px-4 text-center">
                          <button 
                            onClick={() => toggleRow(product.id)} 
                            className="p-1 rounded-lg hover:bg-slate-200/80 text-slate-500 transition-colors cursor-pointer"
                            title={isExpanded ? "Collapse Variations" : "Expand Variations"}
                          >
                            {isExpanded ? <ChevronUp size={16} className="text-indigo-600" /> : <ChevronDown size={16} />}
                          </button>
                        </td>

                        {/* Product Name & Category */}
                        <td className="py-3.5 px-4">
                          <div>
                            <span className="font-extrabold text-slate-900 text-sm block">
                              {product.name}
                            </span>
                            {product.categories?.name && (
                              <span className="text-[10px] font-bold text-slate-400 inline-flex items-center gap-1 mt-0.5">
                                <Tag size={10} /> {product.categories.name}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Variations Badge */}
                        <td className="py-3.5 px-4 text-center">
                          <button
                            onClick={() => toggleRow(product.id)}
                            className="inline-flex items-center gap-1.5 bg-indigo-50 text-indigo-700 border border-indigo-200 px-3 py-1 rounded-full font-black text-xs hover:bg-indigo-100 transition cursor-pointer"
                          >
                            <Boxes size={12} />
                            <span>{product.variants.length} Packings</span>
                          </button>
                        </td>

                        {/* Total Stock */}
                        <td className="py-3.5 px-4 text-center">
                          <span className="font-mono font-black text-xs bg-slate-100 text-slate-800 px-2.5 py-1 rounded-xl border border-slate-200">
                            {totalStock} Units
                          </span>
                        </td>

                        {/* Action Buttons: Edit & Delete */}
                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {/* Working Edit Button */}
                            <button 
                              onClick={() => openEditModal(product)} 
                              className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl text-xs font-black transition-colors flex items-center gap-1 cursor-pointer"
                              title="Edit product and all packings"
                            >
                              <Edit size={13} />
                              <span>Edit</span>
                            </button>

                            {/* Delete Button */}
                            <button
                              disabled={deletingProductId === product.id}
                              onClick={() => handleDeleteProduct(product.id, product.name)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer"
                              title="Delete Product"
                            >
                              {deletingProductId === product.id ? <Loader2 size={13} className="animate-spin text-rose-600" /> : <Trash2 size={13} />}
                            </button>
                          </div>
                        </td>
                      </tr>
                      
                      {/* Child Rows: Variations Cards Grid */}
                      <AnimatePresence>
                        {isExpanded && (
                          <motion.tr
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            className="bg-slate-50/60 border-b border-slate-200/80"
                          >
                            <td colSpan={5} className="py-4 px-6 sm:px-12">
                              <div className="space-y-2.5">
                                <div className="flex items-center justify-between">
                                  <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider flex items-center gap-1.5">
                                    <Package size={12} className="text-indigo-600" /> Configured Packings for "{product.name}":
                                  </span>
                                  <button
                                    onClick={() => openEditModal(product)}
                                    className="text-[11px] font-bold text-indigo-600 hover:underline flex items-center gap-1 cursor-pointer"
                                  >
                                    <Edit size={11} /> Modify / Add Packings
                                  </button>
                                </div>

                                <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                                  {product.variants.map((variant, vIdx) => (
                                    <div 
                                      key={variant.id || vIdx} 
                                      className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs relative overflow-hidden space-y-2.5"
                                    >
                                      <div className="absolute top-0 left-0 w-1.5 h-full bg-indigo-500" />
                                      
                                      <div className="flex items-start justify-between gap-2 pl-1">
                                        <div>
                                          <h4 className="font-extrabold text-slate-900 text-xs">{variant.packing_name}</h4>
                                          <p className="text-[10px] text-slate-500 font-mono mt-0.5">
                                            Stock: <strong>{variant.stock_quantity} units</strong>
                                          </p>
                                        </div>
                                        <div className="text-right">
                                          <p className="font-black text-emerald-700 text-xs font-mono">Rs {variant.sale_price.toLocaleString()}</p>
                                          <p className="text-[10px] text-slate-400 font-mono">Cost: Rs {variant.purchase_price.toLocaleString()}</p>
                                        </div>
                                      </div>
                                      
                                      {/* Barcodes Chip List */}
                                      <div className="border-t border-slate-100 pt-2 pl-1">
                                        <span className="text-[9px] uppercase font-bold text-slate-400 block mb-1 flex items-center gap-1">
                                          <Barcode size={10} /> Linked Barcodes:
                                        </span>
                                        <div className="flex flex-wrap gap-1">
                                          {variant.barcodes && variant.barcodes.length > 0 ? (
                                            variant.barcodes.map((b, bIdx) => (
                                              <span 
                                                key={bIdx} 
                                                className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md text-[10px] font-mono border border-slate-200"
                                              >
                                                {b.barcode}
                                              </span>
                                            ))
                                          ) : (
                                            <span className="text-[10px] text-slate-400 italic">No barcodes linked</span>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </td>
                          </motion.tr>
                        )}
                      </AnimatePresence>
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ─── MODAL: EDIT PRODUCT & PACKINGS ─── */}
      <AnimatePresence>
        {isEditModalOpen && editingProduct && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/40 backdrop-blur-sm overflow-y-auto">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0"
              onClick={() => setIsEditModalOpen(false)}
            />
            
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 15 }} 
              animate={{ opacity: 1, scale: 1, y: 0 }} 
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="bg-white w-full max-w-4xl max-h-[90vh] rounded-3xl shadow-2xl relative z-10 flex flex-col border border-slate-100 overflow-hidden"
            >
              {/* Modal Header */}
              <div className="px-6 py-4.5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50 shrink-0">
                <div>
                  <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                    <Edit size={16} className="text-indigo-600" /> Edit Product & Packing Variations
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Modify product details, change price tiers, add/remove packings, and assign barcodes.
                  </p>
                </div>
                <button 
                  onClick={() => setIsEditModalOpen(false)} 
                  className="p-1.5 bg-white rounded-full hover:bg-slate-100 text-slate-500 border border-slate-200 cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-6 overflow-y-auto flex-1 space-y-5 bg-slate-50/30 custom-scrollbar">
                
                {/* Base Product Information */}
                <div className="bg-white p-4.5 rounded-2xl border border-slate-200 shadow-xs grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="sm:col-span-2">
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
                      Product Name *
                    </label>
                    <input 
                      type="text"
                      placeholder="e.g. Sunsilk Shampoo" 
                      value={editingProduct.name}
                      onChange={(e) => setEditingProduct({ ...editingProduct, name: e.target.value })}
                      className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:bg-white"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
                      Category (Optional)
                    </label>
                    <select
                      value={editingProduct.category_id || ""}
                      onChange={(e) => setEditingProduct({ ...editingProduct, category_id: e.target.value })}
                      className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none cursor-pointer"
                    >
                      <option value="">-- No Category --</option>
                      {categories.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Variations Builder */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="font-extrabold text-slate-900 text-sm flex items-center gap-1.5">
                      <Package size={15} className="text-indigo-600" /> Packing Variations ({editingProduct.variants.length})
                    </h4>
                    <button 
                      type="button"
                      onClick={addVariantToEditForm} 
                      className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl text-xs font-black transition-colors flex items-center gap-1 cursor-pointer"
                    >
                      <Plus size={13} /> Add Another Packing
                    </button>
                  </div>

                  {editingProduct.variants.map((variant, vIdx) => (
                    <motion.div 
                      key={vIdx} 
                      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                      className="bg-white border border-indigo-100/80 rounded-2xl p-4.5 shadow-xs relative group space-y-3"
                    >
                      {editingProduct.variants.length > 1 && (
                        <button 
                          type="button"
                          onClick={() => removeVariantFromEditForm(vIdx)} 
                          className="absolute top-3.5 right-3.5 text-slate-300 hover:text-rose-600 p-1 rounded-lg hover:bg-rose-50 transition cursor-pointer"
                          title="Remove this variation"
                        >
                          <Trash2 size={15} />
                        </button>
                      )}
                      
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 pr-8">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                            Packing Name *
                          </label>
                          <input 
                            placeholder="e.g. 100ml, 500ml, Box of 12" 
                            value={variant.packing_name} 
                            onChange={(e) => updateVariantInEditForm(vIdx, 'packing_name', e.target.value)} 
                            className="w-full h-9 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20" 
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                            Purchase Cost (Rs)
                          </label>
                          <input 
                            type="number" 
                            placeholder="0" 
                            value={variant.purchase_price || ""} 
                            onChange={(e) => updateVariantInEditForm(vIdx, 'purchase_price', parseFloat(e.target.value) || 0)} 
                            className="w-full h-9 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20" 
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                            Sale Price (Rs)
                          </label>
                          <input 
                            type="number" 
                            placeholder="0" 
                            value={variant.sale_price || ""} 
                            onChange={(e) => updateVariantInEditForm(vIdx, 'sale_price', parseFloat(e.target.value) || 0)} 
                            className="w-full h-9 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-black text-emerald-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20" 
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                            Current Stock
                          </label>
                          <input 
                            type="number" 
                            placeholder="0" 
                            value={variant.stock_quantity || ""} 
                            onChange={(e) => updateVariantInEditForm(vIdx, 'stock_quantity', parseFloat(e.target.value) || 0)} 
                            className="w-full h-9 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20" 
                          />
                        </div>
                      </div>

                      {/* Barcodes Sub-section */}
                      <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 space-y-2">
                        <div className="flex items-center justify-between">
                          <label className="text-[10px] font-black text-slate-500 uppercase flex items-center gap-1">
                            <Barcode size={12} className="text-indigo-600" /> Linked Barcodes
                          </label>
                          <button 
                            type="button"
                            onClick={() => addBarcodeToEditVariant(vIdx)} 
                            className="text-[10px] font-black text-indigo-600 hover:text-indigo-800 cursor-pointer"
                          >
                            + Add Barcode
                          </button>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                          {variant.barcodes.map((barcode, bIdx) => (
                            <div key={bIdx} className="relative flex items-center">
                              <input 
                                placeholder="Scan or type barcode..." 
                                value={barcode} 
                                onChange={(e) => updateBarcodeInEditVariant(vIdx, bIdx, e.target.value)} 
                                className="w-full h-8 px-2.5 pr-7 bg-white border border-slate-200 rounded-lg text-xs font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                              />
                              {variant.barcodes.length > 1 && (
                                <button 
                                  type="button"
                                  onClick={() => removeBarcodeFromEditVariant(vIdx, bIdx)} 
                                  className="absolute right-1.5 text-slate-300 hover:text-rose-500 p-0.5 cursor-pointer"
                                >
                                  <X size={12} />
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
              <div className="px-6 py-4 border-t border-slate-100 bg-white flex justify-end gap-2.5 shrink-0">
                <button 
                  type="button" 
                  onClick={() => setIsEditModalOpen(false)} 
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-black transition cursor-pointer"
                >
                  Cancel
                </button>
                <button 
                  type="button" 
                  onClick={handleSaveEditedProduct} 
                  disabled={isSubmittingEdit} 
                  className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black transition flex items-center gap-1.5 shadow-md shadow-indigo-200 disabled:opacity-50 cursor-pointer"
                >
                  {isSubmittingEdit ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                  <span>Save Variations</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ─── MODAL: ADD NEW PRODUCT & PACKINGS ─── */}
      <AnimatePresence>
        {isAddModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/40 backdrop-blur-sm overflow-y-auto">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0"
              onClick={() => setIsAddModalOpen(false)}
            />
            
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 15 }} 
              animate={{ opacity: 1, scale: 1, y: 0 }} 
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="bg-white w-full max-w-4xl max-h-[90vh] rounded-3xl shadow-2xl relative z-10 flex flex-col border border-slate-100 overflow-hidden"
            >
              {/* Modal Header */}
              <div className="px-6 py-4.5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50 shrink-0">
                <div>
                  <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                    <Plus size={16} className="text-indigo-600" /> Add Product with Variations
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Create a new product and assign multiple packing sizes with separate barcode mappings.
                  </p>
                </div>
                <button 
                  onClick={() => setIsAddModalOpen(false)} 
                  className="p-1.5 bg-white rounded-full hover:bg-slate-100 text-slate-500 border border-slate-200 cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-6 overflow-y-auto flex-1 space-y-5 bg-slate-50/30 custom-scrollbar">
                
                {/* Base Product Information */}
                <div className="bg-white p-4.5 rounded-2xl border border-slate-200 shadow-xs grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="sm:col-span-2">
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
                      Product Name *
                    </label>
                    <input 
                      type="text"
                      placeholder="e.g. Sunsilk Shampoo" 
                      value={newProduct.name}
                      onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })}
                      className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:bg-white"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
                      Category (Optional)
                    </label>
                    <select
                      value={newProduct.category_id}
                      onChange={(e) => setNewProduct({ ...newProduct, category_id: e.target.value })}
                      className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none cursor-pointer"
                    >
                      <option value="">-- No Category --</option>
                      {categories.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Variations Builder */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="font-extrabold text-slate-900 text-sm flex items-center gap-1.5">
                      <Package size={15} className="text-indigo-600" /> Packing Variations
                    </h4>
                    <button 
                      type="button"
                      onClick={addVariantToAddForm} 
                      className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl text-xs font-black transition-colors flex items-center gap-1 cursor-pointer"
                    >
                      <Plus size={13} /> Add Packing
                    </button>
                  </div>

                  {newProduct.variants.map((variant, vIdx) => (
                    <motion.div 
                      key={vIdx} 
                      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                      className="bg-white border border-indigo-100/80 rounded-2xl p-4.5 shadow-xs relative group space-y-3"
                    >
                      {newProduct.variants.length > 1 && (
                        <button 
                          type="button"
                          onClick={() => removeVariantFromAddForm(vIdx)} 
                          className="absolute top-3.5 right-3.5 text-slate-300 hover:text-rose-600 p-1 rounded-lg hover:bg-rose-50 transition cursor-pointer"
                          title="Remove this variation"
                        >
                          <Trash2 size={15} />
                        </button>
                      )}
                      
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 pr-8">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                            Packing Name *
                          </label>
                          <input 
                            placeholder="e.g. 100ml Bottle" 
                            value={variant.packing_name} 
                            onChange={(e) => updateVariantInAddForm(vIdx, 'packing_name', e.target.value)} 
                            className="w-full h-9 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20" 
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                            Purchase (Rs)
                          </label>
                          <input 
                            type="number" 
                            placeholder="0" 
                            value={variant.purchase_price || ""} 
                            onChange={(e) => updateVariantInAddForm(vIdx, 'purchase_price', parseFloat(e.target.value) || 0)} 
                            className="w-full h-9 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20" 
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                            Sale (Rs)
                          </label>
                          <input 
                            type="number" 
                            placeholder="0" 
                            value={variant.sale_price || ""} 
                            onChange={(e) => updateVariantInAddForm(vIdx, 'sale_price', parseFloat(e.target.value) || 0)} 
                            className="w-full h-9 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-black text-emerald-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20" 
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                            Stock Qty
                          </label>
                          <input 
                            type="number" 
                            placeholder="0" 
                            value={variant.stock_quantity || ""} 
                            onChange={(e) => updateVariantInAddForm(vIdx, 'stock_quantity', parseFloat(e.target.value) || 0)} 
                            className="w-full h-9 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20" 
                          />
                        </div>
                      </div>

                      {/* Barcodes Sub-section */}
                      <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 space-y-2">
                        <div className="flex items-center justify-between">
                          <label className="text-[10px] font-black text-slate-500 uppercase flex items-center gap-1">
                            <Barcode size={12} className="text-indigo-600" /> Associated Barcodes
                          </label>
                          <button 
                            type="button"
                            onClick={() => addBarcodeToAddVariant(vIdx)} 
                            className="text-[10px] font-black text-indigo-600 hover:text-indigo-800 cursor-pointer"
                          >
                            + Add Barcode
                          </button>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                          {variant.barcodes.map((barcode, bIdx) => (
                            <div key={bIdx} className="relative flex items-center">
                              <input 
                                placeholder="Scan or type barcode..." 
                                value={barcode} 
                                onChange={(e) => updateBarcodeInAddVariant(vIdx, bIdx, e.target.value)} 
                                className="w-full h-8 px-2.5 pr-7 bg-white border border-slate-200 rounded-lg text-xs font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                              />
                              {variant.barcodes.length > 1 && (
                                <button 
                                  type="button"
                                  onClick={() => removeBarcodeFromAddVariant(vIdx, bIdx)} 
                                  className="absolute right-1.5 text-slate-300 hover:text-rose-500 p-0.5 cursor-pointer"
                                >
                                  <X size={12} />
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
              <div className="px-6 py-4 border-t border-slate-100 bg-white flex justify-end gap-2.5 shrink-0">
                <button 
                  type="button" 
                  onClick={() => setIsAddModalOpen(false)} 
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-black transition cursor-pointer"
                >
                  Cancel
                </button>
                <button 
                  type="button" 
                  onClick={handleSaveNewProduct} 
                  disabled={isSubmittingAdd} 
                  className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black transition flex items-center gap-1.5 shadow-md shadow-indigo-200 disabled:opacity-50 cursor-pointer"
                >
                  {isSubmittingAdd ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                  <span>Save Complete Product</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
