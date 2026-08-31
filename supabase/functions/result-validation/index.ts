import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

async function sha256Bytes(bytes: Uint8Array) {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return bytesToHex(new Uint8Array(digest));
}

async function sha256Text(value: string) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return bytesToHex(new Uint8Array(digest));
}

async function hmacSha256Hex(value: string, secret: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(value),
  );

  return bytesToHex(new Uint8Array(signature));
}

function getSessionToken(req: Request) {
  return (req.headers.get("x-lab-session-token") || "").trim();
}

async function requireCustomSession(
  req: Request,
  admin: ReturnType<typeof createClient>,
) {
  const token = getSessionToken(req);
  if (!token) throw new Error("UNAUTHORIZED");

  const tokenHash = await sha256Text(token);
  const now = new Date().toISOString();

  const { data: session, error: sessionError } = await admin
    .from("usuario_sesiones")
    .select("id, usuario_id, expires_at")
    .eq("token_hash", tokenHash)
    .is("revoked_at", null)
    .gt("expires_at", now)
    .maybeSingle();

  if (sessionError) throw sessionError;
  if (!session) throw new Error("UNAUTHORIZED");

  const { data: user, error: userError } = await admin
    .from("usuarios")
    .select("id, username, role, name")
    .eq("id", session.usuario_id)
    .maybeSingle();

  if (userError) throw userError;
  if (!user) throw new Error("UNAUTHORIZED");

  if (user.role !== "admin" && user.role !== "laboratorist") {
    throw new Error("FORBIDDEN");
  }

  await admin
    .from("usuario_sesiones")
    .update({ last_used_at: now })
    .eq("id", session.id);

  return user;
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
  const appUrl = (Deno.env.get("APP_URL") || "").replace(/\/$/, "");
  const signingSecret = Deno.env.get("RESULT_PDF_SIGNING_SECRET") || "";

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

    if (action === "prepare") {
      const currentUser = await requireCustomSession(req, admin);

      const orderId = String(body?.order_id || "").trim();

      if (!orderId) {
        return json({ ok: false, message: "order_id es obligatorio" }, 400);
      }

      if (!appUrl) {
        return json(
          {
            ok: false,
            message:
              "Falta configurar APP_URL en los secretos de la Edge Function",
          },
          500,
        );
      }

      const { data: order, error: orderError } = await admin
        .from("ordenes")
        .select("id, code")
        .eq("id", orderId)
        .maybeSingle();

      if (orderError) throw orderError;
      if (!order) {
        return json({ ok: false, message: "Orden no encontrada" }, 404);
      }

      const now = new Date().toISOString();

      const { data: existingValidation, error: existingValidationError } =
        await admin
          .from("resultado_validaciones")
          .select(
            "id, token, status, storage_path, pdf_sha256, firma_hmac_sha256, finalized_at",
          )
          .eq("order_id", orderId)
          .maybeSingle();

      if (existingValidationError) throw existingValidationError;

      let token = String(existingValidation?.token || "").trim();

      if (!token) {
        token = crypto.randomUUID();

        const { error: insertError } = await admin
          .from("resultado_validaciones")
          .insert({
            order_id: orderId,
            token,
            status: "PENDIENTE",
            storage_bucket: "resultados",
            storage_path: null,
            pdf_sha256: null,
            firma_hmac_sha256: null,
            finalized_at: null,
            revoked_at: null,
            updated_at: now,
          });

        if (insertError) throw insertError;
      } else {
        const { error: touchError } = await admin
          .from("resultado_validaciones")
          .update({ updated_at: now })
          .eq("id", existingValidation.id);

        if (touchError) throw touchError;
      }

      const validationUrl = `${appUrl}/validar-resultados/${token}`;

      return json({
        ok: true,
        token,
        validation_url: validationUrl,
        order_code: order.code,
        reused_token: !!existingValidation?.token,
        prepared_by: {
          id: currentUser.id,
          username: currentUser.username,
          role: currentUser.role,
        },
      });
    }

    if (action === "finalize") {
      const currentUser = await requireCustomSession(req, admin);

      if (!signingSecret) {
        return json(
          {
            ok: false,
            message:
              "Falta configurar RESULT_PDF_SIGNING_SECRET en los secretos de la Edge Function",
          },
          500,
        );
      }

      const orderId = String(body?.order_id || "").trim();
      const token = String(body?.token || "").trim();
      const storagePath = String(body?.storage_path || "")
        .trim()
        .replace(/^\/+/, "");

      if (!orderId || !token || !storagePath) {
        return json(
          {
            ok: false,
            message: "order_id, token y storage_path son obligatorios",
          },
          400,
        );
      }

      const { data: validation, error: validationError } = await admin
        .from("resultado_validaciones")
        .select("id, order_id, token")
        .eq("order_id", orderId)
        .eq("token", token)
        .maybeSingle();

      if (validationError) throw validationError;
      if (!validation) {
        return json(
          {
            ok: false,
            message: "Validación pendiente no encontrada",
          },
          404,
        );
      }

      const { data: pdfBlob, error: downloadError } = await admin.storage
        .from("resultados")
        .download(storagePath);

      if (downloadError || !pdfBlob) {
        throw downloadError || new Error("No se pudo leer el PDF almacenado");
      }

      const bytes = new Uint8Array(await pdfBlob.arrayBuffer());
      const pdfSha256 = await sha256Bytes(bytes);
      const firma = await hmacSha256Hex(pdfSha256, signingSecret);
      const finalizedAt = new Date().toISOString();

      const { error: updateError } = await admin
        .from("resultado_validaciones")
        .update({
          status: "VALIDO",
          storage_bucket: "resultados",
          storage_path: storagePath,
          pdf_sha256: pdfSha256,
          firma_hmac_sha256: firma,
          finalized_at: finalizedAt,
          revoked_at: null,
          updated_at: finalizedAt,
        })
        .eq("id", validation.id);

      if (updateError) throw updateError;

      return json({
        ok: true,
        sha256: pdfSha256,
        fingerprint: pdfSha256.slice(0, 16).toUpperCase(),
        signature: firma,
        finalized_by: {
          id: currentUser.id,
          username: currentUser.username,
          role: currentUser.role,
        },
      });
    }

    // VERIFY ES PÚBLICO: se usa al escanear el QR.
    if (action === "verify") {
      const token = String(body?.token || "").trim();
      const candidateSha256 = String(body?.file_sha256 || "")
        .trim()
        .toLowerCase();

      if (!token) {
        return json({ ok: false, message: "token es obligatorio" }, 400);
      }

      const { data: validation, error: validationError } = await admin
        .from("resultado_validaciones")
        .select(`
          status,
          pdf_sha256,
          firma_hmac_sha256,
          finalized_at,
          revoked_at,
          ordenes (
            code
          )
        `)
        .eq("token", token)
        .maybeSingle();

      if (validationError) throw validationError;

      if (!validation) {
        return json({
          ok: true,
          exists: false,
          valid: false,
          record_valid: false,
          message: "No existe una validación para este código.",
        });
      }

      const storedHash = String(validation.pdf_sha256 || "").toLowerCase();
      const storedSignature = String(
        validation.firma_hmac_sha256 || "",
      ).toLowerCase();

      let signatureOk = false;

      if (storedHash && storedSignature && signingSecret) {
        const expected = await hmacSha256Hex(storedHash, signingSecret);
        signatureOk = expected === storedSignature;
      }

      const revoked = !!validation.revoked_at;
      const recordValid =
        validation.status === "VALIDO" &&
        !revoked &&
        !!storedHash &&
        signatureOk;

      const fileChecked = /^[a-f0-9]{64}$/.test(candidateSha256);
      const fileMatches = fileChecked
        ? candidateSha256 === storedHash
        : null;

      return json({
        ok: true,
        exists: true,
        valid: recordValid && fileMatches !== false,
        status: validation.status,
        record_valid: recordValid,
        file_checked: fileChecked,
        file_matches: fileMatches,
        order_code: (validation as any).ordenes?.code || "",
        finalized_at: validation.finalized_at,
        fingerprint: storedHash
          ? storedHash.slice(0, 16).toUpperCase()
          : "",
        message:
          fileMatches === false
            ? "El archivo fue modificado: su huella no coincide con el PDF emitido por el laboratorio."
            : revoked
              ? "La validación fue revocada."
              : validation.status === "PENDIENTE"
                ? "La validación existe y está finalizando su firma. Intente nuevamente en unos segundos."
                : recordValid
                  ? fileChecked
                    ? "Documento auténtico e íntegro. El archivo coincide exactamente con el PDF emitido."
                    : "Código auténtico. Para comprobar si el archivo PDF fue editado, seleccione el PDF y ejecute la verificación de integridad."
                  : "El documento no tiene una firma válida.",
      });
    }

    return json({ ok: false, message: "Acción no soportada" }, 400);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    if (message === "UNAUTHORIZED") {
      return json(
        {
          ok: false,
          message:
            "Sesión del laboratorio inválida o expirada. Inicie sesión nuevamente.",
        },
        401,
      );
    }

    if (message === "FORBIDDEN") {
      return json(
        {
          ok: false,
          message: "El usuario no tiene permiso para firmar resultados.",
        },
        403,
      );
    }

    console.error("result-validation error", error);
    return json({ ok: false, message }, 500);
  }
});
