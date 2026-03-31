import { createClient } from "npm:@supabase/supabase-js@2";
import { PDFDocument, StandardFonts, rgb } from "npm:pdf-lib@1.17.1";
import { XMLParser } from "npm:fast-xml-parser@4.5.0";
import bwipjs from "npm:bwip-js@4.5.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(body: any, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json; charset=utf-8",
    },
  });
}

function safeText(value: any, fallback = ""): string {
  if (value == null) return fallback;
  return String(value).trim();
}

function safeNumber(value: any, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function formatMoney(value: any): string {
  return safeNumber(value).toFixed(2);
}

function asArray<T>(value: T | T[] | null | undefined): T[] {
  if (value == null) return [];
  return Array.isArray(value) ? value : [value];
}

function parseXml(xmlText: string) {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "",
    trimValues: true,
    cdataPropName: "__cdata",
    parseTagValue: false,
  });
  return parser.parse(xmlText);
}

function extractAuthorizedInvoice(parsedXml: any) {
  if (parsedXml?.factura?.infoTributaria && parsedXml?.factura?.infoFactura) {
    return {
      numeroAutorizacion: "",
      fechaAutorizacion: "",
      factura: parsedXml.factura,
      esFacturaDirecta: true,
    };
  }

  if (parsedXml?.infoTributaria && parsedXml?.infoFactura) {
    return {
      numeroAutorizacion: "",
      fechaAutorizacion: "",
      factura: parsedXml,
      esFacturaDirecta: true,
    };
  }

  let autorizacion =
    parsedXml?.autorizacion ||
    parsedXml?.Autorizacion ||
    null;

  if (!autorizacion) {
    const authNode =
      parsedXml?.respuestaAutorizacionComprobante?.autorizaciones?.autorizacion ||
      parsedXml?.RespuestaAutorizacionComprobante?.autorizaciones?.autorizacion ||
      null;

    autorizacion = Array.isArray(authNode) ? authNode[0] : authNode;
  }

  if (!autorizacion) {
    throw new Error("No se encontró una factura válida ni una autorización del SRI en el XML");
  }

  const numeroAutorizacion = safeText(
    autorizacion?.numeroAutorizacion || autorizacion?.NumeroAutorizacion
  );

  const fechaAutorizacion = safeText(
    autorizacion?.fechaAutorizacion || autorizacion?.FechaAutorizacion
  );

  let comprobante =
    autorizacion?.comprobante ??
    autorizacion?.Comprobante ??
    "";

  if (typeof comprobante === "object" && comprobante?.__cdata) {
    comprobante = comprobante.__cdata;
  }

  comprobante = safeText(comprobante);

  if (!comprobante) {
    throw new Error("La autorización SRI no contiene el comprobante embebido");
  }

  const invoiceParsed = parseXml(comprobante);
  const factura = invoiceParsed?.factura || invoiceParsed;

  if (!factura?.infoTributaria || !factura?.infoFactura) {
    throw new Error("No se encontró una factura válida dentro del comprobante autorizado");
  }

  return {
    numeroAutorizacion,
    fechaAutorizacion,
    factura,
    esFacturaDirecta: false,
  };
}

function getCampoAdicional(campos: any[], nombre: string): string {
  const found = campos.find(
    (c: any) => safeText(c?.nombre || c?.["@_nombre"]).toLowerCase() === nombre.toLowerCase()
  );
  return safeText(found?.["#text"] || found?.valor || "");
}

function descripcionFormaPago(codigo: string): string {
  const mapa: Record<string, string> = {
    "01": "SIN UTILIZACION DEL SISTEMA FINANCIERO",
    "15": "COMPENSACIÓN DE DEUDAS",
    "16": "TARJETA DE DÉBITO",
    "17": "DINERO ELECTRÓNICO",
    "18": "TARJETA PREPAGO",
    "19": "TARJETA DE CRÉDITO",
    "20": "OTROS CON UTILIZACIÓN DEL SISTEMA FINANCIERO",
    "21": "ENDOSO DE TÍTULOS",
  };
  return mapa[codigo] || codigo || "OTRO";
}

