import { createClient } from "npm:@supabase/supabase-js@2";
import { PDFDocument, StandardFonts } from "npm:pdf-lib@1.17.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SRI_URLS = {
  PRUEBAS: {
    autorizacion:
      "https://celcer.sri.gob.ec/comprobantes-electronicos-ws/AutorizacionComprobantesOffline",
  },
  PRODUCCION: {
    autorizacion:
      "https://cel.sri.gob.ec/comprobantes-electronicos-ws/AutorizacionComprobantesOffline",
  },
};

function jsonResponse(body: any, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

function xmlEscape(value: any): string {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function stripNonDigits(value: string | null | undefined): string {
  return String(value ?? "").replace(/\D/g, "");
}

function round2(value: number): number {
  return Number(Number(value || 0).toFixed(2));
}

function normalizeAmbiente(value: string | null | undefined): "PRUEBAS" | "PRODUCCION" {
  return String(value ?? "").toUpperCase() === "PRODUCCION" ? "PRODUCCION" : "PRUEBAS";
}

function decodeHtmlEntities(value: string | null | undefined): string {
  return String(value ?? "")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&amp;", "&")
    .replaceAll("&quot;", '"')
    .replaceAll("&apos;", "'");
}

function formatMoney(value: number): string {
  return Number(value || 0).toFixed(2);
}

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function soapRequest(url: string, body: string) {
  const maxIntentos = 4;
  let ultimoError: any = null;

  for (let intento = 1; intento <= maxIntentos; intento++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "text/xml; charset=utf-8",
          SOAPAction: "",
        },
        body,
        signal: controller.signal,
      });

      clearTimeout(timeout);
      const text = await res.text();

      return {
        ok: res.ok,
        status: res.status,
        text,
        intento,
      };
    } catch (error: any) {
      clearTimeout(timeout);
      ultimoError = error;

      const mensaje = String(error?.message || error || "");
      const esReintentable =
        mensaje.includes("connection reset by peer") ||
        mensaje.includes("SendRequest") ||
        mensaje.includes("connection error") ||
        mensaje.includes("network") ||
        mensaje.includes("timed out") ||
        mensaje.includes("aborted") ||
        mensaje.includes("unexpected eof");

      if (!esReintentable || intento === maxIntentos) {
        throw new Error(
          `SOAP request failed [intento ${intento}/${maxIntentos}] a ${url}: ${mensaje}`,
        );
      }

      await sleep(1500 * intento);
    }
  }

  throw ultimoError;
}

