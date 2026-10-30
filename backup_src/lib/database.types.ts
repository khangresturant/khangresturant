export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      audit_logs: {
        Row: {
          action: string
          created_at: string | null
          details: Json | null
          id: string
          ip_address: string | null
          shop_id: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string | null
          details?: Json | null
          id?: string
          ip_address?: string | null
          shop_id?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string | null
          details?: Json | null
          id?: string
          ip_address?: string | null
          shop_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          name: string
          shop_id: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          name: string
          shop_id?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          name?: string
          shop_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "categories_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      company_details: {
        Row: {
          address: string | null
          created_at: string | null
          email: string | null
          id: string
          logo_path: string | null
          name: string
          phone: string | null
          shop_id: string | null
          website: string | null
        }
        Insert: {
          address?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          logo_path?: string | null
          name: string
          phone?: string | null
          shop_id?: string | null
          website?: string | null
        }
        Update: {
          address?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          logo_path?: string | null
          name?: string
          phone?: string | null
          shop_id?: string | null
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "company_details_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_transactions: {
        Row: {
          amount: number
          created_at: string | null
          customer_id: string | null
          id: string
          remarks: string | null
          shop_id: string | null
          transaction_type: string | null
        }
        Insert: {
          amount: number
          created_at?: string | null
          customer_id?: string | null
          id?: string
          remarks?: string | null
          shop_id?: string | null
          transaction_type?: string | null
        }
        Update: {
          amount?: number
          created_at?: string | null
          customer_id?: string | null
          id?: string
          remarks?: string | null
          shop_id?: string | null
          transaction_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "credit_transactions_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_transactions_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          created_at: string | null
          credit_limit: number | null
          current_credit: number | null
          id: string
          name: string
          phone: string | null
          shop_id: string | null
        }
        Insert: {
          created_at?: string | null
          credit_limit?: number | null
          current_credit?: number | null
          id?: string
          name: string
          phone?: string | null
          shop_id?: string | null
        }
        Update: {
          created_at?: string | null
          credit_limit?: number | null
          current_credit?: number | null
          id?: string
          name?: string
          phone?: string | null
          shop_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customers_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      emi_schedules: {
        Row: {
          created_at: string | null
          due_date: string
          id: string
          installment_amount: number
          invoice_id: string | null
          late_fee: number | null
          status: string | null
        }
        Insert: {
          created_at?: string | null
          due_date: string
          id?: string
          installment_amount: number
          invoice_id?: string | null
          late_fee?: number | null
          status?: string | null
        }
        Update: {
          created_at?: string | null
          due_date?: string
          id?: string
          installment_amount?: number
          invoice_id?: string | null
          late_fee?: number | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "emi_schedules_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      expenses: {
        Row: {
          amount: number
          created_at: string | null
          expense_type: string | null
          id: string
          name: string
          register_session_id: string | null
          remarks: string | null
          shop_id: string | null
          user_id: string | null
        }
        Insert: {
          amount: number
          created_at?: string | null
          expense_type?: string | null
          id?: string
          name: string
          register_session_id?: string | null
          remarks?: string | null
          shop_id?: string | null
          user_id?: string | null
        }
        Update: {
          amount?: number
          created_at?: string | null
          expense_type?: string | null
          id?: string
          name?: string
          register_session_id?: string | null
          remarks?: string | null
          shop_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "expenses_register_session_id_fkey"
            columns: ["register_session_id"]
            isOneToOne: false
            referencedRelation: "register_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      formulations: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          name: string
          shop_id: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          name: string
          shop_id?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          name?: string
          shop_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "formulations_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      fuel_pumps: {
        Row: {
          created_at: string | null
          id: string
          nozzle_name: string
          shop_id: string | null
          tank_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          nozzle_name: string
          shop_id?: string | null
          tank_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          nozzle_name?: string
          shop_id?: string | null
          tank_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fuel_pumps_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fuel_pumps_tank_id_fkey"
            columns: ["tank_id"]
            isOneToOne: false
            referencedRelation: "fuel_tanks"
            referencedColumns: ["id"]
          },
        ]
      }
      fuel_shift_readings: {
        Row: {
          cash_collected: number | null
          closing_reading: number | null
          created_at: string | null
          fuel_type: string | null
          id: string
          nozzle_number: number
          opening_reading: number
          shift_date: string
          shop_id: string | null
          shortage_amount: number | null
          user_id: string | null
        }
        Insert: {
          cash_collected?: number | null
          closing_reading?: number | null
          created_at?: string | null
          fuel_type?: string | null
          id?: string
          nozzle_number: number
          opening_reading: number
          shift_date: string
          shop_id?: string | null
          shortage_amount?: number | null
          user_id?: string | null
        }
        Update: {
          cash_collected?: number | null
          closing_reading?: number | null
          created_at?: string | null
          fuel_type?: string | null
          id?: string
          nozzle_number?: number
          opening_reading?: number
          shift_date?: string
          shop_id?: string | null
          shortage_amount?: number | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fuel_shift_readings_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fuel_shift_readings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      fuel_tanks: {
        Row: {
          capacity: number
          created_at: string | null
          current_dip: number | null
          fuel_type: string
          id: string
          shop_id: string | null
        }
        Insert: {
          capacity: number
          created_at?: string | null
          current_dip?: number | null
          fuel_type: string
          id?: string
          shop_id?: string | null
        }
        Update: {
          capacity?: number
          created_at?: string | null
          current_dip?: number | null
          fuel_type?: string
          id?: string
          shop_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fuel_tanks_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      gift_card_transactions: {
        Row: {
          amount: number
          created_at: string | null
          gift_card_id: string | null
          id: string
          transaction_type: string
        }
        Insert: {
          amount: number
          created_at?: string | null
          gift_card_id?: string | null
          id?: string
          transaction_type: string
        }
        Update: {
          amount?: number
          created_at?: string | null
          gift_card_id?: string | null
          id?: string
          transaction_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "gift_card_transactions_gift_card_id_fkey"
            columns: ["gift_card_id"]
            isOneToOne: false
            referencedRelation: "gift_cards"
            referencedColumns: ["id"]
          },
        ]
      }
      gift_cards: {
        Row: {
          balance: number
          code: string
          created_at: string | null
          expiry_date: string | null
          id: string
          issued_by: string | null
          issued_to: string | null
          shop_id: string | null
        }
        Insert: {
          balance: number
          code: string
          created_at?: string | null
          expiry_date?: string | null
          id?: string
          issued_by?: string | null
          issued_to?: string | null
          shop_id?: string | null
        }
        Update: {
          balance?: number
          code?: string
          created_at?: string | null
          expiry_date?: string | null
          id?: string
          issued_by?: string | null
          issued_to?: string | null
          shop_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "gift_cards_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      installment_payments: {
        Row: {
          amount_paid: number
          created_at: string | null
          id: string
          payment_date: string
          plan_id: string | null
        }
        Insert: {
          amount_paid: number
          created_at?: string | null
          id?: string
          payment_date: string
          plan_id?: string | null
        }
        Update: {
          amount_paid?: number
          created_at?: string | null
          id?: string
          payment_date?: string
          plan_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "installment_payments_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "installment_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      installment_plans: {
        Row: {
          created_at: string | null
          customer_id: string | null
          down_payment: number
          id: string
          installment_amount: number
          sale_id: string | null
          shop_id: string | null
          status: string | null
          total_installments: number
        }
        Insert: {
          created_at?: string | null
          customer_id?: string | null
          down_payment: number
          id?: string
          installment_amount: number
          sale_id?: string | null
          shop_id?: string | null
          status?: string | null
          total_installments: number
        }
        Update: {
          created_at?: string | null
          customer_id?: string | null
          down_payment?: number
          id?: string
          installment_amount?: number
          sale_id?: string | null
          shop_id?: string | null
          status?: string | null
          total_installments?: number
        }
        Relationships: [
          {
            foreignKeyName: "installment_plans_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "installment_plans_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "installment_plans_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_items: {
        Row: {
          id: string
          invoice_id: string | null
          product_id: string | null
          quantity: number
          subtotal: number
          unit_price: number
        }
        Insert: {
          id?: string
          invoice_id?: string | null
          product_id?: string | null
          quantity: number
          subtotal: number
          unit_price: number
        }
        Update: {
          id?: string
          invoice_id?: string | null
          product_id?: string | null
          quantity?: number
          subtotal?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoice_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          created_at: string | null
          discount: number | null
          id: string
          party_id: string | null
          shop_id: string | null
          status: string | null
          tax_amount: number | null
          total_amount: number
        }
        Insert: {
          created_at?: string | null
          discount?: number | null
          id?: string
          party_id?: string | null
          shop_id?: string | null
          status?: string | null
          tax_amount?: number | null
          total_amount: number
        }
        Update: {
          created_at?: string | null
          discount?: number | null
          id?: string
          party_id?: string | null
          shop_id?: string | null
          status?: string | null
          tax_amount?: number | null
          total_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoices_party_id_fkey"
            columns: ["party_id"]
            isOneToOne: false
            referencedRelation: "parties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      karigars: {
        Row: {
          balance: number | null
          created_at: string | null
          id: string
          name: string
          phone: string | null
          shop_id: string | null
        }
        Insert: {
          balance?: number | null
          created_at?: string | null
          id?: string
          name: string
          phone?: string | null
          shop_id?: string | null
        }
        Update: {
          balance?: number | null
          created_at?: string | null
          id?: string
          name?: string
          phone?: string | null
          shop_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "karigars_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      parties: {
        Row: {
          created_at: string | null
          current_balance: number | null
          id: string
          name: string
          phone: string | null
          shop_id: string | null
          type: string | null
        }
        Insert: {
          created_at?: string | null
          current_balance?: number | null
          id?: string
          name: string
          phone?: string | null
          shop_id?: string | null
          type?: string | null
        }
        Update: {
          created_at?: string | null
          current_balance?: number | null
          id?: string
          name?: string
          phone?: string | null
          shop_id?: string | null
          type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "parties_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      pending_payments: {
        Row: {
          amount: number
          created_at: string | null
          customer_id: string | null
          due_date: string | null
          id: string
          shop_id: string | null
          status: string | null
        }
        Insert: {
          amount: number
          created_at?: string | null
          customer_id?: string | null
          due_date?: string | null
          id?: string
          shop_id?: string | null
          status?: string | null
        }
        Update: {
          amount?: number
          created_at?: string | null
          customer_id?: string | null
          due_date?: string | null
          id?: string
          shop_id?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pending_payments_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pending_payments_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      print_settings: {
        Row: {
          created_at: string | null
          id: string
          receipt_font: string | null
          receipt_font_size: number | null
          receipt_page_size: string | null
          shop_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          receipt_font?: string | null
          receipt_font_size?: number | null
          receipt_page_size?: string | null
          shop_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          receipt_font?: string | null
          receipt_font_size?: number | null
          receipt_page_size?: string | null
          shop_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "print_settings_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      product_barcodes: {
        Row: {
          barcode: string
          created_at: string | null
          id: string
          pack_type: string | null
          product_id: string | null
          shop_id: string | null
          variant_id: string | null
        }
        Insert: {
          barcode: string
          created_at?: string | null
          id?: string
          pack_type?: string | null
          product_id?: string | null
          shop_id?: string | null
          variant_id?: string | null
        }
        Update: {
          barcode?: string
          created_at?: string | null
          id?: string
          pack_type?: string | null
          product_id?: string | null
          shop_id?: string | null
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_barcodes_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_barcodes_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_barcodes_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      product_variants: {
        Row: {
          created_at: string | null
          id: string
          product_id: string | null
          purchase_price: number | null
          sale_price: number | null
          shop_id: string | null
          packing_name: string
          stock_quantity: number
        }
        Insert: {
          created_at?: string | null
          id?: string
          product_id?: string | null
          purchase_price?: number | null
          sale_price?: number | null
          shop_id?: string | null
          packing_name: string
          stock_quantity?: number
        }
        Update: {
          created_at?: string | null
          id?: string
          product_id?: string | null
          purchase_price?: number | null
          sale_price?: number | null
          shop_id?: string | null
          packing_name?: string
          stock_quantity?: number
        }
        Relationships: [
          {
            foreignKeyName: "product_variants_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_variants_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          barcode: string | null
          base_price: number | null
          created_at: string | null
          current_stock: number | null
          id: string
          name: string
          shop_id: string | null
          unit: string | null
        }
        Insert: {
          barcode?: string | null
          base_price?: number | null
          created_at?: string | null
          current_stock?: number | null
          id?: string
          name: string
          shop_id?: string | null
          unit?: string | null
        }
        Update: {
          barcode?: string | null
          base_price?: number | null
          created_at?: string | null
          current_stock?: number | null
          id?: string
          name?: string
          shop_id?: string | null
          unit?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "products_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_order_items: {
        Row: {
          created_at: string | null
          id: string
          product_id: string | null
          purchase_order_id: string | null
          quantity: number
          subtotal: number
          unit_price: number
        }
        Insert: {
          created_at?: string | null
          id?: string
          product_id?: string | null
          purchase_order_id?: string | null
          quantity: number
          subtotal: number
          unit_price: number
        }
        Update: {
          created_at?: string | null
          id?: string
          product_id?: string | null
          purchase_order_id?: string | null
          quantity?: number
          subtotal?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "purchase_order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_order_items_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_orders: {
        Row: {
          created_at: string | null
          id: string
          shop_id: string | null
          status: string | null
          supplier_id: string | null
          total_amount: number
        }
        Insert: {
          created_at?: string | null
          id?: string
          shop_id?: string | null
          status?: string | null
          supplier_id?: string | null
          total_amount: number
        }
        Update: {
          created_at?: string | null
          id?: string
          shop_id?: string | null
          status?: string | null
          supplier_id?: string | null
          total_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "purchase_orders_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      register_sessions: {
        Row: {
          closed_at: string | null
          closing_balance: number | null
          id: string
          opened_at: string | null
          opening_balance: number | null
          session_type: string | null
          shop_id: string | null
          status: string | null
          user_id: string | null
        }
        Insert: {
          closed_at?: string | null
          closing_balance?: number | null
          id?: string
          opened_at?: string | null
          opening_balance?: number | null
          session_type?: string | null
          shop_id?: string | null
          status?: string | null
          user_id?: string | null
        }
        Update: {
          closed_at?: string | null
          closing_balance?: number | null
          id?: string
          opened_at?: string | null
          opening_balance?: number | null
          session_type?: string | null
          shop_id?: string | null
          status?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "register_sessions_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      repair_tickets: {
        Row: {
          created_at: string | null
          device_model: string | null
          estimated_cost: number | null
          id: string
          imei_number: string | null
          issue_description: string | null
          party_id: string | null
          shop_id: string | null
          status: string | null
        }
        Insert: {
          created_at?: string | null
          device_model?: string | null
          estimated_cost?: number | null
          id?: string
          imei_number?: string | null
          issue_description?: string | null
          party_id?: string | null
          shop_id?: string | null
          status?: string | null
        }
        Update: {
          created_at?: string | null
          device_model?: string | null
          estimated_cost?: number | null
          id?: string
          imei_number?: string | null
          issue_description?: string | null
          party_id?: string | null
          shop_id?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "repair_tickets_party_id_fkey"
            columns: ["party_id"]
            isOneToOne: false
            referencedRelation: "parties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "repair_tickets_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      sale_items: {
        Row: {
          created_at: string | null
          id: string
          product_id: string | null
          quantity: number
          sale_id: string | null
          subtotal: number
          unit_price: number
          variant_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          product_id?: string | null
          quantity: number
          sale_id?: string | null
          subtotal: number
          unit_price: number
          variant_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          product_id?: string | null
          quantity?: number
          sale_id?: string | null
          subtotal?: number
          unit_price?: number
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sale_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_items_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_items_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      sales: {
        Row: {
          created_at: string | null
          customer_name: string | null
          discount_amount: number | null
          id: string
          net_amount: number
          payment_method: string | null
          register_session_id: string | null
          shop_id: string | null
          total_amount: number
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          customer_name?: string | null
          discount_amount?: number | null
          id?: string
          net_amount: number
          payment_method?: string | null
          register_session_id?: string | null
          shop_id?: string | null
          total_amount: number
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          customer_name?: string | null
          discount_amount?: number | null
          id?: string
          net_amount?: number
          payment_method?: string | null
          register_session_id?: string | null
          shop_id?: string | null
          total_amount?: number
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sales_register_session_id_fkey"
            columns: ["register_session_id"]
            isOneToOne: false
            referencedRelation: "register_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      shelves: {
        Row: {
          created_at: string | null
          id: string
          name: string
          shop_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
          shop_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
          shop_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "shelves_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      shift_meter_readings: {
        Row: {
          closing_reading: number | null
          created_at: string | null
          id: string
          opening_reading: number
          pump_id: string | null
          register_session_id: string | null
          total_liters_sold: number | null
        }
        Insert: {
          closing_reading?: number | null
          created_at?: string | null
          id?: string
          opening_reading: number
          pump_id?: string | null
          register_session_id?: string | null
          total_liters_sold?: number | null
        }
        Update: {
          closing_reading?: number | null
          created_at?: string | null
          id?: string
          opening_reading?: number
          pump_id?: string | null
          register_session_id?: string | null
          total_liters_sold?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "shift_meter_readings_pump_id_fkey"
            columns: ["pump_id"]
            isOneToOne: false
            referencedRelation: "fuel_pumps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shift_meter_readings_register_session_id_fkey"
            columns: ["register_session_id"]
            isOneToOne: false
            referencedRelation: "register_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      shops: {
        Row: {
          allow_negative_stock: boolean | null
          created_at: string | null
          currency: string | null
          id: string
          industry_type: string
          name: string
          owner_id: string | null
          subscription_tier: string | null
        }
        Insert: {
          allow_negative_stock?: boolean | null
          created_at?: string | null
          currency?: string | null
          id?: string
          industry_type: string
          name: string
          owner_id?: string | null
          subscription_tier?: string | null
        }
        Update: {
          allow_negative_stock?: boolean | null
          created_at?: string | null
          currency?: string | null
          id?: string
          industry_type?: string
          name?: string
          owner_id?: string | null
          subscription_tier?: string | null
        }
        Relationships: []
      }
      stitching_orders: {
        Row: {
          created_at: string | null
          customer_id: string | null
          delivery_date: string | null
          id: string
          karigar_id: string | null
          karigar_wage: number
          shop_id: string | null
          status: string | null
          total_amount: number
        }
        Insert: {
          created_at?: string | null
          customer_id?: string | null
          delivery_date?: string | null
          id?: string
          karigar_id?: string | null
          karigar_wage: number
          shop_id?: string | null
          status?: string | null
          total_amount: number
        }
        Update: {
          created_at?: string | null
          customer_id?: string | null
          delivery_date?: string | null
          id?: string
          karigar_id?: string | null
          karigar_wage?: number
          shop_id?: string | null
          status?: string | null
          total_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "stitching_orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stitching_orders_karigar_id_fkey"
            columns: ["karigar_id"]
            isOneToOne: false
            referencedRelation: "karigars"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stitching_orders_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      stock: {
        Row: {
          batch_number: string | null
          created_at: string | null
          expiry_date: string | null
          id: string
          product_id: string | null
          quantity_pack: number | null
          quantity_single: number | null
          shop_id: string | null
          warehouse_id: string | null
        }
        Insert: {
          batch_number?: string | null
          created_at?: string | null
          expiry_date?: string | null
          id?: string
          product_id?: string | null
          quantity_pack?: number | null
          quantity_single?: number | null
          shop_id?: string | null
          warehouse_id?: string | null
        }
        Update: {
          batch_number?: string | null
          created_at?: string | null
          expiry_date?: string | null
          id?: string
          product_id?: string | null
          quantity_pack?: number | null
          quantity_single?: number | null
          shop_id?: string | null
          warehouse_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          created_at: string | null
          current_balance: number | null
          id: string
          name: string
          phone: string | null
          shop_id: string | null
        }
        Insert: {
          created_at?: string | null
          current_balance?: number | null
          id?: string
          name: string
          phone?: string | null
          shop_id?: string | null
        }
        Update: {
          created_at?: string | null
          current_balance?: number | null
          id?: string
          name?: string
          phone?: string | null
          shop_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "suppliers_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      tailor_measurements: {
        Row: {
          chest: number | null
          cloth_image_url: string | null
          created_at: string | null
          id: string
          invoice_id: string | null
          length: number | null
          party_id: string | null
          status: string | null
          waist: number | null
        }
        Insert: {
          chest?: number | null
          cloth_image_url?: string | null
          created_at?: string | null
          id?: string
          invoice_id?: string | null
          length?: number | null
          party_id?: string | null
          status?: string | null
          waist?: number | null
        }
        Update: {
          chest?: number | null
          cloth_image_url?: string | null
          created_at?: string | null
          id?: string
          invoice_id?: string | null
          length?: number | null
          party_id?: string | null
          status?: string | null
          waist?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "tailor_measurements_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tailor_measurements_party_id_fkey"
            columns: ["party_id"]
            isOneToOne: false
            referencedRelation: "parties"
            referencedColumns: ["id"]
          },
        ]
      }
      user_profiles: {
        Row: {
          created_at: string | null
          id: string
          name: string
          role: string | null
          shop_id: string | null
        }
        Insert: {
          created_at?: string | null
          id: string
          name: string
          role?: string | null
          shop_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
          role?: string | null
          shop_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_profiles_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          auth_user_id: string | null
          created_at: string | null
          id: string
          name: string
          role: string | null
          shop_id: string | null
        }
        Insert: {
          auth_user_id?: string | null
          created_at?: string | null
          id?: string
          name: string
          role?: string | null
          shop_id?: string | null
        }
        Update: {
          auth_user_id?: string | null
          created_at?: string | null
          id?: string
          name?: string
          role?: string | null
          shop_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "users_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      warehouses: {
        Row: {
          created_at: string | null
          id: string
          location: string | null
          name: string
          shop_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          location?: string | null
          name: string
          shop_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          location?: string | null
          name?: string
          shop_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "warehouses_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
