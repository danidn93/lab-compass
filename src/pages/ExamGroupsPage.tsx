import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { sendDocumentEmail } from '@/lib/sendDocumentEmail';
import QRCode from 'qrcode';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import {
  Loader2,
  Plus,
  Pencil,
  Trash2,
  Search,
  X,
  Receipt,
  UserPlus,
  Stethoscope,
  FilePlus,
} from 'lucide-react';
import { toast } from 'sonner';

function safeNumber(value: any, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function round2(value: number): number {
  return Number(value.toFixed(2));
}

function obtenerCodigoPorcentajeIva(porcentaje: number): string {
  const p = Number(porcentaje);

  if (p === 0) return '0';
  if (p === 12) return '2';
  if (p === 14) return '3';
  if (p === 15) return '4';
  if (p === 5) return '5';
  if (p === 13) return '10';

  throw new Error(`Tarifa IVA no soportada: ${p}%`);
}

function getEcuadorDateTimeForDB() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Guayaquil',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(new Date());

  const get = (type: string) => parts.find((p) => p.type === type)?.value || '00';

  return `${get('year')}-${get('month')}-${get('day')} ${get('hour')}:${get('minute')}:${get('second')}`;
}

type BillingMode = 'PACIENTE' | 'CONSUMIDOR_FINAL' | 'OTRO';
type BillingIdType = 'CEDULA' | 'RUC' | 'PASAPORTE' | 'CONSUMIDOR_FINAL';

type LabConfig = {
  id?: string;
  logo?: string | null;
  name?: string | null;
  owner?: string | null;
  address?: string | null;
  ruc?: string | null;
  health_registry?: string | null;
  phone?: string | null;
  schedule?: string | null;
  legal_name?: string | null;
  email?: string | null;
};

type TestDiscountMap = Record<string, string>;

type BillingFormType = {
  tipo_identificacion: BillingIdType;
  identificacion: string;
  nombres: string;
  direccion: string;
  telefono: string;
  email: string;
};

type PaymentFormType = {
  amount: string;
  payment_method: string;
  reference: string;
  notes: string;
};

type DoctorForm = {
  nombre: string;
  especialidad: string;
  telefono: string;
  email: string;
  activo: boolean;
};

const initialDoctorForm: DoctorForm = {
  nombre: '',
  especialidad: '',
  telefono: '',
  email: '',
  activo: true,
};

const CONSUMIDOR_FINAL_DATA: BillingFormType = {
  tipo_identificacion: 'CONSUMIDOR_FINAL',
  identificacion: '9999999999999',
  nombres: 'CONSUMIDOR FINAL',
  direccion: 'S/N',
  telefono: '9999999999',
  email: '',
};

function normalizeBillingIdType(value: any): BillingIdType {
  if (
    value === 'CEDULA' ||
    value === 'RUC' ||
    value === 'PASAPORTE' ||
    value === 'CONSUMIDOR_FINAL'
  ) {
    return value;
  }
  return 'CEDULA';
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
  description: any,
  visibleDescription: boolean | null | undefined
) {
  return `${normalizeExamName(name)}|||${normalizeExamDescription(
    description,
    visibleDescription
  )}`;
}

function getSortedParameterNamesFromTest(test: any) {
  return [...(test?.parametros_prueba || [])]
    .map((p: any) => String(p?.name || '').trim())
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }));
}

function buildVariantLabelFromTest(test: any, showParameters: boolean) {
  const visibleDescription = test?.visible_description ?? true;
  const description = visibleDescription ? String(test?.description || '').trim() : '';
  const parameterNames = getSortedParameterNamesFromTest(test);

  if (showParameters && parameterNames.length > 0) return parameterNames.join(', ');
  if (description) return description;

  return '';
}

function groupOrderDetailsForTicket(detalles: any[] = []) {
  const groupedMap: Record<string, any> = {};

  for (const detalle of detalles) {
    const prueba = detalle?.pruebas || {};
    const visibleDescription = prueba?.visible_description ?? true;

    const key = buildGroupedTestKey(
      prueba?.name,
      prueba?.description,
      visibleDescription
    );

    if (!groupedMap[key]) {
      groupedMap[key] = {
        name: String(prueba?.name || 'Prueba'),
        description: visibleDescription ? String(prueba?.description || '') : '',
        visible_description: visibleDescription,
        items: [],
      };
    }

    groupedMap[key].items.push(detalle);
  }

  return Object.values(groupedMap)
    .map((group: any) => {
      const isGrouped = group.items.length > 1;

      const items = [...group.items].sort((a: any, b: any) => {
        const aLabel = buildVariantLabelFromTest(a?.pruebas || {}, isGrouped);
        const bLabel = buildVariantLabelFromTest(b?.pruebas || {}, isGrouped);

        return aLabel.localeCompare(bLabel, 'es', { sensitivity: 'base' });
      });

      return { ...group, items };
    })
    .sort((a: any, b: any) => {
      const byName = String(a.name || '').localeCompare(String(b.name || ''), 'es', {
        sensitivity: 'base',
      });

      if (byName !== 0) return byName;

      return String(a.description || '').localeCompare(
        String(b.description || ''),
        'es',
        { sensitivity: 'base' }
      );
    });
}