function parseSoapMessages(xml: string) {
  const result: Array<{
    identificador?: string | null;
    mensaje?: string | null;
    informacionAdicional?: string | null;
    tipo?: string | null;
  }> = [];

  const bloquesMensajes = [...xml.matchAll(/<mensajes>([\s\S]*?)<\/mensajes>/g)];

  for (const bloque of bloquesMensajes) {
    const mensajes = [...bloque[1].matchAll(/<mensaje>([\s\S]*?)<\/mensaje>/g)];

    for (const m of mensajes) {
      const content = m[1];
      const get = (tag: string) =>
        content.match(new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`))?.[1]?.trim() ?? null;

      result.push({
        identificador: get("identificador"),
        mensaje: get("mensaje"),
        informacionAdicional: get("informacionAdicional"),
        tipo: get("tipo"),
      });
    }
  }

  return result;
}

async function consultarAutorizacionSRI(
  claveAcceso: string,
  ambiente: "PRUEBAS" | "PRODUCCION",
) {
  const url = SRI_URLS[ambiente].autorizacion;

  const soap = `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ec="http://ec.gob.sri.ws.autorizacion">
  <soapenv:Header/>
  <soapenv:Body>
    <ec:autorizacionComprobante>
      <claveAccesoComprobante>${xmlEscape(claveAcceso)}</claveAccesoComprobante>
    </ec:autorizacionComprobante>
  </soapenv:Body>
</soapenv:Envelope>`;

  try {
    const response = await soapRequest(url, soap);

    const estado =
      response.text.match(/<estado>(AUTORIZADO|NO AUTORIZADO)<\/estado>/)?.[1]?.trim() || null;

    const numeroAutorizacion =
      response.text.match(/<numeroAutorizacion>([\s\S]*?)<\/numeroAutorizacion>/)?.[1]?.trim() ||
      null;

    const fechaAutorizacion =
      response.text.match(/<fechaAutorizacion>([\s\S]*?)<\/fechaAutorizacion>/)?.[1]?.trim() ||
      null;

    const comprobanteRaw =
      response.text.match(/<comprobante><!\[CDATA\[([\s\S]*?)\]\]><\/comprobante>/)?.[1] || null;

    return {
      ...response,
      estado,
      numeroAutorizacion,
      fechaAutorizacion,
      comprobanteRaw,
      mensajes: parseSoapMessages(response.text),
      networkError: false,
      networkMessage: null,
    };
  } catch (error: any) {
    return {
      ok: false,
      status: 0,
      text: "",
      estado: null,
      numeroAutorizacion: null,
      fechaAutorizacion: null,
      comprobanteRaw: null,
      mensajes: [],
      networkError: true,
      networkMessage: String(error?.message || error || "Error de conexión con SRI"),
    };
  }
}

async function generarRidePdf(params: {
  razonSocial: string;
  ruc: string;
  numeroFactura: string;
  fecha: string;
  paciente: string;
  identificacion: string;
  direccion?: string;
  email?: string;
  claveAcceso: string;
  autorizacion: string;
  detalles: Array<{ descripcion: string; precio: number }>;
  subtotal: number;
  iva: number;
  total: number;
}) {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595, 842]);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  let y = 790;

  const draw = (text: string, x = 50, size = 10, bold = false) => {
    page.drawText(text, {
      x,
      y,
      size,
      font: bold ? fontBold : font,
      maxWidth: 500,
    });
    y -= size + 6;
  };

  draw(params.razonSocial, 50, 14, true);
  draw(`RUC: ${params.ruc}`, 50, 11);
  draw(`Factura: ${params.numeroFactura}`, 50, 11);
  draw(`Fecha emisión: ${params.fecha}`, 50, 11);
  draw(`Cliente: ${params.paciente}`, 50, 11);
  draw(`Identificación: ${params.identificacion}`, 50, 11);
  if (params.direccion) draw(`Dirección: ${params.direccion}`, 50, 10);
  if (params.email) draw(`Email: ${params.email}`, 50, 10);

  y -= 10;
  draw("Clave de acceso:", 50, 11, true);
  draw(params.claveAcceso, 50, 9);
  y -= 6;
  draw("Número de autorización:", 50, 11, true);
  draw(params.autorizacion, 50, 9);

  y -= 16;
  draw("Detalle", 50, 12, true);

  for (const item of params.detalles) {
    page.drawText(item.descripcion, { x: 50, y, size: 10, font, maxWidth: 380 });
    page.drawText(`$${item.precio.toFixed(2)}`, { x: 470, y, size: 10, font });
    y -= 18;
    if (y < 120) break;
  }

  y -= 10;
  draw(`Subtotal: $${params.subtotal.toFixed(2)}`, 360, 11, true);
  draw(`IVA: $${params.iva.toFixed(2)}`, 360, 11, true);
  draw(`Total: $${params.total.toFixed(2)}`, 360, 12, true);

  return await pdfDoc.save();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const body = await req.json().catch(() => ({}));
    const order_id = String(body?.order_id ?? "").trim();

    if (!order_id || order_id === "undefined" || order_id === "null") {
      return jsonResponse({
        ok: false,
        message: "order_id requerido y válido",
        received_order_id: body?.order_id ?? null,
      }, 400);
    }

    const { data: orderBase, error: orderError } = await supabase
      .from("ordenes")
      .select("*")
      .eq("id", order_id)
      .maybeSingle();

    if (orderError) {
      return jsonResponse({
        ok: false,
        message: "Error consultando la orden",
        detail: orderError.message,
        order_id,
      }, 500);
    }

    if (!orderBase) {
      return jsonResponse({
        ok: false,
        message: "No se encontró la orden",
        order_id,
      }, 404);
    }

    const claveAcceso = String(orderBase?.clave_acceso_sri ?? "").trim();
    if (!claveAcceso || !/^\d{49}$/.test(claveAcceso)) {
      return jsonResponse({
        ok: false,
        message: "La orden no tiene una clave_acceso_sri válida de 49 dígitos",
        clave_acceso_sri: orderBase?.clave_acceso_sri ?? null,
      }, 400);
    }

    const ambiente = normalizeAmbiente(orderBase?.factura_ambiente || "PRUEBAS");

    const autorizacion = await consultarAutorizacionSRI(claveAcceso, ambiente);

    if (autorizacion.networkError) {
      return jsonResponse({
        ok: false,
        stage: "autorizacion_sri",
        message: autorizacion.networkMessage || "Error de conexión con SRI en autorización",
      }, 502);
    }

    if (autorizacion.estado === "NO AUTORIZADO") {
      const sriMensaje = autorizacion.mensajes
        ?.map((m: any) =>
          [m.identificador, m.mensaje, m.informacionAdicional].filter(Boolean).join(" - ")
        )
        .join(" | ") || "Comprobante no autorizado por el SRI";

      const { error: upOrder } = await supabase
        .from("ordenes")
        .update({
          factura_estado: "NO AUTORIZADO",
          factura_mensaje: sriMensaje,
        })
        .eq("id", order_id);

      if (upOrder) {
        return jsonResponse({
          ok: false,
          message: `SRI respondió NO AUTORIZADO, pero no se pudo actualizar la orden: ${upOrder.message}`,
        }, 500);
      }

      return jsonResponse({
        ok: false,
        stage: "autorizacion_sri",
        message: sriMensaje,
        clave_acceso_sri: claveAcceso,
        numero_factura: orderBase.numero_factura,
        sri_estado: "NO AUTORIZADO",
        sri_mensajes: autorizacion.mensajes,
      }, 400);
    }

    if (autorizacion.estado !== "AUTORIZADO") {
      const { error: upOrder } = await supabase
        .from("ordenes")
        .update({
          factura_estado: "EN_PROCESAMIENTO",
          factura_mensaje: "La autorización aún no está disponible en el SRI",
        })
        .eq("id", order_id);

      if (upOrder) {
        return jsonResponse({
          ok: false,
          message: `SRI sigue en procesamiento, pero no se pudo actualizar la orden: ${upOrder.message}`,
        }, 500);
      }

      return jsonResponse({
        ok: false,
        stage: "autorizacion_sri",
        message: "La autorización aún no está disponible en el SRI",
        clave_acceso_sri: claveAcceso,
        numero_factura: orderBase.numero_factura,
        sri_estado: "EN_PROCESAMIENTO",
      }, 202);
    }

    const { data: facturaRow, error: facturaError } = await supabase
      .from("facturas_electronicas")
      .select("*")
      .eq("id", orderBase.factura_id)
      .maybeSingle();

    if (facturaError) {
      return jsonResponse({
        ok: false,
        message: "No se pudo consultar la factura electrónica asociada",
        detail: facturaError.message,
      }, 500);
    }

    if (!facturaRow) {
      return jsonResponse({
        ok: false,
        message: "La orden no tiene factura_electronica asociada",
        factura_id: orderBase.factura_id ?? null,
      }, 400);
    }

    const { data: configFE, error: configError } = await supabase
      .from("configuracion_facturacion_electronica")
      .select("*")
      .eq("id", facturaRow.configuracion_fe_id)
      .maybeSingle();

    if (configError) {
      return jsonResponse({
        ok: false,
        message: "No se pudo consultar la configuración FE",
        detail: configError.message,
      }, 500);
    }

    if (!configFE) {
      return jsonResponse({
        ok: false,
        message: "No se encontró la configuración FE asociada a la factura",
      }, 400);
    }

    const { data: paciente } = await supabase
      .from("pacientes")
      .select("*")
      .eq("id", orderBase.patient_id)
      .maybeSingle();

    const { data: detallesRaw } = await supabase
      .from("orden_detalle")
      .select(`
        id,
        order_id,
        price,
        subtotal_sin_impuesto,
        valor_iva,
        pruebas(name, price)
      `)
      .eq("order_id", order_id);

    const detalles = (detallesRaw || []).map((d: any) => ({
      descripcion: String(d?.pruebas?.name || "Examen de laboratorio"),
      precio: round2(Number(d.subtotal_sin_impuesto ?? d.price ?? d?.pruebas?.price ?? 0) + Number(d.valor_iva ?? 0)),
    }));

    const xmlAutorizado =
      autorizacion.comprobanteRaw
        ? decodeHtmlEntities(autorizacion.comprobanteRaw)
        : null;

    let xmlAutorizadoPath = facturaRow.xml_autorizado_path;

    if (xmlAutorizado) {
      xmlAutorizadoPath =
        xmlAutorizadoPath ||
        `${facturaRow.laboratorio_id}/${orderBase.id}/${claveAcceso}_autorizado.xml`;

      const upXml = await supabase.storage
        .from("facturas-xml")
        .upload(
          xmlAutorizadoPath,
          new Blob([xmlAutorizado], { type: "application/xml; charset=utf-8" }),
          { upsert: true, contentType: "application/xml; charset=utf-8" },
        );

      if (upXml.error) {
        return jsonResponse({
          ok: false,
          message: `No se pudo guardar el XML autorizado: ${upXml.error.message}`,
        }, 500);
      }
    }

    let pdfPath = facturaRow.ride_pdf_path;

    if (!pdfPath) {
      pdfPath = `${facturaRow.laboratorio_id}/${orderBase.id}/${claveAcceso}_ride.pdf`;

      const rideBytes = await generarRidePdf({
        razonSocial: configFE.razon_social,
        ruc: stripNonDigits(configFE.ruc),
        numeroFactura: orderBase.numero_factura || "",
        fecha: orderBase.created_at ? new Date(orderBase.created_at).toLocaleDateString("es-EC") : "",
        paciente: String(paciente?.name || facturaRow.cliente_nombres || ""),
        identificacion: String(paciente?.cedula || facturaRow.cliente_identificacion || ""),
        direccion: paciente?.direccion || undefined,
        email: paciente?.email || undefined,
        claveAcceso,
        autorizacion: autorizacion.numeroAutorizacion || claveAcceso,
        detalles,
        subtotal: Number(facturaRow.subtotal || 0),
        iva: Number(facturaRow.iva || 0),
        total: Number(facturaRow.total || 0),
      });

      const upPdf = await supabase.storage
        .from("facturas-pdf")
        .upload(pdfPath, rideBytes, {
          upsert: true,
          contentType: "application/pdf",
        });

      if (upPdf.error) {
        return jsonResponse({
          ok: false,
          message: `No se pudo guardar el PDF RIDE: ${upPdf.error.message}`,
        }, 500);
      }
    }

    const sriFechaAut = autorizacion.fechaAutorizacion || new Date().toISOString();
    const sriNumAut = autorizacion.numeroAutorizacion || claveAcceso;

    const { error: upFactura } = await supabase
      .from("facturas_electronicas")
      .update({
        sri_estado: "AUTORIZADO",
        sri_numero_autorizacion: sriNumAut,
        sri_fecha_autorizacion: sriFechaAut,
        sri_mensaje: "Comprobante autorizado por el SRI",
        xml_autorizado_path: xmlAutorizadoPath,
        ride_pdf_path: pdfPath,
      })
      .eq("id", facturaRow.id);

    if (upFactura) {
      return jsonResponse({
        ok: false,
        message: `No se pudo actualizar facturas_electronicas: ${upFactura.message}`,
      }, 500);
    }

    const { error: upOrder } = await supabase
      .from("ordenes")
      .update({
        numero_autorizacion_sri: sriNumAut,
        factura_estado: "AUTORIZADO",
        factura_xml_autorizado_path: xmlAutorizadoPath,
        factura_ride_pdf_path: pdfPath,
        factura_fecha_autorizacion: sriFechaAut,
        factura_mensaje: "Factura autorizada correctamente por el SRI",
      })
      .eq("id", order_id);

    if (upOrder) {
      return jsonResponse({
        ok: false,
        message: `No se pudo actualizar la orden: ${upOrder.message}`,
      }, 500);
    }

    return jsonResponse({
      ok: true,
      message: "Factura autorizada correctamente",
      factura_id: facturaRow.id,
      numero_factura: orderBase.numero_factura,
      clave_acceso_sri: claveAcceso,
      numero_autorizacion_sri: sriNumAut,
      factura_estado: "AUTORIZADO",
      factura_xml_autorizado_path: xmlAutorizadoPath,
      factura_ride_pdf_path: pdfPath,
    });
  } catch (error: any) {
    console.error("ERROR EDGE CONSULTA FACTURA:", error);

    return jsonResponse({
      ok: false,
      message: error?.message || "Error interno al consultar la factura",
      stack: error?.stack || null,
    }, 500);
  }
});