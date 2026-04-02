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

const COLORS = {
  primary: "#8C1D2C",
  primaryDark: "#6F1522",
  primarySoft: "#F7E9EC",
  secondary: "#5E7C96",
  secondaryDark: "#3E5A72",
  secondarySoft: "#EAF2F7",
  dark: "#1F2937",
  darker: "#111827",
  light: "#F8FAFC",
  border: "#E5E7EB",
  textSoft: "#64748B",
  white: "#FFFFFF",
  successBg: "#ECFDF5",
  successText: "#047857",
  warningBg: "#FFF7ED",
  warningText: "#C2410C",
  dangerBg: "#FEF2F2",
  dangerText: "#B91C1C",
};

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

  const getBadgeStyle = (det: any) => {
    switch (det.status) {
      case "normal":
        return {
          backgroundColor: "#ECFDF5",
          color: "#047857",
          borderColor: "#A7F3D0",
        };
      case "high":
        return {
          backgroundColor: "#FEF2F2",
          color: "#B91C1C",
          borderColor: "#FECACA",
        };
      case "low":
        return {
          backgroundColor: "#FFF7ED",
          color: "#C2410C",
          borderColor: "#FED7AA",
        };
      case "positive":
        return {
          backgroundColor: "#FEF2F2",
          color: "#B91C1C",
          borderColor: "#FECACA",
        };
      case "negative":
        return {
          backgroundColor: "#ECFDF5",
          color: "#047857",
          borderColor: "#A7F3D0",
        };
      case "text":
      default:
        return {
          backgroundColor: "#F8FAFC",
          color: "#475569",
          borderColor: "#CBD5E1",
        };
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
    <Card
      className="overflow-hidden border-0 shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-700"
      style={{ backgroundColor: COLORS.white }}
    >
      <div
        className="h-2 w-full"
        style={{
          background: `linear-gradient(to right, ${COLORS.primary}, ${COLORS.secondaryDark})`,
        }}
      />

      <CardHeader className="pb-2 pt-8 text-center">
        <CardTitle
          className="text-xl font-bold"
          style={{ color: COLORS.dark }}
        >
          Acceso a Pacientes
        </CardTitle>
        <p className="text-sm" style={{ color: COLORS.textSoft }}>
          Consulte su reporte clínico de forma segura
        </p>
      </CardHeader>

      <CardContent className="space-y-6 p-8">
        <div className="space-y-4">
          <div className="space-y-2">
            <Label
              className="ml-1 text-xs font-bold uppercase"
              style={{ color: COLORS.textSoft }}
            >
              Código de Orden
            </Label>
            <div className="group relative">
              <Search
                className="absolute left-3 top-3 h-4 w-4 transition-colors"
                style={{ color: COLORS.textSoft }}
              />
              <Input
                className="h-12 border-slate-200 pl-10"
                style={{ backgroundColor: COLORS.light }}
                placeholder="Ej: ORD-2024-XXXX"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label
              className="ml-1 text-xs font-bold uppercase"
              style={{ color: COLORS.textSoft }}
            >
              Clave de Acceso
            </Label>
            <div className="group relative">
              <Lock
                className="absolute left-3 top-3 h-4 w-4 transition-colors"
                style={{ color: COLORS.textSoft }}
              />
              <Input
                className="h-12 border-slate-200 pl-10 font-mono"
                style={{ backgroundColor: COLORS.light }}
                placeholder="******"
                value={accessKey}
                onChange={(e) => setAccessKey(e.target.value.toUpperCase())}
                type="text"
              />
            </div>
          </div>
        </div>

        {error && (
          <div
            className="rounded-lg border p-3 text-center text-sm font-medium"
            style={{
              backgroundColor: COLORS.dangerBg,
              color: COLORS.dangerText,
              borderColor: "#FECACA",
            }}
          >
            {error}
          </div>
        )}

        <Button
          onClick={handleSearch}
          disabled={loading || confirmingPayment}
          className="h-12 w-full border-0 text-lg font-bold text-white shadow-lg transition-all hover:scale-[1.02] active:scale-[0.98]"
          style={{
            background: `linear-gradient(to right, ${COLORS.primary}, ${COLORS.secondaryDark})`,
          }}
        >
          {loading || confirmingPayment ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            "Consultar Resultados"
          )}
        </Button>

        <p
          className="px-4 text-center text-[11px] leading-relaxed"
          style={{ color: COLORS.textSoft }}
        >
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
        style={{ color: COLORS.textSoft }}
      >
        <ChevronLeft className="mr-1 h-4 w-4" />
        Nueva Consulta
      </Button>

      <Button
        onClick={handleDownload}
        disabled={downloading || !isPaid || !isCompleted}
        className="border-0 text-white shadow-md"
        style={{
          background: `linear-gradient(to right, ${COLORS.primary}, ${COLORS.secondaryDark})`,
        }}
      >
        {downloading ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <Download className="mr-2 h-4 w-4" />
        )}
        Descargar Reporte Oficial
      </Button>
    </div>
  );

  const renderOrderSummary = () => (
    <Card
      className="border-0 bg-white shadow-xl"
      style={{ boxShadow: "0 10px 30px rgba(15,23,42,0.08)" }}
    >
      <CardContent className="p-6">
        <div className="grid grid-cols-2 gap-6 text-sm md:grid-cols-4">
          <div className="space-y-1">
            <p
              className="text-xs font-bold uppercase tracking-widest"
              style={{ color: COLORS.textSoft }}
            >
              Paciente
            </p>
            <p className="font-bold" style={{ color: COLORS.dark }}>
              {foundOrder.pacientes?.name}
            </p>
          </div>

          <div className="space-y-1">
            <p
              className="text-xs font-bold uppercase tracking-widest"
              style={{ color: COLORS.textSoft }}
            >
              No. Orden
            </p>
            <p className="font-mono font-bold" style={{ color: COLORS.primary }}>
              {foundOrder.code}
            </p>
          </div>

          <div className="space-y-1">
            <p
              className="flex items-center gap-1 text-xs font-bold uppercase tracking-widest"
              style={{ color: COLORS.textSoft }}
            >
              <CalendarDays className="h-3 w-3" />
              Fecha resultado
            </p>
            <p className="font-bold" style={{ color: COLORS.dark }}>
              {formatDisplayDate(firstResultDate)}
            </p>
          </div>

          <div className="space-y-1">
            <p
              className="text-xs font-bold uppercase tracking-widest"
              style={{ color: COLORS.textSoft }}
            >
              Edad
            </p>
            <p className="font-bold" style={{ color: COLORS.dark }}>
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
    const phoneNumber = "593985044520";

    const message = encodeURIComponent(
      `Hola, necesito regularizar el pago de mi orden.\n\n` +
        `Paciente: ${foundOrder?.pacientes?.name}\n` +
        `Orden: ${foundOrder?.code}\n` +
        `Valor pendiente: $${pendingAmount.toFixed(2)}\n\n` +
        `Por favor ayúdenme con el proceso de pago para poder revisar mis resultados.`
    );

    const whatsappUrl = `https://wa.me/${phoneNumber}?text=${message}`;

    return (
      <Card className="overflow-hidden border-0 shadow-lg">
        <div
          className="border-b px-6 py-4"
          style={{
            backgroundColor: COLORS.warningBg,
            borderColor: "#FED7AA",
          }}
        >
          <div className="flex items-center gap-3">
            <AlertTriangle
              className="h-5 w-5"
              style={{ color: COLORS.warningText }}
            />
            <div>
              <h3
                className="font-bold"
                style={{ color: COLORS.warningText }}
              >
                Pago pendiente
              </h3>
              <p className="text-sm" style={{ color: COLORS.warningText }}>
                Sus resultados no pueden ser consultados hasta cubrir el valor total de los exámenes.
              </p>
            </div>
          </div>
        </div>

        <CardContent className="space-y-5 p-6">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div
              className="rounded-xl border p-4"
              style={{ backgroundColor: COLORS.light, borderColor: COLORS.border }}
            >
              <p
                className="text-xs font-bold uppercase"
                style={{ color: COLORS.textSoft }}
              >
                Total
              </p>
              <p className="text-2xl font-black" style={{ color: COLORS.dark }}>
                ${totalAmount.toFixed(2)}
              </p>
            </div>

            <div
              className="rounded-xl border p-4"
              style={{ backgroundColor: COLORS.successBg, borderColor: "#A7F3D0" }}
            >
              <p
                className="text-xs font-bold uppercase"
                style={{ color: COLORS.successText }}
              >
                Pagado
              </p>
              <p
                className="text-2xl font-black"
                style={{ color: COLORS.successText }}
              >
                ${paidAmount.toFixed(2)}
              </p>
            </div>

            <div
              className="rounded-xl border p-4"
              style={{ backgroundColor: COLORS.dangerBg, borderColor: "#FECACA" }}
            >
              <p
                className="text-xs font-bold uppercase"
                style={{ color: COLORS.dangerText }}
              >
                Saldo pendiente
              </p>
              <p
                className="text-2xl font-black"
                style={{ color: COLORS.dangerText }}
              >
                ${pendingAmount.toFixed(2)}
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <Button
              onClick={() => window.open(whatsappUrl, "_blank")}
              className="h-12 w-full bg-green-600 text-lg font-bold text-white shadow-lg hover:bg-green-700"
            >
              Gestionar pago por WhatsApp
            </Button>

            <p
              className="text-center text-xs"
              style={{ color: COLORS.textSoft }}
            >
              Será redirigido a WhatsApp para coordinar su pago y habilitar la revisión de resultados.
            </p>
          </div>

          <div
            ref={paymentContainerRef}
            id="payphone-payment-box"
            className="pt-2"
          />
        </CardContent>
      </Card>
    );
  };

  const renderProcessingResults = () => (
    <Card className="overflow-hidden border-0 shadow-lg">
      <div
        className="border-b px-6 py-4"
        style={{
          backgroundColor: COLORS.secondarySoft,
          borderColor: "#BFDBFE",
        }}
      >
        <div className="flex items-center gap-3">
          <Loader2
            className="h-5 w-5 animate-spin"
            style={{ color: COLORS.secondaryDark }}
          />
          <div>
            <h3 className="font-bold" style={{ color: COLORS.secondaryDark }}>
              Resultados en proceso
            </h3>
            <p className="text-sm" style={{ color: COLORS.secondaryDark }}>
              Su pago ya fue registrado, pero los resultados todavía no han sido finalizados por el laboratorio.
            </p>
          </div>
        </div>
      </div>

      <CardContent className="p-6">
        <div
          className="rounded-xl border p-4 text-sm"
          style={{
            backgroundColor: COLORS.light,
            borderColor: COLORS.border,
            color: COLORS.dark,
          }}
        >
          Cuando el personal técnico valide la orden, podrá consultar y descargar el reporte oficial desde este mismo portal.
        </div>
      </CardContent>
    </Card>
  );

  const renderResults = () => (
    <div className="space-y-4">
      {foundOrder.resultados.map((res: any) => (
        <Card key={res.id} className="overflow-hidden border-0 shadow-lg">
          <div
            className="border-b px-6 py-3"
            style={{
              backgroundColor: COLORS.light,
              borderColor: COLORS.border,
            }}
          >
            <div className="flex items-center justify-between gap-4">
              <h3
                className="flex items-center gap-2 font-bold"
                style={{ color: COLORS.primary }}
              >
                <FileText className="h-4 w-4" />
                {res.pruebas?.name}
              </h3>

              <span className="text-xs font-medium" style={{ color: COLORS.textSoft }}>
                {res.date ? `Fecha: ${formatDisplayDate(res.date)}` : ""}
              </span>
            </div>
          </div>

          <CardContent className="p-0">
            <div className="divide-y" style={{ borderColor: "#F1F5F9" }}>
              {res.resultado_detalle?.map((det: any) => {
                const resultType = getResultType(det);
                const displayValue = getDisplayValue(det);
                const unit = getDisplayUnit(det);
                const badgeLabel = getBadgeLabel(det);
                const badgeStyle = getBadgeStyle(det);

                return (
                  <div key={det.id} className="p-5 transition-colors hover:bg-slate-50/50">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0 flex-1 space-y-1">
                        <p className="text-sm font-bold" style={{ color: COLORS.dark }}>
                          {det.parametros_prueba?.name}
                        </p>

                        <div
                          className="flex flex-wrap gap-2 text-[10px] font-mono italic"
                          style={{ color: COLORS.textSoft }}
                        >
                          <span>Tipo: {resultType}</span>

                          {resultType === "numeric" && unit && (
                            <span>Unidad: {unit}</span>
                          )}

                          {resultType === "numeric" && hasRange(det) && (
                            <span>
                              Rango ref: {det.applied_range_min} - {det.applied_range_max} {unit}
                            </span>
                          )}
                        </div>

                        {det.observation && (
                          <div
                            className="mt-2 rounded-lg border px-3 py-2"
                            style={{
                              backgroundColor: COLORS.warningBg,
                              borderColor: "#FED7AA",
                            }}
                          >
                            <p
                              className="text-[11px] font-bold uppercase tracking-wide"
                              style={{ color: COLORS.warningText }}
                            >
                              Observación
                            </p>
                            <p
                              className="whitespace-pre-line text-sm"
                              style={{ color: COLORS.dark }}
                            >
                              {det.observation}
                            </p>
                          </div>
                        )}
                      </div>

                      <div className="flex shrink-0 items-center gap-4">
                        <div className="max-w-[180px] text-right">
                          <span
                            className="break-words text-lg font-black"
                            style={{ color: COLORS.dark }}
                          >
                            {displayValue || "—"}
                          </span>

                          {!!unit && (
                            <span
                              className="ml-1 text-[10px] font-bold"
                              style={{ color: COLORS.textSoft }}
                            >
                              {unit}
                            </span>
                          )}
                        </div>

                        {!!badgeLabel && (
                          <Badge
                            className="rounded-full px-3 py-1 text-[10px] font-bold"
                            variant="outline"
                            style={badgeStyle}
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
                <div
                  className="p-5 whitespace-pre-line text-sm"
                  style={{ color: COLORS.dark }}
                >
                  {res.notes}
                </div>
              )}

              {!res.resultado_detalle?.length && !res.notes && (
                <div className="p-5 text-sm" style={{ color: COLORS.textSoft }}>
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
    <div
      className="min-h-screen p-4 md:p-8"
      style={{ backgroundColor: COLORS.light }}
    >
      <div className="mx-auto max-w-2xl space-y-8">
        <div className="space-y-4 py-6 text-center">
          <div
            className="mx-auto flex h-24 w-24 items-center justify-center overflow-hidden rounded-3xl border bg-white p-3 shadow-xl"
            style={{
              borderColor: COLORS.border,
              boxShadow: "0 10px 30px rgba(140,29,44,0.10)",
            }}
          >
            {labConfig.logo ? (
              <img
                src={labConfig.logo}
                alt={`Logo de ${labConfig.name}`}
                className="max-h-full max-w-full object-contain"
              />
            ) : (
              <div
                className="flex h-full w-full items-center justify-center rounded-2xl"
                style={{
                  background: `linear-gradient(to right, ${COLORS.primary}, ${COLORS.secondaryDark})`,
                }}
              >
                <FlaskConical className="h-10 w-10 text-white" />
              </div>
            )}
          </div>

          <div className="space-y-1">
            <h1
              className="text-3xl font-black tracking-tight"
              style={{ color: COLORS.dark }}
            >
              {labConfig.name}
            </h1>
            <p
              className="text-sm font-medium italic"
              style={{ color: COLORS.textSoft }}
            >
              Portal de Resultados en Línea
            </p>
          </div>

          {confirmingPayment && (
            <div
              className="inline-flex items-center gap-2 rounded-full border bg-white px-4 py-2 text-sm shadow-sm"
              style={{
                color: COLORS.textSoft,
                borderColor: COLORS.border,
              }}
            >
              <Loader2 className="h-4 w-4 animate-spin" />
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
                <div
                  className="flex items-center gap-2 rounded-xl border px-4 py-3 text-sm"
                  style={{
                    backgroundColor: COLORS.successBg,
                    borderColor: "#A7F3D0",
                    color: COLORS.successText,
                  }}
                >
                  <CheckCircle2 className="h-4 w-4" />
                  Pago confirmado. Ya puede consultar y descargar sus resultados.
                </div>

                {renderResults()}

                <p
                  className="pt-4 text-center text-[10px]"
                  style={{ color: COLORS.textSoft }}
                >
                  Este documento es una consulta informativa. Para fines legales o médicos, utilice el PDF firmado electrónicamente.
                </p>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}