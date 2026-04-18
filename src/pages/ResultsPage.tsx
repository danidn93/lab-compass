import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { sendDocumentEmail } from '@/lib/sendDocumentEmail';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  FlaskConical,
  Loader2,
  CheckCircle2,
  CalendarDays,
  Download,
  Search,
  ChevronDown,
  ChevronUp,
  MessageCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  generateResultsPDF,
  downloadBlob,
  PdfLabConfig,
  PdfOrder,
  PdfOrderResult,
  PdfPatient,
} from '@/lib/pdfGenerator';

type ResultStatus = 'normal' | 'high' | 'low' | 'positive' | 'negative' | 'text' | null;
type ResultType = 'numeric' | 'boolean' | 'text';

interface DividerDisplayItem {
  id: string;
  item_type: 'divider';
  texto: string;
  sort_order: number;
}

interface ParameterDisplayItem {
  id: string;
  item_type: 'parameter';
  parameter: any;
  sort_order: number;
}

type TestStructureDisplayItem = DividerDisplayItem | ParameterDisplayItem;

interface EntryValueItem {
  value_numeric: string;
  value_boolean: '' | 'true' | 'false';
  value_text: string;
  observation: string;
}

function emptyEntryValue(): EntryValueItem {
  return {
    value_numeric: '',
    value_boolean: '',
    value_text: '',
    observation: '',
  };
}

function safeFileNamePart(value: any): string {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9_-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 80);
}

function compareBySortOrderThenName(a: any, b: any) {
  const aSort = Number.isFinite(Number(a?.sort_order)) ? Number(a.sort_order) : Number.MAX_SAFE_INTEGER;
  const bSort = Number.isFinite(Number(b?.sort_order)) ? Number(b.sort_order) : Number.MAX_SAFE_INTEGER;

  if (aSort !== bSort) return aSort - bSort;

  return String(a?.name || '').localeCompare(String(b?.name || ''), 'es', {
    sensitivity: 'base',
  });
}

function sortParametersForDisplay(params: any[] = []) {
  return [...params].sort(compareBySortOrderThenName);
}

function buildMixedTestStructure(
  parametros: any[] = [],
  divisores: any[] = []
): TestStructureDisplayItem[] {
  const parameterItems: ParameterDisplayItem[] = [...(parametros || [])].map((param: any) => ({
    id: param.id,
    item_type: 'parameter',
    parameter: param,
    sort_order: Number.isFinite(Number(param?.sort_order))
      ? Number(param.sort_order)
      : Number.MAX_SAFE_INTEGER,
  }));

  const dividerItems: DividerDisplayItem[] = [...(divisores || [])]
    .filter((d: any) => d.activo !== false)
    .map((divider: any) => ({
      id: divider.id,
      item_type: 'divider',
      texto: String(divider.texto || ''),
      sort_order: Number.isFinite(Number(divider?.sort_order))
        ? Number(divider.sort_order)
        : Number.MAX_SAFE_INTEGER,
    }));

  return [...parameterItems, ...dividerItems].sort((a, b) => {
    if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order;

    if (a.item_type !== b.item_type) {
      return a.item_type === 'divider' ? -1 : 1;
    }

    const aName = a.item_type === 'divider' ? a.texto : a.parameter?.name || '';
    const bName = b.item_type === 'divider' ? b.texto : b.parameter?.name || '';

    return String(aName).localeCompare(String(bName), 'es', {
      sensitivity: 'base',
    });
  });
}

function normalizePhoneForWhatsapp(phone: any): string {
  let digits = String(phone ?? '').replace(/\D/g, '');

  if (!digits) return '';

  if (digits.startsWith('593')) return digits;
  if (digits.length === 10 && digits.startsWith('0')) return `593${digits.slice(1)}`;
  if (digits.length === 9) return `593${digits}`;
  return digits;
}

