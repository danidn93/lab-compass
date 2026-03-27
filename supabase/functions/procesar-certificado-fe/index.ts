import { createClient } from "npm:@supabase/supabase-js@2";
import forge from "npm:node-forge@1.3.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type CertProcessSuccess = {
  ok: true;
  certificado_nombre: string;
  certificado_storage_path: string;
  certificado_thumbprint: string;
  certificado_serial: string;
  certificado_issuer: string;
  certificado_subject: string;
  certificado_fecha_emision: string;
  certificado_fecha_caducidad: string;
  message?: string;
};

type CertProcessError = {
  ok: false;
  message: string;
};

function jsonResponse(body: CertProcessSuccess | CertProcessError, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

function normalizeDate(date?: Date | null): string {
  if (!date) return "";
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function attributesToString(
  attrs: Array<{ shortName?: string; name?: string; value?: string }>
): string {
  return attrs
    .map((attr) => {
      const key = attr.shortName || attr.name || "attr";
      const value = attr.value || "";
      return `${key}=${value}`;
    })
    .join(", ");
}

function arrayBufferToBinaryString(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunkSize = 0x8000;

  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }

  return binary;
}

function binaryStringToUint8Array(binary: string): Uint8Array {
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function sha1HexFromAsn1Cert(cert: forge.pki.Certificate): string {
  const asn1Cert = forge.pki.certificateToAsn1(cert);
  const der = forge.asn1.toDer(asn1Cert).getBytes();
  const md = forge.md.sha1.create();
  md.update(der);
  return md.digest().toHex().toUpperCase();
}

function getPrimaryCertificate(
  p12: forge.pkcs12.Pkcs12Pfx
): forge.pki.Certificate | null {
  const certBags =
    p12.getBags({ bagType: forge.pki.oids.certBag })[
      forge.pki.oids.certBag
    ] || [];

  if (!certBags.length) return null;

  const withKeyUsage = certBags.find((bag) => {
    const cert = bag.cert;
    return !!cert && cert.subject?.attributes?.length;
  });

  return withKeyUsage?.cert || certBags[0]?.cert || null;
}

async function encryptPassword(plainText: string, secret: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));

  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "PBKDF2" },
    false,
    ["deriveKey"]
  );

  const salt = new TextEncoder().encode("certificado-fe-salt-v1");

  const key = await crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt,
      iterations: 100000,
      hash: "SHA-256",
    },
    keyMaterial,
    {
      name: "AES-GCM",
      length: 256,
    },
    false,
    ["encrypt"]
  );

  const cipherBuffer = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    new TextEncoder().encode(plainText)
  );

  const ivBase64 = btoa(String.fromCharCode(...iv));
  const cipherBase64 = btoa(
    String.fromCharCode(...new Uint8Array(cipherBuffer))
  );

  return `${ivBase64}:${cipherBase64}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      status: 200,
      headers: corsHeaders,
    });
  }

  if (req.method !== "POST") {
    return jsonResponse(
      {
        ok: false,
        message: "Método no permitido.",
      },
      405
    );
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const encryptionSecret =
      Deno.env.get("CERT_PASSWORD_SECRET") || Deno.env.get("APP_ENCRYPTION_SECRET");

    if (!supabaseUrl || !serviceRoleKey) {
      return jsonResponse(
        {
          ok: false,
          message: "Faltan variables de entorno de Supabase.",
        },
        500
      );
    }

    if (!encryptionSecret) {
      return jsonResponse(
        {
          ok: false,
          message: "Falta la variable de entorno para cifrar la clave del certificado.",
        },
        500
      );
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const formData = await req.formData();
    const laboratorioId = String(formData.get("laboratorio_id") || "").trim();
    const password = String(formData.get("password") || "").trim();
    const file = formData.get("file");

    if (!laboratorioId) {
      return jsonResponse(
        {
          ok: false,
          message: "laboratorio_id es obligatorio.",
        },
        400
      );
    }

    if (!password) {
      return jsonResponse(
        {
          ok: false,
          message: "La clave del certificado es obligatoria.",
        },
        400
      );
    }

    if (!(file instanceof File)) {
      return jsonResponse(
        {
          ok: false,
          message: "No se recibió ningún archivo.",
        },
        400
      );
    }

    const lowerName = file.name.toLowerCase();
    if (!lowerName.endsWith(".p12") && !lowerName.endsWith(".pfx")) {
      return jsonResponse(
        {
          ok: false,
          message: "El archivo debe ser .p12 o .pfx",
        },
        400
      );
    }

    const fileBuffer = await file.arrayBuffer();
    const binary = arrayBufferToBinaryString(fileBuffer);

    let certificate: forge.pki.Certificate | null = null;

    try {
      const asn1 = forge.asn1.fromDer(binary);
      const p12 = forge.pkcs12.pkcs12FromAsn1(asn1, password);
      certificate = getPrimaryCertificate(p12);
    } catch {
      return jsonResponse(
        {
          ok: false,
          message: "No se pudo abrir el certificado. Verifica la clave y el archivo .p12/.pfx.",
        },
        400
      );
    }

    if (!certificate) {
      return jsonResponse(
        {
          ok: false,
          message: "No se encontró un certificado válido dentro del archivo.",
        },
        400
      );
    }

    const certificadoNombre = file.name;
    const certificadoFechaEmision = normalizeDate(certificate.validity.notBefore);
    const certificadoFechaCaducidad = normalizeDate(certificate.validity.notAfter);
    const certificadoSerial = certificate.serialNumber?.toUpperCase?.() || "";
    const certificadoIssuer = attributesToString(certificate.issuer.attributes as any);
    const certificadoSubject = attributesToString(certificate.subject.attributes as any);

    // =============================
    // EXTRAER RAZÓN SOCIAL Y RUC
    // =============================

    let razonSocial = "";
    let ruc = "";

    const subjectAttrs = certificate.subject.attributes;

    for (const attr of subjectAttrs) {
      // Nombre completo
      if (attr.shortName === "CN") {
        razonSocial = attr.value || "";
      }

      // Identificación
      if (attr.name === "serialNumber") {
        const raw = attr.value || "";

        // Ej: 0940745680-210624124834
        ruc = raw.split("-")[0];
      }
    }

    // 🔥 VALIDACIÓN CRÍTICA
    if (!razonSocial || !ruc) {
      return jsonResponse(
        {
          ok: false,
          message: "No se pudo extraer razón social o RUC del certificado.",
        },
        400
      );
    }
    const certificadoThumbprint = sha1HexFromAsn1Cert(certificate);

    const sanitizedName = certificadoNombre.replace(/\s+/g, "_");
    const storagePath = `${laboratorioId}/${Date.now()}_${sanitizedName}`;

    const fileBytes = binaryStringToUint8Array(binary);

    const { error: uploadError } = await supabase.storage
      .from("certificados")
      .upload(storagePath, fileBytes, {
        contentType: file.type || "application/x-pkcs12",
        upsert: true,
        cacheControl: "0",
      });

    if (uploadError) {
      return jsonResponse(
        {
          ok: false,
          message: `No se pudo subir el certificado al Storage: ${uploadError.message}`,
        },
        500
      );
    }

    const encryptedPassword = await encryptPassword(password, encryptionSecret);

    const { data: existingConfig, error: existingError } = await supabase
      .from("configuracion_facturacion_electronica")
      .select("id")
      .eq("laboratorio_id", laboratorioId)
      .maybeSingle();

    if (existingError) {
      return jsonResponse(
        {
          ok: false,
          message: `No se pudo consultar la configuración actual: ${existingError.message}`,
        },
        500
      );
    }

    const updatePayload = {
      laboratorio_id: laboratorioId,

      razon_social: razonSocial,
      nombre_comercial: razonSocial,
      ruc: ruc,

      certificado_nombre: certificadoNombre,
      certificado_storage_path: storagePath,
      certificado_thumbprint: certificadoThumbprint,
      certificado_serial: certificadoSerial,
      certificado_issuer: certificadoIssuer,
      certificado_subject: certificadoSubject,
      certificado_fecha_emision: certificadoFechaEmision || null,
      certificado_fecha_caducidad: certificadoFechaCaducidad || null,
      certificado_activo: true,
      certificado_password_encrypted: encryptedPassword,
    };

    if (existingConfig?.id) {
      const { error: updateError } = await supabase
        .from("configuracion_facturacion_electronica")
        .update(updatePayload)
        .eq("id", existingConfig.id);

      if (updateError) {
        return jsonResponse(
          {
            ok: false,
            message: `No se pudo actualizar la configuración FE: ${updateError.message}`,
          },
          500
        );
      }
    } else {
      const { error: insertError } = await supabase
        .from("configuracion_facturacion_electronica")
        .insert({
          laboratorio_id: laboratorioId,
          ambiente: "PRUEBAS",
          razon_social: razonSocial,
          nombre_comercial: razonSocial,
          ruc: ruc,
          obligado_contabilidad: false,
          establecimiento: "001",
          punto_emision: "001",
          secuencial_actual: 1,
          ...updatePayload,
        });

      if (insertError) {
        return jsonResponse(
          {
            ok: false,
            message: `No se pudo crear la configuración FE: ${insertError.message}`,
          },
          500
        );
      }
    }

    return jsonResponse({
      ok: true,
      certificado_nombre: certificadoNombre,
      certificado_storage_path: storagePath,
      certificado_thumbprint: certificadoThumbprint,
      certificado_serial: certificadoSerial,
      certificado_issuer: certificadoIssuer,
      certificado_subject: certificadoSubject,
      certificado_fecha_emision: certificadoFechaEmision,
      certificado_fecha_caducidad: certificadoFechaCaducidad,
      message: "Certificado procesado correctamente.",
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Error interno al procesar el certificado.";

    return jsonResponse(
      {
        ok: false,
        message,
      },
      500
    );
  }
});