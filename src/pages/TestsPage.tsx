import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Eye, Plus, Pencil, Trash2, X, Loader2, ChevronDown, ChevronUp } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';

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
  ranges: RangeForm[];
}

interface ReagentForm {
  reagent_id: string;
  quantity_used: string;
}

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
  ranges: [emptyRange()],
});

const emptyReagent = (): ReagentForm => ({
  reagent_id: '',
  quantity_used: '1',
});

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

  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [porcentajeIva, setPorcentajeIva] = useState('15');
  const [objetoImpuesto, setObjetoImpuesto] = useState('2');
  const [parameters, setParameters] = useState<ParameterForm[]>([emptyParam()]);
  const [openParamId, setOpenParamId] = useState<string | null>(null);
  const [testReagents, setTestReagents] = useState<ReagentForm[]>([]);

  const filtered = tests.filter(t => t.name.toLowerCase().includes(search.toLowerCase()));
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
          reagents:prueba_reactivos(*)
        `)
        .order('name');

      const { data: reagentsData } = await supabase.from('reactivos').select('*');

      if (testsError) throw testsError;
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
    const firstParam = emptyParam();

    setName('');
    setDescription('');
    setPrice('');
    setPorcentajeIva('15');
    setObjetoImpuesto('2');
    setParameters([firstParam]);
    setOpenParamId(firstParam.id);
    setTestReagents([]);
    setEditingId(null);
  };

  const openCreate = () => {
    resetForm();
    setFormOpen(true);
  };

  const openEdit = (test: any) => {
    setEditingId(test.id);
    setName(test.name);
    setDescription(test.description || '');
    setPrice(String(test.price ?? ''));
    setPorcentajeIva(String(test.porcentaje_iva ?? 15));
    setObjetoImpuesto(String(test.objeto_impuesto ?? '2'));

    const mappedParams = (test.parameters?.length ? test.parameters : [emptyParam()]).map((p: any) => ({
      id: p.id || crypto.randomUUID(),
      name: p.name || '',
      unit: p.unit || '',
      ranges: (p.ranges?.length ? p.ranges : [emptyRange()]).map((r: any) => ({
        id: r.id || crypto.randomUUID(),
        sex: r.sex,
        min_age: String(r.min_age ?? 0),
        max_age: String(r.max_age ?? 120),
        min_value: String(r.min_value ?? ''),
        max_value: String(r.max_value ?? ''),
      })),
    }));

    setParameters(mappedParams);
    setOpenParamId(null);

    setTestReagents((test.reagents || []).map((r: any) => ({
      reagent_id: r.reagent_id,
      quantity_used: String(r.quantity_used),
    })));

    setFormOpen(true);
  };

  const handleSave = async () => {
    if (!name.trim() || !price.trim()) {
      toast.error('Nombre y precio son obligatorios');
      return;
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
        })
        .select()
        .single();

      if (testError) throw testError;
      const testId = testData.id;

      await supabase.from('parametros_prueba').delete().eq('test_id', testId);

      for (const p of parameters) {
        const { data: pData, error: pError } = await supabase
          .from('parametros_prueba')
          .insert({
            test_id: testId,
            name: p.name,
            unit: p.unit,
          })
          .select()
          .single();

        if (pError) throw pError;

        const rangesToInsert = p.ranges.map(r => ({
          parameter_id: pData.id,
          sex: r.sex,
          min_age: Number(r.min_age),
          max_age: Number(r.max_age),
          min_value: Number(r.min_value),
          max_value: Number(r.max_value),
        }));

        const { error: rangesError } = await supabase.from('rangos_referencia').insert(rangesToInsert);
        if (rangesError) throw rangesError;
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
        const { error: reagentsError } = await supabase.from('prueba_reactivos').insert(reagentsToInsert);
        if (reagentsError) throw reagentsError;
      }

      toast.success(editingId ? 'Prueba actualizada' : 'Prueba creada');
      setFormOpen(false);
      resetForm();
      fetchData();
    } catch (error: any) {
      toast.error('Error al guardar: ' + error.message);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Seguro que deseas eliminar esta prueba?')) return;
    const { error } = await supabase.from('pruebas').delete().eq('id', id);
    if (error) toast.error('Error al eliminar');
    else {
      toast.success('Prueba eliminada');
      fetchData();
    }
  };

  const updateParam = (idx: number, field: keyof ParameterForm, value: any) => {
    setParameters(prev => prev.map((p, i) => (i === idx ? { ...p, [field]: value } : p)));
  };

  const updateRange = (pIdx: number, rIdx: number, field: keyof RangeForm, value: any) => {
    setParameters(prev =>
      prev.map((p, pi) =>
        pi === pIdx
          ? {
              ...p,
              ranges: p.ranges.map((r, ri) => (ri === rIdx ? { ...r, [field]: value } : r)),
            }
          : p
      )
    );
  };

  const updateReagentRow = (idx: number, field: keyof ReagentForm, value: string) => {
    setTestReagents(prev => prev.map((r, i) => (i === idx ? { ...r, [field]: value } : r)));
  };

  const removeParameter = (pIdx: number) => {
    setParameters(prev => {
      const removed = prev[pIdx];
      const next = prev.filter((_, i) => i !== pIdx);

      if (next.length === 0) {
        const newParam = emptyParam();
        setOpenParamId(newParam.id);
        return [newParam];
      }

      if (removed?.id === openParamId) {
        setOpenParamId(next[0].id);
      }

      return next;
    });
  };

  const removeRange = (pIdx: number, rIdx: number) => {
    setParameters(prev =>
      prev.map((p, pi) => {
        if (pi !== pIdx) return p;

        const nextRanges = p.ranges.filter((_, ri) => ri !== rIdx);
        return {
          ...p,
          ranges: nextRanges.length > 0 ? nextRanges : [emptyRange()],
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
          placeholder="Buscar prueba..."
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
                    <Badge variant="outline">{t.parameters?.length || 0}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">{Number(t.porcentaje_iva || 0).toFixed(2)}%</Badge>
                  </TableCell>
                  <TableCell className="font-bold text-primary">${Number(t.price).toFixed(2)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => setViewTest(t.id)}>
                        <Eye className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => openEdit(t)}>
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleDelete(t.id)}>
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
              <p className="text-sm text-muted-foreground">{selectedTest.description}</p>

              <div className="flex flex-wrap gap-2">
                <Badge variant="outline">IVA {Number(selectedTest.porcentaje_iva || 0).toFixed(2)}%</Badge>
                <Badge variant="outline">Código SRI {selectedTest.codigo_porcentaje_iva || '—'}</Badge>
                <Badge variant="outline">Objeto impuesto {selectedTest.objeto_impuesto || '—'}</Badge>
              </div>

              <p className="text-lg font-bold text-primary">Precio: ${Number(selectedTest.price).toFixed(2)}</p>

              <div>
                <h4 className="font-bold mb-3 flex items-center gap-2">
                  Parámetros <Badge variant="secondary">Ref</Badge>
                </h4>

                {(selectedTest.parameters || []).map((param: any) => (
                  <div key={param.id} className="mb-4 p-4 rounded-xl border bg-slate-50/50">
                    <p className="font-bold text-slate-700">
                      {param.name}{' '}
                      <span className="text-muted-foreground font-normal">({param.unit})</span>
                    </p>
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
                  </div>
                ))}
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
              {editingId ? 'Editar Configuración SQL' : 'Nueva Prueba'}
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
              <Textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Detalles de la prueba..." />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label className="font-semibold">Tarifa IVA *</Label>
                <Select value={porcentajeIva} onValueChange={setPorcentajeIva}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccione IVA" />
                  </SelectTrigger>
                  <SelectContent>
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
              <div className="flex items-center justify-between border-b pb-2">
                <h4 className="font-bold">Configuración de Parámetros</h4>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const newParam = emptyParam();
                    setParameters(prev => [newParam, ...prev]);
                    setOpenParamId(newParam.id);
                  }}
                >
                  <Plus className="w-3 h-3 mr-1" />
                  Parámetro
                </Button>
              </div>

              {parameters.map((param, pIdx) => {
                const isOpen = openParamId === param.id;

                return (
                  <div key={param.id} className="border-2 border-slate-100 rounded-2xl bg-slate-50/20 overflow-hidden">
                    <button
                      type="button"
                      className="w-full p-4 flex items-center justify-between text-left hover:bg-slate-100/60 transition"
                      onClick={() => toggleAccordion(param.id)}
                    >
                      <div className="pr-4">
                        <div className="text-xs font-bold uppercase text-slate-400 tracking-widest">
                          Parámetro #{pIdx + 1}
                        </div>
                        <div className="mt-1 font-semibold text-slate-700">
                          {param.name?.trim() || 'Nuevo parámetro'}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Unidad: {param.unit?.trim() || '—'} • Rangos: {param.ranges.length}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {parameters.length > 1 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-red-400"
                            onClick={e => {
                              e.stopPropagation();
                              removeParameter(pIdx);
                            }}
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        )}

                        {isOpen ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
                      </div>
                    </button>

                    {isOpen && (
                      <div className="px-4 pb-4 border-t bg-white/70">
                        <div className="grid grid-cols-2 gap-4 mb-4 mt-4">
                          <div>
                            <Label className="text-xs font-semibold">Nombre</Label>
                            <Input value={param.name} onChange={e => updateParam(pIdx, 'name', e.target.value)} />
                          </div>
                          <div>
                            <Label className="text-xs font-semibold">Unidad</Label>
                            <Input value={param.unit} onChange={e => updateParam(pIdx, 'unit', e.target.value)} />
                          </div>
                        </div>

                        <div className="space-y-2">
                          <div className="flex justify-between items-center">
                            <span className="text-xs font-bold text-slate-500">Rangos de Referencia</span>
                            <Button
                              type="button"
                              variant="ghost"
                              className="h-6 text-[10px]"
                              onClick={() => {
                                setParameters(prev =>
                                  prev.map((p, pi) =>
                                    pi === pIdx ? { ...p, ranges: [emptyRange(), ...p.ranges] } : p
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
                                <Select value={range.sex} onValueChange={v => updateRange(pIdx, rIdx, 'sex', v as any)}>
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
                                  onChange={e => updateRange(pIdx, rIdx, 'min_age', e.target.value)}
                                />
                              </div>

                              <div className="col-span-1">
                                <Label className="text-[10px]">Edad Máx</Label>
                                <Input
                                  className="h-8 text-xs"
                                  value={range.max_age}
                                  onChange={e => updateRange(pIdx, rIdx, 'max_age', e.target.value)}
                                />
                              </div>

                              <div className="col-span-1">
                                <Label className="text-[10px]">Val Mín</Label>
                                <Input
                                  className="h-8 text-xs"
                                  value={range.min_value}
                                  onChange={e => updateRange(pIdx, rIdx, 'min_value', e.target.value)}
                                />
                              </div>

                              <div className="col-span-1">
                                <Label className="text-[10px]">Val Máx</Label>
                                <Input
                                  className="h-8 text-xs"
                                  value={range.max_value}
                                  onChange={e => updateRange(pIdx, rIdx, 'max_value', e.target.value)}
                                />
                              </div>

                              <div className="col-span-1 text-right">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-red-300"
                                  onClick={() => removeRange(pIdx, rIdx)}
                                >
                                  <Trash2 className="w-3 h-3" />
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
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
              <Button onClick={handleSave} className="bg-primary px-10">
                Guardar la Prueba
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}