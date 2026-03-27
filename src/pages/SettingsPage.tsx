import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Building2,
  Save,
  Upload,
  Loader2,
  Image as ImageIcon,
  FileKey2,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  CalendarClock,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";

type LabConfig = {
  id: string;
  name: string;
  owner: string;
  address: string;
  ruc: string;
  health_registry: string;
  phone: string;
  schedule: string;
  logo: string;
  legal_name: string;
  email: string;
};

type FeConfig = {
  id: string;
  laboratorio_id: string;
  ambiente: "PRUEBAS" | "PRODUCCION";
  razon_social: string;
  nombre_comercial: string;
  ruc: string;
  obligado_contabilidad: boolean;
  contribuyente_especial: string;
  establecimiento: string;
  punto_emision: string;
  secuencial_actual: number;
  certificado_nombre: string;
  certificado_storage_path: string;
  certificado_thumbprint: string;
  certificado_serial: string;
  certificado_issuer: string;
  certificado_subject: string;
  certificado_fecha_emision: string;
  certificado_fecha_caducidad: string;
  certificado_activo: boolean;
};

type ProcessCertificateResponse = {
  ok: boolean;
  certificado_nombre?: string;
  certificado_storage_path?: string;
  certificado_thumbprint?: string;
  certificado_serial?: string;
  certificado_issuer?: string;
  certificado_subject?: string;
  certificado_fecha_emision?: string;
  certificado_fecha_caducidad?: string;
  message?: string;
};

const EMPTY_LAB_CONFIG: LabConfig = {
  id: "",
  name: "",
  owner: "",
  address: "",
  ruc: "",
  health_registry: "",
  phone: "",
  schedule: "",
  logo: "",
  legal_name: "",
  email: "",
};

const EMPTY_FE_CONFIG: FeConfig = {
  id: "",
  laboratorio_id: "",
  ambiente: "PRUEBAS",
  razon_social: "",
  nombre_comercial: "",
  ruc: "",
  obligado_contabilidad: false,
  contribuyente_especial: "",
  establecimiento: "001",
  punto_emision: "001",
  secuencial_actual: 1,
  certificado_nombre: "",
  certificado_storage_path: "",
  certificado_thumbprint: "",
  certificado_serial: "",
  certificado_issuer: "",
  certificado_subject: "",
  certificado_fecha_emision: "",
  certificado_fecha_caducidad: "",
  certificado_activo: true,
};

