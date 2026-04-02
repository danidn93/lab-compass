import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Search, Edit, Trash2, Loader2, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import * as OTPAuth from 'otpauth';

type PatientForm = {
  name: string;
  cedula: string;
  phone: string;
  email: string;
  birth_date: string;
  sex: 'M' | 'F';
  direccion: string;
};

type AuthUser = {
  id: string;
  username: string;
  name?: string;
  role?: string;
};

export default function PatientsPage() {
  const { user } = useAuth() as { user: AuthUser | null };

  const [patients, setPatients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [otpDialogOpen, setOtpDialogOpen] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState<PatientForm>({
    name: '',
    cedula: '',
    phone: '',
    email: '',
    birth_date: '',
    sex: 'M',
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

  const getBrowserName = (ua: string) => {
    if (/Edg/i.test(ua)) return 'Microsoft Edge';
    if (/OPR|Opera/i.test(ua)) return 'Opera';
    if (/Chrome/i.test(ua) && !/Edg/i.test(ua)) return 'Chrome';
    if (/Safari/i.test(ua) && !/Chrome/i.test(ua)) return 'Safari';
    if (/Firefox/i.test(ua)) return 'Firefox';
    if (/MSIE|Trident/i.test(ua)) return 'Internet Explorer';
    return 'Desconocido';
  };

  const getOSName = (ua: string) => {
    if (/Windows NT/i.test(ua)) return 'Windows';
    if (/Mac OS X/i.test(ua)) return 'macOS';
    if (/Android/i.test(ua)) return 'Android';
    if (/iPhone|iPad|iPod/i.test(ua)) return 'iOS';
    if (/Linux/i.test(ua)) return 'Linux';
    return 'Desconocido';
  };

  const getDeviceType = (ua: string) => {
    if (/iPad|Tablet/i.test(ua)) return 'Tablet';
    if (/Mobi|Android|iPhone|iPod/i.test(ua)) return 'Móvil';
    return 'Escritorio';
  };

  const getDeviceName = () => {
    const ua = navigator.userAgent;
    const browser = getBrowserName(ua);
    const os = getOSName(ua);
    const deviceType = getDeviceType(ua);
    return `${deviceType} - ${os} - ${browser}`;
  };

  const getPublicIp = async (): Promise<string | null> => {
    try {
      const response = await fetch('https://api.ipify.org?format=json');
      if (!response.ok) return null;
      const data = await response.json();
      return data?.ip || null;
    } catch {
      return null;
    }
  };

  const registrarLogAcceso = async (
    evento: string,
    detallesExtra?: Record<string, any>,
    usuarioId?: string | null
  ) => {
    try {
      const userAgent = navigator.userAgent || null;
      const ip = await getPublicIp();

      const detalles = {
        nombre_dispositivo: getDeviceName(),
        navegador: getBrowserName(userAgent || ''),
        sistema_operativo: getOSName(userAgent || ''),
        tipo_dispositivo: getDeviceType(userAgent || ''),
        ...detallesExtra,
      };

      await supabase.from('logs_acceso').insert({
        usuario_id: usuarioId || user?.id || null,
        evento,
        ip_address: ip,
        user_agent: userAgent,
        detalles,
      });
    } catch (error) {
      console.error('Error registrando log:', error);
    }
  };

  const buildPayload = () => ({
    name: form.name.trim(),
    cedula: form.cedula.trim(),
    phone: form.phone.trim() || null,
    email: form.email.trim() || null,
    birth_date: form.birth_date,
    sex: form.sex,
    direccion: form.direccion.trim() || null,
  });

  const validateForm = () => {
    if (!form.name || !form.cedula || !form.birth_date) {
      toast.error('Nombre, cédula y fecha de nacimiento son obligatorios');
      return false;
    }
    return true;
  };

  const handleSave = async () => {
    if (!validateForm()) return;

    if (!editingId) {
      try {
        setSaving(true);

        const payload = buildPayload();

        const { error } = await supabase.from('pacientes').insert([payload]);
        if (error) throw error;

        await registrarLogAcceso('PACIENTE_CREADO', {
          paciente_nombre: payload.name,
          paciente_cedula: payload.cedula,
        });

        toast.success('Paciente registrado');
        setDialogOpen(false);
        fetchPatients();
      } catch (error: any) {
        toast.error(
          'Error: ' +
            (error.message?.includes('unique') || error.message?.includes('pacientes_cedula_key')
              ? 'La cédula ya existe'
              : error.message)
        );
      } finally {
        setSaving(false);
      }

      return;
    }

    if (!user?.id) {
      toast.error('No se pudo identificar al usuario actual');
      return;
    }

    setOtpCode('');
    setOtpDialogOpen(true);
  };

  const handleConfirmEditWithOtp = async () => {
    if (!editingId) return;
    if (!user?.id) {
      toast.error('No se pudo identificar al usuario actual');
      return;
    }
    if (!otpCode || otpCode.length !== 6) {
      toast.error('Ingresa el código de 6 dígitos');
      return;
    }

    try {
      setSaving(true);

      const { data: authUser, error: authError } = await supabase
        .from('usuarios')
        .select('id, username, two_factor_enabled, two_factor_secret')
        .eq('id', user.id)
        .maybeSingle();

      if (authError) throw authError;
      if (!authUser) throw new Error('Usuario actual no encontrado');
      if (!authUser.two_factor_enabled || !authUser.two_factor_secret) {
        throw new Error('El usuario no tiene doble factor configurado');
      }

      const totp = new OTPAuth.TOTP({
        issuer: 'BioAnalítica',
        label: authUser.username,
        algorithm: 'SHA1',
        digits: 6,
        period: 30,
        secret: authUser.two_factor_secret,
      });

      const delta = totp.validate({ token: otpCode, window: 1 });

      if (delta === null) {
        await registrarLogAcceso('OTP_RECONFIRMACION_FALLIDA_EDICION_PACIENTE', {
          editing_id: editingId,
          paciente_cedula: form.cedula.trim(),
          paciente_nombre: form.name.trim(),
        });

        toast.error('Código incorrecto o expirado');
        return;
      }

      const payload = buildPayload();

      const pacienteAnterior = patients.find((p) => p.id === editingId);

      const { error } = await supabase
        .from('pacientes')
        .update(payload)
        .eq('id', editingId);

      if (error) throw error;

      await registrarLogAcceso('PACIENTE_EDITADO_CON_2FA', {
        paciente_id: editingId,
        antes: pacienteAnterior
          ? {
              name: pacienteAnterior.name || null,
              cedula: pacienteAnterior.cedula || null,
              phone: pacienteAnterior.phone || null,
              email: pacienteAnterior.email || null,
              birth_date: pacienteAnterior.birth_date || null,
              sex: pacienteAnterior.sex || null,
              direccion: pacienteAnterior.direccion || null,
            }
          : null,
        despues: payload,
      });

      toast.success('Paciente actualizado');
      setOtpDialogOpen(false);
      setDialogOpen(false);
      setOtpCode('');
      fetchPatients();
    } catch (error: any) {
      toast.error(
        'Error: ' +
          (error.message?.includes('unique') || error.message?.includes('pacientes_cedula_key')
            ? 'La cédula ya existe'
            : error.message)
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar este paciente? Esta acción no se puede deshacer.')) return;

    try {
      const paciente = patients.find((p) => p.id === id);

      const { error } = await supabase.from('pacientes').delete().eq('id', id);
      if (error) throw error;

      await registrarLogAcceso('PACIENTE_ELIMINADO', {
        paciente_id: id,
        paciente_nombre: paciente?.name || null,
        paciente_cedula: paciente?.cedula || null,
      });

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
              disabled={saving}
              className="w-full gradient-clinical text-primary-foreground border-0 h-11 mt-4"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Procesando...
                </>
              ) : editingId ? (
                'Guardar Cambios'
              ) : (
                'Registrar Paciente'
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={otpDialogOpen} onOpenChange={setOtpDialogOpen}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle className="font-display text-xl flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-primary" />
              Confirmación de seguridad
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            <p className="text-sm text-muted-foreground">
              Para guardar cambios en los datos del paciente, ingresa nuevamente tu código de
              autenticación de 6 dígitos.
            </p>

            <div className="space-y-2">
              <Label className="font-semibold text-xs uppercase tracking-wider">
                Código 2FA
              </Label>
              <Input
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000"
                className="text-center text-2xl tracking-[0.3em] font-mono"
                autoFocus
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Button
                variant="outline"
                onClick={() => {
                  setOtpDialogOpen(false);
                  setOtpCode('');
                }}
                disabled={saving}
              >
                Cancelar
              </Button>

              <Button
                onClick={handleConfirmEditWithOtp}
                disabled={saving}
                className="gradient-clinical text-primary-foreground border-0"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Verificando...
                  </>
                ) : (
                  'Verificar y Guardar'
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}