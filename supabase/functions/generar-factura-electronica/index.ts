import { createClient } from "npm:@supabase/supabase-js@2";
import { PDFDocument, StandardFonts, rgb } from "npm:pdf-lib@1.17.1";

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

function mapTipoIdentificacionSri(tipo: string | null | undefined): string {
  const t = String(tipo || "").trim().toUpperCase();

  if (t === "RUC") return "04";
  if (t === "CEDULA") return "05";
  if (t === "PASAPORTE") return "06";
  if (t === "CONSUMIDOR_FINAL") return "07";

  return "05";
}

function resolverCompradorDesdeOrden(order: any, paciente: any) {
  const facturaTipo = String(order?.factura_tipo_identificacion || "").trim().toUpperCase();
  const facturaIdentificacion = String(order?.factura_identificacion || "").trim();
  const facturaNombres = String(order?.factura_nombres || "").trim();
  const facturaDireccion = String(order?.factura_direccion || "").trim();
  const facturaTelefono = String(order?.factura_telefono || "").trim();
  const facturaEmail = String(order?.factura_email || "").trim();

  const pacienteNombre = String(paciente?.name || "").trim();
  const pacienteCedula = String(paciente?.cedula || "").trim();
  const pacienteDireccion = String(paciente?.direccion || "").trim();
  const pacienteTelefono = String(paciente?.phone || "").trim();
  const pacienteEmail = String(paciente?.email || "").trim();

  const nombres = facturaNombres || pacienteNombre || "Consumidor Final";
  const identificacionRaw = facturaIdentificacion || pacienteCedula;
  const identificacion = stripNonDigits(identificacionRaw);
  const direccion = facturaDireccion || pacienteDireccion;
  const telefono = facturaTelefono || pacienteTelefono;
  const email = facturaEmail || pacienteEmail;

  if (facturaTipo === "CONSUMIDOR_FINAL" || !identificacion) {
    return {
      tipo: "07",
      identificacion: "9999999999999",
      razonSocial: "Consumidor Final",
      direccion,
      telefono,
      email: "",
    };
  }

  return {
    tipo: mapTipoIdentificacionSri(facturaTipo),
    identificacion,
    razonSocial: nombres,
    direccion,
    telefono,
    email,
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

function agruparDetallesExamenes(
  detalles: Array<{
    test_id?: string | null;
    descripcion: string;
    cantidad: number;
    precioUnitario: number;
    descuento: number;
    precioTotalSinImpuesto: number;
    baseImponible: number;
    codigoPorcentaje: string;
    tarifa: number;
    valorIva: number;
  }>,
) {
  const mapa = new Map<string, {
    test_id?: string | null;
    descripcion: string;
    cantidad: number;
    precioUnitarioBruto: number;
    descuento: number;
    precioTotalSinImpuesto: number;
    baseImponible: number;
    codigoPorcentaje: string;
    tarifa: number;
    valorIva: number;
  }>();

  for (const d of detalles || []) {
    const key = [
      String(d.test_id || ""),
      String(d.descripcion || "").trim().toLowerCase(),
      String(d.codigoPorcentaje || ""),
      Number(d.tarifa || 0).toFixed(2),
    ].join("|");

    if (!mapa.has(key)) {
      mapa.set(key, {
        test_id: d.test_id || null,
        descripcion: String(d.descripcion || "Examen de laboratorio").trim(),
        cantidad: 0,
        precioUnitarioBruto: 0,
        descuento: 0,
        precioTotalSinImpuesto: 0,
        baseImponible: 0,
        codigoPorcentaje: String(d.codigoPorcentaje || ""),
        tarifa: round2(Number(d.tarifa || 0)),
        valorIva: 0,
      });
    }

    const item = mapa.get(key)!;
    item.cantidad += Number(d.cantidad || 0);
    item.precioUnitarioBruto += Number(d.precioUnitario || 0) * Number(d.cantidad || 0);
    item.descuento += Number(d.descuento || 0);
    item.precioTotalSinImpuesto += Number(d.precioTotalSinImpuesto || 0);
    item.baseImponible += Number(d.baseImponible || 0);
    item.valorIva += Number(d.valorIva || 0);
  }

  return Array.from(mapa.values()).map((item) => ({
    ...item,
    cantidad: round2(item.cantidad),
    precioUnitarioBruto: round2(item.precioUnitarioBruto),
    descuento: round2(item.descuento),
    precioTotalSinImpuesto: round2(item.precioTotalSinImpuesto),
    baseImponible: round2(item.baseImponible),
    valorIva: round2(item.valorIva),
    precioUnitario:
      item.cantidad > 0
        ? round2(item.precioUnitarioBruto / item.cantidad)
        : 0,
  }));
}

function agruparDetallesFactura(
  detalles: Array<{
    test_id?: string | null;
    descripcion: string;
    cantidad: number;
    precioUnitario: number;
    descuento: number;
    precioTotalSinImpuesto: number;
    baseImponible: number;
    codigoPorcentaje: string;
    tarifa: number;
    valorIva: number;
  }>,
) {
  const mapa = new Map<string, {
    descripcion: string;
    cantidadOriginal: number;
    precioBruto: number;
    descuento: number;
    precioTotalSinImpuesto: number;
    baseImponible: number;
    valorIva: number;
    codigoPorcentaje: string;
    tarifa: number;
  }>();

  for (const d of detalles || []) {
    const descripcion = String(d.descripcion || "Examen de laboratorio").trim();
    const key = descripcion.toLowerCase().trim();

    if (!mapa.has(key)) {
      mapa.set(key, {
        descripcion,
        cantidadOriginal: 0,
        precioBruto: 0,
        descuento: 0,
        precioTotalSinImpuesto: 0,
        baseImponible: 0,
        valorIva: 0,
        codigoPorcentaje: String(d.codigoPorcentaje || ""),
        tarifa: round2(Number(d.tarifa || 0)),
      });
    }

    const item = mapa.get(key)!;
    item.cantidadOriginal += Number(d.cantidad || 0);
    item.precioBruto += Number(d.precioUnitario || 0) * Number(d.cantidad || 0);
    item.descuento += Number(d.descuento || 0);
    item.precioTotalSinImpuesto += Number(d.precioTotalSinImpuesto || 0);
    item.baseImponible += Number(d.baseImponible || 0);
    item.valorIva += Number(d.valorIva || 0);
  }

  return Array.from(mapa.values()).map((item) => {
    const precioBruto = round2(item.precioBruto);
    const descuento = round2(item.descuento);
    const totalSinImpuesto = round2(item.precioTotalSinImpuesto);

    return {
      descripcion: item.descripcion,
      cantidad: 1,
      precioUnitario: precioBruto,
      descuento,
      precioTotalSinImpuesto: totalSinImpuesto,
      baseImponible: round2(item.baseImponible),
      codigoPorcentaje: item.codigoPorcentaje,
      tarifa: round2(item.tarifa),
      valorIva: round2(item.valorIva),
      cantidadOriginal: round2(item.cantidadOriginal),
    };
  });
}

function buildFacturaXml(params: {
  configFE: any;
  order: any;
  paciente: any;
  comprador: {
    tipo: string;
    identificacion: string;
    razonSocial: string;
    direccion?: string;
    telefono?: string;
    email?: string;
  };
  detalles: Array<{
    descripcion: string;
    cantidad: number;
    precioUnitario: number;
    descuento: number;
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
  const emailFacturacion = String(params.comprador?.email || "").trim();
  const direccionFacturacion = String(params.comprador?.direccion || "").trim();
  const nombrePaciente = String(paciente?.name || "").trim();
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
        <descuento>${formatMoney(d.descuento)}</descuento>
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
    ${nombrePaciente ? `<campoAdicional nombre="Paciente">${xmlEscape(nombrePaciente)}</campoAdicional>` : ""}
    ${emailFacturacion ? `<campoAdicional nombre="Email">${xmlEscape(emailFacturacion)}</campoAdicional>` : ""}
    ${direccionFacturacion ? `<campoAdicional nombre="Direccion">${xmlEscape(direccionFacturacion)}</campoAdicional>` : ""}
    <campoAdicional nombre="Orden">${xmlEscape(params.order?.code || params.order?.id || "")}</campoAdicional>
  </infoAdicional>
</factura>`;
}

async function generarRidePdf(params: {
  logo?: string;
  razonSocial: string;
  nombreComercial?: string;
  ruc: string;
  numeroFactura: string;
  fecha: string;
  cliente: string;
  identificacion: string;
  direccion?: string;
  email?: string;
  nombrePaciente?: string;
  claveAcceso: string;
  autorizacion: string;
  fechaAutorizacion?: string;
  ambiente?: string;
  emision?: string;
  direccionMatriz?: string;
  direccionSucursal?: string;
  obligadoContabilidad?: string;
  formaPago?: string;
  orden?: string;
  detalles: Array<{
    codigoPrincipal?: string;
    codigoAuxiliar?: string;
    cantidad: number;
    descripcion: string;
    detalleAdicional?: string;
    precioUnitario: number;
    subsidio?: number;
    precioSinSubsidio?: number;
    descuento?: number;
    precioTotal: number;
  }>;
  subtotal0?: number;
  subtotalNoObjetoIva?: number;
  subtotalExentoIva?: number;
  subtotalSinImpuestos: number;
  totalDescuento?: number;
  ice?: number;
  irbpnr?: number;
  propina?: number;
  total: number;
  valorTotalSinSubsidio?: number;
  ahorroPorSubsidio?: number;
}) {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595.28, 841.89]); // A4
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const cPrimary = rgb(0.12, 0.25, 0.52);
  const cText = rgb(0.14, 0.16, 0.20);
  const cMuted = rgb(0.45, 0.49, 0.57);
  const cBorder = rgb(0.85, 0.88, 0.92);
  const cSoft = rgb(0.96, 0.97, 0.995);
  const cSoft2 = rgb(0.985, 0.988, 0.995);
  const cGreen = rgb(0.91, 0.97, 0.93);

  const pageW = 595.28;
  const pageH = 841.89;
  const margin = 36;

  const safe = (v: any) => String(v ?? "").trim();
  const money = (v?: number | null) => Number(v || 0).toFixed(2);

  const agruparDetallesRide = (
    detalles: Array<{
      codigoPrincipal?: string;
      codigoAuxiliar?: string;
      cantidad: number;
      descripcion: string;
      detalleAdicional?: string;
      precioUnitario: number;
      subsidio?: number;
      precioSinSubsidio?: number;
      descuento?: number;
      precioTotal: number;
    }>
  ) => {
    const mapa = new Map<string, {
      descripcion: string;
      cantidadOriginal: number;
      precioTotal: number;
      descuento: number;
      subsidio: number;
      precioSinSubsidio: number;
      codigoPrincipal?: string;
      codigoAuxiliar?: string;
    }>();

    for (const item of detalles || []) {
      const descripcion = safe(item?.descripcion || "Item").trim();
      const key = descripcion.toLowerCase().trim();

      if (!mapa.has(key)) {
        mapa.set(key, {
          descripcion,
          cantidadOriginal: 0,
          precioTotal: 0,
          descuento: 0,
          subsidio: 0,
          precioSinSubsidio: 0,
          codigoPrincipal: item?.codigoPrincipal,
          codigoAuxiliar: item?.codigoAuxiliar,
        });
      }

      const actual = mapa.get(key)!;
      actual.cantidadOriginal += Number(item?.cantidad || 0);
      actual.precioTotal += Number(item?.precioTotal || 0);
      actual.descuento += Number(item?.descuento || 0);
      actual.subsidio += Number(item?.subsidio || 0);
      actual.precioSinSubsidio += Number(item?.precioSinSubsidio || 0);
    }

    return Array.from(mapa.values()).map((item, idx) => ({
      codigoPrincipal: item.codigoPrincipal || String(idx + 1).padStart(3, "0"),
      codigoAuxiliar: item.codigoAuxiliar || "",
      cantidad: 1,
      descripcion: item.descripcion,
      detalleAdicional: "",
      precioUnitario: round2(item.precioTotal),
      subsidio: round2(item.subsidio),
      precioSinSubsidio: round2(item.precioSinSubsidio),
      descuento: round2(item.descuento),
      precioTotal: round2(item.precioTotal),
      cantidadOriginal: round2(item.cantidadOriginal),
    }));
  };

  const splitAuthorization = (value?: string | null) => {
    const raw = safe(value).replace(/\s+/g, "");
    if (!raw) return { line1: "—", line2: "" };

    return {
      line1: raw.slice(0, 17),
      line2: raw.slice(17),
    };
  };

  const formatAuthDate = (value?: string | null) => {
    const raw = String(value ?? "").trim();
    if (!raw) return "";

    // Caso: viene ISO (2026-04-15T10:53:13-05:00)
    if (raw.includes("T")) {
      const [datePart, timePart] = raw.split("T");

      if (!timePart) return raw;

      // quitar zona horaria (-05:00 o Z)
      const cleanTime = timePart.replace(/Z|([+-]\d{2}:\d{2})/, "");

      return `${datePart} ${cleanTime}`;
    }

    // Caso: ya viene bien (2026-04-15 11:15:27)
    return raw;
  };

  const textWidth = (text: string, size = 10, isBold = false) =>
    (isBold ? bold : font).widthOfTextAtSize(safe(text), size);

  const wrapText = (text: string, maxWidth: number, size = 10, isBold = false) => {
    const f = isBold ? bold : font;
    const words = safe(text).split(/\s+/).filter(Boolean);
    if (!words.length) return [""];

    const lines: string[] = [];
    let current = "";

    for (const word of words) {
      const candidate = current ? `${current} ${word}` : word;
      if (f.widthOfTextAtSize(candidate, size) <= maxWidth || !current) {
        current = candidate;
      } else {
        lines.push(current);
        current = word;
      }
    }

    if (current) lines.push(current);
    return lines;
  };

  const drawText = (
    text: string,
    x: number,
    y: number,
    size = 10,
    isBold = false,
    color = cText
  ) => {
    page.drawText(safe(text), {
      x,
      y,
      size,
      font: isBold ? bold : font,
      color,
    });
  };

  const drawRightText = (
    text: string,
    rightX: number,
    y: number,
    size = 10,
    isBold = false,
    color = cText
  ) => {
    page.drawText(safe(text), {
      x: rightX - textWidth(text, size, isBold),
      y,
      size,
      font: isBold ? bold : font,
      color,
    });
  };

  const drawWrapped = (
    text: string,
    x: number,
    y: number,
    maxWidth: number,
    size = 10,
    isBold = false,
    color = cText,
    rowGap = 3
  ) => {
    const lines = wrapText(text, maxWidth, size, isBold);
    let cy = y;
    for (const line of lines) {
      page.drawText(line, {
        x,
        y: cy,
        size,
        font: isBold ? bold : font,
        color,
      });
      cy -= size + rowGap;
    }
    return { lines, endY: cy };
  };

  const box = (
    x: number,
    y: number,
    w: number,
    h: number,
    opts?: { fill?: ReturnType<typeof rgb>; radius?: number; border?: ReturnType<typeof rgb> }
  ) => {
    page.drawRectangle({
      x,
      y,
      width: w,
      height: h,
      color: opts?.fill,
      borderColor: opts?.border ?? cBorder,
      borderWidth: 1,
      borderRadius: opts?.radius ?? 10,
    });
  };

  async function embedLogoFromValue(value?: string) {
    const raw = safe(value);
    if (!raw) return null;

    try {
      if (raw.startsWith("data:image/png")) {
        const base64 = raw.split(",")[1] || "";
        return await pdfDoc.embedPng(Uint8Array.from(atob(base64), c => c.charCodeAt(0)));
      }

      if (raw.startsWith("data:image/jpeg") || raw.startsWith("data:image/jpg")) {
        const base64 = raw.split(",")[1] || "";
        return await pdfDoc.embedJpg(Uint8Array.from(atob(base64), c => c.charCodeAt(0)));
      }

      if (raw.startsWith("http://") || raw.startsWith("https://")) {
        const res = await fetch(raw);
        if (!res.ok) return null;
        const bytes = new Uint8Array(await res.arrayBuffer());
        const contentType = res.headers.get("content-type") || "";
        if (contentType.includes("png")) return await pdfDoc.embedPng(bytes);
        if (contentType.includes("jpeg") || contentType.includes("jpg")) return await pdfDoc.embedJpg(bytes);
      }
    } catch {
      return null;
    }

    return null;
  }

  async function barcodeImage(value: string) {
    try {
      const { default: bwipjs } = await import("npm:bwip-js@4.5.1");
      const png = await bwipjs.toBuffer({
        bcid: "code128",
        text: value,
        scale: 2,
        height: 10,
        includetext: false,
        paddingwidth: 0,
        paddingheight: 0,
      });
      return await pdfDoc.embedPng(png);
    } catch {
      return null;
    }
  }

  const logo = await embedLogoFromValue(params.logo);
  const barcode = await barcodeImage(params.claveAcceso);
  const detallesAgrupados = agruparDetallesRide(params.detalles || []);
  // ===== HEADER =====
  box(0, pageH - 140, pageW, 140, { fill: cSoft, border: cSoft, radius: 0 });

  if (logo) {
    const maxW = 78;
    const maxH = 52;
    const scale = Math.min(maxW / logo.width, maxH / logo.height);
    const w = logo.width * scale;
    const h = logo.height * scale;

    page.drawImage(logo, {
      x: margin,
      y: pageH - 92,
      width: w,
      height: h,
    });
  }

  const companyX = logo ? margin + 92 : margin;
  const companyW = 240;

  const rsLines = wrapText(params.razonSocial, companyW, 16, true);
  let headerTextY = pageH - 52;
  for (const line of rsLines) {
    drawText(line, companyX, headerTextY, 16, true, cPrimary);
    headerTextY -= 20;
  }

  if (safe(params.nombreComercial)) {
    drawText(params.nombreComercial || "", companyX, headerTextY, 11, false, cText);
    headerTextY -= 16;
  }

  const emisorDir = safe(params.direccionMatriz || params.direccionSucursal);
  const emisorDirDraw = drawWrapped(
    emisorDir,
    companyX,
    headerTextY,
    companyW,
    8.5,
    false,
    cMuted,
    2
  );

  drawText(
    `RUC: ${safe(params.ruc)}`,
    companyX,
    emisorDirDraw.endY - 6,
    8.5,
    false,
    cMuted
  );

  const invoiceBoxX = pageW - margin - 182;
  const invoiceBoxY = pageH - 98;
  const invoiceBoxW = 182;
  const invoiceBoxH = 66;
  box(invoiceBoxX, invoiceBoxY, invoiceBoxW, invoiceBoxH, { fill: rgb(1, 1, 1), radius: 12 });

  drawText("FACTURA ELECTRÓNICA", invoiceBoxX + 16, invoiceBoxY + 42, 13, true, cPrimary);
  drawText(`No. ${safe(params.numeroFactura)}`, invoiceBoxX + 16, invoiceBoxY + 26, 10, true);
  drawText(`Fecha emisión: ${safe(params.fecha)}`, invoiceBoxX + 16, invoiceBoxY + 12, 8.5, false, cMuted);

  // ===== TOP GRID =====
  let y = pageH - 146;
  const leftX = margin;
  const leftW = 295;
  const rightX = leftX + leftW + 16;
  const rightW = pageW - margin - rightX;

  const clienteRows = [
    { label: "Cliente", value: params.cliente || "—" },
    { label: "Identificación", value: params.identificacion || "—" },
    { label: "Dirección", value: params.direccion || "—" },
    { label: "Email", value: params.email || "—" },
  ];

  const clientePrepared = clienteRows.map((r) => {
    const lines = wrapText(r.value, leftW - 110, 9);
    return { ...r, lines, h: Math.max(16, lines.length * 12) };
  });
  const clienteH = 24 + clientePrepared.reduce((a, b) => a + b.h, 0) + 12;

  box(leftX, y - clienteH, leftW, clienteH, { fill: rgb(1, 1, 1), radius: 12 });
  drawText("Datos del cliente", leftX + 14, y - 20, 11, true);

  let cy = y - 42;
  for (const row of clientePrepared) {
    drawText(row.label, leftX + 14, cy, 8, true, cMuted);
    drawWrapped(row.value, leftX + 96, cy, leftW - 110, 9, false, cText, 3);
    cy -= row.h;
  }

  const authValue = safe(params.autorizacion || "—");
  const claveValue = safe(params.claveAcceso || "—");
  const fechaAuthValue = formatAuthDate(params.fechaAutorizacion);
  const authSplit = splitAuthorization(authValue);
  const claveLines = wrapText(claveValue, rightW - 28, 7.2);

  // Autorización:
  // línea 1 al mismo nivel de "Autorización"
  // línea 2 debajo
  const authBlockH = 24;

  // Clave:
  // más espacio vertical para que el código de barras no se corte
  const claveBlockH = barcode
    ? 56 + claveLines.length * 9
    : 16 + claveLines.length * 9;

  const tributariaH =
    24 +   // título
    authBlockH +
    22 +   // fecha autorización
    18 +   // ambiente
    18 +   // emisión
    18 +   // label clave
    claveBlockH +
    18;    // padding inferior

  box(rightX, y - tributariaH, rightW, tributariaH, { fill: rgb(1, 1, 1), radius: 12 });
  drawText("Información tributaria", rightX + 14, y - 20, 11, true);

  let ty = y - 42;

  // Autorización:
  // misma línea del label y primera parte a la altura donde empieza fecha autorización
  drawText("Autorización", rightX + 14, ty, 8, true, cMuted);
  drawText(authSplit.line1, rightX + 120, ty, 8.3, false, cText);

  // resto debajo
  if (authSplit.line2) {
    drawText(authSplit.line2, rightX + 14, ty - 12, 8.3, false, cText);
  }

  ty -= 24;

  drawText("Fecha autorización", rightX + 14, ty, 8, true, cMuted);
  drawText(fechaAuthValue || "—", rightX + 120, ty, 8.3, false, cText);

  ty -= 18;
  drawText("Ambiente", rightX + 14, ty, 8, true, cMuted);
  drawText(params.ambiente || "PRUEBAS", rightX + 120, ty, 8.3, false, cText);

  ty -= 18;
  drawText("Emisión", rightX + 14, ty, 8, true, cMuted);
  drawText(params.emision || "NORMAL", rightX + 120, ty, 8.3, false, cText);

  ty -= 18;
  drawText("Clave de acceso", rightX + 14, ty, 8, true, cMuted);

  if (barcode) {
    page.drawImage(barcode, {
      x: rightX + 14,
      y: ty - 40,
      width: rightW - 28,
      height: 24,
    });

    drawWrapped(
      claveValue,
      rightX + 14,
      ty - 54,
      rightW - 28,
      7.2,
      false,
      cMuted,
      2
    );
  } else {
    drawWrapped(
      claveValue,
      rightX + 14,
      ty - 12,
      rightW - 28,
      7.2,
      false,
      cText,
      2
    );
  }

  y -= Math.max(clienteH, tributariaH) + 22;

  // ===== TABLE =====
  drawText("Detalle de la factura", margin, y, 12, true);
  y -= 14;

  const tableX = margin;
  const tableW = pageW - margin * 2;
  const descW = 220;
  const qtyW = 45;
  const unitW = 70;
  const discW = 70;
  const totalW = tableW - descW - qtyW - unitW - discW;
  const headerH = 28;

  box(tableX, y - headerH, tableW, headerH, { fill: cPrimary, border: cPrimary, radius: 10 });
  drawText("Descripción", tableX + 14, y - 18, 9, true, rgb(1, 1, 1));
  drawRightText("Cant.", tableX + descW + qtyW - 12, y - 18, 9, true, rgb(1, 1, 1));
  drawRightText("P. Unit.", tableX + descW + qtyW + unitW - 12, y - 18, 9, true, rgb(1, 1, 1));
  drawRightText("Desc.", tableX + descW + qtyW + unitW + discW - 12, y - 18, 9, true, rgb(1, 1, 1));
  drawRightText("Total", tableX + tableW - 12, y - 18, 9, true, rgb(1, 1, 1));

  y -= headerH + 6;

  let zebra = false;
  for (const item of detallesAgrupados) {
    const desc = [safe(item.descripcion), safe(item.detalleAdicional)].filter(Boolean).join(" — ");
    const descLines = wrapText(desc || "Item", descW - 24, 9);
    const rowH = Math.max(24, 16 + descLines.length * 11);

    box(tableX, y - rowH, tableW, rowH, {
      fill: zebra ? cSoft2 : rgb(1, 1, 1),
      border: cBorder,
      radius: 8,
    });

    drawWrapped(desc, tableX + 12, y - 16, descW - 24, 9, false, cText, 2);
    drawRightText(Number(item.cantidad || 0).toFixed(2), tableX + descW + qtyW - 12, y - 16, 9);
    drawRightText(`$${money(item.precioUnitario)}`, tableX + descW + qtyW + unitW - 12, y - 16, 9);
    drawRightText(`$${money(item.descuento || 0)}`, tableX + descW + qtyW + unitW + discW - 12, y - 16, 9);
    drawRightText(`$${money(item.precioTotal)}`, tableX + tableW - 12, y - 16, 9, true);

    y -= rowH + 6;
    zebra = !zebra;
  }

  y -= 8;

  // ===== BOTTOM =====
  const addX = margin;
  const addW = 305;
  const sumX = pageW - margin - 202;
  const sumW = 202;

  const additionalRows = [
    { label: "Paciente", value: params.nombrePaciente || "—" },
    { label: "Dirección", value: params.direccion || "—" },
    { label: "Email", value: params.email || "—" },
    { label: "Orden", value: params.orden || "—" },
    { label: "Forma de pago", value: params.formaPago || "—" },
  ];

  const addPrepared = additionalRows.map((r) => {
    const lines = wrapText(r.value, addW - 120, 8.5);
    return { ...r, lines, h: Math.max(16, lines.length * 11) };
  });

  const addH = 24 + addPrepared.reduce((a, b) => a + b.h, 0) + 12;

  const summaryRows = [
    ["Subtotal 0%", params.subtotal0],
    ["Subtotal no objeto IVA", params.subtotalNoObjetoIva],
    ["Subtotal exento IVA", params.subtotalExentoIva],
    ["Subtotal sin impuestos", params.subtotalSinImpuestos],
    ["Descuento", params.totalDescuento],
    ["ICE", params.ice],
    ["IRBPNR", params.irbpnr],
    ["Propina", params.propina],
    ["Valor total", params.total],
    ["Total sin subsidio", params.valorTotalSinSubsidio],
    ["Ahorro por subsidio", params.ahorroPorSubsidio],
  ];

  const sumRowH = 24;
  const sumH = 28 + summaryRows.length * sumRowH + 12;

  const baseTop = y;
  box(addX, baseTop - addH, addW, addH, { fill: rgb(1, 1, 1), radius: 12 });
  drawText("Información adicional", addX + 14, baseTop - 20, 11, true);

  let ay = baseTop - 42;
  for (const row of addPrepared) {
    drawText(row.label, addX + 14, ay, 8, true, cMuted);
    drawWrapped(row.value, addX + 98, ay, addW - 112, 8.5, false, cText, 2);
    ay -= row.h;
  }

  box(sumX, baseTop - sumH, sumW, sumH, { fill: rgb(1, 1, 1), radius: 12 });
  drawText("Resumen", sumX + 14, baseTop - 20, 11, true);

  let sy = baseTop - 48;
  for (const [label, value] of summaryRows) {
    box(sumX + 12, sy - 11, sumW - 24, 20, {
      fill: label === "Valor total" ? cGreen : undefined,
      border: cBorder,
      radius: 6,
    });

    drawText(
      String(label),
      sumX + 22,
      sy - 2,
      8.2,
      label === "Valor total",
      label === "Valor total" ? cPrimary : cMuted
    );

    drawRightText(
      `$${money(value as number)}`,
      sumX + sumW - 22,
      sy - 2,
      8.2,
      true,
      label === "Valor total" ? cPrimary : cText
    );

    sy -= sumRowH;
  }

  drawText(
    "Documento generado electrónicamente. Verifique la clave de acceso y el número de autorización en sus registros.",
    margin,
    26,
    7.2,
    false,
    cMuted
  );

  return await pdfDoc.save();
}

function money(value?: number | null): string {
  return Number(value || 0).toFixed(2);
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

    const signerUrl = String(Deno.env.get("SIGNER_URL") ?? "").trim();
    const signerApiKey = String(Deno.env.get("SIGNER_API_KEY") ?? "").trim();
    const certPassword = String(Deno.env.get("CERT_P12_PASSWORD") ?? "").trim();

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

    const totalOrden = round2(Number(orderBase.total || 0));
    const pagadoOrden = round2(Number(orderBase.paid_amount || 0));

    if (pagadoOrden < totalOrden) {
      return jsonResponse({
        ok: false,
        message: "La orden aún no está pagada en su totalidad. No se puede facturar.",
        total: totalOrden,
        pagado: pagadoOrden,
        saldo: round2(Math.max(totalOrden - pagadoOrden, 0)),
      }, 400);
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
        descuento,
        porcentaje_iva,
        codigo_porcentaje_iva,
        objeto_impuesto,
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

    const { data: labConfig, error: labConfigError } = await supabase
      .from("configuracion_laboratorio")
      .select("id, logo, name, legal_name, address, ruc, email")
      .eq("id", configFE.laboratorio_id)
      .maybeSingle();

    if (labConfigError) {
      return jsonResponse({
        ok: false,
        message: "Error consultando configuracion_laboratorio",
        detail: labConfigError.message,
      }, 500);
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

    const comprador = resolverCompradorDesdeOrden(orderBase, paciente);

    console.log("DEBUG COMPRADOR RESUELTO", {
      factura_tipo_identificacion: orderBase.factura_tipo_identificacion,
      factura_identificacion: orderBase.factura_identificacion,
      factura_nombres: orderBase.factura_nombres,
      factura_email: orderBase.factura_email,
      comprador,
    });

    const detallesBase = (detallesRaw || []).map((d: any) => {
      const descripcion = String(d?.pruebas?.name || "Examen de laboratorio").trim();
      const cantidad = 1;
      const precioUnitario = round2(Number(d.price || d?.pruebas?.price || 0));
      const descuento = round2(Number(d.descuento || 0));
      const tarifa = round2(
        Number(d.porcentaje_iva ?? d?.pruebas?.porcentaje_iva ?? configFE.porcentaje_iva ?? 15)
      );
      const codigoPorcentaje = String(
        d.codigo_porcentaje_iva || d?.pruebas?.codigo_porcentaje_iva || "4"
      );
      const baseImponible = round2(Number(d.subtotal_sin_impuesto ?? Math.max(precioUnitario - descuento, 0)));
      const valorIva = round2(Number(d.valor_iva ?? (baseImponible * tarifa / 100)));
      const precioTotalSinImpuesto = round2(Number(d.subtotal_sin_impuesto ?? Math.max(precioUnitario - descuento, 0)));

      return {
        test_id: d?.test_id || null,
        descripcion,
        cantidad,
        precioUnitario,
        descuento,
        precioTotalSinImpuesto,
        baseImponible,
        codigoPorcentaje,
        tarifa,
        valorIva,
      };
    });

    const detalles = agruparDetallesFactura(detallesBase);

    const subtotalSinImpuestos = round2(
      detalles.reduce((acc, d) => acc + d.precioTotalSinImpuesto, 0),
    );
    const totalDescuento = round2(
      detalles.reduce((acc, d) => acc + Number(d.descuento || 0), 0),
    );
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
      cliente_email: comprador.email || null,
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
      logo: labConfig?.logo || undefined,
      razonSocial: labConfig?.legal_name || configFE.razon_social,
      nombreComercial: labConfig?.name || configFE.nombre_comercial || configFE.razon_social,
      ruc: stripNonDigits(labConfig?.ruc || configFE.ruc),
      numeroFactura,
      fecha: fechaEmision,
      cliente: comprador.razonSocial,
      identificacion: comprador.identificacion,
      direccion: comprador.direccion || undefined,
      email: comprador.email || undefined,
      nombrePaciente: String(paciente?.name || "").trim() || undefined,
      claveAcceso,
      autorizacion: autorizacion.numeroAutorizacion || claveAcceso,
      fechaAutorizacion: autorizacion.fechaAutorizacion || undefined,
      ambiente,
      emision: "NORMAL",
      direccionMatriz:
        labConfig?.address || configFE.direccion_matriz || configFE.direccion_establecimiento || "",
      direccionSucursal:
        labConfig?.address || configFE.direccion_establecimiento || configFE.direccion_matriz || "",
      obligadoContabilidad: configFE.obligado_contabilidad ? "SI" : "NO",
      formaPago: `${configFE.forma_pago_sri || "01"} - SIN UTILIZACION DEL SISTEMA FINANCIERO`,
      orden: orderBase.code || orderBase.id,
      detalles: detalles.map((d, idx) => ({
        codigoPrincipal: String(idx + 1).padStart(3, "0"),
        codigoAuxiliar: "",
        cantidad: Number(d.cantidad || 1),
        descripcion: d.descripcion,
        detalleAdicional: "",
        precioUnitario: round2(d.precioUnitario),
        subsidio: 0,
        precioSinSubsidio: 0,
        descuento: round2(d.descuento || 0),
        precioTotal: round2(d.precioTotalSinImpuesto),
      })),
      subtotal0: totalIva === 0 ? subtotalSinImpuestos : 0,
      subtotalNoObjetoIva: 0,
      subtotalExentoIva: 0,
      subtotalSinImpuestos,
      totalDescuento,
      ice: 0,
      irbpnr: 0,
      propina: 0,
      total: importeTotal,
      valorTotalSinSubsidio: 0,
      ahorroPorSubsidio: 0,
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

    const esConsumidorFinal = comprador.tipo === "07";
    const emailDestino = String(comprador.email || "").trim();

    if (!esConsumidorFinal && emailDestino) {
      try {
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

        const rideArrayBuffer = rideBytes.buffer.slice(
          rideBytes.byteOffset,
          rideBytes.byteOffset + rideBytes.byteLength
        );
        const pdfBase64 = arrayBufferToBase64(rideArrayBuffer);

        const emailResp = await fetch(`${supabaseUrl}/functions/v1/send-document-email`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${serviceRoleKey}`,
          },
          body: JSON.stringify({
            to: emailDestino,
            documentType: "factura",
            orderCode: numeroFactura,
            patientName: comprador.razonSocial,
            pdfBase64,
            filename: `factura_${numeroFactura}.pdf`,
          }),
        });

        const emailData = await emailResp.json().catch(() => null);

        if (!emailResp.ok || !emailData?.ok) {
          console.error("No se pudo enviar la factura por correo:", emailData);
        }
      } catch (emailError) {
        console.error("Error enviando factura por correo:", emailError);
      }
    }

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
      email_enviado: !esConsumidorFinal && !!emailDestino,
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