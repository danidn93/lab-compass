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
  created_at?: string | null;
};

export type PdfResultType = "numeric" | "boolean" | "text";

export type PdfResultDetail = {
  id: string;
  parameterId?: string | null;
  parameterName?: string | null;
  value?: string | number | null;
  appliedRangeMin?: string | number | null;
  appliedRangeMax?: string | number | null;
  unit?: string | null;
  status?: "normal" | "high" | "low" | "positive" | "negative" | "text" | string | null;
  observation?: string | null;
  resultType?: PdfResultType;
};

export type PdfOrderResult = {
  id: string;
  testId: string;
  testName: string;
  notes?: string | null;
  details: PdfResultDetail[];
  date?: string | null;
};

const PAGE = {
  width: 210,
  height: 297,
  contentTop: 112,
  contentBottom: 236,
  dateY: 262,
  attentY: 242,
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
  h = 120,
  opacity = 0.08
) {
  const img = normalizeImageData(base64);
  const format = imageFormatFromBase64(img);
  if (!img || !format) return;

  try {
    doc.saveGraphicsState();
    (doc as any).setGState?.(new (doc as any).GState({ opacity }));
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

function addPageBackground(doc: jsPDF, config: PdfLabConfig) {
  const bg = normalizeImageData(config.logo) || normalizeImageData(config.sello);
  if (!bg) return;

  const format = imageFormatFromBase64(bg);
  if (!format) return;

  try {
    doc.saveGraphicsState();
    (doc as any).setGState?.(new (doc as any).GState({ opacity: 0.06 }));
    doc.addImage(bg, format, 35, 85, 140, 140);
    doc.restoreGraphicsState();
  } catch {
    try {
      doc.addImage(bg, format, 35, 85, 140, 140);
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
  doc.text(mainName.toUpperCase(), 105, 15, { align: "center" });

  doc.setFont("times", "bold");
  doc.setFontSize(26);
  doc.text(`"${commercialName.toUpperCase()}"`, 105, 24, { align: "center" });

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

function buildDetailValue(d: PdfResultDetail) {
  const resultType: PdfResultType = d.resultType || "numeric";
  const value = safeText(d.value);
  const unit = safeText(d.unit);

  if (resultType === "numeric") {
    return [value, unit].filter(Boolean).join(" ") || "—";
  }

  return value || "—";
}

function buildReferenceText(d: PdfResultDetail) {
  const resultType: PdfResultType = d.resultType || "numeric";
  if (resultType !== "numeric") return "";

  const min = safeText(d.appliedRangeMin);
  const max = safeText(d.appliedRangeMax);
  const unit = safeText(d.unit);

  if (!min && !max) return "";
  return `Rango ref.: ${min || "—"} - ${max || "—"}${unit ? ` ${unit}` : ""}`;
}

function estimateWrappedHeight(
  doc: jsPDF,
  text: string,
  width: number,
  lineHeight = 5,
  minHeight = 8
) {
  const wrapped = doc.splitTextToSize(text || "—", width);
  return {
    wrapped,
    height: Math.max(minHeight, wrapped.length * lineHeight),
  };
}

function estimateNoteLineHeight(doc: jsPDF, line: string) {
  const parsed = splitLabelValue(line);

  if (parsed) {
    const wrapped = doc.splitTextToSize(parsed.value || "—", 110);
    return {
      parsed,
      wrapped,
      height: Math.max(8, wrapped.length * 5),
    };
  }

  const wrapped = doc.splitTextToSize(line, 150);
  return {
    parsed: null,
    wrapped,
    height: wrapped.length * 5 + 2,
  };
}

function addResultsPageScaffold(
  doc: jsPDF,
  config: PdfLabConfig,
  patient: PdfPatient,
  testName: string
) {
  addHeader(doc, config);
  drawPatientLine(doc, patient);
  drawResultFrame(doc, 78, 270);
  addPageBackground(doc, config);

  doc.setTextColor(70, 70, 70);
  doc.setFont("times", "bold");
  doc.setFontSize(18);
  doc.text(buildPrintableExamTitle(testName), 105, 95, { align: "center" });
}

function ensureSpaceForNextBlock(
  doc: jsPDF,
  currentY: number,
  neededHeight: number,
  config: PdfLabConfig,
  patient: PdfPatient,
  testName: string
) {
  if (currentY + neededHeight <= PAGE.contentBottom) {
    return { y: currentY, pageBreak: false };
  }

  doc.addPage();
  addResultsPageScaffold(doc, config, patient, testName);
  return { y: PAGE.contentTop, pageBreak: true };
}

function drawNotesWithPagination(
  doc: jsPDF,
  notes: string,
  startY: number,
  config: PdfLabConfig,
  patient: PdfPatient,
  testName: string
) {
  const lines = safeText(notes)
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  let y = startY;

  doc.setTextColor(70, 70, 70);
  doc.setFont("times", "bold");
  doc.setFontSize(11);

  lines.forEach((line) => {
    const estimated = estimateNoteLineHeight(doc, line);
    const check = ensureSpaceForNextBlock(doc, y, estimated.height + 2, config, patient, testName);
    y = check.y;

    if (estimated.parsed) {
      doc.setFont("times", "bold");
      doc.setFontSize(11);
      doc.setTextColor(70, 70, 70);
      doc.text(estimated.parsed.label, 22, y);
      doc.text(":", 72, y);

      doc.setFont("times", "normal");
      doc.text(estimated.wrapped, 78, y);
      y += estimated.height;
    } else {
      doc.setFont("times", "normal");
      doc.setFontSize(11);
      doc.setTextColor(70, 70, 70);
      doc.text(estimated.wrapped, 22, y);
      y += estimated.height;
    }
  });

  return y;
}

function drawStructuredDetailsWithPagination(
  doc: jsPDF,
  details: PdfResultDetail[],
  startY: number,
  config: PdfLabConfig,
  patient: PdfPatient,
  testName: string
) {
  let y = startY;

  details.forEach((d) => {
    const label = safeText(d.parameterName || "Resultado");
    const finalValue = buildDetailValue(d);
    const referenceText = buildReferenceText(d);
    const observation = safeText(d.observation);
    const resultType: PdfResultType = d.resultType || "numeric";

    const valueMeasure = estimateWrappedHeight(doc, finalValue, 110, 5, 8);
    let blockHeight = valueMeasure.height + 2;

    let refMeasure:
      | { wrapped: string[]; height: number }
      | null = null;

    let obsMeasure:
      | { wrapped: string[]; height: number }
      | null = null;

    if (referenceText && resultType === "numeric") {
      refMeasure = estimateWrappedHeight(doc, referenceText, 110, 4, 4);
      blockHeight += refMeasure.height + 2;
    }

    if (observation) {
      obsMeasure = estimateWrappedHeight(doc, observation, 96, 4.5, 7);
      blockHeight += obsMeasure.height + 5;
    }

    const check = ensureSpaceForNextBlock(doc, y, blockHeight, config, patient, testName);
    y = check.y;

    doc.setTextColor(70, 70, 70);
    doc.setFont("times", "bold");
    doc.setFontSize(11);
    doc.text(label, 22, y);
    doc.text(":", 72, y);

    doc.setFont("times", "normal");
    doc.text(valueMeasure.wrapped, 78, y);
    y += valueMeasure.height;

    if (refMeasure && resultType === "numeric") {
      doc.setFont("times", "italic");
      doc.setFontSize(9);
      doc.setTextColor(110, 110, 110);
      doc.text(refMeasure.wrapped, 78, y - 1);
      y += refMeasure.height + 1;
    }

    if (obsMeasure && observation) {
      doc.setTextColor(70, 70, 70);
      doc.setFont("times", "bold");
      doc.setFontSize(10);
      doc.text("Observación:", 78, y);

      doc.setFont("times", "normal");
      doc.text(obsMeasure.wrapped, 104, y);
      y += obsMeasure.height + 2;
    }

    y += 2;
  });

  return y;
}

function drawSignatureBlock(doc: jsPDF, config: PdfLabConfig) {
  const firma = normalizeImageData(config.firma);
  const firmaFormat = imageFormatFromBase64(firma);
  const sello = normalizeImageData(config.sello);
  const selloFormat = imageFormatFromBase64(sello);

  const selloW = 29;
  const selloH = 29;
  const selloX = 145;
  const selloY = 232;

  const firmaW = 40;
  const firmaH = 14;
  const firmaX = 139;
  const firmaY = 232;

  if (sello && selloFormat) {
    try {
      doc.addImage(sello, selloFormat, selloX, selloY, selloW, selloH);
    } catch {
      // ignorar
    }
  }

  if (firma && firmaFormat) {
    try {
      doc.addImage(firma, firmaFormat, firmaX, firmaY, firmaW, firmaH);
    } catch {
      // ignorar
    }
  }
}

function buildPrintableExamTitle(testName: string) {
  const clean = safeText(testName).toUpperCase();
  if (clean.startsWith("EXAMEN ")) return clean;
  return `EXAMEN ${clean}`;
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function generateResultsPDF(
  order: PdfOrder,
  patient: PdfPatient,
  orderTests: Array<{ id: string; name: string }>,
  orderResults: PdfOrderResult[],
  config: PdfLabConfig,
  options?: { autoDownload?: boolean; fileName?: string }
): Blob {
  const doc = new jsPDF("p", "mm", "a4");
  let started = false;

  orderTests.forEach((test) => {
    const result = orderResults.find((r) => r.testId === test.id);
    if (!result) return;

    if (started) {
      doc.addPage();
    }
    started = true;

    addResultsPageScaffold(doc, config, patient, test.name);

    let y = PAGE.contentTop;
    const hasNotes = safeText(result.notes);
    const hasDetails = Array.isArray(result.details) && result.details.length > 0;

    if (hasNotes) {
      y = drawNotesWithPagination(doc, result.notes || "", y, config, patient, test.name);
    } else if (hasDetails) {
      y = drawStructuredDetailsWithPagination(
        doc,
        result.details,
        y,
        config,
        patient,
        test.name
      );
    } else {
      doc.setFont("times", "normal");
      doc.setFontSize(11);
      doc.setTextColor(70, 70, 70);
      doc.text("Sin resultados detallados.", 22, y);
      y += 8;
    }

    const totalPages = doc.getNumberOfPages();
    doc.setPage(totalPages);

    if (y < PAGE.attentY - 2) {
      doc.setFont("times", "bold");
      doc.setFontSize(11);
      doc.setTextColor(55, 55, 55);
      doc.text("Atentamente.", 105, PAGE.attentY, { align: "center" });
    }

    doc.setFont("courier", "bold");
    doc.setFontSize(14);
    doc.setTextColor(50, 50, 50);
    doc.text(
      formatDateSpanish(result.date || order.created_at || order.date),
      20,
      PAGE.dateY
    );

    drawSignatureBlock(doc, config);
  });

  const blob = doc.output("blob");

  if (options?.autoDownload) {
    downloadBlob(blob, options.fileName || `resultados_${order.code}.pdf`);
  }

  return blob;
}