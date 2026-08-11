import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Loader2,
  TestTubes,
  ClipboardList,
  DollarSign,
  AlertTriangle,
  Receipt,
  Wallet,
  FlaskConical,
  CalendarClock,
  CheckCircle2,
} from "lucide-react";

type DashboardOrder = {
  id: string;
  code: string;
  date: string;
  status: "pending" | "in_progress" | "completed";
  total: number;
  paid_amount: number;
  payment_status: "PENDIENTE" | "ABONADO" | "PAGADO" | "ANULADO";
  numero_factura?: string | null;
  pacientes?: {
    name?: string | null;
  } | null;
};

type DashboardTest = {
  id: string;
  name: string;
  price: number;
  parametros_prueba?: { id: string }[];
};

type DashboardReagent = {
  id: string;
  name: string;
  code: string;
  supplier: string;
  current_stock: number;
  min_stock: number;
  expiration_date: string;
};

type DashboardInvoice = {
  id: string;
  sri_estado: string | null;
};

type DashboardState = {
  labName: string;
  orders: DashboardOrder[];
  tests: DashboardTest[];
  lowStockReagents: DashboardReagent[];
  expiringReagents: DashboardReagent[];
  totalBilled: number;
  totalCollected: number;
  totalPendingBalance: number;
  totalTestsDone: number;
  pendingOrdersCount: number;
  authorizedInvoicesCount: number;
  pendingInvoicesCount: number;
};

