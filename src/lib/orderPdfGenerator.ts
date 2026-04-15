import jsPDF from "jspdf";
import JsBarcode from "jsbarcode";

export type InvoicePdfLabConfig = {
  logo?: string | null;
  razonSocial?: string | null;
  nombreComercial?: string | null;
  ruc?: string | null;
  direccionMatriz?: string | null;
  direccionSucursal?: string | null;
  obligadoContabilidad?: string | null; // "SI" | "NO"
};

export type InvoicePdfCustomer = {
  nombres: string;
  identificacion: string;
  fechaEmision?: string | null;
  direccion?: string | null;
  paciente?: string | null;
  email?: string | null;
  orden?: string | null;
};

export type InvoicePdfInfo = {
  estab?: string | null;          // 001
  ptoEmi?: string | null;         // 001
  secuencial?: string | null;     // 000000010
  numeroAutorizacion: string;
  fechaAutorizacion?: string | null;
  ambiente?: string | null;       // PRUEBAS
  emision?: string | null;        // NORMAL
  claveAcceso: string;
};

export type InvoicePdfItem = {
  codigoPrincipal?: string | null;
  codigoAuxiliar?: string | null;
  cantidad: number;
  descripcion: string;
  detalleAdicional?: string | null;
  precioUnitario: number;
  subsidio?: number;
  precioSinSubsidio?: number;
  descuento?: number;
  precioTotal: number;
};

export type InvoicePdfPayment = {
  formaPago: string;
  valor: number;
};

export type InvoicePdfTotals = {
  subtotal0?: number;
  subtotalNoObjetoIva?: number;
  subtotalExentoIva?: number;
  subtotalSinImpuestos?: number;
  totalDescuento?: number;
  ice?: number;
  irbpnr?: number;
  propina?: number;
  valorTotal: number;
  valorTotalSinSubsidio?: number;
  ahorroPorSubsidio?: number;
};

function safeText(value: any): string {
  return String(value ?? "").trim();
}

function money(value?: number | null): string {
  return Number(value || 0).toFixed(2);
}

function normalizeImageData(data?: string | null) {
  if (!data) return null;
  const trimmed = data.trim();
  if (!trimmed.startsWith("data:image/")) return null;
  return trimmed;
}

function imageFormatFromBase64(data?: string | null): "PNG" | "JPEG" | null {
  if (!data) return null;
  if (data.startsWith("data:image/png")) return "PNG";
  if (data.startsWith("data:image/jpeg") || data.startsWith("data:image/jpg")) return "JPEG";
  return null;
}

function addImageIfExists(
  doc: jsPDF,
  base64?: string | null,
  x = 10,
  y = 10,
  w = 60,
  h = 28
) {
  const img = normalizeImageData(base64);
  const format = imageFormatFromBase64(img);
  if (!img || !format) return;

  try {
    doc.addImage(img, format, x, y, w, h);
  } catch {
    // ignorar
  }
}

function drawBox(doc: jsPDF, x: number, y: number, w: number, h: number, r = 1.5) {
  doc.roundedRect(x, y, w, h, r, r);
}

function drawText(
  doc: jsPDF,
  text: string,
  x: number,
  y: number,
  opts?: {
    size?: number;
    style?: "normal" | "bold";
    align?: "left" | "center" | "right";
    maxWidth?: number;
  }
) {
  doc.setFont("helvetica", opts?.style || "normal");
  doc.setFontSize(opts?.size || 8);
  doc.text(text, x, y, {
    align: opts?.align || "left",
    maxWidth: opts?.maxWidth,
  });
}

function toInvoiceNumber(estab?: string | null, ptoEmi?: string | null, sec?: string | null) {
  const a = safeText(estab || "001").padStart(3, "0");
  const b = safeText(ptoEmi || "001").padStart(3, "0");
  const c = safeText(sec || "1").padStart(9, "0");
  return `${a}-${b}-${c}`;
}

function buildBarcodeDataUrl(text: string): string | null {
  try {
    const canvas = document.createElement("canvas");
    JsBarcode(canvas, text, {
      format: "CODE128",
      displayValue: true,
      fontSize: 7,
      margin: 0,
      height: 20,
      width: 1.05,
    });
    return canvas.toDataURL("image/png");
  } catch {
    return null;
  }
}

