import jsPDF from "jspdf";

export type PdfLabConfig = {
  name: string;
  owner: string;
  address: string;
  ruc: string;
  healthRegistry: string;
  phone: string;
  schedule: string;
  logo?: string | null;
  firma?: string | null;
  sello?: string | null;
};

export type PdfPatient = {
  name: string;
  cedula: string;
  phone?: string | null;
  sex: "M" | "F";
  birth_date?: string | null;
};

export type PdfOrder = {
  code: string;
  accessKey?: string;
  date: string;
  created_at?: string;
};

export type PdfResultDetail = {
  id: string;
  parameterId?: string | null;
  parameterName?: string | null;
  value?: string | number | null;
  appliedRangeMin?: string | number | null;
  appliedRangeMax?: string | number | null;
  unit?: string | null;
  status?: "normal" | "high" | "low" | string | null;
};

export type PdfOrderResult = {
  id: string;
  testId: string;
  testName: string;
  notes?: string | null;
  details: PdfResultDetail[];
};

function safeText(value: any): string {
  return String(value ?? "").trim();
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
  x = 15,
  y = 10,
  w = 24,
  h = 24
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

function addTransparentWatermark(
  doc: jsPDF,
  base64?: string | null,
  x = 48,
  y = 110,
  w = 120,
  h = 120
) {
  const img = normalizeImageData(base64);
  const format = imageFormatFromBase64(img);
  if (!img || !format) return;

  try {
    doc.saveGraphicsState();
    (doc as any).setGState?.(new (doc as any).GState({ opacity: 0.08 }));
    doc.addImage(img, format, x, y, w, h);
    doc.restoreGraphicsState();
  } catch {
    try {
      doc.addImage(img, format, x, y, w, h);
    } catch {
      // ignorar
    }
  }
}

function splitLabName(fullName: string) {
  const clean = safeText(fullName);

  const match = clean.match(/^(.*?)\s*"(.*?)"\s*$/);

  if (match) {
    return {
      mainName: safeText(match[1]),
      commercialName: safeText(match[2]),
    };
  }

  const normalized = clean.replace(/^LABORATORIO DE ANÁLISIS CLÍNICO\s*/i, "").trim();

  return {
    mainName: "LABORATORIO DE ANÁLISIS CLÍNICO",
    commercialName: normalized.replace(/^"+|"+$/g, "") || "CENTRAL",
  };
}

function addHeader(doc: jsPDF, config: PdfLabConfig) {
  addImageIfExists(doc, config.logo, 12, 8, 28, 28);

  const { mainName, commercialName } = splitLabName(config.name || "");

  doc.setTextColor(150, 36, 74);
  doc.setFont("times", "bold");
  doc.setFontSize(16);
  doc.text(mainName.toUpperCase(), 105, 15, {
    align: "center",
  });

  doc.setFont("times", "bold");
  doc.setFontSize(26);
  doc.text(`"${commercialName.toUpperCase()}"`, 105, 24, {
    align: "center",
  });

  doc.setTextColor(36, 94, 168);
  doc.setFont("times", "italic");
  doc.setFontSize(13);
  doc.text(safeText(config.owner), 105, 32, { align: "center" });

  doc.setFont("times", "bold");
  doc.setFontSize(11);
  doc.text("LABORATORISTA CLÍNICO", 105, 39, { align: "center" });

  doc.setTextColor(144, 53, 73);
  doc.setFont("times", "bold");
  doc.setFontSize(10);
  doc.text(`Horario de Atención: ${safeText(config.schedule)}`, 105, 46, {
    align: "center",
  });

  doc.setTextColor(36, 94, 168);
  doc.setFont("times", "normal");
  doc.setFontSize(9);
  doc.text(safeText(config.address), 105, 53, { align: "center" });

  doc.setFont("times", "bold");
  doc.text(
    `R.U.C. ${safeText(config.ruc)}  -  Reg. ${safeText(config.healthRegistry)}  -  Fono: ${safeText(config.phone)}`,
    105,
    59,
    { align: "center" }
  );

  doc.setDrawColor(43, 118, 197);
  doc.setLineWidth(0.5);
  doc.line(12, 63, 198, 63);
}

function drawPatientLine(doc: jsPDF, patient: PdfPatient) {
  doc.setTextColor(70, 70, 70);
  doc.setFont("times", "normal");
  doc.setFontSize(11);
  doc.text("Paciente:", 14, 71);

  doc.setFont("times", "bold");
  doc.setFontSize(14);
  doc.text(safeText(patient.name), 52, 71);

  doc.setDrawColor(120, 120, 120);
  doc.setLineWidth(0.2);
  doc.line(34, 72, 190, 72);
}

function drawResultFrame(doc: jsPDF, yTop = 78, yBottom = 270) {
  doc.setDrawColor(27, 119, 200);
  doc.setLineWidth(1.2);
  doc.rect(12, yTop, 186, yBottom - yTop);

  doc.setLineWidth(0.35);
  doc.rect(14, yTop + 2, 182, yBottom - yTop - 4);
}

function formatDateSpanish(dateStr?: string | null) {
  const date = dateStr ? new Date(dateStr) : new Date();
  const day = String(date.getDate()).padStart(2, "0");
  const months = ["ENE", "FEB", "MAR", "ABR", "MAY", "JUN", "JUL", "AGO", "SEP", "OCT", "NOV", "DIC"];
  const month = months[date.getMonth()] || "";
  const year = date.getFullYear();
  return `${day} ${month} ${year}`;
}

function splitLabelValue(line: string): { label: string; value: string } | null {
  const raw = safeText(line);
  if (!raw) return null;

  const colonIndex = raw.indexOf(":");
  if (colonIndex === -1) return null;

  const label = raw.slice(0, colonIndex).trim();
  const value = raw.slice(colonIndex + 1).trim();

  if (!label) return null;
  return { label, value };
}

function drawNotesAsClassicReport(doc: jsPDF, notes?: string | null, startY = 108) {
  const text = safeText(notes);
  if (!text) return startY;

  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  let y = startY;

  doc.setTextColor(70, 70, 70);
  doc.setFont("times", "bold");
  doc.setFontSize(11);

  lines.forEach((line) => {
    const parsed = splitLabelValue(line);

    if (parsed) {
      doc.text(parsed.label, 22, y);
      doc.text(":", 72, y);

      doc.setFont("times", "normal");
      const wrapped = doc.splitTextToSize(parsed.value || "—", 110);
      doc.text(wrapped, 78, y);

      y += Math.max(8, wrapped.length * 5);
      doc.setFont("times", "bold");
    } else {
      doc.setFont("times", "normal");
      const wrapped = doc.splitTextToSize(line, 150);
      doc.text(wrapped, 22, y);
      y += wrapped.length * 5 + 2;
      doc.setFont("times", "bold");
    }
  });

  return y;
}

function drawStructuredDetailsClassic(doc: jsPDF, details: PdfResultDetail[], startY = 108) {
  let y = startY;

  doc.setTextColor(70, 70, 70);
  doc.setFont("times", "bold");
  doc.setFontSize(11);

  details.forEach((d) => {
    const label = safeText(d.parameterName || "Resultado");
    const unit = safeText(d.unit);
    const value = safeText(d.value);
    const finalValue = [value, unit].filter(Boolean).join(" ");

    doc.text(label, 22, y);
    doc.text(":", 72, y);

    doc.setFont("times", "normal");
    const wrapped = doc.splitTextToSize(finalValue || "—", 110);
    doc.text(wrapped, 78, y);
    y += Math.max(8, wrapped.length * 5);

    doc.setFont("times", "bold");
  });

  return y;
}

function drawSignatureBlock(doc: jsPDF, config: PdfLabConfig) {
  const firma = normalizeImageData(config.firma);
  const firmaFormat = imageFormatFromBase64(firma);
  const sello = normalizeImageData(config.sello);
  const selloFormat = imageFormatFromBase64(sello);

  if (sello && selloFormat) {
    try {
      doc.saveGraphicsState();
      (doc as any).setGState?.(new (doc as any).GState({ opacity: 0.22 }));
      doc.addImage(sello, selloFormat, 140, 233, 28, 28);
      doc.restoreGraphicsState();
    } catch {
      try {
        doc.addImage(sello, selloFormat, 140, 233, 28, 28);
      } catch {
        // ignorar
      }
    }
  }

  if (firma && firmaFormat) {
    try {
      doc.addImage(firma, firmaFormat, 145, 230, 35, 15);
    } catch {
      // ignorar
    }
  }

  doc.setTextColor(55, 55, 55);
  doc.setFont("times", "bold");
  doc.setFontSize(10);
  doc.text(safeText(config.owner), 159, 253, { align: "center" });

  doc.setFont("times", "normal");
  doc.text("Laboratorista Clínico", 159, 259, { align: "center" });
}

function buildPrintableExamTitle(testName: string) {
  const clean = safeText(testName).toUpperCase();
  if (clean.startsWith("EXAMEN ")) return clean;
  return `EXAMEN ${clean}`;
}

export function generateOrderPDF(
  order: PdfOrder,
  patient: PdfPatient,
  orderTests: Array<{ name: string; price: number }>,
  config: PdfLabConfig
) {
  const doc = new jsPDF("p", "mm", "a4");

  addHeader(doc, config);
  drawPatientLine(doc, patient);

  doc.setFont("times", "bold");
  doc.setFontSize(15);
  doc.setTextColor(65, 65, 65);
  doc.text("ORDEN DE EXÁMENES", 105, 88, { align: "center" });

  drawResultFrame(doc, 94, 270);

  let y = 108;

  doc.setFont("times", "bold");
  doc.setFontSize(11);
  doc.setTextColor(70, 70, 70);

  orderTests.forEach((test) => {
    doc.text(safeText(test.name), 22, y);
    doc.text(":", 115, y);

    doc.setFont("times", "normal");
    doc.text(`$${Number(test.price || 0).toFixed(2)}`, 125, y);

    y += 8;
    doc.setFont("times", "bold");
  });

  const total = orderTests.reduce((acc, t) => acc + Number(t.price || 0), 0);

  y += 4;
  doc.setDrawColor(180, 180, 180);
  doc.line(120, y, 180, y);
  y += 7;

  doc.setFont("times", "bold");
  doc.text("TOTAL", 125, y);
  doc.text(`$${total.toFixed(2)}`, 180, y, { align: "right" });

  doc.setFont("courier", "bold");
  doc.setFontSize(14);
  doc.setTextColor(50, 50, 50);
  doc.text(formatDateSpanish(order.created_at || order.date), 20, 262);

  drawSignatureBlock(doc, config);

  doc.save(`orden_${order.code}.pdf`);
}

export function generateResultsPDF(
  order: PdfOrder,
  patient: PdfPatient,
  orderTests: Array<{ id: string; name: string }>,
  orderResults: PdfOrderResult[],
  config: PdfLabConfig
) {
  const doc = new jsPDF("p", "mm", "a4");

  orderTests.forEach((test, index) => {
    const result = orderResults.find((r) => r.testId === test.id);
    if (!result) return;

    if (index > 0) doc.addPage();

    addHeader(doc, config);
    drawPatientLine(doc, patient);
    drawResultFrame(doc, 78, 270);
    addTransparentWatermark(doc, config.sello, 50, 120, 110, 110);

    doc.setTextColor(70, 70, 70);
    doc.setFont("times", "bold");
    doc.setFontSize(18);
    doc.text(buildPrintableExamTitle(test.name), 105, 95, { align: "center" });

    let y = 112;

    const hasNotes = safeText(result.notes);
    const hasDetails = Array.isArray(result.details) && result.details.length > 0;

    if (hasNotes) {
      y = drawNotesAsClassicReport(doc, result.notes, y);
    } else if (hasDetails) {
      y = drawStructuredDetailsClassic(doc, result.details, y);
    } else {
      doc.setFont("times", "normal");
      doc.setFontSize(11);
      doc.text("Sin resultados detallados.", 22, y);
      y += 8;
    }

    if (y < 236) {
      doc.setFont("times", "bold");
      doc.setFontSize(11);
      doc.setTextColor(55, 55, 55);
      doc.text("Atentamente.", 105, 242, { align: "center" });
    }

    doc.setFont("courier", "bold");
    doc.setFontSize(14);
    doc.setTextColor(50, 50, 50);
    doc.text(formatDateSpanish(order.created_at || order.date), 20, 262);

    drawSignatureBlock(doc, config);
  });

  doc.save(`resultados_${order.code}.pdf`);
}