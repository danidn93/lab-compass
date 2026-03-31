import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Loader2, Search, Stethoscope, ClipboardList } from 'lucide-react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { toast } from 'sonner';

function safeNumber(value: any, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function round2(value: number): number {
  return Number(value.toFixed(2));
}

export default function OrdersByDoctorPage() {
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [doctors, setDoctors] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);

      const [doctorsRes, ordersRes] = await Promise.all([
        supabase
          .from('doctores')
          .select('*')
          .order('nombre'),

        supabase
          .from('ordenes')
          .select(`
            *,
            pacientes(name, cedula),
            doctores(nombre, especialidad)
          `)
          .order('created_at', { ascending: false }),
      ]);

      if (doctorsRes.error) throw doctorsRes.error;
      if (ordersRes.error) throw ordersRes.error;

      setDoctors(doctorsRes.data || []);
      setOrders(ordersRes.data || []);
    } catch (error: any) {
      toast.error('Error al cargar órdenes por médico: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const ordersWithoutDoctor = useMemo(() => {
    return orders.filter((o) => !o.doctor_id);
  }, [orders]);

  const groupedDoctors = useMemo(() => {
    const q = search.trim().toLowerCase();

    return doctors
      .map((doctor) => {
        const doctorOrders = orders.filter((o) => o.doctor_id === doctor.id);

        const totalOrdenes = doctorOrders.length;
        const totalFacturado = round2(
          doctorOrders.reduce((acc, o) => acc + safeNumber(o.total, 0), 0)
        );

        return {
          ...doctor,
          doctorOrders,
          totalOrdenes,
          totalFacturado,
        };
      })
      .filter((doctor) => {
        if (!q) return true;

        const nombre = String(doctor.nombre || '').toLowerCase();
        const especialidad = String(doctor.especialidad || '').toLowerCase();

        return nombre.includes(q) || especialidad.includes(q);
      });
  }, [doctors, orders, search]);

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
        <h1 className="text-2xl font-display font-bold">Órdenes por médico</h1>
        <p className="text-muted-foreground text-sm">
          Control interno de órdenes solicitadas por médico
        </p>
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

      {ordersWithoutDoctor.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
              <div className="font-semibold text-amber-800">Órdenes sin médico asignado</div>
              <div className="text-sm text-amber-700 mt-1">
                Existen {ordersWithoutDoctor.length} órdenes registradas sin médico.
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-4">
          {groupedDoctors.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              No se encontraron médicos
            </div>
          ) : (
            <Accordion type="multiple" className="w-full space-y-3">
              {groupedDoctors.map((doctor) => (
                <AccordionItem
                  key={doctor.id}
                  value={doctor.id}
                  className="rounded-2xl border px-4"
                >
                  <AccordionTrigger className="hover:no-underline">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between w-full gap-3 text-left pr-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <Stethoscope className="w-4 h-4 text-primary" />
                          <span className="font-semibold text-slate-800">
                            {doctor.nombre}
                          </span>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {doctor.especialidad || 'Sin especialidad'}
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <Badge variant="outline">
                          {doctor.totalOrdenes} órdenes
                        </Badge>
                        <Badge>
                          ${doctor.totalFacturado.toFixed(2)}
                        </Badge>
                      </div>
                    </div>
                  </AccordionTrigger>

                  <AccordionContent>
                    {doctor.doctorOrders.length === 0 ? (
                      <div className="py-3 text-sm text-muted-foreground">
                        Este médico aún no tiene órdenes registradas.
                      </div>
                    ) : (
                      <div className="space-y-3 pt-2">
                        {doctor.doctorOrders.map((order: any) => {
                          const total = safeNumber(order.total, 0);
                          const pagado = safeNumber(order.paid_amount, 0);
                          const saldo = round2(Math.max(total - pagado, 0));

                          return (
                            <div
                              key={order.id}
                              className="rounded-xl border bg-slate-50 p-4"
                            >
                              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                                <div className="space-y-1">
                                  <div className="flex items-center gap-2">
                                    <ClipboardList className="w-4 h-4 text-slate-500" />
                                    <span className="font-semibold">{order.code}</span>
                                  </div>
                                  <div className="text-sm text-muted-foreground">
                                    Paciente: {order.pacientes?.name || '—'}
                                  </div>
                                  <div className="text-sm text-muted-foreground">
                                    Fecha: {order.date || '—'}
                                  </div>
                                </div>

                                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                                  <div>
                                    <div className="text-muted-foreground">Total</div>
                                    <div className="font-semibold">${total.toFixed(2)}</div>
                                  </div>
                                  <div>
                                    <div className="text-muted-foreground">Pagado</div>
                                    <div className="font-semibold">${pagado.toFixed(2)}</div>
                                  </div>
                                  <div>
                                    <div className="text-muted-foreground">Saldo</div>
                                    <div className="font-semibold">${saldo.toFixed(2)}</div>
                                  </div>
                                  <div>
                                    <div className="text-muted-foreground">Estado</div>
                                    <div className="font-semibold">
                                      {order.status === 'pending'
                                        ? 'Pendiente'
                                        : order.status === 'in_progress'
                                        ? 'En proceso'
                                        : 'Finalizado'}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          )}
        </CardContent>
      </Card>
    </div>
  );
}