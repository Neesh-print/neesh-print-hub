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
    PostgrestVersion: "12.2.3 (519615d)"
  }
  public: {
    Tables: {
      faq_items: {
        Row: {
          answer: string
          category: string | null
          created_at: string | null
          id: string
          is_active: boolean | null
          position: number | null
          question: string
          updated_at: string | null
        }
        Insert: {
          answer: string
          category?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          position?: number | null
          question: string
          updated_at?: string | null
        }
        Update: {
          answer?: string
          category?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          position?: number | null
          question?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      landing_page_sections: {
        Row: {
          content: string | null
          created_at: string | null
          id: string
          is_active: boolean | null
          metadata: Json | null
          page_type: string
          position: number | null
          section_type: string
          subtitle: string | null
          title: string | null
          updated_at: string | null
        }
        Insert: {
          content?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          metadata?: Json | null
          page_type: string
          position?: number | null
          section_type: string
          subtitle?: string | null
          title?: string | null
          updated_at?: string | null
        }
        Update: {
          content?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          metadata?: Json | null
          page_type?: string
          position?: number | null
          section_type?: string
          subtitle?: string | null
          title?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      magazines: {
        Row: {
          category: string | null
          cover_image_url: string | null
          created_at: string | null
          description: string | null
          id: string
          inventory_count: number | null
          is_active: boolean | null
          issue_frequency: string | null
          issue_number: string | null
          price: number
          publication_type: string | null
          publisher_id: string
          sold_count: number | null
          specs: string | null
          suggested_retail_price: number | null
          title: string
          updated_at: string | null
          volume_pricing_tiers: Json | null
          wholesale_price: number | null
        }
        Insert: {
          category?: string | null
          cover_image_url?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          inventory_count?: number | null
          is_active?: boolean | null
          issue_frequency?: string | null
          issue_number?: string | null
          price: number
          publication_type?: string | null
          publisher_id: string
          sold_count?: number | null
          specs?: string | null
          suggested_retail_price?: number | null
          title: string
          updated_at?: string | null
          volume_pricing_tiers?: Json | null
          wholesale_price?: number | null
        }
        Update: {
          category?: string | null
          cover_image_url?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          inventory_count?: number | null
          is_active?: boolean | null
          issue_frequency?: string | null
          issue_number?: string | null
          price?: number
          publication_type?: string | null
          publisher_id?: string
          sold_count?: number | null
          specs?: string | null
          suggested_retail_price?: number | null
          title?: string
          updated_at?: string | null
          volume_pricing_tiers?: Json | null
          wholesale_price?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "magazines_publisher_id_fkey"
            columns: ["publisher_id"]
            isOneToOne: false
            referencedRelation: "publishers"
            referencedColumns: ["id"]
          },
        ]
      }
      magic_link_tokens: {
        Row: {
          created_at: string | null
          email: string
          expires_at: string
          id: number
          token: string
          used: boolean | null
        }
        Insert: {
          created_at?: string | null
          email: string
          expires_at: string
          id?: number
          token: string
          used?: boolean | null
        }
        Update: {
          created_at?: string | null
          email?: string
          expires_at?: string
          id?: number
          token?: string
          used?: boolean | null
        }
        Relationships: []
      }
      mailing_list_subscribers: {
        Row: {
          created_at: string | null
          email: string
          id: string
          source: string | null
          status: string | null
          subscribed_at: string | null
          unsubscribed_at: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          email: string
          id?: string
          source?: string | null
          status?: string | null
          subscribed_at?: string | null
          unsubscribed_at?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string
          id?: string
          source?: string | null
          status?: string | null
          subscribed_at?: string | null
          unsubscribed_at?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      message_threads: {
        Row: {
          created_at: string
          created_by: string
          id: string
          last_message_at: string | null
          participants: string[]
          subject: string
          thread_type: string | null
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          last_message_at?: string | null
          participants: string[]
          subject: string
          thread_type?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          last_message_at?: string | null
          participants?: string[]
          subject?: string
          thread_type?: string | null
        }
        Relationships: []
      }
      messages: {
        Row: {
          content: string
          created_at: string
          id: string
          is_read: boolean | null
          message_type: string | null
          recipient_id: string
          related_order_id: string | null
          related_product_id: string | null
          sender_id: string
          thread_id: string
          updated_at: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          is_read?: boolean | null
          message_type?: string | null
          recipient_id: string
          related_order_id?: string | null
          related_product_id?: string | null
          sender_id: string
          thread_id: string
          updated_at?: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          is_read?: boolean | null
          message_type?: string | null
          recipient_id?: string
          related_order_id?: string | null
          related_product_id?: string | null
          sender_id?: string
          thread_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_related_product_id_fkey"
            columns: ["related_product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      navigation_items: {
        Row: {
          created_at: string | null
          href: string
          id: string
          is_active: boolean | null
          label: string
          position: number | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          href: string
          id?: string
          is_active?: boolean | null
          label: string
          position?: number | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          href?: string
          id?: string
          is_active?: boolean | null
          label?: string
          position?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      newsletters: {
        Row: {
          click_count: number | null
          content: string
          created_at: string
          id: string
          open_count: number | null
          publisher_id: string
          scheduled_for: string | null
          sent_at: string | null
          specific_recipients: string[] | null
          status: string | null
          target_audience: string | null
          title: string
          updated_at: string
        }
        Insert: {
          click_count?: number | null
          content: string
          created_at?: string
          id?: string
          open_count?: number | null
          publisher_id: string
          scheduled_for?: string | null
          sent_at?: string | null
          specific_recipients?: string[] | null
          status?: string | null
          target_audience?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          click_count?: number | null
          content?: string
          created_at?: string
          id?: string
          open_count?: number | null
          publisher_id?: string
          scheduled_for?: string | null
          sent_at?: string | null
          specific_recipients?: string[] | null
          status?: string | null
          target_audience?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      notification_preferences: {
        Row: {
          created_at: string
          email_new_messages: boolean | null
          email_newsletters: boolean | null
          email_order_updates: boolean | null
          email_product_updates: boolean | null
          id: string
          push_notifications: boolean | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email_new_messages?: boolean | null
          email_newsletters?: boolean | null
          email_order_updates?: boolean | null
          email_product_updates?: boolean | null
          id?: string
          push_notifications?: boolean | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email_new_messages?: boolean | null
          email_newsletters?: boolean | null
          email_order_updates?: boolean | null
          email_product_updates?: boolean | null
          id?: string
          push_notifications?: boolean | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          content: string
          created_at: string
          email_sent: boolean | null
          id: string
          is_read: boolean | null
          notification_type: string
          priority: string | null
          related_order_id: string | null
          related_product_id: string | null
          title: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          email_sent?: boolean | null
          id?: string
          is_read?: boolean | null
          notification_type: string
          priority?: string | null
          related_order_id?: string | null
          related_product_id?: string | null
          title: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          email_sent?: boolean | null
          id?: string
          is_read?: boolean | null
          notification_type?: string
          priority?: string | null
          related_order_id?: string | null
          related_product_id?: string | null
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_related_product_id_fkey"
            columns: ["related_product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      order_item: {
        Row: {
          created_at: string
          id: string
          order_id: string | null
          product_id: string | null
          quantity: number | null
          unit_price: number
        }
        Insert: {
          created_at?: string
          id?: string
          order_id?: string | null
          product_id?: string | null
          quantity?: number | null
          unit_price: number
        }
        Update: {
          created_at?: string
          id?: string
          order_id?: string | null
          product_id?: string | null
          quantity?: number | null
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "fk_order_item_product"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_item_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          created_at: string | null
          id: string
          magazine_id: string
          notes: string | null
          payment_intent_id: string | null
          quantity: number
          retailer_id: string
          shipping_address: string | null
          status: string
          total_price: number
          tracking_number: string | null
          unit_price: number
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          magazine_id: string
          notes?: string | null
          payment_intent_id?: string | null
          quantity: number
          retailer_id: string
          shipping_address?: string | null
          status?: string
          total_price: number
          tracking_number?: string | null
          unit_price: number
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          magazine_id?: string
          notes?: string | null
          payment_intent_id?: string | null
          quantity?: number
          retailer_id?: string
          shipping_address?: string | null
          status?: string
          total_price?: number
          tracking_number?: string | null
          unit_price?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_magazine_id_fkey"
            columns: ["magazine_id"]
            isOneToOne: false
            referencedRelation: "magazines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_retailer_id_fkey"
            columns: ["retailer_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_sessions: {
        Row: {
          amount: number
          created_at: string | null
          id: string
          metadata: Json | null
          payment_intent_id: string | null
          refund_id: string | null
          session_id: string
          status: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string | null
          id?: string
          metadata?: Json | null
          payment_intent_id?: string | null
          refund_id?: string | null
          session_id: string
          status?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string | null
          id?: string
          metadata?: Json | null
          payment_intent_id?: string | null
          refund_id?: string | null
          session_id?: string
          status?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_sessions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      payouts: {
        Row: {
          amount: number | null
          created_at: string
          id: string
          paid_at: string | null
          publisher_id: string | null
          related_order_id: string | null
          status: string | null
        }
        Insert: {
          amount?: number | null
          created_at?: string
          id?: string
          paid_at?: string | null
          publisher_id?: string | null
          related_order_id?: string | null
          status?: string | null
        }
        Update: {
          amount?: number | null
          created_at?: string
          id?: string
          paid_at?: string | null
          publisher_id?: string | null
          related_order_id?: string | null
          status?: string | null
        }
        Relationships: []
      }
      products: {
        Row: {
          category: Database["public"]["Enums"]["product_category"]
          created_at: string
          description: string | null
          dimensions_cm: string | null
          featured_image_url: string | null
          gallery_images: string[] | null
          genre: string | null
          id: string
          inventory_count: number | null
          is_featured: boolean | null
          issue_number: string | null
          lead_time_days: number | null
          minimum_order_quantity: number | null
          publisher_id: string
          retail_price: number | null
          status: Database["public"]["Enums"]["product_status"]
          tags: string[] | null
          title: string
          updated_at: string
          weight_kg: number | null
          wholesale_price: number
        }
        Insert: {
          category: Database["public"]["Enums"]["product_category"]
          created_at?: string
          description?: string | null
          dimensions_cm?: string | null
          featured_image_url?: string | null
          gallery_images?: string[] | null
          genre?: string | null
          id?: string
          inventory_count?: number | null
          is_featured?: boolean | null
          issue_number?: string | null
          lead_time_days?: number | null
          minimum_order_quantity?: number | null
          publisher_id: string
          retail_price?: number | null
          status?: Database["public"]["Enums"]["product_status"]
          tags?: string[] | null
          title: string
          updated_at?: string
          weight_kg?: number | null
          wholesale_price: number
        }
        Update: {
          category?: Database["public"]["Enums"]["product_category"]
          created_at?: string
          description?: string | null
          dimensions_cm?: string | null
          featured_image_url?: string | null
          gallery_images?: string[] | null
          genre?: string | null
          id?: string
          inventory_count?: number | null
          is_featured?: boolean | null
          issue_number?: string | null
          lead_time_days?: number | null
          minimum_order_quantity?: number | null
          publisher_id?: string
          retail_price?: number | null
          status?: Database["public"]["Enums"]["product_status"]
          tags?: string[] | null
          title?: string
          updated_at?: string
          weight_kg?: number | null
          wholesale_price?: number
        }
        Relationships: []
      }
      profiles: {
        Row: {
          address: string | null
          avatar_url: string | null
          bio: string | null
          business_name: string | null
          city: string | null
          country: string | null
          created_at: string | null
          full_name: string | null
          id: string
          phone: string | null
          postal_code: string | null
          state: string | null
          stripe_customer_id: string | null
          updated_at: string | null
          user_id: string
          website_url: string | null
        }
        Insert: {
          address?: string | null
          avatar_url?: string | null
          bio?: string | null
          business_name?: string | null
          city?: string | null
          country?: string | null
          created_at?: string | null
          full_name?: string | null
          id?: string
          phone?: string | null
          postal_code?: string | null
          state?: string | null
          stripe_customer_id?: string | null
          updated_at?: string | null
          user_id: string
          website_url?: string | null
        }
        Update: {
          address?: string | null
          avatar_url?: string | null
          bio?: string | null
          business_name?: string | null
          city?: string | null
          country?: string | null
          created_at?: string | null
          full_name?: string | null
          id?: string
          phone?: string | null
          postal_code?: string | null
          state?: string | null
          stripe_customer_id?: string | null
          updated_at?: string | null
          user_id?: string
          website_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      publisher_applications: {
        Row: {
          accepts_returns: string | null
          audience_positioning: string | null
          available_quantity: number | null
          business_name: string | null
          category_tags: string[] | null
          copies_sold_estimate: number | null
          cover_image_url: string | null
          created_at: string
          description: string | null
          descriptive_blurb: string | null
          distribution_channels: string[] | null
          email: string | null
          evergreen_score: number | null
          first_name: string | null
          fulfillment_method: string | null
          has_sold_before: boolean | null
          id: string
          issue_frequency: string | null
          issue_number: string | null
          last_name: string | null
          magazine_title: string
          print_run: number | null
          publication_type: string | null
          quotes_feedback: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          reviewer_notes: string | null
          score: number | null
          shelf_stability_months: number | null
          shipping_city: string | null
          shipping_country: string | null
          shipping_state: string | null
          social_website_link: string | null
          specs: string | null
          status: string
          suggested_retail_price: number | null
          updated_at: string
          user_id: string | null
          volume_pricing: Json | null
          volume_pricing_tiers: Json | null
          wholesale_price: number | null
        }
        Insert: {
          accepts_returns?: string | null
          audience_positioning?: string | null
          available_quantity?: number | null
          business_name?: string | null
          category_tags?: string[] | null
          copies_sold_estimate?: number | null
          cover_image_url?: string | null
          created_at?: string
          description?: string | null
          descriptive_blurb?: string | null
          distribution_channels?: string[] | null
          email?: string | null
          evergreen_score?: number | null
          first_name?: string | null
          fulfillment_method?: string | null
          has_sold_before?: boolean | null
          id?: string
          issue_frequency?: string | null
          issue_number?: string | null
          last_name?: string | null
          magazine_title: string
          print_run?: number | null
          publication_type?: string | null
          quotes_feedback?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          reviewer_notes?: string | null
          score?: number | null
          shelf_stability_months?: number | null
          shipping_city?: string | null
          shipping_country?: string | null
          shipping_state?: string | null
          social_website_link?: string | null
          specs?: string | null
          status?: string
          suggested_retail_price?: number | null
          updated_at?: string
          user_id?: string | null
          volume_pricing?: Json | null
          volume_pricing_tiers?: Json | null
          wholesale_price?: number | null
        }
        Update: {
          accepts_returns?: string | null
          audience_positioning?: string | null
          available_quantity?: number | null
          business_name?: string | null
          category_tags?: string[] | null
          copies_sold_estimate?: number | null
          cover_image_url?: string | null
          created_at?: string
          description?: string | null
          descriptive_blurb?: string | null
          distribution_channels?: string[] | null
          email?: string | null
          evergreen_score?: number | null
          first_name?: string | null
          fulfillment_method?: string | null
          has_sold_before?: boolean | null
          id?: string
          issue_frequency?: string | null
          issue_number?: string | null
          last_name?: string | null
          magazine_title?: string
          print_run?: number | null
          publication_type?: string | null
          quotes_feedback?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          reviewer_notes?: string | null
          score?: number | null
          shelf_stability_months?: number | null
          shipping_city?: string | null
          shipping_country?: string | null
          shipping_state?: string | null
          social_website_link?: string | null
          specs?: string | null
          status?: string
          suggested_retail_price?: number | null
          updated_at?: string
          user_id?: string | null
          volume_pricing?: Json | null
          volume_pricing_tiers?: Json | null
          wholesale_price?: number | null
        }
        Relationships: []
      }
      publishers: {
        Row: {
          average_rating: number | null
          company_name: string | null
          created_at: string | null
          description: string | null
          id: string
          instagram_handle: string | null
          total_magazines: number | null
          total_sales: number | null
          updated_at: string | null
          user_id: string
          verified: boolean | null
          verified_at: string | null
          website_url: string | null
        }
        Insert: {
          average_rating?: number | null
          company_name?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          instagram_handle?: string | null
          total_magazines?: number | null
          total_sales?: number | null
          updated_at?: string | null
          user_id: string
          verified?: boolean | null
          verified_at?: string | null
          website_url?: string | null
        }
        Update: {
          average_rating?: number | null
          company_name?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          instagram_handle?: string | null
          total_magazines?: number | null
          total_sales?: number | null
          updated_at?: string | null
          user_id?: string
          verified?: boolean | null
          verified_at?: string | null
          website_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "publishers_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      retailer_applications: {
        Row: {
          additional_notes: string | null
          buyer_email: string
          buyer_name: string | null
          city: string | null
          country: string | null
          created_at: string | null
          denial_reason: string | null
          estimated_monthly_orders: number | null
          id: string
          instagram_handle: string | null
          interested_categories: string[] | null
          phone: string | null
          postal_code: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          shop_address: string | null
          shop_name: string
          shop_url: string | null
          state: string | null
          status: string | null
          submitted_at: string | null
          updated_at: string | null
        }
        Insert: {
          additional_notes?: string | null
          buyer_email: string
          buyer_name?: string | null
          city?: string | null
          country?: string | null
          created_at?: string | null
          denial_reason?: string | null
          estimated_monthly_orders?: number | null
          id?: string
          instagram_handle?: string | null
          interested_categories?: string[] | null
          phone?: string | null
          postal_code?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          shop_address?: string | null
          shop_name: string
          shop_url?: string | null
          state?: string | null
          status?: string | null
          submitted_at?: string | null
          updated_at?: string | null
        }
        Update: {
          additional_notes?: string | null
          buyer_email?: string
          buyer_name?: string | null
          city?: string | null
          country?: string | null
          created_at?: string | null
          denial_reason?: string | null
          estimated_monthly_orders?: number | null
          id?: string
          instagram_handle?: string | null
          interested_categories?: string[] | null
          phone?: string | null
          postal_code?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          shop_address?: string | null
          shop_name?: string
          shop_url?: string | null
          state?: string | null
          status?: string | null
          submitted_at?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "retailer_applications_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      retailers: {
        Row: {
          address: string | null
          average_rating: number | null
          city: string | null
          country: string | null
          created_at: string | null
          id: string
          instagram_handle: string | null
          phone: string | null
          postal_code: string | null
          shop_description: string | null
          shop_name: string | null
          shop_url: string | null
          state: string | null
          total_orders: number | null
          total_spent: number | null
          updated_at: string | null
          user_id: string
          verified: boolean | null
          verified_at: string | null
        }
        Insert: {
          address?: string | null
          average_rating?: number | null
          city?: string | null
          country?: string | null
          created_at?: string | null
          id?: string
          instagram_handle?: string | null
          phone?: string | null
          postal_code?: string | null
          shop_description?: string | null
          shop_name?: string | null
          shop_url?: string | null
          state?: string | null
          total_orders?: number | null
          total_spent?: number | null
          updated_at?: string | null
          user_id: string
          verified?: boolean | null
          verified_at?: string | null
        }
        Update: {
          address?: string | null
          average_rating?: number | null
          city?: string | null
          country?: string | null
          created_at?: string | null
          id?: string
          instagram_handle?: string | null
          phone?: string | null
          postal_code?: string | null
          shop_description?: string | null
          shop_name?: string | null
          shop_url?: string | null
          state?: string | null
          total_orders?: number | null
          total_spent?: number | null
          updated_at?: string | null
          user_id?: string
          verified?: boolean | null
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "retailers_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      returns: {
        Row: {
          created_at: string
          id: string
          order_item_id: string | null
          quantity: number | null
          reason: string | null
          return_label_url: string | null
          status: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          order_item_id?: string | null
          quantity?: number | null
          reason?: string | null
          return_label_url?: string | null
          status?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          order_item_id?: string | null
          quantity?: number | null
          reason?: string | null
          return_label_url?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "returns_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: false
            referencedRelation: "order_item"
            referencedColumns: ["id"]
          },
        ]
      }
      site_content: {
        Row: {
          content: string | null
          created_at: string | null
          id: string
          is_active: boolean | null
          key: string
          metadata: Json | null
          title: string | null
          updated_at: string | null
        }
        Insert: {
          content?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          key: string
          metadata?: Json | null
          title?: string | null
          updated_at?: string | null
        }
        Update: {
          content?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          key?: string
          metadata?: Json | null
          title?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      user_wishlists: {
        Row: {
          created_at: string
          id: string
          product_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          product_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          product_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_wishlists_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_wishlists_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          created_at: string | null
          email: string
          email_verified: boolean | null
          id: string
          password_hash: string
          role: string
          updated_at: string | null
          username: string
        }
        Insert: {
          created_at?: string | null
          email: string
          email_verified?: boolean | null
          id?: string
          password_hash: string
          role: string
          updated_at?: string | null
          username: string
        }
        Update: {
          created_at?: string | null
          email?: string
          email_verified?: boolean | null
          id?: string
          password_hash?: string
          role?: string
          updated_at?: string | null
          username?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      bytea_to_text: { Args: { data: string }; Returns: string }
      calculate_application_score: {
        Args: { application_id: string }
        Returns: number
      }
      get_current_user_role: {
        Args: never
        Returns: Database["public"]["Enums"]["user_role"]
      }
      http: {
        Args: { request: Database["public"]["CompositeTypes"]["http_request"] }
        Returns: Database["public"]["CompositeTypes"]["http_response"]
        SetofOptions: {
          from: "http_request"
          to: "http_response"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      http_delete:
        | {
            Args: { uri: string }
            Returns: Database["public"]["CompositeTypes"]["http_response"]
            SetofOptions: {
              from: "*"
              to: "http_response"
              isOneToOne: true
              isSetofReturn: false
            }
          }
        | {
            Args: { content: string; content_type: string; uri: string }
            Returns: Database["public"]["CompositeTypes"]["http_response"]
            SetofOptions: {
              from: "*"
              to: "http_response"
              isOneToOne: true
              isSetofReturn: false
            }
          }
      http_get:
        | {
            Args: { uri: string }
            Returns: Database["public"]["CompositeTypes"]["http_response"]
            SetofOptions: {
              from: "*"
              to: "http_response"
              isOneToOne: true
              isSetofReturn: false
            }
          }
        | {
            Args: { data: Json; uri: string }
            Returns: Database["public"]["CompositeTypes"]["http_response"]
            SetofOptions: {
              from: "*"
              to: "http_response"
              isOneToOne: true
              isSetofReturn: false
            }
          }
      http_head: {
        Args: { uri: string }
        Returns: Database["public"]["CompositeTypes"]["http_response"]
        SetofOptions: {
          from: "*"
          to: "http_response"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      http_header: {
        Args: { field: string; value: string }
        Returns: Database["public"]["CompositeTypes"]["http_header"]
        SetofOptions: {
          from: "*"
          to: "http_header"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      http_list_curlopt: {
        Args: never
        Returns: {
          curlopt: string
          value: string
        }[]
      }
      http_patch: {
        Args: { content: string; content_type: string; uri: string }
        Returns: Database["public"]["CompositeTypes"]["http_response"]
        SetofOptions: {
          from: "*"
          to: "http_response"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      http_post:
        | {
            Args: { content: string; content_type: string; uri: string }
            Returns: Database["public"]["CompositeTypes"]["http_response"]
            SetofOptions: {
              from: "*"
              to: "http_response"
              isOneToOne: true
              isSetofReturn: false
            }
          }
        | {
            Args: { data: Json; uri: string }
            Returns: Database["public"]["CompositeTypes"]["http_response"]
            SetofOptions: {
              from: "*"
              to: "http_response"
              isOneToOne: true
              isSetofReturn: false
            }
          }
      http_put: {
        Args: { content: string; content_type: string; uri: string }
        Returns: Database["public"]["CompositeTypes"]["http_response"]
        SetofOptions: {
          from: "*"
          to: "http_response"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      http_reset_curlopt: { Args: never; Returns: boolean }
      http_set_curlopt: {
        Args: { curlopt: string; value: string }
        Returns: boolean
      }
      text_to_bytea: { Args: { data: string }; Returns: string }
      urlencode:
        | { Args: { data: Json }; Returns: string }
        | {
            Args: { string: string }
            Returns: {
              error: true
            } & "Could not choose the best candidate function between: public.urlencode(string => bytea), public.urlencode(string => varchar). Try renaming the parameters or the function itself in the database so function overloading can be resolved"
          }
        | {
            Args: { string: string }
            Returns: {
              error: true
            } & "Could not choose the best candidate function between: public.urlencode(string => bytea), public.urlencode(string => varchar). Try renaming the parameters or the function itself in the database so function overloading can be resolved"
          }
    }
    Enums: {
      order_status:
        | "pending"
        | "confirmed"
        | "shipped"
        | "delivered"
        | "cancelled"
      product_category:
        | "books"
        | "magazines"
        | "newspapers"
        | "journals"
        | "catalogs"
        | "brochures"
        | "posters"
        | "stickers"
        | "business_cards"
        | "flyers"
        | "other"
      product_status: "draft" | "published" | "archived"
      user_role: "publisher" | "retailer" | "admin"
    }
    CompositeTypes: {
      http_header: {
        field: string | null
        value: string | null
      }
      http_request: {
        method: unknown
        uri: string | null
        headers: Database["public"]["CompositeTypes"]["http_header"][] | null
        content_type: string | null
        content: string | null
      }
      http_response: {
        status: number | null
        content_type: string | null
        headers: Database["public"]["CompositeTypes"]["http_header"][] | null
        content: string | null
      }
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
    Enums: {
      order_status: [
        "pending",
        "confirmed",
        "shipped",
        "delivered",
        "cancelled",
      ],
      product_category: [
        "books",
        "magazines",
        "newspapers",
        "journals",
        "catalogs",
        "brochures",
        "posters",
        "stickers",
        "business_cards",
        "flyers",
        "other",
      ],
      product_status: ["draft", "published", "archived"],
      user_role: ["publisher", "retailer", "admin"],
    },
  },
} as const
