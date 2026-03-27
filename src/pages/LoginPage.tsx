import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

// LIBRERÍA MODERNA SIN DEPENDENCIAS DE NODE/BUFFER
import * as OTPAuth from 'otpauth';
import * as QRCode from 'qrcode';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { FlaskConical, Lock, User, ShieldCheck, ArrowLeft, Building2 } from 'lucide-react';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [loading, setLoading] = useState(false);

  // Estado para la identidad del laboratorio
  const [labConfig, setLabConfig] = useState<{ name: string; logo: string } | null>(null);

  // Estados 2FA
  const [showOtp, setShowOtp] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [isFirstTime, setIsFirstTime] = useState(false);
  const [tempUser, setTempUser] = useState<any>(null);

  // Cargar configuración al montar el componente
  useEffect(() => {
    const fetchLabConfig = async () => {
      const { data } = await supabase
        .from('configuracion_laboratorio')
        .select('name, logo')
        .maybeSingle();
      if (data) setLabConfig(data);
    };
    fetchLabConfig();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setLoading(true);

    try {
      if (showOtp) {
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
          setErrorMsg("Código incorrecto o expirado");
          toast.error("Validación fallida");
          setLoading(false);
          return;
        }

        if (isFirstTime) {
          const { error: updateError } = await supabase
            .from('usuarios')
            .update({ 
              two_factor_enabled: true, 
              two_factor_secret: tempUser.two_factor_secret 
            })
            .eq('id', tempUser.id);

          if (updateError) throw new Error("Error al activar 2FA");
        }

        return completeLogin(tempUser);
      }

      const { data, error } = await supabase.rpc("login_usuario", {
        username_input: username,
        password_input: password
      });

      if (error || !data || data.length === 0) {
        setErrorMsg("Credenciales incorrectas");
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
          secret: secret,
        });

        const qrUrl = await QRCode.toDataURL(totp.toString());

        setTempUser({ ...user, two_factor_secret: secretBase32 });
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
      setErrorMsg("Error en el sistema de autenticación");
    } finally {
      setLoading(false);
    }
  };

  const completeLogin = (user: any) => {
    login({ id: user.id, username: user.username, role: user.role, name: user.name });
    toast.success(`Bienvenido ${user.name}`);
    navigate("/admin");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      {/* Fondo decorativo sutil */}
      <div className="absolute inset-0 opacity-[0.03] pointer-events-none" 
           style={{ backgroundImage: 'radial-gradient(#0f172a 1px, transparent 1px)', size: '20px 20px' }} />

      <Card className="w-full max-w-md shadow-2xl border-0 overflow-hidden bg-white/80 backdrop-blur-sm">
        <div className="h-2 gradient-clinical w-full" />
        <CardHeader className="text-center pt-8">
          <div className="mx-auto w-20 h-20 rounded-2xl bg-white shadow-md flex items-center justify-center mb-4 border border-slate-100 p-2">
            {labConfig?.logo ? (
              <img src={labConfig.logo} alt="Logo Laboratorio" className="max-w-full max-h-full object-contain" />
            ) : (
              <div className="w-full h-full gradient-clinical rounded-xl flex items-center justify-center">
                {showOtp ? <ShieldCheck className="text-white w-10 h-10" /> : <FlaskConical className="text-white w-10 h-10" />}
              </div>
            )}
          </div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">
            {labConfig?.name || 'BioAnalítica'}
          </h1>
          <p className="text-xs text-muted-foreground uppercase tracking-widest font-semibold">
            {showOtp ? "Verificación de Seguridad" : "Sistema de Gestión"}
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
                    <Input className="pl-10 h-11 border-slate-200" value={username} onChange={e => setUsername(e.target.value)} placeholder="Ej: admin_lab" required />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-slate-600">Contraseña</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                    <Input type="password" title="password" className="pl-10 h-11 border-slate-200" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" required />
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-4 text-center">
                {isFirstTime && (
                  <div className="p-4 bg-primary/5 rounded-xl border border-primary/10 mb-2">
                    <p className="text-[10px] font-bold text-primary uppercase mb-3">Vincula tu cuenta</p>
                    <div className="bg-white p-2 rounded-lg inline-block shadow-sm border">
                      <img src={qrCodeUrl} className="w-40 h-40" alt="QR Code" />
                    </div>
                    <p className="text-[10px] mt-3 text-slate-500 leading-relaxed italic">
                      Escanea este código con tu App de autenticación.
                    </p>
                  </div>
                )}
                <div className="space-y-2">
                  <Label className="text-slate-600">Código de seguridad</Label>
                  <Input 
                    className="text-center text-3xl h-14 tracking-[0.3em] font-mono font-bold border-2 border-primary/20 focus:border-primary" 
                    value={otpCode} 
                    onChange={e => setOtpCode(e.target.value.replace(/\D/g, '').slice(0,6))}
                    placeholder="000000"
                    autoFocus
                  />
                  <p className="text-[10px] text-muted-foreground">Ingresa los 6 dígitos de tu aplicación</p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setShowOtp(false)} className="text-slate-500 hover:text-primary">
                   <ArrowLeft className="w-3 h-3 mr-2" /> Usar otra cuenta
                </Button>
              </div>
            )}

            {errorMsg && (
              <div className="p-3 rounded-lg bg-red-50 text-red-600 text-xs font-medium text-center border border-red-100">
                {errorMsg}
              </div>
            )}

            <Button type="submit" className="w-full gradient-clinical h-12 text-md font-bold shadow-lg" disabled={loading}>
              {loading ? "Procesando..." : (showOtp ? "Verificar y Entrar" : "Iniciar Sesión")}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}