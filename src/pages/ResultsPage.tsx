import React, { ReactNode, useEffect, useMemo, useRef, useState } from 'react';
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
  GripVertical,
  Layers3,
  FileStack,
} from 'lucide-react';
import { toast } from 'sonner';

import {
  DndContext,
  DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';


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


type PdfLayoutItem = {
  id: string;
  itemType: 'parameter' | 'divider';
  order: number;
};

type PdfTestLayout = {
  key: string;
  testId: string;
  order: number;
  included: boolean;
  pageGroup: string | null;
  items: PdfLayoutItem[];
};

type PdfLayoutConfig = {
  version: 1;
  tests: PdfTestLayout[];
};

const PDF_PAGE_GROUPS = Array.from({ length: 12 }, (_, index) => String(index + 1));

function getStructureItemLayoutId(item: any): string {
  if (item?.item_type === 'parameter') return String(item?.parameter?.id || item?.id || '');
  return String(item?.id || '');
}

function getPdfDetailLayoutId(item: any): string {
  if (item?.item_type === 'divider') {
    return String(item?.id || '').replace(/^divider-/, '');
  }
  return String(item?.parameterId || item?.id || '');
}

function SortableShell({
  id,
  children,
  disabled = false,
  className = '',
}: {
  id: string;
  children: (handleProps: any, dragging: boolean) => ReactNode;
  disabled?: boolean;
  className?: string;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id, disabled });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : undefined,
    opacity: isDragging ? 0.72 : 1,
    position: 'relative',
  };

  return (
    <div ref={setNodeRef} style={style} className={className}>
      {children({ ...attributes, ...listeners }, isDragging)}
    </div>
  );
}

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

function isEntryValueEmpty(entry?: Partial<EntryValueItem> | null): boolean {
  if (!entry) return true;

  const valueNumeric = String(entry.value_numeric ?? '').trim();
  const valueBoolean = String(entry.value_boolean ?? '').trim();
  const valueText = String(entry.value_text ?? '').trim();
  const observation = String(entry.observation ?? '').trim();

  return (
    valueNumeric === '' &&
    valueBoolean === '' &&
    valueText === '' &&
    observation === ''
  );
}

function safeFileNamePart(value: any): string {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9_-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 80);
}

function compareBySortOrderThenIndex(a: any, b: any) {
  const aSort = Number.isFinite(Number(a?.sort_order))
    ? Number(a.sort_order)
    : Number.MAX_SAFE_INTEGER;

  const bSort = Number.isFinite(Number(b?.sort_order))
    ? Number(b.sort_order)
    : Number.MAX_SAFE_INTEGER;

  if (aSort !== bSort) return aSort - bSort;

  const aIndex = Number.isFinite(Number(a?._original_index))
    ? Number(a._original_index)
    : Number.MAX_SAFE_INTEGER;

  const bIndex = Number.isFinite(Number(b?._original_index))
    ? Number(b._original_index)
    : Number.MAX_SAFE_INTEGER;

  if (aIndex !== bIndex) return aIndex - bIndex;

  return String(a?.name || '').localeCompare(String(b?.name || ''), 'es', {
    sensitivity: 'base',
  });
}