const initialState: DashboardState = {
  labName: "Laboratorio",
  orders: [],
  tests: [],
  lowStockReagents: [],
  expiringReagents: [],
  totalBilled: 0,
  totalCollected: 0,
  totalPendingBalance: 0,
  totalTestsDone: 0,
  pendingOrdersCount: 0,
  authorizedInvoicesCount: 0,
  pendingInvoicesCount: 0,
};

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<DashboardState>(initialState);

  const formatMoney = (value: number) => `$${Number(value || 0).toFixed(2)}`;

  const formatDate = (value?: string | null) => {
    if (!value) return "—";
    return new Date(value).toLocaleDateString("es-EC");
  };

  const getDaysToExpire = (date: string) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const target = new Date(date);
    target.setHours(0, 0, 0, 0);

    const diffMs = target.getTime() - today.getTime();
    return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  };

  const getOrderStatusLabel = (status: DashboardOrder["status"]) => {
    switch (status) {
      case "pending":
        return "Pendiente";
      case "in_progress":
        return "En proceso";
      case "completed":
        return "Completada";
      default:
        return status;
    }
  };

  const getOrderStatusVariant = (status: DashboardOrder["status"]) => {
    switch (status) {
      case "completed":
        return "default";
      case "in_progress":
        return "secondary";
      case "pending":
      default:
        return "outline";
    }
  };

  const getPaymentStatusClass = (status: DashboardOrder["payment_status"]) => {
    switch (status) {
      case "PAGADO":
        return "bg-emerald-50 text-emerald-700 border-emerald-200";
      case "ABONADO":
        return "bg-amber-50 text-amber-700 border-amber-200";
      case "ANULADO":
        return "bg-slate-100 text-slate-700 border-slate-200";
      case "PENDIENTE":
      default:
        return "bg-rose-50 text-rose-700 border-rose-200";
    }
  };

  const fetchDashboardData = async () => {
    setLoading(true);

    try {
      const today = new Date();
      const limitDate = new Date();
      limitDate.setDate(today.getDate() + 30);

      const [labRes, ordersRes, testsRes, reagentsRes, resultsRes, invoicesRes] =
        await Promise.all([
          supabase
            .from("configuracion_laboratorio")
            .select("name")
            .maybeSingle(),

          supabase
            .from("ordenes")
            .select(`
              id,
              code,
              date,
              status,
              total,
              paid_amount,
              payment_status,
              numero_factura,
              pacientes (
                name
              )
            `)
            .order("created_at", { ascending: false })
            .limit(8),

          supabase
            .from("pruebas")
            .select(`
              id,
              name,
              price,
              parametros_prueba (
                id
              )
            `)
            .order("created_at", { ascending: false })
            .limit(6),

          supabase
            .from("reactivos")
            .select(`
              id,
              name,
              code,
              supplier,
              current_stock,
              min_stock,
              expiration_date
            `)
            .order("expiration_date", { ascending: true }),

          supabase
            .from("resultados")
            .select("*", { count: "exact", head: true }),

          supabase
            .from("facturas_electronicas")
            .select("id, sri_estado"),
        ]);

      if (labRes.error) throw labRes.error;
      if (ordersRes.error) throw ordersRes.error;
      if (testsRes.error) throw testsRes.error;
      if (reagentsRes.error) throw reagentsRes.error;
      if (resultsRes.error) throw resultsRes.error;
      if (invoicesRes.error) throw invoicesRes.error;

      const orders = (ordersRes.data || []) as DashboardOrder[];
      const tests = (testsRes.data || []) as DashboardTest[];
      const reagents = (reagentsRes.data || []) as DashboardReagent[];
      const invoices = (invoicesRes.data || []) as DashboardInvoice[];

      const totalBilled = orders.reduce(
        (sum, order) => sum + Number(order.total || 0),
        0
      );

      const totalCollected = orders.reduce(
        (sum, order) => sum + Number(order.paid_amount || 0),
        0
      );

      const totalPendingBalance = orders.reduce((sum, order) => {
        const orderTotal = Number(order.total || 0);
        const paid = Number(order.paid_amount || 0);
        return sum + Math.max(orderTotal - paid, 0);
      }, 0);

      const pendingOrdersCount = orders.filter(
        (order) => order.status === "pending" || order.status === "in_progress"
      ).length;

      const lowStockReagents = reagents.filter(
        (reagent) => Number(reagent.current_stock || 0) <= Number(reagent.min_stock || 0)
      );

      const expiringReagents = reagents.filter((reagent) => {
        if (!reagent.expiration_date) return false;
        const expDate = new Date(reagent.expiration_date);
        return expDate <= limitDate;
      });

      const authorizedInvoicesCount = invoices.filter(
        (invoice) => (invoice.sri_estado || "").toUpperCase() === "AUTORIZADO"
      ).length;

      const pendingInvoicesCount = invoices.filter(
        (invoice) => (invoice.sri_estado || "").toUpperCase() !== "AUTORIZADO"
      ).length;

      setData({
        labName: labRes.data?.name || "Laboratorio",
        orders,
        tests,
        lowStockReagents,
        expiringReagents,
        totalBilled,
        totalCollected,
        totalPendingBalance,
        totalTestsDone: resultsRes.count || 0,
        pendingOrdersCount,
        authorizedInvoicesCount,
        pendingInvoicesCount,
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

  const stats = useMemo(
    () => [
      {
        label: "Facturado",
        value: formatMoney(data.totalBilled),
        icon: Receipt,
        gradient: "bg-gradient-to-br from-sky-500 to-blue-500",
      },
      {
        label: "Cobrado",
        value: formatMoney(data.totalCollected),
        icon: DollarSign,
        gradient: "bg-gradient-to-br from-emerald-500 to-teal-500",
      },
      {
        label: "Saldo por cobrar",
        value: formatMoney(data.totalPendingBalance),
        icon: Wallet,
        gradient: "bg-gradient-to-br from-amber-500 to-orange-500",
      },
      {
        label: "Pruebas realizadas",
        value: data.totalTestsDone,
        icon: TestTubes,
        gradient: "bg-gradient-to-br from-violet-500 to-fuchsia-500",
      },
      {
        label: "Órdenes por procesar",
        value: data.pendingOrdersCount,
        icon: ClipboardList,
        gradient: "bg-gradient-to-br from-rose-500 to-pink-500",
      },
      {
        label: "Facturas autorizadas",
        value: data.authorizedInvoicesCount,
        icon: CheckCircle2,
        gradient: "bg-gradient-to-br from-cyan-500 to-indigo-500",
      },
    ],
    [data]
  );

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center flex-col gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <p className="text-muted-foreground text-sm font-medium">
          Cargando dashboard del laboratorio...
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-display font-bold text-foreground">
          Dashboard
        </h1>
        <p className="text-muted-foreground text-sm">
          Resumen general de {data.labName}
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {stats.map((item) => (
          <Card key={item.label} className="border-0 shadow-sm overflow-hidden">
            <CardContent className="p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm text-muted-foreground font-medium">
                    {item.label}
                  </p>
                  <p className="text-2xl font-display font-bold mt-1 text-slate-800">
                    {item.value}
                  </p>
                </div>

                <div
                  className={`w-11 h-11 rounded-2xl ${item.gradient} flex items-center justify-center shadow-lg`}
                >
                  <item.icon className="w-5 h-5 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Alertas */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <Card className="border-rose-200 bg-rose-50/30">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg font-display flex items-center gap-2 text-rose-700">
              <AlertTriangle className="w-5 h-5" />
              Reactivos con stock bajo
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data.lowStockReagents.length === 0 ? (
              <p className="text-sm text-slate-500">
                No hay reactivos con stock bajo.
              </p>
            ) : (
              <div className="space-y-2">
                {data.lowStockReagents.slice(0, 6).map((reagent) => (
                  <div
                    key={reagent.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-white border border-rose-100 shadow-sm"
                  >
                    <div>
                      <p className="font-medium text-sm text-slate-700">
                        {reagent.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {reagent.code} — {reagent.supplier}
                      </p>
                    </div>

                    <Badge variant="destructive">
                      Stock: {reagent.current_stock}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-amber-200 bg-amber-50/30">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg font-display flex items-center gap-2 text-amber-700">
              <CalendarClock className="w-5 h-5" />
              Reactivos próximos a caducar
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data.expiringReagents.length === 0 ? (
              <p className="text-sm text-slate-500">
                No hay reactivos próximos a caducar en 30 días.
              </p>
            ) : (
              <div className="space-y-2">
                {data.expiringReagents.slice(0, 6).map((reagent) => {
                  const days = getDaysToExpire(reagent.expiration_date);

                  return (
                    <div
                      key={reagent.id}
                      className="flex items-center justify-between p-3 rounded-lg bg-white border border-amber-100 shadow-sm"
                    >
                      <div>
                        <p className="font-medium text-sm text-slate-700">
                          {reagent.name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Caduca: {formatDate(reagent.expiration_date)}
                        </p>
                      </div>

                      <Badge variant="outline">
                        {days < 0
                          ? "Caducado"
                          : days === 0
                          ? "Hoy"
                          : `${days} días`}
                      </Badge>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Bloques principales */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <Card className="xl:col-span-4">
          <CardHeader className="pb-3 border-b border-slate-50">
            <CardTitle className="text-lg font-display">
              Últimas órdenes
            </CardTitle>
          </CardHeader>

          <CardContent className="pt-4">
            {data.orders.length === 0 ? (
              <p className="text-sm text-slate-500">No hay órdenes registradas.</p>
            ) : (
              <div className="space-y-3">
                {data.orders.map((order) => {
                  const pendingBalance = Math.max(
                    Number(order.total || 0) - Number(order.paid_amount || 0),
                    0
                  );

                  return (
                    <div
                      key={order.id}
                      className="rounded-xl border bg-muted/40 p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3"
                    >
                      <div className="space-y-1">
                        <p className="font-semibold text-sm text-slate-800">
                          {order.code}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Paciente: {order.pacientes?.name || "Sin nombre"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Fecha: {formatDate(order.date)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Factura: {order.numero_factura || "No generada"}
                        </p>
                      </div>

                      <div className="flex flex-col items-start md:items-end gap-2">
                        <div className="flex flex-wrap gap-2">
                          <Badge variant={getOrderStatusVariant(order.status)}>
                            {getOrderStatusLabel(order.status)}
                          </Badge>

                          <span
                            className={`inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-medium ${getPaymentStatusClass(
                              order.payment_status
                            )}`}
                          >
                            {order.payment_status}
                          </span>
                        </div>

                        <div className="text-sm text-slate-700 text-left md:text-right">
                          <p>Total: {formatMoney(Number(order.total || 0))}</p>
                          <p>Cobrado: {formatMoney(Number(order.paid_amount || 0))}</p>
                          <p className="font-semibold text-rose-600">
                            Saldo: {formatMoney(pendingBalance)}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
        
      </div>
    </div>
  );
}