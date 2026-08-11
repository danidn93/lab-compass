import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Eye, Plus, Pencil, Trash2, X, Loader2, ChevronDown, ChevronUp, GripVertical } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { Checkbox } from '@/components/ui/checkbox';

interface DividerForm {
  id: string;
  texto: string;
  sort_order: string;
}

type StructureItem =
  | {
      id: string;
      item_type: 'parameter';
      parameter: ParameterForm;
    }
  | {
      id: string;
      item_type: 'divider';
      divider: DividerForm;
    };

interface RangeForm {
  id: string;
  sex: 'M' | 'F' | 'both';
  min_age: string;
  max_age: string;
  min_value: string;
  max_value: string;
}

interface ParameterForm {
  id: string;
  name: string;
  unit: string;
  result_type: 'numeric' | 'boolean' | 'text';
  bool_true_label: string;
  bool_false_label: string;
  allow_observation: boolean;
  sort_order: string;
  default_value: string;
  default_boolean: '' | 'true' | 'false';
  ranges: RangeForm[];
}

interface ReagentForm {
  reagent_id: string;
  quantity_used: string;
}

const emptyDivider = (): DividerForm => ({
  id: crypto.randomUUID(),
  texto: '',
  sort_order: '0',
});

const createParameterItem = (): StructureItem => {
  const param = emptyParam();
  return {
    id: param.id,
    item_type: 'parameter',
    parameter: param,
  };
};

const createDividerItem = (): StructureItem => {
  const divider = emptyDivider();
  return {
    id: divider.id,
    item_type: 'divider',
    divider,
  };
};

const emptyRange = (): RangeForm => ({
  id: crypto.randomUUID(),
  sex: 'both',
  min_age: '0',
  max_age: '120',
  min_value: '',
  max_value: '',
});

const emptyParam = (): ParameterForm => ({
  id: crypto.randomUUID(),
  name: '',
  unit: '',
  result_type: 'numeric',
  bool_true_label: 'Positivo',
  bool_false_label: 'Negativo',
  allow_observation: false,
  sort_order: '0',
  default_value: '',
  default_boolean: '',
  ranges: [emptyRange()],
});

const emptyReagent = (): ReagentForm => ({
  reagent_id: '',
  quantity_used: '1',
});

function isParameterItem(item: StructureItem): item is Extract<StructureItem, { item_type: 'parameter' }> {
  return item.item_type === 'parameter';
}

function isDividerItem(item: StructureItem): item is Extract<StructureItem, { item_type: 'divider' }> {
  return item.item_type === 'divider';
}

function reorderItems<T>(list: T[], fromIndex: number, toIndex: number): T[] {
  const copy = [...list];
  const [moved] = copy.splice(fromIndex, 1);
  copy.splice(toIndex, 0, moved);
  return copy;
}