export default function ExamGroupsPage() {
  const [groups, setGroups] = useState<any[]>([]);
  const [tests, setTests] = useState<any[]>([]);
  const [patients, setPatients] = useState<any[]>([]);
  const [doctors, setDoctors] = useState<any[]>([]);
  const [labConfig, setLabConfig] = useState<LabConfig | null>(null);

  const [loading, setLoading] = useState(true);
  const [savingGroup, setSavingGroup] = useState(false);
  const [creatingOrder, setCreatingOrder] = useState(false);
  const [creatingPatient, setCreatingPatient] = useState(false);
  const [savingDoctor, setSavingDoctor] = useState(false);
  const [billingLookupLoading, setBillingLookupLoading] = useState(false);

  const [search, setSearch] = useState('');
  const [testSearch, setTestSearch] = useState('');
  const [patientSearch, setPatientSearch] = useState('');

  const [groupDialogOpen, setGroupDialogOpen] = useState(false);
  const [orderDialogOpen, setOrderDialogOpen] = useState(false);
  const [patientDialogOpen, setPatientDialogOpen] = useState(false);
  const [doctorDialogOpen, setDoctorDialogOpen] = useState(false);

  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [groupName, setGroupName] = useState('');
  const [groupDescription, setGroupDescription] = useState('');
  const [groupTestIds, setGroupTestIds] = useState<string[]>([]);

  const [currentGroup, setCurrentGroup] = useState<any>(null);

  const [selectedPatient, setSelectedPatient] = useState('');
  const [selectedDoctor, setSelectedDoctor] = useState('');
  const [selectedTests, setSelectedTests] = useState<string[]>([]);

  const [testDiscounts, setTestDiscounts] = useState<TestDiscountMap>({});
  const [globalDiscount, setGlobalDiscount] = useState('');

  const [billingMode, setBillingMode] = useState<BillingMode>('PACIENTE');
  const [billingCustomerId, setBillingCustomerId] = useState<string | null>(null);
  const [billingFoundMessage, setBillingFoundMessage] = useState('');

  const [billingForm, setBillingForm] = useState<BillingFormType>({
    tipo_identificacion: 'CEDULA',
    identificacion: '',
    nombres: '',
    direccion: '',
    telefono: '',
    email: '',
  });

  const [patientForm, setPatientForm] = useState({
    name: '',
    cedula: '',
    phone: '',
    email: '',
    birth_date: '',
    sex: 'M' as 'M' | 'F',
    direccion: '',
  });

  const [doctorForm, setDoctorForm] = useState<DoctorForm>(initialDoctorForm);

  const [initialPaymentForm, setInitialPaymentForm] = useState<PaymentFormType>({
    amount: '',
    payment_method: 'EFECTIVO',
    reference: '',
    notes: '',
  });

  const fetchData = async () => {
    try {
      setLoading(true);

      const [g, t, p, d, c] = await Promise.all([
        supabase
          .from('grupos_examenes')
          .select(`
            *,
            detalles:grupos_examenes_detalle(
              id,
              test_id,
              sort_order,
              pruebas(
                *,
                parametros_prueba(
                  id,
                  name,
                  unit,
                  result_type,
                  sort_order
                )
              )
            )
          `)
          .order('created_at', { ascending: false }),

        supabase
          .from('pruebas')
          .select(`
            *,
            prueba_reactivos(*),
            parametros_prueba(
              id,
              name,
              unit,
              result_type,
              sort_order
            )
          `)
          .order('name'),

        supabase.from('pacientes').select('*').order('name'),

        supabase
          .from('doctores')
          .select('*')
          .eq('activo', true)
          .order('nombre'),

        supabase
          .from('configuracion_laboratorio')
          .select(`
            id,
            logo,
            name,
            owner,
            address,
            ruc,
            health_registry,
            phone,
            schedule,
            legal_name,
            email
          `)
          .maybeSingle(),
      ]);

      if (g.error) throw g.error;
      if (t.error) throw t.error;
      if (p.error) throw p.error;
      if (d.error) throw d.error;
      if (c.error) throw c.error;

      setGroups(g.data || []);
      setTests(t.data || []);
      setPatients(p.data || []);
      setDoctors(d.data || []);
      setLabConfig(c.data || null);
    } catch (error: any) {
      toast.error('Error al cargar datos: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchDoctors = async () => {
    const { data, error } = await supabase
      .from('doctores')
      .select('*')
      .eq('activo', true)
      .order('nombre');

    if (error) throw error;

    setDoctors(data || []);
    return data || [];
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (billingMode === 'CONSUMIDOR_FINAL') {
      setBillingCustomerId(null);
      setBillingFoundMessage('');
      setBillingForm(CONSUMIDOR_FINAL_DATA);
      return;
    }

    if (billingMode === 'PACIENTE') {
      const p = patients.find((x) => x.id === selectedPatient);
      setBillingCustomerId(null);
      setBillingFoundMessage('');

      if (p) {
        setBillingForm({
          tipo_identificacion: 'CEDULA',
          identificacion: String(p.cedula || '').trim(),
          nombres: String(p.name || '').trim(),
          direccion: String(p.direccion || '').trim(),
          telefono: String(p.phone || '').trim(),
          email: String(p.email || '').trim(),
        });
      } else {
        setBillingForm({
          tipo_identificacion: 'CEDULA',
          identificacion: '',
          nombres: '',
          direccion: '',
          telefono: '',
          email: '',
        });
      }
    }
  }, [billingMode, selectedPatient, patients]);

  const selectedPatientData = useMemo(() => {
    return patients.find((p) => p.id === selectedPatient) || null;
  }, [patients, selectedPatient]);

  const filteredGroups = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return groups;

    return groups.filter((g) => {
      const nombre = String(g.nombre || '').toLowerCase();
      const descripcion = String(g.descripcion || '').toLowerCase();

      const matchTest = (g.detalles || []).some((d: any) =>
        String(d?.pruebas?.name || '').toLowerCase().includes(q)
      );

      return nombre.includes(q) || descripcion.includes(q) || matchTest;
    });
  }, [groups, search]);

  const filteredTestsForGroup = useMemo(() => {
    const q = testSearch.trim().toLowerCase();
    if (!q) return tests;

    return tests.filter((t) => {
      const name = String(t.name || '').toLowerCase();
      const description = String(t.description || '').toLowerCase();

      const params = Array.isArray(t.parametros_prueba)
        ? t.parametros_prueba.some((p: any) =>
            String(p?.name || '').toLowerCase().includes(q)
          )
        : false;

      return name.includes(q) || description.includes(q) || params;
    });
  }, [tests, testSearch]);

  const filteredPatients = useMemo(() => {
    const q = patientSearch.trim().toLowerCase();
    if (!q) return [];

    return patients.filter((p) => {
      const name = String(p.name || '').toLowerCase();
      const cedula = String(p.cedula || '').toLowerCase();
      const email = String(p.email || '').toLowerCase();

      return name.includes(q) || cedula.includes(q) || email.includes(q);
    });
  }, [patients, patientSearch]);

  const getTestDiscount = (testId: string) => {
    return round2(Math.max(safeNumber(testDiscounts[testId], 0), 0));
  };

  const getBaseSubtotalOfSelectedTests = () => {
    return round2(
      selectedTests.reduce((acc, testId) => {
        const test = tests.find((t) => t.id === testId);
        return acc + safeNumber(test?.price, 0);
      }, 0)
    );
  };

  const getTotalItemDiscount = () => {
    return round2(
      selectedTests.reduce((acc, testId) => {
        return acc + getTestDiscount(testId);
      }, 0)
    );
  };

  const getSafeGlobalDiscount = () => {
    return round2(Math.max(safeNumber(globalDiscount, 0), 0));
  };

  const selectedTestsSummary = useMemo(() => {
    const baseSubtotal = getBaseSubtotalOfSelectedTests();
    const totalItemDiscount = getTotalItemDiscount();
    const safeGlobalDiscount = getSafeGlobalDiscount();

    const maxGlobalDiscount = Math.max(baseSubtotal - totalItemDiscount, 0);
    const appliedGlobalDiscount = round2(Math.min(safeGlobalDiscount, maxGlobalDiscount));

    return selectedTests
      .map((tid) => {
        const test = tests.find((t) => t.id === tid);
        if (!test) return null;

        const precio = round2(safeNumber(test.price));
        const porcentajeIva = round2(safeNumber(test.porcentaje_iva, 0));
        const descuentoItem = round2(Math.min(getTestDiscount(tid), precio));
        const subtotalDespuesDescuentoItem = round2(Math.max(precio - descuentoItem, 0));

        const proporcionGlobal =
          maxGlobalDiscount > 0 ? subtotalDespuesDescuentoItem / maxGlobalDiscount : 0;

        const descuentoGlobalAsignado = round2(appliedGlobalDiscount * proporcionGlobal);

        const subtotalSinImpuesto = round2(
          Math.max(subtotalDespuesDescuentoItem - descuentoGlobalAsignado, 0)
        );

        const descuentoTotal = round2(descuentoItem + descuentoGlobalAsignado);
        const valorIva = round2(subtotalSinImpuesto * (porcentajeIva / 100));
        const totalLinea = round2(subtotalSinImpuesto + valorIva);

        return {
          ...test,
          subtotalOriginal: precio,
          descuentoItem,
          descuentoGlobalAsignado,
          descuentoTotal,
          subtotal: subtotalSinImpuesto,
          valorIva,
          totalLinea,
        };
      })
      .filter(Boolean) as any[];
  }, [selectedTests, tests, testDiscounts, globalDiscount]);

  const resumenTotales = useMemo(() => {
    const subtotalOriginal = round2(
      selectedTestsSummary.reduce((acc, t) => acc + safeNumber(t.subtotalOriginal, 0), 0)
    );

    const descuento = round2(
      selectedTestsSummary.reduce((acc, t) => acc + safeNumber(t.descuentoTotal, 0), 0)
    );

    const subtotal = round2(
      selectedTestsSummary.reduce((acc, t) => acc + safeNumber(t.subtotal, 0), 0)
    );

    const iva = round2(
      selectedTestsSummary.reduce((acc, t) => acc + safeNumber(t.valorIva, 0), 0)
    );

    const total = round2(subtotal + iva);

    return { subtotalOriginal, descuento, subtotal, iva, total };
  }, [selectedTestsSummary]);

  const resetBillingSection = () => {
    setBillingMode('PACIENTE');
    setBillingCustomerId(null);
    setBillingFoundMessage('');
    setBillingForm({
      tipo_identificacion: 'CEDULA',
      identificacion: '',
      nombres: '',
      direccion: '',
      telefono: '',
      email: '',
    });
  };

  const resetGroupForm = () => {
    setEditingGroupId(null);
    setGroupName('');
    setGroupDescription('');
    setGroupTestIds([]);
    setTestSearch('');
  };

  const resetOrderForm = () => {
    setCurrentGroup(null);
    setSelectedPatient('');
    setSelectedDoctor('');
    setSelectedTests([]);
    setPatientSearch('');
    setTestSearch('');
    setTestDiscounts({});
    setGlobalDiscount('');
    resetBillingSection();
    setInitialPaymentForm({
      amount: '',
      payment_method: 'EFECTIVO',
      reference: '',
      notes: '',
    });
  };

  const openCreateGroup = () => {
    resetGroupForm();
    setGroupDialogOpen(true);
  };

  const openEditGroup = (group: any) => {
    setEditingGroupId(group.id);
    setGroupName(group.nombre || '');
    setGroupDescription(group.descripcion || '');

    const ids = [...(group.detalles || [])]
      .sort((a: any, b: any) => safeNumber(a.sort_order, 0) - safeNumber(b.sort_order, 0))
      .map((d: any) => d.test_id)
      .filter(Boolean);

    setGroupTestIds(Array.from(new Set(ids)));
    setGroupDialogOpen(true);
  };

  const toggleGroupTest = (testId: string) => {
    setGroupTestIds((prev) =>
      prev.includes(testId)
        ? prev.filter((id) => id !== testId)
        : [...prev, testId]
    );
  };

  const toggleOrderTest = (testId: string) => {
    setSelectedTests((prev) =>
      prev.includes(testId)
        ? prev.filter((id) => id !== testId)
        : [...prev, testId]
    );
  };

  const handleSaveGroup = async () => {
    if (savingGroup) return;

    if (!groupName.trim()) {
      toast.error('El nombre del grupo es obligatorio');
      return;
    }

    if (groupTestIds.length === 0) {
      toast.error('Selecciona al menos una prueba para el grupo');
      return;
    }

    try {
      setSavingGroup(true);

      const { data: groupData, error: groupError } = await supabase
        .from('grupos_examenes')
        .upsert({
          id: editingGroupId || undefined,
          nombre: groupName.trim(),
          descripcion: groupDescription.trim() || null,
          activo: true,
        })
        .select()
        .single();

      if (groupError) throw groupError;

      const groupId = groupData.id;

      const { error: deleteError } = await supabase
        .from('grupos_examenes_detalle')
        .delete()
        .eq('grupo_id', groupId);

      if (deleteError) throw deleteError;

      const detalles = groupTestIds.map((testId, index) => ({
        grupo_id: groupId,
        test_id: testId,
        sort_order: index,
      }));

      const { error: insertError } = await supabase
        .from('grupos_examenes_detalle')
        .insert(detalles);

      if (insertError) throw insertError;

      toast.success(editingGroupId ? 'Grupo actualizado' : 'Grupo creado');
      setGroupDialogOpen(false);
      resetGroupForm();
      fetchData();
    } catch (error: any) {
      toast.error('Error al guardar grupo: ' + error.message);
    } finally {
      setSavingGroup(false);
    }
  };

  const handleDeleteGroup = async (groupId: string) => {
    if (!confirm('¿Seguro que deseas eliminar este grupo?')) return;

    const { error } = await supabase
      .from('grupos_examenes')
      .delete()
      .eq('id', groupId);

    if (error) {
      toast.error('Error al eliminar grupo: ' + error.message);
      return;
    }

    toast.success('Grupo eliminado');
    fetchData();
  };

  const openCreateOrderFromGroup = (group: any) => {
    resetOrderForm();

    const ids = [...(group.detalles || [])]
      .sort((a: any, b: any) => safeNumber(a.sort_order, 0) - safeNumber(b.sort_order, 0))
      .map((d: any) => d.test_id)
      .filter(Boolean);

    setCurrentGroup(group);
    setSelectedTests(Array.from(new Set(ids)));
    setOrderDialogOpen(true);
  };

  const generateAccessKey = () =>
    Math.random().toString(36).substring(2, 8).toUpperCase();

  const generateOrderCode = () => `ORD-${Date.now().toString().slice(-6)}`;

  const validarFacturacion = (): { ok: boolean; data?: BillingFormType; message?: string } => {
    if (billingMode === 'PACIENTE') {
      if (!selectedPatientData) {
        return { ok: false, message: 'Debe seleccionar un paciente' };
      }

      const data: BillingFormType = {
        tipo_identificacion: 'CEDULA',
        identificacion: String(selectedPatientData.cedula || '').trim(),
        nombres: String(selectedPatientData.name || '').trim(),
        direccion: String(selectedPatientData.direccion || '').trim(),
        telefono: String(selectedPatientData.phone || '').trim(),
        email: String(selectedPatientData.email || '').trim(),
      };

      if (!data.identificacion) return { ok: false, message: 'El paciente no tiene cédula registrada' };
      if (!data.nombres) return { ok: false, message: 'El paciente no tiene nombre válido' };
      if (!data.direccion) return { ok: false, message: 'El paciente no tiene dirección registrada' };
      if (!data.telefono) return { ok: false, message: 'El paciente no tiene teléfono registrado' };

      return { ok: true, data };
    }

    if (billingMode === 'CONSUMIDOR_FINAL') {
      return { ok: true, data: CONSUMIDOR_FINAL_DATA };
    }

    const data: BillingFormType = {
      tipo_identificacion: billingForm.tipo_identificacion,
      identificacion: billingForm.identificacion.trim(),
      nombres: billingForm.nombres.trim(),
      direccion: billingForm.direccion.trim(),
      telefono: billingForm.telefono.trim(),
      email: billingForm.email.trim(),
    };

    if (!data.tipo_identificacion) return { ok: false, message: 'Debe seleccionar el tipo de identificación' };
    if (!data.identificacion) return { ok: false, message: 'Debe ingresar la identificación del cliente' };
    if (!data.nombres) return { ok: false, message: 'Debe ingresar los nombres del cliente' };
    if (!data.direccion) return { ok: false, message: 'Debe ingresar la dirección del cliente' };
    if (!data.telefono) return { ok: false, message: 'Debe ingresar el teléfono del cliente' };

    return { ok: true, data };
  };

  const upsertBillingCustomer = async (billingData: BillingFormType) => {
    const payload = {
      tipo_identificacion: billingData.tipo_identificacion,
      identificacion: billingData.identificacion.trim(),
      nombres: billingData.nombres.trim(),
      direccion: billingData.direccion.trim(),
      telefono: billingData.telefono.trim(),
      email: billingData.email.trim() || null,
      updated_at: new Date().toISOString(),
    };

    if (payload.tipo_identificacion === 'CONSUMIDOR_FINAL') {
      return null;
    }

    if (billingCustomerId) {
      const { data, error } = await supabase
        .from('clientes_facturacion')
        .update(payload)
        .eq('id', billingCustomerId)
        .select()
        .single();

      if (error) throw error;
      return data;
    }

    const { data: existingRows, error: existingError } = await supabase
      .from('clientes_facturacion')
      .select('*')
      .eq('tipo_identificacion', payload.tipo_identificacion)
      .eq('identificacion', payload.identificacion)
      .limit(1);

    if (existingError) throw existingError;

    const existing = existingRows?.[0];

    if (existing) {
      const { data, error } = await supabase
        .from('clientes_facturacion')
        .update(payload)
        .eq('id', existing.id)
        .select()
        .single();

      if (error) throw error;
      return data;
    }

    const { data, error } = await supabase
      .from('clientes_facturacion')
      .insert([payload])
      .select()
      .single();

    if (error) throw error;
    return data;
  };

  const buscarClienteFacturacion = async (
    identificacion: string,
    tipoIdentificacion: BillingIdType
  ) => {
    const id = identificacion.trim();

    if (!id || tipoIdentificacion === 'CONSUMIDOR_FINAL') return;

    try {
      setBillingLookupLoading(true);
      setBillingFoundMessage('');

      const { data, error } = await supabase
        .from('clientes_facturacion')
        .select('*')
        .eq('tipo_identificacion', tipoIdentificacion)
        .eq('identificacion', id)
        .limit(1);

      if (error) throw error;

      const cliente = data?.[0];

      if (cliente) {
        setBillingCustomerId(cliente.id);
        setBillingForm({
          tipo_identificacion: normalizeBillingIdType(cliente.tipo_identificacion),
          identificacion: cliente.identificacion || '',
          nombres: cliente.nombres || '',
          direccion: cliente.direccion || '',
          telefono: cliente.telefono || '',
          email: cliente.email || '',
        });
        setBillingFoundMessage('Cliente de facturación encontrado.');
      } else {
        setBillingCustomerId(null);
        setBillingFoundMessage('No existe registrado. Ingrese los datos manualmente.');
      }
    } catch (error: any) {
      toast.error('Error al buscar cliente de facturación: ' + error.message);
    } finally {
      setBillingLookupLoading(false);
    }
  };

  const handleSavePatient = async () => {
    if (!patientForm.name.trim() || !patientForm.cedula.trim() || !patientForm.birth_date) {
      toast.error('Nombre, cédula y fecha de nacimiento son obligatorios');
      return;
    }

    try {
      setCreatingPatient(true);

      const payload = {
        name: patientForm.name.trim(),
        cedula: patientForm.cedula.trim(),
        phone: patientForm.phone.trim() || null,
        email: patientForm.email.trim() || null,
        birth_date: patientForm.birth_date,
        sex: patientForm.sex,
        direccion: patientForm.direccion.trim() || null,
      };

      const { data, error } = await supabase
        .from('pacientes')
        .insert([payload])
        .select()
        .single();

      if (error) throw error;

      toast.success('Paciente registrado');
      await fetchData();

      if (data?.id) {
        setSelectedPatient(data.id);
        setPatientSearch('');
      }

      setPatientDialogOpen(false);
      setPatientForm({
        name: '',
        cedula: '',
        phone: '',
        email: '',
        birth_date: '',
        sex: 'M',
        direccion: '',
      });
    } catch (error: any) {
      toast.error(
        'Error: ' +
          (error.message?.includes('unique') || error.message?.includes('pacientes_cedula_key')
            ? 'La cédula ya existe'
            : error.message)
      );
    } finally {
      setCreatingPatient(false);
    }
  };

  const handleSaveDoctor = async () => {
    if (!doctorForm.nombre.trim()) {
      toast.error('El nombre del médico es obligatorio');
      return;
    }

    try {
      setSavingDoctor(true);

      const payload = {
        nombre: doctorForm.nombre.trim(),
        especialidad: doctorForm.especialidad.trim() || null,
        telefono: doctorForm.telefono.trim() || null,
        email: doctorForm.email.trim() || null,
        activo: doctorForm.activo,
      };

      const { data, error } = await supabase
        .from('doctores')
        .insert([payload])
        .select()
        .single();

      if (error) throw error;

      toast.success('Médico registrado');
      await fetchDoctors();

      if (data?.id) setSelectedDoctor(data.id);

      setDoctorDialogOpen(false);
      setDoctorForm(initialDoctorForm);
    } catch (error: any) {
      toast.error('Error al guardar médico: ' + error.message);
    } finally {
      setSavingDoctor(false);
    }
  };

  const generarFacturaElectronica = async (orderId: string) => {
    const { data: facturaResp, error: facturaError } = await supabase.functions.invoke(
      'generar-factura-electronica',
      { body: { order_id: orderId } }
    );

    if (facturaError) {
      throw new Error('Falló la comunicación con la facturación electrónica');
    }

    if (!facturaResp?.ok) {
      const sriDetalle = facturaResp?.sri_mensajes
        ?.map((m: any) =>
          [m.identificador, m.mensaje, m.informacionAdicional]
            .filter(Boolean)
            .join(' - ')
        )
        .join(' | ');

      throw new Error(
        sriDetalle || facturaResp?.message || 'No se pudo generar la factura electrónica'
      );
    }

    return facturaResp;
  };

  const enviarFacturaPorCorreo = async (params: {
    to: string;
    numeroFactura: string;
    clienteNombre?: string;
    pdfPath: string;
  }) => {
    const cleanPath = String(params.pdfPath || '').trim().replace(/^\/+/, '');

    if (!cleanPath) throw new Error('No existe PDF de factura para enviar');

    const { data: publicData } = supabase.storage
      .from('facturas-pdf')
      .getPublicUrl(cleanPath);

    const pdfUrl = publicData?.publicUrl;
    if (!pdfUrl) throw new Error('No se pudo obtener la URL pública del PDF de factura');

    await sendDocumentEmail({
      to: params.to,
      documentType: 'factura',
      orderCode: params.numeroFactura,
      patientName: params.clienteNombre || '',
      pdfUrl,
      filename: `factura_${params.numeroFactura}.pdf`,
    });
  };

  const printThermalTicket = async (orderId: string) => {
    const { data: order } = await supabase
      .from('ordenes')
      .select(`
        *,
        pacientes(*),
        doctores(nombre, especialidad),
        orden_detalle(
          test_id,
          price,
          porcentaje_iva,
          valor_iva,
          total_linea,
          pruebas(
            name,
            price,
            description,
            visible_description,
            parametros_prueba(
              id,
              name
            )
          )
        )
      `)
      .eq('id', orderId)
      .single();

    if (!order) return;

    const subtotal = round2(
      (order.orden_detalle || []).reduce(
        (acc: number, d: any) => acc + safeNumber(d.price),
        0
      )
    );

    const iva = round2(
      (order.orden_detalle || []).reduce(
        (acc: number, d: any) => acc + safeNumber(d.valor_iva),
        0
      )
    );

    const total = round2(
      (order.orden_detalle || []).reduce(
        (acc: number, d: any) => acc + safeNumber(d.total_linea, d.price),
        0
      )
    );

    const pagado = round2(safeNumber(order.paid_amount, 0));
    const saldo = round2(Math.max(total - pagado, 0));
    const detallesAgrupadosTicket = groupOrderDetailsForTicket(order.orden_detalle || []);
    const portalUrl = `${window.location.origin}/portal?clave=${order.access_key}`;

    const qrDataUrl = await QRCode.toDataURL(portalUrl, { width: 180, margin: 1 });

    const logoHtml = labConfig?.logo
      ? `
        <div class="logo-wrap">
          <img src="${labConfig.logo}" class="logo" alt="Logo laboratorio" />
        </div>
      `
      : '';

    const labName = labConfig?.name || 'LABORATORIO CLÍNICO';
    const labOwner = labConfig?.owner || '';
    const labAddress = labConfig?.address || '';
    const labPhone = labConfig?.phone || '';
    const labSchedule = labConfig?.schedule || '';
    const labRuc = labConfig?.ruc || '';
    const labReg = labConfig?.health_registry || '';

    const doctorHtml = order.doctores?.nombre
      ? `<div><b>MÉDICO:</b> ${order.doctores.nombre}</div>`
      : '';

    const facturacionHtml = `
      <div class="line"></div>
      <div class="bold">DATOS FACTURA</div>
      <div><b>NOMBRE:</b> ${order.factura_nombres || '—'}</div>
      <div><b>ID:</b> ${order.factura_identificacion || '—'}</div>
      <div><b>TIPO:</b> ${order.factura_tipo_identificacion || '—'}</div>
    `;

    const printWindow = window.open('', '_blank', 'width=320,height=950');
    if (!printWindow) return;

    const ticketHTML = `
      <html>
        <head>
          <title>Ticket de recepción</title>
          <style>
            @page { size: 58mm auto; margin: 0; }
            * { box-sizing: border-box; }
            body {
              font-family: Arial, Helvetica, sans-serif;
              width: 58mm;
              padding: 6px;
              margin: 0;
              font-size: 11px;
              line-height: 1.25;
              color: #000;
            }
            .center { text-align: center; }
            .bold { font-weight: 700; }
            .line { border-bottom: 1px dashed #000; margin: 6px 0; }
            .flex { display: flex; justify-content: space-between; gap: 8px; }
            .small { font-size: 9px; word-break: break-word; }
            .tiny { font-size: 8px; word-break: break-word; }
            .qr { display: flex; justify-content: center; margin-top: 8px; }
            .qr img { width: 110px; height: 110px; }
            .logo-wrap { display: flex; justify-content: center; margin-bottom: 4px; }
            .logo { max-width: 90px; max-height: 90px; object-fit: contain; }
            .access-box {
              border: 1px solid #000;
              padding: 4px;
              font-size: 15px;
              font-weight: 700;
              text-align: center;
              letter-spacing: 1px;
              margin-top: 4px;
            }
            .test-row { display: flex; justify-content: space-between; gap: 6px; margin-bottom: 2px; }
            .test-name { flex: 1; word-break: break-word; }
            .test-price { white-space: nowrap; }
          </style>
        </head>
        <body>
          ${logoHtml}
          <div class="center bold">${labName}</div>
          ${labOwner ? `<div class="center small">${labOwner}</div>` : ''}
          ${labAddress ? `<div class="center tiny">${labAddress}</div>` : ''}
          ${labPhone ? `<div class="center small">Tel: ${labPhone}</div>` : ''}
          ${labSchedule ? `<div class="center tiny">${labSchedule}</div>` : ''}
          ${labRuc ? `<div class="center small">RUC: ${labRuc}</div>` : ''}
          ${labReg ? `<div class="center small">Reg: ${labReg}</div>` : ''}

          <div class="line"></div>
          <div class="center bold">COMPROBANTE DE RECEPCIÓN</div>
          <div class="line"></div>

          <div><b>ORDEN:</b> ${order.code}</div>
          <div><b>FECHA:</b> ${new Date(order.created_at).toLocaleDateString()}</div>
          <div><b>PACIENTE:</b> ${order.pacientes?.name || ''}</div>
          <div><b>ID PACIENTE:</b> ${order.pacientes?.cedula || ''}</div>
          ${doctorHtml}
          ${facturacionHtml}

          <div class="line"></div>
          <div class="center bold">CLAVE DE ACCESO WEB</div>
          <div class="access-box">${order.access_key}</div>

          ${
            order.numero_factura
              ? `
                <div class="line"></div>
                <div><b>FACTURA:</b> ${order.numero_factura}</div>
                <div><b>ESTADO FE:</b> ${order.factura_estado}</div>
              `
              : ''
          }

          ${order.clave_acceso_sri ? `<div class="small"><b>CLAVE SRI:</b> ${order.clave_acceso_sri}</div>` : ''}
          ${order.numero_autorizacion_sri ? `<div class="small"><b>AUTORIZACIÓN:</b> ${order.numero_autorizacion_sri}</div>` : ''}

          <div class="line"></div>
          <div class="bold">PRUEBAS:</div>

          ${detallesAgrupadosTicket
            .map((grupo: any) => {
              const isGrouped = grupo.items.length > 1;

              return grupo.items
                .map((detalle: any) => {
                  const prueba = detalle?.pruebas || {};
                  const variantLabel = buildVariantLabelFromTest(prueba, isGrouped);
                  const testName = String(prueba?.name || 'Prueba').trim();
                  const labelToShow = variantLabel.trim() || testName;

                  return `
                    <div class="test-row">
                      <span class="test-name">- ${labelToShow}</span>
                      <span class="test-price">$${Number(detalle.price || 0).toFixed(2)}</span>
                    </div>
                  `;
                })
                .join('');
            })
            .join('')}

          <div class="line"></div>
          <div class="flex"><span>SUBTOTAL:</span><span>$${subtotal.toFixed(2)}</span></div>
          <div class="flex"><span>IVA:</span><span>$${iva.toFixed(2)}</span></div>
          <div class="flex bold"><span>TOTAL:</span><span>$${total.toFixed(2)}</span></div>
          <div class="flex"><span>PAGADO:</span><span>$${pagado.toFixed(2)}</span></div>
          <div class="flex bold"><span>SALDO:</span><span>$${saldo.toFixed(2)}</span></div>

          <div class="line"></div>
          <div class="center">Consulte sus resultados en:</div>
          <div class="center bold tiny">${portalUrl}</div>
          <div class="qr"><img src="${qrDataUrl}" alt="QR portal resultados" /></div>
          <div class="center small">Escanee el código QR</div>
        </body>
      </html>
    `;

    printWindow.document.write(ticketHTML);
    printWindow.document.close();
    printWindow.focus();

    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 500);
  };

  const handleCreateOrder = async () => {
    if (!selectedPatient || selectedTests.length === 0) return;

    const paciente = patients.find((p) => p.id === selectedPatient);
    if (!paciente) {
      toast.error('Debe seleccionar un paciente válido');
      return;
    }

    const validacionFact = validarFacturacion();
    if (!validacionFact.ok || !validacionFact.data) {
      toast.error(validacionFact.message || 'Datos de facturación incompletos');
      return;
    }

    const initialAmount = round2(Number(initialPaymentForm.amount || 0));
    const totalOrden = resumenTotales.total;

    if (initialPaymentForm.amount && (!Number.isFinite(initialAmount) || initialAmount < 0)) {
      toast.error('El monto del pago inicial no es válido');
      return;
    }

    if (initialAmount > totalOrden) {
      toast.error('El pago inicial no puede ser mayor al total de la orden');
      return;
    }

    setCreatingOrder(true);

    const total = totalOrden;
    const orderCode = generateOrderCode();
    const accessKey = generateAccessKey();

    try {
      const billingCustomer = await upsertBillingCustomer(validacionFact.data);

      const billingDataToUse = {
        tipo_identificacion:
          billingCustomer?.tipo_identificacion || validacionFact.data.tipo_identificacion,
        identificacion: String(
          billingCustomer?.identificacion || validacionFact.data.identificacion || ''
        ).trim(),
        nombres: String(billingCustomer?.nombres || validacionFact.data.nombres || '').trim(),
        direccion: String(billingCustomer?.direccion || validacionFact.data.direccion || '').trim(),
        telefono: String(billingCustomer?.telefono || validacionFact.data.telefono || '').trim(),
        email: String(billingCustomer?.email || validacionFact.data.email || '').trim(),
      };

      const { data: order, error: orderError } = await supabase
        .from('ordenes')
        .insert([
          {
            code: orderCode,
            access_key: accessKey,
            patient_id: selectedPatient,
            doctor_id: selectedDoctor || null,
            total,
            status: 'pending',
            factura_estado: 'PENDIENTE',
            billing_customer_id: billingCustomer?.id || null,
            factura_tipo_identificacion: billingDataToUse.tipo_identificacion,
            factura_identificacion: billingDataToUse.identificacion,
            factura_nombres: billingDataToUse.nombres,
            factura_direccion: billingDataToUse.direccion,
            factura_telefono: billingDataToUse.telefono,
            factura_email: billingDataToUse.email || null,
            created_at: getEcuadorDateTimeForDB(),
          },
        ])
        .select()
        .single();

      if (orderError) throw orderError;

      for (const summary of selectedTestsSummary) {
        const porcentajeIva = round2(safeNumber(summary.porcentaje_iva, 0));
        const codigoPorcentajeIva = String(
          summary.codigo_porcentaje_iva || obtenerCodigoPorcentajeIva(porcentajeIva)
        );
        const objetoImpuesto = String(summary.objeto_impuesto || '2');

        const { error: detailError } = await supabase.from('orden_detalle').insert({
          order_id: order.id,
          test_id: summary.id,
          price: round2(safeNumber(summary.subtotalOriginal, 0)),
          descuento: round2(safeNumber(summary.descuentoTotal, 0)),
          porcentaje_iva: porcentajeIva,
          codigo_porcentaje_iva: codigoPorcentajeIva,
          objeto_impuesto: objetoImpuesto,
          subtotal_sin_impuesto: round2(safeNumber(summary.subtotal, 0)),
          valor_iva: round2(safeNumber(summary.valorIva, 0)),
          total_linea: round2(safeNumber(summary.totalLinea, 0)),
        });

        if (detailError) throw detailError;

        if (summary.prueba_reactivos) {
          for (const tr of summary.prueba_reactivos) {
            const { error: stockError } = await supabase.rpc('decrement_reagent_stock', {
              row_id: tr.reagent_id,
              amount: tr.quantity_used,
            });

            if (stockError) throw stockError;
          }
        }
      }

      if (initialAmount > 0) {
        const { error: paymentError } = await supabase.from('orden_pagos').insert([
          {
            order_id: order.id,
            amount: initialAmount,
            payment_method: initialPaymentForm.payment_method,
            reference: initialPaymentForm.reference.trim() || null,
            notes: initialPaymentForm.notes.trim() || null,
          },
        ]);

        if (paymentError) throw paymentError;
      }

      let facturaResp: any = null;
      const saldoDespuesPago = round2(Math.max(total - initialAmount, 0));
      const pagoCompletoInicial = initialAmount > 0 && saldoDespuesPago <= 0;

      if (pagoCompletoInicial) {
        try {
          facturaResp = await generarFacturaElectronica(order.id);
        } catch (facturaError: any) {
          toast.warning(
            'La orden y el pago fueron registrados, pero no se pudo generar la factura electrónica: ' +
              (facturaError?.message || 'desconocido')
          );
        }
      }

      if (pagoCompletoInicial && facturaResp) {
        const facturaAutorizada =
          facturaResp?.sri_estado === 'AUTORIZADO' ||
          facturaResp?.factura_estado === 'AUTORIZADO' ||
          facturaResp?.autorizado === true;

        const esConsumidorFinal =
          billingDataToUse.tipo_identificacion === 'CONSUMIDOR_FINAL' ||
          billingDataToUse.identificacion === '9999999999999';

        if (facturaResp?.sri_estado === 'EN_PROCESAMIENTO') {
          toast.info(
            facturaResp?.message ||
              'Orden creada, pago completo registrado y factura enviada al SRI en procesamiento.'
          );
        } else if (facturaAutorizada) {
          if (
            !esConsumidorFinal &&
            billingDataToUse.email &&
            facturaResp?.factura_ride_pdf_path &&
            facturaResp?.numero_factura
          ) {
            try {
              await enviarFacturaPorCorreo({
                to: billingDataToUse.email,
                numeroFactura: facturaResp.numero_factura,
                clienteNombre: billingDataToUse.nombres,
                pdfPath: facturaResp.factura_ride_pdf_path,
              });

              toast.success('Orden creada, pago completo registrado y factura enviada por correo.');
            } catch (emailError: any) {
              toast.warning(
                'La factura fue autorizada, pero no se pudo enviar por correo: ' +
                  (emailError?.message || 'desconocido')
              );
            }
          } else {
            toast.success('Orden creada, pago completo registrado y factura generada.');
          }
        } else {
          toast.success('Orden creada y pago completo registrado.');
        }
      } else if (initialAmount > 0) {
        toast.success('Orden creada y pago inicial registrado correctamente.');
      } else {
        toast.success('Orden creada correctamente.');
      }

      setOrderDialogOpen(false);
      resetOrderForm();
      await fetchData();
      printThermalTicket(order.id);
    } catch (error: any) {
      toast.error('Error al crear orden: ' + error.message);
    } finally {
      setCreatingOrder(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center flex-col gap-2">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <p className="text-muted-foreground animate-pulse">Cargando grupos de exámenes...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-display font-bold">Grupos de Exámenes</h1>
          <p className="text-muted-foreground text-sm">
            Crea plantillas de pruebas y genera órdenes sin alterar el grupo original.
          </p>
        </div>

        <Button onClick={openCreateGroup}>
          <Plus className="w-4 h-4 mr-2" />
          Nuevo Grupo
        </Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
        <Input
          className="pl-10"
          placeholder="Buscar grupo o prueba..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Grupo</TableHead>
                <TableHead className="hidden md:table-cell">Descripción</TableHead>
                <TableHead>Pruebas</TableHead>
                <TableHead>Total referencial</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {filteredGroups.map((group) => {
                const detalles = [...(group.detalles || [])].sort(
                  (a: any, b: any) => safeNumber(a.sort_order, 0) - safeNumber(b.sort_order, 0)
                );

                const total = detalles.reduce(
                  (acc: number, d: any) => acc + safeNumber(d?.pruebas?.price, 0),
                  0
                );

                return (
                  <TableRow key={group.id}>
                    <TableCell>
                      <div className="font-semibold text-slate-800">{group.nombre}</div>
                      <div className="md:hidden text-xs text-muted-foreground line-clamp-2">
                        {group.descripcion}
                      </div>
                    </TableCell>

                    <TableCell className="hidden md:table-cell text-sm text-muted-foreground max-w-[240px] truncate">
                      {group.descripcion || '—'}
                    </TableCell>

                    <TableCell>
                      <Badge variant="outline">{detalles.length}</Badge>
                    </TableCell>

                    <TableCell className="font-bold text-primary">
                      ${round2(total).toFixed(2)}
                    </TableCell>

                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Crear orden desde este grupo"
                          onClick={() => openCreateOrderFromGroup(group)}
                        >
                          <FilePlus className="w-4 h-4" />
                        </Button>

                        <Button
                          variant="ghost"
                          size="icon"
                          title="Editar grupo"
                          onClick={() => openEditGroup(group)}
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>

                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive"
                          title="Eliminar grupo"
                          onClick={() => handleDeleteGroup(group.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}

              {filteredGroups.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-10 text-muted-foreground">
                    No se encontraron grupos
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog
        open={groupDialogOpen}
        onOpenChange={(open) => {
          setGroupDialogOpen(open);
          if (!open) resetGroupForm();
        }}
      >
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display text-xl">
              {editingGroupId ? 'Editar grupo de exámenes' : 'Nuevo grupo de exámenes'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="font-semibold">Nombre del grupo *</Label>
                <Input
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  placeholder="Ej: Perfil hepático"
                />
              </div>

              <div className="space-y-2">
                <Label className="font-semibold">Buscar prueba</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                  <Input
                    className="pl-10"
                    value={testSearch}
                    onChange={(e) => setTestSearch(e.target.value)}
                    placeholder="Buscar por nombre, descripción o parámetro"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="font-semibold">Descripción</Label>
              <Textarea
                value={groupDescription}
                onChange={(e) => setGroupDescription(e.target.value)}
                placeholder="Descripción interna del grupo..."
              />
            </div>

            <div className="rounded-xl border p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-bold">Pruebas del grupo</h4>
                <Badge variant="secondary">{groupTestIds.length} seleccionadas</Badge>
              </div>

              {groupTestIds.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {groupTestIds.map((id) => {
                    const test = tests.find((t) => t.id === id);

                    return (
                      <Badge key={id} variant="outline" className="gap-1">
                        {test?.name || 'Prueba'}
                        <button type="button" onClick={() => toggleGroupTest(id)}>
                          <X className="w-3 h-3" />
                        </button>
                      </Badge>
                    );
                  })}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-[360px] overflow-y-auto pr-1">
                {filteredTestsForGroup.map((test) => {
                  const selected = groupTestIds.includes(test.id);

                  return (
                    <button
                      type="button"
                      key={test.id}
                      onClick={() => toggleGroupTest(test.id)}
                      className={`text-left rounded-xl border p-3 transition ${
                        selected
                          ? 'border-primary bg-primary/5'
                          : 'border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-semibold text-sm">{test.name}</p>
                          {test.description && (
                            <p className="text-xs text-muted-foreground line-clamp-2">
                              {test.description}
                            </p>
                          )}
                        </div>

                        <Badge variant={selected ? 'default' : 'secondary'}>
                          ${safeNumber(test.price, 0).toFixed(2)}
                        </Badge>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button variant="outline" onClick={() => setGroupDialogOpen(false)}>
                Cerrar
              </Button>

              <Button onClick={handleSaveGroup} disabled={savingGroup}>
                {savingGroup ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Guardando...
                  </>
                ) : (
                  'Guardar grupo'
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={orderDialogOpen}
        onOpenChange={(open) => {
          setOrderDialogOpen(open);
          if (!open) resetOrderForm();
        }}
      >
        <DialogContent className="max-w-6xl max-h-[92vh] overflow-hidden p-0">
          <div className="flex flex-col max-h-[92vh]">
            <DialogHeader className="px-6 pt-6 pb-4 border-b">
              <DialogTitle className="font-display text-xl">Crear orden desde grupo</DialogTitle>

              {currentGroup && (
                <p className="text-sm text-muted-foreground">
                  Grupo base: <b>{currentGroup.nombre}</b>.
                </p>
              )}
            </DialogHeader>

            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                  <CardContent className="p-4 space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="font-bold">Paciente</h3>
                      <Button variant="outline" size="sm" onClick={() => setPatientDialogOpen(true)}>
                        <UserPlus className="w-4 h-4 mr-2" />
                        Nuevo
                      </Button>
                    </div>

                    <Input
                      value={patientSearch}
                      onChange={(e) => setPatientSearch(e.target.value)}
                      placeholder="Buscar paciente por nombre, cédula o correo"
                    />

                    {selectedPatient ? (
                      <div className="rounded-xl border bg-primary/5 p-3 flex justify-between gap-3">
                        <div>
                          <p className="font-semibold">
                            {patients.find((p) => p.id === selectedPatient)?.name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {patients.find((p) => p.id === selectedPatient)?.cedula}
                          </p>
                        </div>

                        <Button variant="ghost" size="icon" onClick={() => setSelectedPatient('')}>
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-2 max-h-[220px] overflow-y-auto">
                        {filteredPatients.map((p) => (
                          <button
                            type="button"
                            key={p.id}
                            onClick={() => {
                              setSelectedPatient(p.id);
                              setPatientSearch('');
                            }}
                            className="w-full text-left rounded-xl border p-3 hover:bg-slate-50"
                          >
                            <p className="font-semibold text-sm">{p.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {p.cedula} {p.email ? `• ${p.email}` : ''}
                            </p>
                          </button>
                        ))}

                        {patientSearch && filteredPatients.length === 0 && (
                          <p className="text-sm text-muted-foreground text-center py-4">
                            No se encontraron pacientes
                          </p>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-4 space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="font-bold">Médico</h3>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setDoctorForm(initialDoctorForm);
                          setDoctorDialogOpen(true);
                        }}
                      >
                        <Stethoscope className="w-4 h-4 mr-2" />
                        Nuevo
                      </Button>
                    </div>

                    <Select
                      value={selectedDoctor || '__none__'}
                      onValueChange={(value) => setSelectedDoctor(value === '__none__' ? '' : value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccione médico" />
                      </SelectTrigger>

                      <SelectContent>
                        <SelectItem value="__none__">Sin médico</SelectItem>
                        {doctors.map((doctor) => (
                          <SelectItem key={doctor.id} value={doctor.id}>
                            {doctor.nombre}
                            {doctor.especialidad ? ` — ${doctor.especialidad}` : ''}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardContent className="p-4 space-y-4">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                    <div>
                      <h3 className="font-bold">Pruebas de esta orden</h3>
                      <p className="text-xs text-muted-foreground">
                        Puedes quitar pruebas del grupo o agregar pruebas adicionales.
                      </p>
                    </div>

                    <Badge variant="secondary">{selectedTests.length} pruebas</Badge>
                  </div>

                  <Input
                    value={testSearch}
                    onChange={(e) => setTestSearch(e.target.value)}
                    placeholder="Buscar prueba para agregar o quitar"
                  />

                  {selectedTests.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {selectedTests.map((id) => {
                        const test = tests.find((t) => t.id === id);

                        return (
                          <Badge key={id} variant="outline" className="gap-1">
                            {test?.name || 'Prueba'}
                            <button type="button" onClick={() => toggleOrderTest(id)}>
                              <X className="w-3 h-3" />
                            </button>
                          </Badge>
                        );
                      })}
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-[340px] overflow-y-auto pr-1">
                    {filteredTestsForGroup.map((test) => {
                      const selected = selectedTests.includes(test.id);

                      return (
                        <button
                          type="button"
                          key={test.id}
                          onClick={() => toggleOrderTest(test.id)}
                          className={`text-left rounded-xl border p-3 transition ${
                            selected
                              ? 'border-primary bg-primary/5'
                              : 'border-slate-200 hover:bg-slate-50'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <p className="font-semibold text-sm">{test.name}</p>
                              {test.description && (
                                <p className="text-xs text-muted-foreground line-clamp-2">
                                  {test.description}
                                </p>
                              )}
                            </div>

                            <Badge variant={selected ? 'default' : 'secondary'}>
                              ${safeNumber(test.price, 0).toFixed(2)}
                            </Badge>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>

              {selectedTestsSummary.length > 0 && (
                <Card>
                  <CardContent className="p-4 space-y-4">
                    <div className="flex justify-between text-sm">
                      <span className="font-semibold text-primary italic">
                        {selectedTestsSummary.length} pruebas seleccionadas
                      </span>
                      <span className="font-semibold">
                        Subtotal original: ${resumenTotales.subtotalOriginal.toFixed(2)}
                      </span>
                    </div>

                    <div className="space-y-3">
                      {selectedTestsSummary.map((t) => (
                        <div key={t.id} className="rounded-xl border bg-white p-3 space-y-2">
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <div className="font-semibold text-slate-800">{t.name}</div>
                              <div className="text-xs text-slate-500">
                                IVA {Number(t.porcentaje_iva || 0).toFixed(2)}%
                              </div>
                            </div>

                            <div className="text-sm font-bold text-slate-700">
                              ${Number(t.subtotalOriginal || 0).toFixed(2)}
                            </div>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div className="space-y-1">
                              <Label className="text-[11px] font-semibold uppercase tracking-wider">
                                Descuento de esta prueba
                              </Label>
                              <Input
                                type="number"
                                step="0.01"
                                min="0"
                                max={Number(t.subtotalOriginal || 0)}
                                value={testDiscounts[t.id] || ''}
                                onChange={(e) =>
                                  setTestDiscounts((prev) => ({
                                    ...prev,
                                    [t.id]: e.target.value,
                                  }))
                                }
                                placeholder="0.00"
                              />
                            </div>

                            <div className="rounded-lg border bg-slate-50 px-3 py-2 text-sm space-y-1">
                              <div className="flex justify-between">
                                <span>Descuento aplicado</span>
                                <span>${Number(t.descuentoTotal || 0).toFixed(2)}</span>
                              </div>
                              <div className="flex justify-between">
                                <span>Base imponible</span>
                                <span>${Number(t.subtotal || 0).toFixed(2)}</span>
                              </div>
                              <div className="flex justify-between">
                                <span>IVA</span>
                                <span>${Number(t.valorIva || 0).toFixed(2)}</span>
                              </div>
                              <div className="flex justify-between font-semibold text-primary border-t pt-1">
                                <span>Total línea</span>
                                <span>${Number(t.totalLinea || 0).toFixed(2)}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="rounded-xl border bg-slate-50 p-4 space-y-3">
                      <div className="space-y-2">
                        <Label className="font-semibold text-xs uppercase tracking-wider">
                          Descuento global adicional
                        </Label>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          value={globalDiscount}
                          onChange={(e) => setGlobalDiscount(e.target.value)}
                          placeholder="0.00"
                        />
                      </div>

                      <div className="flex justify-between text-sm">
                        <span>Subtotal original</span>
                        <span>${resumenTotales.subtotalOriginal.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>Descuento total</span>
                        <span>${resumenTotales.descuento.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>Subtotal neto</span>
                        <span>${resumenTotales.subtotal.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>IVA total</span>
                        <span>${resumenTotales.iva.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between items-center border-t pt-2">
                        <span className="text-sm font-bold text-primary">Total</span>
                        <span className="text-xl font-display font-black text-primary">
                          ${resumenTotales.total.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              <Card>
                <CardContent className="p-4 space-y-4">
                  <h3 className="font-bold">Datos de facturación</h3>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <button
                      type="button"
                      onClick={() => setBillingMode('PACIENTE')}
                      className={`rounded-2xl border p-4 text-left transition ${
                        billingMode === 'PACIENTE'
                          ? 'border-primary bg-primary/5'
                          : 'border-slate-200 bg-white'
                      }`}
                    >
                      <div className="font-semibold">Paciente</div>
                      <div className="text-xs text-slate-500 mt-1">Usa los datos del paciente</div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setBillingMode('CONSUMIDOR_FINAL')}
                      className={`rounded-2xl border p-4 text-left transition ${
                        billingMode === 'CONSUMIDOR_FINAL'
                          ? 'border-primary bg-primary/5'
                          : 'border-slate-200 bg-white'
                      }`}
                    >
                      <div className="font-semibold">Consumidor final</div>
                      <div className="text-xs text-slate-500 mt-1">Datos estándar</div>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setBillingMode('OTRO');
                        setBillingCustomerId(null);
                        setBillingFoundMessage('');
                        setBillingForm({
                          tipo_identificacion: 'CEDULA',
                          identificacion: '',
                          nombres: '',
                          direccion: '',
                          telefono: '',
                          email: '',
                        });
                      }}
                      className={`rounded-2xl border p-4 text-left transition ${
                        billingMode === 'OTRO'
                          ? 'border-primary bg-primary/5'
                          : 'border-slate-200 bg-white'
                      }`}
                    >
                      <div className="font-semibold">Otro cliente</div>
                      <div className="text-xs text-slate-500 mt-1">Cliente de facturación</div>
                    </button>
                  </div>

                  <div className="rounded-2xl border bg-slate-50 p-4 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="font-semibold text-xs uppercase tracking-wider">
                          Tipo de identificación
                        </Label>
                        <Select
                          value={billingForm.tipo_identificacion}
                          onValueChange={(v: BillingIdType) => {
                            setBillingCustomerId(null);
                            setBillingFoundMessage('');
                            setBillingForm((f) => ({
                              ...f,
                              tipo_identificacion: v,
                              identificacion: v === 'CONSUMIDOR_FINAL' ? '9999999999999' : '',
                            }));
                          }}
                          disabled={billingMode !== 'OTRO'}
                        >
                          <SelectTrigger className="bg-white">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="CEDULA">Cédula</SelectItem>
                            <SelectItem value="RUC">RUC</SelectItem>
                            <SelectItem value="PASAPORTE">Pasaporte</SelectItem>
                            <SelectItem value="CONSUMIDOR_FINAL">Consumidor final</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label className="font-semibold text-xs uppercase tracking-wider">
                          Identificación
                        </Label>
                        <div className="relative">
                          <Input
                            value={billingForm.identificacion}
                            onChange={(e) =>
                              setBillingForm((f) => ({ ...f, identificacion: e.target.value }))
                            }
                            onBlur={() => {
                              if (billingMode === 'OTRO') {
                                buscarClienteFacturacion(
                                  billingForm.identificacion,
                                  billingForm.tipo_identificacion
                                );
                              }
                            }}
                            disabled={billingMode !== 'OTRO'}
                            className="bg-white pr-10"
                          />
                          {billingLookupLoading && (
                            <Loader2 className="w-4 h-4 animate-spin absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
                          )}
                        </div>
                      </div>
                    </div>

                    {billingFoundMessage && (
                      <div className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-700">
                        {billingFoundMessage}
                      </div>
                    )}

                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label className="font-semibold text-xs uppercase tracking-wider">
                          Nombres / Razón social
                        </Label>
                        <Input
                          value={billingForm.nombres}
                          onChange={(e) => setBillingForm((f) => ({ ...f, nombres: e.target.value }))}
                          disabled={billingMode === 'PACIENTE' || billingMode === 'CONSUMIDOR_FINAL'}
                          className="bg-white"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label className="font-semibold text-xs uppercase tracking-wider">
                          Dirección
                        </Label>
                        <Textarea
                          value={billingForm.direccion}
                          onChange={(e) => setBillingForm((f) => ({ ...f, direccion: e.target.value }))}
                          rows={2}
                          disabled={billingMode === 'PACIENTE' || billingMode === 'CONSUMIDOR_FINAL'}
                          className="bg-white"
                        />
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label className="font-semibold text-xs uppercase tracking-wider">Teléfono</Label>
                          <Input
                            value={billingForm.telefono}
                            onChange={(e) => setBillingForm((f) => ({ ...f, telefono: e.target.value }))}
                            disabled={billingMode === 'PACIENTE' || billingMode === 'CONSUMIDOR_FINAL'}
                            className="bg-white"
                          />
                        </div>

                        <div className="space-y-2">
                          <Label className="font-semibold text-xs uppercase tracking-wider">Email</Label>
                          <Input
                            type="email"
                            value={billingForm.email}
                            onChange={(e) => setBillingForm((f) => ({ ...f, email: e.target.value }))}
                            disabled={billingMode === 'PACIENTE' || billingMode === 'CONSUMIDOR_FINAL'}
                            className="bg-white"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {selectedTestsSummary.length > 0 && (
                <Card>
                  <CardContent className="p-4 space-y-4">
                    <h3 className="font-bold">Pago inicial</h3>

                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <div>
                        <Label className="text-xs font-semibold">Monto</Label>
                        <Input
                          type="number"
                          value={initialPaymentForm.amount}
                          onChange={(e) =>
                            setInitialPaymentForm((f) => ({ ...f, amount: e.target.value }))
                          }
                          placeholder="0.00"
                        />
                      </div>

                      <div>
                        <Label className="text-xs font-semibold">Método</Label>
                        <Select
                          value={initialPaymentForm.payment_method}
                          onValueChange={(value) =>
                            setInitialPaymentForm((f) => ({ ...f, payment_method: value }))
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>

                          <SelectContent>
                            <SelectItem value="EFECTIVO">Efectivo</SelectItem>
                            <SelectItem value="TRANSFERENCIA">Transferencia</SelectItem>
                            <SelectItem value="TARJETA">Tarjeta</SelectItem>
                            <SelectItem value="DEPOSITO">Depósito</SelectItem>
                            <SelectItem value="OTRO">Otro</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div>
                        <Label className="text-xs font-semibold">Referencia</Label>
                        <Input
                          value={initialPaymentForm.reference}
                          onChange={(e) =>
                            setInitialPaymentForm((f) => ({ ...f, reference: e.target.value }))
                          }
                        />
                      </div>

                      <div>
                        <Label className="text-xs font-semibold">Notas</Label>
                        <Input
                          value={initialPaymentForm.notes}
                          onChange={(e) =>
                            setInitialPaymentForm((f) => ({ ...f, notes: e.target.value }))
                          }
                        />
                      </div>
                    </div>

                    <div className="rounded-xl border bg-slate-50 p-4 space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span>Subtotal original</span>
                        <span className="font-semibold">${resumenTotales.subtotalOriginal.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Descuento</span>
                        <span className="font-semibold">${resumenTotales.descuento.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Subtotal</span>
                        <span className="font-semibold">${resumenTotales.subtotal.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>IVA</span>
                        <span className="font-semibold">${resumenTotales.iva.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between border-t pt-2 text-base">
                        <span className="font-bold">Total</span>
                        <span className="font-bold text-primary">${resumenTotales.total.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Pago inicial</span>
                        <span className="font-semibold">
                          ${round2(Number(initialPaymentForm.amount || 0)).toFixed(2)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Saldo pendiente</span>
                        <span className="font-bold text-primary">
                          ${round2(Math.max(resumenTotales.total - round2(Number(initialPaymentForm.amount || 0)), 0)).toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>

            <div className="shrink-0 border-t bg-white px-6 py-4">
              <Button
                onClick={handleCreateOrder}
                className="w-full h-14 rounded-2xl text-xl font-semibold gradient-clinical text-primary-foreground border-0 shadow-lg"
                disabled={!selectedPatient || selectedTests.length === 0 || creatingOrder}
              >
                {creatingOrder ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Generando...
                  </>
                ) : (
                  'Crear Orden'
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={patientDialogOpen} onOpenChange={setPatientDialogOpen}>
        <DialogContent className="sm:max-w-[560px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display text-xl">Nuevo Registro de Paciente</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 pt-4">
            <div>
              <Label className="font-semibold text-xs uppercase tracking-wider">Nombre Completo *</Label>
              <Input
                value={patientForm.name}
                onChange={(e) => setPatientForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="font-semibold text-xs uppercase tracking-wider">Cédula *</Label>
                <Input
                  value={patientForm.cedula}
                  onChange={(e) => setPatientForm((f) => ({ ...f, cedula: e.target.value }))}
                />
              </div>

              <div>
                <Label className="font-semibold text-xs uppercase tracking-wider">Teléfono</Label>
                <Input
                  value={patientForm.phone}
                  onChange={(e) => setPatientForm((f) => ({ ...f, phone: e.target.value }))}
                />
              </div>
            </div>

            <div>
              <Label className="font-semibold text-xs uppercase tracking-wider">Correo</Label>
              <Input
                value={patientForm.email}
                onChange={(e) => setPatientForm((f) => ({ ...f, email: e.target.value }))}
              />
            </div>

            <div>
              <Label className="font-semibold text-xs uppercase tracking-wider">Dirección</Label>
              <Textarea
                rows={3}
                value={patientForm.direccion}
                onChange={(e) => setPatientForm((f) => ({ ...f, direccion: e.target.value }))}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="font-semibold text-xs uppercase tracking-wider">Fecha de nacimiento *</Label>
                <Input
                  type="date"
                  value={patientForm.birth_date}
                  onChange={(e) => setPatientForm((f) => ({ ...f, birth_date: e.target.value }))}
                />
              </div>

              <div>
                <Label className="font-semibold text-xs uppercase tracking-wider">Sexo</Label>
                <Select
                  value={patientForm.sex}
                  onValueChange={(value) => setPatientForm((f) => ({ ...f, sex: value as 'M' | 'F' }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>

                  <SelectContent>
                    <SelectItem value="M">Masculino</SelectItem>
                    <SelectItem value="F">Femenino</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Button onClick={handleSavePatient} className="w-full" disabled={creatingPatient}>
              {creatingPatient ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Guardando...
                </>
              ) : (
                'Guardar paciente'
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={doctorDialogOpen} onOpenChange={setDoctorDialogOpen}>
        <DialogContent className="sm:max-w-[560px]">
          <DialogHeader>
            <DialogTitle className="font-display text-xl">Nuevo Médico</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 pt-4">
            <div>
              <Label className="font-semibold text-xs uppercase tracking-wider">Nombre *</Label>
              <Input
                value={doctorForm.nombre}
                onChange={(e) => setDoctorForm((f) => ({ ...f, nombre: e.target.value }))}
              />
            </div>

            <div>
              <Label className="font-semibold text-xs uppercase tracking-wider">Especialidad</Label>
              <Input
                value={doctorForm.especialidad}
                onChange={(e) => setDoctorForm((f) => ({ ...f, especialidad: e.target.value }))}
              />
            </div>

            <div>
              <Label className="font-semibold text-xs uppercase tracking-wider">Teléfono</Label>
              <Input
                value={doctorForm.telefono}
                onChange={(e) => setDoctorForm((f) => ({ ...f, telefono: e.target.value }))}
              />
            </div>

            <div>
              <Label className="font-semibold text-xs uppercase tracking-wider">Correo</Label>
              <Input
                value={doctorForm.email}
                onChange={(e) => setDoctorForm((f) => ({ ...f, email: e.target.value }))}
              />
            </div>

            <Button onClick={handleSaveDoctor} className="w-full" disabled={savingDoctor}>
              {savingDoctor ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Guardando...
                </>
              ) : (
                'Guardar médico'
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
