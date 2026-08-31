import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  AlertTriangle,
  CheckCircle2,
  FileWarning,
  Loader2,
  QrCode,
  ShieldCheck,
  Upload,
} from 'lucide-react';

import { supabase } from '@/lib/supabaseClient';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

async function sha256File(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const digest = await crypto.subtle.digest('SHA-256', buffer);

  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

type VerifyResponse = {
  ok?: boolean;
  exists?: boolean;
  valid?: boolean;
  status?: string;
  record_valid?: boolean;
  file_checked?: boolean;
  file_matches?: boolean | null;
  order_code?: string;
  finalized_at?: string | null;
  fingerprint?: string;
  message?: string;
};

export default function ValidarResultadosPage() {
  const { token = '' } = useParams<{ token: string }>();

  const [loading, setLoading] = useState(true);
  const [checkingFile, setCheckingFile] = useState(false);
  const [result, setResult] = useState<VerifyResponse | null>(null);
  const [error, setError] = useState('');

  const isPreview = token === 'vista-previa';

  const verify = async (fileSha256?: string) => {
    if (!token || isPreview) return;

    const { data, error: invokeError } = await supabase.functions.invoke('result-validation', {
      body: {
        action: 'verify',
        token,
        file_sha256: fileSha256 || null,
      },
    });

    if (invokeError) throw invokeError;
    setResult(data || null);
  };

  useEffect(() => {
    if (isPreview) {
      setLoading(false);
      return;
    }

    let active = true;

    (async () => {
      try {
        setLoading(true);
        setError('');
        await verify();
      } catch (err: any) {
        if (!active) return;
        setError(err?.message || 'No se pudo validar el documento');
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [token, isPreview]);

  const status = useMemo(() => {
    if (isPreview) return 'preview';
    if (!result?.exists) return 'invalid';
    if (result?.status === 'PENDIENTE') return 'pending';
    if (result.file_checked && result.file_matches === false) return 'modified';
    if (result.valid && result.file_checked && result.file_matches === true) return 'verified';
    if (result.record_valid) return 'registered';
    return 'invalid';
  }, [isPreview, result]);

  const handleFile = async (file?: File | null) => {
    if (!file) return;

    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      setError('Seleccione un archivo PDF.');
      return;
    }

    try {
      setCheckingFile(true);
      setError('');
      const hash = await sha256File(file);
      await verify(hash);
    } catch (err: any) {
      setError(err?.message || 'No se pudo comprobar el PDF');
    } finally {
      setCheckingFile(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="flex items-center gap-3 text-slate-600">
          <Loader2 className="h-5 w-5 animate-spin" />
          Validando documento...
        </div>
      </div>
    );
  }

  const visual = {
    preview: {
      icon: QrCode,
      title: 'Vista previa',
      text: 'Este QR pertenece a una vista previa y todavía no constituye una validación emitida.',
      box: 'border-amber-200 bg-amber-50 text-amber-800',
    },
    pending: {
      icon: Loader2,
      title: 'Validación en proceso',
      text: result?.message || 'El documento existe, pero su firma todavía se está finalizando. Intente nuevamente en unos segundos.',
      box: 'border-amber-200 bg-amber-50 text-amber-800',
    },
    registered: {
      icon: ShieldCheck,
      title: 'Código de validación auténtico',
      text:
        result?.message ||
        'El documento está registrado. Puede seleccionar el PDF para comprobar que no haya sido editado.',
      box: 'border-blue-200 bg-blue-50 text-blue-800',
    },
    verified: {
      icon: CheckCircle2,
      title: 'Documento auténtico e íntegro',
      text: result?.message || 'La huella coincide exactamente con el PDF emitido por el laboratorio.',
      box: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    },
    modified: {
      icon: FileWarning,
      title: 'PDF modificado',
      text:
        result?.message ||
        'El archivo seleccionado no coincide con el documento original emitido por el laboratorio.',
      box: 'border-red-200 bg-red-50 text-red-800',
    },
    invalid: {
      icon: AlertTriangle,
      title: 'Documento no válido',
      text: result?.message || 'No existe una validación activa para este código.',
      box: 'border-red-200 bg-red-50 text-red-800',
    },
  }[status];

  const StatusIcon = visual.icon;

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-10">
      <div className="mx-auto max-w-xl">
        <Card className="overflow-hidden rounded-3xl border-slate-200 shadow-xl">
          <div className="border-b bg-white px-6 py-6 text-center">
            <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center">
              <img
                src={new URL(
                  `${String(import.meta.env.BASE_URL || '/').replace(/\/?$/, '/') }validacion-resultados.png`,
                  window.location.origin
                ).toString()}
                alt="Validación de resultados"
                className="max-h-20 max-w-20 object-contain"
              />
            </div>
            <h1 className="text-2xl font-bold text-slate-900">Validación de resultados</h1>
            <p className="mt-2 text-sm text-slate-500">
              Esta página no muestra resultados clínicos ni valores del paciente.
            </p>
          </div>

          <CardContent className="space-y-5 p-6">
            <div className={`rounded-2xl border p-5 ${visual.box}`}>
              <div className="flex items-start gap-3">
                <StatusIcon className="mt-0.5 h-6 w-6 shrink-0" />
                <div>
                  <div className="font-bold">{visual.title}</div>
                  <div className="mt-1 text-sm leading-6">{visual.text}</div>
                </div>
              </div>
            </div>

            {!isPreview && result?.exists && (
              <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-700">
                <div className="flex justify-between gap-4 border-b py-2">
                  <span className="text-slate-500">Orden</span>
                  <span className="font-semibold">{result.order_code || '—'}</span>
                </div>
                <div className="flex justify-between gap-4 border-b py-2">
                  <span className="text-slate-500">Huella SHA-256</span>
                  <span className="font-mono font-semibold">{result.fingerprint || '—'}</span>
                </div>
                <div className="flex justify-between gap-4 py-2">
                  <span className="text-slate-500">Emitido</span>
                  <span className="font-semibold">
                    {result.finalized_at ? new Date(result.finalized_at).toLocaleString('es-EC') : '—'}
                  </span>
                </div>
              </div>
            )}

            {!isPreview && result?.record_valid && (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="mb-3 text-sm font-semibold text-slate-800">
                  Comprobar que el archivo no fue editado
                </div>
                <p className="mb-4 text-xs leading-5 text-slate-500">
                  Seleccione el PDF recibido. La comprobación calcula su huella en este dispositivo y
                  compara la huella con la registrada al emitir el documento.
                </p>

                <label className="block">
                  <input
                    type="file"
                    accept="application/pdf,.pdf"
                    className="hidden"
                    disabled={checkingFile}
                    onChange={(event) => handleFile(event.target.files?.[0])}
                  />
                  <Button asChild className="w-full" disabled={checkingFile}>
                    <span>
                      {checkingFile ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Upload className="mr-2 h-4 w-4" />
                      )}
                      {checkingFile ? 'Verificando...' : 'Seleccionar PDF y verificar'}
                    </span>
                  </Button>
                </label>
              </div>
            )}

            {error && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
