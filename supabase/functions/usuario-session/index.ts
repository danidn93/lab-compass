import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import * as OTPAuth from "npm:otpauth@9.3.6";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-lab-session-token",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json; charset=utf-8",
    },
  });
}

function bytesToHex(bytes: Uint8Array) {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function randomToken(byteLength = 32) {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return bytesToHex(bytes);
}

async function sha256Text(value: string) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );

  return bytesToHex(new Uint8Array(digest));
}

function getSessionToken(req: Request) {
  return (req.headers.get("x-lab-session-token") || "").trim();
}

function getClientIp(req: Request) {
  return (
    req.headers.get("cf-connecting-ip") ||
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    null
  );
}

async function getSessionUser(
  req: Request,
  admin: ReturnType<typeof createClient>,
) {
  const token = getSessionToken(req);

  if (!token) {
    return null;
  }

  const tokenHash = await sha256Text(token);
  const now = new Date().toISOString();

  const { data: session, error: sessionError } = await admin
    .from("usuario_sesiones")
    .select("id, usuario_id, expires_at, revoked_at")
    .eq("token_hash", tokenHash)
    .is("revoked_at", null)
    .gt("expires_at", now)
    .maybeSingle();

  if (sessionError) {
    throw sessionError;
  }

  if (!session) {
    return null;
  }

  const { data: user, error: userError } = await admin
    .from("usuarios")
    .select("id, username, role, name")
    .eq("id", session.usuario_id)
    .maybeSingle();

  if (userError) {
    throw userError;
  }

  if (!user) {
    return null;
  }

  if (user.role !== "admin" && user.role !== "laboratorist") {
    return null;
  }

  await admin
    .from("usuario_sesiones")
    .update({ last_used_at: now })
    .eq("id", session.id);

  return {
    sessionId: String(session.id),
    user: {
      id: String(user.id),
      username: String(user.username),
      role: String(user.role),
      name: String(user.name),
    },
    expiresAt: String(session.expires_at),
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  if (req.method !== "POST") {
    return json({ ok: false, message: "Método no permitido" }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const sessionHoursRaw = Number(Deno.env.get("USER_SESSION_HOURS") || "24");
  const sessionHours =
    Number.isFinite(sessionHoursRaw) && sessionHoursRaw > 0
      ? Math.min(sessionHoursRaw, 720)
      : 24;

  if (!supabaseUrl || !serviceRoleKey) {
    return json(
      {
        ok: false,
        message: "Configuración Supabase incompleta",
      },
      500,
    );
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  try {
    const body = await req.json().catch(() => ({}));
    const action = String(body?.action || "").trim().toLowerCase();

    if (action === "login") {
      const username = String(body?.username || "").trim();
      const password = String(body?.password || "");
      const otp = String(body?.otp || "").replace(/\s+/g, "").trim();

      if (!username || !password || !otp) {
        return json(
          {
            ok: false,
            message: "Usuario, contraseña y OTP son obligatorios",
          },
          400,
        );
      }

      // Reutilizamos tu autenticación real existente.
      const { data: loginRows, error: loginError } = await admin.rpc(
        "login_usuario",
        {
          username_input: username,
          password_input: password,
        },
      );

      if (loginError) {
        throw loginError;
      }

      const user = Array.isArray(loginRows) ? loginRows[0] : null;

      if (!user?.id) {
        return json(
          {
            ok: false,
            message: "Credenciales incorrectas",
          },
          401,
        );
      }

      if (user.role !== "admin" && user.role !== "laboratorist") {
        return json(
          {
            ok: false,
            message: "El usuario no tiene un rol autorizado",
          },
          403,
        );
      }

      if (!user.two_factor_enabled || !user.two_factor_secret) {
        return json(
          {
            ok: false,
            message: "El doble factor todavía no está activado para este usuario",
          },
          401,
        );
      }

      let otpValid = false;

      try {
        const normalizedSecret = String(user.two_factor_secret)
          .replace(/\s+/g, "")
          .replace(/=+$/g, "")
          .toUpperCase();

        const secret = OTPAuth.Secret.fromBase32(
          normalizedSecret,
        );

        const totp = new OTPAuth.TOTP({
          issuer: "BioAnalítica",
          label: String(user.username),
          algorithm: "SHA1",
          digits: 6,
          period: 30,
          secret,
        });

        otpValid = totp.validate({ token: otp, window: 2 }) !== null;
      } catch (otpError) {
        console.error("No se pudo validar TOTP", otpError);
        otpValid = false;
      }

      if (!otpValid) {
        return json(
          {
            ok: false,
            message: "Código OTP incorrecto o expirado",
          },
          401,
        );
      }

      const rawToken = randomToken(32);
      const tokenHash = await sha256Text(rawToken);
      const now = new Date();
      const expiresAt = new Date(
        now.getTime() + sessionHours * 60 * 60 * 1000,
      ).toISOString();

      // Opcional: revocar sesiones ya expiradas de este mismo usuario.
      await admin
        .from("usuario_sesiones")
        .update({ revoked_at: now.toISOString() })
        .eq("usuario_id", user.id)
        .is("revoked_at", null)
        .lte("expires_at", now.toISOString());

      const { error: insertError } = await admin
        .from("usuario_sesiones")
        .insert({
          usuario_id: user.id,
          token_hash: tokenHash,
          expires_at: expiresAt,
          last_used_at: now.toISOString(),
          user_agent: req.headers.get("user-agent"),
          ip_address: getClientIp(req),
        });

      if (insertError) {
        throw insertError;
      }

      return json({
        ok: true,
        session_token: rawToken,
        expires_at: expiresAt,
        user: {
          id: String(user.id),
          username: String(user.username),
          role: String(user.role),
          name: String(user.name),
        },
      });
    }

    if (action === "validate") {
      const current = await getSessionUser(req, admin);

      if (!current) {
        return json({
          ok: true,
          valid: false,
          message: "Sesión inválida o expirada",
        });
      }

      return json({
        ok: true,
        valid: true,
        user: current.user,
        expires_at: current.expiresAt,
      });
    }

    if (action === "revoke") {
      const token = getSessionToken(req);

      if (!token) {
        return json({ ok: true, revoked: false });
      }

      const tokenHash = await sha256Text(token);
      const now = new Date().toISOString();

      const { error } = await admin
        .from("usuario_sesiones")
        .update({ revoked_at: now })
        .eq("token_hash", tokenHash)
        .is("revoked_at", null);

      if (error) {
        throw error;
      }

      return json({ ok: true, revoked: true });
    }

    return json({ ok: false, message: "Acción no soportada" }, 400);
  } catch (error) {
    console.error("usuario-session error", error);

    return json(
      {
        ok: false,
        message: error instanceof Error ? error.message : String(error),
      },
      500,
    );
  }
});
