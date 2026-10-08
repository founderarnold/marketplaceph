
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "affiliate_clicks": {
                  Row: {
                    "created_at": string,"id": number,"link_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: never,"link_id": string
                  }
                  Update: {
                    "created_at"?: string,"id"?: never,"link_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "affiliate_clicks_link_id_fkey"
      columns: ["link_id"]
isOneToOne: false
      referencedRelation: "affiliate_links"
      referencedColumns: ["id"]
    }
                  ]
                },"affiliate_commissions": {
                  Row: {
                    "affiliate_id": string,"amount": number,"created_at": string,"id": string,"link_id": string,"listing_id": string | null,"order_id": string,"paid_at": string | null,"rate": number,"seller_id": string,"status": string
                  }
                  ComputedFields: never
                  Insert: {
                    "affiliate_id": string,"amount"?: number,"created_at"?: string,"id"?: string,"link_id": string,"listing_id"?: string | null,"order_id": string,"paid_at"?: string | null,"rate": number,"seller_id": string,"status"?: string
                  }
                  Update: {
                    "affiliate_id"?: string,"amount"?: number,"created_at"?: string,"id"?: string,"link_id"?: string,"listing_id"?: string | null,"order_id"?: string,"paid_at"?: string | null,"rate"?: number,"seller_id"?: string,"status"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "affiliate_commissions_affiliate_id_fkey"
      columns: ["affiliate_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "affiliate_commissions_affiliate_id_fkey"
      columns: ["affiliate_id"]
isOneToOne: false
      referencedRelation: "public_profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "affiliate_commissions_link_id_fkey"
      columns: ["link_id"]
isOneToOne: false
      referencedRelation: "affiliate_links"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "affiliate_commissions_listing_id_fkey"
      columns: ["listing_id"]
isOneToOne: false
      referencedRelation: "listings"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "affiliate_commissions_order_id_fkey"
      columns: ["order_id"]
isOneToOne: false
      referencedRelation: "orders"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "affiliate_commissions_seller_id_fkey"
      columns: ["seller_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "affiliate_commissions_seller_id_fkey"
      columns: ["seller_id"]
isOneToOne: false
      referencedRelation: "public_profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"affiliate_links": {
                  Row: {
                    "affiliate_id": string,"code": string,"created_at": string,"decided_at": string | null,"id": string,"listing_id": string,"message": string | null,"rate": number | null,"seller_id": string,"status": string
                  }
                  ComputedFields: never
                  Insert: {
                    "affiliate_id": string,"code"?: string,"created_at"?: string,"decided_at"?: string | null,"id"?: string,"listing_id": string,"message"?: string | null,"rate"?: number | null,"seller_id": string,"status"?: string
                  }
                  Update: {
                    "affiliate_id"?: string,"code"?: string,"created_at"?: string,"decided_at"?: string | null,"id"?: string,"listing_id"?: string,"message"?: string | null,"rate"?: number | null,"seller_id"?: string,"status"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "affiliate_links_affiliate_id_fkey"
      columns: ["affiliate_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "affiliate_links_affiliate_id_fkey"
      columns: ["affiliate_id"]
isOneToOne: false
      referencedRelation: "public_profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "affiliate_links_listing_id_fkey"
      columns: ["listing_id"]
isOneToOne: false
      referencedRelation: "listings"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "affiliate_links_seller_id_fkey"
      columns: ["seller_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "affiliate_links_seller_id_fkey"
      columns: ["seller_id"]
isOneToOne: false
      referencedRelation: "public_profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"appeals": {
                  Row: {
                    "appellant_id": string,"body": string,"created_at": string,"decision_note": string | null,"id": string,"report_id": string,"reviewed_at": string | null,"reviewed_by": string | null,"status": string
                  }
                  ComputedFields: never
                  Insert: {
                    "appellant_id": string,"body": string,"created_at"?: string,"decision_note"?: string | null,"id"?: string,"report_id": string,"reviewed_at"?: string | null,"reviewed_by"?: string | null,"status"?: string
                  }
                  Update: {
                    "appellant_id"?: string,"body"?: string,"created_at"?: string,"decision_note"?: string | null,"id"?: string,"report_id"?: string,"reviewed_at"?: string | null,"reviewed_by"?: string | null,"status"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "appeals_appellant_id_fkey"
      columns: ["appellant_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "appeals_appellant_id_fkey"
      columns: ["appellant_id"]
isOneToOne: false
      referencedRelation: "public_profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "appeals_report_id_fkey"
      columns: ["report_id"]
isOneToOne: true
      referencedRelation: "reports"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "appeals_reviewed_by_fkey"
      columns: ["reviewed_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "appeals_reviewed_by_fkey"
      columns: ["reviewed_by"]
isOneToOne: false
      referencedRelation: "public_profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"audit_logs": {
                  Row: {
                    "action": string,"actor_id": string | null,"created_at": string,"id": number,"new_data": Json | null,"old_data": Json | null,"record_id": string | null,"table_name": string
                  }
                  ComputedFields: never
                  Insert: {
                    "action": string,"actor_id"?: string | null,"created_at"?: string,"id"?: never,"new_data"?: Json | null,"old_data"?: Json | null,"record_id"?: string | null,"table_name": string
                  }
                  Update: {
                    "action"?: string,"actor_id"?: string | null,"created_at"?: string,"id"?: never,"new_data"?: Json | null,"old_data"?: Json | null,"record_id"?: string | null,"table_name"?: string
                  }
                  Relationships: [
                    
                  ]
                },"badges": {
                  Row: {
                    "code": string,"description_en": string,"description_fil": string,"kind": string,"name_en": string,"name_fil": string
                  }
                  ComputedFields: never
                  Insert: {
                    "code": string,"description_en": string,"description_fil": string,"kind": string,"name_en": string,"name_fil": string
                  }
                  Update: {
                    "code"?: string,"description_en"?: string,"description_fil"?: string,"kind"?: string,"name_en"?: string,"name_fil"?: string
                  }
                  Relationships: [
                    
                  ]
                },"banned_keywords": {
                  Row: {
                    "id": string,"keyword": string,"reason": string
                  }
                  ComputedFields: never
                  Insert: {
                    "id"?: string,"keyword": string,"reason": string
                  }
                  Update: {
                    "id"?: string,"keyword"?: string,"reason"?: string
                  }
                  Relationships: [
                    
                  ]
                },"cart_items": {
                  Row: {
                    "created_at": string,"id": string,"listing_id": string,"quantity": number,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"listing_id": string,"quantity": number,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"listing_id"?: string,"quantity"?: number,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "cart_items_listing_id_fkey"
      columns: ["listing_id"]
isOneToOne: false
      referencedRelation: "listings"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "cart_items_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "cart_items_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "public_profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"categories": {
                  Row: {
                    "icon": string | null,"id": string,"is_active": boolean,"name_en": string,"name_fil": string,"parent_id": string | null,"slug": string,"sort_order": number
                  }
                  ComputedFields: never
                  Insert: {
                    "icon"?: string | null,"id"?: string,"is_active"?: boolean,"name_en": string,"name_fil": string,"parent_id"?: string | null,"slug": string,"sort_order"?: number
                  }
                  Update: {
                    "icon"?: string | null,"id"?: string,"is_active"?: boolean,"name_en"?: string,"name_fil"?: string,"parent_id"?: string | null,"slug"?: string,"sort_order"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "categories_parent_id_fkey"
      columns: ["parent_id"]
isOneToOne: false
      referencedRelation: "categories"
      referencedColumns: ["id"]
    }
                  ]
                },"conversations": {
                  Row: {
                    "buyer_id": string,"created_at": string,"id": string,"last_message_at": string,"listing_id": string | null,"store_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "buyer_id": string,"created_at"?: string,"id"?: string,"last_message_at"?: string,"listing_id"?: string | null,"store_id": string
                  }
                  Update: {
                    "buyer_id"?: string,"created_at"?: string,"id"?: string,"last_message_at"?: string,"listing_id"?: string | null,"store_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "conversations_buyer_id_fkey"
      columns: ["buyer_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "conversations_buyer_id_fkey"
      columns: ["buyer_id"]
isOneToOne: false
      referencedRelation: "public_profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "conversations_listing_id_fkey"
      columns: ["listing_id"]
isOneToOne: false
      referencedRelation: "listings"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "conversations_store_id_fkey"
      columns: ["store_id"]
isOneToOne: false
      referencedRelation: "stores"
      referencedColumns: ["id"]
    }
                  ]
                },"crm_customers": {
                  Row: {
                    "buyer_id": string,"notes": string | null,"store_id": string,"tags": (string)[],"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "buyer_id": string,"notes"?: string | null,"store_id": string,"tags"?: (string)[],"updated_at"?: string
                  }
                  Update: {
                    "buyer_id"?: string,"notes"?: string | null,"store_id"?: string,"tags"?: (string)[],"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "crm_customers_buyer_id_fkey"
      columns: ["buyer_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "crm_customers_buyer_id_fkey"
      columns: ["buyer_id"]
isOneToOne: false
      referencedRelation: "public_profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "crm_customers_store_id_fkey"
      columns: ["store_id"]
isOneToOne: false
      referencedRelation: "stores"
      referencedColumns: ["id"]
    }
                  ]
                },"dispute_evidence": {
                  Row: {
                    "created_at": string,"dispute_id": string,"id": string,"note": string | null,"storage_path": string,"uploader_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"dispute_id": string,"id"?: string,"note"?: string | null,"storage_path": string,"uploader_id": string
                  }
                  Update: {
                    "created_at"?: string,"dispute_id"?: string,"id"?: string,"note"?: string | null,"storage_path"?: string,"uploader_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "dispute_evidence_dispute_id_fkey"
      columns: ["dispute_id"]
isOneToOne: false
      referencedRelation: "disputes"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "dispute_evidence_uploader_id_fkey"
      columns: ["uploader_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "dispute_evidence_uploader_id_fkey"
      columns: ["uploader_id"]
isOneToOne: false
      referencedRelation: "public_profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"disputes": {
                  Row: {
                    "admin_note": string | null,"created_at": string,"details": string,"id": string,"opened_by": string,"order_id": string,"outcome": string | null,"reason": string,"resolved_at": string | null,"resolved_by": string | null,"responded_at": string | null,"respondent_id": string,"response_body": string | null,"response_due_at": string,"status": string
                  }
                  ComputedFields: never
                  Insert: {
                    "admin_note"?: string | null,"created_at"?: string,"details": string,"id"?: string,"opened_by": string,"order_id": string,"outcome"?: string | null,"reason": string,"resolved_at"?: string | null,"resolved_by"?: string | null,"responded_at"?: string | null,"respondent_id": string,"response_body"?: string | null,"response_due_at": string,"status"?: string
                  }
                  Update: {
                    "admin_note"?: string | null,"created_at"?: string,"details"?: string,"id"?: string,"opened_by"?: string,"order_id"?: string,"outcome"?: string | null,"reason"?: string,"resolved_at"?: string | null,"resolved_by"?: string | null,"responded_at"?: string | null,"respondent_id"?: string,"response_body"?: string | null,"response_due_at"?: string,"status"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "disputes_opened_by_fkey"
      columns: ["opened_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "disputes_opened_by_fkey"
      columns: ["opened_by"]
isOneToOne: false
      referencedRelation: "public_profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "disputes_order_id_fkey"
      columns: ["order_id"]
isOneToOne: false
      referencedRelation: "orders"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "disputes_resolved_by_fkey"
      columns: ["resolved_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "disputes_resolved_by_fkey"
      columns: ["resolved_by"]
isOneToOne: false
      referencedRelation: "public_profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "disputes_respondent_id_fkey"
      columns: ["respondent_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "disputes_respondent_id_fkey"
      columns: ["respondent_id"]
isOneToOne: false
      referencedRelation: "public_profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"document_access_logs": {
                  Row: {
                    "admin_id": string,"created_at": string,"document_id": string,"id": number,"kind": string
                  }
                  ComputedFields: never
                  Insert: {
                    "admin_id": string,"created_at"?: string,"document_id": string,"id"?: never,"kind": string
                  }
                  Update: {
                    "admin_id"?: string,"created_at"?: string,"document_id"?: string,"id"?: never,"kind"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "document_access_logs_admin_id_fkey"
      columns: ["admin_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "document_access_logs_admin_id_fkey"
      columns: ["admin_id"]
isOneToOne: false
      referencedRelation: "public_profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"expenses": {
                  Row: {
                    "amount": number,"category": string,"created_at": string,"entry_date": string,"id": string,"note": string | null,"user_id": string,"vendor": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "amount": number,"category": string,"created_at"?: string,"entry_date": string,"id"?: string,"note"?: string | null,"user_id": string,"vendor"?: string | null
                  }
                  Update: {
                    "amount"?: number,"category"?: string,"created_at"?: string,"entry_date"?: string,"id"?: string,"note"?: string | null,"user_id"?: string,"vendor"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "expenses_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "expenses_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "public_profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"favorites": {
                  Row: {
                    "created_at": string,"id": string,"listing_id": string | null,"store_id": string | null,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"listing_id"?: string | null,"store_id"?: string | null,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"listing_id"?: string | null,"store_id"?: string | null,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "favorites_listing_id_fkey"
      columns: ["listing_id"]
isOneToOne: false
      referencedRelation: "listings"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "favorites_store_id_fkey"
      columns: ["store_id"]
isOneToOne: false
      referencedRelation: "stores"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "favorites_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "favorites_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "public_profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"follow_up_log": {
                  Row: {
                    "buyer_id": string,"id": number,"rule_id": string | null,"sent_at": string,"sms": boolean,"store_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "buyer_id": string,"id"?: never,"rule_id"?: string | null,"sent_at"?: string,"sms"?: boolean,"store_id": string
                  }
                  Update: {
                    "buyer_id"?: string,"id"?: never,"rule_id"?: string | null,"sent_at"?: string,"sms"?: boolean,"store_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "follow_up_log_buyer_id_fkey"
      columns: ["buyer_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "follow_up_log_buyer_id_fkey"
      columns: ["buyer_id"]
isOneToOne: false
      referencedRelation: "public_profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "follow_up_log_rule_id_fkey"
      columns: ["rule_id"]
isOneToOne: false
      referencedRelation: "follow_up_rules"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "follow_up_log_store_id_fkey"
      columns: ["store_id"]
isOneToOne: false
      referencedRelation: "stores"
      referencedColumns: ["id"]
    }
                  ]
                },"follow_up_rules": {
                  Row: {
                    "buyer_id": string | null,"created_at": string,"enabled": boolean,"every_days": number,"id": string,"listing_id": string | null,"message": string | null,"store_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "buyer_id"?: string | null,"created_at"?: string,"enabled"?: boolean,"every_days": number,"id"?: string,"listing_id"?: string | null,"message"?: string | null,"store_id": string
                  }
                  Update: {
                    "buyer_id"?: string | null,"created_at"?: string,"enabled"?: boolean,"every_days"?: number,"id"?: string,"listing_id"?: string | null,"message"?: string | null,"store_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "follow_up_rules_buyer_id_fkey"
      columns: ["buyer_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "follow_up_rules_buyer_id_fkey"
      columns: ["buyer_id"]
isOneToOne: false
      referencedRelation: "public_profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "follow_up_rules_listing_id_fkey"
      columns: ["listing_id"]
isOneToOne: false
      referencedRelation: "listings"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "follow_up_rules_store_id_fkey"
      columns: ["store_id"]
isOneToOne: false
      referencedRelation: "stores"
      referencedColumns: ["id"]
    }
                  ]
                },"income_entries": {
                  Row: {
                    "amount": number,"category": string,"created_at": string,"entry_date": string,"id": string,"note": string | null,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "amount": number,"category": string,"created_at"?: string,"entry_date": string,"id"?: string,"note"?: string | null,"user_id": string
                  }
                  Update: {
                    "amount"?: number,"category"?: string,"created_at"?: string,"entry_date"?: string,"id"?: string,"note"?: string | null,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "income_entries_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "income_entries_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "public_profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"inventory_adjustments": {
                  Row: {
                    "actor": string | null,"created_at": string,"delta": number,"id": number,"listing_id": string,"new_qty": number,"order_id": string | null,"reason": string
                  }
                  ComputedFields: never
                  Insert: {
                    "actor"?: string | null,"created_at"?: string,"delta": number,"id"?: never,"listing_id": string,"new_qty": number,"order_id"?: string | null,"reason": string
                  }
                  Update: {
                    "actor"?: string | null,"created_at"?: string,"delta"?: number,"id"?: never,"listing_id"?: string,"new_qty"?: number,"order_id"?: string | null,"reason"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "inventory_adjustments_actor_fkey"
      columns: ["actor"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "inventory_adjustments_actor_fkey"
      columns: ["actor"]
isOneToOne: false
      referencedRelation: "public_profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "inventory_adjustments_listing_id_fkey"
      columns: ["listing_id"]
isOneToOne: false
      referencedRelation: "listings"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "inventory_adjustments_order_id_fkey"
      columns: ["order_id"]
isOneToOne: false
      referencedRelation: "orders"
      referencedColumns: ["id"]
    }
                  ]
                },"listing_images": {
                  Row: {
                    "created_at": string,"id": string,"listing_id": string,"path": string,"position": number
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"listing_id": string,"path": string,"position"?: number
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"listing_id"?: string,"path"?: string,"position"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "listing_images_listing_id_fkey"
      columns: ["listing_id"]
isOneToOne: false
      referencedRelation: "listings"
      referencedColumns: ["id"]
    }
                  ]
                },"listing_price_tiers": {
                  Row: {
                    "id": string,"listing_id": string,"min_qty": number,"unit_price": number
                  }
                  ComputedFields: never
                  Insert: {
                    "id"?: string,"listing_id": string,"min_qty": number,"unit_price": number
                  }
                  Update: {
                    "id"?: string,"listing_id"?: string,"min_qty"?: number,"unit_price"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "listing_price_tiers_listing_id_fkey"
      columns: ["listing_id"]
isOneToOne: false
      referencedRelation: "listings"
      referencedColumns: ["id"]
    }
                  ]
                },"listing_shipping_methods": {
                  Row: {
                    "listing_id": string,"method_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "listing_id": string,"method_id": string
                  }
                  Update: {
                    "listing_id"?: string,"method_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "listing_shipping_methods_listing_id_fkey"
      columns: ["listing_id"]
isOneToOne: false
      referencedRelation: "listings"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "listing_shipping_methods_method_id_fkey"
      columns: ["method_id"]
isOneToOne: false
      referencedRelation: "shipping_methods"
      referencedColumns: ["id"]
    }
                  ]
                },"listings": {
                  Row: {
                    "category_id": string | null,"city_code": string | null,"commission_pct": number | null,"created_at": string,"description": string | null,"id": string,"kind": Database["public"]['Enums']["listing_kind"],"low_stock_threshold": number | null,"moq": number,"price_max": number | null,"price_min": number | null,"price_type": Database["public"]['Enums']["price_type"],"province_code": string | null,"quantity_on_hand": number | null,"region_code": string | null,"status": Database["public"]['Enums']["listing_status"],"stock_status": Database["public"]['Enums']["stock_status"],"store_id": string,"title": string,"unit": string,"updated_at": string,"view_count": number,"weight_kg": number | null
                  }
                  ComputedFields: never
                  Insert: {
                    "category_id"?: string | null,"city_code"?: string | null,"commission_pct"?: number | null,"created_at"?: string,"description"?: string | null,"id"?: string,"kind"?: Database["public"]['Enums']["listing_kind"],"low_stock_threshold"?: number | null,"moq"?: number,"price_max"?: number | null,"price_min"?: number | null,"price_type"?: Database["public"]['Enums']["price_type"],"province_code"?: string | null,"quantity_on_hand"?: number | null,"region_code"?: string | null,"status"?: Database["public"]['Enums']["listing_status"],"stock_status"?: Database["public"]['Enums']["stock_status"],"store_id": string,"title": string,"unit"?: string,"updated_at"?: string,"view_count"?: number,"weight_kg"?: number | null
                  }
                  Update: {
                    "category_id"?: string | null,"city_code"?: string | null,"commission_pct"?: number | null,"created_at"?: string,"description"?: string | null,"id"?: string,"kind"?: Database["public"]['Enums']["listing_kind"],"low_stock_threshold"?: number | null,"moq"?: number,"price_max"?: number | null,"price_min"?: number | null,"price_type"?: Database["public"]['Enums']["price_type"],"province_code"?: string | null,"quantity_on_hand"?: number | null,"region_code"?: string | null,"status"?: Database["public"]['Enums']["listing_status"],"stock_status"?: Database["public"]['Enums']["stock_status"],"store_id"?: string,"title"?: string,"unit"?: string,"updated_at"?: string,"view_count"?: number,"weight_kg"?: number | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "listings_category_id_fkey"
      columns: ["category_id"]
isOneToOne: false
      referencedRelation: "categories"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "listings_city_code_fkey"
      columns: ["city_code"]
isOneToOne: false
      referencedRelation: "psgc_cities"
      referencedColumns: ["code"]
    },{
      foreignKeyName: "listings_province_code_fkey"
      columns: ["province_code"]
isOneToOne: false
      referencedRelation: "psgc_provinces"
      referencedColumns: ["code"]
    },{
      foreignKeyName: "listings_region_code_fkey"
      columns: ["region_code"]
isOneToOne: false
      referencedRelation: "psgc_regions"
      referencedColumns: ["code"]
    },{
      foreignKeyName: "listings_store_id_fkey"
      columns: ["store_id"]
isOneToOne: false
      referencedRelation: "stores"
      referencedColumns: ["id"]
    }
                  ]
                },"messages": {
                  Row: {
                    "body": string | null,"conversation_id": string,"created_at": string,"id": string,"image_path": string | null,"read_at": string | null,"sender_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "body"?: string | null,"conversation_id": string,"created_at"?: string,"id"?: string,"image_path"?: string | null,"read_at"?: string | null,"sender_id": string
                  }
                  Update: {
                    "body"?: string | null,"conversation_id"?: string,"created_at"?: string,"id"?: string,"image_path"?: string | null,"read_at"?: string | null,"sender_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "messages_conversation_id_fkey"
      columns: ["conversation_id"]
isOneToOne: false
      referencedRelation: "conversations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "messages_sender_id_fkey"
      columns: ["sender_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "messages_sender_id_fkey"
      columns: ["sender_id"]
isOneToOne: false
      referencedRelation: "public_profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"notifications": {
                  Row: {
                    "created_at": string,"id": string,"kind": string,"link": string | null,"params": NonNullable<Json>,"read_at": string | null,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"kind": string,"link"?: string | null,"params"?: NonNullable<Json>,"read_at"?: string | null,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"kind"?: string,"link"?: string | null,"params"?: NonNullable<Json>,"read_at"?: string | null,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "notifications_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "notifications_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "public_profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"order_delivery": {
                  Row: {
                    "address": string,"city_code": string | null,"landmark": string | null,"order_id": string,"phone": string,"province_code": string | null,"recipient_name": string,"region_code": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "address": string,"city_code"?: string | null,"landmark"?: string | null,"order_id": string,"phone": string,"province_code"?: string | null,"recipient_name": string,"region_code"?: string | null
                  }
                  Update: {
                    "address"?: string,"city_code"?: string | null,"landmark"?: string | null,"order_id"?: string,"phone"?: string,"province_code"?: string | null,"recipient_name"?: string,"region_code"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "order_delivery_city_code_fkey"
      columns: ["city_code"]
isOneToOne: false
      referencedRelation: "psgc_cities"
      referencedColumns: ["code"]
    },{
      foreignKeyName: "order_delivery_order_id_fkey"
      columns: ["order_id"]
isOneToOne: true
      referencedRelation: "orders"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "order_delivery_province_code_fkey"
      columns: ["province_code"]
isOneToOne: false
      referencedRelation: "psgc_provinces"
      referencedColumns: ["code"]
    },{
      foreignKeyName: "order_delivery_region_code_fkey"
      columns: ["region_code"]
isOneToOne: false
      referencedRelation: "psgc_regions"
      referencedColumns: ["code"]
    }
                  ]
                },"order_items": {
                  Row: {
                    "available_qty": number | null,"created_at": string,"id": string,"listing_id": string | null,"order_id": string,"packed": boolean,"quantity": number,"title": string,"unit": string,"unit_price": number | null
                  }
                  ComputedFields: never
                  Insert: {
                    "available_qty"?: number | null,"created_at"?: string,"id"?: string,"listing_id"?: string | null,"order_id": string,"packed"?: boolean,"quantity": number,"title": string,"unit": string,"unit_price"?: number | null
                  }
                  Update: {
                    "available_qty"?: number | null,"created_at"?: string,"id"?: string,"listing_id"?: string | null,"order_id"?: string,"packed"?: boolean,"quantity"?: number,"title"?: string,"unit"?: string,"unit_price"?: number | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "order_items_listing_id_fkey"
      columns: ["listing_id"]
isOneToOne: false
      referencedRelation: "listings"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "order_items_order_id_fkey"
      columns: ["order_id"]
isOneToOne: false
      referencedRelation: "orders"
      referencedColumns: ["id"]
    }
                  ]
                },"orders": {
                  Row: {
                    "amount": number,"buyer_id": string,"buyer_note": string | null,"cancel_reason": string | null,"cancelled_by": string | null,"cancelled_from": string | null,"cod": boolean,"confirmed_at": string | null,"conversation_id": string | null,"created_at": string,"delivered_at": string | null,"id": string,"is_full_flow": boolean,"listing_id": string | null,"packed_at": string | null,"paid_at": string | null,"payment_method": string | null,"preferred_method_id": string | null,"prev_status": string | null,"quantity": number,"quote_expires_at": string | null,"quoted_at": string | null,"seller_id": string,"seller_note": string | null,"shipped_at": string | null,"shipping_fee": number,"shipping_method_id": string | null,"status": Database["public"]['Enums']["order_status"],"stock_applied": boolean,"store_id": string,"summary": string,"urgency": string
                  }
                  ComputedFields: never
                  Insert: {
                    "amount": number,"buyer_id": string,"buyer_note"?: string | null,"cancel_reason"?: string | null,"cancelled_by"?: string | null,"cancelled_from"?: string | null,"cod"?: boolean,"confirmed_at"?: string | null,"conversation_id"?: string | null,"created_at"?: string,"delivered_at"?: string | null,"id"?: string,"is_full_flow"?: boolean,"listing_id"?: string | null,"packed_at"?: string | null,"paid_at"?: string | null,"payment_method"?: string | null,"preferred_method_id"?: string | null,"prev_status"?: string | null,"quantity": number,"quote_expires_at"?: string | null,"quoted_at"?: string | null,"seller_id": string,"seller_note"?: string | null,"shipped_at"?: string | null,"shipping_fee"?: number,"shipping_method_id"?: string | null,"status"?: Database["public"]['Enums']["order_status"],"stock_applied"?: boolean,"store_id": string,"summary": string,"urgency"?: string
                  }
                  Update: {
                    "amount"?: number,"buyer_id"?: string,"buyer_note"?: string | null,"cancel_reason"?: string | null,"cancelled_by"?: string | null,"cancelled_from"?: string | null,"cod"?: boolean,"confirmed_at"?: string | null,"conversation_id"?: string | null,"created_at"?: string,"delivered_at"?: string | null,"id"?: string,"is_full_flow"?: boolean,"listing_id"?: string | null,"packed_at"?: string | null,"paid_at"?: string | null,"payment_method"?: string | null,"preferred_method_id"?: string | null,"prev_status"?: string | null,"quantity"?: number,"quote_expires_at"?: string | null,"quoted_at"?: string | null,"seller_id"?: string,"seller_note"?: string | null,"shipped_at"?: string | null,"shipping_fee"?: number,"shipping_method_id"?: string | null,"status"?: Database["public"]['Enums']["order_status"],"stock_applied"?: boolean,"store_id"?: string,"summary"?: string,"urgency"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "orders_buyer_id_fkey"
      columns: ["buyer_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "orders_buyer_id_fkey"
      columns: ["buyer_id"]
isOneToOne: false
      referencedRelation: "public_profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "orders_cancelled_by_fkey"
      columns: ["cancelled_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "orders_cancelled_by_fkey"
      columns: ["cancelled_by"]
isOneToOne: false
      referencedRelation: "public_profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "orders_conversation_id_fkey"
      columns: ["conversation_id"]
isOneToOne: false
      referencedRelation: "conversations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "orders_listing_id_fkey"
      columns: ["listing_id"]
isOneToOne: false
      referencedRelation: "listings"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "orders_preferred_method_id_fkey"
      columns: ["preferred_method_id"]
isOneToOne: false
      referencedRelation: "shipping_methods"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "orders_seller_id_fkey"
      columns: ["seller_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "orders_seller_id_fkey"
      columns: ["seller_id"]
isOneToOne: false
      referencedRelation: "public_profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "orders_shipping_method_id_fkey"
      columns: ["shipping_method_id"]
isOneToOne: false
      referencedRelation: "shipping_methods"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "orders_store_id_fkey"
      columns: ["store_id"]
isOneToOne: false
      referencedRelation: "stores"
      referencedColumns: ["id"]
    }
                  ]
                },"packing_proofs": {
                  Row: {
                    "created_at": string,"id": string,"note": string | null,"order_id": string,"photo_path": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"note"?: string | null,"order_id": string,"photo_path": string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"note"?: string | null,"order_id"?: string,"photo_path"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "packing_proofs_order_id_fkey"
      columns: ["order_id"]
isOneToOne: false
      referencedRelation: "orders"
      referencedColumns: ["id"]
    }
                  ]
                },"payment_proofs": {
                  Row: {
                    "amount": number,"created_at": string,"id": string,"method": string,"order_id": string,"proof_path": string,"reference_no": string,"reviewed_at": string | null,"seller_note": string | null,"status": string,"uploader_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "amount": number,"created_at"?: string,"id"?: string,"method": string,"order_id": string,"proof_path": string,"reference_no": string,"reviewed_at"?: string | null,"seller_note"?: string | null,"status"?: string,"uploader_id": string
                  }
                  Update: {
                    "amount"?: number,"created_at"?: string,"id"?: string,"method"?: string,"order_id"?: string,"proof_path"?: string,"reference_no"?: string,"reviewed_at"?: string | null,"seller_note"?: string | null,"status"?: string,"uploader_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "payment_proofs_order_id_fkey"
      columns: ["order_id"]
isOneToOne: false
      referencedRelation: "orders"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "payment_proofs_uploader_id_fkey"
      columns: ["uploader_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "payment_proofs_uploader_id_fkey"
      columns: ["uploader_id"]
isOneToOne: false
      referencedRelation: "public_profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"plan_requests": {
                  Row: {
                    "billing": string,"created_at": string,"id": string,"note": string | null,"plan": string,"status": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "billing"?: string,"created_at"?: string,"id"?: string,"note"?: string | null,"plan"?: string,"status"?: string,"user_id": string
                  }
                  Update: {
                    "billing"?: string,"created_at"?: string,"id"?: string,"note"?: string | null,"plan"?: string,"status"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "plan_requests_plan_fkey"
      columns: ["plan"]
isOneToOne: false
      referencedRelation: "plan_tiers"
      referencedColumns: ["key"]
    },{
      foreignKeyName: "plan_requests_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "plan_requests_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "public_profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"plan_tiers": {
                  Row: {
                    "affiliate_links": number,"key": string,"listing_limit": number | null,"monthly_php": number,"name": string,"rank": number,"tagline": string,"yearly_php": number
                  }
                  ComputedFields: never
                  Insert: {
                    "affiliate_links": number,"key": string,"listing_limit"?: number | null,"monthly_php": number,"name": string,"rank": number,"tagline": string,"yearly_php": number
                  }
                  Update: {
                    "affiliate_links"?: number,"key"?: string,"listing_limit"?: number | null,"monthly_php"?: number,"name"?: string,"rank"?: number,"tagline"?: string,"yearly_php"?: number
                  }
                  Relationships: [
                    
                  ]
                },"profiles": {
                  Row: {
                    "accepts_sms": boolean,"avatar_url": string | null,"created_at": string,"display_name": string,"id": string,"locale": string,"phone": string | null,"restricted_until": string | null,"role": Database["public"]['Enums']["user_role"],"sheet_public": boolean,"sms_phone": string | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "accepts_sms"?: boolean,"avatar_url"?: string | null,"created_at"?: string,"display_name"?: string,"id": string,"locale"?: string,"phone"?: string | null,"restricted_until"?: string | null,"role"?: Database["public"]['Enums']["user_role"],"sheet_public"?: boolean,"sms_phone"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "accepts_sms"?: boolean,"avatar_url"?: string | null,"created_at"?: string,"display_name"?: string,"id"?: string,"locale"?: string,"phone"?: string | null,"restricted_until"?: string | null,"role"?: Database["public"]['Enums']["user_role"],"sheet_public"?: boolean,"sms_phone"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"psgc_cities": {
                  Row: {
                    "code": string,"name": string,"province_code": string | null,"region_code": string
                  }
                  ComputedFields: never
                  Insert: {
                    "code": string,"name": string,"province_code"?: string | null,"region_code": string
                  }
                  Update: {
                    "code"?: string,"name"?: string,"province_code"?: string | null,"region_code"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "psgc_cities_province_code_fkey"
      columns: ["province_code"]
isOneToOne: false
      referencedRelation: "psgc_provinces"
      referencedColumns: ["code"]
    },{
      foreignKeyName: "psgc_cities_region_code_fkey"
      columns: ["region_code"]
isOneToOne: false
      referencedRelation: "psgc_regions"
      referencedColumns: ["code"]
    }
                  ]
                },"psgc_provinces": {
                  Row: {
                    "code": string,"name": string,"region_code": string
                  }
                  ComputedFields: never
                  Insert: {
                    "code": string,"name": string,"region_code": string
                  }
                  Update: {
                    "code"?: string,"name"?: string,"region_code"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "psgc_provinces_region_code_fkey"
      columns: ["region_code"]
isOneToOne: false
      referencedRelation: "psgc_regions"
      referencedColumns: ["code"]
    }
                  ]
                },"psgc_regions": {
                  Row: {
                    "code": string,"name": string,"short_name": string
                  }
                  ComputedFields: never
                  Insert: {
                    "code": string,"name": string,"short_name": string
                  }
                  Update: {
                    "code"?: string,"name"?: string,"short_name"?: string
                  }
                  Relationships: [
                    
                  ]
                },"reminder_optouts": {
                  Row: {
                    "created_at": string,"store_id": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"store_id": string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"store_id"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "reminder_optouts_store_id_fkey"
      columns: ["store_id"]
isOneToOne: false
      referencedRelation: "stores"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "reminder_optouts_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "reminder_optouts_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "public_profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"report_evidence": {
                  Row: {
                    "created_at": string,"id": string,"note": string | null,"report_id": string,"shareable": boolean,"storage_path": string,"uploader_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"note"?: string | null,"report_id": string,"shareable"?: boolean,"storage_path": string,"uploader_id": string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"note"?: string | null,"report_id"?: string,"shareable"?: boolean,"storage_path"?: string,"uploader_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "report_evidence_report_id_fkey"
      columns: ["report_id"]
isOneToOne: false
      referencedRelation: "reports"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "report_evidence_uploader_id_fkey"
      columns: ["uploader_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "report_evidence_uploader_id_fkey"
      columns: ["uploader_id"]
isOneToOne: false
      referencedRelation: "public_profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"report_responses": {
                  Row: {
                    "body": string,"created_at": string,"evidence_paths": (string)[],"id": string,"report_id": string,"responder_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "body": string,"created_at"?: string,"evidence_paths"?: (string)[],"id"?: string,"report_id": string,"responder_id": string
                  }
                  Update: {
                    "body"?: string,"created_at"?: string,"evidence_paths"?: (string)[],"id"?: string,"report_id"?: string,"responder_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "report_responses_report_id_fkey"
      columns: ["report_id"]
isOneToOne: false
      referencedRelation: "reports"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "report_responses_responder_id_fkey"
      columns: ["responder_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "report_responses_responder_id_fkey"
      columns: ["responder_id"]
isOneToOne: false
      referencedRelation: "public_profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"reports": {
                  Row: {
                    "accused_id": string | null,"accused_store_id": string | null,"admin_note": string | null,"created_at": string,"decided_at": string | null,"decided_by": string | null,"decision_note": string | null,"details": string | null,"id": string,"reason": string,"reporter_id": string,"resolved_by": string | null,"response_due_at": string | null,"status": Database["public"]['Enums']["report_status"],"target_id": string,"target_type": Database["public"]['Enums']["report_target"],"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "accused_id"?: string | null,"accused_store_id"?: string | null,"admin_note"?: string | null,"created_at"?: string,"decided_at"?: string | null,"decided_by"?: string | null,"decision_note"?: string | null,"details"?: string | null,"id"?: string,"reason": string,"reporter_id": string,"resolved_by"?: string | null,"response_due_at"?: string | null,"status"?: Database["public"]['Enums']["report_status"],"target_id": string,"target_type": Database["public"]['Enums']["report_target"],"updated_at"?: string
                  }
                  Update: {
                    "accused_id"?: string | null,"accused_store_id"?: string | null,"admin_note"?: string | null,"created_at"?: string,"decided_at"?: string | null,"decided_by"?: string | null,"decision_note"?: string | null,"details"?: string | null,"id"?: string,"reason"?: string,"reporter_id"?: string,"resolved_by"?: string | null,"response_due_at"?: string | null,"status"?: Database["public"]['Enums']["report_status"],"target_id"?: string,"target_type"?: Database["public"]['Enums']["report_target"],"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "reports_accused_id_fkey"
      columns: ["accused_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "reports_accused_id_fkey"
      columns: ["accused_id"]
isOneToOne: false
      referencedRelation: "public_profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "reports_accused_store_id_fkey"
      columns: ["accused_store_id"]
isOneToOne: false
      referencedRelation: "stores"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "reports_decided_by_fkey"
      columns: ["decided_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "reports_decided_by_fkey"
      columns: ["decided_by"]
isOneToOne: false
      referencedRelation: "public_profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "reports_reporter_id_fkey"
      columns: ["reporter_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "reports_reporter_id_fkey"
      columns: ["reporter_id"]
isOneToOne: false
      referencedRelation: "public_profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "reports_resolved_by_fkey"
      columns: ["resolved_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "reports_resolved_by_fkey"
      columns: ["resolved_by"]
isOneToOne: false
      referencedRelation: "public_profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"restock_reminders": {
                  Row: {
                    "created_at": string,"enabled": boolean,"every_days": number,"id": string,"last_sent_at": string | null,"listing_id": string | null,"next_run_at": string,"store_id": string | null,"title": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"enabled"?: boolean,"every_days": number,"id"?: string,"last_sent_at"?: string | null,"listing_id"?: string | null,"next_run_at": string,"store_id"?: string | null,"title": string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"enabled"?: boolean,"every_days"?: number,"id"?: string,"last_sent_at"?: string | null,"listing_id"?: string | null,"next_run_at"?: string,"store_id"?: string | null,"title"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "restock_reminders_listing_id_fkey"
      columns: ["listing_id"]
isOneToOne: false
      referencedRelation: "listings"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "restock_reminders_store_id_fkey"
      columns: ["store_id"]
isOneToOne: false
      referencedRelation: "stores"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "restock_reminders_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "restock_reminders_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "public_profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"reviews": {
                  Row: {
                    "comment": string | null,"created_at": string,"direction": string,"id": string,"order_id": string,"photos": (string)[],"rating": number,"reviewee_id": string,"reviewer_id": string,"store_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "comment"?: string | null,"created_at"?: string,"direction": string,"id"?: string,"order_id": string,"photos"?: (string)[],"rating": number,"reviewee_id": string,"reviewer_id": string,"store_id": string
                  }
                  Update: {
                    "comment"?: string | null,"created_at"?: string,"direction"?: string,"id"?: string,"order_id"?: string,"photos"?: (string)[],"rating"?: number,"reviewee_id"?: string,"reviewer_id"?: string,"store_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "reviews_order_id_fkey"
      columns: ["order_id"]
isOneToOne: false
      referencedRelation: "orders"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "reviews_reviewee_id_fkey"
      columns: ["reviewee_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "reviews_reviewee_id_fkey"
      columns: ["reviewee_id"]
isOneToOne: false
      referencedRelation: "public_profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "reviews_reviewer_id_fkey"
      columns: ["reviewer_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "reviews_reviewer_id_fkey"
      columns: ["reviewer_id"]
isOneToOne: false
      referencedRelation: "public_profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "reviews_store_id_fkey"
      columns: ["store_id"]
isOneToOne: false
      referencedRelation: "stores"
      referencedColumns: ["id"]
    }
                  ]
                },"shipments": {
                  Row: {
                    "booking_link": string | null,"bus_line": string | null,"bus_terminal_from": string | null,"bus_terminal_to": string | null,"driver_name": string | null,"driver_phone": string | null,"eta": string | null,"method_id": string | null,"method_kind": Database["public"]['Enums']["shipping_kind"],"method_name": string,"notes": string | null,"order_id": string,"plate_no": string | null,"shipped_at": string,"tracking_number": string | null,"waybill_path": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "booking_link"?: string | null,"bus_line"?: string | null,"bus_terminal_from"?: string | null,"bus_terminal_to"?: string | null,"driver_name"?: string | null,"driver_phone"?: string | null,"eta"?: string | null,"method_id"?: string | null,"method_kind"?: Database["public"]['Enums']["shipping_kind"],"method_name": string,"notes"?: string | null,"order_id": string,"plate_no"?: string | null,"shipped_at"?: string,"tracking_number"?: string | null,"waybill_path"?: string | null
                  }
                  Update: {
                    "booking_link"?: string | null,"bus_line"?: string | null,"bus_terminal_from"?: string | null,"bus_terminal_to"?: string | null,"driver_name"?: string | null,"driver_phone"?: string | null,"eta"?: string | null,"method_id"?: string | null,"method_kind"?: Database["public"]['Enums']["shipping_kind"],"method_name"?: string,"notes"?: string | null,"order_id"?: string,"plate_no"?: string | null,"shipped_at"?: string,"tracking_number"?: string | null,"waybill_path"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "shipments_method_id_fkey"
      columns: ["method_id"]
isOneToOne: false
      referencedRelation: "shipping_methods"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "shipments_order_id_fkey"
      columns: ["order_id"]
isOneToOne: true
      referencedRelation: "orders"
      referencedColumns: ["id"]
    }
                  ]
                },"shipping_methods": {
                  Row: {
                    "created_at": string,"id": string,"is_active": boolean,"kind": Database["public"]['Enums']["shipping_kind"],"link": string | null,"name": string,"notes": string | null,"owner_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"is_active"?: boolean,"kind": Database["public"]['Enums']["shipping_kind"],"link"?: string | null,"name": string,"notes"?: string | null,"owner_id"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"is_active"?: boolean,"kind"?: Database["public"]['Enums']["shipping_kind"],"link"?: string | null,"name"?: string,"notes"?: string | null,"owner_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "shipping_methods_owner_id_fkey"
      columns: ["owner_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "shipping_methods_owner_id_fkey"
      columns: ["owner_id"]
isOneToOne: false
      referencedRelation: "public_profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"sms_outbox": {
                  Row: {
                    "body": string,"created_at": string,"error": string | null,"from_user": string | null,"id": number,"kind": string,"provider": string | null,"sent_at": string | null,"status": string,"to_phone": string,"to_user": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "body": string,"created_at"?: string,"error"?: string | null,"from_user"?: string | null,"id"?: never,"kind": string,"provider"?: string | null,"sent_at"?: string | null,"status"?: string,"to_phone": string,"to_user"?: string | null
                  }
                  Update: {
                    "body"?: string,"created_at"?: string,"error"?: string | null,"from_user"?: string | null,"id"?: never,"kind"?: string,"provider"?: string | null,"sent_at"?: string | null,"status"?: string,"to_phone"?: string,"to_user"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "sms_outbox_from_user_fkey"
      columns: ["from_user"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "sms_outbox_from_user_fkey"
      columns: ["from_user"]
isOneToOne: false
      referencedRelation: "public_profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "sms_outbox_to_user_fkey"
      columns: ["to_user"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "sms_outbox_to_user_fkey"
      columns: ["to_user"]
isOneToOne: false
      referencedRelation: "public_profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"sms_settings": {
                  Row: {
                    "accepted_terms_at": string | null,"enabled": boolean,"phone": string,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "accepted_terms_at"?: string | null,"enabled"?: boolean,"phone": string,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "accepted_terms_at"?: string | null,"enabled"?: boolean,"phone"?: string,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "sms_settings_user_id_fkey"
      columns: ["user_id"]
isOneToOne: true
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "sms_settings_user_id_fkey"
      columns: ["user_id"]
isOneToOne: true
      referencedRelation: "public_profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"store_payment_methods": {
                  Row: {
                    "account_name": string | null,"account_number": string | null,"bank_name": string | null,"created_at": string,"id": string,"instructions": string | null,"kind": string,"store_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "account_name"?: string | null,"account_number"?: string | null,"bank_name"?: string | null,"created_at"?: string,"id"?: string,"instructions"?: string | null,"kind": string,"store_id": string
                  }
                  Update: {
                    "account_name"?: string | null,"account_number"?: string | null,"bank_name"?: string | null,"created_at"?: string,"id"?: string,"instructions"?: string | null,"kind"?: string,"store_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "store_payment_methods_store_id_fkey"
      columns: ["store_id"]
isOneToOne: false
      referencedRelation: "stores"
      referencedColumns: ["id"]
    }
                  ]
                },"store_shipping_methods": {
                  Row: {
                    "method_id": string,"note": string | null,"store_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "method_id": string,"note"?: string | null,"store_id": string
                  }
                  Update: {
                    "method_id"?: string,"note"?: string | null,"store_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "store_shipping_methods_method_id_fkey"
      columns: ["method_id"]
isOneToOne: false
      referencedRelation: "shipping_methods"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "store_shipping_methods_store_id_fkey"
      columns: ["store_id"]
isOneToOne: false
      referencedRelation: "stores"
      referencedColumns: ["id"]
    }
                  ]
                },"store_verifications": {
                  Row: {
                    "id": string,"reviewed_at": string | null,"reviewed_by": string | null,"reviewer_note": string | null,"status": Database["public"]['Enums']["verification_status"],"store_id": string,"submitted_at": string,"submitted_by": string,"target_level": number
                  }
                  ComputedFields: never
                  Insert: {
                    "id"?: string,"reviewed_at"?: string | null,"reviewed_by"?: string | null,"reviewer_note"?: string | null,"status"?: Database["public"]['Enums']["verification_status"],"store_id": string,"submitted_at"?: string,"submitted_by": string,"target_level": number
                  }
                  Update: {
                    "id"?: string,"reviewed_at"?: string | null,"reviewed_by"?: string | null,"reviewer_note"?: string | null,"status"?: Database["public"]['Enums']["verification_status"],"store_id"?: string,"submitted_at"?: string,"submitted_by"?: string,"target_level"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "store_verifications_reviewed_by_fkey"
      columns: ["reviewed_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "store_verifications_reviewed_by_fkey"
      columns: ["reviewed_by"]
isOneToOne: false
      referencedRelation: "public_profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "store_verifications_store_id_fkey"
      columns: ["store_id"]
isOneToOne: false
      referencedRelation: "stores"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "store_verifications_submitted_by_fkey"
      columns: ["submitted_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "store_verifications_submitted_by_fkey"
      columns: ["submitted_by"]
isOneToOne: false
      referencedRelation: "public_profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"stores": {
                  Row: {
                    "address_note": string | null,"city_code": string | null,"contact_email": string | null,"contact_phone": string | null,"created_at": string,"description": string | null,"facebook_url": string | null,"id": string,"logo_url": string | null,"name": string,"owner_id": string,"province_code": string | null,"region_code": string | null,"seller_type": Database["public"]['Enums']["seller_type"],"slug": string,"tagline": string | null,"updated_at": string,"verification_level": number,"website_url": string | null,"year_started": number | null
                  }
                  ComputedFields: never
                  Insert: {
                    "address_note"?: string | null,"city_code"?: string | null,"contact_email"?: string | null,"contact_phone"?: string | null,"created_at"?: string,"description"?: string | null,"facebook_url"?: string | null,"id"?: string,"logo_url"?: string | null,"name": string,"owner_id": string,"province_code"?: string | null,"region_code"?: string | null,"seller_type": Database["public"]['Enums']["seller_type"],"slug": string,"tagline"?: string | null,"updated_at"?: string,"verification_level"?: number,"website_url"?: string | null,"year_started"?: number | null
                  }
                  Update: {
                    "address_note"?: string | null,"city_code"?: string | null,"contact_email"?: string | null,"contact_phone"?: string | null,"created_at"?: string,"description"?: string | null,"facebook_url"?: string | null,"id"?: string,"logo_url"?: string | null,"name"?: string,"owner_id"?: string,"province_code"?: string | null,"region_code"?: string | null,"seller_type"?: Database["public"]['Enums']["seller_type"],"slug"?: string,"tagline"?: string | null,"updated_at"?: string,"verification_level"?: number,"website_url"?: string | null,"year_started"?: number | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "stores_city_code_fkey"
      columns: ["city_code"]
isOneToOne: false
      referencedRelation: "psgc_cities"
      referencedColumns: ["code"]
    },{
      foreignKeyName: "stores_owner_id_fkey"
      columns: ["owner_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "stores_owner_id_fkey"
      columns: ["owner_id"]
isOneToOne: false
      referencedRelation: "public_profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "stores_province_code_fkey"
      columns: ["province_code"]
isOneToOne: false
      referencedRelation: "psgc_provinces"
      referencedColumns: ["code"]
    },{
      foreignKeyName: "stores_region_code_fkey"
      columns: ["region_code"]
isOneToOne: false
      referencedRelation: "psgc_regions"
      referencedColumns: ["code"]
    }
                  ]
                },"subscriptions": {
                  Row: {
                    "billing": string | null,"created_at": string,"current_period_end": string | null,"granted_by": string | null,"note": string | null,"plan": string,"source": string,"status": string,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "billing"?: string | null,"created_at"?: string,"current_period_end"?: string | null,"granted_by"?: string | null,"note"?: string | null,"plan"?: string,"source"?: string,"status"?: string,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "billing"?: string | null,"created_at"?: string,"current_period_end"?: string | null,"granted_by"?: string | null,"note"?: string | null,"plan"?: string,"source"?: string,"status"?: string,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "subscriptions_granted_by_fkey"
      columns: ["granted_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "subscriptions_granted_by_fkey"
      columns: ["granted_by"]
isOneToOne: false
      referencedRelation: "public_profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "subscriptions_plan_fkey"
      columns: ["plan"]
isOneToOne: false
      referencedRelation: "plan_tiers"
      referencedColumns: ["key"]
    },{
      foreignKeyName: "subscriptions_user_id_fkey"
      columns: ["user_id"]
isOneToOne: true
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "subscriptions_user_id_fkey"
      columns: ["user_id"]
isOneToOne: true
      referencedRelation: "public_profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"supplier_notes": {
                  Row: {
                    "buyer_id": string,"favorite": boolean,"notes": string | null,"store_id": string,"tags": (string)[],"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "buyer_id": string,"favorite"?: boolean,"notes"?: string | null,"store_id": string,"tags"?: (string)[],"updated_at"?: string
                  }
                  Update: {
                    "buyer_id"?: string,"favorite"?: boolean,"notes"?: string | null,"store_id"?: string,"tags"?: (string)[],"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "supplier_notes_buyer_id_fkey"
      columns: ["buyer_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "supplier_notes_buyer_id_fkey"
      columns: ["buyer_id"]
isOneToOne: false
      referencedRelation: "public_profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "supplier_notes_store_id_fkey"
      columns: ["store_id"]
isOneToOne: false
      referencedRelation: "stores"
      referencedColumns: ["id"]
    }
                  ]
                },"verification_documents": {
                  Row: {
                    "created_at": string,"doc_type": Database["public"]['Enums']["verification_doc_type"],"id": string,"retain_until": string | null,"storage_path": string,"verification_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"doc_type": Database["public"]['Enums']["verification_doc_type"],"id"?: string,"retain_until"?: string | null,"storage_path": string,"verification_id": string
                  }
                  Update: {
                    "created_at"?: string,"doc_type"?: Database["public"]['Enums']["verification_doc_type"],"id"?: string,"retain_until"?: string | null,"storage_path"?: string,"verification_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "verification_documents_verification_id_fkey"
      columns: ["verification_id"]
isOneToOne: false
      referencedRelation: "store_verifications"
      referencedColumns: ["id"]
    }
                  ]
                },"watchlist_entries": {
                  Row: {
                    "expires_at": string,"flagged_at": string,"gcash_name": string | null,"id": string,"phone": string | null,"report_id": string | null,"review_on": string,"status": string,"store_name": string | null,"store_slug": string | null,"subject_store_id": string | null,"subject_user_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "expires_at": string,"flagged_at"?: string,"gcash_name"?: string | null,"id"?: string,"phone"?: string | null,"report_id"?: string | null,"review_on": string,"status"?: string,"store_name"?: string | null,"store_slug"?: string | null,"subject_store_id"?: string | null,"subject_user_id"?: string | null
                  }
                  Update: {
                    "expires_at"?: string,"flagged_at"?: string,"gcash_name"?: string | null,"id"?: string,"phone"?: string | null,"report_id"?: string | null,"review_on"?: string,"status"?: string,"store_name"?: string | null,"store_slug"?: string | null,"subject_store_id"?: string | null,"subject_user_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "watchlist_entries_report_id_fkey"
      columns: ["report_id"]
isOneToOne: false
      referencedRelation: "reports"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "watchlist_entries_subject_store_id_fkey"
      columns: ["subject_store_id"]
isOneToOne: false
      referencedRelation: "stores"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "watchlist_entries_subject_user_id_fkey"
      columns: ["subject_user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "watchlist_entries_subject_user_id_fkey"
      columns: ["subject_user_id"]
isOneToOne: false
      referencedRelation: "public_profiles"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            "public_profiles": {
                  Row: {
                    "avatar_url": string | null,"created_at": string | null,"display_name": string | null,"id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                           "avatar_url"?: string | null,"created_at"?: string | null,"display_name"?: string | null,"id"?: string | null
                         }
                        Update: {
                           "avatar_url"?: string | null,"created_at"?: string | null,"display_name"?: string | null,"id"?: string | null
                         }
                        Relationships: [
                    
                  ]
                }
          }
          Functions: {
            "_range_ok":
{ Args: { "p_from": string,"p_to": string }; Returns: undefined
                           },
"_tier_rank":
{ Args: { "p_user": string }; Returns: number
                           },
"adjust_stock":
{ Args: { "p_listing": string,"p_new_qty": number,"p_reason"?: string }; Returns: undefined
                           },
"admin_set_plan":
{ Args: { "p_active": boolean,"p_billing"?: string,"p_days"?: number,"p_note"?: string,"p_tier"?: string,"p_user": string }; Returns: undefined
                           },
"affiliate_dashboard":
{ Args: Record<PropertyKey, never>; Returns: {
              "clicks": number,"code": string,"earned": number,"link_id": string,"listing_id": string,"listing_title": string,"orders": number,"paid": number,"pending": number,"rate": number,"status": string,"store_name": string
            }[]
                           },
"affiliate_quota":
{ Args: Record<PropertyKey, never>; Returns: {
              "quota": number,"used": number
            }[]
                           },
"amount_range":
{ Args: { "n": number }; Returns: string
                           },
"assert_not_restricted":
{ Args: { "p_user": string }; Returns: undefined
                           },
"assert_tier":
{ Args: { "p_min": number }; Returns: undefined
                           },
"attach_affiliate":
{ Args: { "p_code": string,"p_order": string }; Returns: boolean
                           },
"bump_listing_view":
{ Args: { "p_listing": string }; Returns: undefined
                           },
"buyer_badges":
{ Args: { "p_user": string }; Returns: (string)[]
                           },
"buyer_sheet":
{ Args: { "p_user": string }; Returns: {
              "avatar_url": string,"avg_rating": number,"badges": (string)[],"cancellation_rate": number,"display_name": string,"member_since": string,"review_count": number,"trust_amount": string,"trust_completed": number
            }[]
                           },
"buyer_spend_by_category":
{ Args: { "p_from": string,"p_to": string }; Returns: {
              "category": string,"spent": number
            }[]
                           },
"buyer_spend_by_supplier":
{ Args: { "p_from": string,"p_to": string }; Returns: {
              "orders_count": number,"spent": number,"store_id": string,"store_name": string
            }[]
                           },
"buyer_spend_series":
{ Args: { "p_bucket"?: string,"p_from": string,"p_to": string }; Returns: {
              "orders_count": number,"period": string,"spent": number
            }[]
                           },
"buyer_spend_summary":
{ Args: { "p_from": string,"p_to": string }; Returns: {
              "orders_count": number,"suppliers_count": number,"total_spent": number
            }[]
                           },
"cancel_order":
{ Args: { "p_order": string,"p_reason"?: string }; Returns: undefined
                           },
"cases_about_me":
{ Args: Record<PropertyKey, never>; Returns: {
              "appeal_by": string,"appeal_status": string,"created_at": string,"decided_at": string,"decision_note": string,"details": string,"has_response": boolean,"reason": string,"report_id": string,"response_due_at": string,"status": Database["public"]['Enums']["report_status"],"target_type": Database["public"]['Enums']["report_target"]
            }[]
                           },
"check_before_pay":
{ Args: { "p_query": string }; Returns: {
              "expires_at": string,"flagged_at": string,"label": string,"match_kind": string
            }[]
                           },
"confirm_received":
{ Args: { "p_order": string }; Returns: undefined
                           },
"crm_list":
{ Args: { "p_store": string }; Returns: {
              "buyer_id": string,"completed_count": number,"display_name": string,"first_order_at": string,"last_order_at": string,"last_phone": string,"notes": string,"orders_count": number,"tags": (string)[],"total_spent": number
            }[]
                           },
"crm_save":
{ Args: { "p_buyer": string,"p_notes": string,"p_store": string,"p_tags": (string)[] }; Returns: undefined
                           },
"decide_affiliate_link":
{ Args: { "p_approve": boolean,"p_link": string }; Returns: undefined
                           },
"decide_appeal":
{ Args: { "p_appeal": string,"p_note": string,"p_outcome": string }; Returns: undefined
                           },
"decide_case":
{ Args: { "p_flag_months"?: number,"p_gcash_name"?: string,"p_note": string,"p_outcome": string,"p_report": string,"p_restrict_days"?: number }; Returns: undefined
                           },
"delete_follow_up_rule":
{ Args: { "p_id": string }; Returns: undefined
                           },
"dispute_respond":
{ Args: { "p_body": string,"p_dispute": string,"p_paths"?: (string)[] }; Returns: undefined
                           },
"evidence_shared_with_me":
{ Args: { "p_report": string }; Returns: {
              "id": string,"note": string,"storage_path": string
            }[]
                           },
"featured_stores":
{ Args: { "p_limit"?: number }; Returns: {
              "store_id": string
            }[]
                           },
"file_appeal":
{ Args: { "p_body": string,"p_report": string }; Returns: undefined
                           },
"finance_pl":
{ Args: { "p_from": string,"p_to": string }; Returns: {
              "amount": number,"category": string,"section": string
            }[]
                           },
"finance_summary":
{ Args: { "p_from": string,"p_to": string }; Returns: {
              "manual_expenses": number,"manual_income": number,"net": number,"order_income": number,"purchases": number
            }[]
                           },
"is_admin":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"is_conversation_participant":
{ Args: { "p_conv": string }; Returns: boolean
                           },
"is_order_participant":
{ Args: { "p_order": string }; Returns: boolean
                           },
"listing_usage":
{ Args: Record<PropertyKey, never>; Returns: {
              "listing_limit": number,"used": number
            }[]
                           },
"mark_commission_paid":
{ Args: { "p_commission": string }; Returns: undefined
                           },
"mark_conversation_read":
{ Args: { "p_conv": string }; Returns: undefined
                           },
"mark_delivered":
{ Args: { "p_order": string }; Returns: undefined
                           },
"mark_notifications_read":
{ Args: Record<PropertyKey, never>; Returns: undefined
                           },
"my_tier":
{ Args: Record<PropertyKey, never>; Returns: {
              "affiliate_links": number,"billing": string,"listing_limit": number,"name": string,"period_end": string,"rank": number,"tier": string
            }[]
                           },
"normalize_ph_phone":
{ Args: { "p": string }; Returns: string
                           },
"notify":
{ Args: { "p_kind": string,"p_link"?: string,"p_params"?: Json,"p_user": string }; Returns: undefined
                           },
"open_case":
{ Args: { "p_days"?: number,"p_report": string }; Returns: undefined
                           },
"open_dispute":
{ Args: { "p_details": string,"p_order": string,"p_paths"?: (string)[],"p_reason": string }; Returns: string
                           },
"order_payment_options":
{ Args: { "p_order": string }; Returns: {
              "account_name": string,"account_number": string,"bank_name": string,"id": string,"instructions": string,"kind": string
            }[]
                           },
"place_order":
{ Args: { "p_delivery": Json,"p_items": Json,"p_note"?: string,"p_preferred"?: string,"p_store": string,"p_urgency"?: string }; Returns: string
                           },
"quote_order":
{ Args: { "p_items": Json,"p_method"?: string,"p_note"?: string,"p_order": string,"p_shipping_fee": number,"p_valid_days"?: number }; Returns: undefined
                           },
"record_affiliate_click":
{ Args: { "p_code": string }; Returns: string
                           },
"request_affiliate_link":
{ Args: { "p_listing": string,"p_message"?: string }; Returns: string
                           },
"request_plan":
{ Args: { "p_billing"?: string,"p_note"?: string,"p_tier": string }; Returns: undefined
                           },
"resolve_dispute":
{ Args: { "p_dispute": string,"p_note": string,"p_outcome": string,"p_result"?: string }; Returns: undefined
                           },
"review_payment":
{ Args: { "p_confirm": boolean,"p_note"?: string,"p_order": string }; Returns: undefined
                           },
"review_verification":
{ Args: { "p_decision": Database["public"]['Enums']["verification_status"],"p_id": string,"p_note": string }; Returns: undefined
                           },
"revoke_affiliate_link":
{ Args: { "p_link": string }; Returns: undefined
                           },
"run_due_reminders":
{ Args: Record<PropertyKey, never>; Returns: {
              "follow_ups_sent": number,"self_sent": number,"sms_queued": number
            }[]
                           },
"save_follow_up_rule":
{ Args: { "p_buyer"?: string,"p_enabled"?: boolean,"p_every": number,"p_id"?: string,"p_listing"?: string,"p_message"?: string,"p_store": string }; Returns: string
                           },
"save_sms_settings":
{ Args: { "p_enabled": boolean,"p_phone": string }; Returns: undefined
                           },
"seller_best_sellers":
{ Args: { "p_from": string,"p_limit"?: number,"p_store": string,"p_to": string }; Returns: {
              "qty": number,"revenue": number,"title": string
            }[]
                           },
"seller_sales_series":
{ Args: { "p_bucket"?: string,"p_from": string,"p_store": string,"p_to": string }; Returns: {
              "orders_count": number,"period": string,"qty": number,"revenue": number
            }[]
                           },
"seller_sales_summary":
{ Args: { "p_from": string,"p_store": string,"p_to": string }; Returns: {
              "avg_order": number,"items_sold": number,"new_customers": number,"orders_count": number,"repeat_customers": number,"revenue": number
            }[]
                           },
"seller_top_customers":
{ Args: { "p_from": string,"p_limit"?: number,"p_store": string,"p_to": string }; Returns: {
              "buyer_id": string,"display_name": string,"orders_count": number,"qty": number,"spent": number
            }[]
                           },
"set_evidence_shareable":
{ Args: { "p_evidence": string,"p_shareable": boolean }; Returns: undefined
                           },
"set_listing_commission":
{ Args: { "p_listing": string,"p_pct"?: number }; Returns: undefined
                           },
"ship_order":
{ Args: { "p_details"?: Json,"p_method"?: string,"p_order": string }; Returns: undefined
                           },
"shipping_method_is_listed":
{ Args: { "p_method": string }; Returns: boolean
                           },
"show_limit":
{ Args: Record<PropertyKey, never>; Returns: number
                           },
"show_trgm":
{ Args: { "": string }; Returns: (string)[]
                           },
"store_badges":
{ Args: { "p_store": string }; Returns: (string)[]
                           },
"store_flag":
{ Args: { "p_store": string }; Returns: string
                           },
"store_has_tier":
{ Args: { "p_min": number,"p_store": string }; Returns: boolean
                           },
"store_trust":
{ Args: { "p_store": string }; Returns: {
              "amount_label": string,"avg_rating": number,"completed_orders": number,"dispute_rate": number,"member_since": string,"response_rate": number,"response_sample": number,"review_count": number,"total_quantity": number
            }[]
                           },
"submit_case_response":
{ Args: { "p_body": string,"p_paths"?: (string)[],"p_report": string }; Returns: undefined
                           },
"submit_packing":
{ Args: { "p_checked": (string)[],"p_note"?: string,"p_order": string,"p_photos": (string)[] }; Returns: undefined
                           },
"submit_payment":
{ Args: { "p_amount"?: number,"p_method": string,"p_order": string,"p_proof_path"?: string,"p_reference"?: string }; Returns: undefined
                           },
"submit_verification":
{ Args: { "p_docs": Json,"p_store": string,"p_target": number }; Returns: string
                           },
"supplier_list":
{ Args: Record<PropertyKey, never>; Returns: {
              "favorite": boolean,"last_order_at": string,"last_order_id": string,"notes": string,"orders_count": number,"seller_type": Database["public"]['Enums']["seller_type"],"store_id": string,"store_name": string,"store_slug": string,"tags": (string)[],"total_spent": number,"verification_level": number
            }[]
                           },
"sync_membership":
{ Args: { "p_billing"?: string,"p_email": string,"p_period_end"?: string,"p_tier": string }; Returns: boolean
                           },
"user_trust":
{ Args: { "p_user": string }; Returns: {
              "amount_label": string,"avg_rating": number,"cancellation_rate": number,"completed_orders": number,"member_since": string,"payment_reliability": number,"review_count": number
            }[]
                           }
          }
          Enums: {
            "listing_kind": "product"|"service","listing_status": "active"|"hidden"|"removed","order_status": "pending_confirmation"|"completed"|"cancelled"|"disputed"|"requested"|"quoted"|"payment_submitted"|"paid"|"packed"|"shipped"|"delivered","price_type": "fixed"|"range"|"message","report_status": "open"|"reviewing"|"dismissed"|"actioned"|"awaiting_response"|"under_review"|"warning"|"restricted"|"flagged","report_target": "listing"|"store"|"user"|"message","seller_type": "manufacturer"|"direct_importer"|"distributor"|"reseller"|"retailer"|"service_provider","shipping_kind": "courier"|"on_demand"|"trucking"|"bus"|"van_jeep"|"pickup"|"other","stock_status": "in_stock"|"made_to_order"|"pre_order"|"out_of_stock","user_role": "user"|"moderator"|"admin","verification_doc_type": "gov_id"|"selfie_with_id"|"dti"|"sec"|"cda"|"bir_cor"|"mayors_permit"|"fda"|"other","verification_status": "pending"|"approved"|"rejected"|"needs_more"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "graphql_public": {
          Enums: {
            
          }
        },"public": {
          Enums: {
            "listing_kind": ["product", "service"],"listing_status": ["active", "hidden", "removed"],"order_status": ["pending_confirmation", "completed", "cancelled", "disputed", "requested", "quoted", "payment_submitted", "paid", "packed", "shipped", "delivered"],"price_type": ["fixed", "range", "message"],"report_status": ["open", "reviewing", "dismissed", "actioned", "awaiting_response", "under_review", "warning", "restricted", "flagged"],"report_target": ["listing", "store", "user", "message"],"seller_type": ["manufacturer", "direct_importer", "distributor", "reseller", "retailer", "service_provider"],"shipping_kind": ["courier", "on_demand", "trucking", "bus", "van_jeep", "pickup", "other"],"stock_status": ["in_stock", "made_to_order", "pre_order", "out_of_stock"],"user_role": ["user", "moderator", "admin"],"verification_doc_type": ["gov_id", "selfie_with_id", "dti", "sec", "cda", "bir_cor", "mayors_permit", "fda", "other"],"verification_status": ["pending", "approved", "rejected", "needs_more"]
          }
        }
} as const
