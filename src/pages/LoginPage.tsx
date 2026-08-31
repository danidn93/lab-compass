import React, {
  useEffect,
  useState,
} from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

import * as OTPAuth from 'otpauth';
import * as QRCode from 'qrcode';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardHeader,
} from '@/components/ui/card';

import {
  FlaskConical,
  Lock,
  User,
  ShieldCheck,
  ArrowLeft,
} from 'lucide-react';

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

  const [username, setUsername] =
    useState('');

  const [password, setPassword] =
    useState('');

  const [errorMsg, setErrorMsg] =
    useState('');

  const [loading, setLoading] =
    useState(false);

  const [labConfig, setLabConfig] =
    useState<LabConfig | null>(null);

  const [showOtp, setShowOtp] =
    useState(false);

  const [otpCode, setOtpCode] =
    useState('');

  const [qrCodeUrl, setQrCodeUrl] =
    useState('');

  const [isFirstTime, setIsFirstTime] =
    useState(false);

  const [tempUser, setTempUser] =
    useState<AuthUser | null>(null);

  // =========================================================
  // CARGAR CONFIGURACIÓN DEL LABORATORIO
  // =========================================================
  useEffect(() => {
    const fetchLabConfig = async () => {
      try {
        const { data, error } =
          await supabase
            .from(
              'configuracion_laboratorio',
            )
            .select('name, logo')
            .maybeSingle();

        if (error) {
          console.error(
            'Error cargando configuración del laboratorio:',
            error,
          );
          return;
        }

        if (data) {
          setLabConfig({
            name:
              data.name ||
              'BioAnalítica',
            logo:
              data.logo ||
              null,
          });
        }
      } catch (err) {
        console.error(
          'Error inesperado cargando configuración:',
          err,
        );
      }
    };

    void fetchLabConfig();
  }, []);

  // =========================================================
  // INFORMACIÓN DEL DISPOSITIVO
  // =========================================================
  const getBrowserName = (
    ua: string,
  ) => {
    if (/Edg/i.test(ua)) {
      return 'Microsoft Edge';
    }

    if (/OPR|Opera/i.test(ua)) {
      return 'Opera';
    }

    if (
      /Chrome/i.test(ua) &&
      !/Edg/i.test(ua)
    ) {
      return 'Chrome';
    }

    if (
      /Safari/i.test(ua) &&
      !/Chrome/i.test(ua)
    ) {
      return 'Safari';
    }

    if (/Firefox/i.test(ua)) {
      return 'Firefox';
    }

    if (/MSIE|Trident/i.test(ua)) {
      return 'Internet Explorer';
    }

    return 'Desconocido';
  };

  const getOSName = (
    ua: string,
  ) => {
    if (/Windows NT/i.test(ua)) {
      return 'Windows';
    }

    if (/Mac OS X/i.test(ua)) {
      return 'macOS';
    }

    if (/Android/i.test(ua)) {
      return 'Android';
    }

    if (
      /iPhone|iPad|iPod/i.test(
        ua,
      )
    ) {
      return 'iOS';
    }

    if (/Linux/i.test(ua)) {
      return 'Linux';
    }

    return 'Desconocido';
  };

  const getDeviceType = (
    ua: string,
  ) => {
    if (/iPad|Tablet/i.test(ua)) {
      return 'Tablet';
    }

    if (
      /Mobi|Android|iPhone|iPod/i.test(
        ua,
      )
    ) {
      return 'Móvil';
    }

    return 'Escritorio';
  };

  const getDeviceName = () => {
    const ua = navigator.userAgent;

    const browser =
      getBrowserName(ua);

    const os =
      getOSName(ua);

    const deviceType =
      getDeviceType(ua);

    return `${deviceType} - ${os} - ${browser}`;
  };

  // =========================================================
  // OBTENER IP
  // =========================================================
  const getPublicIp =
    async (): Promise<
      string | null
    > => {
      try {
        const response =
          await fetch(
            'https://api.ipify.org?format=json',
          );

        if (!response.ok) {
          return null;
        }

        const data =
          await response.json();

        return data?.ip || null;
      } catch (error) {
        console.error(
          'No se pudo obtener la IP pública:',
          error,
        );

        return null;
      }
    };

  // =========================================================
  // REGISTRAR LOG
  // =========================================================
  const registrarLogAcceso =
    async (
      usuarioId: string | null,
      evento: string,
      extraDetalles?: Record<
        string,
        unknown
      >,
    ) => {
      try {
        const userAgent =
          navigator.userAgent ||
          null;

        const ip =
          await getPublicIp();

        const nombreDispositivo =
          getDeviceName();

        const detalles = {
          nombre_dispositivo:
            nombreDispositivo,

          navegador:
            getBrowserName(
              userAgent || '',
            ),

          sistema_operativo:
            getOSName(
              userAgent || '',
            ),

          tipo_dispositivo:
            getDeviceType(
              userAgent || '',
            ),

          ...extraDetalles,
        };

        const { error } =
          await supabase
            .from('logs_acceso')
            .insert({
              usuario_id:
                usuarioId,

              evento,

              ip_address:
                ip,

              user_agent:
                userAgent,

              detalles,
            });

        if (error) {
          console.error(
            'Error registrando log de acceso:',
            error,
          );
        }
      } catch (err) {
        console.error(
          'Error inesperado registrando log de acceso:',
          err,
        );
      }
    };

  // =========================================================
  // NORMALIZAR SECRET BASE32
  // =========================================================
  const normalizeOtpSecret = (
    value: string,
  ) => {
    return value
      .replace(/\s+/g, '')
      .replace(/=+$/g, '')
      .toUpperCase();
  };

  // =========================================================
  // CREAR TOTP
  // =========================================================
  const createTotp = (
    secretBase32: string,
    user: AuthUser,
  ) => {
    const normalizedSecret =
      normalizeOtpSecret(
        secretBase32,
      );

    const secret =
      OTPAuth.Secret.fromBase32(
        normalizedSecret,
      );

    return new OTPAuth.TOTP({
      issuer:
        labConfig?.name ||
        'BioAnalítica',

      label:
        user.username,

      algorithm:
        'SHA1',

      digits:
        6,

      period:
        30,

      secret,
    });
  };

  // =========================================================
  // CREAR SESIÓN PROPIA SEGURA
  // =========================================================
  const createSecureSession =
    async (
      user: AuthUser,
      otp: string,
    ) => {
      const cleanOtp =
        otp
          .replace(/\D/g, '')
          .trim();

      const cleanUsername =
        user.username.trim();

      if (!password) {
        throw new Error(
          'No se conserva la contraseña necesaria para crear la sesión segura.',
        );
      }

      const { data, error } =
        await supabase.functions.invoke(
          'usuario-session',
          {
            body: {
              action: 'login',
              username:
                cleanUsername,
              password,
              otp:
                cleanOtp,
            },
          },
        );

      if (error) {
        throw new Error(
          error.message ||
            'No se pudo crear la sesión segura.',
        );
      }

      if (
        !data?.ok ||
        !data?.session_token ||
        !data?.user
      ) {
        throw new Error(
          data?.message ||
            'No se pudo crear la sesión segura.',
        );
      }

      return {
        sessionToken:
          String(
            data.session_token,
          ),

        user: {
          id:
            String(data.user.id),
          username:
            String(
              data.user.username,
            ),
          role:
            String(
              data.user.role,
            ),
          name:
            String(data.user.name),
        },
      };
    };

  // =========================================================
  // COMPLETAR LOGIN
  // =========================================================
  const completeLogin =
    async (
      user: AuthUser,
      otp: string,
    ) => {
      /*
       * La Edge vuelve a validar usuario + contraseña + OTP antes de emitir
       * el token. De esta forma result-validation no depende de Supabase Auth.
       */
      const secureSession =
        await createSecureSession(
          user,
          otp,
        );

      await registrarLogAcceso(
        user.id,
        'LOGIN_EXITOSO',
        {
          username:
            user.username,

          metodo_autenticacion:
            user.two_factor_enabled
              ? 'PASSWORD + OTP'
              : 'PASSWORD',
        },
      );

      login(
        secureSession.user,
        secureSession.sessionToken,
      );

      toast.success(
        `Bienvenido ${secureSession.user.name}`,
      );

      navigate('/admin');
    };

  // =========================================================
  // PREPARAR CONFIGURACIÓN 2FA
  // =========================================================
  const setupFirstTime2FA =
    async (
      user: AuthUser,
    ) => {
      let secretBase32: string;

      if (
        user.two_factor_secret
      ) {
        secretBase32 =
          normalizeOtpSecret(
            user.two_factor_secret,
          );
      } else {
        const generatedSecret =
          new OTPAuth.Secret({
            size: 20,
          });

        secretBase32 =
          normalizeOtpSecret(
            generatedSecret.base32,
          );

        const {
          error: saveSecretError,
        } =
          await supabase
            .from('usuarios')
            .update({
              two_factor_secret:
                secretBase32,

              two_factor_enabled:
                false,
            })
            .eq(
              'id',
              user.id,
            );

        if (
          saveSecretError
        ) {
          console.error(
            'Error guardando secreto 2FA:',
            saveSecretError,
          );

          throw new Error(
            `No se pudo guardar el secreto 2FA: ${saveSecretError.message}`,
          );
        }
      }

      const userWithSecret:
        AuthUser = {
        ...user,

        two_factor_secret:
          secretBase32,

        two_factor_enabled:
          false,
      };

      const totp =
        createTotp(
          secretBase32,
          userWithSecret,
        );

      const otpAuthUrl =
        totp.toString();

      const qrUrl =
        await QRCode.toDataURL(
          otpAuthUrl,
          {
            width: 300,
            margin: 2,
            errorCorrectionLevel:
              'M',
          },
        );

      setTempUser(
        userWithSecret,
      );

      setQrCodeUrl(
        qrUrl,
      );

      setOtpCode('');

      setIsFirstTime(true);

      setShowOtp(true);

      await registrarLogAcceso(
        user.id,
        '2FA_CONFIGURACION_INICIADA',
        {
          username:
            user.username,
        },
      );
    };

  // =========================================================
  // VALIDAR OTP
  // =========================================================
  const validateOtp =
    async () => {
      if (!tempUser) {
        setErrorMsg(
          'No se encontró la sesión temporal',
        );

        return false;
      }

      if (
        !tempUser.two_factor_secret
      ) {
        setErrorMsg(
          'No existe secreto 2FA para este usuario',
        );

        return false;
      }

      const cleanOtp =
        otpCode
          .replace(/\D/g, '')
          .trim();

      if (
        cleanOtp.length !== 6
      ) {
        setErrorMsg(
          'Ingresa los 6 dígitos del código de seguridad',
        );

        toast.error(
          'Código incompleto',
        );

        return false;
      }

      try {
        const secretBase32 =
          normalizeOtpSecret(
            tempUser.two_factor_secret,
          );

        const totp =
          createTotp(
            secretBase32,
            tempUser,
          );

        const delta =
          totp.validate({
            token:
              cleanOtp,

            window:
              2,
          });

        if (
          delta === null
        ) {
          await registrarLogAcceso(
            tempUser.id,
            'OTP_FALLIDO',
            {
              username:
                tempUser.username,

              motivo:
                'Código incorrecto o expirado',
            },
          );

          setErrorMsg(
            'Código incorrecto o expirado. Verifica que la fecha y hora automática estén activadas en tu teléfono.',
          );

          toast.error(
            'Código de seguridad incorrecto',
          );

          return false;
        }

        if (
          isFirstTime
        ) {
          const {
            error: updateError,
          } =
            await supabase
              .from('usuarios')
              .update({
                two_factor_secret:
                  secretBase32,

                two_factor_enabled:
                  true,
              })
              .eq(
                'id',
                tempUser.id,
              );

          if (
            updateError
          ) {
            console.error(
              'Error activando 2FA:',
              updateError,
            );

            throw new Error(
              `No se pudo activar 2FA: ${updateError.message}`,
            );
          }

          await registrarLogAcceso(
            tempUser.id,
            '2FA_ACTIVADO',
            {
              username:
                tempUser.username,
            },
          );
        }

        await completeLogin(
          {
            ...tempUser,

            two_factor_secret:
              secretBase32,

            two_factor_enabled:
              true,
          },
          cleanOtp,
        );

        return true;
      } catch (
        otpError
      ) {
        console.error(
          'Error verificando OTP:',
          otpError,
        );

        await registrarLogAcceso(
          tempUser.id,
          'ERROR_OTP',
          {
            username:
              tempUser.username,

            mensaje:
              otpError instanceof Error
                ? otpError.message
                : 'Error desconocido',
          },
        );

        setErrorMsg(
          otpError instanceof Error
            ? otpError.message
            : 'No fue posible verificar el código de seguridad',
        );

        toast.error(
          'Error verificando autenticación',
        );

        return false;
      }
    };

  // =========================================================
  // LOGIN
  // =========================================================
  const handleSubmit =
    async (
      e: React.FormEvent,
    ) => {
      e.preventDefault();

      if (loading) {
        return;
      }

      setErrorMsg('');
      setLoading(true);

      try {
        if (
          showOtp
        ) {
          await validateOtp();
          return;
        }

        const cleanUsername =
          username.trim();

        if (
          !cleanUsername
        ) {
          setErrorMsg(
            'Ingresa el usuario',
          );
          return;
        }

        if (!password) {
          setErrorMsg(
            'Ingresa la contraseña',
          );
          return;
        }

        const {
          data,
          error,
        } =
          await supabase.rpc(
            'login_usuario',
            {
              username_input:
                cleanUsername,

              password_input:
                password,
            },
          );

        if (
          error ||
          !data ||
          data.length === 0
        ) {
          if (error) {
            console.error(
              'Error login_usuario:',
              error,
            );
          }

          await registrarLogAcceso(
            null,
            'LOGIN_FALLIDO',
            {
              username:
                cleanUsername,

              motivo:
                'Credenciales incorrectas',
            },
          );

          setErrorMsg(
            'Credenciales incorrectas',
          );

          return;
        }

        const user: AuthUser =
          data[0];

        await registrarLogAcceso(
          user.id,
          'LOGIN_PASSWORD_OK',
          {
            username:
              user.username,
          },
        );

        if (
          !user.two_factor_enabled
        ) {
          await setupFirstTime2FA(
            user,
          );
          return;
        }

        if (
          !user.two_factor_secret
        ) {
          await registrarLogAcceso(
            user.id,
            'ERROR_CONFIGURACION_2FA',
            {
              username:
                user.username,

              motivo:
                '2FA habilitado sin secreto',
            },
          );

          throw new Error(
            'La cuenta tiene autenticación de dos factores habilitada pero no posee un secreto configurado.',
          );
        }

        setTempUser({
          ...user,

          two_factor_secret:
            normalizeOtpSecret(
              user.two_factor_secret,
            ),
        });

        setQrCodeUrl('');
        setOtpCode('');
        setIsFirstTime(false);
        setShowOtp(true);

        await registrarLogAcceso(
          user.id,
          'OTP_SOLICITADO',
          {
            username:
              user.username,
          },
        );
      } catch (err) {
        console.error(
          'Error autenticación:',
          err,
        );

        await registrarLogAcceso(
          tempUser?.id || null,
          'ERROR_AUTENTICACION',
          {
            username:
              tempUser?.username ||
              username ||
              null,

            mensaje:
              err instanceof Error
                ? err.message
                : 'Error desconocido',
          },
        );

        setErrorMsg(
          err instanceof Error
            ? err.message
            : 'Error en el sistema de autenticación',
        );

        toast.error(
          'No se pudo completar el inicio de sesión',
        );
      } finally {
        setLoading(false);
      }
    };

  // =========================================================
  // USAR OTRA CUENTA
  // =========================================================
  const handleUseAnotherAccount =
    async () => {
      if (loading) {
        return;
      }

      if (
        tempUser
      ) {
        await registrarLogAcceso(
          tempUser.id,
          'CAMBIO_DE_CUENTA_EN_OTP',
          {
            username:
              tempUser.username,
          },
        );
      }

      setShowOtp(false);
      setOtpCode('');
      setQrCodeUrl('');
      setIsFirstTime(false);
      setTempUser(null);
      setPassword('');
      setErrorMsg('');
    };

  // =========================================================
  // RENDER
  // =========================================================
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4 relative overflow-hidden">
      <div
        className="absolute inset-0 opacity-[0.03] pointer-events-none"
        style={{
          backgroundImage:
            'radial-gradient(#0f172a 1px, transparent 1px)',
          backgroundSize:
            '20px 20px',
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
            {labConfig?.name ||
              'BioAnalítica'}
          </h1>

          <p className="text-xs text-muted-foreground uppercase tracking-widest font-semibold mt-1">
            {showOtp
              ? isFirstTime
                ? 'Configurar autenticación'
                : 'Verificación de Seguridad'
              : 'Sistema de Gestión'}
          </p>

          {showOtp &&
            tempUser && (
              <p className="text-xs text-slate-500 mt-2">
                Cuenta:{' '}
                <span className="font-semibold text-slate-700">
                  {tempUser.username}
                </span>
              </p>
            )}
        </CardHeader>

        <CardContent className="pb-8">
          <form
            onSubmit={handleSubmit}
            className="space-y-4"
          >
            {!showOtp ? (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-slate-600">
                    Usuario
                  </Label>

                  <div className="relative">
                    <User className="absolute left-3 top-3.5 w-4 h-4 text-slate-400" />

                    <Input
                      className="pl-10 h-11 border-slate-200"
                      value={username}
                      onChange={(e) => {
                        setUsername(
                          e.target.value,
                        );

                        if (
                          errorMsg
                        ) {
                          setErrorMsg('');
                        }
                      }}
                      placeholder="Ej: admin_lab"
                      autoComplete="username"
                      disabled={loading}
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-slate-600">
                    Contraseña
                  </Label>

                  <div className="relative">
                    <Lock className="absolute left-3 top-3.5 w-4 h-4 text-slate-400" />

                    <Input
                      type="password"
                      title="password"
                      className="pl-10 h-11 border-slate-200"
                      value={password}
                      onChange={(e) => {
                        setPassword(
                          e.target.value,
                        );

                        if (
                          errorMsg
                        ) {
                          setErrorMsg('');
                        }
                      }}
                      placeholder="••••••••"
                      autoComplete="current-password"
                      disabled={loading}
                      required
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-4 text-center">
                {isFirstTime &&
                  qrCodeUrl && (
                    <div className="p-4 bg-primary/5 rounded-xl border border-primary/10 mb-2">
                      <p className="text-[11px] font-bold text-primary uppercase mb-3">
                        Vincula tu cuenta
                      </p>

                      <p className="text-xs text-slate-600 mb-4">
                        Escanea este código una sola vez con Google Authenticator,
                        Microsoft Authenticator u otra aplicación compatible.
                      </p>

                      <div className="bg-white p-3 rounded-xl inline-block shadow-sm border">
                        <img
                          src={qrCodeUrl}
                          className="w-48 h-48"
                          alt="Código QR para autenticación de dos factores"
                        />
                      </div>

                      <p className="text-[11px] mt-4 text-slate-500 leading-relaxed">
                        Después de escanear el QR, espera que la aplicación genere
                        un código de 6 dígitos e ingrésalo abajo.
                      </p>
                    </div>
                  )}

                {!isFirstTime && (
                  <div className="p-3 bg-slate-50 border rounded-lg">
                    <div className="flex items-center justify-center gap-2 text-slate-600">
                      <ShieldCheck className="w-4 h-4" />

                      <span className="text-xs font-medium">
                        Abre tu aplicación Authenticator e ingresa el código actual.
                      </span>
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <Label className="text-slate-600">
                    Código de seguridad
                  </Label>

                  <Input
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    className="text-center text-3xl h-14 tracking-[0.3em] font-mono font-bold border-2 border-primary/20 focus:border-primary"
                    value={otpCode}
                    onChange={(e) => {
                      const value =
                        e.target.value
                          .replace(
                            /\D/g,
                            '',
                          )
                          .slice(
                            0,
                            6,
                          );

                      setOtpCode(value);

                      if (
                        errorMsg
                      ) {
                        setErrorMsg('');
                      }
                    }}
                    placeholder="000000"
                    maxLength={6}
                    autoFocus
                    disabled={loading}
                  />

                  <p className="text-[10px] text-muted-foreground">
                    Ingresa los 6 dígitos de tu aplicación
                  </p>
                </div>

                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={
                    handleUseAnotherAccount
                  }
                  disabled={loading}
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
              disabled={
                loading ||
                (showOtp &&
                  otpCode.length !== 6)
              }
            >
              {loading
                ? 'Procesando...'
                : showOtp
                  ? isFirstTime
                    ? 'Verificar y Activar'
                    : 'Verificar y Entrar'
                  : 'Iniciar Sesión'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
