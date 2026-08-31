import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" },
  });
}

function bytesToHex(bytes: Uint8Array) {
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function sha256Bytes(bytes: Uint8Array) {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return bytesToHex(new Uint8Array(digest));
}

async function hmacSha256Hex(value: string, secret: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(value)
  );

  return bytesToHex(new Uint8Array(signature));
}

async function requireAuthenticatedUser(req: Request, supabaseUrl: string, anonKey: string) {
  const authorization = req.headers.get("Authorization") || "";
  if (!authorization.startsWith("Bearer ")) {
    throw new Error("UNAUTHORIZED");
  }

  const client = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await client.auth.getUser();
  if (error || !data.user) throw new Error("UNAUTHORIZED");
  return data.user;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== "POST") return json({ ok: false, message: "Método no permitido" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
  const appUrl = (Deno.env.get("APP_URL") || "").replace(/\/$/, "");
  const signingSecret = Deno.env.get("RESULT_PDF_SIGNING_SECRET") || "";

  if (!supabaseUrl || !serviceRoleKey || !anonKey) {
    return json({ ok: false, message: "Configuración Supabase incompleta" }, 500);
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    const body = await req.json().catch(() => ({}));
    const action = String(body?.action || "").toLowerCase();

    if (action === "prepare") {
      await requireAuthenticatedUser(req, supabaseUrl, anonKey);

      const orderId = String(body?.order_id || "").trim();
      if (!orderId) return json({ ok: false, message: "order_id es obligatorio" }, 400);

      const { data: order, error: orderError } = await admin
        .from("ordenes")
        .select("id, code")
        .eq("id", orderId)
        .maybeSingle();

      if (orderError) throw orderError;
      if (!order) return json({ ok: false, message: "Orden no encontrada" }, 404);

      const token = crypto.randomUUID();
      const now = new Date().toISOString();

      const { error: upsertError } = await admin
        .from("resultado_validaciones")
        .upsert(
          {
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
          },
          { onConflict: "order_id" }
        );

      if (upsertError) throw upsertError;

      const validationUrl = `${appUrl}/validar-resultados/${token}`;

      return json({
        ok: true,
        token,
        validation_url: validationUrl,
        order_code: order.code,
      });
    }

    if (action === "finalize") {
      await requireAuthenticatedUser(req, supabaseUrl, anonKey);

      if (!signingSecret) {
        return json({
          ok: false,
          message: "Falta configurar RESULT_PDF_SIGNING_SECRET en los secretos de la Edge Function",
        }, 500);
      }

      const orderId = String(body?.order_id || "").trim();
      const token = String(body?.token || "").trim();
      const storagePath = String(body?.storage_path || "").trim().replace(/^\/+/, "");

      if (!orderId || !token || !storagePath) {
        return json({ ok: false, message: "order_id, token y storage_path son obligatorios" }, 400);
      }

      const { data: validation, error: validationError } = await admin
        .from("resultado_validaciones")
        .select("id, order_id, token")
        .eq("order_id", orderId)
        .eq("token", token)
        .maybeSingle();

      if (validationError) throw validationError;
      if (!validation) return json({ ok: false, message: "Validación pendiente no encontrada" }, 404);

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
          updated_at: finalizedAt,
        })
        .eq("id", validation.id);

      if (updateError) throw updateError;

      return json({
        ok: true,
        sha256: pdfSha256,
        fingerprint: pdfSha256.slice(0, 16).toUpperCase(),
        signature: firma,
      });
    }

    if (action === "verify") {
      const token = String(body?.token || "").trim();
      const candidateSha256 = String(body?.file_sha256 || "").trim().toLowerCase();

      if (!token) return json({ ok: false, message: "token es obligatorio" }, 400);

      const { data: validation, error: validationError } = await admin
        .from("resultado_validaciones")
        .select(`
          status,
          pdf_sha256,
          firma_hmac_sha256,
          finalized_at,
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
          message: "El código de validación no existe o fue reemplazado.",
        });
      }

      const storedHash = String(validation.pdf_sha256 || "").toLowerCase();
      const storedSignature = String(validation.firma_hmac_sha256 || "").toLowerCase();
      let signatureOk = false;

      if (storedHash && storedSignature && signingSecret) {
        const expected = await hmacSha256Hex(storedHash, signingSecret);
        signatureOk = expected === storedSignature;
      }

      const recordValid = validation.status === "VALIDO" && !!storedHash && signatureOk;
      const fileChecked = /^[a-f0-9]{64}$/.test(candidateSha256);
      const fileMatches = fileChecked ? candidateSha256 === storedHash : null;

      return json({
        ok: true,
        exists: true,
        valid: recordValid && (fileMatches !== false),
        record_valid: recordValid,
        file_checked: fileChecked,
        file_matches: fileMatches,
        order_code: (validation as any).ordenes?.code || "",
        finalized_at: validation.finalized_at,
        fingerprint: storedHash ? storedHash.slice(0, 16).toUpperCase() : "",
        message:
          fileMatches === false
            ? "El archivo fue modificado: su SHA-256 no coincide con el PDF emitido por el laboratorio."
            : recordValid
            ? fileChecked
              ? "Documento auténtico e íntegro. El archivo coincide exactamente con el PDF emitido."
              : "Código auténtico. Para comprobar si el archivo PDF fue editado, seleccione el PDF y ejecute la verificación de integridad."
            : "El documento no tiene una firma válida o fue revocado.",
      });
    }

    return json({ ok: false, message: "Acción no soportada" }, 400);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message === "UNAUTHORIZED") {
      return json({ ok: false, message: "No autorizado" }, 401);
    }
    console.error("result-validation error", error);
    return json({ ok: false, message }, 500);
  }
});
