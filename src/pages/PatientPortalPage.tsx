import React, { useEffect, useMemo, useState } from "react";
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
} from "lucide-react";
import { toast } from "sonner";
import {
  generateResultsPDF,
  PdfLabConfig,
  PdfOrder,
  PdfOrderResult,
  PdfPatient,
} from "@/lib/pdfGenerator";

type LabIdentity = {
  name: string;
  logo: string | null;
};

type ResultType = "numeric" | "boolean" | "text";

export default function PatientPortalPage() {
  const [code, setCode] = useState("");
  const [accessKey, setAccessKey] = useState("");
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState("");
  const [labConfig, setLabConfig] = useState<LabIdentity>({
    name: "BioAnalítica",
    logo: null,
  });
  const [foundOrder, setFoundOrder] = useState<any>(null);

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

  const handleSearch = async () => {
    if (!code.trim() || !accessKey.trim()) {
      setError("Por favor, complete ambos campos");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const { data: order, error: orderError } = await supabase
        .from("ordenes")
        .select(`
          *,
          pacientes (*),
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
        .eq("code", code.trim())
        .eq("access_key", accessKey.trim())
        .maybeSingle();

      if (orderError) throw orderError;

      if (!order) {
        setError("No se encontró ninguna orden con esos datos. Verifique su ticket.");
        setFoundOrder(null);
      } else if (order.status !== "completed") {
        setError("Sus resultados están siendo procesados. Intente más tarde.");
        setFoundOrder(null);
      } else {
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
      }
    } catch (err: any) {
      console.error(err);
      setError("Error al conectar con el servidor");
      setFoundOrder(null);
    } finally {
      setLoading(false);
    }
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

  const handleDownload = async () => {
    if (!foundOrder) return;

    setDownloading(true);

    try {
      toast.info("Generando reporte PDF oficial...");

      const { data: configData, error: configError } = await supabase
        .from("configuracion_laboratorio")
        .select("*")
        .maybeSingle();

      if (configError) throw configError;
      if (!configData) throw new Error("No existe la configuración del laboratorio");

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
                det.parametros_prueba?.name || det.name || det.parametro || "Resultado",
              value: getDisplayValue(det),
              appliedRangeMin: det.applied_range_min ?? null,
              appliedRangeMax: det.applied_range_max ?? null,
              unit: getDisplayUnit(det),
              status: det.status || "normal",
              observation: det.observation || "",
              resultType: getResultType(det),
            })) || [],
        })) || [];

      generateResultsPDF(pdfOrder, pdfPatient, orderTests, orderResults, pdfConfig);

      toast.success("PDF generado correctamente");
    } catch (err: any) {
      toast.error("No se pudo generar el PDF: " + (err?.message || "desconocido"));
    } finally {
      setDownloading(false);
    }
  };

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
        </div>

        {!foundOrder ? (
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
                disabled={loading}
                className="w-full h-12 gradient-clinical text-primary-foreground border-0 text-lg font-bold shadow-lg shadow-blue-200 hover:scale-[1.02] active:scale-[0.98] transition-all"
              >
                {loading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  "Consultar Resultados"
                )}
              </Button>

              <p className="text-[11px] text-slate-400 text-center px-4 leading-relaxed">
                Su código y clave de acceso se encuentran impresos en el ticket entregado en
                recepción.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6 animate-in fade-in zoom-in-95 duration-500">
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
                disabled={downloading}
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

            <Card className="bg-white border-0 shadow-xl ring-1 ring-slate-100">
              <CardContent className="p-6">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-sm">
                  <div className="space-y-1">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                      Paciente
                    </p>
                    <p className="font-bold text-slate-800">{foundOrder.pacientes?.name}</p>
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
              </CardContent>
            </Card>

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
                                      Rango ref: {det.applied_range_min} - {det.applied_range_max}{" "}
                                      {unit}
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
                                    className={`font-bold px-3 py-1 rounded-full text-[10px] ${getBadgeClass(det)}`}
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

            <p className="text-center text-[10px] text-slate-400 pt-4">
              Este documento es una consulta informativa. Para fines legales o médicos, utilice el
              PDF firmado electrónicamente.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}