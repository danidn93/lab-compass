import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, TestTubes, ClipboardList, DollarSign, AlertTriangle } from 'lucide-react';

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState({
    orders: [] as any[],
    tests: [] as any[],
    lowStockReagents: [] as any[],
    totalRevenue: 0,
    totalTestsDone: 0,
    pendingOrdersCount: 0
  });

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      // 1. Obtener Órdenes (para ingresos y lista reciente)
      const { data: ordersData } = await supabase
        .from('ordenes')
        .select('*')
        .order('created_at', { ascending: false });

      // 2. Obtener Pruebas Disponibles (Catálogo limitado a 5)
      const { data: testsData } = await supabase
        .from('pruebas')
        .select('*, parametros_prueba(id)')
        .limit(5);

      // 3. Obtener Reactivos con Stock Bajo
      const { data: reagentsData } = await supabase
        .from('reactivos')
        .select('*');

      // 4. Obtener conteo de la tabla CORRECTA: 'resultados'
      const { count: resultsCount } = await supabase
        .from('resultados')
        .select('*', { count: 'exact', head: true });

      // Cálculos basados en tu esquema
      const ordersList = ordersData || [];
      const revenue = ordersList
        .filter(o => o.status === 'completed')
        .reduce((sum, o) => sum + Number(o.total || 0), 0);
      
      const pending = ordersList.filter(o => o.status === 'pending').length;
      const lowStock = (reagentsData || []).filter(r => r.current_stock <= r.min_stock);

      setData({
        orders: ordersList,
        tests: testsData || [],
        lowStockReagents: lowStock,
        totalRevenue: revenue,
        totalTestsDone: resultsCount || 0,
        pendingOrdersCount: pending
      });
    } catch (error) {
      console.error("Error cargando dashboard:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const stats = [
    { label: 'Ingresos Totales', value: `$${data.totalRevenue.toFixed(2)}`, icon: DollarSign, gradient: 'bg-gradient-to-br from-blue-500 to-cyan-400' },
    { label: 'Pruebas Realizadas', value: data.totalTestsDone, icon: TestTubes, gradient: 'bg-gradient-to-br from-emerald-500 to-teal-400' },
    { label: 'Órdenes Pendientes', value: data.pendingOrdersCount, icon: ClipboardList, gradient: 'bg-gradient-to-br from-amber-500 to-orange-400' },
    { label: 'Reactivos Bajo Stock', value: data.lowStockReagents.length, icon: AlertTriangle, gradient: 'bg-gradient-to-br from-rose-500 to-red-400' },
  ];

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center flex-col gap-2">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <p className="text-muted-foreground text-sm font-medium">Sincronizando con Base de Datos...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-display font-bold text-foreground">Dashboard</h1>
        <p className="text-muted-foreground text-sm">Resumen general del laboratorio</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s) => (
          <Card key={s.label} className="border-0 shadow-sm overflow-hidden group">
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-muted-foreground font-medium">{s.label}</p>
                  <p className="text-2xl font-display font-bold mt-1 text-slate-800">{s.value}</p>
                </div>
                <div className={`w-10 h-10 rounded-xl ${s.gradient} flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform`}>
                  <s.icon className="w-5 h-5 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Alertas de Inventario */}
      {data.lowStockReagents.length > 0 && (
        <Card className="border-rose-200 bg-rose-50/30">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg font-display flex items-center gap-2 text-rose-700">
              <AlertTriangle className="w-5 h-5" />
              Alertas de Inventario
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {data.lowStockReagents.map(r => (
                <div key={r.id} className="flex items-center justify-between p-3 rounded-lg bg-white border border-rose-100 shadow-sm">
                  <div>
                    <p className="font-medium text-sm text-slate-700">{r.name}</p>
                    <p className="text-xs text-muted-foreground">{r.code} — {r.supplier}</p>
                  </div>
                  <Badge variant="destructive">Stock: {r.current_stock}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Últimas Órdenes */}
        <Card>
          <CardHeader className="pb-3 border-b border-slate-50">
            <CardTitle className="text-lg font-display">Últimas Órdenes</CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="space-y-2">
              {data.orders.slice(0, 5).map(order => (
                <div key={order.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                  <div>
                    <p className="font-medium text-sm">{order.code}</p>
                    <p className="text-[10px] text-muted-foreground uppercase font-semibold">{order.date}</p>
                  </div>
                  <Badge 
                    variant={order.status === 'completed' ? 'default' : order.status === 'in_progress' ? 'secondary' : 'outline'}
                  >
                    {order.status === 'completed' ? 'Finalizado' : order.status === 'in_progress' ? 'En Proceso' : 'Pendiente'}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Pruebas Disponibles */}
        <Card>
          <CardHeader className="pb-3 border-b border-slate-50">
            <CardTitle className="text-lg font-display">Pruebas Disponibles</CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="space-y-2">
              {data.tests.map(test => (
                <div key={test.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                  <div>
                    <p className="font-medium text-sm">{test.name}</p>
                    <p className="text-xs text-muted-foreground">{test.parametros_prueba?.length || 0} parámetros</p>
                  </div>
                  <span className="text-sm font-semibold text-primary">${Number(test.price).toFixed(2)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}