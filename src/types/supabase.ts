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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      configuracion_facturacion_electronica: {
        Row: {
          ambiente: string
          certificado_activo: boolean
          certificado_fecha_caducidad: string | null
          certificado_fecha_emision: string | null
          certificado_issuer: string | null
          certificado_nombre: string | null
          certificado_password_encrypted: string | null
          certificado_serial: string | null
          certificado_storage_path: string | null
          certificado_subject: string | null
          certificado_thumbprint: string | null
          contribuyente_especial: string | null
          created_at: string
          direccion_establecimiento: string | null
          direccion_matriz: string | null
          establecimiento: string
          forma_pago_sri: string | null
          id: string
          laboratorio_id: string
          nombre_comercial: string | null
          obligado_contabilidad: boolean
          porcentaje_iva: number | null
          punto_emision: string
          razon_social: string
          ruc: string
          secuencial_actual: number
          updated_at: string
        }
        Insert: {
          ambiente?: string
          certificado_activo?: boolean
          certificado_fecha_caducidad?: string | null
          certificado_fecha_emision?: string | null
          certificado_issuer?: string | null
          certificado_nombre?: string | null
          certificado_password_encrypted?: string | null
          certificado_serial?: string | null
          certificado_storage_path?: string | null
          certificado_subject?: string | null
          certificado_thumbprint?: string | null
          contribuyente_especial?: string | null
          created_at?: string
          direccion_establecimiento?: string | null
          direccion_matriz?: string | null
          establecimiento?: string
          forma_pago_sri?: string | null
          id?: string
          laboratorio_id: string
          nombre_comercial?: string | null
          obligado_contabilidad?: boolean
          porcentaje_iva?: number | null
          punto_emision?: string
          razon_social: string
          ruc: string
          secuencial_actual?: number
          updated_at?: string
        }
        Update: {
          ambiente?: string
          certificado_activo?: boolean
          certificado_fecha_caducidad?: string | null
          certificado_fecha_emision?: string | null
          certificado_issuer?: string | null
          certificado_nombre?: string | null
          certificado_password_encrypted?: string | null
          certificado_serial?: string | null
          certificado_storage_path?: string | null
          certificado_subject?: string | null
          certificado_thumbprint?: string | null
          contribuyente_especial?: string | null
          created_at?: string
          direccion_establecimiento?: string | null
          direccion_matriz?: string | null
          establecimiento?: string
          forma_pago_sri?: string | null
          id?: string
          laboratorio_id?: string
          nombre_comercial?: string | null
          obligado_contabilidad?: boolean
          porcentaje_iva?: number | null
          punto_emision?: string
          razon_social?: string
          ruc?: string
          secuencial_actual?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "configuracion_facturacion_electronica_laboratorio_fkey"
            columns: ["laboratorio_id"]
            isOneToOne: true
            referencedRelation: "configuracion_laboratorio"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "configuracion_facturacion_electronica_laboratorio_fkey"
            columns: ["laboratorio_id"]
            isOneToOne: true
            referencedRelation: "v_configuracion_laboratorio_facturacion"
            referencedColumns: ["laboratorio_id"]
          },
        ]
      }
      configuracion_laboratorio: {
        Row: {
          address: string
          email: string | null
          firma: string | null
          health_registry: string
          id: string
          legal_name: string | null
          logo: string | null
          name: string
          owner: string
          phone: string
          ruc: string
          schedule: string
          sello: string | null
          updated_at: string | null
        }
        Insert: {
          address: string
          email?: string | null
          firma?: string | null
          health_registry: string
          id?: string
          legal_name?: string | null
          logo?: string | null
          name: string
          owner: string
          phone: string
          ruc: string
          schedule: string
          sello?: string | null
          updated_at?: string | null
        }
        Update: {
          address?: string
          email?: string | null
          firma?: string | null
          health_registry?: string
          id?: string
          legal_name?: string | null
          logo?: string | null
          name?: string
          owner?: string
          phone?: string
          ruc?: string
          schedule?: string
          sello?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      facturas_electronicas: {
        Row: {
          ambiente: string
          clave_acceso: string
          cliente_email: string | null
          cliente_identificacion: string
          cliente_nombres: string
          configuracion_fe_id: string | null
          created_at: string
          id: string
          iva: number
          laboratorio_id: string
          ride_pdf_path: string | null
          secuencial: string
          sri_estado: string
          sri_fecha_autorizacion: string | null
          sri_mensaje: string | null
          sri_numero_autorizacion: string | null
          subtotal: number
          tipo_comprobante: string
          total: number
          updated_at: string
          xml_autorizado_path: string | null
          xml_firmado_path: string | null
          xml_generado_path: string | null
        }
        Insert: {
          ambiente: string
          clave_acceso: string
          cliente_email?: string | null
          cliente_identificacion: string
          cliente_nombres: string
          configuracion_fe_id?: string | null
          created_at?: string
          id?: string
          iva?: number
          laboratorio_id: string
          ride_pdf_path?: string | null
          secuencial: string
          sri_estado?: string
          sri_fecha_autorizacion?: string | null
          sri_mensaje?: string | null
          sri_numero_autorizacion?: string | null
          subtotal?: number
          tipo_comprobante?: string
          total?: number
          updated_at?: string
          xml_autorizado_path?: string | null
          xml_firmado_path?: string | null
          xml_generado_path?: string | null
        }
        Update: {
          ambiente?: string
          clave_acceso?: string
          cliente_email?: string | null
          cliente_identificacion?: string
          cliente_nombres?: string
          configuracion_fe_id?: string | null
          created_at?: string
          id?: string
          iva?: number
          laboratorio_id?: string
          ride_pdf_path?: string | null
          secuencial?: string
          sri_estado?: string
          sri_fecha_autorizacion?: string | null
          sri_mensaje?: string | null
          sri_numero_autorizacion?: string | null
          subtotal?: number
          tipo_comprobante?: string
          total?: number
          updated_at?: string
          xml_autorizado_path?: string | null
          xml_firmado_path?: string | null
          xml_generado_path?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "facturas_electronicas_config_fe_fkey"
            columns: ["configuracion_fe_id"]
            isOneToOne: false
            referencedRelation: "configuracion_facturacion_electronica"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "facturas_electronicas_config_fe_fkey"
            columns: ["configuracion_fe_id"]
            isOneToOne: false
            referencedRelation: "v_certificados_estado"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "facturas_electronicas_config_fe_fkey"
            columns: ["configuracion_fe_id"]
            isOneToOne: false
            referencedRelation: "v_configuracion_laboratorio_facturacion"
            referencedColumns: ["facturacion_id"]
          },
          {
            foreignKeyName: "facturas_electronicas_laboratorio_fkey"
            columns: ["laboratorio_id"]
            isOneToOne: false
            referencedRelation: "configuracion_laboratorio"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "facturas_electronicas_laboratorio_fkey"
            columns: ["laboratorio_id"]
            isOneToOne: false
            referencedRelation: "v_configuracion_laboratorio_facturacion"
            referencedColumns: ["laboratorio_id"]
          },
        ]
      }
      logs_acceso: {
        Row: {
          detalles: Json | null
          evento: string
          fecha: string | null
          id: string
          ip_address: string | null
          user_agent: string | null
          usuario_id: string | null
        }
        Insert: {
          detalles?: Json | null
          evento: string
          fecha?: string | null
          id?: string
          ip_address?: string | null
          user_agent?: string | null
          usuario_id?: string | null
        }
        Update: {
          detalles?: Json | null
          evento?: string
          fecha?: string | null
          id?: string
          ip_address?: string | null
          user_agent?: string | null
          usuario_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "logs_acceso_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
      movimientos_inventario: {
        Row: {
          created_at: string | null
          date: string
          id: string
          quantity: number
          reagent_id: string
          reason: string | null
          type: string
        }
        Insert: {
          created_at?: string | null
          date?: string
          id?: string
          quantity: number
          reagent_id: string
          reason?: string | null
          type: string
        }
        Update: {
          created_at?: string | null
          date?: string
          id?: string
          quantity?: number
          reagent_id?: string
          reason?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "movimientos_inventario_reagent_id_fkey"
            columns: ["reagent_id"]
            isOneToOne: false
            referencedRelation: "reactivos"
            referencedColumns: ["id"]
          },
        ]
      }
      orden_detalle: {
        Row: {
          codigo_porcentaje_iva: string
          id: string
          objeto_impuesto: string
          order_id: string
          porcentaje_iva: number
          price: number
          subtotal_sin_impuesto: number | null
          test_id: string
          total_linea: number | null
          valor_iva: number | null
        }
        Insert: {
          codigo_porcentaje_iva?: string
          id?: string
          objeto_impuesto?: string
          order_id: string
          porcentaje_iva?: number
          price: number
          subtotal_sin_impuesto?: number | null
          test_id: string
          total_linea?: number | null
          valor_iva?: number | null
        }
        Update: {
          codigo_porcentaje_iva?: string
          id?: string
          objeto_impuesto?: string
          order_id?: string
          porcentaje_iva?: number
          price?: number
          subtotal_sin_impuesto?: number | null
          test_id?: string
          total_linea?: number | null
          valor_iva?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "orden_detalle_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "ordenes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orden_detalle_test_id_fkey"
            columns: ["test_id"]
            isOneToOne: false
            referencedRelation: "pruebas"
            referencedColumns: ["id"]
          },
        ]
      }
      ordenes: {
        Row: {
          access_key: string
          clave_acceso_sri: string | null
          code: string
          created_at: string | null
          date: string
          factura_estado: string | null
          factura_fecha_autorizacion: string | null
          factura_id: string | null
          factura_mensaje: string | null
          factura_ride_pdf_path: string | null
          factura_xml_autorizado_path: string | null
          factura_xml_firmado_path: string | null
          factura_xml_path: string | null
          id: string
          numero_autorizacion_sri: string | null
          numero_factura: string | null
          patient_id: string
          status: string
          total: number
        }
        Insert: {
          access_key: string
          clave_acceso_sri?: string | null
          code: string
          created_at?: string | null
          date?: string
          factura_estado?: string | null
          factura_fecha_autorizacion?: string | null
          factura_id?: string | null
          factura_mensaje?: string | null
          factura_ride_pdf_path?: string | null
          factura_xml_autorizado_path?: string | null
          factura_xml_firmado_path?: string | null
          factura_xml_path?: string | null
          id?: string
          numero_autorizacion_sri?: string | null
          numero_factura?: string | null
          patient_id: string
          status?: string
          total?: number
        }
        Update: {
          access_key?: string
          clave_acceso_sri?: string | null
          code?: string
          created_at?: string | null
          date?: string
          factura_estado?: string | null
          factura_fecha_autorizacion?: string | null
          factura_id?: string | null
          factura_mensaje?: string | null
          factura_ride_pdf_path?: string | null
          factura_xml_autorizado_path?: string | null
          factura_xml_firmado_path?: string | null
          factura_xml_path?: string | null
          id?: string
          numero_autorizacion_sri?: string | null
          numero_factura?: string | null
          patient_id?: string
          status?: string
          total?: number
        }
        Relationships: [
          {
            foreignKeyName: "ordenes_factura_id_fkey"
            columns: ["factura_id"]
            isOneToOne: false
            referencedRelation: "facturas_electronicas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ordenes_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "pacientes"
            referencedColumns: ["id"]
          },
        ]
      }
      pacientes: {
        Row: {
          birth_date: string
          cedula: string
          created_at: string | null
          direccion: string | null
          email: string | null
          id: string
          name: string
          phone: string | null
          sex: string
        }
        Insert: {
          birth_date: string
          cedula: string
          created_at?: string | null
          direccion?: string | null
          email?: string | null
          id?: string
          name: string
          phone?: string | null
          sex: string
        }
        Update: {
          birth_date?: string
          cedula?: string
          created_at?: string | null
          direccion?: string | null
          email?: string | null
          id?: string
          name?: string
          phone?: string | null
          sex?: string
        }
        Relationships: []
      }
      parametros_prueba: {
        Row: {
          id: string
          name: string
          test_id: string
          unit: string
        }
        Insert: {
          id?: string
          name: string
          test_id: string
          unit: string
        }
        Update: {
          id?: string
          name?: string
          test_id?: string
          unit?: string
        }
        Relationships: [
          {
            foreignKeyName: "parametros_prueba_test_id_fkey"
            columns: ["test_id"]
            isOneToOne: false
            referencedRelation: "pruebas"
            referencedColumns: ["id"]
          },
        ]
      }
      prueba_reactivos: {
        Row: {
          id: string
          quantity_used: number
          reagent_id: string
          test_id: string
        }
        Insert: {
          id?: string
          quantity_used?: number
          reagent_id: string
          test_id: string
        }
        Update: {
          id?: string
          quantity_used?: number
          reagent_id?: string
          test_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "prueba_reactivos_reagent_id_fkey"
            columns: ["reagent_id"]
            isOneToOne: false
            referencedRelation: "reactivos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prueba_reactivos_test_id_fkey"
            columns: ["test_id"]
            isOneToOne: false
            referencedRelation: "pruebas"
            referencedColumns: ["id"]
          },
        ]
      }
      pruebas: {
        Row: {
          codigo_porcentaje_iva: string
          created_at: string | null
          description: string | null
          id: string
          name: string
          objeto_impuesto: string
          porcentaje_iva: number
          price: number
        }
        Insert: {
          codigo_porcentaje_iva?: string
          created_at?: string | null
          description?: string | null
          id?: string
          name: string
          objeto_impuesto?: string
          porcentaje_iva?: number
          price: number
        }
        Update: {
          codigo_porcentaje_iva?: string
          created_at?: string | null
          description?: string | null
          id?: string
          name?: string
          objeto_impuesto?: string
          porcentaje_iva?: number
          price?: number
        }
        Relationships: []
      }
      rangos_referencia: {
        Row: {
          id: string
          max_age: number
          max_value: number
          min_age: number
          min_value: number
          parameter_id: string
          sex: string
        }
        Insert: {
          id?: string
          max_age?: number
          max_value: number
          min_age?: number
          min_value: number
          parameter_id: string
          sex: string
        }
        Update: {
          id?: string
          max_age?: number
          max_value?: number
          min_age?: number
          min_value?: number
          parameter_id?: string
          sex?: string
        }
        Relationships: [
          {
            foreignKeyName: "rangos_referencia_parameter_id_fkey"
            columns: ["parameter_id"]
            isOneToOne: false
            referencedRelation: "parametros_prueba"
            referencedColumns: ["id"]
          },
        ]
      }
      reactivos: {
        Row: {
          code: string
          created_at: string | null
          current_stock: number
          expiration_date: string
          id: string
          min_stock: number
          name: string
          supplier: string
        }
        Insert: {
          code: string
          created_at?: string | null
          current_stock?: number
          expiration_date: string
          id?: string
          min_stock?: number
          name: string
          supplier: string
        }
        Update: {
          code?: string
          created_at?: string | null
          current_stock?: number
          expiration_date?: string
          id?: string
          min_stock?: number
          name?: string
          supplier?: string
        }
        Relationships: []
      }
      resultado_detalle: {
        Row: {
          applied_range_max: number | null
          applied_range_min: number | null
          id: string
          parameter_id: string
          result_id: string
          status: string
          value: number
        }
        Insert: {
          applied_range_max?: number | null
          applied_range_min?: number | null
          id?: string
          parameter_id: string
          result_id: string
          status: string
          value: number
        }
        Update: {
          applied_range_max?: number | null
          applied_range_min?: number | null
          id?: string
          parameter_id?: string
          result_id?: string
          status?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "resultado_detalle_parameter_id_fkey"
            columns: ["parameter_id"]
            isOneToOne: false
            referencedRelation: "parametros_prueba"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resultado_detalle_result_id_fkey"
            columns: ["result_id"]
            isOneToOne: false
            referencedRelation: "resultados"
            referencedColumns: ["id"]
          },
        ]
      }
      resultados: {
        Row: {
          created_at: string | null
          date: string
          id: string
          order_id: string
          test_id: string
        }
        Insert: {
          created_at?: string | null
          date?: string
          id?: string
          order_id: string
          test_id: string
        }
        Update: {
          created_at?: string | null
          date?: string
          id?: string
          order_id?: string
          test_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "resultados_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "ordenes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resultados_test_id_fkey"
            columns: ["test_id"]
            isOneToOne: false
            referencedRelation: "pruebas"
            referencedColumns: ["id"]
          },
        ]
      }
      usuarios: {
        Row: {
          created_at: string | null
          id: string
          name: string
          password_hash: string
          role: string
          two_factor_enabled: boolean | null
          two_factor_secret: string | null
          username: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
          password_hash: string
          role: string
          two_factor_enabled?: boolean | null
          two_factor_secret?: string | null
          username: string
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
          password_hash?: string
          role?: string
          two_factor_enabled?: boolean | null
          two_factor_secret?: string | null
          username?: string
        }
        Relationships: []
      }
    }
    Views: {
      v_certificados_estado: {
        Row: {
          certificado_fecha_caducidad: string | null
          certificado_nombre: string | null
          estado_certificado: string | null
          id: string | null
          laboratorio_id: string | null
        }
        Insert: {
          certificado_fecha_caducidad?: string | null
          certificado_nombre?: string | null
          estado_certificado?: never
          id?: string | null
          laboratorio_id?: string | null
        }
        Update: {
          certificado_fecha_caducidad?: string | null
          certificado_nombre?: string | null
          estado_certificado?: never
          id?: string | null
          laboratorio_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "configuracion_facturacion_electronica_laboratorio_fkey"
            columns: ["laboratorio_id"]
            isOneToOne: true
            referencedRelation: "configuracion_laboratorio"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "configuracion_facturacion_electronica_laboratorio_fkey"
            columns: ["laboratorio_id"]
            isOneToOne: true
            referencedRelation: "v_configuracion_laboratorio_facturacion"
            referencedColumns: ["laboratorio_id"]
          },
        ]
      }
      v_configuracion_laboratorio_facturacion: {
        Row: {
          address: string | null
          ambiente: string | null
          certificado_activo: boolean | null
          certificado_fecha_caducidad: string | null
          certificado_fecha_emision: string | null
          certificado_issuer: string | null
          certificado_nombre: string | null
          certificado_serial: string | null
          certificado_storage_path: string | null
          certificado_subject: string | null
          certificado_thumbprint: string | null
          contribuyente_especial: string | null
          establecimiento: string | null
          facturacion_created_at: string | null
          facturacion_id: string | null
          facturacion_ruc: string | null
          facturacion_updated_at: string | null
          health_registry: string | null
          laboratorio_id: string | null
          laboratorio_ruc: string | null
          laboratorio_updated_at: string | null
          logo: string | null
          name: string | null
          nombre_comercial: string | null
          obligado_contabilidad: boolean | null
          owner: string | null
          phone: string | null
          punto_emision: string | null
          razon_social: string | null
          schedule: string | null
          secuencial_actual: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      decrement_reagent_stock: {
        Args: { amount: number; row_id: string }
        Returns: undefined
      }
      login_usuario: {
        Args: { password_input: string; username_input: string }
        Returns: {
          id: string
          name: string
          role: string
          two_factor_enabled: boolean
          two_factor_secret: string
          username: string
        }[]
      }
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
