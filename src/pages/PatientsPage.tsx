import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Search, Edit, Trash2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';

export default function PatientsPage() {
  const [patients, setPatients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [form, setForm] = useState({
    name: '',
    cedula: '',
    phone: '',
    email: '',
    birth_date: '',
    sex: 'M' as 'M' | 'F',
    direccion: '',
  });

  const fetchPatients = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('pacientes')
        .select('*')
        .order('name', { ascending: true });

      if (error) throw error;
      setPatients(data || []);
    } catch (error: any) {
      toast.error('Error al cargar pacientes');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPatients();
  }, []);

  const filtered = patients.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.cedula.includes(search) ||
      (p.phone || '').includes(search) ||
      (p.email || '').toLowerCase().includes(search.toLowerCase()) ||
      (p.direccion || '').toLowerCase().includes(search.toLowerCase())
  );

  const openCreate = () => {
    setEditingId(null);
    setForm({
      name: '',
      cedula: '',
      phone: '',
      email: '',
      birth_date: '',
      sex: 'M',
      direccion: '',
    });
    setDialogOpen(true);
  };

  const openEdit = (p: any) => {
    setEditingId(p.id);
    setForm({
      name: p.name || '',
      cedula: p.cedula || '',
      phone: p.phone || '',
      email: p.email || '',
      birth_date: p.birth_date || '',
      sex: (p.sex as 'M' | 'F') || 'M',
      direccion: p.direccion || '',
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.name || !form.cedula || !form.birth_date) {
      return toast.error('Nombre, cédula y fecha de nacimiento son obligatorios');
    }

    try {
      const payload = {
        name: form.name.trim(),
        cedula: form.cedula.trim(),
        phone: form.phone.trim() || null,
        email: form.email.trim() || null,
        birth_date: form.birth_date,
        sex: form.sex,
        direccion: form.direccion.trim() || null,
      };

      if (editingId) {
        const { error } = await supabase
          .from('pacientes')
          .update(payload)
          .eq('id', editingId);

        if (error) throw error;
        toast.success('Paciente actualizado');
      } else {
        const { error } = await supabase
          .from('pacientes')
          .insert([payload]);

        if (error) throw error;
        toast.success('Paciente registrado');
      }

      setDialogOpen(false);
      fetchPatients();
    } catch (error: any) {
      toast.error(
        'Error: ' +
          (error.message?.includes('unique') || error.message?.includes('pacientes_cedula_key')
            ? 'La cédula ya existe'
            : error.message)
      );
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar este paciente? Esta acción no se puede deshacer.')) return;

    try {
      const { error } = await supabase.from('pacientes').delete().eq('id', id);
      if (error) throw error;
      toast.success('Paciente eliminado');
      fetchPatients();
    } catch (error: any) {
      toast.error('No se puede eliminar (podría tener órdenes asociadas)');
    }
  };

  const calcAge = (birthDate: string) => {
    if (!birthDate) return 0;
    const diff = Date.now() - new Date(birthDate).getTime();
    const age = Math.floor(diff / (365.25 * 24 * 60 * 60 * 1000));
    return isNaN(age) ? 0 : age;
  };

  if (loading) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-2">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Cargando base de datos de pacientes...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold">Pacientes</h1>
          <p className="text-muted-foreground text-sm">Registro y gestión de pacientes</p>
        </div>

        <Button onClick={openCreate} className="gradient-clinical text-primary-foreground border-0">
          <Plus className="w-4 h-4 mr-2" />
          Nuevo Paciente
        </Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
        <Input
          className="pl-10"
          placeholder="Buscar por nombre, cédula, teléfono, correo o dirección..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Cédula</TableHead>
                <TableHead className="hidden md:table-cell">Edad</TableHead>
                <TableHead className="hidden md:table-cell">Sexo</TableHead>
                <TableHead className="hidden lg:table-cell">Teléfono</TableHead>
                <TableHead className="hidden xl:table-cell">Dirección</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    No se encontraron pacientes
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium text-slate-700">{p.name}</TableCell>
                    <TableCell className="text-muted-foreground">{p.cedula}</TableCell>
                    <TableCell className="hidden md:table-cell">{calcAge(p.birth_date)} años</TableCell>
                    <TableCell className="hidden md:table-cell">
                      <Badge
                        variant="outline"
                        className={p.sex === 'M' ? 'text-blue-600' : 'text-pink-600'}
                      >
                        {p.sex === 'M' ? 'Masculino' : 'Femenino'}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">{p.phone || '—'}</TableCell>
                    <TableCell className="hidden xl:table-cell max-w-[260px] truncate">
                      {p.direccion || '—'}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(p)}>
                          <Edit className="w-4 h-4 text-blue-600" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(p.id)}>
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
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
        <DialogContent className="sm:max-w-[560px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display text-xl">
              {editingId ? 'Editar Paciente' : 'Nuevo Registro de Paciente'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label className="font-semibold text-xs uppercase tracking-wider">
                Nombre Completo *
              </Label>
              <Input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Nombres y Apellidos"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="font-semibold text-xs uppercase tracking-wider">Cédula *</Label>
                <Input
                  value={form.cedula}
                  onChange={(e) => setForm((f) => ({ ...f, cedula: e.target.value }))}
                  placeholder="ID única"
                />
              </div>
              <div className="space-y-2">
                <Label className="font-semibold text-xs uppercase tracking-wider">Teléfono</Label>
                <Input
                  value={form.phone}
                  onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                  placeholder="0987654321"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="font-semibold text-xs uppercase tracking-wider">
                Correo Electrónico
              </Label>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                placeholder="paciente@ejemplo.com"
              />
            </div>

            <div className="space-y-2">
              <Label className="font-semibold text-xs uppercase tracking-wider">Dirección</Label>
              <Textarea
                value={form.direccion}
                onChange={(e) => setForm((f) => ({ ...f, direccion: e.target.value }))}
                placeholder="Dirección del paciente"
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="font-semibold text-xs uppercase tracking-wider">
                  Fecha de Nacimiento *
                </Label>
                <Input
                  type="date"
                  value={form.birth_date}
                  onChange={(e) => setForm((f) => ({ ...f, birth_date: e.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label className="font-semibold text-xs uppercase tracking-wider">Sexo *</Label>
                <Select
                  value={form.sex}
                  onValueChange={(v: 'M' | 'F') => setForm((f) => ({ ...f, sex: v }))}
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

            <Button
              onClick={handleSave}
              className="w-full gradient-clinical text-primary-foreground border-0 h-11 mt-4"
            >
              {editingId ? 'Guardar Cambios' : 'Registrar Paciente'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}