function sortParametersForDisplay(params: any[] = []) {
  return [...params].sort(compareBySortOrderThenIndex);
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
    _original_index: Number.isFinite(Number(param?._original_index))
      ? Number(param._original_index)
      : Number.MAX_SAFE_INTEGER,
  })) as any;

  const dividerItems: DividerDisplayItem[] = [...(divisores || [])]
    .filter((d: any) => d.activo !== false)
    .map((divider: any) => ({
      id: divider.id,
      item_type: 'divider',
      texto: String(divider.texto || ''),
      sort_order: Number.isFinite(Number(divider?.sort_order))
        ? Number(divider.sort_order)
        : Number.MAX_SAFE_INTEGER,
      _original_index: Number.isFinite(Number(divider?._original_index))
        ? Number(divider._original_index)
        : Number.MAX_SAFE_INTEGER,
    })) as any;

  return [...parameterItems, ...dividerItems].sort((a: any, b: any) => {
    if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order;

    const aIndex = Number.isFinite(Number(a?._original_index))
      ? Number(a._original_index)
      : Number.MAX_SAFE_INTEGER;
    const bIndex = Number.isFinite(Number(b?._original_index))
      ? Number(b._original_index)
      : Number.MAX_SAFE_INTEGER;

    if (aIndex !== bIndex) return aIndex - bIndex;

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

function normalizeExamDescription(
  description: any,
  visibleDescription: boolean | null | undefined
) {
  if (visibleDescription === false) return '';
  return String(description || '').trim().toLowerCase();
}

function buildGroupedTestKey(
  name: any,
  _description?: any,
  _visibleDescription?: boolean | null | undefined
) {
  // Una prueba se identifica únicamente por su nombre.
  // Si la orden contiene varias pruebas con el mismo nombre,
  // todos sus parámetros se consolidan en una sola prueba.
  return normalizeExamName(name);
}

function normalizeSavedLayoutKey(value: any) {
  const raw = String(value || '').trim().toLowerCase();

  // Compatibilidad con diseños guardados por versiones anteriores,
  // donde la clave era: nombre|||descripción.
  return raw.split('|||')[0].trim();
}

function groupTestsByName(details: any[] = []) {
  const groupedMap: Record<string, any> = {};
  const groupedList: any[] = [];

  details.forEach((d: any, detailIndex: number) => {
    const test = d?.pruebas;
    if (!test) return;

    const key = buildGroupedTestKey(
      test.name,
      test.description,
      test.visible_description
    );
    if (!key) return;

    if (!groupedMap[key]) {
      const visibleDescription = test.visible_description ?? true;

      groupedMap[key] = {
        id: test.id,
        layoutKey: key,
        name: test.name,
        description: visibleDescription ? test.description || '' : '',
        visible_description: visibleDescription,
        test_ids: [],
        parametros_prueba: [],
        divisores: [],
        structure_items: [],
        _original_index: detailIndex,
      };

      groupedList.push(groupedMap[key]);
    }

    const group = groupedMap[key];

    if (!group.test_ids.includes(test.id)) {
      group.test_ids.push(test.id);
    }

    (test.parametros_prueba || []).forEach((param: any, paramIndex: number) => {
      const alreadyExists = group.parametros_prueba.some((p: any) => p.id === param.id);

      if (!alreadyExists) {
        group.parametros_prueba.push({
          ...param,
          _original_index:
            detailIndex * 1000 + paramIndex,
        });
      }
    });

    (test.parametros_prueba_divisores || []).forEach((divider: any, dividerIndex: number) => {
      const alreadyExists = group.divisores.some((x: any) => x.id === divider.id);

      if (!alreadyExists) {
        group.divisores.push({
          ...divider,
          _original_index:
            detailIndex * 1000 + dividerIndex,
        });
      }
    });
  });

  return groupedList.map((group: any) => {
    const sortedParams = [...(group.parametros_prueba || [])].sort(compareBySortOrderThenIndex);

    const sortedDividers = [...(group.divisores || [])].sort((a: any, b: any) => {
      const aSort = Number.isFinite(Number(a?.sort_order))
        ? Number(a.sort_order)
        : Number.MAX_SAFE_INTEGER;
      const bSort = Number.isFinite(Number(b?.sort_order))
        ? Number(b.sort_order)
        : Number.MAX_SAFE_INTEGER;

      if (aSort !== bSort) return aSort - bSort;

      const aIndex = Number.isFinite(Number(a?._original_index))
        ? Number(a._original_index)
        : Number.MAX_SAFE_INTEGER;
      const bIndex = Number.isFinite(Number(b?._original_index))
        ? Number(b._original_index)
        : Number.MAX_SAFE_INTEGER;

      if (aIndex !== bIndex) return aIndex - bIndex;

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
    const visibleDescription = res?.pruebas?.visible_description ?? true;
    const key = buildGroupedTestKey(
      testName,
      testDescription,
      visibleDescription
    );

    if (!key) return;

    if (!groupedMap[key]) {
      groupedMap[key] = {
        id: res.id,
        layoutKey: key,
        testId: res.pruebas?.id || res.test_id || res.id,
        testName,
        testDescription: visibleDescription ? testDescription : '',
        visible_description: visibleDescription,
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

    (res.resultado_detalle || []).forEach((det: any) => {
      const resultType = getResultType(det);

      const hasNumeric =
        det.value_numeric !== null &&
        det.value_numeric !== undefined &&
        String(det.value_numeric).trim() !== '';

      const hasBoolean =
        det.value_boolean !== null &&
        det.value_boolean !== undefined;

      const hasText =
        String(det.value_text || '').trim() !== '';

      const hasObservation =
        String(det.observation || '').trim() !== '';

      const hasVisibleValue =
        (resultType === 'numeric' && hasNumeric) ||
        (resultType === 'boolean' && hasBoolean) ||
        (resultType === 'text' && hasText);

      if (!hasVisibleValue && !hasObservation) {
        return;
      }

      dividers.forEach((divider: any) => {
        const exists = targetDetails.some((x: any) => x.id === divider.id);
        if (!exists) {
          targetDetails.push(divider);
        }
      });

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
          resultType,
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
    .map((group: any) => {
      const sortedDetails = [...(group.details || [])].sort((a: any, b: any) => {
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
      });

      const cleanedDetails: any[] = [];
      let pendingDividers: any[] = [];

      sortedDetails.forEach((item: any) => {
        if (item.item_type === 'divider') {
          pendingDividers.push(item);
          return;
        }

        cleanedDetails.push(...pendingDividers, item);
        pendingDividers = [];
      });

      return {
        ...group,
        details: cleanedDetails,
      };
    })
    .filter((group: any) => {
      const hasNotes = String(group.notes || '').trim() !== '';
      const hasParameterDetails = (group.details || []).some(
        (item: any) => item.item_type === 'parameter'
      );

      return hasNotes || hasParameterDetails;
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

  // Vista previa real del PDF (sin guardar en Supabase)
  const [pdfPreviewConfig, setPdfPreviewConfig] = useState<any>(null);
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string | null>(null);
  const [pdfPreviewLoading, setPdfPreviewLoading] = useState(false);
  const [pdfPreviewError, setPdfPreviewError] = useState<string | null>(null);
  const pdfPreviewUrlRef = useRef<string | null>(null);

  const [search, setSearch] = useState('');
  const [historyOpen, setHistoryOpen] = useState(false);

  type RelativePosition = 'before' | 'after';

  const [testMoveSelections, setTestMoveSelections] = useState<
    Record<string, { position: RelativePosition; targetKey: string }>
  >({});

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );


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


  const buildPdfLayoutFromTests = (tests: any[] = []): PdfLayoutConfig => ({
    version: 1,
    tests: tests.map((test: any, testIndex: number) => ({
      key: String(test.layoutKey || buildGroupedTestKey(test.name, test.description, test.visible_description)),
      testId: String(test.id || ''),
      order: testIndex,
      included: test.pdf_included !== false,
      pageGroup: test.pdf_page_group || null,
      items: (test.structure_items || []).map((item: any, itemIndex: number) => ({
        id: getStructureItemLayoutId(item),
        itemType: item.item_type,
        order: itemIndex,
      })),
    })),
  });

  const applySavedPdfLayoutToTests = (tests: any[] = [], savedLayout: any): any[] => {
    const layoutTests: PdfTestLayout[] = Array.isArray(savedLayout?.tests)
      ? savedLayout.tests
      : [];

    if (!layoutTests.length) {
      return tests.map((test: any) => ({
        ...test,
        pdf_included: true,
        pdf_page_group: null,
      }));
    }

    /**
     * MIGRACIÓN DE DISEÑOS ANTIGUOS
     *
     * Antes el layoutKey incluía nombre + descripción. Ahora una prueba
     * se identifica únicamente por nombre. Si existen varias entradas
     * antiguas con el mismo nombre, se fusionan también sus órdenes de
     * parámetros en una sola entrada lógica.
     */
    const mergedSavedByName = new Map<string, PdfTestLayout>();

    layoutTests.forEach((item, savedIndex) => {
      const key = normalizeSavedLayoutKey(item.key);
      if (!key) return;

      const current = mergedSavedByName.get(key);

      if (!current) {
        mergedSavedByName.set(key, {
          ...item,
          key,
          order: Number.isFinite(Number(item.order))
            ? Number(item.order)
            : savedIndex,
          items: [...(item.items || [])],
        });
        return;
      }

      const existingIds = new Set((current.items || []).map((x) => String(x.id)));
      const mergedItems = [...(current.items || [])];

      (item.items || [])
        .slice()
        .sort((a, b) => Number(a.order) - Number(b.order))
        .forEach((savedItem) => {
          if (!existingIds.has(String(savedItem.id))) {
            mergedItems.push({
              ...savedItem,
              order: mergedItems.length,
            });
            existingIds.add(String(savedItem.id));
          }
        });

      current.items = mergedItems;
      current.order = Math.min(
        Number.isFinite(Number(current.order)) ? Number(current.order) : savedIndex,
        Number.isFinite(Number(item.order)) ? Number(item.order) : savedIndex
      );

      if (!current.pageGroup && item.pageGroup) {
        current.pageGroup = item.pageGroup;
      }

      // Si cualquiera de las entradas antiguas estaba incluida, mantenemos
      // la prueba consolidada incluida.
      current.included = current.included !== false || item.included !== false;
    });

    return tests
      .map((test: any, originalIndex: number) => {
        const key = buildGroupedTestKey(
          test.name,
          test.description,
          test.visible_description
        );

        const saved = mergedSavedByName.get(key);

        let structureItems = [...(test.structure_items || [])];

        if (saved?.items?.length) {
          const itemOrder = new Map(
            saved.items.map((item) => [String(item.id), Number(item.order)])
          );

          structureItems.sort((a: any, b: any) => {
            const ao = itemOrder.get(getStructureItemLayoutId(a));
            const bo = itemOrder.get(getStructureItemLayoutId(b));

            const aOrder = ao ?? Number.MAX_SAFE_INTEGER;
            const bOrder = bo ?? Number.MAX_SAFE_INTEGER;

            if (aOrder !== bOrder) return aOrder - bOrder;

            return Number(a?.sort_order ?? Number.MAX_SAFE_INTEGER) -
              Number(b?.sort_order ?? Number.MAX_SAFE_INTEGER);
          });
        }

        return {
          ...test,
          layoutKey: key,
          structure_items: structureItems,
          pdf_included: saved ? saved.included !== false : true,
          pdf_page_group: saved?.pageGroup || null,
          _pdf_order: saved?.order ?? originalIndex,
        };
      })
      .sort((a: any, b: any) => a._pdf_order - b._pdf_order);
  };

  const updateTestPdfOption = (layoutKey: string, patch: Record<string, any>) => {
    setOrderDetails((prev: any) => {
      if (!prev) return prev;
      return {
        ...prev,
        tests: (prev.tests || []).map((test: any) =>
          String(test.layoutKey) === String(layoutKey) ? { ...test, ...patch } : test
        ),
      };
    });
  };

  /**
   * Mantiene juntos, de forma consecutiva, todos los exámenes que pertenecen
   * al mismo grupo de hoja. La posición del bloque se determina por la posición
   * del primer examen del grupo en el orden actual.
   */
  const compactTestsByPageGroup = (tests: any[] = []) => {
    const compacted: any[] = [];
    const processedGroups = new Set<string>();

    for (const test of tests) {
      const group = test?.pdf_page_group ? String(test.pdf_page_group) : null;

      if (!group) {
        compacted.push(test);
        continue;
      }

      if (processedGroups.has(group)) continue;
      processedGroups.add(group);

      const members = tests.filter(
        (candidate: any) => String(candidate?.pdf_page_group || '') === group
      );

      compacted.push(...members);
    }

    return compacted;
  };

  /**
   * Al asignar un grupo de hoja, además de guardar el grupo compactamos la lista
   * para que los exámenes del mismo grupo queden físicamente juntos en el orden
   * que se enviará al PDF.
   */
  const updateTestPageGroup = (layoutKey: string, pageGroup: string | null) => {
    setOrderDetails((prev: any) => {
      if (!prev) return prev;

      const updatedTests = (prev.tests || []).map((test: any) =>
        String(test.layoutKey) === String(layoutKey)
          ? { ...test, pdf_page_group: pageGroup }
          : test
      );

      return {
        ...prev,
        tests: compactTestsByPageGroup(updatedTests),
      };
    });
  };

  const moveItemRelative = <T,>(
    items: T[],
    fromIndex: number,
    targetIndex: number,
    position: RelativePosition
  ): T[] => {
    if (
      fromIndex < 0 ||
      targetIndex < 0 ||
      fromIndex >= items.length ||
      targetIndex >= items.length ||
      fromIndex === targetIndex
    ) {
      return items;
    }

    const next = [...items];
    const [moved] = next.splice(fromIndex, 1);

    const targetAfterRemoval =
      fromIndex < targetIndex ? targetIndex - 1 : targetIndex;

    const insertAt =
      position === 'before'
        ? targetAfterRemoval
        : targetAfterRemoval + 1;

    next.splice(Math.max(0, Math.min(insertAt, next.length)), 0, moved);
    return next;
  };

  const moveTestRelative = (
    layoutKey: string,
    targetKey: string,
    position: RelativePosition
  ) => {
    if (!targetKey || layoutKey === targetKey) return;

    setOrderDetails((prev: any) => {
      if (!prev) return prev;

      const tests = [...(prev.tests || [])];
      const fromIndex = tests.findIndex(
        (test: any) => String(test.layoutKey) === String(layoutKey)
      );
      const targetIndex = tests.findIndex(
        (test: any) => String(test.layoutKey) === String(targetKey)
      );

      if (fromIndex < 0 || targetIndex < 0) return prev;

      return {
        ...prev,
        tests: compactTestsByPageGroup(
          moveItemRelative(tests, fromIndex, targetIndex, position)
        ),
      };
    });
  };

  const handleParameterDragEnd = (layoutKey: string, event: DragEndEvent) => {
    const activeId = String(event.active.id).replace(/^item:/, '');
    const overId = event.over
      ? String(event.over.id).replace(/^item:/, '')
      : '';

    if (!overId || activeId === overId) return;

    setOrderDetails((prev: any) => {
      if (!prev) return prev;

      const tests = [...(prev.tests || [])];
      const testIndex = tests.findIndex(
        (test: any) => String(test.layoutKey) === String(layoutKey)
      );

      if (testIndex < 0) return prev;

      const test = tests[testIndex];
      const structureItems = [...(test.structure_items || [])];

      const oldIndex = structureItems.findIndex(
        (item: any) =>
          getStructureItemLayoutId(item) === activeId
      );
      const newIndex = structureItems.findIndex(
        (item: any) =>
          getStructureItemLayoutId(item) === overId
      );

      if (oldIndex < 0 || newIndex < 0) return prev;

      tests[testIndex] = {
        ...test,
        structure_items: arrayMove(structureItems, oldIndex, newIndex),
      };

      return {
        ...prev,
        tests,
      };
    });
  };

  const openEntry = async (order: any) => {
    try {
      setSelectedOrderId(order.id);
      setEntryValues({});
      setResultDate(new Date().toISOString().split('T')[0]);

      const [
        { data: details, error },
        { data: labConfig, error: labConfigError },
      ] = await Promise.all([
        supabase
          .from('orden_detalle')
          .select(`
            id,
            test_id,
            pruebas (
              id,
              name,
              description,
              visible_description,
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
          .order('id', { ascending: true }),
        supabase
          .from('configuracion_laboratorio')
          .select('*')
          .maybeSingle(),
      ]);

      if (error) throw error;
      if (labConfigError) throw labConfigError;
      if (!labConfig) throw new Error('No existe la configuración del laboratorio');

      const normalizedTests = applySavedPdfLayoutToTests(
        groupTestsByName(details || []),
        order.pdf_layout
      );

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
      setPdfPreviewConfig(labConfig);
      setPdfPreviewError(null);
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

    return true;
  };

  const buildLivePdfPreviewPayload = () => {
    if (!orderDetails || !pdfPreviewConfig) return null;

    const pdfConfig: PdfLabConfig = {
      name: pdfPreviewConfig.name || 'LABORATORIO CLÍNICO',
      owner: pdfPreviewConfig.owner || '',
      address: pdfPreviewConfig.address || '',
      ruc: pdfPreviewConfig.ruc || '',
      healthRegistry: pdfPreviewConfig.health_registry || '',
      phone: pdfPreviewConfig.phone || '',
      schedule: pdfPreviewConfig.schedule || '',
      logo: pdfPreviewConfig.logo || '',
      firma: pdfPreviewConfig.firma || '',
      sello: pdfPreviewConfig.sello || '',
    };

    const pdfPatient: PdfPatient = {
      name: orderDetails.pacientes?.name || '',
      cedula: orderDetails.pacientes?.cedula || '',
      phone: orderDetails.pacientes?.phone || '',
      sex: orderDetails.pacientes?.sex === 'F' ? 'F' : 'M',
      birth_date: orderDetails.pacientes?.birth_date || null,
    };

    const pdfOrder: PdfOrder = {
      code: orderDetails.code || '',
      accessKey: orderDetails.access_key || '',
      date: resultDate || orderDetails.created_at || '',
      created_at: resultDate || orderDetails.created_at || null,
    };

    const visibleTests = compactTestsByPageGroup(orderDetails.tests || []).filter(
      (test: any) => test.pdf_included !== false
    );

    const orderTests = visibleTests.map((test: any) => ({
      id: String(test.id || ''),
      layoutKey: String(test.layoutKey || ''),
      name: test.name || '',
      description: test.visible_description === false ? '' : test.description || '',
      visible_description: test.visible_description ?? true,
      pageGroup: test.pdf_page_group || null,
    }));

    const orderResults = visibleTests.map((test: any, testIndex: number) => {
      const details: any[] = [];

      for (const structureItem of test.structure_items || []) {
        if (structureItem.item_type === 'divider') {
          details.push({
            id: `divider-${structureItem.id}`,
            item_type: 'divider',
            texto: structureItem.texto || '',
            sort_order: structureItem.sort_order ?? null,
          });
          continue;
        }

        const param = structureItem.parameter;
        if (!param) continue;

        const entryItem = entryValues[param.id] || emptyEntryValue();
        if (isEntryValueEmpty(entryItem)) continue;

        const resultType: ResultType = param.result_type || 'numeric';
        const range =
          resultType === 'numeric'
            ? getAppliedRange(param, orderDetails.pacientes)
            : null;

        let value = '';
        let status: ResultStatus = null;
        let appliedRangeMin: number | null = null;
        let appliedRangeMax: number | null = null;

        if (resultType === 'numeric') {
          const raw = String(entryItem.value_numeric ?? '').trim();
          if (raw !== '') {
            const numericValue = Number(raw);
            if (Number.isFinite(numericValue)) {
              value = raw;
              status = classifyNumericValue(numericValue, range);
              appliedRangeMin = range?.min ?? null;
              appliedRangeMax = range?.max ?? null;
            }
          }
        } else if (resultType === 'boolean') {
          if (entryItem.value_boolean !== '') {
            const isTrue = entryItem.value_boolean === 'true';
            value = isTrue
              ? param.bool_true_label || 'Positivo'
              : param.bool_false_label || 'Negativo';
            status = isTrue ? 'positive' : 'negative';
          }
        } else {
          value = String(entryItem.value_text ?? '').trim();
          if (value) status = 'text';
        }

        const observation = param.allow_observation
          ? String(entryItem.observation ?? '').trim()
          : '';

        if (!value && !observation) continue;

        details.push({
          id: `preview-${testIndex}-${param.id}`,
          item_type: 'parameter',
          parameterId: param.id,
          parameterName: param.name || 'Resultado',
          sort_order: param.sort_order ?? null,
          value,
          appliedRangeMin,
          appliedRangeMax,
          unit: resultType === 'numeric' ? param.unit || '' : '',
          status: status || 'normal',
          observation,
          resultType,
        });
      }

      return {
        id: `preview-result-${testIndex}`,
        testId: String(test.id || ''),
        layoutKey: String(test.layoutKey || ''),
        testName: test.name || '',
        testDescription:
          test.visible_description === false ? '' : test.description || '',
        visible_description: test.visible_description ?? true,
        notes: '',
        date: resultDate || null,
        details,
        pageGroup: test.pdf_page_group || null,
      } as PdfOrderResult & { pageGroup?: string | null };
    });

    return {
      pdfConfig,
      pdfPatient,
      pdfOrder,
      orderTests,
      orderResults,
    };
  };

  const replacePdfPreviewUrl = (blob: Blob) => {
    const nextUrl = URL.createObjectURL(blob);

    if (pdfPreviewUrlRef.current) {
      URL.revokeObjectURL(pdfPreviewUrlRef.current);
    }

    pdfPreviewUrlRef.current = nextUrl;
    setPdfPreviewUrl(nextUrl);
  };

  useEffect(() => {
    if (!entryDialogOpen || !orderDetails || !pdfPreviewConfig) return;

    const timer = window.setTimeout(() => {
      try {
        setPdfPreviewLoading(true);
        setPdfPreviewError(null);

        const payload = buildLivePdfPreviewPayload();
        if (!payload) return;

        const blob = generateResultsPDF(
          payload.pdfOrder,
          payload.pdfPatient,
          payload.orderTests,
          payload.orderResults,
          payload.pdfConfig,
          { autoDownload: false }
        );

        replacePdfPreviewUrl(blob);
      } catch (error: any) {
        setPdfPreviewError(
          error?.message || 'No se pudo generar la vista previa del PDF'
        );
      } finally {
        setPdfPreviewLoading(false);
      }
    }, 400);

    return () => window.clearTimeout(timer);
  }, [
    entryDialogOpen,
    orderDetails,
    entryValues,
    resultDate,
    pdfPreviewConfig,
  ]);

  useEffect(() => {
    return () => {
      if (pdfPreviewUrlRef.current) {
        URL.revokeObjectURL(pdfPreviewUrlRef.current);
        pdfPreviewUrlRef.current = null;
      }
    };
  }, []);

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

    const rawGroupedResults = groupPdfResultsByTestName(
      orderData.resultados || [],
      getDisplayValue,
      getDisplayUnit,
      getResultType
    );

    const savedLayout: PdfLayoutConfig | null = orderData.pdf_layout || null;
    const savedTests = Array.isArray(savedLayout?.tests) ? savedLayout!.tests : [];
    const savedByKey = new Map(savedTests.map((item) => [item.key, item]));

    const resultsWithLayout = rawGroupedResults
      .filter((res: any) => savedByKey.get(res.layoutKey)?.included !== false)
      .map((res: any, originalIndex: number) => {
        const layoutTest = savedByKey.get(res.layoutKey);
        const itemOrder = new Map(
          (layoutTest?.items || []).map((item: PdfLayoutItem) => [item.id, item.order])
        );

        const details = [...(res.details || [])].sort((a: any, b: any) => {
          const ao = itemOrder.get(getPdfDetailLayoutId(a));
          const bo = itemOrder.get(getPdfDetailLayoutId(b));
          return (ao ?? Number.MAX_SAFE_INTEGER) - (bo ?? Number.MAX_SAFE_INTEGER);
        });

        return {
          ...res,
          details,
          pdfOrder: layoutTest?.order ?? originalIndex,
          pageGroup: layoutTest?.pageGroup || null,
        };
      })
      .sort((a: any, b: any) => a.pdfOrder - b.pdfOrder);

    /**
     * Un grupo de hoja se trata como un bloque indivisible:
     * - conserva la posición del primer examen del grupo;
     * - todos sus miembros quedan consecutivos;
     * - conserva el orden relativo definido por drag & drop.
     *
     * El pdfGenerator recibe pageGroup para poder intentar colocar todo el bloque
     * en una misma hoja y, si una columna no es suficiente, distribuirlo en dos.
     */
    const groupedResults: any[] = [];
    const processedPageGroups = new Set<string>();

    for (const result of resultsWithLayout) {
      const pageGroup = result?.pageGroup ? String(result.pageGroup) : null;

      if (!pageGroup) {
        groupedResults.push(result);
        continue;
      }

      if (processedPageGroups.has(pageGroup)) continue;
      processedPageGroups.add(pageGroup);

      const members = resultsWithLayout
        .filter(
          (candidate: any) => String(candidate?.pageGroup || '') === pageGroup
        )
        .sort((a: any, b: any) => Number(a.pdfOrder) - Number(b.pdfOrder));

      groupedResults.push(...members);
    }

    const orderTests = groupedResults.map((res: any) => ({
      id: res.testId,
      layoutKey: res.layoutKey,
      name: res.testName,
      description: res.testDescription || '',
      visible_description: res.visible_description ?? true,
      pageGroup: res.pageGroup || null,
    }));

    const orderResults = groupedResults.map((res: any) => ({
      id: res.id,
      testId: res.testId,
      testName: res.testName,
      testDescription: res.testDescription || '',
      visible_description: res.visible_description ?? true,
      notes: res.notes || '',
      date: res.date || null,
      details: res.details,

      // También se incluye aquí para que el generador no dependa únicamente
      // de orderTests al resolver la agrupación física de páginas.
      pageGroup: res.pageGroup || null,
    })) as Array<PdfOrderResult & { pageGroup?: string | null }>;

    return { pdfConfig, pdfPatient, pdfOrder, orderTests, orderResults };
  };


  const generateResultsPdfBlob = async (
    orderId: string,
    watermark = false
  ) => {
    const [
      { data: configData, error: configError },
      { data: orderData, error: orderError },
    ] = await Promise.all([
      supabase
        .from('configuracion_laboratorio')
        .select('*')
        .maybeSingle(),

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
              visible_description,
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
    if (!orderData.resultados?.length) {
      throw new Error('La orden no tiene resultados registrados');
    }

    const {
      pdfConfig,
      pdfPatient,
      pdfOrder,
      orderTests,
      orderResults,
    } = buildPdfPayloadFromOrderData(
      configData,
      orderData
    );

    const blob = generateResultsPDF(
      pdfOrder,
      pdfPatient,
      orderTests,
      orderResults,
      pdfConfig,
      {
        autoDownload: false,
        watermark,
      }
    );

    return {
      blob,
      orderData,
    };
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
                visible_description,
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
        const groupedTestKey = buildGroupedTestKey(
          test.name,
          test.description,
          test.visible_description
        );

        const matchingExistingResults = (existingOrderResults || []).filter((r: any) => {
          const existingKey = buildGroupedTestKey(
          r?.pruebas?.name,
          r?.pruebas?.description,
          r?.pruebas?.visible_description
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

            if (isEntryValueEmpty(entryItem)) {
              return null;
            }

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
              const rawNumeric = String(entryItem.value_numeric ?? '').trim();

              if (rawNumeric !== '') {
                value_numeric = Number(rawNumeric);

                if (Number.isFinite(value_numeric)) {
                  status = classifyNumericValue(value_numeric, range);
                  applied_range_min = range?.min ?? null;
                  applied_range_max = range?.max ?? null;
                } else {
                  value_numeric = null;
                }
              }
            }

            if (resultType === 'boolean') {
              if (entryItem.value_boolean !== '') {
                value_boolean = entryItem.value_boolean === 'true';
                status = value_boolean ? 'positive' : 'negative';
              }
            }

            if (resultType === 'text') {
              const trimmedText = String(entryItem.value_text ?? '').trim();
              if (trimmedText) {
                value_text = trimmedText;
                status = 'text';
              }
            }

            const trimmedObservation = param.allow_observation
              ? String(entryItem.observation ?? '').trim()
              : '';

            return {
              result_id: resultId,
              parameter_id: param.id,
              value_numeric,
              value_boolean,
              value_text,
              observation: trimmedObservation || null,
              status,
              applied_range_min,
              applied_range_max,
            };
          })
          .filter(Boolean);

        if (detailsToInsert.length > 0) {
          const { error: detError } = await supabase
            .from('resultado_detalle')
            .insert(detailsToInsert);

          if (detError) throw detError;
        }
      }

      const pdfLayout = buildPdfLayoutFromTests(orderDetails.tests || []);

      const { error: updateOrderError } = await supabase
        .from('ordenes')
        .update({
          status: 'completed',
          pdf_layout: pdfLayout,
        })
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
      const isPaid = paid >= total && total > 0;

      if (!isPaid) {
        toast.info(
          `La orden mantiene un saldo pendiente de $${saldo.toFixed(
            2
          )}. Se descargará una copia con marca de agua.`
        );

        const { blob, orderData: fullOrderData } =
          await generateResultsPdfBlob(
            orderId,
            true
          );

        downloadBlob(
          blob,
          `resultados_${
            fullOrderData.code ||
            orderData.code ||
            'resultados'
          }_marca_agua.pdf`
        );

        toast.success(
          'PDF con marca de agua descargado correctamente'
        );
        return;
      }

      let pdfUrl =
        orderData.resultados?.find(
          (r: any) => !!r.resultados_url
        )?.resultados_url || null;

      if (!pdfUrl) {
        toast.info(
          'No existía PDF almacenado. Se generará y guardará ahora...'
        );

        pdfUrl =
          await generateAndUploadResultsPdf(
            orderId
          );
      }

      await downloadPdfFromUrl(
        pdfUrl,
        orderData.code || 'resultados'
      );

      toast.success('PDF descargado correctamente');
    } catch (error: any) {
      toast.error(
        'No se pudo obtener el PDF: ' +
          (error?.message || 'desconocido')
      );
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
                            className={
                              paid
                                ? 'text-blue-600'
                                : 'text-amber-600'
                            }
                            onClick={() =>
                              handleDownloadResultPdf(order.id)
                            }
                            disabled={
                              downloadingOrderId === order.id
                            }
                            title={
                              paid
                                ? 'Descargar PDF'
                                : `Descargar con marca de agua. Saldo pendiente: $${saldo.toFixed(
                                    2
                                  )}`
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
        <DialogContent className="flex h-[96vh] w-[98vw] max-w-[1800px] flex-col overflow-hidden p-0">
          <DialogHeader className="shrink-0 border-b bg-white px-6 pb-4 pt-6">
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

          <div className="grid min-h-0 flex-1 grid-cols-1 gap-0 xl:grid-cols-[minmax(0,1.12fr)_minmax(520px,0.88fr)]">
            <div className="min-h-0 overflow-y-auto px-6 py-5">
          <div className="space-y-6">
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

            <div className="rounded-xl border border-blue-100 bg-blue-50/50 p-4">
              <div className="flex items-start gap-3">
                <FileStack className="mt-0.5 h-5 w-5 text-blue-600" />
                <div>
                  <p className="font-semibold text-slate-800">Diseño del PDF</p>
                  <p className="mt-1 text-xs leading-5 text-slate-600">
                    Define la ubicación indicando si una prueba debe ir arriba o debajo de otra prueba.
                    Los parámetros se ordenan de la misma forma, pero únicamente respecto de otros
                    parámetros de la misma prueba. Si existen varias pruebas con el mismo nombre, se
                    consolidan automáticamente en una sola prueba y sus parámetros se muestran juntos.
                    Para hacer que varias pruebas salgan en una sola hoja, asígnales el mismo grupo de hoja.
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-5">
              {(orderDetails?.tests || []).map((test: any, testIndex: number) => {
                const testMove =
                  testMoveSelections[test.layoutKey] || {
                    position: 'after' as RelativePosition,
                    targetKey: '',
                  };

                const testTargets = (orderDetails?.tests || []).filter(
                  (candidate: any) =>
                    String(candidate.layoutKey) !== String(test.layoutKey)
                );


                return (
                  <div
                    key={test.layoutKey}
                    className={`overflow-hidden rounded-xl border bg-white shadow-sm transition ${
                      test.pdf_included === false ? 'opacity-70' : ''
                    }`}
                  >
                    <div className="flex flex-col gap-4 border-b bg-slate-50/80 p-4">
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant="outline">#{testIndex + 1}</Badge>
                            <h3 className="font-display text-lg font-bold text-slate-800">
                              {test.name}
                            </h3>

                            {Array.isArray(test.test_ids) && test.test_ids.length > 1 && (
                              <Badge className="border-0 bg-blue-100 text-blue-700 hover:bg-blue-100">
                                {test.test_ids.length} pruebas consolidadas
                              </Badge>
                            )}
                          </div>

                          {test.visible_description && test.description?.trim() && (
                            <p className="mt-1 text-sm text-slate-600">
                              {test.description}
                            </p>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center gap-3">
                          <label className="flex cursor-pointer items-center gap-2 rounded-lg border bg-white px-3 py-2 text-xs font-semibold text-slate-700">
                            <input
                              type="checkbox"
                              checked={test.pdf_included !== false}
                              onChange={(e) =>
                                updateTestPdfOption(test.layoutKey, {
                                  pdf_included: e.target.checked,
                                })
                              }
                              className="h-4 w-4"
                            />
                            Incluir en PDF
                          </label>

                          <div className="min-w-[190px]">
                            <Select
                              value={test.pdf_page_group || 'none'}
                              onValueChange={(value) =>
                                updateTestPageGroup(
                                  test.layoutKey,
                                  value === 'none' ? null : value
                                )
                              }
                              disabled={test.pdf_included === false}
                            >
                              <SelectTrigger className="bg-white">
                                <Layers3 className="mr-2 h-4 w-4 text-slate-500" />
                                <SelectValue placeholder="Grupo de hoja" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">
                                  Sin grupo de hoja
                                </SelectItem>
                                {PDF_PAGE_GROUPS.map((group) => (
                                  <SelectItem key={group} value={group}>
                                    Misma hoja · Grupo {group}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      </div>

                      {testTargets.length > 0 && (
                        <div className="rounded-lg border border-slate-200 bg-white p-3">
                          <div className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">
                            Ubicación de la prueba
                          </div>

                          <div className="grid grid-cols-1 gap-2 md:grid-cols-[150px_minmax(0,1fr)_110px]">
                            <Select
                              value={testMove.position}
                              onValueChange={(value) =>
                                setTestMoveSelections((prev) => ({
                                  ...prev,
                                  [test.layoutKey]: {
                                    ...testMove,
                                    position: value as RelativePosition,
                                  },
                                }))
                              }
                            >
                              <SelectTrigger className="bg-white">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="before">Arriba de</SelectItem>
                                <SelectItem value="after">Debajo de</SelectItem>
                              </SelectContent>
                            </Select>

                            <Select
                              value={testMove.targetKey || undefined}
                              onValueChange={(value) =>
                                setTestMoveSelections((prev) => ({
                                  ...prev,
                                  [test.layoutKey]: {
                                    ...testMove,
                                    targetKey: value,
                                  },
                                }))
                              }
                            >
                              <SelectTrigger className="bg-white">
                                <SelectValue placeholder="Seleccione otra prueba" />
                              </SelectTrigger>
                              <SelectContent>
                                {testTargets.map((candidate: any) => (
                                  <SelectItem
                                    key={candidate.layoutKey}
                                    value={String(candidate.layoutKey)}
                                  >
                                    {candidate.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>

                            <Button
                              type="button"
                              variant="outline"
                              disabled={!testMove.targetKey}
                              onClick={() => {
                                moveTestRelative(
                                  test.layoutKey,
                                  testMove.targetKey,
                                  testMove.position
                                );

                                setTestMoveSelections((prev) => ({
                                  ...prev,
                                  [test.layoutKey]: {
                                    position: testMove.position,
                                    targetKey: '',
                                  },
                                }));
                              }}
                            >
                              Ubicar
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>

                    <DndContext
                      sensors={sensors}
                      collisionDetection={closestCenter}
                      onDragEnd={(event) =>
                        handleParameterDragEnd(test.layoutKey, event)
                      }
                    >
                      <SortableContext
                        items={(test.structure_items || []).map(
                          (item: any) =>
                            `item:${getStructureItemLayoutId(item)}`
                        )}
                        strategy={verticalListSortingStrategy}
                      >
                        <div className="space-y-3 p-4">
                          {(test.structure_items || []).map((structureItem: any) => {
                            const sortableId = `item:${getStructureItemLayoutId(
                              structureItem
                            )}`;
                        if (structureItem.item_type === 'divider') {
                          return (
                            <SortableShell
                              key={`divider:${test.layoutKey}:${getStructureItemLayoutId(
                                structureItem
                              )}`}
                              id={sortableId}
                            >
                              {(handleProps, dragging) => (
                                <div
                                  className={`flex items-center gap-3 rounded-lg border border-primary/20 bg-primary/5 px-3 py-3 ${
                                    dragging ? 'shadow-lg ring-2 ring-primary/20' : ''
                                  }`}
                                >
                                  <button
                                    type="button"
                                    {...handleProps}
                                    className="cursor-grab touch-none rounded-md p-1 text-slate-400 hover:bg-white hover:text-primary active:cursor-grabbing"
                                    title="Arrastrar divisor"
                                  >
                                    <GripVertical className="h-5 w-5" />
                                  </button>
                                  <p className="font-display text-base font-bold text-slate-800 underline decoration-primary/30 underline-offset-4">
                                    {structureItem.texto}
                                  </p>
                                </div>
                              )}
                            </SortableShell>
                          );
                        }

                        const param = structureItem.parameter;
                        const item =
                          entryValues[param.id] || emptyEntryValue();
                        const range = getAppliedRange(
                          param,
                          orderDetails.pacientes
                        );
                        const status = getStatusPreview(param);
                        const resultType: ResultType =
                          param.result_type || 'numeric';

                        return (
                          <SortableShell
                            key={`parameter:${test.layoutKey}:${param.id}`}
                            id={sortableId}
                          >
                            {(handleProps, dragging) => (
                              <div
                                className={`rounded-lg border border-slate-100 bg-slate-50/50 p-3 ${
                                  dragging ? 'shadow-lg ring-2 ring-primary/20' : ''
                                }`}
                              >
                                <div className="mb-2 flex items-center gap-2">
                                  <button
                                    type="button"
                                    {...handleProps}
                                    className="cursor-grab touch-none rounded-md p-1 text-slate-400 hover:bg-white hover:text-primary active:cursor-grabbing"
                                    title="Arrastrar parámetro"
                                  >
                                    <GripVertical className="h-5 w-5" />
                                  </button>
                                  <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                                    Arrastra para ordenar
                                  </span>
                                </div>

                                <div className="grid grid-cols-12 items-start gap-4">
                              <div className="col-span-12 md:col-span-4">
                                <Label className="text-sm font-bold text-slate-700">
                                  {param.name}
                                </Label>

                                <div className="mt-1 flex flex-wrap gap-2 font-mono text-[10px] text-slate-500">
                                  <span>Tipo: {resultType}</span>

                                  {resultType === 'numeric' && (
                                    <span>Unidad: {param.unit || '—'}</span>
                                  )}

                                  {resultType === 'numeric' && range && (
                                    <span>
                                      Ref: [{range.min} - {range.max}]
                                    </span>
                                  )}
                                </div>
                              </div>

                              <div className="col-span-12 md:col-span-5">
                                {resultType === 'numeric' && (
                                  <Input
                                    type="number"
                                    step="any"
                                    className="border-slate-200 bg-white"
                                    placeholder="0.00"
                                    value={item.value_numeric}
                                    onChange={(e) =>
                                      updateEntryValue(
                                        param.id,
                                        'value_numeric',
                                        e.target.value
                                      )
                                    }
                                  />
                                )}

                                {resultType === 'boolean' && (
                                  <Select
                                    value={item.value_boolean}
                                    onValueChange={(value) =>
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
                                      className="min-h-[90px] border-slate-200 bg-white"
                                      placeholder={
                                        param.valor_default
                                          ? 'Valor precargado editable...'
                                          : 'Ingrese el resultado...'
                                      }
                                      value={item.value_text}
                                      onChange={(e) =>
                                        updateEntryValue(
                                          param.id,
                                          'value_text',
                                          e.target.value
                                        )
                                      }
                                    />

                                    {param.valor_default && (
                                      <p className="mt-1 text-[11px] text-slate-500">
                                        Valor por defecto:{' '}
                                        <span className="font-medium">
                                          {param.valor_default}
                                        </span>
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
                                      className="mt-1 min-h-[70px] border-slate-200 bg-white"
                                      placeholder="Observación opcional..."
                                      value={item.observation}
                                      onChange={(e) =>
                                        updateEntryValue(
                                          param.id,
                                          'observation',
                                          e.target.value
                                        )
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
                                    } border-0 text-white shadow-sm`}
                                  >
                                    {status === 'normal' && 'NORMAL'}
                                    {status === 'high' && 'ALTO ↑'}
                                    {status === 'low' && 'BAJO ↓'}
                                    {status === 'positive' &&
                                      (param.bool_true_label || 'POSITIVO')}
                                    {status === 'negative' &&
                                      (param.bool_false_label || 'NEGATIVO')}
                                    {status === 'text' && 'TEXTO'}
                                  </Badge>
                                )}
                              </div>
                            </div>

                              </div>
                            )}
                          </SortableShell>
                        );
                      })}
                        </div>
                      </SortableContext>
                    </DndContext>
                  </div>
                );
              })}
            </div>

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
            </div>

            <aside className="min-h-[680px] border-t bg-slate-100 xl:min-h-0 xl:border-l xl:border-t-0">
              <div className="flex h-full min-h-[680px] flex-col xl:min-h-0">
                <div className="flex shrink-0 items-center justify-between border-b bg-white px-4 py-3">
                  <div>
                    <p className="font-semibold text-slate-800">
                      Vista previa del PDF
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Se actualiza automáticamente antes de guardar
                    </p>
                  </div>

                  {pdfPreviewLoading && (
                    <div className="flex items-center gap-2 text-xs font-medium text-primary">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Actualizando
                    </div>
                  )}
                </div>

                <div className="relative min-h-0 flex-1 p-3">
                  {pdfPreviewError ? (
                    <div className="flex h-full min-h-[620px] items-center justify-center rounded-lg border border-rose-200 bg-white p-6 text-center xl:min-h-0">
                      <div>
                        <p className="font-semibold text-rose-600">
                          No se pudo generar la vista previa
                        </p>
                        <p className="mt-2 text-sm text-slate-500">
                          {pdfPreviewError}
                        </p>
                      </div>
                    </div>
                  ) : pdfPreviewUrl ? (
                    <iframe
                      key={pdfPreviewUrl}
                      src={`${pdfPreviewUrl}#toolbar=1&navpanes=0&scrollbar=1&view=FitH`}
                      title="Vista previa del PDF de resultados"
                      className="h-full min-h-[620px] w-full rounded-lg border bg-white shadow-sm xl:min-h-0"
                    />
                  ) : (
                    <div className="flex h-full min-h-[620px] items-center justify-center rounded-lg border bg-white text-sm text-muted-foreground xl:min-h-0">
                      <div className="flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Generando vista previa...
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </aside>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}