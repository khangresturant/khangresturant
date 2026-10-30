"use client";

import React, { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Scissors, Search, PlusCircle, Calendar, Printer,
  Trash2, Edit, Loader2, Save, X, User, DollarSign, Clock, CheckCircle2,
  Sparkles, Layers, Shield, FileText, BadgeAlert, MessageCircle, Lock
} from "lucide-react";
import { useShop } from "@/context/ShopContext";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatWhatsAppPhone } from "@/lib/whatsapp";

type StitchingOrder = {
  id: string;
  customer_id: string;
  karigar_id: string | null;
  delivery_date: string;
  status: "pending" | "cutting" | "stitching" | "completed" | "delivered";
  total_amount: number;
  karigar_wage: number;
  created_at: string;
  garment_type: string | null;
  fabric: string | null;
  design_style: string | null;
  advance_payment: number;
  payment_status: string;
  measurement_id: string | null;
  suit_expense?: number;
  suit_code?: string | null;
  suit_image_url?: string | null;
  customers?: any;
  karigars?: any;
  tailor_measurements?: any;
};

type Customer = { id: string; name: string; phone: string | null };
type Karigar = { id: string; name: string };

export default function StitchingOrdersPage() {
  const { shopId, shopName, subscriptionTier, subscriptionExpiresAt } = useShop();
  const supabase = createClient();

  const [orders, setOrders] = useState<StitchingOrder[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [karigars, setKarigars] = useState<Karigar[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"active" | "delivered" | "all">("active");

  // Modals State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingOrder, setEditingOrder] = useState<StitchingOrder | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    customer_id: "",
    karigar_id: "",
    delivery_date: "",
    status: "pending" as any,
    total_amount: 1500,
    karigar_wage: 600,
    garment_type: "Shalwar Kameez",
    fabric: "Cotton",
    design_style: "Simple Ban Collar, Open Cuffs",
    advance_payment: 500,
    payment_status: "partial" as "unpaid" | "partial" | "paid",
    suit_code: "",
    suit_image_url: ""
  });

  const handleSuitFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    if (file.size > 1500000) {
      toast.error("Suit photo file is too large! Maximum limit is 1.5MB.");
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setFormData(prev => ({ ...prev, suit_image_url: reader.result as string }));
      toast.success("Suit photo loaded successfully!");
    };
    reader.readAsDataURL(file);
  };

  // Sizes / Measurement Form State (Embed Size inputs inside order booking)
  const [orderMeasurement, setOrderMeasurement] = useState({
    length: 40,
    chest: 36,
    waist: 32,
    shoulder: 18,
    collar: 15,
    shalwar: 38,
    paincha: 8.5,
    teera: 17,
    big_teera: 19,
    design_details: ""
  });

  // Custom Measurements for Order
  const [orderCustomFields, setOrderCustomFields] = useState<{ name: string; value: string }[]>([]);

  const handleAddOrderCustomField = () => {
    setOrderCustomFields(prev => [...prev, { name: "", value: "" }]);
  };

  const handleRemoveOrderCustomField = (index: number) => {
    setOrderCustomFields(prev => prev.filter((_, i) => i !== index));
  };

  const handleOrderCustomFieldChange = (index: number, field: "name" | "value", val: string) => {
    setOrderCustomFields(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: val };
      return updated;
    });
  };

  // Quick Add Customer States
  const [showQuickAddCustomer, setShowQuickAddCustomer] = useState(false);
  const [quickCustomerName, setQuickCustomerName] = useState("");
  const [quickCustomerPhone, setQuickCustomerPhone] = useState("");
  const [quickCustomerLoading, setQuickCustomerLoading] = useState(false);

  const handleQuickAddCustomer = async () => {
    if (!quickCustomerName.trim()) {
      toast.error("Please enter a customer name.");
      return;
    }
    setQuickCustomerLoading(true);
    try {
      const { data, error } = await supabase
        .from("parties")
        .insert({
          shop_id: shopId,
          name: quickCustomerName.trim(),
          phone: quickCustomerPhone.trim() || null,
          type: "customer"
        })
        .select()
        .single();

      if (error) throw error;
      toast.success("Customer added successfully!");

      setCustomers(prev => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)));
      setFormData(prev => ({ ...prev, customer_id: data.id }));
      setQuickCustomerName("");
      setQuickCustomerPhone("");
      setShowQuickAddCustomer(false);
    } catch (e: any) {
      toast.error("Failed to add customer: " + e.message);
    } finally {
      setQuickCustomerLoading(false);
    }
  };

  // Delivery & Expense Dialog States
  const [deliveryConfirmOrder, setDeliveryConfirmOrder] = useState<StitchingOrder | null>(null);
  const [isDeliveryModalOpen, setIsDeliveryModalOpen] = useState(false);
  const [deliveryProcessing, setDeliveryProcessing] = useState(false);
  const [cashReceivedInput, setCashReceivedInput] = useState<number>(0);

  const [expenseConfirmOrder, setExpenseConfirmOrder] = useState<StitchingOrder | null>(null);
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [expenseProcessing, setExpenseProcessing] = useState(false);
  const [suitExpenseInput, setSuitExpenseInput] = useState<number>(0);

  // WhatsApp Ready notification state
  const [showWAReadyBanner, setShowWAReadyBanner] = useState(false);
  const [waReadyOrder, setWaReadyOrder] = useState<{ name: string; phone: string | null; garment: string | null } | null>(null);

  const handleStatusChange = (order: StitchingOrder, newStatus: string) => {
    if (newStatus === "delivered") {
      if (order.status !== "completed") {
        toast.error("آرڈر کو ڈیلیور کرنے سے پہلے 'Completed' مارک کرنا اور اخراجات درج کرنا لازمی ہے۔ (Mark completed first!)");
        fetchOrders(); // Reverts dropdown visual selection
        return;
      }
      const due = Number(order.total_amount) - Number(order.advance_payment);
      if (due > 0) {
        setDeliveryConfirmOrder(order);
        setCashReceivedInput(due); // default to full remaining balance
        setIsDeliveryModalOpen(true);
        return;
      }
    }

    if (newStatus === "completed") {
      setExpenseConfirmOrder(order);
      setSuitExpenseInput(Number(order.suit_expense) || 0);
      setIsExpenseModalOpen(true);
      return;
    }

    // For other status changes (or if due is 0), proceed normally
    updateOrderStatus(order.id, order.karigar_id, order.karigar_wage, order.status, newStatus);
  };

  const handleConfirmDelivery = async () => {
    if (!deliveryConfirmOrder) return;
    setDeliveryProcessing(true);
    try {
      const order = deliveryConfirmOrder;
      const due = Number(order.total_amount) - Number(order.advance_payment);
      const cashPaid = Math.max(0, Math.min(due, Number(cashReceivedInput) || 0));
      const creditAmount = due - cashPaid;

      // 1. Update order status and new advance payment/status
      const newAdvance = Number(order.advance_payment) + cashPaid;
      const newPaymentStatus = creditAmount === 0 ? "paid" : (newAdvance > 0 ? "partial" : "unpaid");

      const { error: orderError } = await supabase
        .from("stitching_orders")
        .update({ 
          status: "delivered",
          payment_status: newPaymentStatus,
          advance_payment: newAdvance
        })
        .eq("id", order.id)
        .eq("shop_id", shopId);

      if (orderError) throw orderError;

      // 2. Add to customer's Khata if creditAmount > 0
      if (creditAmount > 0) {
        const { error: txError } = await supabase
          .from("credit_transactions")
          .insert({
            shop_id: shopId,
            customer_id: order.customer_id,
            amount: creditAmount,
            transaction_type: "charge",
            remarks: `Stitching Order delivered on partial Credit`
          });

        if (txError) throw txError;

        const { error: balanceError } = await supabase
          .rpc("increment_party_balance", {
            p_id: order.customer_id,
            amount: creditAmount
          });

        if (balanceError) throw balanceError;
      }

      // 3. Karigar wage credit
      if (order.status !== "completed" && order.karigar_id) {
        const { error: rpcError } = await supabase.rpc("increment_karigar_balance", {
          k_id: order.karigar_id,
          wage: order.karigar_wage
        });
        if (rpcError) throw rpcError;
      }

      toast.success(
        `Order delivered successfully! ` +
        (cashPaid > 0 ? `Cash Rs ${cashPaid} received. ` : "") +
        (creditAmount > 0 ? `Rs ${creditAmount} added to customer's Khata.` : "")
      );

      setIsDeliveryModalOpen(false);
      setDeliveryConfirmOrder(null);
      fetchOrders();
    } catch (err: any) {
      toast.error("Failed to process delivery payment: " + err.message);
    } finally {
      setDeliveryProcessing(false);
    }
  };

  const handleConfirmExpense = async () => {
    if (!expenseConfirmOrder) return;
    setExpenseProcessing(true);
    try {
      const order = expenseConfirmOrder;
      const expenseAmount = Math.max(0, Number(suitExpenseInput) || 0);

      // 1. Update the stitching order status and suit_expense
      const { error } = await supabase
        .from("stitching_orders")
        .update({ 
          status: "completed",
          suit_expense: expenseAmount
        })
        .eq("id", order.id)
        .eq("shop_id", shopId);

      if (error) throw error;

      // 2. Increment Karigar wage if not already completed
      if (order.status !== "completed" && order.karigar_id) {
        const { error: rpcError } = await supabase.rpc("increment_karigar_balance", {
          k_id: order.karigar_id,
          wage: order.karigar_wage
        });
        if (rpcError) throw rpcError;
      }

      // 3. Log expense
      if (expenseAmount > 0) {
        const { error: expError } = await supabase
          .from("expenses")
          .insert({
            shop_id: shopId,
            name: `Order #${order.id.slice(0, 8)} Suit Accessories/Material Expense`,
            amount: expenseAmount,
            expense_type: "Stitching / Accessories",
            remarks: `Stitching expense recorded on Order Completion for Customer: ${getCustomerName(order.customers)}`
          });
        
        if (expError) console.error("Could not register in expense tracker:", expError.message);
      }

      toast.success(`Order marked as Completed! Stitching expense of Rs ${expenseAmount} recorded.`);
      setIsExpenseModalOpen(false);
      setExpenseConfirmOrder(null);

      // Show WhatsApp notification prompt if customer has a phone
      const custPhone = order.customers?.phone || null;
      setWaReadyOrder({
        name: order.customers?.name || "Customer",
        phone: custPhone,
        garment: order.garment_type || "Suit"
      });
      setShowWAReadyBanner(true);

      fetchOrders();
    } catch (err: any) {
      toast.error("Failed to update status and expense: " + err.message);
    } finally {
      setExpenseProcessing(false);
    }
  };

  useEffect(() => {
    if (shopId) {
      fetchOrders();
      fetchCustomers();
      fetchKarigars();
    }
  }, [shopId]);

  // Fetch measurements automatically when a customer is selected
  useEffect(() => {
    if (formData.customer_id) {
      loadCustomerMeasurement(formData.customer_id);
    }
  }, [formData.customer_id]);

  const loadCustomerMeasurement = async (partyId: string) => {
    try {
      const { data, error } = await supabase
        .from("tailor_measurements")
        .select("*")
        .eq("shop_id", shopId)
        .eq("party_id", partyId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!error && data) {
        setOrderMeasurement({
          length: Number(data.length) || 40,
          chest: Number(data.chest) || 36,
          waist: Number(data.waist) || 32,
          shoulder: Number(data.shoulder) || 18,
          collar: Number(data.collar) || 15,
          shalwar: Number(data.shalwar) || 38,
          paincha: Number(data.paincha) || 8.5,
          teera: Number(data.teera) || 17,
          big_teera: Number(data.big_teera) || 19,
          design_details: data.design_details || ""
        });
        setOrderCustomFields(Array.isArray(data.custom_measurements) ? data.custom_measurements : []);
      } else {
        // Fallback default sizes
        setOrderMeasurement({
          length: 40,
          chest: 36,
          waist: 32,
          shoulder: 18,
          collar: 15,
          shalwar: 38,
          paincha: 8.5,
          teera: 17,
          big_teera: 19,
          design_details: ""
        });
        setOrderCustomFields([]);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("stitching_orders")
        .select(`
          id, customer_id, karigar_id, delivery_date, status, total_amount, karigar_wage, created_at,
          garment_type, fabric, design_style, advance_payment, payment_status, measurement_id, suit_expense, suit_code, suit_image_url,
          customers:parties!stitching_orders_customer_id_fkey ( name, phone ),
          karigars ( name ),
          tailor_measurements!stitching_orders_measurement_id_fkey (
            length, chest, waist, shoulder, collar, shalwar, paincha, teera, big_teera, design_details, custom_measurements
          )
        `)
        .eq("shop_id", shopId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setOrders((data as any) || []);
    } catch (err: any) {
      toast.error("Failed to load stitching orders: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchCustomers = async () => {
    try {
      const { data, error } = await supabase
        .from("parties")
        .select("id, name, phone")
        .eq("shop_id", shopId)
        .eq("type", "customer")
        .order("name", { ascending: true });

      if (error) throw error;
      setCustomers(data || []);
    } catch (err: any) {
      console.error(err.message);
    }
  };

  const fetchKarigars = async () => {
    try {
      const { data, error } = await supabase
        .from("karigars")
        .select("id, name")
        .eq("shop_id", shopId)
        .order("name", { ascending: true });

      if (error) throw error;
      setKarigars(data || []);
    } catch (err: any) {
      console.error(err.message);
    }
  };

  const handleOpenAddModal = () => {
    setEditingOrder(null);
    setOrderCustomFields([]);
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 5);
    
    setFormData({
      customer_id: customers[0]?.id || "",
      karigar_id: karigars[0]?.id || "",
      delivery_date: tomorrow.toISOString().split("T")[0],
      status: "pending",
      total_amount: 1800,
      karigar_wage: 700,
      garment_type: "Shalwar Kameez",
      fabric: "Wash & Wear",
      design_style: "Ban Collar, Double Stitch cuffs",
      advance_payment: 1000,
      payment_status: "partial",
      suit_code: "",
      suit_image_url: ""
    });
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (order: StitchingOrder) => {
    setEditingOrder(order);
    setFormData({
      customer_id: order.customer_id,
      karigar_id: order.karigar_id || "",
      delivery_date: order.delivery_date,
      status: order.status,
      total_amount: Number(order.total_amount) || 0,
      karigar_wage: Number(order.karigar_wage) || 0,
      garment_type: order.garment_type || "Shalwar Kameez",
      fabric: order.fabric || "Cotton",
      design_style: order.design_style || "",
      advance_payment: Number(order.advance_payment) || 0,
      payment_status: (order.payment_status as any) || "unpaid",
      suit_code: order.suit_code || "",
      suit_image_url: order.suit_image_url || ""
    });
    
    if (order.tailor_measurements) {
      const m = order.tailor_measurements;
      setOrderMeasurement({
        length: Number(m.length) || 0,
        chest: Number(m.chest) || 0,
        waist: Number(m.waist) || 0,
        shoulder: Number(m.shoulder) || 0,
        collar: Number(m.collar) || 0,
        shalwar: Number(m.shalwar) || 0,
        paincha: Number(m.paincha) || 0,
        teera: Number(m.teera) || 0,
        big_teera: Number(m.big_teera) || 0,
        design_details: m.design_details || ""
      });
      setOrderCustomFields(Array.isArray(m.custom_measurements) ? m.custom_measurements : []);
    } else {
      setOrderCustomFields([]);
    }
    setIsModalOpen(true);
  };

  const handleSaveOrder = async () => {
    if (!formData.customer_id) {
      toast.error("Please select a customer.");
      return;
    }

    setIsSubmitting(true);
    try {
      // 1. First Save/Update size measurement profile in public.tailor_measurements
      let measurementId = editingOrder?.measurement_id;

      const measurementPayload = {
        shop_id: shopId,
        party_id: formData.customer_id,
        length: orderMeasurement.length,
        chest: orderMeasurement.chest,
        waist: orderMeasurement.waist,
        shoulder: orderMeasurement.shoulder,
        collar: orderMeasurement.collar,
        shalwar: orderMeasurement.shalwar,
        paincha: orderMeasurement.paincha,
        teera: orderMeasurement.teera,
        big_teera: orderMeasurement.big_teera,
        design_details: orderMeasurement.design_details || null,
        status: formData.status === "completed" ? "ready" : (formData.status === "pending" ? "cutting" : "stitching"),
        custom_measurements: orderCustomFields.filter(f => f.name.trim() !== "")
      };

      if (measurementId) {
        // Update existing measurement
        await supabase
          .from("tailor_measurements")
          .update(measurementPayload)
          .eq("id", measurementId)
          .eq("shop_id", shopId);
      } else {
        // Insert new measurement
        const { data: mData, error: mErr } = await supabase
          .from("tailor_measurements")
          .insert(measurementPayload)
          .select("id")
          .single();
        if (mErr) throw mErr;
        measurementId = mData.id;
      }

      // 2. Prepare Stitching Order Payload
      const dbPayload = {
        shop_id: shopId,
        customer_id: formData.customer_id,
        karigar_id: formData.karigar_id || null,
        delivery_date: formData.delivery_date,
        status: formData.status,
        total_amount: formData.total_amount,
        karigar_wage: formData.karigar_wage,
        garment_type: formData.garment_type,
        fabric: formData.fabric,
        design_style: formData.design_style,
        advance_payment: formData.advance_payment,
        payment_status: formData.payment_status,
        measurement_id: measurementId,
        suit_code: formData.suit_code || null,
        suit_image_url: formData.suit_image_url || null
      };

      if (editingOrder) {
        const { error } = await supabase
          .from("stitching_orders")
          .update(dbPayload)
          .eq("id", editingOrder.id)
          .eq("shop_id", shopId);

        if (error) throw error;

        // If status changed to completed, increment Karigar wage
        if (formData.status === "completed" && editingOrder.status !== "completed" && formData.karigar_id) {
          await supabase.rpc("increment_karigar_balance", {
            k_id: formData.karigar_id,
            wage: formData.karigar_wage
          });
        }

        toast.success("Stitching order updated successfully!");
      } else {
        const { error } = await supabase
          .from("stitching_orders")
          .insert(dbPayload);

        if (error) throw error;

        if (formData.status === "completed" && formData.karigar_id) {
          await supabase.rpc("increment_karigar_balance", {
            k_id: formData.karigar_id,
            wage: formData.karigar_wage
          });
        }

        toast.success("New stitching order registered!");
      }

      setIsModalOpen(false);
      fetchOrders();
    } catch (err: any) {
      toast.error("Error saving stitching order: " + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const updateOrderStatus = async (id: string, karigarId: string | null, wage: number, oldStatus: string, newStatus: any) => {
    try {
      const { error } = await supabase
        .from("stitching_orders")
        .update({ status: newStatus })
        .eq("id", id)
        .eq("shop_id", shopId);

      if (error) throw error;
      
      if (newStatus === "completed" && oldStatus !== "completed" && karigarId) {
        const { error: rpcError } = await supabase.rpc("increment_karigar_balance", {
          k_id: karigarId,
          wage: wage
        });
        if (rpcError) throw rpcError;
        toast.success(`Wage of Rs ${wage} credited to Karigar!`);
      }

      toast.success(`Order status updated to ${newStatus}`);
      fetchOrders();
    } catch (err: any) {
      toast.error("Failed to update status: " + err.message);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this order?")) return;
    try {
      const { error } = await supabase
        .from("stitching_orders")
        .delete()
        .eq("id", id)
        .eq("shop_id", shopId);

      if (error) throw error;
      toast.success("Order deleted.");
      fetchOrders();
    } catch (err: any) {
      toast.error("Error: " + err.message);
    }
  };

  const handlePrintReceipt = (order: StitchingOrder) => {
    const sName = shopName || "The Accounts Tailors";
    const cName = getCustomerName(order.customers);
    const cPhone = order.customers?.phone || "N/A";
    const orderDate = new Date(order.created_at).toLocaleDateString("en-PK", { day: "2-digit", month: "short", year: "numeric" });
    const deliveryDate = new Date(order.delivery_date).toLocaleDateString("en-PK", { day: "2-digit", month: "short", year: "numeric" });
    const m = order.tailor_measurements || {};
    const customMeas: Array<{ name: string; value: string }> = Array.isArray(m.custom_measurements) ? m.custom_measurements : [];
    
    const shortId = order.id.slice(0, 8).toUpperCase();
    const dueAmount = Math.max(0, Number(order.total_amount) - Number(order.advance_payment || 0));

    // QR Code pointing to tracking URL
    const qrData = `https://theaccounts.cloud/dashboard/tailor/orders?order=${order.id}`;
    const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=140x140&margin=2&data=${encodeURIComponent(qrData)}`;

    const customMeasRowsHtml = customMeas.length > 0 
      ? customMeas.map(cm => `<tr><td style="font-weight:bold; color:#0f766e;">${cm.name}:</td><td style="text-align:right; font-weight:bold;">${cm.value}</td></tr>`).join("") 
      : "";

    const receiptHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Stitching Slip #${shortId}</title>
          <style>
            @media print {
              body { margin: 0; padding: 0; }
              @page { size: 80mm auto; margin: 0; }
            }
            body { 
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
              width: 76mm; 
              padding: 2mm; 
              font-size: 11px; 
              color: #1e293b; 
              line-height: 1.3;
              background: #fff;
            }
            .text-center { text-align: center; }
            .text-right { text-align: right; }
            .font-bold { font-weight: 700; }
            .font-black { font-weight: 900; }
            
            .header-box { text-align: center; border-bottom: 2px solid #000; padding-bottom: 3mm; margin-bottom: 3mm; }
            .shop-title { font-size: 17px; font-weight: 900; letter-spacing: 0.5px; text-transform: uppercase; margin: 0; }
            .shop-sub { font-size: 10px; font-weight: 700; color: #475569; margin: 1mm 0 0 0; }
            
            .badge { display: inline-block; background: #000; color: #fff; padding: 1mm 3mm; font-size: 10px; font-weight: bold; border-radius: 3px; }
            .code-box { border: 1.5px solid #000; padding: 1.5mm 3mm; text-align: center; font-size: 13px; font-weight: 900; background: #f8fafc; margin: 2mm 0; border-radius: 4px; }
            
            table { width: 100%; border-collapse: collapse; margin: 2mm 0; }
            td { padding: 1mm 0; vertical-align: top; border-bottom: 1px border-dashed #e2e8f0; }
            .no-border td { border: none; }
            
            .financial-box { background: #f1f5f9; border: 1px solid #cbd5e1; padding: 2mm; border-radius: 6px; margin: 3mm 0; }
            .due-line { font-size: 14px; color: #000; font-weight: 900; padding-top: 1mm; border-top: 1.5px solid #000; }
            
            .qr-box { text-align: center; margin: 3mm 0; padding: 2mm; border: 1px solid #e2e8f0; border-radius: 6px; }
            .qr-img { width: 110px; height: 110px; margin: 0 auto; display: block; }
            
            .cut-line { margin: 6mm 0; border-top: 2px dashed #000; text-align: center; position: relative; }
            .cut-label { background: #fff; padding: 0 4mm; font-size: 9px; font-weight: 900; text-transform: uppercase; letter-spacing: 1px; position: relative; top: -7px; }
            
            .meas-grid { width: 100%; border-collapse: collapse; margin: 2mm 0; font-size: 10px; }
            .meas-grid th, .meas-grid td { border: 1px solid #cbd5e1; padding: 1.5mm 1mm; text-align: center; }
            .meas-grid th { background: #f8fafc; font-size: 8.5px; text-transform: uppercase; color: #475569; }
            
            .suit-img { max-width: 100%; max-height: 120px; object-fit: contain; border: 1px solid #cbd5e1; border-radius: 6px; margin: 2mm auto; display: block; }
          </style>
        </head>
        <body>
          <!-- ── COPY 1: CUSTOMER RECEIPT ──────────────────────────────────── -->
          <div class="header-box">
            <h1 class="shop-title">${sName}</h1>
            <p class="shop-sub">STITCHING ORDER RECEIPT (گاہک کی رسید)</p>
            ${cPhone !== "N/A" ? `<p style="font-size:9.5px; margin-top:0.5mm;">Ph: ${cPhone}</p>` : ""}
          </div>

          ${order.suit_code ? `<div class="code-box">SUIT TAG / کسٹم کوڈ: ${order.suit_code}</div>` : ""}

          <table class="no-border">
            <tr><td style="color:#64748b;">Order No:</td><td class="text-right font-black">#${shortId}</td></tr>
            <tr><td style="color:#64748b;">Order Date:</td><td class="text-right font-bold">${orderDate}</td></tr>
            <tr><td style="color:#64748b; font-weight:bold;">Delivery Date:</td><td class="text-right font-black" style="font-size:12px; color:#000;">${deliveryDate}</td></tr>
            <tr><td style="color:#64748b;">Customer:</td><td class="text-right font-bold">${cName}</td></tr>
            <tr><td style="color:#64748b;">Garment:</td><td class="text-right font-bold">${order.garment_type || "Suit"}</td></tr>
            <tr><td style="color:#64748b;">Fabric:</td><td class="text-right">${order.fabric || "Custom Fabric"}</td></tr>
          </table>

          <div class="financial-box">
            <table class="no-border" style="margin:0;">
              <tr><td>Total Bill Rate:</td><td class="text-right font-bold">Rs ${order.total_amount}</td></tr>
              <tr><td>Advance Payment:</td><td class="text-right font-bold" style="color:#16a34a;">Rs ${order.advance_payment || 0}</td></tr>
              <tr class="due-line"><td>NET BALANCE DUE:</td><td class="text-right">Rs ${dueAmount}</td></tr>
            </table>
          </div>

          <!-- QR CODE FOR STATUS TRACKING -->
          <div class="qr-box">
            <img src="${qrCodeUrl}" class="qr-img" alt="QR Code" />
            <p style="font-size: 8.5px; font-weight: 700; margin: 1.5mm 0 0 0; color: #334155;">
              اس کسٹمر QR کوڈ کو اسکین کر کے اپنے سوٹ کا اسٹیٹس آن لائن دیکھیں
            </p>
          </div>

          <p class="text-center" style="font-size: 8.5px; font-weight: 600; color: #64748b; margin-top: 2mm;">
            Thank you for choosing ${sName}!<br>Please present this slip at the time of delivery.
          </p>

          <!-- ── CUT LINE ─────────────────────────────────────────────────── -->
          <div class="cut-line">
            <span class="cut-label">✂ CUT HERE / کٹنگ رسید (WORKSHOP COPY) ✂</span>
          </div>

          <!-- ── COPY 2: WORKSHOP / KARIGAR COPY ──────────────────────────── -->
          <div class="header-box" style="border-bottom: 1.5px solid #000;">
            <div class="badge">WORKSHOP / KARIGAR CUTTING SLIP</div>
            <h2 style="font-size:14px; font-weight:900; margin: 1mm 0 0 0;">${sName}</h2>
          </div>

          ${order.suit_code ? `<div class="code-box" style="background:#e0f2fe; border-color:#0284c7; color:#0369a1;">SUIT TAG CODE: ${order.suit_code}</div>` : ""}

          <table class="no-border">
            <tr><td style="color:#64748b;">Order ID:</td><td class="text-right font-black">#${shortId}</td></tr>
            <tr><td style="color:#64748b; font-weight:bold;">Delivery Date:</td><td class="text-right font-black" style="font-size:12px;">${deliveryDate}</td></tr>
            <tr><td style="color:#64748b;">Customer Name:</td><td class="text-right font-bold">${cName}</td></tr>
            <tr><td style="color:#64748b;">Garment & Fabric:</td><td class="text-right font-bold">${order.garment_type || "Suit"} (${order.fabric || "Standard"})</td></tr>
            <tr><td style="color:#64748b;">Assigned Karigar:</td><td class="text-right font-bold">${getKarigarName(order.karigars) || "Unassigned"}</td></tr>
            ${order.karigar_wage ? `<tr><td style="color:#64748b;">Karigar Wage:</td><td class="text-right font-bold" style="color:#d97706;">Rs ${order.karigar_wage}</td></tr>` : ""}
          </table>

          <p class="font-black text-center" style="font-size: 10.5px; text-transform: uppercase; margin: 2mm 0 1mm 0; letter-spacing: 0.5px;">
            -- MEASUREMENTS (سائز کی تفصیل) --
          </p>

          <table class="meas-grid">
            <thead>
              <tr>
                <th>Length</th>
                <th>Chest</th>
                <th>Waist</th>
                <th>Shoulder</th>
                <th>Collar</th>
              </tr>
            </thead>
            <tbody>
              <tr class="font-black">
                <td>${m.length || 0}"</td>
                <td>${m.chest || 0}"</td>
                <td>${m.waist || 0}"</td>
                <td>${m.shoulder || 0}"</td>
                <td>${m.collar || 0}"</td>
              </tr>
            </tbody>
          </table>

          <table class="meas-grid" style="margin-top: -1.5mm;">
            <thead>
              <tr>
                <th>Shalwar</th>
                <th>Paincha</th>
                <th>Teera</th>
                <th>Big Teera</th>
              </tr>
            </thead>
            <tbody>
              <tr class="font-black">
                <td>${m.shalwar || 0}"</td>
                <td>${m.paincha || 0}"</td>
                <td>${m.teera || 0}"</td>
                <td>${m.big_teera || 0}"</td>
              </tr>
            </tbody>
          </table>

          ${customMeasRowsHtml ? `
            <p class="font-bold" style="font-size: 9.5px; margin: 2mm 0 1mm 0; color: #0f766e;">Custom Measurements (مزید پیمائشیں):</p>
            <table class="no-border" style="font-size: 10px;">
              ${customMeasRowsHtml}
            </table>
          ` : ""}

          ${order.design_style || m.design_details ? `
            <p class="font-bold" style="font-size: 9.5px; margin: 2mm 0 1mm 0;">Design & Stitching Instructions (ڈیزائن تفصیل):</p>
            <div style="background:#f8fafc; border:1px solid #cbd5e1; padding:2mm; font-size:10px; font-weight:700; border-radius:4px; line-height:1.4;">
              ${order.design_style || m.design_details}
            </div>
          ` : ""}

          ${order.suit_image_url ? `
            <p class="font-bold" style="font-size: 9.5px; margin: 2mm 0 1mm 0;">Suit Photo / Reference Pattern:</p>
            <img src="${order.suit_image_url}" class="suit-img" alt="Suit reference" />
          ` : ""}

        </body>
      </html>
    `;

    const printWindow = window.open("", "_blank");
    if (printWindow) {
      printWindow.document.write(receiptHtml);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => {
        printWindow.print();
        printWindow.close();
      }, 600);
    }
  };

  const getCustomerName = (customers: any) => {
    if (!customers) return "Walk-in Customer";
    if (Array.isArray(customers)) {
      return customers[0]?.name || "Walk-in Customer";
    }
    return customers.name || "Walk-in Customer";
  };

  const getKarigarName = (karigars: any) => {
    if (!karigars) return null;
    if (Array.isArray(karigars)) {
      return karigars[0]?.name || null;
    }
    return karigars.name || null;
  };

  const activeOrdersCount = useMemo(() => orders.filter(o => o.status !== "delivered").length, [orders]);
  const deliveredOrdersCount = useMemo(() => orders.filter(o => o.status === "delivered").length, [orders]);

  const filtered = orders.filter(o => {
    // Tab filter
    if (activeTab === "active" && o.status === "delivered") return false;
    if (activeTab === "delivered" && o.status !== "delivered") return false;

    // Search filter
    const cName = getCustomerName(o.customers);
    const cPhone = o.customers?.phone || "";
    const kName = getKarigarName(o.karigars) || "";
    const sCode = o.suit_code || "";
    const gType = o.garment_type || "";
    const query = searchQuery.toLowerCase().trim();

    return (
      cName.toLowerCase().includes(query) ||
      cPhone.toLowerCase().includes(query) ||
      kName.toLowerCase().includes(query) ||
      sCode.toLowerCase().includes(query) ||
      gType.toLowerCase().includes(query)
    );
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      
      {/* WhatsApp Order Ready Notification Banner */}
      <AnimatePresence>
        {showWAReadyBanner && waReadyOrder && (
          <motion.div
            initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}
            className="flex items-center gap-4 bg-emerald-50 border border-emerald-200 rounded-2xl p-4"
          >
            <div className="p-2 bg-emerald-100 rounded-xl flex-shrink-0">
              <CheckCircle2 size={20} className="text-emerald-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-emerald-800 text-sm">
                ✅ {waReadyOrder.name} — {waReadyOrder.garment} is Ready!
              </p>
              <p className="text-xs text-emerald-700 mt-0.5">Notify customer via WhatsApp</p>
            </div>
            {(() => {
              const isExpired = subscriptionExpiresAt ? new Date(subscriptionExpiresAt) < new Date() : true;
              const activeTier = isExpired ? "free" : (subscriptionTier || "free");
              const isWhatsAppBlocked = activeTier === "free";

              if (!waReadyOrder.phone) {
                return <span className="text-xs text-slate-400 font-semibold">No phone on file</span>;
              }

              if (isWhatsAppBlocked) {
                return (
                  <button
                    onClick={() => {
                      toast.error("مفت پلان پر واٹس ایپ الرٹس کی سہولت میسر نہیں ہے۔ براہ کرم اپنا سبسکرپشن پلان اپگریڈ کریں۔", {
                        description: "WhatsApp alerts are not available on the Free Plan. Please upgrade to Starter or Premium."
                      });
                    }}
                    className="flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 border border-slate-250 text-slate-500 font-bold text-xs px-3 py-1.5 rounded-xl transition-all flex-shrink-0 cursor-pointer"
                  >
                    <Lock size={12} />
                    <span>WhatsApp Locked</span>
                  </button>
                );
              }

              return (
                <a
                  href={`https://wa.me/${formatWhatsAppPhone(waReadyOrder.phone)}?text=${encodeURIComponent(
                    `السلام و علیکم ${waReadyOrder.name} صاحب/صاحبہ،\n\nآپ کا ${waReadyOrder.garment} تیار ہو گیا ہے۔ براہ کرم دکان سے لے جائیں۔\n\nشکریہ 🙏\n– ${shopName || "Your Tailor"}`
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-4 py-2 rounded-xl shadow transition-all flex-shrink-0"
                >
                  <MessageCircle size={14} />
                  Send WhatsApp
                </a>
              );
            })()}
            <button onClick={() => setShowWAReadyBanner(false)} className="text-slate-400 hover:text-slate-600 flex-shrink-0">
              <X size={16} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-black tracking-tight text-slate-900 flex items-center gap-2">
            <Scissors className="text-indigo-600 animate-pulse" />
            Stitching & Tailoring Orders (سلائی آرڈرز)
          </h2>
          
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input 
              placeholder="Search customer/karigar..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 w-[250px] bg-white border-slate-200"
            />
          </div>
          <Button onClick={handleOpenAddModal} className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-md cursor-pointer">
            <PlusCircle className="mr-2 h-4 w-4" /> Book Stitching Order (نیا آرڈر)
          </Button>
        </div>
      </div>

      {/* Orders Table Container */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden space-y-0">
        
        {/* Navigation Tabs Bar: Active vs Delivered History */}
        <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-slate-50/80 border-b border-slate-150">
          <div className="flex items-center gap-2 bg-slate-200/70 p-1 rounded-2xl">
            <button
              onClick={() => setActiveTab("active")}
              className={`px-4 py-2 text-xs font-black rounded-xl transition-all cursor-pointer flex items-center gap-2 ${
                activeTab === "active" 
                  ? "bg-white text-indigo-700 shadow-sm" 
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Scissors size={14} /> Active Orders (ایکٹیو آرڈرز)
              <span className="bg-indigo-100 text-indigo-800 text-[10px] font-black px-2 py-0.5 rounded-full">
                {activeOrdersCount}
              </span>
            </button>

            <button
              onClick={() => setActiveTab("delivered")}
              className={`px-4 py-2 text-xs font-black rounded-xl transition-all cursor-pointer flex items-center gap-2 ${
                activeTab === "delivered" 
                  ? "bg-white text-emerald-700 shadow-sm" 
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <CheckCircle2 size={14} className="text-emerald-600" /> Delivered Orders History (ڈیلیور شدہ آرڈرز)
              <span className="bg-emerald-100 text-emerald-800 text-[10px] font-black px-2 py-0.5 rounded-full">
                {deliveredOrdersCount}
              </span>
            </button>

            <button
              onClick={() => setActiveTab("all")}
              className={`px-4 py-2 text-xs font-black rounded-xl transition-all cursor-pointer flex items-center gap-2 ${
                activeTab === "all" 
                  ? "bg-white text-slate-900 shadow-sm" 
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              All Orders (تمام آرڈرز)
              <span className="bg-slate-200 text-slate-800 text-[10px] font-black px-2 py-0.5 rounded-full">
                {orders.length}
              </span>
            </button>
          </div>

          <p className="text-[11px] text-slate-500 font-semibold px-2">
            {activeTab === "active" && "Showing current active suits in production."}
            {activeTab === "delivered" && "Showing history of completed & delivered customer suits."}
            {activeTab === "all" && "Showing complete stitching order archives."}
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 text-slate-400 font-black border-b border-slate-150 uppercase tracking-wider text-[9px]">
              <tr>
                <th className="px-6 py-4">Customer Name</th>
                <th className="px-6 py-4">Garment/Fabric</th>
                <th className="px-6 py-4">Assigned Karigar</th>
                <th className="px-6 py-4">Delivery Date</th>
                <th className="px-6 py-4 text-right">Bill Total</th>
                <th className="px-6 py-4 text-right">Advance Paid</th>
                <th className="px-6 py-4 text-center">Status</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-semibold">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-6 py-10 text-center text-slate-400">Loading stitching orders...</td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-slate-400">
                    No stitching orders booked yet.
                  </td>
                </tr>
              ) : (
                filtered.map((order) => (
                  <tr key={order.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-extrabold text-slate-800">{getCustomerName(order.customers)}</div>
                      <div className="text-[10px] text-slate-400 font-mono mt-0.5">{order.customers?.phone || ""}</div>
                    </td>
                    <td className="px-6 py-4 text-xs font-medium">
                      <span className="font-extrabold text-slate-700 block">{order.garment_type || "Suit"}</span>
                      <span className="text-slate-450 text-[10px] block mt-0.5">{order.fabric || "Custom Fabric"}</span>
                    </td>
                    <td className="px-6 py-4">
                      {getKarigarName(order.karigars) ? (
                        <div>
                          <span className="font-extrabold text-slate-750 block">{getKarigarName(order.karigars)}</span>
                          <span className="text-[10px] text-indigo-500 font-mono block">Wage: Rs {order.karigar_wage}</span>
                        </div>
                      ) : (
                        <span className="text-[10px] text-rose-500 font-black uppercase bg-rose-50 border border-rose-100 px-2 py-0.5 rounded-md">Unassigned</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-slate-550 text-xs">
                      <div className="flex items-center gap-1.5 font-mono">
                        <Calendar size={13} className="text-slate-400" />
                        <span>{new Date(order.delivery_date).toLocaleDateString("en-PK", { day: "2-digit", month: "short", year: "numeric" })}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right font-black text-slate-800">Rs {order.total_amount}</td>
                    <td className="px-6 py-4 text-right text-emerald-650 font-extrabold">Rs {order.advance_payment || 0}</td>
                    <td className="px-6 py-4 text-center">
                      <select
                        value={order.status}
                        onChange={(e) => handleStatusChange(order, e.target.value as any)}
                        className={`text-xs font-black border rounded-lg px-2 py-1 focus:outline-none cursor-pointer ${
                          order.status === "delivered" || order.status === "completed"
                            ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                            : order.status === "stitching" || order.status === "cutting"
                              ? "bg-blue-50 border-blue-200 text-blue-800"
                              : "bg-amber-50 border-amber-200 text-amber-800"
                        }`}
                      >
                        <option value="pending">Pending</option>
                        <option value="cutting">Cutting</option>
                        <option value="stitching">Stitching</option>
                        <option value="completed">Completed</option>
                        <option value="delivered">Delivered</option>
                      </select>
                    </td>
                    <td className="px-6 py-4 text-right space-x-1 whitespace-nowrap">
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => handlePrintReceipt(order)}
                        className="text-slate-500 hover:text-indigo-650 hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors p-2 cursor-pointer"
                        title="Print Receipt"
                      >
                        <Printer className="h-4 w-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => handleOpenEditModal(order)}
                        className="text-slate-500 hover:text-blue-600 hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors p-2 cursor-pointer"
                        title="Edit Order"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => handleDelete(order.id)}
                        className="text-slate-500 hover:text-red-650 hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors p-2 cursor-pointer"
                        title="Delete Order"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Add/Edit Order */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-start justify-center p-4 md:p-10 overflow-y-auto">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-xs"
              onClick={() => setIsModalOpen(false)}
            />
            
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl shadow-2xl p-6 w-full max-w-2xl relative z-10 my-auto max-h-[90vh] flex flex-col"
            >
              <div className="flex items-center justify-between mb-4 border-b pb-3">
                <h3 className="font-extrabold text-slate-850 text-base">
                  {editingOrder ? "Modify Stitching Order (آرڈر میں ترمیم)" : "Book Stitching Order (سلائی آرڈر بک کریں)"}
                </h3>
                <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                  <X size={18} />
                </button>
              </div>

              <div className="space-y-4 overflow-y-auto pr-1.5 flex-1 custom-scrollbar">
                
                {/* 1. Client & Karigar Details */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <div className="flex justify-between items-center mb-1.5">
                      <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider">Customer Name (گاہک کا نام)</label>
                      {!editingOrder && (
                        <button
                          type="button"
                          onClick={() => setShowQuickAddCustomer(!showQuickAddCustomer)}
                          className="text-[10px] text-indigo-650 hover:underline font-black cursor-pointer bg-transparent border-none"
                        >
                          {showQuickAddCustomer ? "Cancel (منسوخ کریں)" : "+ Register New (نیا گاہک)"}
                        </button>
                      )}
                    </div>

                    {showQuickAddCustomer ? (
                      <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-3.5 space-y-3 mb-2.5 animate-in slide-in-from-top-3 duration-200">
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-[9px] font-black text-slate-450 uppercase mb-1">Name (نام) *</label>
                            <Input 
                              value={quickCustomerName}
                              onChange={(e) => setQuickCustomerName(e.target.value)}
                              placeholder="Customer Name"
                              className="bg-white h-9 text-xs"
                            />
                          </div>
                          <div>
                            <label className="block text-[9px] font-black text-slate-450 uppercase mb-1">Phone (موبائل نمبر)</label>
                            <Input 
                              value={quickCustomerPhone}
                              onChange={(e) => setQuickCustomerPhone(e.target.value)}
                              placeholder="03xxxxxxxxx"
                              className="bg-white h-9 text-xs"
                            />
                          </div>
                        </div>
                        <Button
                          type="button"
                          disabled={quickCustomerLoading}
                          onClick={handleQuickAddCustomer}
                          className="w-full bg-indigo-600 hover:bg-indigo-755 text-white font-bold h-9 text-xs cursor-pointer"
                        >
                          {quickCustomerLoading ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : "Save Customer (گاہک محفوظ کریں)"}
                        </Button>
                      </div>
                    ) : (
                      <select
                        value={formData.customer_id}
                        onChange={(e) => setFormData({...formData, customer_id: e.target.value})}
                        className="w-full bg-white border border-slate-200 h-10 rounded-lg px-3 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        disabled={!!editingOrder}
                      >
                        {customers.map(c => (
                          <option key={c.id} value={c.id}>{c.name} {c.phone ? `(${c.phone})` : ""}</option>
                        ))}
                      </select>
                    )}
                  </div>

                  <div>
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1.5">Assign Karigar (کاریگر تفویض کریں)</label>
                    <select
                      value={formData.karigar_id}
                      onChange={(e) => setFormData({...formData, karigar_id: e.target.value})}
                      className="w-full bg-white border border-slate-200 h-10 rounded-lg px-3 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    >
                      <option value="">Unassigned (تفویض نہیں کیا)</option>
                      {karigars.map(k => (
                        <option key={k.id} value={k.id}>{k.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* 2. Garment Details */}
                <div className="p-4 bg-slate-50 border border-slate-200/60 rounded-2xl space-y-4">
                  <span className="text-[10px] font-black text-indigo-650 uppercase tracking-widest block flex items-center gap-1.5">
                    <Layers size={12} /> Garment & Style Details (کپڑے اور سلائی کی تفصیل)
                  </span>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">Garment Type (کپڑے کی قسم)</label>
                      <Input 
                        value={formData.garment_type} 
                        onChange={(e) => setFormData({...formData, garment_type: e.target.value})}
                        placeholder="Shalwar Kameez, Kurta, Coat"
                        className="bg-white h-9 text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">Fabric details (کپڑے کی تفصیل)</label>
                      <Input 
                        value={formData.fabric} 
                        onChange={(e) => setFormData({...formData, fabric: e.target.value})}
                        placeholder="Cotton, Wash & Wear"
                        className="bg-white h-9 text-xs"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">
                      Special Instructions & Design Details (خاص ہدایات / ڈیزائن کی تفصیلات)
                    </label>
                    <textarea 
                      placeholder="e.g. Ban collar 1.25 inch, 2 side pockets, straight daman, cuff with double button, embroidery details..."
                      value={formData.design_style} 
                      onChange={(e) => setFormData({...formData, design_style: e.target.value})}
                      className="w-full text-xs font-semibold bg-white border border-slate-200 rounded-xl px-3 py-2 focus:outline-none min-h-[60px] focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 border-t border-slate-200/60">
                    <div>
                      <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">
                        Suit Tag Code / Custom Code (سوٹ کا نمبر / ٹیگ کوڈ - اختیاری)
                      </label>
                      <Input 
                        value={formData.suit_code || ""} 
                        onChange={(e) => setFormData({...formData, suit_code: e.target.value})}
                        placeholder="e.g. Tag #104, #A-12"
                        className="bg-white h-9 text-xs font-mono font-bold"
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">
                        Suit Photo / Fabric Reference (سوٹ کی تصویر - اختیاری)
                      </label>
                      <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl p-1.5 h-9">
                        {formData.suit_image_url ? (
                          <div className="flex items-center justify-between w-full">
                            <span className="text-[10px] text-emerald-600 font-bold truncate max-w-[140px]">✓ Photo Attached</span>
                            <button
                              type="button"
                              onClick={() => setFormData(prev => ({ ...prev, suit_image_url: "" }))}
                              className="text-[9px] text-rose-500 hover:underline font-bold"
                            >
                              Remove
                            </button>
                          </div>
                        ) : (
                          <input 
                            type="file" 
                            accept="image/*" 
                            onChange={handleSuitFileChange}
                            className="text-[10px] w-full file:mr-2 file:py-0.5 file:px-2 file:rounded-lg file:border-0 file:text-[9px] file:font-black file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 cursor-pointer"
                          />
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* 3. Measurements Form Grid */}
                <div className="p-4 bg-slate-50 border border-slate-200/60 rounded-2xl space-y-3">
                  <span className="text-[10px] font-black text-indigo-650 uppercase tracking-widest block flex items-center gap-1.5">
                    <Scissors size={12} /> Custom Sizes for this Order (پیمائش سائز)
                  </span>

                  <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                    <div>
                      <label className="block text-[8px] font-bold text-slate-400 uppercase text-center mb-0.5">Length</label>
                      <Input 
                        type="number" 
                        value={orderMeasurement.length || ""} 
                        onChange={(e) => setOrderMeasurement({...orderMeasurement, length: parseFloat(e.target.value) || 0})}
                        className="bg-white text-center font-mono h-8 text-xs p-1"
                      />
                    </div>
                    <div>
                      <label className="block text-[8px] font-bold text-slate-400 uppercase text-center mb-0.5">Chest</label>
                      <Input 
                        type="number" 
                        value={orderMeasurement.chest || ""} 
                        onChange={(e) => setOrderMeasurement({...orderMeasurement, chest: parseFloat(e.target.value) || 0})}
                        className="bg-white text-center font-mono h-8 text-xs p-1"
                      />
                    </div>
                    <div>
                      <label className="block text-[8px] font-bold text-slate-400 uppercase text-center mb-0.5">Waist</label>
                      <Input 
                        type="number" 
                        value={orderMeasurement.waist || ""} 
                        onChange={(e) => setOrderMeasurement({...orderMeasurement, waist: parseFloat(e.target.value) || 0})}
                        className="bg-white text-center font-mono h-8 text-xs p-1"
                      />
                    </div>
                    <div>
                      <label className="block text-[8px] font-bold text-slate-400 uppercase text-center mb-0.5">Shoulder</label>
                      <Input 
                        type="number" 
                        value={orderMeasurement.shoulder || ""} 
                        onChange={(e) => setOrderMeasurement({...orderMeasurement, shoulder: parseFloat(e.target.value) || 0})}
                        className="bg-white text-center font-mono h-8 text-xs p-1"
                      />
                    </div>
                    <div>
                      <label className="block text-[8px] font-bold text-slate-400 uppercase text-center mb-0.5">Collar</label>
                      <Input 
                        type="number" 
                        value={orderMeasurement.collar || ""} 
                        onChange={(e) => setOrderMeasurement({...orderMeasurement, collar: parseFloat(e.target.value) || 0})}
                        className="bg-white text-center font-mono h-8 text-xs p-1"
                      />
                    </div>
                    <div>
                      <label className="block text-[8px] font-bold text-slate-400 uppercase text-center mb-0.5">Shalwar</label>
                      <Input 
                        type="number" 
                        value={orderMeasurement.shalwar || ""} 
                        onChange={(e) => setOrderMeasurement({...orderMeasurement, shalwar: parseFloat(e.target.value) || 0})}
                        className="bg-white text-center font-mono h-8 text-xs p-1"
                      />
                    </div>
                    <div>
                      <label className="block text-[8px] font-bold text-slate-400 uppercase text-center mb-0.5">Paincha</label>
                      <Input 
                        type="number" 
                        value={orderMeasurement.paincha || ""} 
                        onChange={(e) => setOrderMeasurement({...orderMeasurement, paincha: parseFloat(e.target.value) || 0})}
                        className="bg-white text-center font-mono h-8 text-xs p-1"
                      />
                    </div>
                    <div>
                      <label className="block text-[8px] font-bold text-slate-400 uppercase text-center mb-0.5">Teera</label>
                      <Input 
                        type="number" 
                        value={orderMeasurement.teera || ""} 
                        onChange={(e) => setOrderMeasurement({...orderMeasurement, teera: parseFloat(e.target.value) || 0})}
                        className="bg-white text-center font-mono h-8 text-xs p-1"
                      />
                    </div>
                    <div>
                      <label className="block text-[8px] font-bold text-slate-400 uppercase text-center mb-0.5">Big Teera</label>
                      <Input 
                        type="number" 
                        value={orderMeasurement.big_teera || ""} 
                        onChange={(e) => setOrderMeasurement({...orderMeasurement, big_teera: parseFloat(e.target.value) || 0})}
                        className="bg-white text-center font-mono h-8 text-xs p-1"
                      />
                    </div>
                  </div>

                  {/* Custom Measurements Section in Order Modal */}
                  <div className="pt-2 border-t border-slate-200/60 space-y-2">
                    <div className="flex justify-between items-center">
                      <label className="block text-[9px] font-black text-indigo-700 uppercase tracking-wider">
                        Custom Measurements (مزید کسٹم پیمائشیں e.g. آستین، کاف، گلا)
                      </label>
                      <button
                        type="button"
                        onClick={handleAddOrderCustomField}
                        className="text-[9px] bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold px-2 py-0.5 rounded-lg border border-indigo-200/80 cursor-pointer flex items-center gap-1 transition-colors"
                      >
                        <PlusCircle size={11} /> Add Field (پیمائش شامل کریں)
                      </button>
                    </div>

                    {orderCustomFields.length === 0 ? (
                      <p className="text-[10px] text-slate-400 italic text-center py-0.5">
                        کوئی کسٹم پیمائش شامل نہیں ہے۔ (اگر آستین، کاف یا دیگر سائز جوڑنا ہو تو Add Field پر کلک کریں)
                      </p>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-36 overflow-y-auto pr-1">
                        {orderCustomFields.map((field, idx) => (
                          <div key={idx} className="flex items-center gap-1.5 bg-white p-1.5 rounded-xl border border-slate-200">
                            <Input
                              placeholder="نام (e.g. Aasteen / Cuff)"
                              value={field.name}
                              onChange={(e) => handleOrderCustomFieldChange(idx, "name", e.target.value)}
                              className="bg-white text-xs h-7 flex-1"
                            />
                            <Input
                              placeholder="پیمائش (e.g. 24.5)"
                              value={field.value}
                              onChange={(e) => handleOrderCustomFieldChange(idx, "value", e.target.value)}
                              className="bg-white text-xs h-7 w-20 text-center font-mono"
                            />
                            <button
                              type="button"
                              onClick={() => handleRemoveOrderCustomField(idx)}
                              className="text-rose-400 hover:text-rose-600 p-1 rounded hover:bg-rose-50 cursor-pointer"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* 4. Scheduling & Financials */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1.5">Delivery Date (تاریخ واپسی)</label>
                    <Input 
                      type="date" 
                      value={formData.delivery_date} 
                      onChange={(e) => setFormData({...formData, delivery_date: e.target.value})}
                      className="h-10 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1.5">Stitching Stage Status</label>
                    <select
                      value={formData.status}
                      onChange={(e) => setFormData({...formData, status: e.target.value as any})}
                      className="w-full bg-white border border-slate-200 h-10 rounded-lg px-3 text-xs focus:outline-none cursor-pointer text-slate-700"
                    >
                      <option value="pending">Pending (التواء)</option>
                      <option value="cutting">Cutting (کٹائی)</option>
                      <option value="stitching">Stitching (سلائی)</option>
                      <option value="completed">Completed (تیار)</option>
                      <option value="delivered">Delivered (کپڑے دے دئیے)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1.5">Payment Status</label>
                    <select
                      value={formData.payment_status}
                      onChange={(e) => setFormData({...formData, payment_status: e.target.value as any})}
                      className="w-full bg-white border border-slate-200 h-10 rounded-lg px-3 text-xs focus:outline-none cursor-pointer text-slate-700"
                    >
                      <option value="unpaid">Unpaid (بقایا ہے)</option>
                      <option value="partial">Partial Advance (ایڈوانس ملا ہے)</option>
                      <option value="paid">Fully Paid (مکمل وصول)</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">Total Bill / Rate (Rs)</label>
                    <Input 
                      type="number" 
                      value={formData.total_amount || ""} 
                      onChange={(e) => setFormData({...formData, total_amount: parseFloat(e.target.value) || 0})}
                      className="h-10 text-xs font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">Advance Payment (Rs)</label>
                    <Input 
                      type="number" 
                      value={formData.advance_payment || ""} 
                      onChange={(e) => setFormData({...formData, advance_payment: parseFloat(e.target.value) || 0})}
                      className="h-10 text-xs font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">Karigar Stitching Wage (Rs)</label>
                    <Input 
                      type="number" 
                      value={formData.karigar_wage || ""} 
                      onChange={(e) => setFormData({...formData, karigar_wage: parseFloat(e.target.value) || 0})}
                      className="h-10 text-xs font-mono"
                    />
                  </div>
                </div>

                <div className="pt-3 border-t flex items-center justify-between text-xs font-mono font-bold text-slate-650 bg-slate-50 p-3 rounded-xl border">
                  <span>BILL SUMMARY:</span>
                  <div className="space-x-4">
                    <span>Rate: Rs {formData.total_amount}</span>
                    <span>Advance: Rs {formData.advance_payment}</span>
                    <span className="text-indigo-650 font-black">Due: Rs {(formData.total_amount - formData.advance_payment)}</span>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-200 bg-white sticky bottom-0 z-20 mt-4">
                  <Button 
                    onClick={handleSaveOrder} 
                    disabled={isSubmitting} 
                    className="w-full bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-black h-12 text-sm rounded-2xl shadow-lg cursor-pointer transition-all flex items-center justify-center gap-2"
                  >
                    {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    {editingOrder ? "Update Stitching Order (آرڈر اپڈیٹ کریں)" : "Confirm & Save Stitching Order (سلائی آرڈر محفوظ کریں)"}
                  </Button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal: Delivery Payment Confirmation */}
      <AnimatePresence>
        {isDeliveryModalOpen && deliveryConfirmOrder && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl shadow-2xl p-6 w-full max-w-md relative z-10 border border-slate-150"
            >
              <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-100">
                <h3 className="font-extrabold text-slate-850 text-base">
                  Order Delivery Payment (ادائیگی کا انتخاب)
                </h3>
                <button 
                  onClick={() => {
                    setIsDeliveryModalOpen(false);
                    setDeliveryConfirmOrder(null);
                  }} 
                  className="text-slate-400 hover:text-slate-650 cursor-pointer bg-transparent border-none"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="space-y-4">
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-amber-900 text-xs font-semibold space-y-1">
                  <p>Customer: <span className="font-black text-slate-800">{getCustomerName(deliveryConfirmOrder.customers)}</span></p>
                  <p>Total Bill: <span className="font-black text-slate-800">Rs {deliveryConfirmOrder.total_amount}</span></p>
                  <p>Advance Paid: <span className="font-black text-slate-800">Rs {deliveryConfirmOrder.advance_payment}</span></p>
                  <div className="border-t border-amber-200 pt-1.5 mt-1.5 flex justify-between text-sm">
                    <span>Remaining Balance (بقایا رقم):</span>
                    <span className="font-black text-indigo-750">Rs {Number(deliveryConfirmOrder.total_amount) - Number(deliveryConfirmOrder.advance_payment)}</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="block text-xs font-black text-slate-650 uppercase tracking-wider">
                    Cash Received Now (وصول ہونے والی نقد رقم)
                  </label>
                  <Input 
                    type="number"
                    min="0"
                    max={Number(deliveryConfirmOrder.total_amount) - Number(deliveryConfirmOrder.advance_payment)}
                    value={cashReceivedInput}
                    onChange={(e) => {
                      const maxDue = Number(deliveryConfirmOrder.total_amount) - Number(deliveryConfirmOrder.advance_payment);
                      const val = Math.max(0, Math.min(maxDue, parseFloat(e.target.value) || 0));
                      setCashReceivedInput(val);
                    }}
                    className="font-mono text-center text-lg h-11 border-slate-200 bg-white"
                  />
                  
                  <div className="bg-slate-50 border border-slate-150 rounded-xl p-3 flex justify-between text-xs font-semibold text-slate-600">
                    <span>Add to Khata Credit (بقایا ادھار):</span>
                    <span className="font-black text-slate-800">
                      Rs {Math.max(0, (Number(deliveryConfirmOrder.total_amount) - Number(deliveryConfirmOrder.advance_payment)) - cashReceivedInput)}
                    </span>
                  </div>
                </div>

                <div className="pt-2">
                  <Button
                    type="button"
                    disabled={deliveryProcessing}
                    onClick={handleConfirmDelivery}
                    className="w-full bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-extrabold h-12 text-xs cursor-pointer flex flex-col justify-center items-center py-2 shadow-md rounded-2xl"
                  >
                    <span>Confirm Delivery & Payment</span>
                    <span className="text-[10px] opacity-90 font-normal">(ڈلیوری اور ادائیگی محفوظ کریں)</span>
                  </Button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal: Suit Expense Input */}
      <AnimatePresence>
        {isExpenseModalOpen && expenseConfirmOrder && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl shadow-2xl p-6 w-full max-w-sm relative z-10 border border-slate-150"
            >
              <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-100">
                <h3 className="font-extrabold text-slate-850 text-base">
                  Stitching Expense (اضافی اخراجات)
                </h3>
                <button 
                  onClick={() => {
                    setIsExpenseModalOpen(false);
                    setExpenseConfirmOrder(null);
                  }} 
                  className="text-slate-400 hover:text-slate-650 cursor-pointer bg-transparent border-none"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="space-y-4">
                <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 text-blue-900 text-xs font-semibold space-y-1">
                  <p>Customer: <span className="font-black text-slate-800">{getCustomerName(expenseConfirmOrder.customers)}</span></p>
                  <p>Garment Type: <span className="font-black text-slate-800">{expenseConfirmOrder.garment_type}</span></p>
                  <p>Fabric: <span className="font-black text-slate-800">{expenseConfirmOrder.fabric || "N/A"}</span></p>
                </div>

                <div className="space-y-2">
                  <label className="block text-xs font-black text-slate-650 uppercase tracking-wider">
                    Suit Accessories/Material Expense (سوٹ پر ہونے والے اخراجات)
                  </label>
                  <Input 
                    type="number"
                    min="0"
                    placeholder="e.g. Buttons, thread, lining cost"
                    value={suitExpenseInput}
                    onChange={(e) => setSuitExpenseInput(Math.max(0, parseFloat(e.target.value) || 0))}
                    className="font-mono text-center text-lg h-11 border-slate-200 bg-white"
                  />
                  <p className="text-[10px] text-slate-400 text-center leading-relaxed">
                    Enter any material/accessories expenses incurred on this suit (excluding Karigar wage).
                  </p>
                </div>

                <div className="pt-2">
                  <Button
                    type="button"
                    disabled={expenseProcessing}
                    onClick={handleConfirmExpense}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-extrabold h-11 text-xs cursor-pointer flex flex-col justify-center items-center py-2"
                  >
                    <span>Save & Mark Completed</span>
                    <span className="text-[10px] opacity-90 font-normal">(اخراجات محفوظ کر کے تیار مارک کریں)</span>
                  </Button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
