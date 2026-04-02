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

type AuthUser = {
  id: string;
  username: string;
  role: string;
  name: string;
  two_factor_enabled?: boolean;
  two_factor_secret?: string | null;
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
  const [tempUser, setTempUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    const fetchLabConfig = async () => {
      const { data } = await supabase
        .from('configuracion_laboratorio')
        .select('name, logo')
        .maybeSingle();

      if (data) {
        setLabConfig({
          name: data.name || 'BioAnalítica',
          logo: data.logo || null,
        });
      }
    };

    fetchLabConfig();
  }, []);

  const getDeviceName = () => {
    const ua = navigator.userAgent;
    return ua;
  };

  const getPublicIp = async (): Promise<string | null> => {
    try {
      const res = await fetch('https://api.ipify.org?format=json');
      const data = await res.json();
      return data?.ip || null;
    } catch {
      return null;
    }
  };

  const registrarLogAcceso = async (
    usuarioId: string | null,
    evento: string,
    extra?: any
  ) => {
    const ip = await getPublicIp();

    await supabase.from('logs_acceso').insert({
      usuario_id: usuarioId,
      evento,
      ip_address: ip,
      user_agent: navigator.userAgent,
      detalles: {
        dispositivo: getDeviceName(),
        ...extra,
      },
    });
  };

  const completeLogin = async (user: AuthUser) => {
    await registrarLogAcceso(user.id, 'LOGIN_EXITOSO');

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
      // ======================
      // VALIDACIÓN OTP
      // ======================
      if (showOtp) {
        if (!tempUser) throw new Error('No hay sesión OTP');

        const totp = new OTPAuth.TOTP({
          issuer: labConfig?.name || 'BioAnalítica',
          label: tempUser.username,
          algorithm: 'SHA1',
          digits: 6,
          period: 30,
          secret: OTPAuth.Secret.fromBase32(
            tempUser.two_factor_secret || ''
          ),
        });

        const delta = totp.validate({
          token: otpCode,
          window: 1,
        });

        if (delta === null) {
          await registrarLogAcceso(tempUser.id, 'OTP_FALLIDO');
          setErrorMsg('Código incorrecto');
          setLoading(false);
          return;
        }

        // 🔥 ACTIVAR 2FA SOLO LA PRIMERA VEZ
        if (isFirstTime) {
          await supabase
            .from('usuarios')
            .update({
              two_factor_enabled: true,
              two_factor_secret: tempUser.two_factor_secret,
            })
            .eq('id', tempUser.id);

          await registrarLogAcceso(tempUser.id, '2FA_ACTIVADO');
        }

        await completeLogin(tempUser);
        return;
      }

      // ======================
      // LOGIN NORMAL
      // ======================
      const { data } = await supabase.rpc('login_usuario', {
        username_input: username,
        password_input: password,
      });

      if (!data || data.length === 0) {
        await registrarLogAcceso(null, 'LOGIN_FALLIDO', { username });
        setErrorMsg('Credenciales incorrectas');
        return;
      }

      const user: AuthUser = data[0];

      // ======================
      // SI NO TIENE 2FA → GENERAR
      // ======================
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

        const qr = await QRCode.toDataURL(totp.toString());

        // 🔥 GUARDAR SECRET DESDE YA
        await supabase
          .from('usuarios')
          .update({
            two_factor_secret: secretBase32,
          })
          .eq('id', user.id);

        setTempUser({
          ...user,
          two_factor_secret: secretBase32,
        });

        setQrCodeUrl(qr);
        setIsFirstTime(true);
        setShowOtp(true);

        return;
      }

      // ======================
      // SI YA TIENE 2FA
      // ======================
      setTempUser(user);
      setIsFirstTime(false);
      setShowOtp(true);
    } catch (err: any) {
      console.error(err);
      setErrorMsg('Error en autenticación');
    } finally {
      setLoading(false);
    }
  };

  const resetLogin = () => {
    setShowOtp(false);
    setOtpCode('');
    setTempUser(null);
    setPassword('');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="text-center">
          <h1 className="text-xl font-bold">
            {labConfig?.name || 'BioAnalítica'}
          </h1>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {!showOtp ? (
              <>
                <div>
                  <Label>Usuario</Label>
                  <Input
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                  />
                </div>

                <div>
                  <Label>Contraseña</Label>
                  <Input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
              </>
            ) : (
              <>
                {isFirstTime && (
                  <div className="text-center">
                    <img src={qrCodeUrl} className="mx-auto w-40" />
                    <p className="text-xs mt-2">
                      Escanea con Google Authenticator
                    </p>
                  </div>
                )}

                <Input
                  value={otpCode}
                  onChange={(e) =>
                    setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))
                  }
                  placeholder="000000"
                  className="text-center text-2xl"
                />

                <Button
                  type="button"
                  variant="ghost"
                  onClick={resetLogin}
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Cambiar cuenta
                </Button>
              </>
            )}

            {errorMsg && (
              <div className="text-red-500 text-sm text-center">
                {errorMsg}
              </div>
            )}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading
                ? 'Procesando...'
                : showOtp
                ? 'Verificar'
                : 'Ingresar'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}