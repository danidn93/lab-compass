import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Loader2,
  Plus,
  Search,
  Printer,
  FileText,
  Receipt,
  FileCode,
  RefreshCw,
} from 'lucide-react';
import { toast } from 'sonner';
import QRCode from "qrcode";

function safeNumber(value: any, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function round2(value: number): number {
  return Number(value.toFixed(2));
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

export default function OrdersPage() {
  const [orders, setOrders] = useState<any[]>([]);
  const [patients, setPatients] = useState<any[]>([]);
  const [tests, setTests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [checkingSri, setCheckingSri] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [invoiceDialogOpen, setInvoiceDialogOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<any>(null);

  const [selectedPatient, setSelectedPatient] = useState('');
  const [selectedTests, setSelectedTests] = useState<string[]>([]);
  const [patientSearch, setPatientSearch] = useState('');
  const [testSearch, setTestSearch] = useState('');

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    setLoading(true);

    const [o, p, t] = await Promise.all([
      supabase
        .from('ordenes')
        .select(`
          *,
          pacientes(name, cedula, email)
        `)
        .order('created_at', { ascending: false }),

      supabase
        .from('pacientes')
        .select('*')
        .order('name'),

      supabase
        .from('pruebas')
        .select(`
          *,
          prueba_reactivos(*)
        `)
        .order('name'),
    ]);

    setOrders(o.data || []);
    setPatients(p.data || []);
    setTests(t.data || []);
    setLoading(false);
  };

  const generateAccessKey = () =>
    Math.random().toString(36).substring(2, 8).toUpperCase();

  const generateOrderCode = () => `ORD-${Date.now().toString().slice(-6)}`;

  const selectedPatientData = useMemo(() => {
    return patients.find((p) => p.id === selectedPatient) || null;
  }, [patients, selectedPatient]);

  const filteredPatients = useMemo(() => {
    const q = patientSearch.trim().toLowerCase();

    if (!q) return [];

    return patients.filter((p) => {
      const nombre = String(p.name || '').toLowerCase();
      const cedula = String(p.cedula || '').toLowerCase();
      const email = String(p.email || '').toLowerCase();

      return nombre.includes(q) || cedula.includes(q) || email.includes(q);
    });
  }, [patients, patientSearch]);

  const filteredTestsForPicker = useMemo(() => {
    const q = testSearch.trim().toLowerCase();

    if (!q) return tests;

    return tests.filter((t) => {
      const nombre = String(t.name || '').toLowerCase();
      const descripcion = String(t.description || '').toLowerCase();

      return nombre.includes(q) || descripcion.includes(q);
    });
  }, [tests, testSearch]);

  const selectedTestsSummary = useMemo(() => {
    return selectedTests
      .map((tid) => {
        const test = tests.find((t) => t.id === tid);
        if (!test) return null;

        const precio = safeNumber(test.price);
        const porcentajeIva = safeNumber(test.porcentaje_iva);
        const subtotal = round2(precio);
        const valorIva = round2(subtotal * (porcentajeIva / 100));
        const totalLinea = round2(subtotal + valorIva);

        return {
          ...test,
          subtotal,
          valorIva,
          totalLinea,
        };
      })
      .filter(Boolean) as any[];
  }, [selectedTests, tests]);

  const resumenTotales = useMemo(() => {
    const subtotal = round2(
      selectedTestsSummary.reduce((acc, t) => acc + safeNumber(t.subtotal), 0)
    );
    const iva = round2(
      selectedTestsSummary.reduce((acc, t) => acc + safeNumber(t.valorIva), 0)
    );
    const total = round2(subtotal + iva);

    return { subtotal, iva, total };
  }, [selectedTestsSummary]);

  const handleClearPatient = () => {
    setSelectedPatient('');
    setPatientSearch('');
  };

  const handleCreate = async () => {
    if (!selectedPatient || selectedTests.length === 0) return;

    const paciente = patients.find((p) => p.id === selectedPatient);
    if (!paciente) {
      toast.error('Debe seleccionar un paciente válido');
      return;
    }

    setCreating(true);

    const total = resumenTotales.total;

    const orderCode = generateOrderCode();
    const accessKey = generateAccessKey();

    try {
      const { data: order, error: orderError } = await supabase
        .from('ordenes')
        .insert([
          {
            code: orderCode,
            access_key: accessKey,
            patient_id: selectedPatient,
            total,
            status: 'pending',
            factura_estado: 'PENDIENTE',
          },
        ])
        .select()
        .single();

      if (orderError) throw orderError;

      for (const testId of selectedTests) {
        const test = tests.find((t) => t.id === testId);
        if (!test) continue;

        const precio = round2(safeNumber(test.price));
        const porcentajeIva = round2(safeNumber(test.porcentaje_iva, 0));
        const codigoPorcentajeIva = String(
          test.codigo_porcentaje_iva || obtenerCodigoPorcentajeIva(porcentajeIva)
        );
        const objetoImpuesto = String(test.objeto_impuesto || '2');

        const subtotalSinImpuesto = round2(precio);
        const valorIva = round2(subtotalSinImpuesto * (porcentajeIva / 100));
        const totalLinea = round2(subtotalSinImpuesto + valorIva);

        const { error: detailError } = await supabase.from('orden_detalle').insert({
          order_id: order.id,
          test_id: testId,
          price: precio,
          porcentaje_iva: porcentajeIva,
          codigo_porcentaje_iva: codigoPorcentajeIva,
          objeto_impuesto: objetoImpuesto,
          subtotal_sin_impuesto: subtotalSinImpuesto,
          valor_iva: valorIva,
          total_linea: totalLinea,
        });

        if (detailError) throw detailError;

        if (test.prueba_reactivos) {
          for (const tr of test.prueba_reactivos) {
            const { error: stockError } = await supabase.rpc('decrement_reagent_stock', {
              row_id: tr.reagent_id,
              amount: tr.quantity_used,
            });

            if (stockError) throw stockError;
          }
        }
      }

      const { data: facturaResp, error: facturaError } = await supabase.functions.invoke(
        'generar-factura-electronica',
        {
          body: { order_id: order.id },
        }
      );

      if (facturaError) {
        console.error('Error facturación:', facturaError);
        toast.error('Orden creada, pero falló la comunicación con la facturación electrónica');
      } else if (!facturaResp?.ok) {
        console.error('Respuesta facturación:', facturaResp);

        const sriDetalle = facturaResp?.sri_mensajes
          ?.map((m: any) =>
            [m.identificador, m.mensaje, m.informacionAdicional]
              .filter(Boolean)
              .join(' - ')
          )
          .join(' | ');

        if (facturaResp?.sri_estado === 'EN_PROCESAMIENTO') {
          toast.info(
            sriDetalle ||
              facturaResp?.message ||
              'La factura fue enviada al SRI y sigue en procesamiento. No se reenviará; luego debe reconsultarse la autorización.'
          );
        } else {
          toast.error(
            sriDetalle ||
              facturaResp?.message ||
              'Orden creada, pero no se generó la factura'
          );
        }
      } else {
        toast.success('Orden y factura generadas correctamente');
      }

      setDialogOpen(false);
      setSelectedPatient('');
      setSelectedTests([]);
      setPatientSearch('');
      setTestSearch('');
      await fetchInitialData();

      if (confirm('¿Desea imprimir el ticket de recepción?')) {
        printThermalTicket(order.id);
      }
    } catch (error: any) {
      toast.error('Error al crear orden: ' + error.message);
    } finally {
      setCreating(false);
    }
  };

  const recheckSriStatus = async (orderId: string) => {
    try {
      setCheckingSri(orderId);

      const { data, error } = await supabase.functions.invoke(
        'consultar-factura-electronica',
        {
          body: { order_id: orderId },
        }
      );

      if (error) {
        toast.error('No se pudo reconsultar el estado en SRI');
        return;
      }

      if (data?.ok) {
        toast.success(data?.message || 'Factura autorizada correctamente');
      } else if (data?.sri_estado === 'EN_PROCESAMIENTO') {
        toast.info(
          data?.message || 'La factura aún sigue en procesamiento en el SRI'
        );
      } else {
        const sriDetalle = data?.sri_mensajes
          ?.map((m: any) =>
            [m.identificador, m.mensaje, m.informacionAdicional]
              .filter(Boolean)
              .join(' - ')
          )
          .join(' | ');

        toast.error(
          sriDetalle || data?.message || 'La factura aún no ha sido autorizada'
        );
      }

      await fetchInitialData();

      if (selectedOrder?.id === orderId) {
        const { data: updatedOrder } = await supabase
          .from('ordenes')
          .select(`
            *,
            pacientes(name, cedula, email)
          `)
          .eq('id', orderId)
          .single();

        if (updatedOrder) {
          setSelectedOrder(updatedOrder);
        }
      }
    } catch (error: any) {
      toast.error('Error al reconsultar SRI: ' + error.message);
    } finally {
      setCheckingSri(null);
    }
  };

  const openInvoiceDialog = async (orderId: string) => {
    const { data: order, error } = await supabase
      .from('ordenes')
      .select(`
        *,
        pacientes(name, cedula, email)
      `)
      .eq('id', orderId)
      .single();

    if (error || !order) {
      toast.error('No se pudo cargar la factura de la orden');
      return;
    }

    setSelectedOrder(order);
    setInvoiceDialogOpen(true);
  };

  const openRidePdf = async (pdfPath: string) => {
    if (!pdfPath) {
      toast.error('No existe PDF RIDE para esta orden');
      return;
    }

    const cleanPath = pdfPath.trim().replace(/^\/+/, '');

    const { data } = supabase.storage
      .from('facturas-pdf')
      .getPublicUrl(cleanPath);

    if (!data?.publicUrl) {
      toast.error('No se pudo obtener la URL pública del PDF RIDE');
      return;
    }

    window.open(data.publicUrl, '_blank', 'noopener,noreferrer');
  };

  const openXmlFile = async (xmlPath: string) => {
    if (!xmlPath) {
      toast.error('No existe XML para esta orden');
      return;
    }

    const cleanPath = xmlPath.trim().replace(/^\/+/, '');

    const { data } = supabase.storage
      .from('facturas-xml')
      .getPublicUrl(cleanPath);

    if (!data?.publicUrl) {
      toast.error('No se pudo obtener la URL pública del XML');
      return;
    }

    window.open(data.publicUrl, '_blank', 'noopener,noreferrer');
  };

  const printThermalTicket = async (orderId: string) => {
    const { data: order } = await supabase
      .from('ordenes')
      .select(`
        *,
        pacientes(*),
        orden_detalle(
          test_id,
          price,
          porcentaje_iva,
          valor_iva,
          total_linea,
          pruebas(name, price)
        )
      `)
      .eq('id', orderId)
      .single();

    if (!order) return;

    const subtotal = round2(
      (order.orden_detalle || []).reduce((acc: number, d: any) => acc + safeNumber(d.price), 0)
    );

    const iva = round2(
      (order.orden_detalle || []).reduce((acc: number, d: any) => acc + safeNumber(d.valor_iva), 0)
    );

    const total = round2(
      (order.orden_detalle || []).reduce(
        (acc: number, d: any) => acc + safeNumber(d.total_linea, d.price),
        0
      )
    );

    // 🔥 URL REAL DEL PORTAL
    const portalUrl = `${window.location.origin}/portal?clave=${order.access_key}`;

    // 🔥 GENERAR QR
    const qrDataUrl = await QRCode.toDataURL(portalUrl, {
      width: 180,
      margin: 1,
    });

    const printWindow = window.open('', '_blank', 'width=300,height=900');
    if (!printWindow) return;

    const ticketHTML = `
      <html>
        <head>
          <style>
            @page { size: 58mm auto; margin: 0; }
            body {
              font-family: 'Courier New', Courier, monospace;
              width: 58mm;
              padding: 5px;
              font-size: 12px;
              line-height: 1.2;
            }
            .center { text-align: center; }
            .bold { font-weight: bold; }
            .line { border-bottom: 1px dashed #000; margin: 5px 0; }
            .flex { display: flex; justify-content: space-between; }
            .small { font-size: 10px; word-break: break-word; }
            .qr { display: flex; justify-content: center; margin-top: 8px; }
            img { width: 120px; height: 120px; }
          </style>
        </head>

        <body>

          <div class="center bold">LABORATORIO CLÍNICO</div>
          <div class="center">Comprobante de Recepción</div>

          <div class="line"></div>

          <div><b>ORDEN:</b> ${order.code}</div>
          <div><b>FECHA:</b> ${new Date(order.created_at).toLocaleDateString()}</div>
          <div><b>PACIENTE:</b> ${order.pacientes?.name || ''}</div>
          <div><b>ID:</b> ${order.pacientes?.cedula || ''}</div>

          <div class="line"></div>

          <div class="center bold">CLAVE DE ACCESO WEB</div>
          <div class="center bold" style="border:1px solid #000; font-size:16px;">
            ${order.access_key}
          </div>

          ${order.numero_factura ? `
            <div class="line"></div>
            <div><b>FACTURA:</b> ${order.numero_factura}</div>
            <div><b>ESTADO FE:</b> ${order.factura_estado}</div>
          ` : ''}

          ${order.clave_acceso_sri ? `
            <div class="small"><b>CLAVE SRI:</b> ${order.clave_acceso_sri}</div>
          ` : ''}

          ${order.numero_autorizacion_sri ? `
            <div class="small"><b>AUTORIZACIÓN:</b> ${order.numero_autorizacion_sri}</div>
          ` : ''}

          <div class="line"></div>

          <div class="bold">PRUEBAS:</div>

          ${(order.orden_detalle || [])
            .map(
              (d: any) => `
                <div class="flex">
                  <span>- ${d.pruebas?.name || 'Prueba'}</span>
                  <span>$${Number(d.price || 0).toFixed(2)}</span>
                </div>
              `
            )
            .join('')}

          <div class="line"></div>

          <div class="flex">
            <span>SUBTOTAL:</span>
            <span>$${subtotal.toFixed(2)}</span>
          </div>

          <div class="flex">
            <span>IVA:</span>
            <span>$${iva.toFixed(2)}</span>
          </div>

          <div class="flex bold">
            <span>TOTAL:</span>
            <span>$${total.toFixed(2)}</span>
          </div>

          <div class="line"></div>

          <div class="center">Consulte sus resultados en:</div>
          <div class="center bold small">${portalUrl}</div>

          <div class="qr">
            <img src="${qrDataUrl}" />
          </div>

          <div class="center small">Escanee el código QR</div>

        </body>
      </html>
    `;

    printWindow.document.write(ticketHTML);
    printWindow.document.close();
    printWindow.focus();

    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 400);
  };

  const filtered = orders.filter(
    (o) =>
      o.code?.toLowerCase().includes(search.toLowerCase()) ||
      o.pacientes?.name?.toLowerCase().includes(search.toLowerCase()) ||
      o.numero_factura?.toLowerCase().includes(search.toLowerCase()) ||
      o.clave_acceso_sri?.toLowerCase().includes(search.toLowerCase())
  );

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
          <h1 className="text-2xl font-display font-bold">Órdenes de Laboratorio</h1>
          <p className="text-muted-foreground text-sm">
            Gestión de facturación y tickets térmicos
          </p>
        </div>

        <Button
          onClick={() => {
            setSelectedTests([]);
            setSelectedPatient('');
            setPatientSearch('');
            setTestSearch('');
            setDialogOpen(true);
          }}
          className="gradient-clinical text-primary-foreground border-0"
        >
          <Plus className="w-4 h-4 mr-2" /> Nueva Orden
        </Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
        <Input
          className="pl-10"
          placeholder="Buscar por código, paciente o factura..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Código</TableHead>
                <TableHead>Paciente</TableHead>
                <TableHead className="hidden md:table-cell">Factura</TableHead>
                <TableHead className="hidden lg:table-cell">Clave SRI</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Estado Orden</TableHead>
                <TableHead>Estado Factura</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {filtered.map((order) => (
                <TableRow key={order.id}>
                  <TableCell className="font-bold text-slate-700">{order.code}</TableCell>
                  <TableCell className="text-sm">{order.pacientes?.name}</TableCell>

                  <TableCell className="hidden md:table-cell">
                    {order.numero_factura ? (
                      <Badge variant="outline" className="font-mono">
                        {order.numero_factura}
                      </Badge>
                    ) : (
                      <Badge variant="secondary">Sin factura</Badge>
                    )}
                  </TableCell>

                  <TableCell className="hidden lg:table-cell max-w-[220px] truncate">
                    {order.clave_acceso_sri ? (
                      <span className="text-xs font-mono">{order.clave_acceso_sri}</span>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>

                  <TableCell className="font-bold text-primary">
                    ${Number(order.total).toFixed(2)}
                  </TableCell>

                  <TableCell>
                    <Badge variant={order.status === 'completed' ? 'default' : 'secondary'}>
                      {order.status === 'pending'
                        ? 'Pendiente'
                        : order.status === 'in_progress'
                        ? 'En Proceso'
                        : 'Finalizado'}
                    </Badge>
                  </TableCell>

                  <TableCell>
                    <Badge
                      variant={
                        order.factura_estado === 'AUTORIZADO'
                          ? 'default'
                          : order.factura_estado === 'GENERADA' ||
                            order.factura_estado === 'EN_PROCESAMIENTO'
                          ? 'outline'
                          : order.factura_estado === 'DEVUELTA' ||
                            order.factura_estado === 'NO AUTORIZADO'
                          ? 'destructive'
                          : 'secondary'
                      }
                    >
                      {order.factura_estado === 'EN_PROCESAMIENTO'
                        ? 'Procesando SRI'
                        : order.factura_estado || 'PENDIENTE'}
                    </Badge>
                  </TableCell>

                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      {order.factura_estado === 'EN_PROCESAMIENTO' && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => recheckSriStatus(order.id)}
                          title="Reconsultar SRI"
                          disabled={checkingSri === order.id}
                        >
                          {checkingSri === order.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <RefreshCw className="w-4 h-4" />
                          )}
                        </Button>
                      )}

                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => printThermalTicket(order.id)}
                        title="Reimprimir Ticket"
                      >
                        <Printer className="w-4 h-4" />
                      </Button>

                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openInvoiceDialog(order.id)}
                        title="Ver Factura"
                      >
                        <FileText className="w-4 h-4" />
                      </Button>

                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() =>
                          openXmlFile(
                            order.factura_xml_autorizado_path ||
                              order.factura_xml_firmado_path ||
                              order.factura_xml_path
                          )
                        }
                        title="Abrir XML"
                        disabled={
                          !order.factura_xml_autorizado_path &&
                          !order.factura_xml_firmado_path &&
                          !order.factura_xml_path
                        }
                      >
                        <FileCode className="w-4 h-4" />
                      </Button>

                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openRidePdf(order.factura_ride_pdf_path)}
                        title="Abrir PDF RIDE"
                        disabled={!order.factura_ride_pdf_path}
                      >
                        <Receipt className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}

              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-10 text-muted-foreground">
                    No se encontraron órdenes
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl w-[95vw] max-h-[90vh] overflow-hidden rounded-3xl p-0">
          <div className="flex max-h-[90vh] flex-col">
            <DialogHeader className="shrink-0 px-6 pt-6 pb-2 border-b bg-white">
              <DialogTitle className="font-display text-3xl font-bold">
                Generar Nueva Orden
              </DialogTitle>
            </DialogHeader>

            <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
              <div className="space-y-3">
                <Label className="text-xs font-bold uppercase tracking-wide text-slate-700">
                  Seleccionar paciente
                </Label>

                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input
                    className="pl-10 pr-24 h-12 rounded-xl border-slate-200 bg-white shadow-sm disabled:bg-slate-100 disabled:text-slate-500"
                    placeholder="Buscar por nombre, cédula o email..."
                    value={
                      selectedPatientData
                        ? `${selectedPatientData.name} — ${selectedPatientData.cedula || 'Sin cédula'}`
                        : patientSearch
                    }
                    onChange={(e) => setPatientSearch(e.target.value)}
                    disabled={!!selectedPatientData}
                  />

                  {selectedPatientData && (
                    <div className="absolute right-2 top-1/2 -translate-y-1/2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="rounded-lg"
                        onClick={handleClearPatient}
                      >
                        Quitar
                      </Button>
                    </div>
                  )}
                </div>

                {selectedPatientData ? (
                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm">
                    <div className="font-semibold text-emerald-700">Paciente seleccionado</div>
                    <div className="text-slate-700">
                      {selectedPatientData.name} — {selectedPatientData.cedula || 'Sin cédula'}
                    </div>
                    {selectedPatientData.email && (
                      <div className="text-xs text-slate-500">{selectedPatientData.email}</div>
                    )}
                  </div>
                ) : (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-2 max-h-64 overflow-y-auto space-y-2">
                    {patientSearch.trim() === '' ? (
                      <div className="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-6 text-center text-sm text-slate-500">
                        Escriba un nombre, cédula o email para buscar
                      </div>
                    ) : filteredPatients.length > 0 ? (
                      filteredPatients.map((p) => (
                        <button
                          type="button"
                          key={p.id}
                          onClick={() => setSelectedPatient(p.id)}
                          className="w-full text-left rounded-xl border border-slate-200 bg-white px-4 py-3 transition hover:border-emerald-300 hover:bg-emerald-50"
                        >
                          <div className="font-semibold">{p.name}</div>
                          <div className="text-sm text-slate-500">
                            Cédula: {p.cedula || '—'}
                            {p.email ? ` • ${p.email}` : ''}
                          </div>
                        </button>
                      ))
                    ) : (
                      <div className="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-6 text-center text-sm text-slate-500">
                        No existen coincidencias
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="space-y-3">
                <Label className="text-xs font-bold uppercase tracking-wide text-slate-700">
                  Seleccionar pruebas
                </Label>

                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input
                    className="pl-10 h-12 rounded-xl border-slate-200 bg-white shadow-sm"
                    placeholder="Buscar prueba por nombre..."
                    value={testSearch}
                    onChange={(e) => setTestSearch(e.target.value)}
                  />
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-2 max-h-72 overflow-y-auto space-y-2">
                  {filteredTestsForPicker.length > 0 ? (
                    filteredTestsForPicker.map((t) => {
                      const isSelected = selectedTests.includes(t.id);

                      return (
                        <button
                          type="button"
                          key={t.id}
                          onClick={() => {
                            setSelectedTests((prev) =>
                              prev.includes(t.id)
                                ? prev.filter((id) => id !== t.id)
                                : [...prev, t.id]
                            );
                          }}
                          className={`w-full rounded-xl border px-4 py-3 text-left transition ${
                            isSelected
                              ? 'border-blue-500 bg-blue-50'
                              : 'border-slate-200 bg-white hover:border-blue-300 hover:bg-blue-50/40'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex items-start gap-3">
                              <div
                                className={`mt-1 h-5 w-5 rounded-md border flex items-center justify-center ${
                                  isSelected
                                    ? 'border-blue-600 bg-blue-600 text-white'
                                    : 'border-slate-300 bg-white'
                                }`}
                              >
                                {isSelected && <span className="text-xs">✓</span>}
                              </div>

                              <div>
                                <div className="font-semibold text-slate-800">{t.name}</div>
                                <div className="text-sm text-slate-500">
                                  IVA {Number(t.porcentaje_iva || 0).toFixed(2)}%
                                </div>
                              </div>
                            </div>

                            <div className="text-sm font-bold text-slate-700">
                              ${Number(t.price || 0).toFixed(2)}
                            </div>
                          </div>
                        </button>
                      );
                    })
                  ) : (
                    <div className="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-6 text-center text-sm text-slate-500">
                      No existen coincidencias
                    </div>
                  )}
                </div>
              </div>

              {selectedTestsSummary.length > 0 && (
                <div className="rounded-2xl border border-primary/10 bg-primary/5 p-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="font-semibold text-primary italic">
                      {selectedTestsSummary.length} pruebas seleccionadas
                    </span>
                    <span className="font-semibold">
                      Subtotal: ${resumenTotales.subtotal.toFixed(2)}
                    </span>
                  </div>

                  <div className="space-y-1">
                    {selectedTestsSummary.map((t) => (
                      <div key={t.id} className="flex items-center justify-between text-sm">
                        <span>{t.name}</span>
                        <span>
                          ${Number(t.price).toFixed(2)} + IVA ${Number(t.valorIva).toFixed(2)}
                        </span>
                      </div>
                    ))}
                  </div>

                  <div className="flex justify-between text-sm pt-2 border-t">
                    <span>IVA total</span>
                    <span>${resumenTotales.iva.toFixed(2)}</span>
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-sm font-bold text-primary">Total</span>
                    <span className="text-xl font-display font-black text-primary">
                      ${resumenTotales.total.toFixed(2)}
                    </span>
                  </div>
                </div>
              )}
            </div>

            <div className="shrink-0 border-t bg-white px-6 py-4">
              <Button
                onClick={handleCreate}
                className="w-full h-14 rounded-2xl text-xl font-semibold gradient-clinical text-primary-foreground border-0 shadow-lg"
                disabled={!selectedPatient || selectedTests.length === 0 || creating}
              >
                {creating ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Generando...
                  </>
                ) : (
                  'Confirmar, Facturar y Generar Ticket'
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={invoiceDialogOpen} onOpenChange={setInvoiceDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display">Detalle de Factura</DialogTitle>
          </DialogHeader>

          {selectedOrder && (
            <div className="space-y-4 text-sm">
              {selectedOrder.factura_estado === 'EN_PROCESAMIENTO' && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                  La factura ya fue enviada al SRI y continúa en procesamiento. No debe reenviarse;
                  solo reconsultar su autorización.
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs uppercase text-muted-foreground">Orden</Label>
                  <div className="font-semibold">{selectedOrder.code}</div>
                </div>

                <div>
                  <Label className="text-xs uppercase text-muted-foreground">Paciente</Label>
                  <div className="font-semibold">{selectedOrder.pacientes?.name}</div>
                </div>

                <div>
                  <Label className="text-xs uppercase text-muted-foreground">Número de factura</Label>
                  <div className="font-semibold">{selectedOrder.numero_factura || '—'}</div>
                </div>

                <div>
                  <Label className="text-xs uppercase text-muted-foreground">Estado factura</Label>
                  <div className="font-semibold">
                    {selectedOrder.factura_estado === 'EN_PROCESAMIENTO'
                      ? 'Procesando en SRI'
                      : selectedOrder.factura_estado || '—'}
                  </div>
                </div>

                <div className="md:col-span-2">
                  <Label className="text-xs uppercase text-muted-foreground">
                    Clave de acceso SRI
                  </Label>
                  <div className="font-mono break-all">{selectedOrder.clave_acceso_sri || '—'}</div>
                </div>

                <div className="md:col-span-2">
                  <Label className="text-xs uppercase text-muted-foreground">
                    Número de autorización
                  </Label>
                  <div className="font-mono break-all">
                    {selectedOrder.numero_autorizacion_sri || '—'}
                  </div>
                </div>

                <div>
                  <Label className="text-xs uppercase text-muted-foreground">
                    Fecha autorización
                  </Label>
                  <div className="font-semibold">
                    {selectedOrder.factura_fecha_autorizacion
                      ? new Date(selectedOrder.factura_fecha_autorizacion).toLocaleString()
                      : '—'}
                  </div>
                </div>

                <div>
                  <Label className="text-xs uppercase text-muted-foreground">Total</Label>
                  <div className="font-semibold">
                    ${Number(selectedOrder.total || 0).toFixed(2)}
                  </div>
                </div>

                <div className="md:col-span-2">
                  <Label className="text-xs uppercase text-muted-foreground">Mensaje</Label>
                  <div>{selectedOrder.factura_mensaje || '—'}</div>
                </div>

                <div className="md:col-span-2">
                  <Label className="text-xs uppercase text-muted-foreground">XML Autorizado</Label>
                  <div className="break-all">
                    {selectedOrder.factura_xml_autorizado_path ||
                      selectedOrder.factura_xml_firmado_path ||
                      selectedOrder.factura_xml_path ||
                      '—'}
                  </div>
                </div>

                <div className="md:col-span-2">
                  <Label className="text-xs uppercase text-muted-foreground">PDF RIDE</Label>
                  <div className="break-all">{selectedOrder.factura_ride_pdf_path || '—'}</div>
                </div>

                <div className="md:col-span-2 flex flex-wrap gap-2 pt-2">
                  {selectedOrder.factura_estado === 'EN_PROCESAMIENTO' && (
                    <Button
                      variant="outline"
                      onClick={() => recheckSriStatus(selectedOrder.id)}
                      disabled={checkingSri === selectedOrder.id}
                    >
                      {checkingSri === selectedOrder.id ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <RefreshCw className="w-4 h-4 mr-2" />
                      )}
                      Reconsultar SRI
                    </Button>
                  )}

                  <Button
                    variant="outline"
                    onClick={() =>
                      openXmlFile(
                        selectedOrder.factura_xml_autorizado_path ||
                          selectedOrder.factura_xml_firmado_path ||
                          selectedOrder.factura_xml_path
                      )
                    }
                    disabled={
                      !selectedOrder.factura_xml_autorizado_path &&
                      !selectedOrder.factura_xml_firmado_path &&
                      !selectedOrder.factura_xml_path
                    }
                  >
                    <FileCode className="w-4 h-4 mr-2" />
                    Abrir XML
                  </Button>

                  <Button
                    variant="outline"
                    onClick={() => openRidePdf(selectedOrder.factura_ride_pdf_path)}
                    disabled={!selectedOrder.factura_ride_pdf_path}
                  >
                    <Receipt className="w-4 h-4 mr-2" />
                    Abrir PDF RIDE
                  </Button>

                  <Button variant="outline" onClick={() => printThermalTicket(selectedOrder.id)}>
                    <Printer className="w-4 h-4 mr-2" />
                    Reimprimir Ticket
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}