function safeNumber(value: any, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
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

export default function TestsPage() {
  const [tests, setTests] = useState<any[]>([]);
  const [reagents, setReagents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [viewTest, setViewTest] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [visibleDescription, setVisibleDescription] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [porcentajeIva, setPorcentajeIva] = useState('0');
  const [objetoImpuesto, setObjetoImpuesto] = useState('0');
  const [structureItems, setStructureItems] = useState<StructureItem[]>([createParameterItem()]);
  const [openParamId, setOpenParamId] = useState<string | null>(null);
  const [draggedItemId, setDraggedItemId] = useState<string | null>(null);
  const [testReagents, setTestReagents] = useState<ReagentForm[]>([]);

  const [saving, setSaving] = useState(false);

  const filtered = tests.filter(t => {
    const q = search.trim().toLowerCase();
    if (!q) return true;

    const matchTestName = String(t.name || '').toLowerCase().includes(q);
    const matchDescription = String(t.description || '').toLowerCase().includes(q);

    const matchParameters = (t.parameters || []).some((p: any) =>
      String(p.name || '').toLowerCase().includes(q)
    );

    const matchDividers = (t.dividers || []).some((d: any) =>
      String(d.texto || '').toLowerCase().includes(q)
    );

    return matchTestName || matchDescription || matchParameters || matchDividers;
  });

  const selectedTest = tests.find(t => t.id === viewTest);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: testsData, error: testsError } = await supabase
        .from('pruebas')
        .select(`
          *,
          parameters:parametros_prueba(
            *,
            ranges:rangos_referencia(*)
          ),
          dividers:parametros_prueba_divisores(*),
          reagents:prueba_reactivos(*)
        `)
        .order('name');

      const { data: reagentsData, error: reagentsError } = await supabase
        .from('reactivos')
        .select('*')
        .order('name');

      if (testsError) throw testsError;
      if (reagentsError) throw reagentsError;

      setTests(testsData || []);
      setReagents(reagentsData || []);
    } catch (error: any) {
      toast.error('Error al conectar con la base de datos');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const resetForm = () => {
    const firstItem = createParameterItem();
    setName('');
    setDescription('');
    setPrice('');
    setPorcentajeIva('0');
    setObjetoImpuesto('0');
    setVisibleDescription(false);
    setStructureItems([firstItem]);
    setOpenParamId(firstItem.id);
    setDraggedItemId(null);
    setTestReagents([]);
    setEditingId(null);
  };

  const openCreate = () => {
    resetForm();
    setFormOpen(true);
  };

  const openEdit = (test: any) => {
    setEditingId(test.id);
    setName(test.name || '');
    setDescription(test.description || '');
    setPrice(String(test.price ?? ''));
    setPorcentajeIva(String(test.porcentaje_iva ?? 15));
    setObjetoImpuesto(String(test.objeto_impuesto ?? '2'));
    setVisibleDescription(test.visible_description ?? true);

    const mappedParams: StructureItem[] = (test.parameters || []).map((p: any, index: number) => ({
      id: p.id || crypto.randomUUID(),
      item_type: 'parameter',
      parameter: {
        id: p.id || crypto.randomUUID(),
        name: p.name || '',
        unit: p.unit || '',
        result_type: p.result_type || 'numeric',
        bool_true_label: p.bool_true_label || 'Positivo',
        bool_false_label: p.bool_false_label || 'Negativo',
        allow_observation: !!p.allow_observation,
        sort_order: String(p.sort_order ?? index),
        default_value: p.valor_default || '',
        default_boolean:
          p.valor_default_boolean === true
            ? 'true'
            : p.valor_default_boolean === false
            ? 'false'
            : '',
        ranges:
          p.result_type === 'numeric'
            ? (p.ranges?.length ? p.ranges : [emptyRange()]).map((r: any) => ({
                id: r.id || crypto.randomUUID(),
                sex: r.sex,
                min_age: String(r.min_age ?? 0),
                max_age: String(r.max_age ?? 120),
                min_value: String(r.min_value ?? ''),
                max_value: String(r.max_value ?? ''),
              }))
            : [],
      },
    }));

    const mappedDividers: StructureItem[] = (test.dividers || [])
      .filter((d: any) => d.activo !== false)
      .map((d: any, index: number) => ({
        id: d.id || crypto.randomUUID(),
        item_type: 'divider',
        divider: {
          id: d.id || crypto.randomUUID(),
          texto: d.texto || '',
          sort_order: String(d.sort_order ?? index),
        },
      }));

    const combined = [...mappedParams, ...mappedDividers].sort((a, b) => {
      const aOrder =
        a.item_type === 'parameter'
          ? Number(a.parameter.sort_order ?? 0)
          : Number(a.divider.sort_order ?? 0);

      const bOrder =
        b.item_type === 'parameter'
          ? Number(b.parameter.sort_order ?? 0)
          : Number(b.divider.sort_order ?? 0);

      return aOrder - bOrder;
    });

    const finalItems = combined.length ? combined : [createParameterItem()];

    setStructureItems(finalItems);

    const firstOpenParam = finalItems.find(item => item.item_type === 'parameter');
    setOpenParamId(firstOpenParam?.id || null);

    setTestReagents(
      (test.reagents || []).map((r: any) => ({
        reagent_id: r.reagent_id,
        quantity_used: String(r.quantity_used ?? '1'),
      }))
    );

    setFormOpen(true);
  };
  
  const handleSave = async () => {
    if (saving) return;

    setSaving(true);
    const parameterItems = structureItems.filter(isParameterItem);
    const dividerItems = structureItems.filter(isDividerItem);

    if (parameterItems.length === 0) {
      toast.error('Debes agregar al menos un parámetro');
      return;
    }

    for (const item of parameterItems) {
      const p = item.parameter;

      if (!p.name.trim()) {
        toast.error('Todos los parámetros deben tener nombre');
        return;
      }

      if (p.result_type === 'numeric') {
        if (!p.unit.trim()) {
          toast.error(`El parámetro "${p.name}" debe tener unidad`);
          return;
        }

        for (const r of p.ranges) {
          if (r.min_value === '' || r.max_value === '') {
            toast.error(`Completa los rangos del parámetro "${p.name}"`);
            return;
          }
        }
      }
    }

    for (const item of dividerItems) {
      if (!item.divider.texto.trim()) {
        toast.error('Todos los divisores deben tener texto');
        return;
      }
    }

    try {
      const porcentaje = safeNumber(porcentajeIva);
      const codigoPorcentajeIva = obtenerCodigoPorcentajeIva(porcentaje);

      const { data: testData, error: testError } = await supabase
        .from('pruebas')
        .upsert({
          id: editingId || undefined,
          name: name.trim(),
          description: description.trim(),
          price: Number(price),
          porcentaje_iva: porcentaje,
          codigo_porcentaje_iva: codigoPorcentajeIva,
          objeto_impuesto: objetoImpuesto,
          visible_description: visibleDescription,
        })
        .select()
        .single();

      if (testError) throw testError;
      const testId = testData.id;

      const { error: deleteRangesError } = await supabase
        .from('rangos_referencia')
        .delete()
        .in(
          'parameter_id',
          (
            await supabase.from('parametros_prueba').select('id').eq('test_id', testId)
          ).data?.map((x: any) => x.id) || []
        );

      if (deleteRangesError) throw deleteRangesError;

      const { error: deleteParamsError } = await supabase
        .from('parametros_prueba')
        .delete()
        .eq('test_id', testId);

      const { error: deleteDividersError } = await supabase
        .from('parametros_prueba_divisores')
        .delete()
        .eq('test_id', testId);

      if (deleteDividersError) throw deleteDividersError;

      if (deleteParamsError) throw deleteParamsError;

      for (let index = 0; index < structureItems.length; index++) {
        const item = structureItems[index];
        const visualOrder = index;

        if (item.item_type === 'parameter') {
          const p = item.parameter;

          const { data: pData, error: pError } = await supabase
            .from('parametros_prueba')
            .insert({
              test_id: testId,
              name: p.name.trim(),
              unit: p.result_type === 'numeric' ? p.unit.trim() : null,
              result_type: p.result_type,
              bool_true_label: p.result_type === 'boolean' ? p.bool_true_label.trim() || 'Positivo' : null,
              bool_false_label: p.result_type === 'boolean' ? p.bool_false_label.trim() || 'Negativo' : null,
              valor_default: p.result_type === 'text' ? (p.default_value.trim() || null) : null,
              valor_default_boolean:
                p.result_type === 'boolean'
                  ? p.default_boolean === 'true'
                    ? true
                    : p.default_boolean === 'false'
                    ? false
                    : null
                  : null,
              allow_observation: !!p.allow_observation,
              sort_order: visualOrder,
            })
            .select()
            .single();

          if (pError) throw pError;

          if (p.result_type === 'numeric' && p.ranges.length > 0) {
            const rangesToInsert = p.ranges.map(r => ({
              parameter_id: pData.id,
              sex: r.sex,
              min_age: Number(r.min_age),
              max_age: Number(r.max_age),
              min_value: Number(r.min_value),
              max_value: Number(r.max_value),
            }));

            const { error: rangesError } = await supabase
              .from('rangos_referencia')
              .insert(rangesToInsert);

            if (rangesError) throw rangesError;
          }
        }

        if (item.item_type === 'divider') {
          const d = item.divider;

          const { error: dividerError } = await supabase
            .from('parametros_prueba_divisores')
            .insert({
              test_id: testId,
              texto: d.texto.trim(),
              sort_order: visualOrder,
              activo: true,
            });

          if (dividerError) throw dividerError;
        }
      }

      await supabase.from('prueba_reactivos').delete().eq('test_id', testId);

      const reagentsToInsert = testReagents
        .filter(r => r.reagent_id)
        .map(r => ({
          test_id: testId,
          reagent_id: r.reagent_id,
          quantity_used: Number(r.quantity_used),
        }));

      if (reagentsToInsert.length > 0) {
        const { error: reagentsError } = await supabase
          .from('prueba_reactivos')
          .insert(reagentsToInsert);

        if (reagentsError) throw reagentsError;
      }

      toast.success(editingId ? 'Prueba actualizada' : 'Prueba creada');
      setFormOpen(false);
      resetForm();
      fetchData();
    } catch (error: any) {
      toast.error('Error al guardar: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  
  const handleDelete = async (id: string) => {
    if (!confirm('¿Seguro que deseas eliminar esta prueba?')) return;

    const { error } = await supabase.from('pruebas').delete().eq('id', id);

    if (error) {
      toast.error('Error al eliminar');
    } else {
      toast.success('Prueba eliminada');
      fetchData();
    }
  };

  const handleDragStart = (itemId: string) => {
    setDraggedItemId(itemId);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  const handleDrop = (targetItemId: string) => {
    if (!draggedItemId || draggedItemId === targetItemId) return;

    setStructureItems(prev => {
      const fromIndex = prev.findIndex(item => item.id === draggedItemId);
      const toIndex = prev.findIndex(item => item.id === targetItemId);

      if (fromIndex === -1 || toIndex === -1) return prev;

      return reorderItems(prev, fromIndex, toIndex);
    });

    setDraggedItemId(null);
  };

  const handleDragEnd = () => {
    setDraggedItemId(null);
  };

  const updateParam = (itemId: string, field: keyof ParameterForm, value: any) => {
    setStructureItems(prev =>
      prev.map(item => {
        if (item.item_type !== 'parameter' || item.id !== itemId) return item;

        const p = item.parameter;
        const updated: ParameterForm = { ...p, [field]: value };

        if (field === 'result_type') {
          if (value === 'numeric') {
            updated.ranges = p.ranges.length ? p.ranges : [emptyRange()];
            updated.default_value = '';
            updated.default_boolean = '';
          } else {
            updated.unit = '';
            updated.ranges = [];
          }

          if (value === 'boolean') {
            updated.bool_true_label = p.bool_true_label || 'Positivo';
            updated.bool_false_label = p.bool_false_label || 'Negativo';
            updated.default_value = '';
            updated.default_boolean = p.default_boolean || '';
          }

          if (value === 'text') {
            updated.default_value = p.default_value || '';
            updated.default_boolean = '';
          }
        }

        return {
          ...item,
          parameter: updated,
        };
      })
    );
  };

  const updateDivider = (itemId: string, field: keyof DividerForm, value: any) => {
    setStructureItems(prev =>
      prev.map(item =>
        item.item_type === 'divider' && item.id === itemId
          ? {
              ...item,
              divider: {
                ...item.divider,
                [field]: value,
              },
            }
          : item
      )
    );
  };

  const updateRange = (itemId: string, rIdx: number, field: keyof RangeForm, value: any) => {
    setStructureItems(prev =>
      prev.map(item => {
        if (item.item_type !== 'parameter' || item.id !== itemId) return item;

        return {
          ...item,
          parameter: {
            ...item.parameter,
            ranges: item.parameter.ranges.map((r, ri) =>
              ri === rIdx ? { ...r, [field]: value } : r
            ),
          },
        };
      })
    );
  };

  const updateReagentRow = (idx: number, field: keyof ReagentForm, value: string) => {
    setTestReagents(prev => prev.map((r, i) => (i === idx ? { ...r, [field]: value } : r)));
  };

  const removeParameter = (itemId: string) => {
    setStructureItems(prev => {
      const next = prev.filter(item => item.id !== itemId);

      const hasParameter = next.some(item => item.item_type === 'parameter');

      if (!hasParameter) {
        const newParam = createParameterItem();
        setOpenParamId(newParam.id);
        return [...next, newParam];
      }

      if (openParamId === itemId) {
        const nextOpen = next.find(item => item.item_type === 'parameter');
        setOpenParamId(nextOpen?.id || null);
      }

      return next;
    });
  };

  const removeDivider = (itemId: string) => {
    setStructureItems(prev => prev.filter(item => item.id !== itemId));
  };

  const removeRange = (itemId: string, rIdx: number) => {
    setStructureItems(prev =>
      prev.map(item => {
        if (item.item_type !== 'parameter' || item.id !== itemId) return item;

        const nextRanges = item.parameter.ranges.filter((_, ri) => ri !== rIdx);

        return {
          ...item,
          parameter: {
            ...item.parameter,
            ranges: nextRanges.length > 0 ? nextRanges : [emptyRange()],
          },
        };
      })
    );
  };

  const toggleAccordion = (paramId: string) => {
    setOpenParamId(prev => (prev === paramId ? null : paramId));
  };

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center flex-col gap-2">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <p className="text-muted-foreground animate-pulse">Cargando catálogo SQL...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold">Pruebas de Laboratorio</h1>
          <p className="text-muted-foreground text-sm">Gestión de pruebas</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="w-4 h-4 mr-2" />
          Nueva Prueba
        </Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
        <Input
          className="pl-10"
          placeholder="Buscar prueba, descripción o parámetro..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead className="hidden md:table-cell">Descripción</TableHead>
                <TableHead>Descripción visible</TableHead>
                <TableHead>Parámetros</TableHead>
                <TableHead>IVA</TableHead>
                <TableHead>Precio</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(t => (
                <TableRow key={t.id}>
                  <TableCell className="font-medium text-slate-800">{t.name}</TableCell>

                  <TableCell className="hidden md:table-cell text-muted-foreground text-sm max-w-[200px] truncate">
                    {t.description}
                  </TableCell>

                  <TableCell>
                    <Badge variant={t.visible_description ? 'default' : 'secondary'}>
                      {t.visible_description ? 'Sí' : 'No'}
                    </Badge>
                  </TableCell>

                  <TableCell>
                    <Badge variant="outline">{t.parameters?.length || 0}</Badge>
                  </TableCell>

                  <TableCell>
                    <Badge variant="secondary">{Number(t.porcentaje_iva || 0).toFixed(2)}%</Badge>
                  </TableCell>

                  <TableCell className="font-bold text-primary">
                    ${Number(t.price).toFixed(2)}
                  </TableCell>

                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => setViewTest(t.id)}>
                        <Eye className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => openEdit(t)}>
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive"
                        onClick={() => handleDelete(t.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-10 text-muted-foreground">
                    No se encontraron pruebas
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!viewTest} onOpenChange={() => setViewTest(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display text-xl">{selectedTest?.name}</DialogTitle>
          </DialogHeader>

          {selectedTest && (
            <div className="space-y-4">
              {selectedTest.visible_description && selectedTest.description ? (
                <p className="text-sm text-muted-foreground">{selectedTest.description}</p>
              ) : null}

              <div className="flex flex-wrap gap-2">
                <Badge variant="outline">IVA {Number(selectedTest.porcentaje_iva || 0).toFixed(2)}%</Badge>
                <Badge variant="outline">Código SRI {selectedTest.codigo_porcentaje_iva || '—'}</Badge>
                <Badge variant="outline">Objeto impuesto {selectedTest.objeto_impuesto || '—'}</Badge>
              </div>

              <p className="text-lg font-bold text-primary">Precio: ${Number(selectedTest.price).toFixed(2)}</p>

              <div>
                <h4 className="font-bold mb-3 flex items-center gap-2">
                  Parámetros <Badge variant="secondary">Config</Badge>
                </h4>

                {[...(selectedTest.parameters || []).map((p: any) => ({
                  item_type: 'parameter',
                  sort_order: Number(p.sort_order ?? 0),
                  data: p,
                })),
                ...(selectedTest.dividers || [])
                  .filter((d: any) => d.activo !== false)
                  .map((d: any) => ({
                    item_type: 'divider',
                    sort_order: Number(d.sort_order ?? 0),
                    data: d,
                  })),
                ]
                  .sort((a, b) => a.sort_order - b.sort_order)
                  .map((item: any, idx: number) => {
                    if (item.item_type === 'divider') {
                      return (
                        <div
                          key={`divider-${item.data.id}-${idx}`}
                          className="my-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3"
                        >
                          <p className="text-sm font-bold uppercase tracking-wide text-amber-700">
                            {item.data.texto}
                          </p>
                        </div>
                      );
                    }

                    const param = item.data;

                    return (
                      <div key={param.id} className="mb-4 p-4 rounded-xl border bg-slate-50/50">
                        <p className="font-bold text-slate-700">
                          {param.name}
                          <span className="text-muted-foreground font-normal ml-2">
                            [{param.result_type || 'numeric'}]
                          </span>
                          {param.unit ? (
                            <span className="text-muted-foreground font-normal ml-2">({param.unit})</span>
                          ) : null}
                        </p>

                        {param.result_type === 'numeric' && (
                          <div className="mt-2 grid grid-cols-1 gap-1">
                            {(param.ranges || []).map((r: any) => (
                              <p
                                key={r.id}
                                className="text-xs text-slate-500 bg-white p-2 rounded border border-slate-100 flex justify-between"
                              >
                                <span>
                                  {r.sex === 'both' ? 'Ambos' : r.sex === 'M' ? 'Masculino' : 'Femenino'} | {r.min_age}-{r.max_age} años
                                </span>
                                <span className="font-bold text-slate-800">
                                  {r.min_value} - {r.max_value} {param.unit}
                                </span>
                              </p>
                            ))}
                          </div>
                        )}

                        {param.result_type === 'boolean' && (
                          <div className="mt-2 space-y-2">
                            <div className="flex gap-2">
                              <Badge variant="outline">{param.bool_true_label || 'Positivo'}</Badge>
                              <Badge variant="outline">{param.bool_false_label || 'Negativo'}</Badge>
                            </div>

                            {param.valor_default_boolean !== null && param.valor_default_boolean !== undefined && (
                              <p className="text-xs text-slate-700 bg-white p-2 rounded border">
                                <span className="font-semibold">Valor por defecto:</span>{' '}
                                {param.valor_default_boolean
                                  ? param.bool_true_label || 'Positivo'
                                  : param.bool_false_label || 'Negativo'}
                              </p>
                            )}
                          </div>
                        )}

                        {param.result_type === 'text' && (
                          <div className="mt-2 space-y-1">
                            <p className="text-xs text-slate-500">Valor textual libre</p>
                            {param.valor_default && (
                              <p className="text-xs text-slate-700 bg-white p-2 rounded border">
                                <span className="font-semibold">Valor por defecto:</span> {param.valor_default}
                              </p>
                            )}
                          </div>
                        )}

                        {param.allow_observation && (
                          <p className="text-xs text-amber-600 mt-2">Permite observación</p>
                        )}
                      </div>
                    );
                  })}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={formOpen}
        onOpenChange={open => {
          if (!open) {
            setFormOpen(false);
            resetForm();
          }
        }}
      >
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display text-xl">
              {editingId ? 'Editar prueba' : 'Nueva Prueba'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label className="font-semibold">Nombre de la Prueba *</Label>
                <Input value={name} onChange={e => setName(e.target.value)} placeholder="Ej: Hemograma" />
              </div>
              <div>
                <Label className="font-semibold">Precio Unitario ($) *</Label>
                <Input type="number" value={price} onChange={e => setPrice(e.target.value)} placeholder="0.00" />
              </div>
            </div>

            <div>
              <Label className="font-semibold">Descripción Técnica</Label>
              <Textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Detalles de la prueba..."
              />

              <div className="flex items-center gap-2 mt-3">
                <Checkbox
                  checked={visibleDescription}
                  onCheckedChange={checked => setVisibleDescription(!!checked)}
                />
                <Label className="text-sm font-semibold">
                  Mostrar descripción en resultados / visualización
                </Label>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label className="font-semibold">Tarifa IVA *</Label>
                <Select value={porcentajeIva} onValueChange={setPorcentajeIva}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccione IVA" />
                  </SelectTrigger>
                  <SelectContent defaultValue="0">
                    <SelectItem value="0">0%</SelectItem>
                    <SelectItem value="5">5%</SelectItem>
                    <SelectItem value="12">12%</SelectItem>
                    <SelectItem value="13">13%</SelectItem>
                    <SelectItem value="14">14%</SelectItem>
                    <SelectItem value="15">15%</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="font-semibold">Código porcentaje SRI</Label>
                <Input value={obtenerCodigoPorcentajeIva(Number(porcentajeIva || 0))} disabled readOnly />
              </div>

              <div>
                <Label className="font-semibold">Objeto del impuesto</Label>
                <Select value={objetoImpuesto} onValueChange={setObjetoImpuesto}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccione" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="2">Sí objeto de impuesto</SelectItem>
                    <SelectItem value="0">No objeto de impuesto</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-2">
                <h4 className="font-bold">Estructura de la Prueba</h4>

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const newItem = createParameterItem();
                      setStructureItems(prev => [...prev, newItem]);
                      setOpenParamId(newItem.id);
                    }}
                  >
                    <Plus className="w-3 h-3 mr-1" />
                    Parámetro
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const newItem = createDividerItem();
                      setStructureItems(prev => [...prev, newItem]);
                    }}
                  >
                    <Plus className="w-3 h-3 mr-1" />
                    Divisor
                  </Button>
                </div>
              </div>

              {structureItems.map((item, index) => {
                const isDragged = draggedItemId === item.id;

                if (item.item_type === 'divider') {
                  const divider = item.divider;

                  return (
                    <div
                      key={item.id}
                      draggable
                      onDragStart={() => handleDragStart(item.id)}
                      onDragOver={handleDragOver}
                      onDrop={() => handleDrop(item.id)}
                      onDragEnd={handleDragEnd}
                      className={`border-2 rounded-2xl overflow-hidden bg-amber-50/60 border-amber-200 transition ${
                        isDragged ? 'opacity-50' : ''
                      }`}
                    >
                      <div className="flex items-center gap-3 p-4">
                        <button
                          type="button"
                          className="cursor-grab active:cursor-grabbing text-slate-400 hover:text-slate-600"
                          title="Arrastrar"
                        >
                          <GripVertical className="w-5 h-5" />
                        </button>

                        <div className="flex-1">
                          <div className="text-xs font-bold uppercase text-amber-600 tracking-widest mb-1">
                            Divisor #{index + 1}
                          </div>
                          <Input
                            value={divider.texto}
                            onChange={e => updateDivider(item.id, 'texto', e.target.value)}
                            placeholder="Ej: SEROLOGÍA, HEMATOLOGÍA, BIOQUÍMICA..."
                            className="bg-white"
                          />
                        </div>

                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-red-400"
                          onClick={() => removeDivider(item.id)}
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  );
                }

                const param = item.parameter;
                const isOpen = openParamId === item.id;

                return (
                  <div
                    key={item.id}
                    draggable
                    onDragStart={() => handleDragStart(item.id)}
                    onDragOver={handleDragOver}
                    onDrop={() => handleDrop(item.id)}
                    onDragEnd={handleDragEnd}
                    className={`border-2 border-slate-100 rounded-2xl bg-slate-50/20 overflow-hidden transition ${
                      isDragged ? 'opacity-50' : ''
                    }`}
                  >
                    <button
                      type="button"
                      className="w-full p-4 flex items-center justify-between text-left hover:bg-slate-100/60 transition"
                      onClick={() => toggleAccordion(item.id)}
                    >
                      <div className="flex items-center gap-3 pr-4">
                        <span
                          className="cursor-grab active:cursor-grabbing text-slate-400 hover:text-slate-600"
                          onClick={e => e.stopPropagation()}
                        >
                          <GripVertical className="w-5 h-5" />
                        </span>

                        <div>
                          <div className="text-xs font-bold uppercase text-slate-400 tracking-widest">
                            Parámetro #{index + 1}
                          </div>
                          <div className="mt-1 font-semibold text-slate-700">
                            {param.name?.trim() || 'Nuevo parámetro'}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            Tipo: {param.result_type}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {structureItems.filter(i => i.item_type === 'parameter').length > 1 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-red-400"
                            onClick={e => {
                              e.stopPropagation();
                              removeParameter(item.id);
                            }}
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        )}

                        {isOpen ? (
                          <ChevronUp className="w-4 h-4 text-slate-500" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-slate-500" />
                        )}
                      </div>
                    </button>

                    {isOpen && (
                      <div className="px-4 pb-4 border-t bg-white/70">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4 mt-4">
                          <div>
                            <Label className="text-xs font-semibold">Nombre</Label>
                            <Input
                              value={param.name}
                              onChange={e => updateParam(item.id, 'name', e.target.value)}
                            />
                          </div>

                          <div>
                            <Label className="text-xs font-semibold">Tipo de resultado</Label>
                            <Select
                              value={param.result_type}
                              onValueChange={v =>
                                updateParam(item.id, 'result_type', v as 'numeric' | 'boolean' | 'text')
                              }
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="numeric">Numérico</SelectItem>
                                <SelectItem value="boolean">Booleano</SelectItem>
                                <SelectItem value="text">Texto</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          <div>
                            <Label className="text-xs font-semibold">Unidad</Label>
                            <Input
                              value={param.unit}
                              onChange={e => updateParam(item.id, 'unit', e.target.value)}
                              disabled={param.result_type !== 'numeric'}
                              placeholder={param.result_type === 'numeric' ? 'mg/dL, %, etc.' : 'No aplica'}
                            />
                          </div>
                        </div>

                        {param.result_type === 'text' && (
                          <div className="mb-4">
                            <Label className="text-xs font-semibold">Valor por defecto</Label>
                            <Textarea
                              value={param.default_value}
                              onChange={e => updateParam(item.id, 'default_value', e.target.value)}
                              placeholder="Ej: No se observan alteraciones"
                            />
                          </div>
                        )}

                        {param.result_type === 'boolean' && (
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                            <div>
                              <Label className="text-xs font-semibold">Etiqueta verdadero</Label>
                              <Input
                                value={param.bool_true_label}
                                onChange={e => updateParam(item.id, 'bool_true_label', e.target.value)}
                                placeholder="Ej: Positivo / Sí / Presencia"
                              />
                            </div>

                            <div>
                              <Label className="text-xs font-semibold">Etiqueta falso</Label>
                              <Input
                                value={param.bool_false_label}
                                onChange={e => updateParam(item.id, 'bool_false_label', e.target.value)}
                                placeholder="Ej: Negativo / No / Ausencia"
                              />
                            </div>

                            <div>
                              <Label className="text-xs font-semibold">Valor por defecto</Label>
                              <Select
                                value={param.default_boolean || 'none'}
                                onValueChange={value =>
                                  updateParam(
                                    item.id,
                                    'default_boolean',
                                    value === 'none' ? '' : (value as '' | 'true' | 'false')
                                  )
                                }
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Sin valor por defecto" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="none">Sin valor por defecto</SelectItem>
                                  <SelectItem value="true">
                                    {param.bool_true_label || 'Positivo'}
                                  </SelectItem>
                                  <SelectItem value="false">
                                    {param.bool_false_label || 'Negativo'}
                                  </SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                        )}

                        <div className="flex items-center gap-2 mb-4">
                          <Checkbox
                            checked={param.allow_observation}
                            onCheckedChange={checked => updateParam(item.id, 'allow_observation', !!checked)}
                          />
                          <Label className="text-xs font-semibold">Permitir observación para este parámetro</Label>
                        </div>

                        {param.result_type === 'numeric' && (
                          <div className="space-y-2">
                            <div className="flex justify-between items-center">
                              <span className="text-xs font-bold text-slate-500">Rangos de Referencia</span>
                              <Button
                                type="button"
                                variant="ghost"
                                className="h-6 text-[10px]"
                                onClick={() => {
                                  setStructureItems(prev =>
                                    prev.map(current =>
                                      current.item_type === 'parameter' && current.id === item.id
                                        ? {
                                            ...current,
                                            parameter: {
                                              ...current.parameter,
                                              ranges: [emptyRange(), ...current.parameter.ranges],
                                            },
                                          }
                                        : current
                                    )
                                  );
                                }}
                              >
                                + Añadir Rango
                              </Button>
                            </div>

                            {param.ranges.map((range, rIdx) => (
                              <div key={range.id} className="grid grid-cols-6 gap-2 items-end bg-white p-2 rounded-lg border">
                                <div className="col-span-1">
                                  <Label className="text-[10px]">Sexo</Label>
                                  <Select
                                    value={range.sex}
                                    onValueChange={v => updateRange(item.id, rIdx, 'sex', v as any)}
                                  >
                                    <SelectTrigger className="h-8 text-xs">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="both">Ambos</SelectItem>
                                      <SelectItem value="M">Masculino</SelectItem>
                                      <SelectItem value="F">Femenino</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>

                                <div className="col-span-1">
                                  <Label className="text-[10px]">Edad Mín</Label>
                                  <Input
                                    className="h-8 text-xs"
                                    value={range.min_age}
                                    onChange={e => updateRange(item.id, rIdx, 'min_age', e.target.value)}
                                  />
                                </div>

                                <div className="col-span-1">
                                  <Label className="text-[10px]">Edad Máx</Label>
                                  <Input
                                    className="h-8 text-xs"
                                    value={range.max_age}
                                    onChange={e => updateRange(item.id, rIdx, 'max_age', e.target.value)}
                                  />
                                </div>

                                <div className="col-span-1">
                                  <Label className="text-[10px]">Val Mín</Label>
                                  <Input
                                    className="h-8 text-xs"
                                    value={range.min_value}
                                    onChange={e => updateRange(item.id, rIdx, 'min_value', e.target.value)}
                                  />
                                </div>

                                <div className="col-span-1">
                                  <Label className="text-[10px]">Val Máx</Label>
                                  <Input
                                    className="h-8 text-xs"
                                    value={range.max_value}
                                    onChange={e => updateRange(item.id, rIdx, 'max_value', e.target.value)}
                                  />
                                </div>

                                <div className="col-span-1 text-right">
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-red-300"
                                    onClick={() => removeRange(item.id, rIdx)}
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </Button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}

                        {param.result_type === 'text' && (
                          <div className="rounded-lg border p-3 bg-slate-50 text-sm text-muted-foreground">
                            Este parámetro aceptará un valor textual libre en el registro del resultado.
                          </div>
                        )}

                        {param.result_type === 'boolean' && (
                          <div className="rounded-lg border p-3 bg-slate-50 text-sm text-muted-foreground">
                            Este parámetro aceptará un valor verdadero/falso con las etiquetas configuradas.
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const newItem = createParameterItem();
                      setStructureItems(prev => [...prev, newItem]);
                      setOpenParamId(newItem.id);
                    }}
                  >
                    <Plus className="w-3 h-3 mr-1" />
                    Parámetro
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const newItem = createDividerItem();
                      setStructureItems(prev => [...prev, newItem]);
                    }}
                  >
                    <Plus className="w-3 h-3 mr-1" />
                    Divisor
                  </Button>
                </div>              
            <div className="pt-4 border-t">
              <div className="flex items-center justify-between mb-4">
                <h4 className="font-bold">Reactivos vinculados</h4>
                <Button variant="outline" size="sm" onClick={() => setTestReagents(prev => [...prev, emptyReagent()])}>
                  + Vincular
                </Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {testReagents.map((tr, idx) => (
                  <div key={idx} className="flex gap-2 p-2 border rounded-lg items-end">
                    <div className="flex-1">
                      <Label className="text-[10px]">Reactivo</Label>
                      <Select value={tr.reagent_id} onValueChange={v => updateReagentRow(idx, 'reagent_id', v)}>
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue placeholder="Elegir..." />
                        </SelectTrigger>
                        <SelectContent>
                          {reagents.map(r => (
                            <SelectItem key={r.id} value={r.id}>
                              {r.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="w-20">
                      <Label className="text-[10px]">Cant.</Label>
                      <Input
                        className="h-8 text-xs"
                        type="number"
                        value={tr.quantity_used}
                        onChange={e => updateReagentRow(idx, 'quantity_used', e.target.value)}
                      />
                    </div>

                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-red-300"
                      onClick={() => setTestReagents(prev => prev.filter((_, i) => i !== idx))}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-6">
              <Button variant="outline" onClick={() => setFormOpen(false)}>
                Cerrar
              </Button>
              <Button
                onClick={handleSave}
                disabled={saving}
                className="bg-primary px-10"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Guardando...
                  </>
                ) : (
                  'Guardar la Prueba'
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
