import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { FlaskConical, FileText, Search, Lock, Loader2, ChevronLeft, Download } from 'lucide-react';
import { toast } from 'sonner';

export default function PatientPortalPage() {
  const [code, setCode] = useState('');
  const [accessKey, setAccessKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [labName, setLabName] = useState('BioAnalítica');
  
  // Estado para la orden encontrada y sus datos
  const [foundOrder, setFoundOrder] = useState<any>(null);

  // Cargar nombre del laboratorio al inicio
  useEffect(() => {
    const fetchLabName = async () => {
      const { data } = await supabase.from('configuracion_laboratorio').select('name').maybeSingle();
      if (data?.name) setLabName(data.name);
    };
    fetchLabName();
  }, []);

  const handleSearch = async () => {
    if (!code || !accessKey) return setError('Por favor, complete ambos campos');
    
    setLoading(true);
    setError('');
    
    try {
      // 1. Buscar la orden por código y clave
      const { data: order, error: orderError } = await supabase
        .from('ordenes')
        .select(`
          *,
          pacientes (*),
          resultados (
            *,
            resultado_detalle (
              *,
              parametros_prueba (*)
            ),
            pruebas (*)
          )
        `)
        .eq('code', code.trim())
        .eq('access_key', accessKey.trim())
        .maybeSingle();

      if (orderError) throw orderError;

      if (!order) {
        setError('No se encontró ninguna orden con esos datos. Verifique su ticket.');
        setFoundOrder(null);
      } else if (order.status !== 'completed') {
        setError('Sus resultados están siendo procesados. Intente más tarde.');
        setFoundOrder(null);
      } else {
        setFoundOrder(order);
      }
    } catch (err: any) {
      setError('Error al conectar con el servidor');
    } finally {
      setLoading(false);
    }
  };

  const calcAge = (birthDate: string) => {
    if (!birthDate) return 0;
    const diff = Date.now() - new Date(birthDate).getTime();
    return Math.floor(diff / (365.25 * 24 * 60 * 60 * 1000));
  };

  // Función placeholder para descarga (aquí conectarías tu pdfGenerator)
  const handleDownload = () => {
    toast.info("Generando reporte PDF oficial...");
    // generateResultsPDF(foundOrder, foundOrder.pacientes, ...);
  };

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8">
      <div className="max-w-2xl mx-auto space-y-8">
        
        {/* Header con identidad del laboratorio */}
        <div className="text-center space-y-4 py-6">
          <div className="mx-auto w-20 h-20 rounded-3xl gradient-clinical flex items-center justify-center shadow-xl shadow-blue-100 animate-in zoom-in duration-500">
            <FlaskConical className="w-10 h-10 text-white" />
          </div>
          <div className="space-y-1">
            <h1 className="text-3xl font-display font-black text-slate-800 tracking-tight">{labName}</h1>
            <p className="text-slate-500 font-medium italic text-sm">Portal de Resultados en Línea</p>
          </div>
        </div>

        {!foundOrder ? (
          <Card className="shadow-2xl border-0 overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="h-2 gradient-clinical w-full" />
            <CardHeader className="text-center pb-2 pt-8">
              <CardTitle className="text-xl font-display font-bold text-slate-700">Acceso a Pacientes</CardTitle>
              <p className="text-sm text-slate-400">Consulte su reporte clínico de forma segura</p>
            </CardHeader>
            <CardContent className="space-y-6 p-8">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase text-slate-500 ml-1">Código de Orden</Label>
                  <div className="relative group">
                    <Search className="absolute left-3 top-3 w-4 h-4 text-slate-400 group-focus-within:text-primary transition-colors" />
                    <Input 
                      className="pl-10 h-12 bg-slate-50 border-slate-200 focus:bg-white transition-all" 
                      placeholder="Ej: ORD-2024-XXXX" 
                      value={code} 
                      onChange={e => setCode(e.target.value.toUpperCase())} 
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase text-slate-500 ml-1">Clave de Acceso</Label>
                  <div className="relative group">
                    <Lock className="absolute left-3 top-3 w-4 h-4 text-slate-400 group-focus-within:text-primary transition-colors" />
                    <Input 
                      className="pl-10 h-12 bg-slate-50 border-slate-200 focus:bg-white transition-all font-mono" 
                      placeholder="******" 
                      value={accessKey} 
                      onChange={e => setAccessKey(e.target.value.toUpperCase())} 
                      type="text"
                    />
                  </div>
                </div>
              </div>

              {error && (
                <div className="p-3 rounded-lg bg-rose-50 border border-rose-100 text-rose-600 text-sm font-medium text-center animate-shake">
                  {error}
                </div>
              )}

              <Button 
                onClick={handleSearch} 
                disabled={loading}
                className="w-full h-12 gradient-clinical text-primary-foreground border-0 text-lg font-bold shadow-lg shadow-blue-200 hover:scale-[1.02] active:scale-[0.98] transition-all"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Consultar Resultados"}
              </Button>
              
              <p className="text-[11px] text-slate-400 text-center px-4 leading-relaxed">
                Su código y clave de acceso se encuentran impresos en el ticket entregado en recepción.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6 animate-in fade-in zoom-in-95 duration-500">
            {/* Cabecera de resultados encontrados */}
            <div className="flex items-center justify-between">
              <Button variant="ghost" onClick={() => setFoundOrder(null)} className="text-slate-500 hover:text-primary">
                <ChevronLeft className="w-4 h-4 mr-1" /> Nueva Consulta
              </Button>
              <Button onClick={handleDownload} className="gradient-clinical text-primary-foreground border-0 shadow-md">
                <Download className="w-4 h-4 mr-2" /> Descargar Reporte Ofical
              </Button>
            </div>

            <Card className="bg-white border-0 shadow-xl ring-1 ring-slate-100">
              <CardContent className="p-6">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-sm">
                  <div className="space-y-1">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Paciente</p>
                    <p className="font-bold text-slate-800">{foundOrder.pacientes?.name}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">No. Orden</p>
                    <p className="font-mono font-bold text-blue-600">{foundOrder.code}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Fecha</p>
                    <p className="font-bold text-slate-800">{new Date(foundOrder.created_at).toLocaleDateString()}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Edad</p>
                    <p className="font-bold text-slate-800">{calcAge(foundOrder.pacientes?.birth_date)} años</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Lista de Pruebas y Resultados */}
            <div className="space-y-4">
              {foundOrder.resultados.map((res: any) => (
                <Card key={res.id} className="border-0 shadow-lg overflow-hidden">
                  <div className="bg-slate-50 px-6 py-3 border-b border-slate-100">
                    <h3 className="font-display font-bold text-primary flex items-center gap-2">
                      <FileText className="w-4 h-4" /> {res.pruebas.name}
                    </h3>
                  </div>
                  <CardContent className="p-0">
                    <div className="divide-y divide-slate-50">
                      {res.resultado_detalle.map((det: any) => (
                        <div key={det.id} className="flex items-center justify-between p-5 hover:bg-slate-50/50 transition-colors">
                          <div className="space-y-1">
                            <p className="font-bold text-slate-700 text-sm">{det.parametros_prueba.name}</p>
                            <p className="text-[10px] text-slate-400 font-mono italic">
                              Rango ref: {det.applied_range_min} - {det.applied_range_max} {det.parametros_prueba.unit}
                            </p>
                          </div>
                          <div className="flex items-center gap-4">
                            <div className="text-right">
                              <span className="text-lg font-black text-slate-800">{det.value}</span>
                              <span className="text-[10px] font-bold text-slate-400 ml-1">{det.parametros_prueba.unit}</span>
                            </div>
                            <Badge 
                              className={`
                                font-bold px-3 py-1 rounded-full text-[10px]
                                ${det.status === 'normal' 
                                  ? 'bg-emerald-50 text-emerald-600 border-emerald-100' 
                                  : 'bg-rose-50 text-rose-600 border-rose-100'}
                              `}
                              variant="outline"
                            >
                              {det.status === 'normal' ? '✓ Normal' : det.status === 'high' ? 'Alto ↑' : 'Bajo ↓'}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
            
            <p className="text-center text-[10px] text-slate-400 pt-4">
              Este documento es una consulta informativa. Para fines legales o médicos, utilice el PDF firmado electrónicamente.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}