import { corsHeaders } from "../_shared/cors.ts";
import nodemailer from "npm:nodemailer@6.9.10";

type SendDocumentType = "orden" | "resultados" | "factura";

type Payload = {
  to: string;
  documentType: SendDocumentType;
  orderCode: string;
  patientName?: string;
  pdfBase64?: string;
  pdfUrl?: string;
  filename?: string;
};

const SMTP_HOSTNAME = Deno.env.get("SMTP_HOSTNAME") ?? "smtp.gmail.com";
const SMTP_PORT = Number(Deno.env.get("SMTP_PORT") ?? "465");
const SMTP_SECURE = String(Deno.env.get("SMTP_SECURE") ?? "true") === "true";
const SMTP_USERNAME = Deno.env.get("SMTP_USERNAME") ?? "";
const SMTP_PASSWORD = Deno.env.get("SMTP_PASSWORD") ?? "";
const SMTP_FROM = Deno.env.get("SMTP_FROM") ?? SMTP_USERNAME;

const transporter = nodemailer.createTransport({
  host: SMTP_HOSTNAME,
  port: SMTP_PORT,
  secure: SMTP_SECURE,
  auth: {
    user: SMTP_USERNAME,
    pass: SMTP_PASSWORD,
  },
});

function sanitizeBase64(input: string): string {
  return input.includes(",") ? input.split(",")[1] : input;
}

async function urlToBytes(url: string): Promise<Uint8Array> {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error("No se pudo descargar el PDF desde la URL");
  }

  const arrayBuffer = await response.arrayBuffer();
  return new Uint8Array(arrayBuffer);
}

function buildEmailContent(
  documentType: SendDocumentType,
  orderCode: string,
  patientName?: string
) {
  const subject =
    documentType === "orden"
      ? `Orden de laboratorio ${orderCode}`
      : documentType === "resultados"
      ? `Resultados de laboratorio ${orderCode}`
      : `Factura electrónica ${orderCode}`;

  const title =
    documentType === "orden"
      ? "Orden de laboratorio"
      : documentType === "resultados"
      ? "Resultados de laboratorio"
      : "Factura electrónica";

  const intro =
    documentType === "orden"
      ? `Adjuntamos la orden correspondiente al código ${orderCode}.`
      : documentType === "resultados"
      ? `Adjuntamos los resultados correspondientes al código ${orderCode}.`
      : `Adjuntamos la factura electrónica correspondiente al comprobante ${orderCode}.`;

  const greeting = patientName?.trim()
    ? `Estimado/a ${patientName.trim()},`
    : "Estimado/a cliente,";

  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #1f2937;">
      <h2>${title}</h2>
      <p>${greeting}</p>
      <p>${intro}</p>
      <p>Se adjunta el archivo PDF.</p>
      <br />
      <p>Atentamente,<br />Laboratorio</p>
    </div>
  `;

  return { subject, html };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = (await req.json()) as Payload;

    const {
      to,
      documentType,
      orderCode,
      patientName,
      pdfBase64,
      pdfUrl,
      filename,
    } = body;

    if (!to?.trim()) throw new Error("Falta el destinatario");
    if (!documentType || !["orden", "resultados", "factura"].includes(documentType)) {
      throw new Error("documentType inválido");
    }
    if (!orderCode?.trim()) throw new Error("Falta el código de orden");
    if (!pdfBase64 && !pdfUrl) {
      throw new Error("Debe enviar pdfBase64 o pdfUrl");
    }

    let pdfBytes: Uint8Array;

    if (pdfBase64) {
      pdfBytes = Uint8Array.from(atob(sanitizeBase64(pdfBase64)), (c) =>
        c.charCodeAt(0)
      );
    } else {
      pdfBytes = await urlToBytes(String(pdfUrl));
    }

    const { subject, html } = buildEmailContent(
      documentType,
      orderCode,
      patientName
    );

    const finalFilename =
      filename ||
      (documentType === "orden"
        ? `orden_${orderCode}.pdf`
        : documentType === "resultados"
        ? `resultados_${orderCode}.pdf`
        : `factura_${orderCode}.pdf`);

    await new Promise<void>((resolve, reject) => {
      transporter.sendMail(
        {
          from: SMTP_FROM,
          to: to.trim(),
          subject,
          html,
          attachments: [
            {
              filename: finalFilename,
              content: pdfBytes,
              contentType: "application/pdf",
            },
          ],
        },
        (error) => {
          if (error) return reject(error);
          resolve();
        }
      );
    });

    return new Response(JSON.stringify({ ok: true }), {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
      },
      status: 200,
    });
  } catch (error: any) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: error?.message || "No se pudo enviar el correo",
      }),
      {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
        status: 500,
      }
    );
  }
});