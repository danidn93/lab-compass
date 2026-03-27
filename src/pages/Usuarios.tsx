import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import {
  UserPlus,
  Search,
  Shield,
  ShieldOff,
  Trash2,
  Edit2,
  RefreshCw,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import bcrypt from 'bcryptjs';

type UserRole = 'admin' | 'laboratorist';

interface Usuario {
  id: string;
  username: string;
  name: string;
  role: UserRole;
  two_factor_enabled: boolean;
  created_at: string;
}

export default function Usuarios() {
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const [formData, setFormData] = useState({
    id: '',
    username: '',
    name: '',
    password: '',
    role: 'laboratorist' as UserRole,
  });

  useEffect(() => {
    fetchUsuarios();
  }, []);

  const resetForm = () => {
    setFormData({
      id: '',
      username: '',
      name: '',
      password: '',
      role: 'laboratorist',
    });
  };

  const fetchUsuarios = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('usuarios')
        .select('id, username, name, role, two_factor_enabled, created_at')
        .order('created_at', { ascending: false });

      if (error) throw error;

      const typedData: Usuario[] = (data || []).map((u: any) => ({
        id: u.id,
        username: u.username,
        name: u.name,
        role: u.role as UserRole,
        two_factor_enabled: !!u.two_factor_enabled,
        created_at: u.created_at,
      }));

      setUsuarios(typedData);
    } catch (error: any) {
      toast.error('Error al cargar usuarios: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleReset2FA = async (id: string) => {
    const confirmReset = window.confirm(
      '¿Estás seguro de resetear el Doble Factor? El usuario deberá vincular su app nuevamente.'
    );
    if (!confirmReset) return;

    const { error } = await supabase
      .from('usuarios')
      .update({
        two_factor_enabled: false,
        two_factor_secret: null,
      })
      .eq('id', id);

    if (error) {
      toast.error('No se pudo resetear el 2FA');
    } else {
      toast.success('2FA reseteado correctamente');
      fetchUsuarios();
    }
  };

  const handleDelete = async (id: string) => {
    const confirmDelete = window.confirm('¿Eliminar este usuario permanentemente?');
    if (!confirmDelete) return;

    const { error } = await supabase.from('usuarios').delete().eq('id', id);

    if (error) {
      toast.error('Error al eliminar');
    } else {
      toast.success('Usuario eliminado');
      fetchUsuarios();
    }
  };

  const validarFormulario = () => {
    if (!formData.name.trim()) {
      toast.error('El nombre es obligatorio');
      return false;
    }

    if (!formData.username.trim()) {
      toast.error('El nombre de usuario es obligatorio');
      return false;
    }

    if (!formData.id && !formData.password.trim()) {
      toast.error('La contraseña es obligatoria');
      return false;
    }

    if (formData.password && formData.password.length < 4) {
      toast.error('La contraseña debe tener al menos 4 caracteres');
      return false;
    }

    return true;
  };

  const existeUsernameDuplicado = async () => {
    const query = supabase
      .from('usuarios')
      .select('id, username')
      .eq('username', formData.username.trim());

    const { data, error } = formData.id
      ? await query.neq('id', formData.id)
      : await query;

    if (error) throw error;

    return (data || []).length > 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validarFormulario()) return;

    setSaving(true);

    try {
      const username = formData.username.trim();
      const name = formData.name.trim();

      const duplicado = await existeUsernameDuplicado();
      if (duplicado) {
        toast.error('Ya existe un usuario con ese nombre de usuario');
        return;
      }

      if (formData.id) {
        const updatePayload: any = {
          username,
          name,
          role: formData.role,
        };

        if (formData.password.trim()) {
          const hashedPassword = await bcrypt.hash(formData.password, 10);
          updatePayload.password_hash = hashedPassword;
        }

        const { error } = await supabase
          .from('usuarios')
          .update(updatePayload)
          .eq('id', formData.id);

        if (error) throw error;

        toast.success('Usuario actualizado');
      } else {
        const hashedPassword = await bcrypt.hash(formData.password, 10);

        const { error } = await supabase
          .from('usuarios')
          .insert({
            username,
            name,
            role: formData.role,
            password_hash: hashedPassword,
          });

        if (error) throw error;

        toast.success('Usuario creado exitosamente');
      }

      setIsDialogOpen(false);
      resetForm();
      fetchUsuarios();
    } catch (error: any) {
      toast.error('Error: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const filteredUsuarios = usuarios.filter((u) =>
    u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.username.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Personal del Laboratorio</h1>
          <p className="text-muted-foreground">Administra accesos y seguridad.</p>
        </div>

        <Dialog
          open={isDialogOpen}
          onOpenChange={(open) => {
            setIsDialogOpen(open);
            if (!open) resetForm();
          }}
        >
          <DialogTrigger asChild>
            <Button
              className="gradient-clinical"
              onClick={() => {
                resetForm();
              }}
            >
              <UserPlus className="w-4 h-4 mr-2" />
              Nuevo Usuario
            </Button>
          </DialogTrigger>

          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>
                {formData.id ? 'Editar Perfil' : 'Registro de Personal'}
              </DialogTitle>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="space-y-4 pt-4">
              <div className="grid gap-2">
                <label className="text-sm font-medium">Nombre Completo</label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Ej: Dr. Juan Pérez"
                  required
                />
              </div>

              <div className="grid gap-2">
                <label className="text-sm font-medium">Nombre de Usuario</label>
                <Input
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  placeholder="jperez"
                  required
                />
              </div>

              <div className="grid gap-2">
                <label className="text-sm font-medium">
                  Contraseña {formData.id ? '(Opcional)' : ''}
                </label>
                <Input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  placeholder={formData.id ? 'Solo escribe si deseas cambiarla' : '********'}
                  required={!formData.id}
                />
              </div>

              <div className="grid gap-2">
                <label className="text-sm font-medium">Rol de Acceso</label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  value={formData.role}
                  onChange={(e) =>
                    setFormData({ ...formData, role: e.target.value as UserRole })
                  }
                >
                  <option value="laboratorist">Laboratorista</option>
                  <option value="admin">Administrador</option>
                </select>
              </div>

              <Button type="submit" className="w-full gradient-clinical" disabled={saving}>
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Guardando...
                  </>
                ) : formData.id ? (
                  'Actualizar Datos'
                ) : (
                  'Registrar Usuario'
                )}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex items-center relative max-w-sm">
        <Search className="absolute left-3 w-4 h-4 text-muted-foreground" />
        <Input
          className="pl-10"
          placeholder="Buscar personal..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <div className="rounded-xl border shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>Usuario</TableHead>
              <TableHead>Rol</TableHead>
              <TableHead>Seguridad 2FA</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-10">
                  Sincronizando con base de datos...
                </TableCell>
              </TableRow>
            ) : filteredUsuarios.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-10 text-muted-foreground">
                  No se encontraron usuarios.
                </TableCell>
              </TableRow>
            ) : (
              filteredUsuarios.map((u) => (
                <TableRow key={u.id}>
                  <TableCell className="font-medium">{u.name}</TableCell>
                  <TableCell>{u.username}</TableCell>
                  <TableCell>
                    <Badge variant={u.role === 'admin' ? 'default' : 'secondary'}>
                      {u.role === 'admin' ? 'Admin' : 'Personal'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {u.two_factor_enabled ? (
                      <Badge
                        variant="outline"
                        className="text-green-600 border-green-200 bg-green-50"
                      >
                        <Shield className="w-3 h-3 mr-1" />
                        Protegido
                      </Badge>
                    ) : (
                      <Badge
                        variant="outline"
                        className="text-muted-foreground border-slate-200 bg-slate-50"
                      >
                        <ShieldOff className="w-3 h-3 mr-1" />
                        Vulnerable
                      </Badge>
                    )}
                  </TableCell>

                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      {u.two_factor_enabled && (
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-8 w-8 text-amber-600 hover:text-amber-700"
                          title="Resetear Doble Factor"
                          onClick={() => handleReset2FA(u.id)}
                        >
                          <RefreshCw className="h-4 w-4" />
                        </Button>
                      )}

                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => {
                          setFormData({
                            id: u.id,
                            name: u.name,
                            username: u.username,
                            password: '',
                            role: u.role,
                          });
                          setIsDialogOpen(true);
                        }}
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>

                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:bg-destructive/10"
                        onClick={() => handleDelete(u.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}