export default function SettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [processingCert, setProcessingCert] = useState(false);

  const [labConfig, setLabConfig] = useState<LabConfig>(EMPTY_LAB_CONFIG);
  const [feConfig, setFeConfig] = useState<FeConfig>(EMPTY_FE_CONFIG);

  const [logoFileLoading, setLogoFileLoading] = useState(false);
  const [certFile, setCertFile] = useState<File | null>(null);
  const [certPassword, setCertPassword] = useState("");

  useEffect(() => {
    fetchAllConfig();
  }, []);

  const fetchAllConfig = async () => {
    setLoading(true);
    try {
      const { data: labData, error: labError } = await supabase
        .from("configuracion_laboratorio")
        .select("*")
        .maybeSingle();

      if (labError) throw labError;

      if (labData) {
        const mappedLab: LabConfig = {
          id: labData.id ?? "",
          name: labData.name ?? "",
          owner: labData.owner ?? "",
          address: labData.address ?? "",
          ruc: labData.ruc ?? "",
          health_registry: labData.health_registry ?? "",
          phone: labData.phone ?? "",
          schedule: labData.schedule ?? "",
          logo: labData.logo ?? "",
          legal_name: labData.legal_name ?? "",
          email: labData.email ?? "",
        };

        setLabConfig(mappedLab);

        const { data: feData, error: feError } = await supabase
          .from("configuracion_facturacion_electronica")
          .select("*")
          .eq("laboratorio_id", mappedLab.id)
          .maybeSingle();

        if (feError) throw feError;

        if (feData) {
          setFeConfig({
            id: feData.id ?? "",
            laboratorio_id: feData.laboratorio_id ?? "",
            ambiente: feData?.ambiente === "PRODUCCION" ? "PRODUCCION" : "PRUEBAS",
            razon_social: feData.razon_social ?? "",
            nombre_comercial: feData.nombre_comercial ?? "",
            ruc: feData.ruc ?? "",
            obligado_contabilidad: feData.obligado_contabilidad ?? false,
            contribuyente_especial: feData.contribuyente_especial ?? "",
            establecimiento: feData.establecimiento ?? "001",
            punto_emision: feData.punto_emision ?? "001",
            secuencial_actual: feData.secuencial_actual ?? 1,
            certificado_nombre: feData.certificado_nombre ?? "",
            certificado_storage_path: feData.certificado_storage_path ?? "",
            certificado_thumbprint: feData.certificado_thumbprint ?? "",
            certificado_serial: feData.certificado_serial ?? "",
            certificado_issuer: feData.certificado_issuer ?? "",
            certificado_subject: feData.certificado_subject ?? "",
            certificado_fecha_emision: feData.certificado_fecha_emision ?? "",
            certificado_fecha_caducidad: feData.certificado_fecha_caducidad ?? "",
            certificado_activo: feData.certificado_activo ?? true,
          });
        } else {
          setFeConfig((prev) => ({
            ...prev,
            laboratorio_id: mappedLab.id,
            razon_social: mappedLab.legal_name || mappedLab.name || "",
            nombre_comercial: mappedLab.name || "",
            ruc: mappedLab.ruc || "",
          }));
        }
      }
    } catch (error: any) {
      toast.error("Error al cargar configuración: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLogoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 1024 * 1024) {
      toast.error("La imagen es muy pesada. Máximo 1MB.");
      return;
    }

    setLogoFileLoading(true);

    const reader = new FileReader();
    reader.onloadend = () => {
      setLabConfig((prev) => ({ ...prev, logo: reader.result as string }));
      setLogoFileLoading(false);
      toast.success("Logo cargado correctamente");
    };
    reader.onerror = () => {
      setLogoFileLoading(false);
      toast.error("No se pudo leer la imagen");
    };
    reader.readAsDataURL(file);
  };

  const handleCertFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const lowerName = file.name.toLowerCase();
    const validExtension = lowerName.endsWith(".p12") || lowerName.endsWith(".pfx");

    if (!validExtension) {
      toast.error("Debes seleccionar un archivo .p12 o .pfx");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error("El certificado es demasiado pesado. Máximo 5MB.");
      return;
    }

    setCertFile(file);
    setFeConfig((prev) => ({
      ...prev,
      certificado_nombre: file.name,
    }));

    toast.success("Certificado seleccionado correctamente");
  };

  const certificateStatus = useMemo(() => {
    const expiry = feConfig.certificado_fecha_caducidad;

    if (!expiry) {
      return {
        type: "none" as const,
        label: "Sin fecha",
        message: "Aún no se ha registrado la fecha de caducidad del certificado.",
      };
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const exp = new Date(expiry + "T00:00:00");
    const diffMs = exp.getTime() - today.getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      return {
        type: "expired" as const,
        label: "Caducado",
        message: "El certificado ya está caducado.",
      };
    }

    if (diffDays <= 30) {
      return {
        type: "warning" as const,
        label: "Por caducar",
        message: `El certificado vence en ${diffDays} día(s).`,
      };
    }

    return {
      type: "valid" as const,
      label: "Vigente",
      message: `El certificado está vigente. Faltan ${diffDays} día(s) para su caducidad.`,
    };
  }, [feConfig.certificado_fecha_caducidad]);

  const validateBeforeSave = () => {
    if (!labConfig.name.trim()) {
      toast.error("Debes ingresar el nombre comercial del laboratorio");
      return false;
    }

    if (!labConfig.owner.trim()) {
      toast.error("Debes ingresar el representante legal");
      return false;
    }

    if (!labConfig.address.trim()) {
      toast.error("Debes ingresar la dirección");
      return false;
    }

    if (!labConfig.ruc.trim()) {
      toast.error("Debes ingresar el RUC");
      return false;
    }

    if (!feConfig.razon_social.trim()) {
      toast.error("Debes ingresar la razón social para facturación electrónica");
      return false;
    }

    if (!feConfig.ruc.trim()) {
      toast.error("Debes ingresar el RUC en la configuración de facturación electrónica");
      return false;
    }

    if (feConfig.establecimiento.trim().length !== 3) {
      toast.error("El establecimiento debe tener 3 dígitos");
      return false;
    }

    if (feConfig.punto_emision.trim().length !== 3) {
      toast.error("El punto de emisión debe tener 3 dígitos");
      return false;
    }

    return true;
  };

  const saveLabConfig = async (): Promise<string> => {
    const payload = {
      name: labConfig.name.trim(),
      owner: labConfig.owner.trim(),
      address: labConfig.address.trim(),
      ruc: labConfig.ruc.trim(),
      health_registry: labConfig.health_registry.trim(),
      phone: labConfig.phone.trim(),
      schedule: labConfig.schedule.trim(),
      logo: labConfig.logo,
      legal_name: labConfig.legal_name.trim() || null,
      email: labConfig.email.trim() || null,
    };

    if (labConfig.id) {
      const { error } = await supabase
        .from("configuracion_laboratorio")
        .update(payload)
        .eq("id", labConfig.id);

      if (error) throw error;
      return labConfig.id;
    }

    const { data, error } = await supabase
      .from("configuracion_laboratorio")
      .insert([payload])
      .select("id")
      .single();

    if (error) throw error;
    return data.id as string;
  };

  const saveFeConfig = async (laboratorioId: string) => {
    const payload = {
      laboratorio_id: laboratorioId,
      ambiente: feConfig.ambiente,
      razon_social: feConfig.razon_social.trim(),
      nombre_comercial: feConfig.nombre_comercial.trim() || null,
      ruc: feConfig.ruc.trim(),
      obligado_contabilidad: feConfig.obligado_contabilidad,
      contribuyente_especial: feConfig.contribuyente_especial.trim() || null,
      establecimiento: feConfig.establecimiento.trim(),
      punto_emision: feConfig.punto_emision.trim(),
      secuencial_actual: Number(feConfig.secuencial_actual) || 1,
      certificado_nombre: feConfig.certificado_nombre || null,
      certificado_storage_path: feConfig.certificado_storage_path || null,
      certificado_thumbprint: feConfig.certificado_thumbprint || null,
      certificado_serial: feConfig.certificado_serial || null,
      certificado_issuer: feConfig.certificado_issuer || null,
      certificado_subject: feConfig.certificado_subject || null,
      certificado_fecha_emision: feConfig.certificado_fecha_emision || null,
      certificado_fecha_caducidad: feConfig.certificado_fecha_caducidad || null,
      certificado_activo: feConfig.certificado_activo,
    };

    if (feConfig.id) {
      const { error } = await supabase
        .from("configuracion_facturacion_electronica")
        .update(payload)
        .eq("id", feConfig.id);

      if (error) throw error;
    } else {
      const { data, error } = await supabase
        .from("configuracion_facturacion_electronica")
        .insert([payload])
        .select("id")
        .single();

      if (error) throw error;

      setFeConfig((prev) => ({
        ...prev,
        id: data.id as string,
      }));
    }
  };

  const handleProcessCertificate = async () => {
    if (!certFile) {
      toast.error("Selecciona primero un archivo .p12 o .pfx");
      return;
    }

    if (!certPassword.trim()) {
      toast.error("Ingresa la clave del certificado");
      return;
    }

    if (!labConfig.name.trim() || !labConfig.owner.trim() || !labConfig.address.trim() || !labConfig.ruc.trim()) {
      toast.error("Completa y guarda primero los datos principales del laboratorio");
      return;
    }

    setProcessingCert(true);

    try {
      const laboratorioId = labConfig.id || (await saveLabConfig());

      if (laboratorioId !== labConfig.id) {
        setLabConfig((prev) => ({ ...prev, id: laboratorioId }));
      }

      const formData = new FormData();
      formData.append("laboratorio_id", laboratorioId);
      formData.append("password", certPassword.trim());
      formData.append("file", certFile);

      const { data, error } = await supabase.functions.invoke("procesar-certificado-fe", {
        body: formData,
      });

      if (error) throw error;

      const result = data as ProcessCertificateResponse;

      if (!result?.ok) {
        throw new Error(result?.message || "No se pudo procesar el certificado");
      }

      setFeConfig((prev) => ({
        ...prev,
        laboratorio_id: laboratorioId,
        certificado_nombre: result.certificado_nombre || prev.certificado_nombre,
        certificado_storage_path: result.certificado_storage_path || prev.certificado_storage_path,
        certificado_thumbprint: result.certificado_thumbprint || "",
        certificado_serial: result.certificado_serial || "",
        certificado_issuer: result.certificado_issuer || "",
        certificado_subject: result.certificado_subject || "",
        certificado_fecha_emision: result.certificado_fecha_emision || "",
        certificado_fecha_caducidad: result.certificado_fecha_caducidad || "",
        certificado_activo: true,
      }));

      toast.success("Certificado procesado correctamente");
    } catch (error: any) {
      toast.error("Error al procesar certificado: " + error.message);
    } finally {
      setProcessingCert(false);
    }
  };

  const handleSave = async () => {
    if (!validateBeforeSave()) return;

    setSaving(true);
    try {
      const laboratorioId = await saveLabConfig();

      if (laboratorioId !== labConfig.id) {
        setLabConfig((prev) => ({ ...prev, id: laboratorioId }));
      }

      await saveFeConfig(laboratorioId);

      toast.success("Configuración guardada exitosamente");
      await fetchAllConfig();
    } catch (error: any) {
      toast.error("Error al guardar: " + error.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in max-w-5xl">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold">Configuración del Laboratorio</h1>
          <p className="text-muted-foreground text-sm">
            Información general, firma electrónica y parámetros de facturación.
          </p>
        </div>

        <Button
          onClick={handleSave}
          disabled={saving || processingCert}
          className="gradient-clinical text-primary-foreground border-0 shadow-md"
        >
          {saving ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Save className="w-4 h-4 mr-2" />
          )}
          Guardar Cambios
        </Button>
      </div>

      <Card className="border-slate-200">
        <CardHeader className="border-b border-slate-50 bg-slate-50/50">
          <CardTitle className="font-display text-lg flex items-center gap-2">
            <Building2 className="w-5 h-5 text-primary" />
            Identidad del Laboratorio
          </CardTitle>
        </CardHeader>

        <CardContent className="space-y-6 pt-6">
          <div className="flex flex-col items-center gap-4 p-4 border-2 border-dashed rounded-xl bg-slate-50/50">
            {labConfig.logo ? (
              <div className="relative group">
                <img
                  src={labConfig.logo}
                  alt="Logo Preview"
                  className="h-24 w-auto object-contain rounded-lg shadow-sm bg-white p-2"
                />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center rounded-lg transition-opacity cursor-pointer">
                  <Label htmlFor="logo-upload" className="text-white text-xs cursor-pointer">
                    Cambiar
                  </Label>
                </div>
              </div>
            ) : (
              <div className="h-20 w-20 rounded-full bg-slate-200 flex items-center justify-center text-slate-400">
                <ImageIcon className="w-10 h-10" />
              </div>
            )}

            <div className="text-center">
              <Label htmlFor="logo-upload" className="cursor-pointer">
                <div className="flex items-center gap-2 text-primary font-bold text-sm hover:underline">
                  {logoFileLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Upload className="w-4 h-4" />
                  )}
                  Subir Imagen de Logo
                </div>
                <p className="text-[10px] text-muted-foreground mt-1">
                  PNG, JPG (Máx. 1MB - Recomendado 400x400px)
                </p>
              </Label>
              <Input
                id="logo-upload"
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleLogoFileChange}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Nombre Comercial
              </Label>
              <Input
                value={labConfig.name}
                onChange={(e) => setLabConfig((f) => ({ ...f, name: e.target.value }))}
                placeholder="Ej: Laboratorio Clínico Central"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Razón Social
              </Label>
              <Input
                value={labConfig.legal_name}
                onChange={(e) => setLabConfig((f) => ({ ...f, legal_name: e.target.value }))}
                placeholder="Ej: Laboratorio Clínico Central S.A."
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Representante Legal
              </Label>
              <Input
                value={labConfig.owner}
                onChange={(e) => setLabConfig((f) => ({ ...f, owner: e.target.value }))}
                placeholder="Nombre del propietario"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Correo Electrónico
              </Label>
              <Input
                type="email"
                value={labConfig.email}
                onChange={(e) => setLabConfig((f) => ({ ...f, email: e.target.value }))}
                placeholder="correo@laboratorio.com"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Dirección Física
            </Label>
            <Input
              value={labConfig.address}
              onChange={(e) => setLabConfig((f) => ({ ...f, address: e.target.value }))}
              placeholder="Calle, Ciudad, Provincia"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                RUC
              </Label>
              <Input
                value={labConfig.ruc}
                onChange={(e) => setLabConfig((f) => ({ ...f, ruc: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Registro Sanitario
              </Label>
              <Input
                value={labConfig.health_registry}
                onChange={(e) =>
                  setLabConfig((f) => ({ ...f, health_registry: e.target.value }))
                }
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Teléfono de Contacto
              </Label>
              <Input
                value={labConfig.phone}
                onChange={(e) => setLabConfig((f) => ({ ...f, phone: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Horario
              </Label>
              <Input
                value={labConfig.schedule}
                onChange={(e) => setLabConfig((f) => ({ ...f, schedule: e.target.value }))}
                placeholder="Lun-Vie 08:00 - 17:00"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-slate-200">
        <CardHeader className="border-b border-slate-50 bg-slate-50/50">
          <CardTitle className="font-display text-lg flex items-center gap-2">
            <FileKey2 className="w-5 h-5 text-primary" />
            Facturación Electrónica y Firma Digital
          </CardTitle>
        </CardHeader>

        <CardContent className="space-y-6 pt-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Ambiente
              </Label>
              <select
                className="w-full border rounded-md px-3 py-2 bg-background"
                value={feConfig.ambiente}
                onChange={(e) =>
                  setFeConfig((prev) => ({
                    ...prev,
                    ambiente: e.target.value as "PRUEBAS" | "PRODUCCION",
                  }))
                }
              >
                <option value="PRUEBAS">PRUEBAS</option>
                <option value="PRODUCCION">PRODUCCIÓN</option>
              </select>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Establecimiento
              </Label>
              <Input
                maxLength={3}
                value={feConfig.establecimiento}
                onChange={(e) =>
                  setFeConfig((prev) => ({
                    ...prev,
                    establecimiento: e.target.value.replace(/\D/g, "").slice(0, 3),
                  }))
                }
                placeholder="001"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Punto de Emisión
              </Label>
              <Input
                maxLength={3}
                value={feConfig.punto_emision}
                onChange={(e) =>
                  setFeConfig((prev) => ({
                    ...prev,
                    punto_emision: e.target.value.replace(/\D/g, "").slice(0, 3),
                  }))
                }
                placeholder="001"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Razón Social
              </Label>
              <Input
                value={feConfig.razon_social}
                onChange={(e) =>
                  setFeConfig((prev) => ({ ...prev, razon_social: e.target.value }))
                }
                placeholder="Razón social usada en comprobantes"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Nombre Comercial
              </Label>
              <Input
                value={feConfig.nombre_comercial}
                onChange={(e) =>
                  setFeConfig((prev) => ({ ...prev, nombre_comercial: e.target.value }))
                }
                placeholder="Nombre comercial"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                RUC
              </Label>
              <Input
                value={feConfig.ruc}
                onChange={(e) => setFeConfig((prev) => ({ ...prev, ruc: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Secuencial Actual
              </Label>
              <Input
                type="number"
                min={1}
                value={feConfig.secuencial_actual}
                onChange={(e) =>
                  setFeConfig((prev) => ({
                    ...prev,
                    secuencial_actual: Number(e.target.value) || 1,
                  }))
                }
              />
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Contribuyente Especial
              </Label>
              <Input
                value={feConfig.contribuyente_especial}
                onChange={(e) =>
                  setFeConfig((prev) => ({
                    ...prev,
                    contribuyente_especial: e.target.value,
                  }))
                }
                placeholder="Opcional"
              />
            </div>
          </div>

          <div className="flex items-center gap-3 rounded-xl border bg-slate-50 p-4">
            <input
              id="obligado_contabilidad"
              type="checkbox"
              checked={feConfig.obligado_contabilidad}
              onChange={(e) =>
                setFeConfig((prev) => ({
                  ...prev,
                  obligado_contabilidad: e.target.checked,
                }))
              }
              className="h-4 w-4"
            />
            <Label htmlFor="obligado_contabilidad" className="cursor-pointer">
              Obligado a llevar contabilidad
            </Label>
          </div>

          <div className="rounded-xl border border-dashed p-5 bg-slate-50/40">
            <div className="flex flex-col gap-4">
              <div>
                <h3 className="font-semibold text-sm flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-primary" />
                  Certificado de Firma Electrónica
                </h3>
                <p className="text-xs text-muted-foreground mt-1">
                  Selecciona el archivo .p12 o .pfx y luego procesa el certificado para obtener los
                  metadatos automáticamente.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Archivo del Certificado
                  </Label>
                  <Input
                    type="file"
                    accept=".p12,.pfx,application/x-pkcs12,application/octet-stream"
                    onChange={handleCertFileChange}
                  />
                  <p className="text-xs text-muted-foreground">
                    {certFile
                      ? `Nuevo archivo seleccionado: ${certFile.name}`
                      : feConfig.certificado_nombre
                      ? `Actual: ${feConfig.certificado_nombre}`
                      : "No hay certificado cargado"}
                  </p>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Clave del Certificado
                  </Label>
                  <Input
                    type="password"
                    autoComplete="new-password"
                    value={certPassword}
                    onChange={(e) => setCertPassword(e.target.value)}
                    placeholder="********"
                  />
                  <p className="text-xs text-muted-foreground">
                    Por seguridad, esta clave no se vuelve a mostrar.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleProcessCertificate}
                  disabled={processingCert || saving}
                  className="gap-2"
                >
                  {processingCert ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <RefreshCw className="w-4 h-4" />
                  )}
                  Procesar Certificado
                </Button>
              </div>

              {feConfig.certificado_storage_path && (
                <div className="text-xs text-muted-foreground break-all">
                  Ruta almacenada: {feConfig.certificado_storage_path}
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Fecha de Emisión
              </Label>
              <Input
                type="date"
                value={feConfig.certificado_fecha_emision}
                readOnly
              />
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Fecha de Caducidad
              </Label>
              <Input
                type="date"
                value={feConfig.certificado_fecha_caducidad}
                readOnly
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Thumbprint
              </Label>
              <Input
                value={feConfig.certificado_thumbprint}
                readOnly
                placeholder="Se llena automáticamente"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Serial
              </Label>
              <Input
                value={feConfig.certificado_serial}
                readOnly
                placeholder="Se llena automáticamente"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Issuer
            </Label>
            <Input
              value={feConfig.certificado_issuer}
              readOnly
              placeholder="Se llena automáticamente"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Subject
            </Label>
            <Input
              value={feConfig.certificado_subject}
              readOnly
              placeholder="Se llena automáticamente"
            />
          </div>

          <div
            className={[
              "rounded-xl border p-4 flex gap-3 items-start",
              certificateStatus.type === "expired"
                ? "border-red-200 bg-red-50"
                : certificateStatus.type === "warning"
                ? "border-amber-200 bg-amber-50"
                : certificateStatus.type === "valid"
                ? "border-emerald-200 bg-emerald-50"
                : "border-slate-200 bg-slate-50",
            ].join(" ")}
          >
            {certificateStatus.type === "expired" ? (
              <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
            ) : certificateStatus.type === "warning" ? (
              <CalendarClock className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            ) : certificateStatus.type === "valid" ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            ) : (
              <ShieldCheck className="w-5 h-5 text-slate-600 shrink-0 mt-0.5" />
            )}

            <div className="text-sm">
              <div className="font-semibold">{certificateStatus.label}</div>
              <div className="text-muted-foreground">{certificateStatus.message}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="bg-blue-50 border border-blue-100 p-4 rounded-xl flex gap-3 items-start">
        <Building2 className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
        <p className="text-xs text-blue-800 leading-relaxed">
          <strong>Nota:</strong> este componente asume que existe una Edge Function llamada
          <strong> procesar-certificado-fe</strong> que recibe el archivo y la clave, extrae los
          metadatos y guarda la clave cifrada del lado servidor.
        </p>
      </div>
    </div>
  );
}