export function generateInvoicePDFBlob(params: {
  labConfig: InvoicePdfLabConfig;
  customer: InvoicePdfCustomer;
  invoice: InvoicePdfInfo;
  items: InvoicePdfItem[];
  payment: InvoicePdfPayment;
  totals: InvoicePdfTotals;
}) {
  const { labConfig, customer, invoice, items, payment, totals } = params;

  const doc = new jsPDF({
    orientation: "p",
    unit: "mm",
    format: "a4",
    compress: true,
  });

  const pageW = 210;

  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.25);
  doc.setTextColor(0, 0, 0);

  // =========================
  // BLOQUE SUPERIOR IZQUIERDO - LOGO
  // =========================
  addImageIfExists(doc, labConfig.logo, 18, 10, 48, 22);

  // Si no hay logo, deja texto parecido al ejemplo
  if (!labConfig.logo) {
    drawText(doc, "NO TIENE LOGO", 43, 22, {
      size: 16,
      style: "bold",
      align: "center",
    });
  }

  // =========================
  // BLOQUE IZQUIERDO EMISOR
  // =========================
  drawBox(doc, 7, 45, 90, 68);

  drawText(doc, safeText(labConfig.razonSocial), 10, 50, { size: 7, style: "bold" });
  drawText(doc, safeText(labConfig.nombreComercial || labConfig.razonSocial), 10, 61, { size: 7 });

  drawText(doc, "Dirección", 10, 77, { size: 7 });
  drawText(doc, "Matriz:", 10, 81, { size: 7 });
  drawText(doc, safeText(labConfig.direccionMatriz), 28, 79, { size: 6.5, maxWidth: 60 });

  drawText(doc, "Dirección", 10, 92, { size: 7 });
  drawText(doc, "Sucursal:", 10, 96, { size: 7 });
  drawText(doc, safeText(labConfig.direccionSucursal), 28, 94, { size: 6.5, maxWidth: 60 });

  drawText(doc, "OBLIGADO A LLEVAR CONTABILIDAD", 10, 108, { size: 7 });
  drawText(doc, safeText(labConfig.obligadoContabilidad || "NO"), 86, 108, {
    size: 7,
    align: "right",
  });

  // =========================
  // BLOQUE DERECHO TRIBUTARIO
  // =========================
  drawBox(doc, 101, 5, 103, 108);

  drawText(doc, "R.U.C.:", 105, 13, { size: 8.5 });
  drawText(doc, safeText(labConfig.ruc), 138, 13, { size: 8.5 });

  drawText(doc, "FACTURA", 105, 22, { size: 10, style: "bold" });

  drawText(doc, "No.", 105, 31, { size: 7 });
  drawText(doc, toInvoiceNumber(invoice.estab, invoice.ptoEmi, invoice.secuencial), 118, 31, {
    size: 7,
  });

  drawText(doc, "NÚMERO DE AUTORIZACIÓN", 105, 41, { size: 7, style: "bold" });
  drawText(doc, safeText(invoice.numeroAutorizacion), 105, 50, {
    size: 6.8,
    maxWidth: 95,
  });

  drawText(doc, "FECHA Y HORA DE", 105, 62, { size: 7, style: "bold" });
  drawText(doc, "AUTORIZACIÓN:", 105, 67, { size: 7, style: "bold" });
  drawText(doc, safeText(invoice.fechaAutorizacion), 145, 64.5, { size: 7 });

  drawText(doc, "AMBIENTE:", 105, 77, { size: 7, style: "bold" });
  drawText(doc, safeText(invoice.ambiente), 150, 77, { size: 7, style: "bold" });

  drawText(doc, "EMISIÓN:", 105, 89, { size: 7, style: "bold" });
  drawText(doc, safeText(invoice.emision), 150, 89, { size: 7, style: "bold" });

  drawText(doc, "CLAVE DE ACCESO", 105, 105, { size: 7, style: "bold" });

  const barcode = buildBarcodeDataUrl(safeText(invoice.claveAcceso));
  if (barcode) {
    doc.addImage(barcode, "PNG", 106, 107, 92, 17);
  } else {
    drawText(doc, safeText(invoice.claveAcceso), 152, 116, {
      size: 6,
      align: "center",
      maxWidth: 88,
    });
  }

  // =========================
  // BLOQUE CLIENTE
  // =========================
  drawBox(doc, 7, 123, 197, 26);

  drawText(doc, "Razón Social / Nombres y Apellidos:", 8, 129, { size: 7 });
  drawText(doc, safeText(customer.nombres), 79, 129, { size: 7 });

  drawText(doc, "Identificación", 8, 136, { size: 7 });
  drawText(doc, safeText(customer.identificacion), 33, 136, { size: 7 });

  drawText(doc, "Fecha", 8, 143, { size: 7 });
  drawText(doc, safeText(customer.fechaEmision), 33, 143, { size: 7 });

  drawText(doc, "Placa / Matrícula:", 64, 143, { size: 7 });
  drawText(doc, "Guía", 136, 143, { size: 7 });

  drawText(doc, "Direccion:", 8, 150, { size: 7 });
  drawText(doc, safeText(customer.direccion), 33, 150, { size: 7, maxWidth: 160 });

  // =========================
  // TABLA DE ITEMS
  // =========================
  const tableX = 7;
  const tableY = 152;
  const colW = [15, 15, 14, 41, 27, 20, 17, 18, 18, 18]; // total 203? adjust
  // Ajustadas para ancho útil 197
  const widths = [15, 15, 14, 41, 27, 20, 16, 18, 15, 16]; // total 197

  const headers = [
    "Cod.\nPrincipal",
    "Cod.\nAuxiliar",
    "Cantidad",
    "Descripción",
    "Detalle Adicional",
    "Precio Unitario",
    "Subsidio",
    "Precio sin\nSubsidio",
    "Descuento",
    "Precio Total",
  ];

  let x = tableX;
  const headH = 16;

  for (let i = 0; i < widths.length; i++) {
    doc.rect(x, tableY, widths[i], headH);
    const cx = x + widths[i] / 2;
    const lines = headers[i].split("\n");
    if (lines.length === 1) {
      drawText(doc, lines[0], cx, tableY + 9, { size: 6, align: "center" });
    } else {
      drawText(doc, lines[0], cx, tableY + 6.5, { size: 6, align: "center" });
      drawText(doc, lines[1], cx, tableY + 11.3, { size: 6, align: "center" });
    }
    x += widths[i];
  }

  let y = tableY + headH;

  for (const item of items) {
    const rowH = 10;
    x = tableX;

    for (const w of widths) {
      doc.rect(x, y, w, rowH);
      x += w;
    }

    const values = [
      safeText(item.codigoPrincipal),
      safeText(item.codigoAuxiliar),
      Number(item.cantidad).toFixed(2),
      safeText(item.descripcion),
      safeText(item.detalleAdicional),
      money(item.precioUnitario),
      money(item.subsidio),
      money(item.precioSinSubsidio),
      money(item.descuento),
      money(item.precioTotal),
    ];

    x = tableX;
    for (let i = 0; i < widths.length; i++) {
      const w = widths[i];
      const isNumeric = i >= 2 && i !== 3 && i !== 4;
      drawText(doc, values[i], isNumeric ? x + w - 1.2 : x + 1.2, y + 6.4, {
        size: 6.5,
        align: isNumeric ? "right" : "left",
        maxWidth: w - 2.5,
      });
      x += w;
    }

    y += rowH;
  }

  // =========================
  // CAJA IZQUIERDA INFERIOR - INFORMACIÓN ADICIONAL
  // =========================
  const leftBoxX = 7;
  const leftBoxY = y + 1;
  const leftBoxW = 124;
  const infoTitleH = 6;
  const infoBodyH = 21;

  doc.rect(leftBoxX, leftBoxY, leftBoxW, infoTitleH);
  drawText(doc, "Información Adicional", leftBoxX + leftBoxW / 2, leftBoxY + 4.2, {
    size: 6.5,
    align: "center",
  });

  doc.rect(leftBoxX, leftBoxY + infoTitleH, leftBoxW, infoBodyH);

  drawText(doc, "Paciente:", 9, leftBoxY + 11, { size: 6.2 });
  drawText(doc, safeText(customer.paciente), 35, leftBoxY + 11, { size: 6.2 });

  drawText(doc, "Email:", 9, leftBoxY + 18, { size: 6.2 });
  drawText(doc, safeText(customer.email), 35, leftBoxY + 18, { size: 6.2 });

  drawText(doc, "Direccion:", 9, leftBoxY + 25, { size: 6.2 });
  drawText(doc, safeText(customer.direccion), 35, leftBoxY + 25, {
    size: 6.2,
    maxWidth: 88,
  });

  drawText(doc, "Orden:", 9, leftBoxY + 32, { size: 6.2 });
  drawText(doc, safeText(customer.orden), 35, leftBoxY + 32, { size: 6.2 });

  // =========================
  // FORMA DE PAGO
  // =========================
  const payX = 7;
  const payY = leftBoxY + infoTitleH + infoBodyH + 1;
  const payW1 = 58;
  const payW2 = 37;
  const payHHead = 6;
  const payHRow = 8;

  doc.rect(payX, payY, payW1, payHHead);
  doc.rect(payX + payW1, payY, payW2, payHHead);
  drawText(doc, "Forma de pago", payX + payW1 / 2, payY + 4.1, {
    size: 6.5,
    align: "center",
  });
  drawText(doc, "Valor", payX + payW1 + payW2 / 2, payY + 4.1, {
    size: 6.5,
    align: "center",
  });

  doc.rect(payX, payY + payHHead, payW1, payHRow);
  doc.rect(payX + payW1, payY + payHHead, payW2, payHRow);

  drawText(doc, safeText(payment.formaPago), payX + 1.2, payY + payHHead + 5.2, {
    size: 5.7,
    maxWidth: payW1 - 2,
  });
  drawText(doc, money(payment.valor), payX + payW1 + payW2 - 1.5, payY + payHHead + 5.2, {
    size: 6.2,
    align: "right",
  });

  // =========================
  // CAJA DERECHA TOTALES
  // =========================
  const sumX = 136;
  const sumY = y + 1;
  const sumW1 = 55;
  const sumW2 = 13;
  const sumRowH = 6.5;

  const totalRows = [
    ["SUBTOTAL 0%", money(totals.subtotal0)],
    ["SUBTOTAL NO OBJETO DE IVA", money(totals.subtotalNoObjetoIva)],
    ["SUBTOTAL EXENTO DE IVA", money(totals.subtotalExentoIva)],
    ["SUBTOTAL SIN IMPUESTOS", money(totals.subtotalSinImpuestos)],
    ["TOTAL DESCUENTO", money(totals.totalDescuento)],
    ["ICE", money(totals.ice)],
    ["IRBPNR", money(totals.irbpnr)],
    ["PROPINA", money(totals.propina)],
    ["VALOR TOTAL", money(totals.valorTotal)],
    ["VALOR TOTAL SIN SUBSIDIO", money(totals.valorTotalSinSubsidio)],
  ];

  let sy = sumY;
  for (const [label, value] of totalRows) {
    doc.rect(sumX, sy, sumW1, sumRowH);
    doc.rect(sumX + sumW1, sy, sumW2, sumRowH);
    drawText(doc, label, sumX + 1.2, sy + 4.4, { size: 6.5 });
    drawText(doc, value, sumX + sumW1 + sumW2 - 1.2, sy + 4.4, {
      size: 6.5,
      align: "right",
    });
    sy += sumRowH;
  }

  const subsidyH = 14;
  doc.rect(sumX, sy, sumW1 + sumW2, subsidyH);
  drawText(doc, "AHORRO POR SUBSIDIO:", sumX + 1.2, sy + 4.2, { size: 6.2 });
  drawText(doc, "(Incluye IVA cuando corresponda)", sumX + 1.2, sy + 8.8, { size: 5.8 });
  drawText(doc, money(totals.ahorroPorSubsidio), sumX + sumW1 + sumW2 - 1.2, sy + 8.2, {
    size: 6.2,
    align: "right",
  });

  // Nunca agregar página extra aquí.
  return doc.output("blob");
}