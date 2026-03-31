import React, { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  FlaskConical,
  FileText,
  Search,
  Lock,
  Loader2,
  ChevronLeft,
  Download,
  CalendarDays,
  CreditCard,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";
import {
  generateResultsPDF,
  PdfLabConfig,
  PdfOrder,
  PdfOrderResult,
  PdfPatient,
} from "@/lib/pdfGenerator";

declare global {
  interface Window {
    PPaymentButtonBox?: any;
  }
}

type LabIdentity = {
  name: string;
  logo: string | null;
};

type ResultType = "numeric" | "boolean" | "text";

const PAYPHONE_TOKEN = import.meta.env.VITE_PAYPHONE_TOKEN || "";
const PAYPHONE_STORE_ID = import.meta.env.VITE_PAYPHONE_STORE_ID || "";

export default function PatientPortalPage() {
  const [code, setCode] = useState("");
  const [accessKey, setAccessKey] = useState("");
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [confirmingPayment, setConfirmingPayment] = useState(false);
  const [payphoneReady, setPayphoneReady] = useState(false);
  const [error, setError] = useState("");
  const [labConfig, setLabConfig] = useState<LabIdentity>({
    name: "BioAnalítica",
    logo: null,
  });
  const [foundOrder, setFoundOrder] = useState<any>(null);

  const paymentContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const fetchLabIdentity = async () => {
      const { data, error } = await supabase
        .from("configuracion_laboratorio")
        .select("name, logo")
        .maybeSingle();

      if (error) {
        console.error("Error cargando configuración del laboratorio:", error);
        return;
      }

      if (data) {
        setLabConfig({
          name: data.name || "BioAnalítica",
          logo: data.logo || null,
        });
      }
    };

    fetchLabIdentity();
  }, []);

  useEffect(() => {
    const linkId = "payphone-box-css";
    const scriptId = "payphone-box-js";

    if (!document.getElementById(linkId)) {
      const link = document.createElement("link");
      link.id = linkId;
      link.rel = "stylesheet";
      link.href =
        "https://cdn.payphonetodoesposible.com/box/v1.1/payphone-payment-box.css";
      document.head.appendChild(link);
    }

    const existingScript = document.getElementById(
      scriptId
    ) as HTMLScriptElement | null;

    if (existingScript) {
      setPayphoneReady(true);
      return;
    }

    const script = document.createElement("script");
    script.id = scriptId;
    script.type = "module";
    script.src =
      "https://cdn.payphonetodoesposible.com/box/v1.1/payphone-payment-box.js";
    script.onload = () => setPayphoneReady(true);
    script.onerror = () => {
      console.error("No se pudo cargar la Cajita de Pagos de Payphone");
      setPayphoneReady(false);
    };

    document.body.appendChild(script);
  }, []);

  useEffect(() => {
    const confirmFromUrl = async () => {
      const params = new URLSearchParams(window.location.search);
      const id = params.get("id");
      const clientTransactionId = params.get("clientTransactionId");

      if (!id || !clientTransactionId) return;

      try {
        setConfirmingPayment(true);

        const { data, error } = await supabase.functions.invoke(
          "payphone-verify",
          {
            body: {
              id: Number(id),
              clientTransactionId,
            },
          }
        );

        if (error) throw error;

        if (data?.approved) {
          toast.success(data?.message || "Pago confirmado correctamente");

          const nextCode =
            data?.orderCode || localStorage.getItem("portal_last_code") || "";
          const nextKey =
            data?.accessKey ||
            localStorage.getItem("portal_last_access_key") ||
            "";

          if (nextCode && nextKey) {
            setCode(nextCode);
            setAccessKey(nextKey);
            await searchOrder(nextCode, nextKey);
          }
        } else {
          toast.error(data?.message || "No se pudo confirmar el pago");
        }
      } catch (err: any) {
        console.error(err);
        toast.error(
          "No se pudo confirmar el pago automáticamente: " +
            (err?.message || "error desconocido")
        );
      } finally {
        setConfirmingPayment(false);

        const cleanUrl = new URL(window.location.href);
        cleanUrl.searchParams.delete("id");
        cleanUrl.searchParams.delete("clientTransactionId");
        window.history.replaceState({}, "", cleanUrl.toString());
      }
    };

    confirmFromUrl();
  }, []);

  const safeNumber = (value: any, fallback = 0): number => {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  };

  const round2 = (value: number) => Number(value.toFixed(2));

  const totalAmount = useMemo(
    () => round2(safeNumber(foundOrder?.total, 0)),
    [foundOrder]
  );

  const paidAmount = useMemo(
    () => round2(safeNumber(foundOrder?.paid_amount, 0)),
    [foundOrder]
  );

  const pendingAmount = useMemo(
    () => round2(Math.max(totalAmount - paidAmount, 0)),
    [totalAmount, paidAmount]
  );

  const isPaid = useMemo(() => {
    return foundOrder ? paidAmount >= totalAmount && totalAmount > 0 : false;
  }, [foundOrder, paidAmount, totalAmount]);

  const isCompleted = useMemo(() => {
    return foundOrder?.status === "completed";
  }, [foundOrder]);

  const searchOrder = async (codeValue = code, accessKeyValue = accessKey) => {
    if (!codeValue.trim() || !accessKeyValue.trim()) {
      setError("Por favor, complete ambos campos");
      return;
    }

    setLoading(true);
    setError("");

    try {
      localStorage.setItem(
        "portal_last_code",
        codeValue.trim().toUpperCase()
      );
      localStorage.setItem(
        "portal_last_access_key",
        accessKeyValue.trim().toUpperCase()
      );

      const { data: order, error: orderError } = await supabase
        .from("ordenes")
        .select(`
          *,
          pacientes (*),
          orden_detalle (
            id,
            price,
            subtotal_sin_impuesto,
            valor_iva,
            total_linea,
            porcentaje_iva,
            codigo_porcentaje_iva
          ),
          resultados (
            *,
            resultado_detalle (
              *,
              parametros_prueba (
                *,
                rangos_referencia (*)
              )
            ),
            pruebas (*)
          )
        `)
        .eq("code", codeValue.trim().toUpperCase())
        .eq("access_key", accessKeyValue.trim().toUpperCase())
        .maybeSingle();

      if (orderError) throw orderError;

      if (!order) {
        setError(
          "No se encontró ninguna orden con esos datos. Verifique su ticket."
        );
        setFoundOrder(null);
        return;
      }

      const normalized = {
        ...order,
        resultados: (order.resultados || []).map((res: any) => ({
          ...res,
          resultado_detalle: [...(res.resultado_detalle || [])].sort(
            (a: any, b: any) =>
              Number(a.parametros_prueba?.sort_order ?? 0) -
              Number(b.parametros_prueba?.sort_order ?? 0)
          ),
        })),
      };

      setFoundOrder(normalized);
    } catch (err: any) {
      console.error(err);
      setError("Error al conectar con el servidor");
      setFoundOrder(null);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async () => {
    await searchOrder();
  };

  const calcAge = (birthDate: string) => {
    if (!birthDate) return 0;
    const diff = Date.now() - new Date(birthDate).getTime();
    return Math.floor(diff / (365.25 * 24 * 60 * 60 * 1000));
  };

  const formatDisplayDate = (dateValue?: string | null) => {
    if (!dateValue) return "";
    const d = new Date(dateValue);
    return d.toLocaleDateString("es-EC");
  };

  const buildPrintableDate = (dateValue?: string | null) => {
    if (!dateValue) return new Date().toLocaleDateString("es-EC");
    return new Date(dateValue).toLocaleDateString("es-EC");
  };

  const getResultType = (det: any): ResultType => {
    return (det?.parametros_prueba?.result_type || "numeric") as ResultType;
  };

  const getDisplayValue = (det: any) => {
    const resultType = getResultType(det);

    if (resultType === "numeric") {
      const value = det.value_numeric;
      return value !== null && value !== undefined && value !== ""
        ? String(value)
        : "";
    }

    if (resultType === "boolean") {
      const boolValue = det.value_boolean;
      if (boolValue === null || boolValue === undefined) return "";

      return boolValue
        ? det.parametros_prueba?.bool_true_label || "Positivo"
        : det.parametros_prueba?.bool_false_label || "Negativo";
    }

    return det.value_text || "";
  };

  const getDisplayUnit = (det: any) => {
    const resultType = getResultType(det);
    if (resultType !== "numeric") return "";
    return det.parametros_prueba?.unit || "";
  };

  const hasRange = (det: any) => {
    return (
      det.applied_range_min !== null &&
      det.applied_range_min !== undefined &&
      det.applied_range_max !== null &&
      det.applied_range_max !== undefined
    );
  };

  const getBadgeLabel = (det: any) => {
    switch (det.status) {
      case "normal":
        return "✓ Normal";
      case "high":
        return "Alto ↑";
      case "low":
        return "Bajo ↓";
      case "positive":
        return det.parametros_prueba?.bool_true_label || "Positivo";
      case "negative":
        return det.parametros_prueba?.bool_false_label || "Negativo";
      case "text":
        return "Texto";
      default:
        return "";
    }
  };

  const getBadgeClass = (det: any) => {
    switch (det.status) {
      case "normal":
        return "bg-emerald-50 text-emerald-600 border-emerald-100";
      case "high":
        return "bg-rose-50 text-rose-600 border-rose-100";
      case "low":
        return "bg-amber-50 text-amber-600 border-amber-100";
      case "positive":
        return "bg-rose-50 text-rose-600 border-rose-100";
      case "negative":
        return "bg-emerald-50 text-emerald-600 border-emerald-100";
      case "text":
        return "bg-slate-100 text-slate-700 border-slate-200";
      default:
        return "bg-slate-100 text-slate-700 border-slate-200";
    }
  };

  const firstResultDate = useMemo(() => {
    if (!foundOrder?.resultados?.length) return foundOrder?.created_at || null;

    const dates = foundOrder.resultados
      .map((r: any) => r.date)
      .filter(Boolean);

    return dates[0] || foundOrder?.created_at || null;
  }, [foundOrder]);

  useEffect(() => {
    if (!foundOrder || isPaid || !payphoneReady || !paymentContainerRef.current)
      return;

    if (!PAYPHONE_TOKEN || !PAYPHONE_STORE_ID) {
      return;
    }

    const container = paymentContainerRef.current;
    container.innerHTML = "";

    const balanceCents = Math.round(pendingAmount * 100);

    if (balanceCents <= 0) return;
    if (!window.PPaymentButtonBox) return;

    const normalizeEcuadorPhoneForPayphone = (
      raw: any
    ): string | undefined => {
      const original = String(raw || "").trim();
      if (!original) return undefined;

      let cleaned = original.replace(/\s+/g, "").replace(/[^\d+]/g, "");

      if (cleaned.startsWith("+593")) {
        const rest = cleaned.slice(4).replace(/\D/g, "");
        if (/^\d{9}$/.test(rest)) {
          return `+593${rest}`;
        }
        return undefined;
      }

      cleaned = cleaned.replace(/\D/g, "");

      if (/^09\d{8}$/.test(cleaned)) {
        return `+593${cleaned.slice(1)}`;
      }

      if (/^9\d{8}$/.test(cleaned)) {
        return `+593${cleaned}`;
      }

      return undefined;
    };

    const patientPhone = normalizeEcuadorPhoneForPayphone(
      foundOrder?.pacientes?.phone
    );

    const normalizeEmail = (raw: any): string | undefined => {
      const value = String(raw || "").trim().toLowerCase();
      if (!value) return undefined;
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
        ? value
        : undefined;
    };

    const normalizeDocumentId = (raw: any): string | undefined => {
      const value = String(raw || "").replace(/\D/g, "");
      if (/^\d{10}$/.test(value)) return value;
      if (/^\d{13}$/.test(value)) return value;
      return undefined;
    };

    const patientEmail = normalizeEmail(foundOrder?.pacientes?.email);
    const patientDocument = normalizeDocumentId(foundOrder?.pacientes?.cedula);

    const clientTransactionId = `${foundOrder.code}-${Date.now()}`
      .replace(/[^A-Za-z0-9-]/g, "")
      .slice(0, 30);

    try {
      const ppb = new window.PPaymentButtonBox({
        token: PAYPHONE_TOKEN,
        clientTransactionId,
        amount: balanceCents,
        amountWithoutTax: balanceCents,
        currency: "USD",
        storeId: PAYPHONE_STORE_ID,
        reference: `Pago orden ${foundOrder.code}`,
        lang: "es",
        defaultMethod: "card",
        timeZone: -5,
        lat: "-2.13404",
        lng: "-79.59415",
        optionalParameter: foundOrder.id,
        phoneNumber: patientPhone || undefined,
        email: patientEmail || undefined,
        documentId: patientDocument || undefined,
        identificationType: 1,
      });

      ppb.render(container.id);
    } catch (err) {
      console.error("Error renderizando Payphone:", err);
    }
  }, [foundOrder, isPaid, payphoneReady, pendingAmount]);

  const handleDownload = async () => {
    if (!foundOrder) return;

    if (!isPaid) {
      toast.error(
        `No puede descargar sus resultados mientras exista un saldo pendiente de $${pendingAmount.toFixed(
          2
        )}`
      );
      return;
    }

    if (!isCompleted) {
      toast.error("Sus resultados todavía están siendo procesados");
      return;
    }

    setDownloading(true);

    try {
      toast.info("Generando reporte PDF oficial...");

      const { data: configData, error: configError } = await supabase
        .from("configuracion_laboratorio")
        .select("*")
        .maybeSingle();

      if (configError) throw configError;
      if (!configData)
        throw new Error("No existe la configuración del laboratorio");

      const pdfConfig: PdfLabConfig = {
        name: configData.name || "LABORATORIO CLÍNICO",
        owner: configData.owner || "",
        address: configData.address || "",
        ruc: configData.ruc || "",
        healthRegistry: configData.health_registry || "",
        phone: configData.phone || "",
        schedule: configData.schedule || "",
        logo: configData.logo || "",
        firma: configData.firma || "",
        sello: configData.sello || "",
      };

      const pdfPatient: PdfPatient = {
        name: foundOrder.pacientes?.name || "",
        cedula: foundOrder.pacientes?.cedula || "",
        phone: foundOrder.pacientes?.phone || "",
        sex: foundOrder.pacientes?.sex === "F" ? "F" : "M",
        birth_date: foundOrder.pacientes?.birth_date || null,
      };

      const pdfOrder: PdfOrder = {
        code: foundOrder.code || "",
        accessKey: foundOrder.access_key || "",
        date: buildPrintableDate(firstResultDate),
        created_at: firstResultDate || foundOrder.created_at || null,
      };

      const orderTests =
        foundOrder.resultados?.map((res: any) => ({
          id: res.pruebas?.id || res.test_id || res.id,
          name: res.pruebas?.name || "Examen",
        })) || [];

      const orderResults: PdfOrderResult[] =
        foundOrder.resultados?.map((res: any) => ({
          id: res.id,
          testId: res.pruebas?.id || res.test_id || res.id,
          testName: res.pruebas?.name || "Examen",
          notes: res.notes || res.observacion || res.resultado_texto || "",
          details:
            res.resultado_detalle?.map((det: any) => ({
              id: det.id,
              parameterId: det.parametros_prueba?.id || det.parameter_id || null,
              parameterName:
                det.parametros_prueba?.name ||
                det.name ||
                det.parametro ||
                "Resultado",
              value: getDisplayValue(det),
              appliedRangeMin: det.applied_range_min ?? null,
              appliedRangeMax: det.applied_range_max ?? null,
              unit: getDisplayUnit(det),
              status: det.status || "normal",
              observation: det.observation || "",
              resultType: getResultType(det),
            })) || [],
        })) || [];

      generateResultsPDF(
        pdfOrder,
        pdfPatient,
        orderTests,
        orderResults,
        pdfConfig
      );

      toast.success("PDF generado correctamente");
    } catch (err: any) {
      toast.error(
        "No se pudo generar el PDF: " + (err?.message || "desconocido")
      );
    } finally {
      setDownloading(false);
    }
  };

  const renderSearchCard = () => (
    <Card className="shadow-2xl border-0 overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="h-2 gradient-clinical w-full" />
      <CardHeader className="text-center pb-2 pt-8">
        <CardTitle className="text-xl font-display font-bold text-slate-700">
          Acceso a Pacientes
        </CardTitle>
        <p className="text-sm text-slate-400">
          Consulte su reporte clínico de forma segura
        </p>
      </CardHeader>

      <CardContent className="space-y-6 p-8">
        <div className="space-y-4">
          <div className="space-y-2">
            <Label className="text-xs font-bold uppercase text-slate-500 ml-1">
              Código de Orden
            </Label>
            <div className="relative group">
              <Search className="absolute left-3 top-3 w-4 h-4 text-slate-400 group-focus-within:text-primary transition-colors" />
              <Input
                className="pl-10 h-12 bg-slate-50 border-slate-200 focus:bg-white transition-all"
                placeholder="Ej: ORD-2024-XXXX"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-bold uppercase text-slate-500 ml-1">
              Clave de Acceso
            </Label>
            <div className="relative group">
              <Lock className="absolute left-3 top-3 w-4 h-4 text-slate-400 group-focus-within:text-primary transition-colors" />
              <Input
                className="pl-10 h-12 bg-slate-50 border-slate-200 focus:bg-white transition-all font-mono"
                placeholder="******"
                value={accessKey}
                onChange={(e) => setAccessKey(e.target.value.toUpperCase())}
                type="text"
              />
            </div>
          </div>
        </div>

        {error && (
          <div className="p-3 rounded-lg bg-rose-50 border border-rose-100 text-rose-600 text-sm font-medium text-center">
            {error}
          </div>
        )}

        <Button
          onClick={handleSearch}
          disabled={loading || confirmingPayment}
          className="w-full h-12 gradient-clinical text-primary-foreground border-0 text-lg font-bold shadow-lg shadow-blue-200 hover:scale-[1.02] active:scale-[0.98] transition-all"
        >
          {loading || confirmingPayment ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            "Consultar Resultados"
          )}
        </Button>

        <p className="text-[11px] text-slate-400 text-center px-4 leading-relaxed">
          Su código y clave de acceso se encuentran impresos en el ticket
          entregado en recepción.
        </p>
      </CardContent>
    </Card>
  );

  const renderHeader = () => (
    <div className="flex items-center justify-between">
      <Button
        variant="ghost"
        onClick={() => {
          setFoundOrder(null);
          setError("");
        }}
        className="text-slate-500 hover:text-primary"
      >
        <ChevronLeft className="w-4 h-4 mr-1" />
        Nueva Consulta
      </Button>

      <Button
        onClick={handleDownload}
        disabled={downloading || !isPaid || !isCompleted}
        className="gradient-clinical text-primary-foreground border-0 shadow-md"
      >
        {downloading ? (
          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
        ) : (
          <Download className="w-4 h-4 mr-2" />
        )}
        Descargar Reporte Oficial
      </Button>
    </div>
  );

  const renderOrderSummary = () => (
    <Card className="bg-white border-0 shadow-xl ring-1 ring-slate-100">
      <CardContent className="p-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-sm">
          <div className="space-y-1">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
              Paciente
            </p>
            <p className="font-bold text-slate-800">
              {foundOrder.pacientes?.name}
            </p>
          </div>

          <div className="space-y-1">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
              No. Orden
            </p>
            <p className="font-mono font-bold text-blue-600">{foundOrder.code}</p>
          </div>

          <div className="space-y-1">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1">
              <CalendarDays className="w-3 h-3" />
              Fecha resultado
            </p>
            <p className="font-bold text-slate-800">
              {formatDisplayDate(firstResultDate)}
            </p>
          </div>

          <div className="space-y-1">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
              Edad
            </p>
            <p className="font-bold text-slate-800">
              {calcAge(foundOrder.pacientes?.birth_date)} años
            </p>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap gap-2">
          <Badge variant="outline">Total: ${totalAmount.toFixed(2)}</Badge>
          <Badge variant="outline">Pagado: ${paidAmount.toFixed(2)}</Badge>
          <Badge variant="outline">Saldo: ${pendingAmount.toFixed(2)}</Badge>
          <Badge variant={isPaid ? "default" : "secondary"}>
            {foundOrder.payment_status || (isPaid ? "PAGADO" : "PENDIENTE")}
          </Badge>
        </div>
      </CardContent>
    </Card>
  );

  const renderPendingPayment = () => {
    const phoneNumber = "593985044520"; // sin espacios ni +
    
    const message = encodeURIComponent(
      `Hola, necesito regularizar el pago de mi orden.\n\n` +
      `Paciente: ${foundOrder?.pacientes?.name}\n` +
      `Orden: ${foundOrder?.code}\n` +
      `Valor pendiente: $${pendingAmount.toFixed(2)}\n\n` +
      `Por favor ayúdenme con el proceso de pago para poder revisar mis resultados.`
    );

    const whatsappUrl = `https://wa.me/${phoneNumber}?text=${message}`;

    return (
      <Card className="border-0 shadow-lg overflow-hidden">
        <div className="bg-amber-50 px-6 py-4 border-b border-amber-100">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600" />
            <div>
              <h3 className="font-display font-bold text-amber-800">
                Pago pendiente
              </h3>
              <p className="text-sm text-amber-700">
                Sus resultados no pueden ser consultados hasta cubrir el valor total de los exámenes.
              </p>
            </div>
          </div>
        </div>

        <CardContent className="p-6 space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="rounded-xl border bg-slate-50 p-4">
              <p className="text-xs uppercase font-bold text-slate-400">Total</p>
              <p className="text-2xl font-black text-slate-800">
                ${totalAmount.toFixed(2)}
              </p>
            </div>

            <div className="rounded-xl border bg-slate-50 p-4">
              <p className="text-xs uppercase font-bold text-slate-400">Pagado</p>
              <p className="text-2xl font-black text-emerald-700">
                ${paidAmount.toFixed(2)}
              </p>
            </div>

            <div className="rounded-xl border bg-rose-50 border-rose-100 p-4">
              <p className="text-xs uppercase font-bold text-rose-400">
                Saldo pendiente
              </p>
              <p className="text-2xl font-black text-rose-700">
                ${pendingAmount.toFixed(2)}
              </p>
            </div>
          </div>

          {/* BOTÓN WHATSAPP */}
          <div className="space-y-3">
            <Button
              onClick={() => window.open(whatsappUrl, "_blank")}
              className="w-full h-12 bg-green-600 hover:bg-green-700 text-white text-lg font-bold shadow-lg"
            >
              Gestionar pago por WhatsApp
            </Button>

            <p className="text-xs text-slate-500 text-center">
              Será redirigido a WhatsApp para coordinar su pago y habilitar la revisión de resultados.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  };

  const renderProcessingResults = () => (
    <Card className="border-0 shadow-lg overflow-hidden">
      <div className="bg-blue-50 px-6 py-4 border-b border-blue-100">
        <div className="flex items-center gap-3">
          <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
          <div>
            <h3 className="font-display font-bold text-blue-800">
              Resultados en proceso
            </h3>
            <p className="text-sm text-blue-700">
              Su pago ya fue registrado, pero los resultados todavía no han sido
              finalizados por el laboratorio.
            </p>
          </div>
        </div>
      </div>

      <CardContent className="p-6">
        <div className="rounded-xl border bg-slate-50 p-4 text-sm text-slate-700">
          Cuando el personal técnico valide la orden, podrá consultar y
          descargar el reporte oficial desde este mismo portal.
        </div>
      </CardContent>
    </Card>
  );

  const renderResults = () => (
    <div className="space-y-4">
      {foundOrder.resultados.map((res: any) => (
        <Card key={res.id} className="border-0 shadow-lg overflow-hidden">
          <div className="bg-slate-50 px-6 py-3 border-b border-slate-100">
            <div className="flex items-center justify-between gap-4">
              <h3 className="font-display font-bold text-primary flex items-center gap-2">
                <FileText className="w-4 h-4" />
                {res.pruebas?.name}
              </h3>

              <span className="text-xs text-slate-400 font-medium">
                {res.date ? `Fecha: ${formatDisplayDate(res.date)}` : ""}
              </span>
            </div>
          </div>

          <CardContent className="p-0">
            <div className="divide-y divide-slate-50">
              {res.resultado_detalle?.map((det: any) => {
                const resultType = getResultType(det);
                const displayValue = getDisplayValue(det);
                const unit = getDisplayUnit(det);
                const badgeLabel = getBadgeLabel(det);

                return (
                  <div
                    key={det.id}
                    className="p-5 hover:bg-slate-50/50 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="space-y-1 min-w-0 flex-1">
                        <p className="font-bold text-slate-700 text-sm">
                          {det.parametros_prueba?.name}
                        </p>

                        <div className="flex flex-wrap gap-2 text-[10px] text-slate-400 font-mono italic">
                          <span>Tipo: {resultType}</span>

                          {resultType === "numeric" && unit && (
                            <span>Unidad: {unit}</span>
                          )}

                          {resultType === "numeric" && hasRange(det) && (
                            <span>
                              Rango ref: {det.applied_range_min} -{" "}
                              {det.applied_range_max} {unit}
                            </span>
                          )}
                        </div>

                        {det.observation && (
                          <div className="mt-2 rounded-lg bg-amber-50 border border-amber-100 px-3 py-2">
                            <p className="text-[11px] font-bold text-amber-700 uppercase tracking-wide">
                              Observación
                            </p>
                            <p className="text-sm text-amber-900 whitespace-pre-line">
                              {det.observation}
                            </p>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-4 shrink-0">
                        <div className="text-right max-w-[180px]">
                          <span className="text-lg font-black text-slate-800 break-words">
                            {displayValue || "—"}
                          </span>

                          {!!unit && (
                            <span className="text-[10px] font-bold text-slate-400 ml-1">
                              {unit}
                            </span>
                          )}
                        </div>

                        {!!badgeLabel && (
                          <Badge
                            className={`font-bold px-3 py-1 rounded-full text-[10px] ${getBadgeClass(
                              det
                            )}`}
                            variant="outline"
                          >
                            {badgeLabel}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}

              {!res.resultado_detalle?.length && res.notes && (
                <div className="p-5 text-sm text-slate-700 whitespace-pre-line">
                  {res.notes}
                </div>
              )}

              {!res.resultado_detalle?.length && !res.notes && (
                <div className="p-5 text-sm text-slate-500">
                  No existen detalles cargados para este examen.
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8">
      <div className="max-w-2xl mx-auto space-y-8">
        <div className="text-center space-y-4 py-6">
          <div className="mx-auto w-24 h-24 rounded-3xl bg-white flex items-center justify-center shadow-xl shadow-blue-100 border border-slate-100 animate-in zoom-in duration-500 p-3 overflow-hidden">
            {labConfig.logo ? (
              <img
                src={labConfig.logo}
                alt={`Logo de ${labConfig.name}`}
                className="max-w-full max-h-full object-contain"
              />
            ) : (
              <div className="w-full h-full rounded-2xl gradient-clinical flex items-center justify-center">
                <FlaskConical className="w-10 h-10 text-white" />
              </div>
            )}
          </div>

          <div className="space-y-1">
            <h1 className="text-3xl font-display font-black text-slate-800 tracking-tight">
              {labConfig.name}
            </h1>
            <p className="text-slate-500 font-medium italic text-sm">
              Portal de Resultados en Línea
            </p>
          </div>

          {confirmingPayment && (
            <div className="inline-flex items-center gap-2 rounded-full border bg-white px-4 py-2 text-sm text-slate-600 shadow-sm">
              <Loader2 className="w-4 h-4 animate-spin" />
              Confirmando su pago...
            </div>
          )}
        </div>

        {!foundOrder ? (
          renderSearchCard()
        ) : (
          <div className="space-y-6 animate-in fade-in zoom-in-95 duration-500">
            {renderHeader()}
            {renderOrderSummary()}

            {!isPaid ? (
              renderPendingPayment()
            ) : !isCompleted ? (
              renderProcessingResults()
            ) : (
              <>
                <div className="rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4" />
                  Pago confirmado. Ya puede consultar y descargar sus
                  resultados.
                </div>

                {renderResults()}

                <p className="text-center text-[10px] text-slate-400 pt-4">
                  Este documento es una consulta informativa. Para fines legales
                  o médicos, utilice el PDF firmado electrónicamente.
                </p>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}