function safeNumber(value: any, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function round2(value: number): number {
  return Number(value.toFixed(2));
}

function sortByNameAsc(items: any[] = [], field = 'name') {
  return [...items].sort((a: any, b: any) =>
    String(a?.[field] || '').localeCompare(String(b?.[field] || ''), 'es', {
      sensitivity: 'base',
    })
  );
}

function normalizeExamName(value: any) {
  return String(value || '').trim().toLowerCase();
}

function normalizeExamDescription(value: any) {
  return String(value || '').trim().toLowerCase();
}

function buildGroupedTestKey(name: any, description: any) {
  return `${normalizeExamName(name)}|||${normalizeExamDescription(description)}`;
}

function groupTestsByName(details: any[] = []) {
  const groupedMap: Record<string, any> = {};

  details.forEach((d: any) => {
    const test = d?.pruebas;
    if (!test) return;

    const key = buildGroupedTestKey(test.name, test.description);
    if (!key) return;

    if (!groupedMap[key]) {
      groupedMap[key] = {
        id: test.id,
        name: test.name,
        description: test.description || '',
        test_ids: [],
        parametros_prueba: [],
        divisores: [],
        structure_items: [],
      };
    }

    const group = groupedMap[key];

    if (!group.test_ids.includes(test.id)) {
      group.test_ids.push(test.id);
    }

    (test.parametros_prueba || []).forEach((param: any) => {
      const alreadyExists = group.parametros_prueba.some((p: any) => p.id === param.id);
      if (!alreadyExists) {
        group.parametros_prueba.push(param);
      }
    });

    (test.parametros_prueba_divisores || []).forEach((divider: any) => {
      const alreadyExists = group.divisores.some((x: any) => x.id === divider.id);
      if (!alreadyExists) {
        group.divisores.push(divider);
      }
    });
  });

  return Object.values(groupedMap)
    .map((group: any) => {
      const sortedParams = [...(group.parametros_prueba || [])].sort(compareBySortOrderThenName);
      const sortedDividers = [...(group.divisores || [])].sort((a: any, b: any) => {
        const aSort = Number.isFinite(Number(a?.sort_order)) ? Number(a.sort_order) : Number.MAX_SAFE_INTEGER;
        const bSort = Number.isFinite(Number(b?.sort_order)) ? Number(b.sort_order) : Number.MAX_SAFE_INTEGER;

        if (aSort !== bSort) return aSort - bSort;

        return String(a?.texto || '').localeCompare(String(b?.texto || ''), 'es', {
          sensitivity: 'base',
        });
      });

      return {
        ...group,
        parametros_prueba: sortedParams,
        divisores: sortedDividers,
        structure_items: buildMixedTestStructure(sortedParams, sortedDividers),
      };
    })
    .sort((a: any, b: any) => {
      const byName = String(a.name || '').localeCompare(String(b.name || ''), 'es', {
        sensitivity: 'base',
      });

      if (byName !== 0) return byName;

      return String(a.description || '').localeCompare(String(b.description || ''), 'es', {
        sensitivity: 'base',
      });
    });
}

function groupPdfResultsByTestName(
  resultados: any[] = [],
  getDisplayValue: (det: any) => string,
  getDisplayUnit: (det: any) => string,
  getResultType: (det: any) => ResultType
) {
  const groupedMap: Record<string, any> = {};

  resultados.forEach((res: any) => {
    const testName = String(res?.pruebas?.name || '').trim();
    const testDescription = String(res?.pruebas?.description || '').trim();
    const key = buildGroupedTestKey(testName, testDescription);

    if (!key) return;

    if (!groupedMap[key]) {
      groupedMap[key] = {
        id: res.id,
        testId: res.pruebas?.id || res.test_id || res.id,
        testName,
        testDescription,
        notes: res.notes || res.observacion || res.resultado_texto || '',
        date: res.date || null,
        details: [],
      };
    }

    const targetDetails = groupedMap[key].details;

    const dividers = (res?.pruebas?.parametros_prueba_divisores || [])
      .filter((d: any) => d.activo !== false)
      .map((d: any) => ({
        id: `divider-${d.id}`,
        item_type: 'divider',
        texto: d.texto || '',
        sort_order: d.sort_order ?? null,
      }));

    dividers.forEach((divider: any) => {
      const exists = targetDetails.some((x: any) => x.id === divider.id);
      if (!exists) {
        targetDetails.push(divider);
      }
    });

    (res.resultado_detalle || []).forEach((det: any) => {
      const parameterId = det.parametros_prueba?.id || det.parameter_id || null;
      const parameterName =
        det.parametros_prueba?.name || det.name || det.parametro || 'Resultado';

      const alreadyExists = targetDetails.some((d: any) =>
        d.item_type === 'divider'
          ? false
          : parameterId
          ? d.parameterId === parameterId
          : d.parameterName === parameterName
      );

      if (!alreadyExists) {
        targetDetails.push({
          id: det.id,
          item_type: 'parameter',
          parameterId,
          parameterName,
          sort_order: det.parametros_prueba?.sort_order ?? null,
          value: getDisplayValue(det),
          appliedRangeMin: det.applied_range_min ?? null,
          appliedRangeMax: det.applied_range_max ?? null,
          unit: getDisplayUnit(det),
          status: det.status || 'normal',
          observation: det.observation || '',
          resultType: getResultType(det),
        });
      }
    });

    if (!groupedMap[key].date && res.date) {
      groupedMap[key].date = res.date;
    }

    if (!groupedMap[key].notes && (res.notes || res.observacion || res.resultado_texto)) {
      groupedMap[key].notes = res.notes || res.observacion || res.resultado_texto || '';
    }
  });

  return Object.values(groupedMap)
    .map((group: any) => ({
      ...group,
      details: [...(group.details || [])].sort((a: any, b: any) => {
        const aSort = Number.isFinite(Number(a?.sort_order))
          ? Number(a.sort_order)
          : Number.MAX_SAFE_INTEGER;
        const bSort = Number.isFinite(Number(b?.sort_order))
          ? Number(b.sort_order)
          : Number.MAX_SAFE_INTEGER;

        if (aSort !== bSort) return aSort - bSort;

        const aLabel =
          a.item_type === 'divider' ? a.texto || '' : a.parameterName || '';
        const bLabel =
          b.item_type === 'divider' ? b.texto || '' : b.parameterName || '';

        return String(aLabel).localeCompare(String(bLabel), 'es', {
          sensitivity: 'base',
        });
      }),
    }))
    .sort((a: any, b: any) => {
      const byName = String(a.testName || '').localeCompare(String(b.testName || ''), 'es', {
        sensitivity: 'base',
      });

      if (byName !== 0) return byName;

      return String(a.testDescription || '').localeCompare(
        String(b.testDescription || ''),
        'es',
        { sensitivity: 'base' }
      );
    });
}

export default function ResultsPage() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [entryDialogOpen, setEntryDialogOpen] = useState(false);
  const [entryValues, setEntryValues] = useState<Record<string, EntryValueItem>>({});
  const [orderDetails, setOrderDetails] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [downloadingOrderId, setDownloadingOrderId] = useState<string | null>(null);
  const [resultDate, setResultDate] = useState<string>(() => new Date().toISOString().split('T')[0]);

  const [search, setSearch] = useState('');
  const [historyOpen, setHistoryOpen] = useState(false);

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('ordenes')
        .select('*, pacientes(*)')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setOrders(data || []);
    } catch (error: any) {
      toast.error('Error al cargar órdenes');
    } finally {
      setLoading(false);
    }
  };

  const calcAge = (birthDate: string) => {
    if (!birthDate) return 0;
    const diff = Date.now() - new Date(birthDate).getTime();
    return Math.floor(diff / (365.25 * 24 * 60 * 60 * 1000));
  };

  const normalizeText = (value: any) =>
    String(value ?? '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();

  const matchesSearch = (order: any) => {
    const q = normalizeText(search);
    if (!q) return true;

    const patientName = normalizeText(order.pacientes?.name);
    const code = normalizeText(order.code);
    const cedula = normalizeText(order.pacientes?.cedula);

    return patientName.includes(q) || code.includes(q) || cedula.includes(q);
  };

  const isOrderPaid = (order: any) => {
    const total = round2(safeNumber(order?.total, 0));
    const paid = round2(safeNumber(order?.paid_amount, 0));
    return paid >= total && total > 0;
  };

  const getPendingBalance = (order: any) => {
    const total = round2(safeNumber(order?.total, 0));
    const paid = round2(safeNumber(order?.paid_amount, 0));
    return round2(Math.max(total - paid, 0));
  };

  const isWithinLastWeek = (dateValue: string) => {
    if (!dateValue) return false;

    const orderDate = new Date(dateValue);
    if (Number.isNaN(orderDate.getTime())) return false;

    const now = new Date();
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setHours(0, 0, 0, 0);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    return orderDate >= sevenDaysAgo;
  };

  const openEntry = async (order: any) => {
    try {
      setSelectedOrderId(order.id);
      setEntryValues({});
      setResultDate(new Date().toISOString().split('T')[0]);

      const { data: details, error } = await supabase
        .from('orden_detalle')
        .select(`
          id,
          test_id,
          pruebas (
            id,
            name,
            description,
            parametros_prueba (
              id,
              name,
              unit,
              result_type,
              bool_true_label,
              bool_false_label,
              allow_observation,
              sort_order,
              valor_default,
              valor_default_boolean,
              rangos_referencia (*)
            ),
            parametros_prueba_divisores (
              id,
              texto,
              sort_order,
              activo
            )
          )
        `)
        .eq('order_id', order.id)
        .order('id', { ascending: true });

      if (error) throw error;

      const normalizedTests = groupTestsByName(details || []);

      const initialValues: Record<string, EntryValueItem> = {};
      normalizedTests.forEach((test: any) => {
        (test.structure_items || [])
          .filter((item: any) => item.item_type === 'parameter')
          .forEach((item: any) => {
            const param = item.parameter;
            const resultType: ResultType = param.result_type || 'numeric';

            initialValues[param.id] = {
              ...emptyEntryValue(),
              value_text:
                resultType === 'text'
                  ? String(param.valor_default || '')
                  : '',
              value_boolean:
                resultType === 'boolean'
                  ? param.valor_default_boolean === true
                    ? 'true'
                    : param.valor_default_boolean === false
                    ? 'false'
                    : ''
                  : '',
            };
          });
      });

      setEntryValues(initialValues);
      setOrderDetails({ ...order, tests: normalizedTests });
      setEntryDialogOpen(true);
    } catch (error: any) {
      toast.error('Error al cargar parámetros');
    }
  };

  const getAppliedRange = (parameter: any, patient: any) => {
    const age = calcAge(patient.birth_date);
    const ranges = parameter.rangos_referencia || [];
    const range = ranges.find(
      (r: any) =>
        (r.sex === 'both' || r.sex === patient.sex) &&
        age >= Number(r.min_age) &&
        age <= Number(r.max_age)
    );

    return range
      ? {
          min: Number(range.min_value),
          max: Number(range.max_value),
        }
      : null;
  };

  const classifyNumericValue = (value: number, range: any): 'normal' | 'high' | 'low' => {
    if (!range) return 'normal';
    if (value < range.min) return 'low';
    if (value > range.max) return 'high';
    return 'normal';
  };

  const updateEntryValue = (
    parameterId: string,
    field: keyof EntryValueItem,
    value: string
  ) => {
    setEntryValues(prev => ({
      ...prev,
      [parameterId]: {
        ...(prev[parameterId] || emptyEntryValue()),
        [field]: value,
      },
    }));
  };

  const getStatusPreview = (param: any): ResultStatus => {
    const item = entryValues[param.id] || emptyEntryValue();
    const resultType: ResultType = param.result_type || 'numeric';

    if (resultType === 'numeric') {
      if (item.value_numeric === '') return null;
      const value = Number(item.value_numeric);
      if (!Number.isFinite(value)) return null;
      const range = getAppliedRange(param, orderDetails?.pacientes);
      return classifyNumericValue(value, range);
    }

    if (resultType === 'boolean') {
      if (item.value_boolean === '') return null;
      return item.value_boolean === 'true' ? 'positive' : 'negative';
    }

    if (resultType === 'text') {
      if (!item.value_text.trim()) return null;
      return 'text';
    }

    return null;
  };

  const validateEntries = () => {
    if (!orderDetails?.tests?.length) {
      toast.error('No hay pruebas cargadas para esta orden');
      return false;
    }

    if (!resultDate) {
      toast.error('Debes indicar la fecha del resultado');
      return false;
    }

    for (const test of orderDetails.tests) {
      for (const structureItem of test.structure_items || []) {
        if (structureItem.item_type !== 'parameter') continue;

        const param = structureItem.parameter;
        const entryItem = entryValues[param.id] || emptyEntryValue();
        const resultType: ResultType = param.result_type || 'numeric';

        if (resultType === 'numeric') {
          if (entryItem.value_numeric === '') {
            toast.error(`Falta ingresar el valor de "${param.name}" en ${test.name}`);
            return false;
          }

          const n = Number(entryItem.value_numeric);
          if (!Number.isFinite(n)) {
            toast.error(`El valor de "${param.name}" no es válido`);
            return false;
          }
        }

        if (resultType === 'boolean') {
          if (entryItem.value_boolean === '') {
            toast.error(`Falta seleccionar el valor de "${param.name}" en ${test.name}`);
            return false;
          }
        }

        if (resultType === 'text') {
          if (!entryItem.value_text.trim()) {
            toast.error(`Falta ingresar el texto de "${param.name}" en ${test.name}`);
            return false;
          }
        }
      }
    }

    return true;
  };

  const buildPdfPayloadFromOrderData = (configData: any, orderData: any) => {
    const pdfConfig: PdfLabConfig = {
      name: configData.name || 'LABORATORIO CLÍNICO',
      owner: configData.owner || '',
      address: configData.address || '',
      ruc: configData.ruc || '',
      healthRegistry: configData.health_registry || '',
      phone: configData.phone || '',
      schedule: configData.schedule || '',
      logo: configData.logo || '',
      firma: configData.firma || '',
      sello: configData.sello || '',
    };

    const pdfPatient: PdfPatient = {
      name: orderData.pacientes?.name || '',
      cedula: orderData.pacientes?.cedula || '',
      phone: orderData.pacientes?.phone || '',
      sex: orderData.pacientes?.sex === 'F' ? 'F' : 'M',
      birth_date: orderData.pacientes?.birth_date || null,
    };

    const firstResultDate =
      orderData.resultados?.map((r: any) => r.date).filter(Boolean)?.[0] ||
      orderData.created_at ||
      null;

    const pdfOrder: PdfOrder = {
      code: orderData.code || '',
      accessKey: orderData.access_key || '',
      date: firstResultDate || orderData.created_at || '',
      created_at: firstResultDate || orderData.created_at || null,
    };

    const groupedResults = groupPdfResultsByTestName(
      orderData.resultados || [],
      getDisplayValue,
      getDisplayUnit,
      getResultType
    );

    const orderTests = groupedResults.map((res: any) => ({
      id: res.testId,
      name: res.testName,
      description: res.testDescription || '',
    }));

    const orderResults: PdfOrderResult[] = groupedResults.map((res: any) => ({
      id: res.id,
      testId: res.testId,
      testName: res.testName,
      testDescription: res.testDescription || '',
      notes: res.notes || '',
      date: res.date || null,
      details: res.details,
    }));

    return { pdfConfig, pdfPatient, pdfOrder, orderTests, orderResults };
  };

  const generateAndUploadResultsPdf = async (orderId: string) => {
    const [{ data: configData, error: configError }, { data: orderData, error: orderError }] =
      await Promise.all([
        supabase.from('configuracion_laboratorio').select('*').maybeSingle(),
        supabase
          .from('ordenes')
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
              pruebas (
                id,
                name,
                description,
                parametros_prueba_divisores (
                  id,
                  texto,
                  sort_order,
                  activo
                )
              )
            )
          `)
          .eq('id', orderId)
          .maybeSingle(),
      ]);

    if (configError) throw configError;
    if (orderError) throw orderError;
    if (!configData) throw new Error('No existe la configuración del laboratorio');
    if (!orderData) throw new Error('No se encontró la orden');
    if (!orderData.resultados?.length) throw new Error('La orden no tiene resultados registrados');

    const { pdfConfig, pdfPatient, pdfOrder, orderTests, orderResults } =
      buildPdfPayloadFromOrderData(configData, orderData);

    const blob = generateResultsPDF(pdfOrder, pdfPatient, orderTests, orderResults, pdfConfig, {
      autoDownload: false,
    });

    const safeCode = safeFileNamePart(orderData.code || orderId);
    const safePatient = safeFileNamePart(orderData.pacientes?.name || 'paciente');
    const filePath = `ordenes/${orderId}/resultados_${safeCode}_${safePatient}.pdf`;

    const { error: uploadError } = await supabase.storage
      .from('resultados')
      .upload(filePath, blob, {
        upsert: true,
        contentType: 'application/pdf',
      });

    if (uploadError) throw uploadError;

    const { data: publicUrlData } = supabase.storage.from('resultados').getPublicUrl(filePath);
    const publicUrl = publicUrlData?.publicUrl;

    if (!publicUrl) {
      throw new Error('No se pudo obtener la URL pública del PDF');
    }

    const resultIds = (orderData.resultados || []).map((r: any) => r.id).filter(Boolean);

    if (!resultIds.length) {
      throw new Error('No se encontraron filas de resultados para actualizar la URL');
    }

    const { error: updateUrlError } = await supabase
      .from('resultados')
      .update({ resultados_url: publicUrl })
      .in('id', resultIds);

    if (updateUrlError) throw updateUrlError;

    return publicUrl;
  };

  const getExistingResultsUrl = async (orderId: string) => {
    const { data, error } = await supabase
      .from('resultados')
      .select('resultados_url')
      .eq('order_id', orderId)
      .not('resultados_url', 'is', null)
      .limit(1);

    if (error) throw error;
    return data?.[0]?.resultados_url || null;
  };

  const downloadPdfFromUrl = async (url: string, orderCode: string) => {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error('No se pudo descargar el PDF almacenado');
    }

    const blob = await response.blob();
    downloadBlob(blob, `resultados_${orderCode}.pdf`);
  };

  const handleSendResultsWhatsapp = async (order: any) => {
    try {
      const paid = isOrderPaid(order);
      const saldo = getPendingBalance(order);

      if (!paid) {
        toast.error(
          `No se puede enviar el PDF porque la orden aún tiene un saldo pendiente de $${saldo.toFixed(2)}`
        );
        return;
      }

      const phone = normalizePhoneForWhatsapp(order?.pacientes?.phone);
      if (!phone) {
        toast.error('El paciente no tiene un número de teléfono válido');
        return;
      }

      let url = await getExistingResultsUrl(order.id);

      if (!url) {
        toast.info('No existía PDF almacenado. Se generará y guardará ahora...');
        url = await generateAndUploadResultsPdf(order.id);
      }

      const message =
        `Hola ${order?.pacientes?.name || ''}, compartimos su PDF de resultados de laboratorio.\n\n` +
        `Orden: ${order?.code || ''}\n` +
        `Documento: ${url}`;

      const waUrl = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
      window.open(waUrl, '_blank');

      toast.success('Enlace preparado para WhatsApp');
    } catch (error: any) {
      toast.error('No se pudo preparar WhatsApp: ' + (error?.message || 'desconocido'));
    }
  };

  const sendResultsEmailIfEligible = async (orderId: string) => {
    const { data: orderData, error } = await supabase
      .from('ordenes')
      .select(`
        id,
        code,
        total,
        paid_amount,
        pacientes (
          name,
          email
        ),
        resultados (
          id,
          resultados_url
        )
      `)
      .eq('id', orderId)
      .maybeSingle();

    if (error) throw error;
    if (!orderData) throw new Error('No se encontró la orden');

    const total = round2(safeNumber(orderData.total, 0));
    const paid = round2(safeNumber(orderData.paid_amount, 0));
    const saldo = round2(Math.max(total - paid, 0));

    if (saldo > 0) {
      return {
        sent: false,
        reason: `La orden aún tiene saldo pendiente de $${saldo.toFixed(2)}`,
      };
    }

    const email = String(orderData.pacientes?.email || '').trim();
    if (!email) {
      return {
        sent: false,
        reason: 'El paciente no tiene correo registrado',
      };
    }

    const pdfUrl =
      orderData.resultados?.find((r: any) => !!r.resultados_url)?.resultados_url || null;

    if (!pdfUrl) {
      return {
        sent: false,
        reason: 'No existe una URL registrada del PDF de resultados',
      };
    }

    await sendDocumentEmail({
      to: email,
      documentType: 'resultados',
      orderCode: orderData.code,
      patientName: orderData.pacientes?.name || '',
      pdfUrl,
      filename: `resultados_${orderData.code}.pdf`,
    });

    return {
      sent: true,
      reason: '',
    };
  };
  
  const handleSaveResults = async () => {
    if (!validateEntries()) return;

    try {
      setSaving(true);

      const { data: existingOrderResults, error: existingOrderResultsError } = await supabase
        .from('resultados')
        .select(`
          id,
          test_id,
          pruebas (
            id,
            name,
            description
          )
        `)
        .eq('order_id', selectedOrderId);

      if (existingOrderResultsError) throw existingOrderResultsError;

      for (const test of orderDetails.tests) {
        const groupedTestKey = buildGroupedTestKey(test.name, test.description);

        const matchingExistingResults = (existingOrderResults || []).filter((r: any) => {
          const existingKey = buildGroupedTestKey(
            r?.pruebas?.name,
            r?.pruebas?.description
          );
          return existingKey === groupedTestKey;
        });

        const primaryExistingResult = matchingExistingResults[0] || null;
        const duplicateExistingResults = matchingExistingResults.slice(1);

        let resultId: string;

        if (primaryExistingResult) {
          resultId = primaryExistingResult.id;

          const { error: updateResultError } = await supabase
            .from('resultados')
            .update({
              date: resultDate,
              resultados_url: null,
            })
            .eq('id', resultId);

          if (updateResultError) throw updateResultError;

          const { error: deleteDetailError } = await supabase
            .from('resultado_detalle')
            .delete()
            .eq('result_id', resultId);

          if (deleteDetailError) throw deleteDetailError;
        } else {
          const preferredTestId =
            Array.isArray(test.test_ids) && test.test_ids.length > 0
              ? test.test_ids[0]
              : test.id;

          const { data: resultDoc, error: resError } = await supabase
            .from('resultados')
            .insert([
              {
                order_id: selectedOrderId,
                test_id: preferredTestId,
                date: resultDate,
                resultados_url: null,
              },
            ])
            .select()
            .single();

          if (resError) throw resError;
          resultId = resultDoc.id;
        }

        for (const duplicateResult of duplicateExistingResults) {
          const { error: deleteDuplicateDetailsError } = await supabase
            .from('resultado_detalle')
            .delete()
            .eq('result_id', duplicateResult.id);

          if (deleteDuplicateDetailsError) throw deleteDuplicateDetailsError;

          const { error: deleteDuplicateResultError } = await supabase
            .from('resultados')
            .delete()
            .eq('id', duplicateResult.id);

          if (deleteDuplicateResultError) throw deleteDuplicateResultError;
        }

        const detailsToInsert = (test.structure_items || [])
          .filter((structureItem: any) => structureItem.item_type === 'parameter')
          .map((structureItem: any) => {
            const param = structureItem.parameter;
            const entryItem = entryValues[param.id] || emptyEntryValue();
            const resultType: ResultType = param.result_type || 'numeric';
            const range =
              resultType === 'numeric' ? getAppliedRange(param, orderDetails.pacientes) : null;

            let status: ResultStatus = null;
            let value_numeric: number | null = null;
            let value_boolean: boolean | null = null;
            let value_text: string | null = null;
            let applied_range_min: number | null = null;
            let applied_range_max: number | null = null;

            if (resultType === 'numeric') {
              value_numeric = Number(entryItem.value_numeric);
              status = classifyNumericValue(value_numeric, range);
              applied_range_min = range?.min ?? null;
              applied_range_max = range?.max ?? null;
            }

            if (resultType === 'boolean') {
              value_boolean = entryItem.value_boolean === 'true';
              status = value_boolean ? 'positive' : 'negative';
            }

            if (resultType === 'text') {
              value_text = entryItem.value_text.trim();
              status = 'text';
            }

            return {
              result_id: resultId,
              parameter_id: param.id,
              value_numeric,
              value_boolean,
              value_text,
              observation: param.allow_observation ? entryItem.observation.trim() || null : null,
              status,
              applied_range_min,
              applied_range_max,
            };
          });

        const { error: detError } = await supabase
          .from('resultado_detalle')
          .insert(detailsToInsert);

        if (detError) throw detError;
      }

      const { error: updateOrderError } = await supabase
        .from('ordenes')
        .update({ status: 'completed' })
        .eq('id', selectedOrderId);

      if (updateOrderError) throw updateOrderError;

      await generateAndUploadResultsPdf(selectedOrderId!);

      const emailResult = await sendResultsEmailIfEligible(selectedOrderId!);

      if (emailResult.sent) {
        toast.success('Resultados guardados, PDF generado y correo enviado exitosamente');
      } else {
        toast.success('Resultados guardados y PDF generado exitosamente');

        if (emailResult.reason) {
          toast.info(`No se envió el correo: ${emailResult.reason}`);
        }
      }

      setEntryDialogOpen(false);
      setOrderDetails(null);
      setSelectedOrderId(null);
      setEntryValues({});
      await fetchOrders();
    } catch (error: any) {
      toast.error('Error al guardar: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const getResultType = (det: any): ResultType => {
    return (det?.parametros_prueba?.result_type || 'numeric') as ResultType;
  };

  const getDisplayValue = (det: any) => {
    const resultType = getResultType(det);

    if (resultType === 'numeric') {
      const value = det.value_numeric;
      return value !== null && value !== undefined && value !== '' ? String(value) : '';
    }

    if (resultType === 'boolean') {
      const boolValue = det.value_boolean;
      if (boolValue === null || boolValue === undefined) return '';

      return boolValue
        ? det.parametros_prueba?.bool_true_label || 'Positivo'
        : det.parametros_prueba?.bool_false_label || 'Negativo';
    }

    return det.value_text || '';
  };

  const getDisplayUnit = (det: any) => {
    const resultType = getResultType(det);
    if (resultType !== 'numeric') return '';
    return det.parametros_prueba?.unit || '';
  };

  const handleDownloadResultPdf = async (orderId: string) => {
    try {
      setDownloadingOrderId(orderId);
      toast.info('Preparando PDF de resultados...');

      const { data: orderData, error: orderError } = await supabase
        .from('ordenes')
        .select(`
          id,
          code,
          total,
          paid_amount,
          resultados (
            id,
            resultados_url
          )
        `)
        .eq('id', orderId)
        .maybeSingle();

      if (orderError) throw orderError;
      if (!orderData) throw new Error('No se encontró la orden');

      const total = round2(safeNumber(orderData.total, 0));
      const paid = round2(safeNumber(orderData.paid_amount, 0));
      const saldo = round2(Math.max(total - paid, 0));

      if (paid < total) {
        throw new Error(
          `No se puede descargar el PDF porque la orden aún no está pagada en su totalidad. Saldo pendiente: $${saldo.toFixed(2)}`
        );
      }

      let pdfUrl =
        orderData.resultados?.find((r: any) => !!r.resultados_url)?.resultados_url || null;

      if (!pdfUrl) {
        toast.info('No existía PDF almacenado. Se generará y guardará ahora...');
        pdfUrl = await generateAndUploadResultsPdf(orderId);
      }

      await downloadPdfFromUrl(pdfUrl, orderData.code || 'resultados');
      toast.success('PDF descargado correctamente');
    } catch (error: any) {
      toast.error('No se pudo obtener el PDF: ' + (error?.message || 'desconocido'));
    } finally {
      setDownloadingOrderId(null);
    }
  };

  const hasSearch = search.trim() !== '';

  const pendingOrders = useMemo(
    () => orders.filter((o) => o.status !== 'completed' && matchesSearch(o)),
    [orders, search]
  );

  const completedOrders = useMemo(
    () =>
      orders.filter((o) => {
        if (o.status !== 'completed') return false;

        if (hasSearch) {
          return matchesSearch(o);
        }

        return isWithinLastWeek(o.created_at);
      }),
    [orders, search]
  );

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-display font-bold">Resultados de Laboratorio</h1>
        <p className="text-muted-foreground text-sm">
          Validación técnica y registro de resultados
        </p>
      </div>

      <Card className="border-slate-200">
        <CardContent className="pt-6">
          <div className="max-w-md">
            <Label className="text-sm font-semibold text-slate-700 mb-2 block">
              Buscar paciente
            </Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por nombre, cédula o código..."
                className="pl-10 bg-white"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {pendingOrders.length > 0 && (
        <Card className="border-amber-100 bg-amber-50/20">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg font-display flex items-center gap-2 text-amber-700">
              <FlaskConical className="w-5 h-5" />
              Pendientes de Validación
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3">
              {pendingOrders.map(order => (
                <div
                  key={order.id}
                  className="flex items-center justify-between p-4 rounded-xl bg-white border border-amber-100 shadow-sm"
                >
                  <div>
                    <p className="font-bold text-slate-700">
                      {order.code} — {order.pacientes?.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Recibido: {new Date(order.created_at).toLocaleDateString()}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <Badge variant="outline">
                        Total: ${safeNumber(order.total, 0).toFixed(2)}
                      </Badge>
                      <Badge variant="outline">
                        Pagado: ${safeNumber(order.paid_amount, 0).toFixed(2)}
                      </Badge>
                      <Badge
                        variant={isOrderPaid(order) ? 'default' : 'secondary'}
                      >
                        {order.payment_status || 'PENDIENTE'}
                      </Badge>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => openEntry(order)}
                    className="gradient-clinical text-primary-foreground border-0"
                  >
                    Ingresar Resultados
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {search.trim() && pendingOrders.length === 0 && completedOrders.length === 0 && (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            No se encontraron órdenes que coincidan con la búsqueda.
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader
          className="pb-3 border-b border-slate-50 cursor-pointer select-none"
          onClick={() => setHistoryOpen(prev => !prev)}
        >
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-display flex items-center gap-2">
              Historial de Resultados
              <Badge variant="outline">{completedOrders.length}</Badge>
            </CardTitle>

            <Button variant="ghost" size="icon" type="button">
              {historyOpen ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </Button>
          </div>
        </CardHeader>

        {historyOpen && (
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Orden</TableHead>
                  <TableHead>Paciente</TableHead>
                  <TableHead className="hidden md:table-cell">Fecha Emisión</TableHead>
                  <TableHead className="hidden md:table-cell">Pago</TableHead>
                  <TableHead className="hidden md:table-cell">Saldo</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {completedOrders.map(order => {
                  const paid = isOrderPaid(order);
                  const saldo = getPendingBalance(order);

                  return (
                    <TableRow key={order.id}>
                      <TableCell className="font-mono font-bold text-slate-600">
                        {order.code}
                      </TableCell>

                      <TableCell className="text-sm">{order.pacientes?.name}</TableCell>

                      <TableCell className="hidden md:table-cell text-xs">
                        {new Date(order.created_at).toLocaleDateString()}
                      </TableCell>

                      <TableCell className="hidden md:table-cell">
                        <Badge variant={paid ? 'default' : 'secondary'}>
                          {order.payment_status || (paid ? 'PAGADO' : 'PENDIENTE')}
                        </Badge>
                      </TableCell>

                      <TableCell className="hidden md:table-cell text-sm font-medium">
                        ${saldo.toFixed(2)}
                      </TableCell>

                      <TableCell>
                        <Badge className="bg-emerald-50 text-emerald-700 border-emerald-100 flex w-fit items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" /> Validado
                        </Badge>
                      </TableCell>

                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className={paid ? 'text-emerald-600' : 'text-slate-400'}
                            onClick={() => handleSendResultsWhatsapp(order)}
                            disabled={!paid}
                            title={
                              paid
                                ? 'Enviar por WhatsApp'
                                : `Pago incompleto. Saldo pendiente: $${saldo.toFixed(2)}`
                            }
                          >
                            <MessageCircle className="w-4 h-4" />
                          </Button>

                          <Button
                            variant="ghost"
                            size="icon"
                            className={paid ? 'text-blue-600' : 'text-slate-400'}
                            onClick={() => {
                              if (!paid) {
                                toast.error(
                                  `No se puede descargar el PDF porque la orden aún tiene un saldo pendiente de $${saldo.toFixed(2)}`
                                );
                                return;
                              }
                              handleDownloadResultPdf(order.id);
                            }}
                            disabled={downloadingOrderId === order.id || !paid}
                            title={
                              paid
                                ? 'Descargar PDF'
                                : `Pago incompleto. Saldo pendiente: $${saldo.toFixed(2)}`
                            }
                          >
                            {downloadingOrderId === order.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Download className="w-4 h-4" />
                            )}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}

                {completedOrders.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      No hay resultados que coincidan con la búsqueda
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        )}
      </Card>

      <Dialog
        open={entryDialogOpen}
        onOpenChange={(open) => {
          if (!saving) {
            setEntryDialogOpen(open);
          }
        }}
      >
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display text-xl text-primary">
              Ingreso Técnico de Resultados
            </DialogTitle>

            {orderDetails && (
              <div className="flex flex-wrap gap-4 mt-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <span>Paciente: {orderDetails.pacientes.name}</span>
                <span>Edad: {calcAge(orderDetails.pacientes.birth_date)} años</span>
                <span>Sexo: {orderDetails.pacientes.sex}</span>
                <span>Total: ${safeNumber(orderDetails.total, 0).toFixed(2)}</span>
                <span>Pagado: ${safeNumber(orderDetails.paid_amount, 0).toFixed(2)}</span>
                <span>Saldo: ${getPendingBalance(orderDetails).toFixed(2)}</span>
              </div>
            )}
          </DialogHeader>

          <div className="space-y-6 mt-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 rounded-xl border bg-slate-50/60">
              <div className="md:col-span-1">
                <Label className="text-sm font-semibold flex items-center gap-2">
                  <CalendarDays className="w-4 h-4" />
                  Fecha del resultado
                </Label>
                <Input
                  type="date"
                  value={resultDate}
                  onChange={e => setResultDate(e.target.value)}
                  className="bg-white"
                />
              </div>
            </div>

            {orderDetails?.tests.map((test: any) => (
              <div key={test.id} className="space-y-4 border-l-4 border-primary/20 pl-4">
                <div>
                  <h3 className="font-display font-bold text-lg text-slate-800 underline decoration-primary/30 underline-offset-4">
                    {test.name}
                  </h3>

                  {test.description?.trim() && (
                    <p className="mt-1 text-sm text-slate-600">
                      {test.description}
                    </p>
                  )}
                </div>

                <div className="space-y-4">
                  {(test.structure_items || []).map((structureItem: any) => {
                    if (structureItem.item_type === 'divider') {
                      return (
                        <div
                          key={structureItem.id}
                          className="rounded-lg border border-primary/20 bg-primary/5 px-4 py-3"
                        >
                          <p className="font-display font-bold text-lg text-slate-800 underline decoration-primary/30 underline-offset-4">
                            {structureItem.texto}
                          </p>
                        </div>
                      );
                    }

                    const param = structureItem.parameter;
                    const item = entryValues[param.id] || emptyEntryValue();
                    const range = getAppliedRange(param, orderDetails.pacientes);
                    const status = getStatusPreview(param);
                    const resultType: ResultType = param.result_type || 'numeric';

                    return (
                      <div
                        key={param.id}
                        className="grid grid-cols-12 gap-4 items-start bg-slate-50/50 p-3 rounded-lg border border-slate-100"
                      >
                        <div className="col-span-12 md:col-span-4">
                          <Label className="text-sm font-bold text-slate-700">
                            {param.name}
                          </Label>

                          <div className="flex flex-wrap gap-2 text-[10px] font-mono text-slate-500 mt-1">
                            <span>Tipo: {resultType}</span>
                            {resultType === 'numeric' && (
                              <span>Unidad: {param.unit || '—'}</span>
                            )}
                            {resultType === 'numeric' && range && (
                              <span>Ref: [{range.min} - {range.max}]</span>
                            )}
                          </div>
                        </div>

                        <div className="col-span-12 md:col-span-5">
                          {resultType === 'numeric' && (
                            <Input
                              type="number"
                              step="any"
                              className="bg-white border-slate-200"
                              placeholder="0.00"
                              value={item.value_numeric}
                              onChange={e =>
                                updateEntryValue(param.id, 'value_numeric', e.target.value)
                              }
                            />
                          )}

                          {resultType === 'boolean' && (
                            <Select
                              value={item.value_boolean}
                              onValueChange={value =>
                                updateEntryValue(
                                  param.id,
                                  'value_boolean',
                                  value as '' | 'true' | 'false'
                                )
                              }
                            >
                              <SelectTrigger className="bg-white">
                                <SelectValue placeholder="Seleccione un valor" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="true">
                                  {param.bool_true_label || 'Positivo'}
                                </SelectItem>
                                <SelectItem value="false">
                                  {param.bool_false_label || 'Negativo'}
                                </SelectItem>
                              </SelectContent>
                            </Select>
                          )}

                          {resultType === 'text' && (
                            <>
                              <Textarea
                                className="bg-white border-slate-200 min-h-[90px]"
                                placeholder={param.valor_default ? 'Valor precargado editable...' : 'Ingrese el resultado...'}
                                value={item.value_text}
                                onChange={e =>
                                  updateEntryValue(param.id, 'value_text', e.target.value)
                                }
                              />
                              {param.valor_default && (
                                <p className="text-[11px] text-slate-500 mt-1">
                                  Valor por defecto: <span className="font-medium">{param.valor_default}</span>
                                </p>
                              )}
                            </>
                          )}

                          {param.allow_observation && (
                            <div className="mt-3">
                              <Label className="text-xs font-semibold text-slate-600">
                                Observación
                              </Label>
                              <Textarea
                                className="bg-white border-slate-200 min-h-[70px] mt-1"
                                placeholder="Observación opcional..."
                                value={item.observation}
                                onChange={e =>
                                  updateEntryValue(param.id, 'observation', e.target.value)
                                }
                              />
                            </div>
                          )}
                        </div>

                        <div className="col-span-12 md:col-span-3">
                          {status && (
                            <Badge
                              className={`w-full justify-center ${
                                status === 'normal'
                                  ? 'bg-emerald-500'
                                  : status === 'high'
                                  ? 'bg-rose-500'
                                  : status === 'low'
                                  ? 'bg-amber-500'
                                  : status === 'positive'
                                  ? 'bg-rose-500'
                                  : status === 'negative'
                                  ? 'bg-emerald-500'
                                  : 'bg-slate-600'
                              } text-white border-0 shadow-sm`}
                            >
                              {status === 'normal' && 'NORMAL'}
                              {status === 'high' && 'ALTO ↑'}
                              {status === 'low' && 'BAJO ↓'}
                              {status === 'positive' && (param.bool_true_label || 'POSITIVO')}
                              {status === 'negative' && (param.bool_false_label || 'NEGATIVO')}
                              {status === 'text' && 'TEXTO'}
                            </Badge>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}

            <Button
              onClick={handleSaveResults}
              disabled={saving}
              className="w-full gradient-clinical text-primary-foreground border-0 h-12 text-lg shadow-lg mt-6"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Guardando resultados...
                </>
              ) : (
                'Validar y Finalizar Orden'
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}