function computeTaxBuckets(impuestos: any[]) {
  let base0 = 0;
  let base12 = 0;
  let base15 = 0;
  let base5 = 0;
  let baseNoObjeto = 0;
  let baseExento = 0;
  let iva = 0;

  for (const imp of impuestos) {
    const codigoPorcentaje = safeText(imp.codigoPorcentaje);
    const base = safeNumber(imp.baseImponible);
    const valor = safeNumber(imp.valor);

    if (codigoPorcentaje === "0") base0 += base;
    else if (codigoPorcentaje === "2") base12 += base;
    else if (codigoPorcentaje === "4") base15 += base;
    else if (codigoPorcentaje === "5") base5 += base;
    else if (codigoPorcentaje === "6") baseNoObjeto += base;
    else if (codigoPorcentaje === "7") baseExento += base;

    iva += valor;
  }

  return {
    base0,
    base12,
    base15,
    base5,
    baseNoObjeto,
    baseExento,
    iva,
  };
}

function splitTextByWidth(text: string, maxWidth: number, font: any, fontSize: number): string[] {
  const safe = safeText(text);
  if (!safe) return [""];

  const words = safe.split(/\s+/);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    const width = font.widthOfTextAtSize(next, fontSize);

    if (width <= maxWidth) {
      current = next;
    } else {
      if (current) lines.push(current);
      current = word;
    }
  }

  if (current) lines.push(current);
  return lines.length ? lines : [""];
}

function drawWrappedText(params: {
  page: any;
  text: string;
  x: number;
  y: number;
  maxWidth: number;
  lineHeight: number;
  font: any;
  fontSize: number;
  color?: any;
}) {
  const {
    page,
    text,
    x,
    y,
    maxWidth,
    lineHeight,
    font,
    fontSize,
    color = rgb(0, 0, 0),
  } = params;

  const lines = splitTextByWidth(text, maxWidth, font, fontSize);
  let cursorY = y;

  for (const line of lines) {
    page.drawText(line, {
      x,
      y: cursorY,
      size: fontSize,
      font,
      color,
    });
    cursorY -= lineHeight;
  }

  return cursorY;
}

function drawBox(page: any, x: number, y: number, width: number, height: number) {
  page.drawRectangle({
    x,
    y,
    width,
    height,
    borderWidth: 1,
    borderColor: rgb(0, 0, 0),
  });
}

function decodeBase64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function embedLogo(pdfDoc: PDFDocument, logoValue?: string | null) {
  if (!logoValue) return null;

  try {
    if (logoValue.startsWith("data:image/png;base64,")) {
      return await pdfDoc.embedPng(
        decodeBase64ToUint8Array(logoValue.replace("data:image/png;base64,", ""))
      );
    }

    if (
      logoValue.startsWith("data:image/jpeg;base64,") ||
      logoValue.startsWith("data:image/jpg;base64,")
    ) {
      return await pdfDoc.embedJpg(
        decodeBase64ToUint8Array(
          logoValue
            .replace("data:image/jpeg;base64,", "")
            .replace("data:image/jpg;base64,", "")
        )
      );
    }

    if (logoValue.startsWith("http://") || logoValue.startsWith("https://")) {
      const resp = await fetch(logoValue);
      if (!resp.ok) return null;

      const bytes = new Uint8Array(await resp.arrayBuffer());
      const contentType = resp.headers.get("content-type") || "";

      if (contentType.includes("png")) return await pdfDoc.embedPng(bytes);
      if (contentType.includes("jpeg") || contentType.includes("jpg")) {
        return await pdfDoc.embedJpg(bytes);
      }

      try {
        return await pdfDoc.embedPng(bytes);
      } catch {
        return await pdfDoc.embedJpg(bytes);
      }
    }

    return null;
  } catch {
    return null;
  }
}

