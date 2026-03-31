import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  Loader2,
  Plus,
  Search,
  Pencil,
  Power,
  Stethoscope,
} from 'lucide-react';
import { toast } from 'sonner';

type DoctorForm = {
  nombre: string;
  especialidad: string;
  telefono: string;
  email: string;
  activo: boolean;
};

const initialForm: DoctorForm = {
  nombre: '',
  especialidad: '',
  telefono: '',
  email: '',
  activo: true,
};

export default function DoctorsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [doctors, setDoctors] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingDoctor, setEditingDoctor] = useState<any | null>(null);
  const [form, setForm] = useState<DoctorForm>(initialForm);

  useEffect(() => {
    fetchDoctors();
  }, []);

  const fetchDoctors = async () => {
    try {
      setLoading(true);

      const { data, error } = await supabase
        .from('doctores')
        .select('*')
        .order('nombre');

      if (error) throw error;

      setDoctors(data || []);
    } catch (error: any) {
      toast.error('Error al cargar doctores: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const filteredDoctors = useMemo(() => {
    const q = search.trim().toLowerCase();

    if (!q) return doctors;

    return doctors.filter((doctor) => {
      const nombre = String(doctor.nombre || '').toLowerCase();
      const especialidad = String(doctor.especialidad || '').toLowerCase();
      const telefono = String(doctor.telefono || '').toLowerCase();
      const email = String(doctor.email || '').toLowerCase();

      return (
        nombre.includes(q) ||
        especialidad.includes(q) ||
        telefono.includes(q) ||
        email.includes(q)
      );
    });
  }, [doctors, search]);

  const openCreateDialog = () => {
    setEditingDoctor(null);
    setForm(initialForm);
    setDialogOpen(true);
  };

  const openEditDialog = (doctor: any) => {
    setEditingDoctor(doctor);
    setForm({
      nombre: doctor.nombre || '',
      especialidad: doctor.especialidad || '',
      telefono: doctor.telefono || '',
      email: doctor.email || '',
      activo: !!doctor.activo,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.nombre.trim()) {
      toast.error('El nombre del médico es obligatorio');
      return;
    }

    try {
      setSaving(true);

      const payload = {
        nombre: form.nombre.trim(),
        especialidad: form.especialidad.trim() || null,
        telefono: form.telefono.trim() || null,
        email: form.email.trim() || null,
        activo: form.activo,
      };

      if (editingDoctor) {
        const { error } = await supabase
          .from('doctores')
          .update(payload)
          .eq('id', editingDoctor.id);

        if (error) throw error;

        toast.success('Médico actualizado');
      } else {
        const { error } = await supabase.from('doctores').insert([payload]);

        if (error) throw error;

        toast.success('Médico registrado');
      }

      setDialogOpen(false);
      await fetchDoctors();
    } catch (error: any) {
      toast.error('Error al guardar médico: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (doctor: any) => {
    try {
      const { error } = await supabase
        .from('doctores')
        .update({ activo: !doctor.activo })
        .eq('id', doctor.id);

      if (error) throw error;

      toast.success(
        !doctor.activo ? 'Médico activado correctamente' : 'Médico desactivado correctamente'
      );

      await fetchDoctors();
    } catch (error: any) {
      toast.error('Error al cambiar estado: ' + error.message);
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold">Médicos</h1>
          <p className="text-muted-foreground text-sm">
            Administración de médicos solicitantes
          </p>
        </div>

        <Button
          onClick={openCreateDialog}
          className="gradient-clinical text-primary-foreground border-0"
        >
          <Plus className="w-4 h-4 mr-2" />
          Nuevo médico
        </Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
        <Input
          className="pl-10"
          placeholder="Buscar médico..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <Card>
        <CardContent className="p-4 space-y-3">
          {filteredDoctors.length > 0 ? (
            filteredDoctors.map((doctor) => (
              <div
                key={doctor.id}
                className="rounded-2xl border bg-white p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Stethoscope className="w-4 h-4 text-primary" />
                    <span className="font-semibold text-slate-800">{doctor.nombre}</span>
                    <Badge variant={doctor.activo ? 'default' : 'secondary'}>
                      {doctor.activo ? 'Activo' : 'Inactivo'}
                    </Badge>
                  </div>

                  <div className="text-sm text-muted-foreground">
                    {doctor.especialidad || 'Sin especialidad'}
                  </div>

                  <div className="text-xs text-muted-foreground">
                    {doctor.telefono || 'Sin teléfono'}
                    {doctor.email ? ` • ${doctor.email}` : ''}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button variant="outline" onClick={() => openEditDialog(doctor)}>
                    <Pencil className="w-4 h-4 mr-2" />
                    Editar
                  </Button>

                  <Button variant="outline" onClick={() => toggleActive(doctor)}>
                    <Power className="w-4 h-4 mr-2" />
                    {doctor.activo ? 'Desactivar' : 'Activar'}
                  </Button>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-10 text-muted-foreground">
              No se encontraron médicos
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[560px]">
          <DialogHeader>
            <DialogTitle className="font-display text-xl">
              {editingDoctor ? 'Editar médico' : 'Nuevo médico'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label className="font-semibold text-xs uppercase tracking-wider">
                Nombre completo *
              </Label>
              <Input
                value={form.nombre}
                onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))}
                placeholder="Nombre del médico"
              />
            </div>

            <div className="space-y-2">
              <Label className="font-semibold text-xs uppercase tracking-wider">
                Especialidad
              </Label>
              <Input
                value={form.especialidad}
                onChange={(e) => setForm((f) => ({ ...f, especialidad: e.target.value }))}
                placeholder="Especialidad"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="font-semibold text-xs uppercase tracking-wider">
                  Teléfono
                </Label>
                <Input
                  value={form.telefono}
                  onChange={(e) => setForm((f) => ({ ...f, telefono: e.target.value }))}
                  placeholder="0999999999"
                />
              </div>

              <div className="space-y-2">
                <Label className="font-semibold text-xs uppercase tracking-wider">
                  Correo
                </Label>
                <Input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  placeholder="doctor@correo.com"
                />
              </div>
            </div>

            <Button
              onClick={handleSave}
              className="w-full gradient-clinical text-primary-foreground border-0 h-11"
              disabled={saving}
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Guardando...
                </>
              ) : editingDoctor ? (
                'Actualizar médico'
              ) : (
                'Registrar médico'
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}