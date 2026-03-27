import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { FileText, FlaskConical, Loader2, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

export default function ResultsPage() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [entryDialogOpen, setEntryDialogOpen] = useState(false);
  const [entryValues, setEntryValues] = useState<Record<string, number>>({});
  const [orderDetails, setOrderDetails] = useState<any>(null);

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('ordenes')
      .select('*, pacientes(*)')
      .order('created_at', { ascending: false });
    setOrders(data || []);
    setLoading(false);
  };

  const calcAge = (birthDate: string) => {
    if (!birthDate) return 0;
    const diff = Date.now() - new Date(birthDate).getTime();
    return Math.floor(diff / (365.25 * 24 * 60 * 60 * 1000));
  };

  const openEntry = async (order: any) => {
    setSelectedOrderId(order.id);
    setEntryValues({});
    
    // Cargar pruebas de la orden con sus parámetros y rangos
    const { data: details, error } = await supabase
      .from('orden_detalle')
      .select(`
        test_id,
        pruebas (
          id, name,
          parametros_prueba (
            id, name, unit,
            rangos_referencia (*)
          )
        )
      `)
      .eq('order_id', order.id);

    if (error) return toast.error("Error al cargar parámetros");
    
    setOrderDetails({ ...order, tests: details.map(d => d.pruebas) });
    setEntryDialogOpen(true);
  };

  const getAppliedRange = (parameter: any, patient: any) => {
    const age = calcAge(patient.birth_date);
    const range = parameter.rangos_referencia.find((r: any) => 
      (r.sex === 'both' || r.sex === patient.sex) && 
      age >= r.min_age && age <= r.max_age
    );
    return range ? { min: Number(range.min_value), max: Number(range.max_value) } : null;
  };

  const classifyValue = (value: number, range: any): 'normal' | 'high' | 'low' => {
    if (!range) return 'normal';
    if (value < range.min) return 'low';
    if (value > range.max) return 'high';
    return 'normal';
  };

  const handleSaveResults = async () => {
    try {
      // 1. Crear registro principal en 'resultados' por cada prueba de la orden
      for (const test of orderDetails.tests) {
        const { data: resultDoc, error: resError } = await supabase
          .from('resultados')
          .insert([{
            order_id: selectedOrderId,
            test_id: test.id,
            date: new Date().toISOString().split('T')[0]
          }])
          .select()
          .single();

        if (resError) throw resError;

        // 2. Insertar los valores en 'resultado_detalle'
        const detailsToInsert = test.parametros_prueba.map((param: any) => {
          const value = entryValues[param.id] || 0;
          const range = getAppliedRange(param, orderDetails.pacientes);
          return {
            result_id: resultDoc.id,
            parameter_id: param.id,
            value: value,
            status: classifyValue(value, range),
            applied_range_min: range?.min,
            applied_range_max: range?.max
          };
        });

        const { error: detError } = await supabase.from('resultado_detalle').insert(detailsToInsert);
        if (detError) throw detError;
      }

      // 3. Actualizar estado de la orden
      await supabase.from('ordenes').update({ status: 'completed' }).eq('id', selectedOrderId);

      toast.success('Resultados guardados exitosamente');
      setEntryDialogOpen(false);
      fetchOrders();
    } catch (error: any) {
      toast.error('Error al guardar: ' + error.message);
    }
  };

  const pendingOrders = orders.filter(o => o.status !== 'completed');
  const completedOrders = orders.filter(o => o.status === 'completed');

  if (loading) return <div className="flex h-64 items-center justify-center"><Loader2 className="animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-display font-bold">Resultados de Laboratorio</h1>
        <p className="text-muted-foreground text-sm">Validación técnica y registro de valores</p>
      </div>

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
                <div key={order.id} className="flex items-center justify-between p-4 rounded-xl bg-white border border-amber-100 shadow-sm">
                  <div>
                    <p className="font-bold text-slate-700">{order.code} — {order.pacientes?.name}</p>
                    <p className="text-xs text-muted-foreground">Recibido: {new Date(order.created_at).toLocaleDateString()}</p>
                  </div>
                  <Button size="sm" onClick={() => openEntry(order)} className="gradient-clinical text-primary-foreground border-0">
                    Ingresar Valores
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-3 border-b border-slate-50">
          <CardTitle className="text-lg font-display">Historial de Resultados</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Orden</TableHead>
                <TableHead>Paciente</TableHead>
                <TableHead className="hidden md:table-cell">Fecha Emisión</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Reporte</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {completedOrders.map(order => (
                <TableRow key={order.id}>
                  <TableCell className="font-mono font-bold text-slate-600">{order.code}</TableCell>
                  <TableCell className="text-sm">{order.pacientes?.name}</TableCell>
                  <TableCell className="hidden md:table-cell text-xs">{new Date(order.created_at).toLocaleDateString()}</TableCell>
                  <TableCell>
                    <Badge className="bg-emerald-50 text-emerald-700 border-emerald-100 flex w-fit items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> Validado
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" className="text-blue-600">
                      <FileText className="w-4 h-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={entryDialogOpen} onOpenChange={setEntryDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display text-xl text-primary">Ingreso Técnico de Resultados</DialogTitle>
            {orderDetails && (
              <div className="flex gap-4 mt-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <span>Paciente: {orderDetails.pacientes.name}</span>
                <span>Edad: {calcAge(orderDetails.pacientes.birth_date)} años</span>
                <span>Sexo: {orderDetails.pacientes.sex}</span>
              </div>
            )}
          </DialogHeader>
          
          <div className="space-y-8 mt-4">
            {orderDetails?.tests.map((test: any) => (
              <div key={test.id} className="space-y-4 border-l-4 border-primary/20 pl-4">
                <h3 className="font-display font-bold text-lg text-slate-800 underline decoration-primary/30 underline-offset-4">
                  {test.name}
                </h3>
                <div className="space-y-4">
                  {test.parametros_prueba.map((param: any) => {
                    const range = getAppliedRange(param, orderDetails.pacientes);
                    const value = entryValues[param.id];
                    const status = value !== undefined ? classifyValue(value, range) : null;
                    
                    return (
                      <div key={param.id} className="grid grid-cols-12 gap-4 items-center bg-slate-50/50 p-3 rounded-lg border border-slate-100">
                        <div className="col-span-5">
                          <Label className="text-sm font-bold text-slate-700">{param.name}</Label>
                          <div className="flex gap-2 text-[10px] font-mono text-slate-500">
                            <span>Unidad: {param.unit}</span>
                            {range && <span>Ref: [{range.min} - {range.max}]</span>}
                          </div>
                        </div>
                        <div className="col-span-4">
                          <Input
                            type="number"
                            className="bg-white border-slate-200"
                            placeholder="0.00"
                            value={entryValues[param.id] || ''}
                            onChange={e => setEntryValues(prev => ({ ...prev, [param.id]: Number(e.target.value) }))}
                          />
                        </div>
                        <div className="col-span-3">
                          {status && (
                            <Badge className={`w-full justify-center ${
                              status === 'normal' ? 'bg-emerald-500' : 'bg-rose-500'
                            } text-white border-0 shadow-sm`}>
                              {status === 'normal' ? 'NORMAL' : status === 'high' ? 'ALTO ↑' : 'BAJO ↓'}
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
              className="w-full gradient-clinical text-primary-foreground border-0 h-12 text-lg shadow-lg mt-6"
            >
              Validar y Finalizar Orden
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}