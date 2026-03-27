import { createClient } from "npm:@supabase/supabase-js@2";
import { PDFDocument, StandardFonts } from "npm:pdf-lib@1.17.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SRI_URLS = {
  PRUEBAS: {
    recepcion:
      "https://celcer.sri.gob.ec/comprobantes-electronicos-ws/RecepcionComprobantesOffline",
    autorizacion:
      "https://celcer.sri.gob.ec/comprobantes-electronicos-ws/AutorizacionComprobantesOffline",
  },
  PRODUCCION: {
    recepcion:
      "https://cel.sri.gob.ec/comprobantes-electronicos-ws/RecepcionComprobantesOffline",
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

function pad(value: string | number, length: number): string {
  return String(value ?? "").padStart(length, "0");
}

function formatMoney(value: number): string {
  return Number(value || 0).toFixed(2);
}

function round2(value: number): number {
  return Number(Number(value || 0).toFixed(2));
}

function getEcuadorNow() {
  return new Date(
    new Date().toLocaleString("en-US", { timeZone: "America/Guayaquil" }),
  );
}

function toDdMmYyyyEcuador(date = getEcuadorNow()): string {
  return `${pad(date.getDate(), 2)}/${pad(date.getMonth() + 1, 2)}/${date.getFullYear()}`;
}

function normalizeAmbiente(value: string | null | undefined): "PRUEBAS" | "PRODUCCION" {
  return String(value ?? "").toUpperCase() === "PRODUCCION" ? "PRODUCCION" : "PRUEBAS";
}

function ambienteCodigo(ambiente: "PRUEBAS" | "PRODUCCION"): "1" | "2" {
  return ambiente === "PRODUCCION" ? "2" : "1";
}

function generateSecuencial(current: number | string): string {
  return pad(Number(current || 1), 9);
}

function generateNumeroFactura(estab: string, ptoEmi: string, secuencial: string): string {
  return `${pad(estab, 3)}-${pad(ptoEmi, 3)}-${pad(secuencial, 9)}`;
}

function modulo11(cadena48: string): number {
  let factor = 2;
  let total = 0;

  for (let i = cadena48.length - 1; i >= 0; i--) {
    total += Number(cadena48[i]) * factor;
    factor = factor === 7 ? 2 : factor + 1;
  }

  const mod = 11 - (total % 11);
  if (mod === 11) return 0;
  if (mod === 10) return 1;
  return mod;
}

function generarCodigoNumerico(orderId: string, secuencial: string): string {
  const raw = stripNonDigits(orderId) + stripNonDigits(secuencial);
  return raw.padEnd(8, "1").slice(0, 8);
}

function generarClaveAcceso(params: {
  fechaEmisionDdMmYyyy: string;
  codDoc: string;
  ruc: string;
  ambiente: "1" | "2";
  estab: string;
  ptoEmi: string;
  secuencial: string;
  codigoNumerico: string;
  tipoEmision: "1";
}): string {
  const fecha = stripNonDigits(params.fechaEmisionDdMmYyyy);
  const ruc = stripNonDigits(params.ruc).padStart(13, "0").slice(-13);
  const estab = stripNonDigits(params.estab).padStart(3, "0").slice(-3);
  const ptoEmi = stripNonDigits(params.ptoEmi).padStart(3, "0").slice(-3);
  const sec = stripNonDigits(params.secuencial).padStart(9, "0").slice(-9);
  const codigoNumerico = stripNonDigits(params.codigoNumerico).padStart(8, "0").slice(-8);

  const base48 =
    fecha +
    params.codDoc +
    ruc +
    params.ambiente +
    estab +
    ptoEmi +
    sec +
    codigoNumerico +
    params.tipoEmision;

  if (!/^\d{48}$/.test(base48)) {
    throw new Error(`La base de clave de acceso no tiene 48 dígitos. Valor generado: ${base48}`);
  }

  const clave49 = base48 + String(modulo11(base48));

  if (!/^\d{49}$/.test(clave49)) {
    throw new Error(`La clave de acceso final no tiene 49 dígitos. Valor generado: ${clave49}`);
  }

  return clave49;
}

function resolverIdentificacionComprador(paciente: any): {
  tipo: string;
  identificacion: string;
  razonSocial: string;
} {
  const nombre = String(paciente?.name || "Consumidor Final").trim() || "Consumidor Final";
  const raw = String(paciente?.cedula || "").trim();
  const clean = stripNonDigits(raw);

  if (!raw) {
    return {
      tipo: "07",
      identificacion: "9999999999999",
      razonSocial: "Consumidor Final",
    };
  }

  if (clean.length === 13) {
    return {
      tipo: "04",
      identificacion: clean,
      razonSocial: nombre,
    };
  }

  if (clean.length === 10) {
    return {
      tipo: "05",
      identificacion: clean,
      razonSocial: nombre,
    };
  }

  return {
    tipo: "07",
    identificacion: "9999999999999",
    razonSocial: "Consumidor Final",
  };
}

function base64EncodeUnicode(str: string): string {
  return btoa(unescape(encodeURIComponent(str)));
}

function decodeHtmlEntities(value: string | null | undefined): string {
  return String(value ?? "")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&amp;", "&")
    .replaceAll("&quot;", '"')
    .replaceAll("&apos;", "'");
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
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

async function enviarRecepcionSRI(xmlFirmado: string, ambiente: "PRUEBAS" | "PRODUCCION") {
  const url = SRI_URLS[ambiente].recepcion;

  const soap = `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ec="http://ec.gob.sri.ws.recepcion">
  <soapenv:Header/>
  <soapenv:Body>
    <ec:validarComprobante>
      <xml>${base64EncodeUnicode(xmlFirmado)}</xml>
    </ec:validarComprobante>
  </soapenv:Body>
</soapenv:Envelope>`;

  try {
    const response = await soapRequest(url, soap);
    const estado = response.text.match(/<estado>([\s\S]*?)<\/estado>/)?.[1]?.trim() || null;

    return {
      ...response,
      estado,
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
      mensajes: [],
      networkError: true,
      networkMessage: String(error?.message || error || "Error de conexión con SRI"),
    };
  }
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

async function wait(ms: number) {
  return await new Promise((resolve) => setTimeout(resolve, ms));
}

async function autorizarConReintentos(
  claveAcceso: string,
  ambiente: "PRUEBAS" | "PRODUCCION",
  maxIntentos = 6,
  pausaMs = 2500,
) {
  let ultimo: any = null;

  for (let i = 0; i < maxIntentos; i++) {
    ultimo = await consultarAutorizacionSRI(claveAcceso, ambiente);

    if (ultimo.estado === "AUTORIZADO" || ultimo.estado === "NO AUTORIZADO") {
      return ultimo;
    }

    await wait(pausaMs);
  }

  return ultimo;
}

function agruparImpuestosTotales(
  detalles: Array<{
    codigoPorcentaje: string;
    tarifa: number;
    baseImponible: number;
    valorIva: number;
  }>,
) {
  const mapa = new Map<string, { tarifa: number; base: number; valor: number }>();

  for (const d of detalles) {
    const key = String(d.codigoPorcentaje);
    const actual = mapa.get(key) || { tarifa: Number(d.tarifa || 0), base: 0, valor: 0 };
    actual.tarifa = Number(d.tarifa || 0);
    actual.base += Number(d.baseImponible || 0);
    actual.valor += Number(d.valorIva || 0);
    mapa.set(key, actual);
  }

  return Array.from(mapa.entries()).map(([codigoPorcentaje, item]) => ({
    codigoPorcentaje,
    tarifa: round2(item.tarifa),
    baseImponible: round2(item.base),
    valor: round2(item.valor),
  }));
}

function buildFacturaXml(params: {
  configFE: any;
  order: any;
  paciente: any;
  comprador: {
    tipo: string;
    identificacion: string;
    razonSocial: string;
  };
  detalles: Array<{
    descripcion: string;
    cantidad: number;
    precioUnitario: number;
    precioTotalSinImpuesto: number;
    baseImponible: number;
    codigoPorcentaje: string;
    tarifa: number;
    valorIva: number;
  }>;
  secuencial: string;
  claveAcceso: string;
  fechaEmision: string;
  subtotalSinImpuestos: number;
  totalDescuento: number;
  importeTotal: number;
  ambienteCodigo: "1" | "2";
}) {
  const cfg = params.configFE;
  const paciente = params.paciente || {};
  const impuestosAgrupados = agruparImpuestosTotales(params.detalles);

  const totalConImpuestos = `
    <totalConImpuestos>
      ${impuestosAgrupados.map((t) => `
      <totalImpuesto>
        <codigo>2</codigo>
        <codigoPorcentaje>${xmlEscape(t.codigoPorcentaje)}</codigoPorcentaje>
        <baseImponible>${formatMoney(t.baseImponible)}</baseImponible>
        <tarifa>${formatMoney(t.tarifa)}</tarifa>
        <valor>${formatMoney(t.valor)}</valor>
      </totalImpuesto>`).join("")}
    </totalConImpuestos>`;

  const detallesXml = params.detalles.map((d, idx) => `
      <detalle>
        <codigoPrincipal>${pad(idx + 1, 3)}</codigoPrincipal>
        <descripcion>${xmlEscape(d.descripcion)}</descripcion>
        <cantidad>${formatMoney(d.cantidad)}</cantidad>
        <precioUnitario>${formatMoney(d.precioUnitario)}</precioUnitario>
        <descuento>0.00</descuento>
        <precioTotalSinImpuesto>${formatMoney(d.precioTotalSinImpuesto)}</precioTotalSinImpuesto>
        <impuestos>
          <impuesto>
            <codigo>2</codigo>
            <codigoPorcentaje>${xmlEscape(d.codigoPorcentaje)}</codigoPorcentaje>
            <tarifa>${formatMoney(d.tarifa)}</tarifa>
            <baseImponible>${formatMoney(d.baseImponible)}</baseImponible>
            <valor>${formatMoney(d.valorIva)}</valor>
          </impuesto>
        </impuestos>
      </detalle>`).join("");

  const contribuyenteEspecialXml = cfg.contribuyente_especial
    ? `<contribuyenteEspecial>${xmlEscape(cfg.contribuyente_especial)}</contribuyenteEspecial>`
    : "";

  const obligadoContabilidad = cfg.obligado_contabilidad ? "SI" : "NO";
  const email = String(paciente?.email || "").trim();

  return `<?xml version="1.0" encoding="UTF-8"?>
<factura id="comprobante" version="1.0.0">
  <infoTributaria>
    <ambiente>${params.ambienteCodigo}</ambiente>
    <tipoEmision>1</tipoEmision>
    <razonSocial>${xmlEscape(cfg.razon_social)}</razonSocial>
    <nombreComercial>${xmlEscape(cfg.nombre_comercial || cfg.razon_social)}</nombreComercial>
    <ruc>${xmlEscape(stripNonDigits(cfg.ruc))}</ruc>
    <claveAcceso>${xmlEscape(params.claveAcceso)}</claveAcceso>
    <codDoc>01</codDoc>
    <estab>${xmlEscape(pad(cfg.establecimiento, 3))}</estab>
    <ptoEmi>${xmlEscape(pad(cfg.punto_emision, 3))}</ptoEmi>
    <secuencial>${xmlEscape(params.secuencial)}</secuencial>
    <dirMatriz>${xmlEscape(cfg.direccion_matriz || cfg.direccion_establecimiento || "")}</dirMatriz>
  </infoTributaria>
  <infoFactura>
    <fechaEmision>${xmlEscape(params.fechaEmision)}</fechaEmision>
    <dirEstablecimiento>${xmlEscape(cfg.direccion_establecimiento || cfg.direccion_matriz || "")}</dirEstablecimiento>
    ${contribuyenteEspecialXml}
    <obligadoContabilidad>${obligadoContabilidad}</obligadoContabilidad>
    <tipoIdentificacionComprador>${xmlEscape(params.comprador.tipo)}</tipoIdentificacionComprador>
    <razonSocialComprador>${xmlEscape(params.comprador.razonSocial)}</razonSocialComprador>
    <identificacionComprador>${xmlEscape(params.comprador.identificacion)}</identificacionComprador>
    <totalSinImpuestos>${formatMoney(params.subtotalSinImpuestos)}</totalSinImpuestos>
    <totalDescuento>${formatMoney(params.totalDescuento)}</totalDescuento>
    ${totalConImpuestos}
    <propina>0.00</propina>
    <importeTotal>${formatMoney(params.importeTotal)}</importeTotal>
    <moneda>DOLAR</moneda>
    <pagos>
      <pago>
        <formaPago>${xmlEscape(cfg.forma_pago_sri || "01")}</formaPago>
        <total>${formatMoney(params.importeTotal)}</total>
        <plazo>0</plazo>
        <unidadTiempo>DIAS</unidadTiempo>
      </pago>
    </pagos>
  </infoFactura>
  <detalles>
    ${detallesXml}
  </detalles>
  <infoAdicional>
    <campoAdicional nombre="Paciente">${xmlEscape(params.comprador.razonSocial)}</campoAdicional>
    ${email ? `<campoAdicional nombre="Email">${xmlEscape(email)}</campoAdicional>` : ""}
    ${
      paciente?.direccion
        ? `<campoAdicional nombre="Direccion">${xmlEscape(paciente.direccion)}</campoAdicional>`
        : ""
    }
    <campoAdicional nombre="Orden">${xmlEscape(params.order?.code || params.order?.id || "")}</campoAdicional>
  </infoAdicional>
</factura>`;
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

async function persistirFacturaYOrden(params: {
  supabase: any;
  facturaPayload: any;
  orderId: string;
  orderPayload: any;
  configId: string;
  secuencialActual?: number;
  incrementarSecuencial?: boolean;
}) {
  const { data: factura, error: facturaInsertError } = await params.supabase
    .from("facturas_electronicas")
    .insert(params.facturaPayload)
    .select()
    .single();

  if (facturaInsertError || !factura) {
    throw new Error(
      `No se pudo registrar la factura electrónica: ${facturaInsertError?.message || "sin detalle"}`,
    );
  }

  const { error: orderUpdateError } = await params.supabase
    .from("ordenes")
    .update({
      ...params.orderPayload,
      factura_id: factura.id,
    })
    .eq("id", params.orderId);

  if (orderUpdateError) {
    throw new Error(
      `La factura se registró, pero no se pudo actualizar la orden: ${orderUpdateError.message}`,
    );
  }

  if (params.incrementarSecuencial && typeof params.secuencialActual === "number") {
    await params.supabase
      .from("configuracion_facturacion_electronica")
      .update({
        secuencial_actual: Number(params.secuencialActual) + 1,
      })
      .eq("id", params.configId);
  }

  return factura;
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

    const signerUrl = String(
      Deno.env.get("SIGNER_URL") ?? "https://firmador-facturas.onrender.com",
    ).trim();
    const signerApiKey = String(
      Deno.env.get("SIGNER_API_KEY") ?? "9f7c2d0e4a1b6c8f_SIGNER_PRIVADO_2026_x9KpL2mQ7v",
    ).trim();
    const certPassword = String(
      Deno.env.get("CERT_P12_PASSWORD") ?? "06092023DJ",
    ).trim();

    if (!signerUrl) {
      return jsonResponse({ ok: false, message: "Falta configurar SIGNER_URL" }, 500);
    }
    if (!signerApiKey) {
      return jsonResponse({ ok: false, message: "Falta configurar SIGNER_API_KEY" }, 500);
    }
    if (!certPassword) {
      return jsonResponse({ ok: false, message: "Falta configurar CERT_P12_PASSWORD" }, 500);
    }

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

    if (orderBase.factura_estado === "AUTORIZADO") {
      return jsonResponse({
        ok: true,
        message: "La orden ya tiene una factura autorizada",
        factura_estado: "AUTORIZADO",
        numero_factura: orderBase.numero_factura,
        clave_acceso_sri: orderBase.clave_acceso_sri,
        numero_autorizacion_sri: orderBase.numero_autorizacion_sri,
      });
    }

    if (orderBase.factura_estado === "EN_PROCESAMIENTO" && orderBase.clave_acceso_sri) {
      return jsonResponse({
        ok: false,
        stage: "recepcion_sri",
        message:
          "La orden ya fue enviada y sigue en procesamiento. Usa la edge de consulta.",
        numero_factura: orderBase.numero_factura,
        clave_acceso_sri: orderBase.clave_acceso_sri,
        sri_estado: "EN_PROCESAMIENTO",
      }, 409);
    }

    const { data: paciente, error: pacienteError } = await supabase
      .from("pacientes")
      .select("*")
      .eq("id", orderBase.patient_id)
      .maybeSingle();

    if (pacienteError) {
      return jsonResponse({
        ok: false,
        message: "Error consultando el paciente",
        detail: pacienteError.message,
        patient_id: orderBase.patient_id,
      }, 500);
    }

    if (!paciente) {
      return jsonResponse({
        ok: false,
        message: "No se encontró el paciente de la orden",
        patient_id: orderBase.patient_id,
      }, 404);
    }

    const { data: detallesRaw, error: detallesError } = await supabase
      .from("orden_detalle")
      .select(`
        id,
        order_id,
        test_id,
        price,
        porcentaje_iva,
        codigo_porcentaje_iva,
        subtotal_sin_impuesto,
        valor_iva,
        total_linea,
        pruebas(name, price, porcentaje_iva, codigo_porcentaje_iva)
      `)
      .eq("order_id", order_id);

    if (detallesError) {
      return jsonResponse({
        ok: false,
        message: "Error consultando el detalle de la orden",
        detail: detallesError.message,
        order_id,
      }, 500);
    }

    if (!detallesRaw?.length) {
      return jsonResponse({
        ok: false,
        message: "La orden no tiene detalles para facturar",
        order_id,
      }, 400);
    }

    const { data: configFE, error: configError } = await supabase
      .from("configuracion_facturacion_electronica")
      .select("*")
      .eq("certificado_activo", true)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (configError) {
      return jsonResponse({
        ok: false,
        message: "Error consultando configuración de facturación electrónica",
        detail: configError.message,
      }, 500);
    }

    if (!configFE) {
      return jsonResponse({
        ok: false,
        message: "No existe configuración activa de facturación electrónica",
      }, 400);
    }

    if (!configFE.laboratorio_id) {
      return jsonResponse({
        ok: false,
        message: "La configuración activa no tiene laboratorio_id",
      }, 400);
    }

    if (!configFE.certificado_storage_path) {
      return jsonResponse({
        ok: false,
        message: "La configuración activa no tiene certificado_storage_path",
      }, 400);
    }

    const ambiente = normalizeAmbiente(configFE.ambiente);
    const ambienteCod = ambienteCodigo(ambiente);
    const fechaEmision = toDdMmYyyyEcuador();
    const secuencial = generateSecuencial(configFE.secuencial_actual);
    const numeroFactura = generateNumeroFactura(
      configFE.establecimiento,
      configFE.punto_emision,
      secuencial,
    );

    const claveAcceso = generarClaveAcceso({
      fechaEmisionDdMmYyyy: fechaEmision,
      codDoc: "01",
      ruc: configFE.ruc,
      ambiente: ambienteCod,
      estab: configFE.establecimiento,
      ptoEmi: configFE.punto_emision,
      secuencial,
      codigoNumerico: generarCodigoNumerico(orderBase.id, secuencial),
      tipoEmision: "1",
    });

    const comprador = resolverIdentificacionComprador(paciente);

    const detalles = (detallesRaw || []).map((d: any) => {
      const descripcion = String(d?.pruebas?.name || "Examen de laboratorio");
      const cantidad = 1;
      const precioUnitario = round2(Number(d.price || d?.pruebas?.price || 0));
      const tarifa = round2(Number(
        d.porcentaje_iva ?? d?.pruebas?.porcentaje_iva ?? configFE.porcentaje_iva ?? 15,
      ));
      const codigoPorcentaje = String(
        d.codigo_porcentaje_iva || d?.pruebas?.codigo_porcentaje_iva || "4",
      );
      const baseImponible = round2(Number(d.subtotal_sin_impuesto ?? precioUnitario));
      const valorIva = round2(Number(d.valor_iva ?? (baseImponible * tarifa / 100)));
      const precioTotalSinImpuesto = round2(Number(d.subtotal_sin_impuesto ?? precioUnitario));

      return {
        descripcion,
        cantidad,
        precioUnitario,
        precioTotalSinImpuesto,
        baseImponible,
        codigoPorcentaje,
        tarifa,
        valorIva,
      };
    });

    const subtotalSinImpuestos = round2(
      detalles.reduce((acc, d) => acc + d.precioTotalSinImpuesto, 0),
    );
    const totalDescuento = 0;
    const totalIva = round2(detalles.reduce((acc, d) => acc + d.valorIva, 0));
    const importeTotal = round2(subtotalSinImpuestos + totalIva);

    const xmlGenerado = buildFacturaXml({
      configFE,
      order: orderBase,
      paciente,
      comprador,
      detalles,
      secuencial,
      claveAcceso,
      fechaEmision,
      subtotalSinImpuestos,
      totalDescuento,
      importeTotal,
      ambienteCodigo: ambienteCod,
    });

    const xmlGeneradoPath =
      `${configFE.laboratorio_id}/${orderBase.id}/${claveAcceso}_generado.xml`;

    const up1 = await supabase.storage
      .from("facturas-xml")
      .upload(
        xmlGeneradoPath,
        new Blob([xmlGenerado], { type: "application/xml; charset=utf-8" }),
        { upsert: true, contentType: "application/xml; charset=utf-8" },
      );

    if (up1.error) {
      return jsonResponse({
        ok: false,
        message: `No se pudo guardar el XML generado: ${up1.error.message}`,
      }, 500);
    }

    const { data: certFile, error: certDownloadError } = await supabase.storage
      .from("certificados")
      .download(configFE.certificado_storage_path);

    if (certDownloadError || !certFile) {
      return jsonResponse({
        ok: false,
        message: "No se pudo descargar el certificado .p12",
        detail: certDownloadError?.message || null,
      }, 500);
    }

    const p12ArrayBuffer = await certFile.arrayBuffer();
    const p12Base64 = arrayBufferToBase64(p12ArrayBuffer);

    const signResponse = await fetch(`${signerUrl.replace(/\/$/, "")}/sign`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": signerApiKey,
      },
      body: JSON.stringify({
        xml: xmlGenerado,
        p12_base64: p12Base64,
        password: certPassword,
      }),
    });

    const signData = await signResponse.json().catch(() => null);

    if (!signResponse.ok || !signData?.ok || !signData?.signed_xml) {
      return jsonResponse({
        ok: false,
        stage: "firma_xml",
        message: signData?.detail || signData?.message || "No se pudo firmar el XML",
      }, 500);
    }

    const xmlFirmado = String(signData.signed_xml);

    if (
      !xmlFirmado.includes("QualifyingProperties") ||
      !xmlFirmado.includes("SignedProperties") ||
      !xmlFirmado.includes("X509Certificate") ||
      !xmlFirmado.includes("#comprobante")
    ) {
      return jsonResponse({
        ok: false,
        stage: "firma_xml",
        message: "La firma generada no contiene la estructura mínima esperada por SRI",
      }, 500);
    }

    const xmlFirmadoPath =
      `${configFE.laboratorio_id}/${orderBase.id}/${claveAcceso}_firmado.xml`;

    const up2 = await supabase.storage
      .from("facturas-xml")
      .upload(
        xmlFirmadoPath,
        new Blob([xmlFirmado], { type: "application/xml; charset=utf-8" }),
        { upsert: true, contentType: "application/xml; charset=utf-8" },
      );

    if (up2.error) {
      return jsonResponse({
        ok: false,
        message: `No se pudo guardar el XML firmado: ${up2.error.message}`,
      }, 500);
    }

    const facturaBasePayload = {
      laboratorio_id: configFE.laboratorio_id,
      configuracion_fe_id: configFE.id,
      tipo_comprobante: "FACTURA",
      ambiente,
      clave_acceso: claveAcceso,
      secuencial: secuencial,
      cliente_identificacion: comprador.identificacion,
      cliente_nombres: comprador.razonSocial,
      cliente_email: paciente?.email || null,
      subtotal: subtotalSinImpuestos,
      iva: totalIva,
      total: importeTotal,
      xml_generado_path: xmlGeneradoPath,
      xml_firmado_path: xmlFirmadoPath,
    };

    const orderBasePayload = {
      numero_factura: numeroFactura,
      clave_acceso_sri: claveAcceso,
      factura_xml_path: xmlGeneradoPath,
      factura_xml_firmado_path: xmlFirmadoPath,
    };

    const recepcion = await enviarRecepcionSRI(xmlFirmado, ambiente);

    if (recepcion.networkError) {
      return jsonResponse({
        ok: false,
        stage: "recepcion_sri",
        message: recepcion.networkMessage || "Error de conexión con SRI en recepción",
      }, 502);
    }

    const mensaje70 = recepcion.mensajes?.some(
      (m: any) => String(m?.identificador ?? "") === "70",
    ) ||
      recepcion.text.includes("Clave de acceso en procesamiento") ||
      recepcion.text.includes("EN_PROCESAMIENTO");

    if (recepcion.estado === "DEVUELTA" && !mensaje70) {
      const sriMensaje = recepcion.mensajes
        ?.map((m: any) =>
          [m.identificador, m.mensaje, m.informacionAdicional].filter(Boolean).join(" - ")
        )
        .join(" | ") || "Comprobante devuelto por el SRI";

      await persistirFacturaYOrden({
        supabase,
        facturaPayload: {
          ...facturaBasePayload,
          sri_estado: "DEVUELTA",
          sri_mensaje: sriMensaje,
        },
        orderId: orderBase.id,
        orderPayload: {
          ...orderBasePayload,
          factura_estado: "DEVUELTA",
          factura_mensaje: sriMensaje,
        },
        configId: configFE.id,
        secuencialActual: Number(configFE.secuencial_actual),
        incrementarSecuencial: true,
      });

      return jsonResponse({
        ok: false,
        stage: "recepcion_sri",
        message: sriMensaje,
        clave_acceso_sri: claveAcceso,
        numero_factura: numeroFactura,
        sri_estado: "DEVUELTA",
        sri_mensajes: recepcion.mensajes,
      }, 400);
    }

    const autorizacion = await autorizarConReintentos(claveAcceso, ambiente);

    if (
      autorizacion.networkError ||
      (!autorizacion.estado && (mensaje70 || recepcion.estado === "RECIBIDA"))
    ) {
      await persistirFacturaYOrden({
        supabase,
        facturaPayload: {
          ...facturaBasePayload,
          sri_estado: "EN_PROCESAMIENTO",
          sri_mensaje: "La clave ya fue enviada y sigue en procesamiento en el SRI",
        },
        orderId: orderBase.id,
        orderPayload: {
          ...orderBasePayload,
          factura_estado: "EN_PROCESAMIENTO",
          factura_mensaje: "La factura fue enviada al SRI y sigue en procesamiento",
        },
        configId: configFE.id,
        secuencialActual: Number(configFE.secuencial_actual),
        incrementarSecuencial: true,
      });

      return jsonResponse({
        ok: false,
        stage: "recepcion_sri",
        message: "La clave ya fue enviada y sigue en procesamiento en el SRI",
        clave_acceso_sri: claveAcceso,
        numero_factura: numeroFactura,
        sri_estado: "EN_PROCESAMIENTO",
        sri_mensajes: recepcion.mensajes,
      }, 202);
    }

    if (autorizacion.estado === "NO AUTORIZADO") {
      const sriMensaje = autorizacion.mensajes
        ?.map((m: any) =>
          [m.identificador, m.mensaje, m.informacionAdicional].filter(Boolean).join(" - ")
        )
        .join(" | ") || "Comprobante no autorizado por el SRI";

      await persistirFacturaYOrden({
        supabase,
        facturaPayload: {
          ...facturaBasePayload,
          sri_estado: "NO AUTORIZADO",
          sri_mensaje: sriMensaje,
        },
        orderId: orderBase.id,
        orderPayload: {
          ...orderBasePayload,
          factura_estado: "NO AUTORIZADO",
          factura_mensaje: sriMensaje,
        },
        configId: configFE.id,
        secuencialActual: Number(configFE.secuencial_actual),
        incrementarSecuencial: true,
      });

      return jsonResponse({
        ok: false,
        stage: "autorizacion_sri",
        message: sriMensaje,
        clave_acceso_sri: claveAcceso,
        numero_factura: numeroFactura,
        sri_estado: "NO AUTORIZADO",
      }, 400);
    }

    if (autorizacion.estado !== "AUTORIZADO") {
      await persistirFacturaYOrden({
        supabase,
        facturaPayload: {
          ...facturaBasePayload,
          sri_estado: "EN_PROCESAMIENTO",
          sri_mensaje: "La autorización aún no está disponible en el SRI",
        },
        orderId: orderBase.id,
        orderPayload: {
          ...orderBasePayload,
          factura_estado: "EN_PROCESAMIENTO",
          factura_mensaje: "La autorización aún no está disponible en el SRI",
        },
        configId: configFE.id,
        secuencialActual: Number(configFE.secuencial_actual),
        incrementarSecuencial: true,
      });

      return jsonResponse({
        ok: false,
        stage: "autorizacion_sri",
        message: "La autorización aún no está disponible en el SRI",
        clave_acceso_sri: claveAcceso,
        numero_factura: numeroFactura,
        sri_estado: "EN_PROCESAMIENTO",
      }, 202);
    }

    const xmlAutorizado =
      autorizacion.comprobanteRaw
        ? decodeHtmlEntities(autorizacion.comprobanteRaw)
        : xmlFirmado;

    const xmlAutorizadoPath =
      `${configFE.laboratorio_id}/${orderBase.id}/${claveAcceso}_autorizado.xml`;

    const up3 = await supabase.storage
      .from("facturas-xml")
      .upload(
        xmlAutorizadoPath,
        new Blob([xmlAutorizado], { type: "application/xml; charset=utf-8" }),
        { upsert: true, contentType: "application/xml; charset=utf-8" },
      );

    if (up3.error) {
      return jsonResponse({
        ok: false,
        message: `No se pudo guardar el XML autorizado: ${up3.error.message}`,
      }, 500);
    }

    const pdfPath = `${configFE.laboratorio_id}/${orderBase.id}/${claveAcceso}_ride.pdf`;

    const rideBytes = await generarRidePdf({
      razonSocial: configFE.razon_social,
      ruc: stripNonDigits(configFE.ruc),
      numeroFactura,
      fecha: fechaEmision,
      paciente: comprador.razonSocial,
      identificacion: comprador.identificacion,
      direccion: paciente?.direccion || undefined,
      email: paciente?.email || undefined,
      claveAcceso,
      autorizacion: autorizacion.numeroAutorizacion || claveAcceso,
      detalles: detalles.map((d) => ({
        descripcion: d.descripcion,
        precio: round2(d.precioTotalSinImpuesto + d.valorIva),
      })),
      subtotal: subtotalSinImpuestos,
      iva: totalIva,
      total: importeTotal,
    });

    const up4 = await supabase.storage
      .from("facturas-pdf")
      .upload(pdfPath, rideBytes, {
        upsert: true,
        contentType: "application/pdf",
      });

    if (up4.error) {
      return jsonResponse({
        ok: false,
        message: `No se pudo guardar el PDF RIDE: ${up4.error.message}`,
      }, 500);
    }

    const factura = await persistirFacturaYOrden({
      supabase,
      facturaPayload: {
        ...facturaBasePayload,
        xml_autorizado_path: xmlAutorizadoPath,
        ride_pdf_path: pdfPath,
        sri_estado: "AUTORIZADO",
        sri_numero_autorizacion: autorizacion.numeroAutorizacion || claveAcceso,
        sri_fecha_autorizacion: autorizacion.fechaAutorizacion || new Date().toISOString(),
        sri_mensaje: "Comprobante autorizado por el SRI",
      },
      orderId: orderBase.id,
      orderPayload: {
        ...orderBasePayload,
        numero_autorizacion_sri: autorizacion.numeroAutorizacion || claveAcceso,
        factura_estado: "AUTORIZADO",
        factura_xml_autorizado_path: xmlAutorizadoPath,
        factura_ride_pdf_path: pdfPath,
        factura_fecha_autorizacion: autorizacion.fechaAutorizacion || new Date().toISOString(),
        factura_mensaje: "Factura autorizada correctamente por el SRI",
      },
      configId: configFE.id,
      secuencialActual: Number(configFE.secuencial_actual),
      incrementarSecuencial: true,
    });

    return jsonResponse({
      ok: true,
      message: "Factura autorizada correctamente",
      factura_id: factura.id,
      numero_factura: numeroFactura,
      clave_acceso_sri: claveAcceso,
      numero_autorizacion_sri: autorizacion.numeroAutorizacion || claveAcceso,
      factura_estado: "AUTORIZADO",
      factura_xml_path: xmlGeneradoPath,
      factura_xml_firmado_path: xmlFirmadoPath,
      factura_xml_autorizado_path: xmlAutorizadoPath,
      factura_ride_pdf_path: pdfPath,
    });
  } catch (error: any) {
    console.error("ERROR EDGE FACTURA:", error);

    return jsonResponse({
      ok: false,
      message: error?.message || "Error interno al generar la factura",
      stack: error?.stack || null,
    }, 500);
  }
});