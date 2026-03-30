import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

import * as OTPAuth from 'otpauth';
import * as QRCode from 'qrcode';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { FlaskConical, Lock, User, ShieldCheck, ArrowLeft } from 'lucide-react';

type LabConfig = {
  name: string;
  logo: string | null;
};

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [loading, setLoading] = useState(false);

  const [labConfig, setLabConfig] = useState<LabConfig | null>(null);

  const [showOtp, setShowOtp] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [isFirstTime, setIsFirstTime] = useState(false);
  const [tempUser, setTempUser] = useState<any>(null);

  useEffect(() => {
    const fetchLabConfig = async () => {
      try {
        const { data, error } = await supabase
          .from('configuracion_laboratorio')
          .select('name, logo')
          .maybeSingle();

        if (error) {
          console.error('Error cargando configuración del laboratorio:', error);
          return;
        }

        if (data) {
          setLabConfig({
            name: data.name || 'BioAnalítica',
            logo: data.logo || null,
          });
        }
      } catch (err) {
        console.error('Error inesperado cargando configuración:', err);
      }
    };

    fetchLabConfig();
  }, []);

  const completeLogin = (user: any) => {
    login({
      id: user.id,
      username: user.username,
      role: user.role,
      name: user.name,
    });

    toast.success(`Bienvenido ${user.name}`);
    navigate('/admin');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setLoading(true);

    try {
      if (showOtp) {
        if (!tempUser) {
          setErrorMsg('No se encontró la sesión temporal');
          setLoading(false);
          return;
        }

        const totp = new OTPAuth.TOTP({
          issuer: labConfig?.name || 'BioAnalítica',
          label: tempUser.username,
          algorithm: 'SHA1',
          digits: 6,
          period: 30,
          secret: tempUser.two_factor_secret,
        });

        const delta = totp.validate({ token: otpCode, window: 1 });

        if (delta === null) {
          setErrorMsg('Código incorrecto o expirado');
          toast.error('Validación fallida');
          setLoading(false);
          return;
        }

        if (isFirstTime) {
          const { error: updateError } = await supabase
            .from('usuarios')
            .update({
              two_factor_enabled: true,
              two_factor_secret: tempUser.two_factor_secret,
            })
            .eq('id', tempUser.id);

          if (updateError) {
            throw new Error('Error al activar 2FA');
          }
        }

        completeLogin(tempUser);
        return;
      }

      const { data, error } = await supabase.rpc('login_usuario', {
        username_input: username,
        password_input: password,
      });

      if (error || !data || data.length === 0) {
        setErrorMsg('Credenciales incorrectas');
        setLoading(false);
        return;
      }

      const user = data[0];

      if (!user.two_factor_enabled) {
        const secret = new OTPAuth.Secret();
        const secretBase32 = secret.base32;

        const totp = new OTPAuth.TOTP({
          issuer: labConfig?.name || 'BioAnalítica',
          label: user.username,
          algorithm: 'SHA1',
          digits: 6,
          period: 30,
          secret,
        });

        const qrUrl = await QRCode.toDataURL(totp.toString());

        setTempUser({
          ...user,
          two_factor_secret: secretBase32,
        });
        setQrCodeUrl(qrUrl);
        setIsFirstTime(true);
        setShowOtp(true);
      } else {
        setTempUser(user);
        setIsFirstTime(false);
        setShowOtp(true);
      }
    } catch (err) {
      console.error(err);
      setErrorMsg('Error en el sistema de autenticación');
    } finally {
      setLoading(false);
    }
  };

  const handleUseAnotherAccount = () => {
    setShowOtp(false);
    setOtpCode('');
    setQrCodeUrl('');
    setIsFirstTime(false);
    setTempUser(null);
    setPassword('');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4 relative overflow-hidden">
      <div
        className="absolute inset-0 opacity-[0.03] pointer-events-none"
        style={{
          backgroundImage: 'radial-gradient(#0f172a 1px, transparent 1px)',
          backgroundSize: '20px 20px',
        }}
      />

      <Card className="w-full max-w-md shadow-2xl border-0 overflow-hidden bg-white/85 backdrop-blur-sm relative z-10">
        <div className="h-2 gradient-clinical w-full" />

        <CardHeader className="text-center pt-8 pb-4">
          <div className="mx-auto w-24 h-24 rounded-2xl bg-white shadow-md flex items-center justify-center mb-4 border border-slate-100 p-3 overflow-hidden">
            {labConfig?.logo ? (
              <img
                src={labConfig.logo}
                alt="Logo del laboratorio"
                className="max-w-full max-h-full object-contain"
              />
            ) : (
              <div className="w-full h-full gradient-clinical rounded-xl flex items-center justify-center">
                {showOtp ? (
                  <ShieldCheck className="text-white w-10 h-10" />
                ) : (
                  <FlaskConical className="text-white w-10 h-10" />
                )}
              </div>
            )}
          </div>

          <h1 className="text-2xl font-bold text-slate-800 tracking-tight leading-tight">
            {labConfig?.name || 'BioAnalítica'}
          </h1>

          <p className="text-xs text-muted-foreground uppercase tracking-widest font-semibold mt-1">
            {showOtp ? 'Verificación de Seguridad' : 'Sistema de Gestión'}
          </p>
        </CardHeader>

        <CardContent className="pb-8">
          <form onSubmit={handleSubmit} className="space-y-4">
            {!showOtp ? (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-slate-600">Usuario</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                    <Input
                      className="pl-10 h-11 border-slate-200"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="Ej: admin_lab"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-slate-600">Contraseña</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                    <Input
                      type="password"
                      title="password"
                      className="pl-10 h-11 border-slate-200"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      required
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-4 text-center">
                {isFirstTime && (
                  <div className="p-4 bg-primary/5 rounded-xl border border-primary/10 mb-2">
                    <p className="text-[10px] font-bold text-primary uppercase mb-3">
                      Vincula tu cuenta
                    </p>

                    <div className="bg-white p-2 rounded-lg inline-block shadow-sm border">
                      <img src={qrCodeUrl} className="w-40 h-40" alt="QR Code" />
                    </div>

                    <p className="text-[10px] mt-3 text-slate-500 leading-relaxed italic">
                      Escanea este código con tu app de autenticación.
                    </p>
                  </div>
                )}

                <div className="space-y-2">
                  <Label className="text-slate-600">Código de seguridad</Label>
                  <Input
                    className="text-center text-3xl h-14 tracking-[0.3em] font-mono font-bold border-2 border-primary/20 focus:border-primary"
                    value={otpCode}
                    onChange={(e) =>
                      setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))
                    }
                    placeholder="000000"
                    autoFocus
                  />
                  <p className="text-[10px] text-muted-foreground">
                    Ingresa los 6 dígitos de tu aplicación
                  </p>
                </div>

                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleUseAnotherAccount}
                  className="text-slate-500 hover:text-primary"
                >
                  <ArrowLeft className="w-3 h-3 mr-2" />
                  Usar otra cuenta
                </Button>
              </div>
            )}

            {errorMsg && (
              <div className="p-3 rounded-lg bg-red-50 text-red-600 text-xs font-medium text-center border border-red-100">
                {errorMsg}
              </div>
            )}

            <Button
              type="submit"
              className="w-full gradient-clinical h-12 text-md font-bold shadow-lg"
              disabled={loading}
            >
              {loading ? 'Procesando...' : showOtp ? 'Verificar y Entrar' : 'Iniciar Sesión'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}