async function generateBarcodePng(text: string): Promise<Uint8Array | null> {
  try {
    const png = await bwipjs.toBuffer({
      bcid: "code128",
      text,
      scale: 2,
      height: 10,
      includetext: false,
      paddingwidth: 0,
      paddingheight: 0,
      backgroundcolor: "FFFFFF",
    });
    return new Uint8Array(png);
  } catch {
    return null;
  }
}

function numeroATextoSimple(total: number): string {
  const entero = Math.floor(total);
  const decimales = Math.round((total - entero) * 100)
    .toString()
    .padStart(2, "0");

  return `${entero} ${decimales}/100 Dólares`;
}

async function generateRidePdf(params: {
  factura: any;
  numeroAutorizacion: string;
  fechaAutorizacion: string;
  order: any;
  labConfig: any;
}) {
  const { factura, numeroAutorizacion, fechaAutorizacion, order, labConfig } = params;

  const infoTrib = factura.infoTributaria || {};
  const infoFactura = factura.infoFactura || {};
  const detalles = asArray(factura.detalles?.detalle);
  const pagos = asArray(infoFactura.pagos?.pago);
  const camposAdicionales = asArray(factura.infoAdicional?.campoAdicional);
  const impuestosTotales = asArray(infoFactura.totalConImpuestos?.totalImpuesto);

  const tax = computeTaxBuckets(impuestosTotales);

  const subtotalSinImpuestos = safeNumber(infoFactura.totalSinImpuestos);
  const totalDescuento = safeNumber(infoFactura.totalDescuento);
  const propina = safeNumber(infoFactura.propina);
  const importeTotal = safeNumber(infoFactura.importeTotal);

  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595.28, 841.89]);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const logoImage = await embedLogo(pdfDoc, labConfig?.logo || null);

  const black = rgb(0, 0, 0);
  const pageWidth = page.getWidth();
  const margin = 28;

  // Encabezado
  let y = 805;

  if (logoImage) {
    const scaled = logoImage.scale(0.18);
    let drawW = scaled.width;
    let drawH = scaled.height;
    const maxW = 120;
    const maxH = 70;

    if (drawW > maxW) {
      const r = maxW / drawW;
      drawW *= r;
      drawH *= r;
    }
    if (drawH > maxH) {
      const r = maxH / drawH;
      drawW *= r;
      drawH *= r;
    }

    page.drawImage(logoImage, {
      x: margin,
      y: y - drawH + 5,
      width: drawW,
      height: drawH,
    });
  }

  const businessX = logoImage ? 160 : margin;
  const razonSocial = safeText(infoTrib.razonSocial || labConfig?.legal_name || labConfig?.name);
  const nombreComercial = safeText(infoTrib.nombreComercial || labConfig?.name);
  const ruc = safeText(infoTrib.ruc || labConfig?.ruc);
  const dirMatriz = safeText(infoTrib.dirMatriz || labConfig?.address);
  const telefono = safeText(labConfig?.phone);
  const contribuyenteEspecial = safeText((labConfig as any)?.contribuyente_especial || "");
  const obligadoContabilidad = safeText(infoFactura.obligadoContabilidad || "NO");

  page.drawText(razonSocial, {
    x: businessX,
    y: y,
    font: fontBold,
    size: 14,
    color: black,
  });

  if (nombreComercial && nombreComercial !== razonSocial) {
    page.drawText(nombreComercial, {
      x: businessX,
      y: y - 18,
      font,
      size: 10,
      color: black,
    });
  }

  drawWrappedText({
    page,
    text: `R.U.C. ${ruc}`,
    x: businessX,
    y: y - 36,
    maxWidth: 220,
    lineHeight: 11,
    font,
    fontSize: 10,
  });

  drawWrappedText({
    page,
    text: dirMatriz,
    x: businessX,
    y: y - 52,
    maxWidth: 240,
    lineHeight: 11,
    font,
    fontSize: 9,
  });

  if (telefono) {
    page.drawText(`Teléfono: ${telefono}`, {
      x: businessX,
      y: y - 78,
      font,
      size: 9,
      color: black,
    });
  }

  if (contribuyenteEspecial) {
    page.drawText(`CONTRIBUYENTE ESPECIAL No. ${contribuyenteEspecial}`, {
      x: businessX,
      y: y - 92,
      font,
      size: 9,
      color: black,
    });
  }

  page.drawText(`OBLIGADO A LLEVAR CONTABILIDAD: ${obligadoContabilidad}`, {
    x: businessX,
    y: y - 106,
    font,
    size: 9,
    color: black,
  });

  // Caja derecha factura
  const boxX = 375;
  const boxY = 700;
  const boxW = 190;
  const boxH = 120;
  drawBox(page, boxX, boxY, boxW, boxH);

  const numeroFactura = `${safeText(infoTrib.estab)}-${safeText(infoTrib.ptoEmi)}-${safeText(infoTrib.secuencial)}`;
  const claveAcceso = safeText(infoTrib.claveAcceso || order?.clave_acceso_sri);
  const numAut = safeText(numeroAutorizacion || order?.numero_autorizacion_sri || "AUTORIZACIÓN OFF-LINE");
  const fechaAut = safeText(fechaAutorizacion || order?.factura_fecha_autorizacion || infoFactura.fechaEmision);

  page.drawText("F A C T U R A", {
    x: boxX + 35,
    y: boxY + boxH - 22,
    font: fontBold,
    size: 16,
    color: black,
  });

  page.drawText(`No. ${numeroFactura}`, {
    x: boxX + 15,
    y: boxY + boxH - 42,
    font: fontBold,
    size: 10,
    color: black,
  });

  page.drawText("AUTORIZACIÓN OFF-LINE:", {
    x: boxX + 15,
    y: boxY + boxH - 60,
    font: fontBold,
    size: 8,
    color: black,
  });

  drawWrappedText({
    page,
    text: numAut,
    x: boxX + 15,
    y: boxY + boxH - 72,
    maxWidth: boxW - 30,
    lineHeight: 8,
    font,
    fontSize: 7.5,
  });

  page.drawText("CLAVE DE ACCESO:", {
    x: boxX + 15,
    y: boxY + boxH - 92,
    font: fontBold,
    size: 8,
    color: black,
  });

  drawWrappedText({
    page,
    text: claveAcceso,
    x: boxX + 15,
    y: boxY + boxH - 104,
    maxWidth: boxW - 30,
    lineHeight: 8,
    font,
    fontSize: 7.3,
  });

  // Barcode
  const barcodeBytes = await generateBarcodePng(claveAcceso);
  if (barcodeBytes) {
    try {
      const barcode = await pdfDoc.embedPng(barcodeBytes);
      page.drawImage(barcode, {
        x: margin,
        y: 655,
        width: pageWidth - margin * 2,
        height: 42,
      });
    } catch {
      // ignore
    }
  }

  page.drawText(claveAcceso, {
    x: 120,
    y: 646,
    font,
    size: 8.5,
    color: black,
  });

  // Bloque cliente
  const clienteY = 618;
  drawBox(page, margin, clienteY - 40, pageWidth - margin * 2, 52);

  const cliente = safeText(infoFactura.razonSocialComprador || order?.pacientes?.name);
  const identificacion = safeText(infoFactura.identificacionComprador || order?.pacientes?.cedula);
  const fechaEmision = safeText(infoFactura.fechaEmision);
  const direccionComprador =
    getCampoAdicional(camposAdicionales, "Direccion") ||
    safeText(order?.pacientes?.direccion || "");

  page.drawText("Razón social / Nombres y Apellidos", {
    x: margin + 8,
    y: clienteY,
    font: fontBold,
    size: 9,
    color: black,
  });
  page.drawText(`${cliente}  ${identificacion} RUC/CI:`, {
    x: 210,
    y: clienteY,
    font,
    size: 9,
    color: black,
  });

  page.drawText("Fecha de Emisión:", {
    x: margin + 8,
    y: clienteY - 16,
    font: fontBold,
    size: 9,
    color: black,
  });
  page.drawText(fechaEmision, {
    x: 120,
    y: clienteY - 16,
    font,
    size: 9,
    color: black,
  });

  page.drawText("Dirección:", {
    x: 250,
    y: clienteY - 16,
    font: fontBold,
    size: 9,
    color: black,
  });
  page.drawText(direccionComprador, {
    x: 305,
    y: clienteY - 16,
    font,
    size: 9,
    color: black,
  });

  // Tabla detalle
  const tableX = margin;
  let tableY = 545;
  const tableW = pageWidth - margin * 2;
  const headerH = 22;
  const rowH = 20;

  const cols = {
    cantidad: 50,
    descripcion: 330,
    precioUnit: 90,
    total: 85,
  };

  drawBox(page, tableX, tableY, tableW, headerH);
  page.drawText("Cantidad", {
    x: tableX + 10,
    y: tableY + 7,
    font: fontBold,
    size: 9,
    color: black,
  });
  page.drawText("Descripción", {
    x: tableX + cols.cantidad + 10,
    y: tableY + 7,
    font: fontBold,
    size: 9,
    color: black,
  });
  page.drawText("Precio Un.", {
    x: tableX + cols.cantidad + cols.descripcion + 10,
    y: tableY + 7,
    font: fontBold,
    size: 9,
    color: black,
  });
  page.drawText("Total", {
    x: tableX + cols.cantidad + cols.descripcion + cols.precioUnit + 15,
    y: tableY + 7,
    font: fontBold,
    size: 9,
    color: black,
  });

  // líneas verticales header
  page.drawLine({
    start: { x: tableX + cols.cantidad, y: tableY },
    end: { x: tableX + cols.cantidad, y: tableY + headerH },
    thickness: 1,
    color: black,
  });
  page.drawLine({
    start: { x: tableX + cols.cantidad + cols.descripcion, y: tableY },
    end: { x: tableX + cols.cantidad + cols.descripcion, y: tableY + headerH },
    thickness: 1,
    color: black,
  });
  page.drawLine({
    start: { x: tableX + cols.cantidad + cols.descripcion + cols.precioUnit, y: tableY },
    end: { x: tableX + cols.cantidad + cols.descripcion + cols.precioUnit, y: tableY + headerH },
    thickness: 1,
    color: black,
  });

  tableY -= rowH;

  for (const det of detalles.slice(0, 18)) {
    drawBox(page, tableX, tableY, tableW, rowH);

    page.drawLine({
      start: { x: tableX + cols.cantidad, y: tableY },
      end: { x: tableX + cols.cantidad, y: tableY + rowH },
      thickness: 1,
      color: black,
    });
    page.drawLine({
      start: { x: tableX + cols.cantidad + cols.descripcion, y: tableY },
      end: { x: tableX + cols.cantidad + cols.descripcion, y: tableY + rowH },
      thickness: 1,
      color: black,
    });
    page.drawLine({
      start: { x: tableX + cols.cantidad + cols.descripcion + cols.precioUnit, y: tableY },
      end: { x: tableX + cols.cantidad + cols.descripcion + cols.precioUnit, y: tableY + rowH },
      thickness: 1,
      color: black,
    });

    page.drawText(safeText(det.cantidad), {
      x: tableX + 10,
      y: tableY + 6,
      font,
      size: 9,
      color: black,
    });

    drawWrappedText({
      page,
      text: safeText(det.descripcion),
      x: tableX + cols.cantidad + 8,
      y: tableY + 12,
      maxWidth: cols.descripcion - 16,
      lineHeight: 8,
      font,
      fontSize: 8.3,
    });

    page.drawText(formatMoney(det.precioUnitario), {
      x: tableX + cols.cantidad + cols.descripcion + 10,
      y: tableY + 6,
      font,
      size: 9,
      color: black,
    });

    page.drawText(formatMoney(det.precioTotalSinImpuesto), {
      x: tableX + cols.cantidad + cols.descripcion + cols.precioUnit + 15,
      y: tableY + 6,
      font,
      size: 9,
      color: black,
    });

    tableY -= rowH;
  }

  // Bloques inferiores
  const lowerTop = 165;

  // Información adicional
  drawBox(page, margin, lowerTop, 280, 110);
  page.drawText("Información adicional", {
    x: margin + 8,
    y: lowerTop + 92,
    font: fontBold,
    size: 10,
    color: black,
  });

  const pacienteAd = getCampoAdicional(camposAdicionales, "Paciente") || cliente;
  const emailAd = getCampoAdicional(camposAdicionales, "Email") || safeText(order?.pacientes?.email);
  const direccionAd = getCampoAdicional(camposAdicionales, "Direccion") || direccionComprador;
  const ordenAd = getCampoAdicional(camposAdicionales, "Orden") || safeText(order?.code);

  let addY = lowerTop + 74;
  for (const row of [
    `Paciente: ${pacienteAd}`,
    `Email: ${emailAd}`,
    `Dirección: ${direccionAd}`,
    `Orden: ${ordenAd}`,
  ]) {
    drawWrappedText({
      page,
      text: row,
      x: margin + 8,
      y: addY,
      maxWidth: 262,
      lineHeight: 10,
      font,
      fontSize: 8.5,
    });
    addY -= 18;
  }

  // Forma de pago
  drawBox(page, margin, 110, 280, 48);
  page.drawText("Días", {
    x: margin + 8,
    y: 144,
    font: fontBold,
    size: 9,
    color: black,
  });
  page.drawText("Monto $", {
    x: margin + 55,
    y: 144,
    font: fontBold,
    size: 9,
    color: black,
  });
  page.drawText("Forma de pago", {
    x: margin + 120,
    y: 144,
    font: fontBold,
    size: 9,
    color: black,
  });

  if (pagos.length > 0) {
    const pago = pagos[0];
    page.drawText(safeText(pago.plazo || "0"), {
      x: margin + 8,
      y: 126,
      font,
      size: 9,
      color: black,
    });
    page.drawText(formatMoney(pago.total || importeTotal), {
      x: margin + 55,
      y: 126,
      font,
      size: 9,
      color: black,
    });
    page.drawText(descripcionFormaPago(safeText(pago.formaPago)), {
      x: margin + 120,
      y: 126,
      font,
      size: 8.5,
      color: black,
    });
  }

  // Totales
  drawBox(page, 330, 110, 237, 165);

  const totalRows = [
    ["SUBTOTAL ->", formatMoney(subtotalSinImpuestos)],
    [
      "Base IVA",
      formatMoney(tax.base12 + tax.base15 + tax.base5),
    ],
    ["Base IVA 0%", formatMoney(tax.base0)],
    ["Base No Objeto", formatMoney(tax.baseNoObjeto)],
    ["Base Exento", formatMoney(tax.baseExento)],
    ["IVA", formatMoney(tax.iva)],
    ["TOTAL ->", formatMoney(importeTotal)],
  ];

  let totalY = 250;
  for (const [label, value] of totalRows) {
    page.drawText(label, {
      x: 340,
      y: totalY,
      font: label.includes("TOTAL") ? fontBold : font,
      size: 10,
      color: black,
    });
    page.drawText(value, {
      x: 500,
      y: totalY,
      font: label.includes("TOTAL") ? fontBold : font,
      size: 10,
      color: black,
    });
    totalY -= 18;
  }

  page.drawText(`Son : ${numeroATextoSimple(importeTotal)}.`, {
    x: 340,
    y: 122,
    font,
    size: 8.5,
    color: black,
  });

  page.drawText("Observación :", {
    x: 340,
    y: 108,
    font,
    size: 8.5,
    color: black,
  });

  return await pdfDoc.save();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const body = await req.json().catch(() => ({}));
    const orderId = safeText(body?.order_id);

    if (!orderId) {
      return jsonResponse({ ok: false, message: "order_id es obligatorio" }, 400);
    }

    const { data: order, error: orderError } = await supabase
      .from("ordenes")
      .select(`
        *,
        pacientes(*)
      `)
      .eq("id", orderId)
      .single();

    if (orderError || !order) {
      return jsonResponse(
        { ok: false, message: "No se encontró la orden", detail: orderError?.message },
        404
      );
    }

    const xmlPath = safeText(
      order.factura_xml_autorizado_path ||
      order.factura_xml_firmado_path ||
      order.factura_xml_path
    );

    if (!xmlPath) {
      return jsonResponse(
        { ok: false, message: "La orden no tiene XML disponible para generar el RIDE" },
        400
      );
    }

    const { data: xmlFile, error: xmlDownloadError } = await supabase.storage
      .from("facturas-xml")
      .download(xmlPath.replace(/^\/+/, ""));

    if (xmlDownloadError || !xmlFile) {
      return jsonResponse(
        {
          ok: false,
          message: "No se pudo descargar el XML desde Storage",
          detail: xmlDownloadError?.message,
        },
        500
      );
    }

    const xmlText = await xmlFile.text();
    const parsed = parseXml(xmlText);

    const {
      numeroAutorizacion,
      fechaAutorizacion,
      factura,
      esFacturaDirecta,
    } = extractAuthorizedInvoice(parsed);

    const { data: labConfig } = await supabase
      .from("configuracion_laboratorio")
      .select("id, logo, name, owner, address, ruc, health_registry, phone, schedule, legal_name, email")
      .maybeSingle();

    const pdfBytes = await generateRidePdf({
      factura,
      numeroAutorizacion,
      fechaAutorizacion,
      order,
      labConfig,
    });

    const baseName =
      safeText(order.clave_acceso_sri) ||
      safeText(factura?.infoTributaria?.claveAcceso) ||
      safeText(numeroAutorizacion) ||
      safeText(order.code) ||
      crypto.randomUUID();

    const pdfPath = `${order.id}/${baseName}_ride.pdf`;

    const { error: uploadError } = await supabase.storage
      .from("facturas-pdf")
      .upload(pdfPath, pdfBytes, {
        upsert: true,
        contentType: "application/pdf",
      });

    if (uploadError) {
      return jsonResponse(
        {
          ok: false,
          message: "No se pudo guardar el PDF en Storage",
          detail: uploadError.message,
        },
        500
      );
    }

    const updatePayload: any = {
      factura_ride_pdf_path: pdfPath,
    };

    if (!esFacturaDirecta) {
      if (!order.numero_autorizacion_sri && numeroAutorizacion) {
        updatePayload.numero_autorizacion_sri = numeroAutorizacion;
      }
      if (!order.factura_fecha_autorizacion && fechaAutorizacion) {
        updatePayload.factura_fecha_autorizacion = fechaAutorizacion;
      }
    }

    const { error: updateError } = await supabase
      .from("ordenes")
      .update(updatePayload)
      .eq("id", orderId);

    if (updateError) {
      return jsonResponse(
        {
          ok: false,
          message: "Se generó el PDF, pero no se pudo actualizar la orden",
          detail: updateError.message,
          pdf_path: pdfPath,
        },
        500
      );
    }

    return jsonResponse({
      ok: true,
      message: "PDF RIDE generado correctamente",
      pdf_path: pdfPath,
      numero_autorizacion: numeroAutorizacion,
      fecha_autorizacion: fechaAutorizacion,
      xml_tipo: esFacturaDirecta ? "factura_directa" : "autorizacion_sri",
    });
  } catch (error: any) {
    return jsonResponse(
      {
        ok: false,
        message: "Error al generar el PDF RIDE",
        detail: error?.message || String(error),
      },
      500
    );
  }
});