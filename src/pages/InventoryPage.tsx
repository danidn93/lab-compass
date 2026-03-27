import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient'; // Asegúrate de tener configurado tu cliente
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Search, Edit, Trash2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function InventoryPage() {
  const [reagents, setReagents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  // Estado del formulario alineado a las columnas SQL
  const [form, setForm] = useState({
    name: '',
    code: '',
    current_stock: 0,
    min_stock: 10,
    expiration_date: '',
    supplier: ''
  });

  // --- Carga de datos reales ---
  const fetchReagents = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('reactivos')
        .select('*')
        .order('name', { ascending: true });

      if (error) throw error;
      setReagents(data || []);
    } catch (error: any) {
      toast.error('Error al cargar inventario: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReagents();
  }, []);

  const filtered = reagents.filter(r => 
    r.name.toLowerCase().includes(search.toLowerCase()) || 
    r.code.toLowerCase().includes(search.toLowerCase())
  );

  const openCreate = () => {
    setEditingId(null);
    setForm({ name: '', code: '', current_stock: 0, min_stock: 10, expiration_date: '', supplier: '' });
    setDialogOpen(true);
  };

  const openEdit = (r: any) => {
    setEditingId(r.id);
    setForm({
      name: r.name,
      code: r.code,
      current_stock: r.current_stock,
      min_stock: r.min_stock,
      expiration_date: r.expiration_date,
      supplier: r.supplier
    });
    setDialogOpen(true);
  };

  // --- Lógica de Guardado en SQL ---
  const handleSave = async () => {
    if (!form.name || !form.code) return toast.error('Nombre y código son obligatorios');

    try {
      if (editingId) {
        // Actualizar reactivo existente
        const { error } = await supabase
          .from('reactivos')
          .update({
            name: form.name,
            code: form.code,
            current_stock: form.current_stock,
            min_stock: form.min_stock,
            expiration_date: form.expiration_date,
            supplier: form.supplier
          })
          .eq('id', editingId);

        if (error) throw error;
        toast.success('Reactivo actualizado');
      } else {
        // Crear nuevo reactivo
        const { data: newReagent, error: createError } = await supabase
          .from('reactivos')
          .insert([{
            name: form.name,
            code: form.code,
            current_stock: form.current_stock,
            min_stock: form.min_stock,
            expiration_date: form.expiration_date,
            supplier: form.supplier
          }])
          .select()
          .single();

        if (createError) throw createError;

        // Registrar movimiento inicial en la tabla 'movimientos_inventario'
        await supabase.from('movimientos_inventario').insert([{
          reagent_id: newReagent.id,
          type: 'entry',
          quantity: form.current_stock,
          reason: 'Stock inicial (Registro nuevo)'
        }]);

        toast.success('Reactivo registrado con éxito');
      }

      setDialogOpen(false);
      fetchReagents();
    } catch (error: any) {
      toast.error('Error en la operación: ' + error.message);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Estás seguro de eliminar este reactivo? Esto podría fallar si está vinculado a pruebas.')) return;
    
    try {
      const { error } = await supabase.from('reactivos').delete().eq('id', id);
      if (error) throw error;
      toast.success('Reactivo eliminado');
      fetchReagents();
    } catch (error: any) {
      toast.error('No se pudo eliminar: ' + error.message);
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-2">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Conectando al almacén SQL...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold">Inventario de Reactivos</h1>
          <p className="text-muted-foreground text-sm">Gestión de stock y proveedores</p>
        </div>
        <Button onClick={openCreate} className="gradient-clinical text-primary-foreground border-0">
          <Plus className="w-4 h-4 mr-2" /> Nuevo Reactivo
        </Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
        <Input className="pl-10" placeholder="Buscar por nombre o código..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Código</TableHead>
                <TableHead>Stock</TableHead>
                <TableHead className="hidden md:table-cell">Vencimiento</TableHead>
                <TableHead className="hidden md:table-cell">Proveedor</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No se encontraron reactivos</TableCell>
                </TableRow>
              ) : (
                filtered.map(r => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium text-slate-700">{r.name}</TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">{r.code}</TableCell>
                    <TableCell>
                      <Badge variant={r.current_stock <= r.min_stock ? 'destructive' : 'secondary'}>
                        {r.current_stock}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">{r.expiration_date}</TableCell>
                    <TableCell className="hidden md:table-cell text-sm">{r.supplier}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(r)}><Edit className="w-4 h-4 text-blue-600" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(r.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-xl">
              {editingId ? 'Editar Reactivo' : 'Registrar Nuevo Reactivo'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase">Nombre</Label>
                <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Ej: Buffer pH 7" />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase">Código</Label>
                <Input value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value }))} placeholder="REA-001" />
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase">Stock Actual</Label>
                <Input type="number" value={form.current_stock} onChange={e => setForm(f => ({ ...f, current_stock: Number(e.target.value) }))} />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase">Mínimo Alerta</Label>
                <Input type="number" value={form.min_stock} onChange={e => setForm(f => ({ ...f, min_stock: Number(e.target.value) }))} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase">Fecha Vencimiento</Label>
                <Input type="date" value={form.expiration_date} onChange={e => setForm(f => ({ ...f, expiration_date: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase">Proveedor</Label>
                <Input value={form.supplier} onChange={e => setForm(f => ({ ...f, supplier: e.target.value }))} placeholder="Nombre distribuidor" />
              </div>
            </div>

            <Button onClick={handleSave} className="w-full gradient-clinical text-primary-foreground border-0 h-11 mt-4">
              {editingId ? 'Guardar Cambios' : 'Confirmar Registro'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}