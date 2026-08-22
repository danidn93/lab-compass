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
  status?:
    | "normal"
    | "high"
    | "low"
    | "positive"
    | "negative"
    | "text"
    | string
    | null;
  observation?: string | null;
  resultType?: PdfResultType;
  sort_order?: number | null;
};

export type PdfDividerDetail = {
  id: string;
  item_type: "divider";
  texto: string;
  sort_order?: number | null;
};

export type PdfResultRenderItem =
  | PdfDividerDetail
  | (PdfResultDetail & {
      item_type?: "parameter";
      sort_order?: number | null;
    });

export interface PdfOrderResult {
  id: string;
  testId: string;
  testName: string;
  testDescription?: string;
  visible_description?: boolean | null;
  notes?: string;
  date?: string | null;
  details: PdfResultRenderItem[];

  /**
   * IMPORTANTE:
   * Estos dos campos permiten relacionar exactamente el resultado
   * con la prueba que fue ordenada en ResultsPage.
   */
  layoutKey?: string | null;
  pageGroup?: string | null;
}

export type PdfOrderTest = {
  id: string;
  name: string;
  description?: string | null;
  visible_description?: boolean | null;

  /**
   * IMPORTANTE:
   * ResultsPage debe enviar estos campos.
   */
  layoutKey?: string | null;
  pageGroup?: string | null;
};

const PAGE = {
  width: 210,
  height: 297,

  frameTop: 78,
  frameBottom: 270,
  frameLeft: 12,
  frameRight: 198,

  innerPaddingTop: 10,
  innerPaddingBottom: 10,

  titleContentGap: 8,

  dateY: 262,
  attentY: 242,

  /**
   * Para páginas que contienen VARIOS exámenes dejamos libre
   * el área inferior para fecha, firma y sello.
   */
  groupedContentBottom: 228,
};

type PreparedTest = PdfOrderTest & {
  _groupKey: string;
  _layoutKey: string;
  _result: PdfOrderResult;
};

type PageBlock =
  | {
      kind: "single";
      tests: PreparedTest[];
    }
  | {
      kind: "group";
      pageGroup: string;
      tests: PreparedTest[];
    };

function safeText(value: any): string {
  return String(value ?? "").trim();
}

function normalizeExamName(value: any) {
  return String(value || "").trim().toLowerCase();
}

function normalizeExamDescription(
  value: any,
  visibleDescription: boolean | null | undefined = true
) {
  if (visibleDescription === false) return "";
  return String(value || "").trim().toLowerCase();
}

function buildGroupedTestKey(
  name: any,
  description: any,
  visibleDescription: boolean | null | undefined = true
) {
  return `${normalizeExamName(name)}|||${normalizeExamDescription(
    description,
    visibleDescription
  )}`;
}

function normalizeImageData(data?: string | null) {
  if (!data) return null;
  const trimmed = data.trim();
  if (!trimmed.startsWith("data:image/")) return null;
  return trimmed;
}

function imageFormatFromBase64(
  data?: string | null
): "PNG" | "JPEG" | null {
  if (!data) return null;
  if (data.startsWith("data:image/png")) return "PNG";
  if (
    data.startsWith("data:image/jpeg") ||
    data.startsWith("data:image/jpg")
  ) {
    return "JPEG";
  }
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

function addPageBackground(doc: jsPDF, config: PdfLabConfig) {
  const bg =
    normalizeImageData(config.logo) ||
    normalizeImageData(config.sello);

  if (!bg) return;

  const format = imageFormatFromBase64(bg);
  if (!format) return;

  try {
    doc.saveGraphicsState();
    (doc as any).setGState?.(
      new (doc as any).GState({ opacity: 0.06 })
    );
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

  const normalized = clean
    .replace(/^LABORATORIO DE ANÁLISIS CLÍNICO\s*/i, "")
    .trim();

  return {
    mainName: "LABORATORIO DE ANÁLISIS CLÍNICO",
    commercialName:
      normalized.replace(/^"+|"+$/g, "") || "CENTRAL",
  };
}

function addHeader(doc: jsPDF, config: PdfLabConfig) {
  addImageIfExists(doc, config.logo, 12, 8, 28, 28);

  const { mainName, commercialName } = splitLabName(
    config.name || ""
  );

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
  doc.text(safeText(config.owner), 105, 32, {
    align: "center",
  });

  doc.setFont("times", "bold");
  doc.setFontSize(11);
  doc.text("LABORATORISTA CLÍNICO", 105, 39, {
    align: "center",
  });

  doc.setTextColor(144, 53, 73);
  doc.setFont("times", "bold");
  doc.setFontSize(10);
  doc.text(
    `Horario de Atención: ${safeText(config.schedule)}`,
    105,
    46,
    { align: "center" }
  );

  doc.setTextColor(36, 94, 168);
  doc.setFont("times", "normal");
  doc.setFontSize(9);
  doc.text(safeText(config.address), 105, 53, {
    align: "center",
  });

  doc.setFont("times", "bold");
  doc.text(
    `R.U.C. ${safeText(config.ruc)}  -  Reg. ${safeText(
      config.healthRegistry
    )}  -  Fono: ${safeText(config.phone)}`,
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

function drawResultFrame(
  doc: jsPDF,
  yTop = 78,
  yBottom = 270
) {
  doc.setDrawColor(27, 119, 200);
  doc.setLineWidth(1.2);
  doc.rect(12, yTop, 186, yBottom - yTop);

  doc.setLineWidth(0.35);
  doc.rect(14, yTop + 2, 182, yBottom - yTop - 4);
}

function formatDateSpanish(dateStr?: string | null) {
  const date = dateStr ? new Date(dateStr) : new Date();
  const day = String(date.getDate()).padStart(2, "0");

  const months = [
    "ENE",
    "FEB",
    "MAR",
    "ABR",
    "MAY",
    "JUN",
    "JUL",
    "AGO",
    "SEP",
    "OCT",
    "NOV",
    "DIC",
  ];

  const month = months[date.getMonth()] || "";
  const year = date.getFullYear();

  return `${day} ${month} ${year}`;
}

function splitLabelValue(
  line: string
): { label: string; value: string } | null {
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
  const resultType: PdfResultType =
    d.resultType || "numeric";

  const value = safeText(d.value);
  const unit = safeText(d.unit);

  if (resultType === "numeric") {
    return [value, unit].filter(Boolean).join(" ") || "—";
  }

  return value || "—";
}

function buildReferenceText(d: PdfResultDetail) {
  const resultType: PdfResultType =
    d.resultType || "numeric";

  if (resultType !== "numeric") return "";

  const min = safeText(d.appliedRangeMin);
  const max = safeText(d.appliedRangeMax);
  const unit = safeText(d.unit);

  if (!min && !max) return "";

  return `Rango ref.: ${min || "—"} - ${
    max || "—"
  }${unit ? ` ${unit}` : ""}`;
}

function isDividerDetail(
  item: any
): item is PdfDividerDetail {
  return item?.item_type === "divider";
}

/**
 * MUY IMPORTANTE:
 *
 * NO VOLVEMOS A ORDENAR POR sort_order.
 *
 * ResultsPage ya entrega details exactamente en el orden
 * que el usuario definió con drag & drop.
 *
 * El generador debe respetar ese orden y no reinterpretarlo.
 */
function preserveDetailsOrder(
  details: PdfResultRenderItem[] = []
) {
  const cleaned: PdfResultRenderItem[] = [];
  let pendingDividers: PdfDividerDetail[] = [];

  details.forEach((item) => {
    if (isDividerDetail(item)) {
      pendingDividers.push(item);
      return;
    }

    cleaned.push(...pendingDividers, item);
    pendingDividers = [];
  });

  // No agregamos divisores sueltos al final.
  return cleaned;
}

function buildResultMaps(
  orderResults: PdfOrderResult[] = []
) {
  const byLayoutKey = new Map<string, PdfOrderResult>();
  const byGroupedKey = new Map<string, PdfOrderResult>();

  orderResults.forEach((result) => {
    const normalizedResult: PdfOrderResult = {
      ...result,
      details: preserveDetailsOrder(result.details || []),
    };

    const layoutKey = safeText(result.layoutKey);

    if (layoutKey && !byLayoutKey.has(layoutKey)) {
      byLayoutKey.set(layoutKey, normalizedResult);
    }

    const groupedKey = buildGroupedTestKey(
      result.testName,
      result.testDescription,
      result.visible_description ?? true
    );

    if (!byGroupedKey.has(groupedKey)) {
      byGroupedKey.set(groupedKey, normalizedResult);
    }
  });

  return {
    byLayoutKey,
    byGroupedKey,
  };
}

function estimateWrappedHeight(
  doc: jsPDF,
  text: string,
  width: number,
  lineHeight = 5,
  minHeight = 8
) {
  const wrapped = doc.splitTextToSize(
    text || "—",
    width
  );

  return {
    wrapped,
    height: Math.max(
      minHeight,
      wrapped.length * lineHeight
    ),
  };
}

function estimateNoteLineHeight(
  doc: jsPDF,
  line: string,
  valueWidth = 110,
  plainWidth = 150,
  lineHeight = 5
) {
  const parsed = splitLabelValue(line);

  if (parsed) {
    const wrapped = doc.splitTextToSize(
      parsed.value || "—",
      valueWidth
    );

    return {
      parsed,
      wrapped,
      height: Math.max(
        7,
        wrapped.length * lineHeight
      ),
    };
  }

  const wrapped = doc.splitTextToSize(
    line,
    plainWidth
  );

  return {
    parsed: null,
    wrapped,
    height:
      Math.max(1, wrapped.length) * lineHeight + 1,
  };
}

function estimateNotesTotalHeight(
  doc: jsPDF,
  notes: string,
  valueWidth = 110,
  plainWidth = 150,
  lineHeight = 5
) {
  const lines = safeText(notes)
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  if (!lines.length) return 8;

  return lines.reduce((acc, line) => {
    const estimated = estimateNoteLineHeight(
      doc,
      line,
      valueWidth,
      plainWidth,
      lineHeight
    );

    return acc + estimated.height + 2;
  }, 0);
}

function getDividerBlockMetrics(
  doc: jsPDF,
  dividerText: string,
  width = 150,
  lineHeight = 7
) {
  const lines = doc.splitTextToSize(
    (
      safeText(dividerText) || "DIVISOR"
    ).toUpperCase(),
    width
  );

  const textHeight =
    Math.max(1, lines.length) * lineHeight;

  return {
    lines,
    height: textHeight + 4,
  };
}

function estimateStructuredDetailsTotalHeight(
  doc: jsPDF,
  details: PdfResultRenderItem[],
  options?: {
    labelWidth?: number;
    valueWidth?: number;
    referenceWidth?: number;
    observationWidth?: number;
    lineHeight?: number;
    compact?: boolean;
  }
) {
  if (!Array.isArray(details) || details.length === 0) {
    return 8;
  }

  const valueWidth = options?.valueWidth ?? 110;
  const referenceWidth =
    options?.referenceWidth ?? valueWidth;
  const observationWidth =
    options?.observationWidth ?? 96;
  const lineHeight = options?.lineHeight ?? 5;
  const compact = options?.compact ?? false;

  return details.reduce((acc, item) => {
    if (isDividerDetail(item)) {
      const dividerMetrics = getDividerBlockMetrics(
        doc,
        item.texto || "DIVISOR",
        compact ? 72 : 150,
        compact ? 5 : 7
      );

      return (
        acc +
        dividerMetrics.height +
        (compact ? 2 : 4)
      );
    }

    const d = item as PdfResultDetail;
    const finalValue = buildDetailValue(d);
    const referenceText = buildReferenceText(d);
    const observation = safeText(d.observation);

    const resultType: PdfResultType =
      d.resultType || "numeric";

    const valueMeasure = estimateWrappedHeight(
      doc,
      finalValue,
      valueWidth,
      lineHeight,
      compact ? 5 : 8
    );

    let blockHeight =
      valueMeasure.height + (compact ? 1 : 2);

    if (
      referenceText &&
      resultType === "numeric"
    ) {
      const refMeasure = estimateWrappedHeight(
        doc,
        referenceText,
        referenceWidth,
        compact ? 3.4 : 4,
        compact ? 3.4 : 4
      );

      blockHeight +=
        refMeasure.height + (compact ? 1 : 2);
    }

    if (observation) {
      const obsMeasure = estimateWrappedHeight(
        doc,
        observation,
        observationWidth,
        compact ? 3.8 : 4.5,
        compact ? 5 : 7
      );

      blockHeight +=
        obsMeasure.height + (compact ? 2 : 5);
    }

    blockHeight += compact ? 1 : 2;

    return acc + blockHeight;
  }, 0);
}

function getTestTitleBlockMetrics(
  doc: jsPDF,
  testName: string,
  testDescription?: string | null,
  visibleDescription?: boolean | null,
  options?: {
    width?: number;
    nameLineHeight?: number;
    descriptionLineHeight?: number;
    compact?: boolean;
  }
) {
  const width = options?.width ?? 150;
  const compact = options?.compact ?? false;
  const nameLineHeight =
    options?.nameLineHeight ?? (compact ? 5.2 : 7);

  const descriptionLineHeight =
    options?.descriptionLineHeight ??
    (compact ? 4.4 : 7);

  const nameLines = doc.splitTextToSize(
    safeText(testName) || "PRUEBA",
    width
  );

  const descriptionText = visibleDescription
    ? safeText(testDescription)
    : "";

  const descriptionLines = descriptionText
    ? doc.splitTextToSize(descriptionText, width)
    : [];

  const nameHeight =
    Math.max(1, nameLines.length) * nameLineHeight;

  const descriptionHeight =
    descriptionLines.length > 0
      ? Math.max(1, descriptionLines.length) *
          descriptionLineHeight +
        (compact ? 0.5 : 1)
      : 0;

  return {
    nameLines,
    descriptionLines,
    nameHeight,
    descriptionHeight,
    height:
      nameHeight +
      descriptionHeight +
      (compact ? 2 : 4),
  };
}

function getContentHeight(
  doc: jsPDF,
  notes: string,
  details: PdfResultRenderItem[]
) {
  const hasNotes = !!safeText(notes);
  const hasDetails =
    Array.isArray(details) && details.length > 0;

  if (hasNotes) {
    return estimateNotesTotalHeight(doc, notes);
  }

  if (hasDetails) {
    return estimateStructuredDetailsTotalHeight(
      doc,
      details
    );
  }

  return 8;
}

function getFrameUsableBounds() {
  return {
    top:
      PAGE.frameTop + PAGE.innerPaddingTop,
    bottom:
      PAGE.frameBottom - PAGE.innerPaddingBottom,
  };
}

function getCenteredBlockLayout(
  doc: jsPDF,
  testName: string,
  testDescription: string | null | undefined,
  visibleDescription:
    | boolean
    | null
    | undefined,
  notes: string,
  details: PdfResultRenderItem[]
) {
  const titleMetrics = getTestTitleBlockMetrics(
    doc,
    testName,
    testDescription || "",
    visibleDescription
  );

  const contentHeight = getContentHeight(
    doc,
    notes,
    details
  );

  const totalBlockHeight =
    titleMetrics.height +
    PAGE.titleContentGap +
    contentHeight;

  const bounds = getFrameUsableBounds();
  const availableHeight =
    bounds.bottom - bounds.top;

  let blockTop = bounds.top;

  if (availableHeight > totalBlockHeight) {
    blockTop =
      bounds.top +
      (availableHeight - totalBlockHeight) / 2;
  }

  return {
    bounds,
    titleMetrics,
    totalBlockHeight,
    blockTop,
    titleTop: blockTop,
    contentTop:
      blockTop +
      titleMetrics.height +
      PAGE.titleContentGap,
    blockBottom:
      blockTop + totalBlockHeight,
  };
}

function addResultsPageScaffold(
  doc: jsPDF,
  config: PdfLabConfig,
  patient: PdfPatient
) {
  addHeader(doc, config);
  drawPatientLine(doc, patient);
  drawResultFrame(
    doc,
    PAGE.frameTop,
    PAGE.frameBottom
  );
  addPageBackground(doc, config);
}

function drawTitleBlockAt(
  doc: jsPDF,
  testName: string,
  testDescription: string | null | undefined,
  yTop: number,
  visibleDescription?: boolean | null
) {
  const titleMetrics = getTestTitleBlockMetrics(
    doc,
    testName,
    testDescription || "",
    visibleDescription
  );

  const nameBaselineY = yTop + 7;

  doc.setTextColor(70, 70, 70);
  doc.setFont("times", "bold");
  doc.setFontSize(18);
  doc.text(
    titleMetrics.nameLines,
    105,
    nameBaselineY,
    { align: "center" }
  );

  if (
    titleMetrics.descriptionLines.length > 0
  ) {
    const descriptionBaselineY =
      nameBaselineY + titleMetrics.nameHeight;

    doc.setFont("times", "normal");
    doc.setFontSize(18);
    doc.setTextColor(95, 95, 95);

    doc.text(
      titleMetrics.descriptionLines,
      105,
      descriptionBaselineY,
      { align: "center" }
    );
  }
}

function drawDividerTitleAt(
  doc: jsPDF,
  dividerText: string,
  yTop: number
) {
  const text = (
    safeText(dividerText || "DIVISOR")
  ).toUpperCase();

  doc.setTextColor(70, 70, 70);
  doc.setFont("times", "bold");
  doc.setFontSize(16);

  doc.text(text, 105, yTop + 6, {
    align: "center",
  });
}

function getContinuationPageContentStart(
  doc: jsPDF,
  testName: string,
  testDescription?: string | null,
  visibleDescription?: boolean | null
) {
  const bounds = getFrameUsableBounds();

  const titleMetrics = getTestTitleBlockMetrics(
    doc,
    testName,
    testDescription || "",
    visibleDescription
  );

  const titleTop = bounds.top;

  drawTitleBlockAt(
    doc,
    testName,
    testDescription || "",
    titleTop,
    visibleDescription
  );

  return (
    titleTop +
    titleMetrics.height +
    PAGE.titleContentGap
  );
}

function ensureSpaceForNextBlock(
  doc: jsPDF,
  currentY: number,
  neededHeight: number,
  config: PdfLabConfig,
  patient: PdfPatient,
  testName: string,
  testDescription?: string | null,
  visibleDescription?: boolean | null
) {
  const bounds = getFrameUsableBounds();

  if (
    currentY + neededHeight <=
    bounds.bottom
  ) {
    return {
      y: currentY,
      pageBreak: false,
    };
  }

  doc.addPage();
  addResultsPageScaffold(
    doc,
    config,
    patient
  );

  return {
    y: getContinuationPageContentStart(
      doc,
      testName,
      testDescription,
      visibleDescription
    ),
    pageBreak: true,
  };
}

function drawNotesWithPagination(
  doc: jsPDF,
  notes: string,
  startY: number,
  config: PdfLabConfig,
  patient: PdfPatient,
  testName: string,
  testDescription?: string | null,
  visibleDescription?: boolean | null
) {
  const lines = safeText(notes)
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  let y = startY;

  lines.forEach((line) => {
    const estimated =
      estimateNoteLineHeight(doc, line);

    const check = ensureSpaceForNextBlock(
      doc,
      y,
      estimated.height + 2,
      config,
      patient,
      testName,
      testDescription,
      visibleDescription
    );

    y = check.y;

    if (estimated.parsed) {
      doc.setFont("times", "bold");
      doc.setFontSize(11);
      doc.setTextColor(70, 70, 70);
      doc.text(
        estimated.parsed.label,
        22,
        y
      );
      doc.text(":", 72, y);

      doc.setFont("times", "normal");
      doc.setTextColor(70, 70, 70);
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
  details: PdfResultRenderItem[],
  startY: number,
  config: PdfLabConfig,
  patient: PdfPatient,
  testName: string,
  testDescription?: string | null,
  visibleDescription?: boolean | null
) {
  let y = startY;

  const orderedDetails = preserveDetailsOrder(details);

  for (const item of orderedDetails) {
    if (isDividerDetail(item)) {
      const dividerText = safeText(item.texto || "DIVISOR");
      const dividerMetrics = getDividerBlockMetrics(
        doc,
        dividerText
      );

      const check = ensureSpaceForNextBlock(
        doc,
        y,
        dividerMetrics.height + 4,
        config,
        patient,
        testName,
        testDescription,
        visibleDescription
      );

      y = check.y;

      drawDividerTitleAt(
        doc,
        dividerText,
        y
      );

      y += dividerMetrics.height + 6;
      continue;
    }

    const d = item as PdfResultDetail;

    const rowHeight = getParameterRowHeight(
      safeText(d.observation),
      166,
      false,
      doc
    );

    const check = ensureSpaceForNextBlock(
      doc,
      y,
      rowHeight + 1.5,
      config,
      patient,
      testName,
      testDescription,
      visibleDescription
    );

    y = check.y;

    y = drawParameterSingleLine(
      doc,
      d,
      22,
      y,
      166,
      false
    );

    y += 1.5;
  }

  return y;
}

function drawSignatureBlock(
  doc: jsPDF,
  config: PdfLabConfig
) {
  const firma = normalizeImageData(
    config.firma
  );

  const firmaFormat =
    imageFormatFromBase64(firma);

  const sello = normalizeImageData(
    config.sello
  );

  const selloFormat =
    imageFormatFromBase64(sello);

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
      doc.addImage(
        sello,
        selloFormat,
        selloX,
        selloY,
        selloW,
        selloH
      );
    } catch {
      // ignorar
    }
  }

  if (firma && firmaFormat) {
    try {
      doc.addImage(
        firma,
        firmaFormat,
        firmaX,
        firmaY,
        firmaW,
        firmaH
      );
    } catch {
      // ignorar
    }
  }
}

function drawFooter(
  doc: jsPDF,
  order: PdfOrder,
  config: PdfLabConfig,
  resultDate?: string | null
) {
  doc.setFont("times", "bold");
  doc.setFontSize(11);
  doc.setTextColor(55, 55, 55);

  doc.text(
    "Atentamente.",
    105,
    PAGE.attentY,
    { align: "center" }
  );

  doc.setFont("courier", "bold");
  doc.setFontSize(14);
  doc.setTextColor(50, 50, 50);

  doc.text(
    formatDateSpanish(
      resultDate ||
        order.created_at ||
        order.date
    ),
    20,
    PAGE.dateY
  );

  drawSignatureBlock(doc, config);
}

/* =========================================================
   MAQUETACIÓN DE GRUPOS DE HOJA
   ========================================================= */

function measureGroupedNotesHeight(
  doc: jsPDF,
  notes: string,
  width: number,
  compact: boolean
) {
  const lines = safeText(notes)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (!lines.length) return compact ? 5 : 7;

  const labelWidth =
    compact
      ? Math.min(30, width * 0.4)
      : Math.min(48, width * 0.36);

  const valueWidth = Math.max(18, width - labelWidth - 1);
  let height = 0;

  for (const line of lines) {
    const parsed = splitLabelValue(line);

    doc.setFont("times", "normal");
    doc.setFontSize(compact ? 8.5 : 10);

    if (parsed) {
      const wrapped = doc.splitTextToSize(parsed.value || "—", valueWidth);
      height +=
        Math.max(
          compact ? 4 : 5,
          Math.max(1, wrapped.length) * (compact ? 4 : 5)
        ) + 1;
    } else {
      const wrapped = doc.splitTextToSize(line, width - 2);
      height +=
        Math.max(1, wrapped.length) * (compact ? 4 : 5) + 1;
    }
  }

  return height;
}


function fitFontSizeToWidth(
  doc: jsPDF,
  text: string,
  maxWidth: number,
  preferredSize: number,
  minSize: number,
  fontName: string = "times",
  fontStyle: string = "normal"
) {
  const clean = safeText(text);
  if (!clean) return preferredSize;

  doc.setFont(fontName, fontStyle);
  doc.setFontSize(preferredSize);

  const width = doc.getTextWidth(clean);
  if (width <= maxWidth) return preferredSize;

  const scaled = preferredSize * (maxWidth / Math.max(width, 0.01));
  return Math.max(minSize, Math.min(preferredSize, scaled));
}

function countParameterRows(details: PdfResultRenderItem[] = []) {
  return preserveDetailsOrder(details).filter(
    (item) => !isDividerDetail(item)
  ).length;
}

function calculateExtraRowGap(
  availableHeight: number,
  naturalHeight: number,
  rowCount: number,
  maxExtraGap: number
) {
  if (rowCount <= 1) return 0;

  const free = availableHeight - naturalHeight;
  if (free <= 0) return 0;

  return Math.max(
    0,
    Math.min(maxExtraGap, free / Math.max(1, rowCount - 1))
  );
}

function getParameterRowHeight(
  observation: string,
  width: number,
  compact: boolean,
  doc: jsPDF
) {
  const baseHeight = compact ? 4.2 : 5.2;

  if (!safeText(observation)) {
    return baseHeight;
  }

  doc.setFont("times", "normal");
  doc.setFontSize(compact ? 7.2 : 8.5);

  const observationLines = doc.splitTextToSize(
    safeText(observation),
    Math.max(20, width - (compact ? 16 : 24))
  );

  return (
    baseHeight +
    Math.max(1, observationLines.length) * (compact ? 3.3 : 3.8) +
    1
  );
}

function drawParameterSingleLine(
  doc: jsPDF,
  d: PdfResultDetail,
  x: number,
  y: number,
  width: number,
  compact: boolean
) {
  const label = safeText(d.parameterName || "Resultado");
  const value = buildDetailValue(d);
  const reference = buildReferenceText(d);
  const observation = safeText(d.observation);

  /*
   * Una sola línea:
   *
   * PARÁMETRO : VALOR                  Rango ref.: X - Y unidad
   *
   * En columnas angostas reducimos únicamente el tamaño de fuente
   * necesario para conservar toda la fila en una sola línea.
   */
  const labelRatio = compact ? 0.39 : 0.35;
  const valueRatio = compact ? 0.25 : 0.27;

  const labelWidth = width * labelRatio;
  const valueWidth = width * valueRatio;
  const referenceWidth = Math.max(
    12,
    width - labelWidth - valueWidth - 3
  );

  const labelX = x;
  const valueX = x + labelWidth;
  const referenceX = valueX + valueWidth;

  const preferred = compact ? 8.2 : 10;
  const minimum = compact ? 5.8 : 7.1;

  const labelSize = fitFontSizeToWidth(
    doc,
    `${label}:`,
    Math.max(10, labelWidth - 2),
    preferred,
    minimum,
    "times",
    "bold"
  );

  const valueSize = fitFontSizeToWidth(
    doc,
    value || "—",
    Math.max(9, valueWidth - 2),
    preferred,
    minimum,
    "times",
    "normal"
  );

  const referenceSize = reference
    ? fitFontSizeToWidth(
        doc,
        reference,
        Math.max(10, referenceWidth),
        compact ? 7.4 : 8.5,
        compact ? 5.4 : 6.3,
        "times",
        "italic"
      )
    : compact
    ? 7.4
    : 8.5;

  doc.setTextColor(70, 70, 70);
  doc.setFont("times", "bold");
  doc.setFontSize(labelSize);
  doc.text(`${label}:`, labelX, y);

  doc.setFont("times", "normal");
  doc.setFontSize(valueSize);
  doc.text(value || "—", valueX, y);

  if (reference) {
    doc.setTextColor(105, 105, 105);
    doc.setFont("times", "italic");
    doc.setFontSize(referenceSize);
    doc.text(reference, referenceX, y);
  }

  let nextY = y + (compact ? 4.2 : 5.2);

  if (observation) {
    const obsLabel = compact ? "Obs.:" : "Observación:";
    const obsLabelWidth = compact ? 11 : 23;

    doc.setTextColor(75, 75, 75);
    doc.setFont("times", "bold");
    doc.setFontSize(compact ? 7.2 : 8.5);
    doc.text(obsLabel, valueX, nextY);

    doc.setFont("times", "normal");
    const obsLines = doc.splitTextToSize(
      observation,
      Math.max(18, x + width - (valueX + obsLabelWidth))
    );

    doc.text(obsLines, valueX + obsLabelWidth, nextY);
    nextY += Math.max(1, obsLines.length) * (compact ? 3.3 : 3.8) + 1;
  }

  return nextY;
}

function measureGroupedDetailsHeight(
  doc: jsPDF,
  details: PdfResultRenderItem[],
  width: number,
  compact: boolean,
  rowGap = 0
) {
  const orderedDetails = preserveDetailsOrder(details);
  let height = 0;

  for (const item of orderedDetails) {
    if (isDividerDetail(item)) {
      doc.setFont("times", "bold");
      doc.setFontSize(compact ? 10 : 12);

      const dividerLines = doc.splitTextToSize(
        (safeText(item.texto) || "DIVISOR").toUpperCase(),
        width - 4
      );

      height +=
        Math.max(1, dividerLines.length) * (compact ? 4.5 : 5.5) +
        (compact ? 3 : 4);

      continue;
    }

    const d = item as PdfResultDetail;

    height += getParameterRowHeight(
      safeText(d.observation),
      width,
      compact,
      doc
    );

    height += rowGap;
  }

  return height;
}

function findBalancedSplitByHeights(heights: number[]) {
  if (heights.length <= 1) return 1;

  let bestSplit = 1;
  let bestDifference = Number.POSITIVE_INFINITY;

  for (let split = 1; split < heights.length; split++) {
    const left = heights.slice(0, split).reduce((a, b) => a + b, 0);
    const right = heights.slice(split).reduce((a, b) => a + b, 0);
    const difference = Math.abs(left - right);

    if (difference < bestDifference) {
      bestDifference = difference;
      bestSplit = split;
    }
  }

  return bestSplit;
}

function estimateGroupedTestHeight(
  doc: jsPDF,
  test: PreparedTest,
  width: number,
  compact: boolean
) {
  const result = test._result;
  const details = preserveDetailsOrder(result.details || []);

  // Medimos con la misma tipografía usada al dibujar.
  // Así no activamos dos columnas por una sobreestimación.
  doc.setFont("times", "bold");
  doc.setFontSize(compact ? 12 : 15);

  const title = getTestTitleBlockMetrics(
    doc,
    test.name,
    test.description || "",
    test.visible_description ?? true,
    { width, compact }
  );

  let contentHeight = 0;

  if (safeText(result.notes)) {
    contentHeight = measureGroupedNotesHeight(
      doc,
      result.notes || "",
      width,
      compact
    );
  } else if (details.length) {
    contentHeight = measureGroupedDetailsHeight(
      doc,
      details,
      width,
      compact
    );
  } else {
    contentHeight = compact ? 5 : 7;
  }

  return (
    title.height +
    (compact ? 1.5 : 3) +
    contentHeight +
    (compact ? 3 : 5)
  );
}

function estimateGroupedPageHeightOneColumn(
  doc: jsPDF,
  tests: PreparedTest[]
) {
  const contentWidth = 166;

  return tests.reduce(
    (acc, test) =>
      acc +
      estimateGroupedTestHeight(
        doc,
        test,
        contentWidth,
        false
      ),
    0
  );
}

function drawGroupedTitle(
  doc: jsPDF,
  test: PreparedTest,
  x: number,
  y: number,
  width: number,
  compact: boolean
) {
  const metrics = getTestTitleBlockMetrics(
    doc,
    test.name,
    test.description || "",
    test.visible_description ?? true,
    {
      width,
      compact,
    }
  );

  const centerX = x + width / 2;

  doc.setTextColor(70, 70, 70);
  doc.setFont("times", "bold");
  doc.setFontSize(compact ? 12 : 15);

  const nameY = y + (compact ? 4.5 : 5.5);

  doc.text(
    metrics.nameLines,
    centerX,
    nameY,
    { align: "center" }
  );

  if (
    metrics.descriptionLines.length
  ) {
    doc.setFont("times", "normal");
    doc.setFontSize(compact ? 9.5 : 12);
    doc.setTextColor(95, 95, 95);

    doc.text(
      metrics.descriptionLines,
      centerX,
      nameY + metrics.nameHeight,
      { align: "center" }
    );
  }

  return y + metrics.height;
}

function drawGroupedNotes(
  doc: jsPDF,
  notes: string,
  x: number,
  y: number,
  width: number,
  compact: boolean
) {
  const lines = safeText(notes)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const labelX = x + 1;
  const valueX =
    compact
      ? x + Math.min(31, width * 0.38)
      : x + Math.min(42, width * 0.34);

  const valueWidth =
    Math.max(
      20,
      x + width - valueX - 1
    );

  for (const line of lines) {
    const parsed = splitLabelValue(line);

    if (parsed) {
      const wrapped =
        doc.splitTextToSize(
          parsed.value || "—",
          valueWidth
        );

      doc.setTextColor(70, 70, 70);
      doc.setFont("times", "bold");
      doc.setFontSize(compact ? 8.5 : 10);

      doc.text(
        parsed.label,
        labelX,
        y
      );

      doc.text(
        ":",
        valueX - 3,
        y
      );

      doc.setFont("times", "normal");

      doc.text(
        wrapped,
        valueX,
        y
      );

      y +=
        Math.max(
          compact ? 4 : 5,
          wrapped.length *
            (compact ? 4 : 5)
        ) + 1;
    } else {
      const wrapped =
        doc.splitTextToSize(
          line,
          width - 2
        );

      doc.setTextColor(70, 70, 70);
      doc.setFont("times", "normal");
      doc.setFontSize(compact ? 8.5 : 10);

      doc.text(
        wrapped,
        x + 1,
        y
      );

      y +=
        Math.max(
          1,
          wrapped.length
        ) *
          (compact ? 4 : 5) +
        1;
    }
  }

  return y;
}

function drawGroupedDetails(
  doc: jsPDF,
  details: PdfResultRenderItem[],
  x: number,
  y: number,
  width: number,
  compact: boolean,
  rowGap = 0
) {
  const orderedDetails = preserveDetailsOrder(details);

  for (const item of orderedDetails) {
    if (isDividerDetail(item)) {
      const dividerLines = doc.splitTextToSize(
        (safeText(item.texto) || "DIVISOR").toUpperCase(),
        width - 4
      );

      doc.setTextColor(70, 70, 70);
      doc.setFont("times", "bold");
      doc.setFontSize(compact ? 10 : 12);

      doc.text(
        dividerLines,
        x + width / 2,
        y,
        { align: "center" }
      );

      y +=
        Math.max(1, dividerLines.length) * (compact ? 4.5 : 5.5) +
        (compact ? 3 : 4);

      continue;
    }

    const d = item as PdfResultDetail;

    y = drawParameterSingleLine(
      doc,
      d,
      x,
      y,
      width,
      compact
    );

    y += rowGap;
  }

  return y;
}

function drawGroupedTestBlock(
  doc: jsPDF,
  test: PreparedTest,
  x: number,
  y: number,
  width: number,
  compact: boolean,
  rowGap = 0
) {
  let currentY = drawGroupedTitle(
    doc,
    test,
    x,
    y,
    width,
    compact
  );

  currentY += compact ? 1.5 : 3;

  const result = test._result;
  const details = preserveDetailsOrder(
    result.details || []
  );

  if (safeText(result.notes)) {
    currentY = drawGroupedNotes(
      doc,
      result.notes || "",
      x,
      currentY,
      width,
      compact
    );
  } else if (details.length) {
    currentY = drawGroupedDetails(
      doc,
      details,
      x,
      currentY,
      width,
      compact,
      rowGap
    );
  } else {
    doc.setFont("times", "normal");
    doc.setFontSize(compact ? 8.5 : 10);
    doc.setTextColor(70, 70, 70);

    doc.text(
      "Sin resultados detallados.",
      x + 1,
      currentY
    );

    currentY += compact ? 5 : 7;
  }

  currentY += compact ? 3 : 5;

  return currentY;
}

function renderGroupedOneColumn(
  doc: jsPDF,
  tests: PreparedTest[]
) {
  const x = 22;
  const width = 166;
  const top = PAGE.frameTop + PAGE.innerPaddingTop;
  const bottom = PAGE.groupedContentBottom;
  const availableHeight = bottom - top;

  const naturalHeight = tests.reduce(
    (acc, test) =>
      acc +
      estimateGroupedTestHeight(
        doc,
        test,
        width,
        false
      ),
    0
  );

  const parameterRows = tests.reduce(
    (acc, test) =>
      acc +
      countParameterRows(
        preserveDetailsOrder(test._result.details || [])
      ),
    0
  );

  /*
   * Si sobra espacio debajo del último parámetro, en vez de
   * dejar una zona vacía muy grande repartimos parte de ese
   * espacio entre las filas. Limitamos el incremento para que
   * tampoco se vea artificialmente separado.
   */
  const rowGap = calculateExtraRowGap(
    availableHeight,
    naturalHeight,
    parameterRows,
    3.2
  );

  let y = top;

  tests.forEach((test) => {
    y = drawGroupedTestBlock(
      doc,
      test,
      x,
      y,
      width,
      false,
      rowGap
    );
  });

  return y;
}

function renderSingleGroupedTestTwoColumns(
  doc: jsPDF,
  test: PreparedTest
) {
  const leftX = 20;
  const gap = 8;
  const columnWidth = 81;
  const rightX = leftX + columnWidth + gap;
  const fullWidth = columnWidth * 2 + gap;

  let y = PAGE.frameTop + PAGE.innerPaddingTop;

  // Título principal centrado a todo el ancho.
  y = drawGroupedTitle(
    doc,
    test,
    leftX,
    y,
    fullWidth,
    false
  );

  y += 3;

  const result = test._result;
  const details = preserveDetailsOrder(
    result.details || []
  );

  if (safeText(result.notes)) {
    const lines = safeText(result.notes)
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    const heights = lines.map((line) =>
      measureGroupedNotesHeight(
        doc,
        line,
        columnWidth,
        true
      )
    );

    const split = findBalancedSplitByHeights(heights);

    const leftY = drawGroupedNotes(
      doc,
      lines.slice(0, split).join("\n"),
      leftX,
      y,
      columnWidth,
      true
    );

    const rightY = drawGroupedNotes(
      doc,
      lines.slice(split).join("\n"),
      rightX,
      y,
      columnWidth,
      true
    );

    const bottomY = Math.max(leftY, rightY);

    if (lines.slice(split).length > 0) {
      doc.setDrawColor(205, 215, 225);
      doc.setLineWidth(0.25);

      doc.line(
        leftX + columnWidth + gap / 2,
        y,
        leftX + columnWidth + gap / 2,
        bottomY
      );
    }

    return bottomY;
  }

  if (!details.length) {
    return y;
  }

  type DetailSection = {
    divider: PdfDividerDetail | null;
    items: PdfResultRenderItem[];
  };

  /*
   * Cada divisor crea una sección independiente:
   *
   * columnas arriba
   * ----------------
   *    DIVISOR
   * ----------------
   * columnas abajo
   */
  const sections: DetailSection[] = [];
  let currentSection: DetailSection = {
    divider: null,
    items: [],
  };

  for (const item of details) {
    if (isDividerDetail(item)) {
      if (
        currentSection.items.length > 0 ||
        currentSection.divider
      ) {
        sections.push(currentSection);
      }

      currentSection = {
        divider: item,
        items: [],
      };

      continue;
    }

    currentSection.items.push(item);
  }

  if (
    currentSection.items.length > 0 ||
    currentSection.divider
  ) {
    sections.push(currentSection);
  }

  let currentY = y;

  const drawSectionInTwoColumns = (
    sectionItems: PdfResultRenderItem[],
    startY: number,
    isLastSection: boolean
  ) => {
    if (!sectionItems.length) {
      return startY;
    }

    const heights = sectionItems.map((item) =>
      measureGroupedDetailsHeight(
        doc,
        [item],
        columnWidth,
        true
      )
    );

    const split = findBalancedSplitByHeights(heights);

    const leftItems = sectionItems.slice(0, split);
    const rightItems = sectionItems.slice(split);

    const leftNatural = measureGroupedDetailsHeight(
      doc,
      leftItems,
      columnWidth,
      true
    );

    const rightNatural = measureGroupedDetailsHeight(
      doc,
      rightItems,
      columnWidth,
      true
    );

    /*
     * Si esta es la última sección y todavía sobra altura,
     * repartimos espacio entre parámetros en cada columna.
     */
    const sectionAvailable = isLastSection
      ? Math.max(0, PAGE.groupedContentBottom - startY)
      : Math.max(leftNatural, rightNatural);

    const leftGap = calculateExtraRowGap(
      sectionAvailable,
      leftNatural,
      countParameterRows(leftItems),
      2.4
    );

    const rightGap = calculateExtraRowGap(
      sectionAvailable,
      rightNatural,
      countParameterRows(rightItems),
      2.4
    );

    const leftY = drawGroupedDetails(
      doc,
      leftItems,
      leftX,
      startY,
      columnWidth,
      true,
      leftGap
    );

    const rightY = rightItems.length
      ? drawGroupedDetails(
          doc,
          rightItems,
          rightX,
          startY,
          columnWidth,
          true,
          rightGap
        )
      : startY;

    const sectionBottom = Math.max(leftY, rightY);

    if (rightItems.length > 0) {
      doc.setDrawColor(205, 215, 225);
      doc.setLineWidth(0.25);

      doc.line(
        leftX + columnWidth + gap / 2,
        startY,
        leftX + columnWidth + gap / 2,
        sectionBottom
      );
    }

    return sectionBottom;
  };

  sections.forEach((section, sectionIndex) => {
    if (section.divider) {
      currentY += sectionIndex > 0 ? 3 : 0;

      const dividerText = (
        safeText(section.divider.texto) || "DIVISOR"
      ).toUpperCase();

      const dividerLines = doc.splitTextToSize(
        dividerText,
        fullWidth - 10
      );

      doc.setTextColor(70, 70, 70);
      doc.setFont("times", "bold");
      doc.setFontSize(14);

      doc.text(
        dividerLines,
        leftX + fullWidth / 2,
        currentY + 5,
        { align: "center" }
      );

      const dividerHeight =
        Math.max(1, dividerLines.length) * 5.5 + 4;

      currentY += dividerHeight;
    }

    currentY = drawSectionInTwoColumns(
      section.items,
      currentY,
      sectionIndex === sections.length - 1
    );

    currentY += 2;
  });

  return currentY;
}

function renderGroupedTwoColumns(
  doc: jsPDF,
  tests: PreparedTest[]
) {
  if (tests.length === 1) {
    return renderSingleGroupedTestTwoColumns(doc, tests[0]);
  }

  const leftX = 20;
  const gap = 8;
  const width = 81;
  const rightX =
    leftX + width + gap;

  const top =
    PAGE.frameTop +
    PAGE.innerPaddingTop;

  const bottom =
    PAGE.groupedContentBottom;

  const availableHeight =
    bottom - top;

  /**
   * Primero estimamos cada examen con el ancho real
   * de una columna.
   */
  const estimates = tests.map((test) =>
    estimateGroupedTestHeight(
      doc,
      test,
      width,
      true
    )
  );

  /**
   * Elegimos el punto de corte que más equilibra
   * las alturas izquierda/derecha, pero manteniendo
   * SIEMPRE el orden de lectura:
   *
   * 1,2,3... columna izquierda
   * luego 4,5,6... columna derecha
   */
  let bestSplit = 1;
  let bestScore =
    Number.POSITIVE_INFINITY;

  for (
    let split = 1;
    split < tests.length;
    split++
  ) {
    const leftHeight = estimates
      .slice(0, split)
      .reduce((a, b) => a + b, 0);

    const rightHeight = estimates
      .slice(split)
      .reduce((a, b) => a + b, 0);

    const overflow =
      Math.max(
        0,
        leftHeight - availableHeight
      ) +
      Math.max(
        0,
        rightHeight - availableHeight
      );

    const balance =
      Math.abs(
        leftHeight - rightHeight
      );

    const score =
      overflow * 10000 + balance;

    if (score < bestScore) {
      bestScore = score;
      bestSplit = split;
    }
  }

  if (tests.length === 1) {
    bestSplit = 1;
  }

  const leftTests =
    tests.slice(0, bestSplit);

  const rightTests =
    tests.slice(bestSplit);

  const leftNatural = leftTests.reduce(
    (acc, test) =>
      acc + estimateGroupedTestHeight(doc, test, width, true),
    0
  );

  const rightNatural = rightTests.reduce(
    (acc, test) =>
      acc + estimateGroupedTestHeight(doc, test, width, true),
    0
  );

  const leftRows = leftTests.reduce(
    (acc, test) =>
      acc + countParameterRows(test._result.details || []),
    0
  );

  const rightRows = rightTests.reduce(
    (acc, test) =>
      acc + countParameterRows(test._result.details || []),
    0
  );

  const leftGap = calculateExtraRowGap(
    availableHeight,
    leftNatural,
    leftRows,
    2.2
  );

  const rightGap = calculateExtraRowGap(
    availableHeight,
    rightNatural,
    rightRows,
    2.2
  );

  let leftY = top;

  leftTests.forEach((test) => {
    leftY = drawGroupedTestBlock(
      doc,
      test,
      leftX,
      leftY,
      width,
      true,
      leftGap
    );
  });

  let rightY = top;

  rightTests.forEach((test) => {
    rightY = drawGroupedTestBlock(
      doc,
      test,
      rightX,
      rightY,
      width,
      true,
      rightGap
    );
  });

  /**
   * Línea divisoria sutil.
   */
  doc.setDrawColor(205, 215, 225);
  doc.setLineWidth(0.25);

  doc.line(
    leftX + width + gap / 2,
    top,
    leftX + width + gap / 2,
    Math.max(
      top,
      Math.min(
        bottom,
        Math.max(leftY, rightY)
      )
    )
  );

  return Math.max(leftY, rightY);
}

function renderGroupedPage(
  doc: jsPDF,
  tests: PreparedTest[],
  config: PdfLabConfig,
  patient: PdfPatient,
  order: PdfOrder
) {
  addResultsPageScaffold(
    doc,
    config,
    patient
  );

  const top =
    PAGE.frameTop +
    PAGE.innerPaddingTop;

  const availableHeight =
    PAGE.groupedContentBottom - top;

  const oneColumnHeight =
    estimateGroupedPageHeightOneColumn(
      doc,
      tests
    );

  /**
   * REGLA:
   * 1. Si cabe en una columna -> una columna.
   * 2. Si no cabe -> DOS COLUMNAS EN LA MISMA HOJA.
   */
  // Una columna mientras realmente quepa; dos columnas solo como plan B.
  if (
    oneColumnHeight <=
    availableHeight + 2
  ) {
    renderGroupedOneColumn(
      doc,
      tests
    );
  } else {
    renderGroupedTwoColumns(
      doc,
      tests
    );
  }

  const firstDate =
    tests
      .map(
        (test) => test._result.date
      )
      .find(Boolean) || null;

  drawFooter(
    doc,
    order,
    config,
    firstDate
  );
}

/**
 * Construye los bloques reales de páginas.
 *
 * - Sin pageGroup: una prueba = una página normal.
 * - Con pageGroup: todas las pruebas con el mismo grupo
 *   = UNA SOLA PÁGINA.
 *
 * El grupo aparece en la posición de su PRIMER elemento,
 * respetando el orden recibido desde ResultsPage.
 */
function buildPageBlocks(
  tests: PreparedTest[]
): PageBlock[] {
  const blocks: PageBlock[] = [];
  const processedGroups =
    new Set<string>();

  for (const test of tests) {
    const pageGroup =
      safeText(test.pageGroup) ||
      safeText(test._result.pageGroup);

    if (!pageGroup) {
      blocks.push({
        kind: "single",
        tests: [test],
      });

      continue;
    }

    if (
      processedGroups.has(pageGroup)
    ) {
      continue;
    }

    processedGroups.add(pageGroup);

    const members = tests.filter(
      (candidate) => {
        const candidateGroup =
          safeText(
            candidate.pageGroup
          ) ||
          safeText(
            candidate._result.pageGroup
          );

        return (
          candidateGroup === pageGroup
        );
      }
    );

    blocks.push({
      kind: "group",
      pageGroup,
      tests: members,
    });
  }

  return blocks;
}

function renderSingleTestPage(
  doc: jsPDF,
  test: PreparedTest,
  config: PdfLabConfig,
  patient: PdfPatient,
  order: PdfOrder
) {
  addResultsPageScaffold(
    doc,
    config,
    patient
  );

  const result = test._result;

  const normalizedDetails =
    preserveDetailsOrder(
      result.details || []
    );

  const layout =
    getCenteredBlockLayout(
      doc,
      test.name,
      test.description || "",
      test.visible_description ??
        true,
      result.notes || "",
      normalizedDetails
    );

  drawTitleBlockAt(
    doc,
    test.name,
    test.description || "",
    layout.titleTop,
    test.visible_description ?? true
  );

  const hasNotes =
    !!safeText(result.notes);

  const hasDetails =
    Array.isArray(
      normalizedDetails
    ) &&
    normalizedDetails.length > 0;

  let y = layout.contentTop;

  if (hasNotes) {
    y = drawNotesWithPagination(
      doc,
      result.notes || "",
      y,
      config,
      patient,
      test.name,
      test.description || "",
      test.visible_description ??
        true
    );
  }

  if (hasDetails) {
    y =
      drawStructuredDetailsWithPagination(
        doc,
        normalizedDetails,
        y,
        config,
        patient,
        test.name,
        test.description || "",
        test.visible_description ??
          true
      );
  }

  if (!hasNotes && !hasDetails) {
    doc.setFont("times", "normal");
    doc.setFontSize(11);
    doc.setTextColor(70, 70, 70);

    doc.text(
      "Sin resultados detallados.",
      22,
      y
    );
  }

  /**
   * La función anterior puede haber creado páginas
   * de continuación. El footer se coloca en la última.
   */
  const currentPage =
    doc.getNumberOfPages();

  doc.setPage(currentPage);

  drawFooter(
    doc,
    order,
    config,
    result.date
  );
}


function addLaboratoryWatermark(
  doc: jsPDF,
  config: PdfLabConfig
) {
  const totalPages = doc.getNumberOfPages();
  const logo = normalizeImageData(config.logo);
  const logoFormat = imageFormatFromBase64(logo);

  for (let page = 1; page <= totalPages; page++) {
    doc.setPage(page);

    if (logo && logoFormat) {
      try {
        doc.saveGraphicsState();

        (doc as any).setGState?.(
          new (doc as any).GState({
            opacity: 0.14,
          })
        );

        doc.addImage(
          logo,
          logoFormat,
          55,
          108,
          100,
          100
        );

        doc.restoreGraphicsState();
        continue;
      } catch {
        try {
          doc.restoreGraphicsState();
        } catch {
          // ignorar
        }
      }
    }

    try {
      doc.saveGraphicsState();

      (doc as any).setGState?.(
        new (doc as any).GState({
          opacity: 0.12,
        })
      );

      doc.setTextColor(120, 120, 120);
      doc.setFont("times", "bold");
      doc.setFontSize(34);

      const watermarkText =
        safeText(config.name) ||
        "LABORATORIO CLÍNICO";

      doc.text(
        watermarkText.toUpperCase(),
        105,
        155,
        {
          align: "center",
          angle: 35,
        } as any
      );

      doc.restoreGraphicsState();
    } catch {
      try {
        doc.restoreGraphicsState();
      } catch {
        // ignorar
      }
    }
  }
}

export function downloadBlob(
  blob: Blob,
  filename: string
) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");

  a.href = url;
  a.download = filename;
  a.click();

  setTimeout(
    () => URL.revokeObjectURL(url),
    1000
  );
}

export function generateResultsPDF(
  order: PdfOrder,
  patient: PdfPatient,
  orderTests: PdfOrderTest[],
  orderResults: PdfOrderResult[],
  config: PdfLabConfig,
  options?: {
    autoDownload?: boolean;
    fileName?: string;
    watermark?: boolean;
  }
): Blob {
  const doc = new jsPDF(
    "p",
    "mm",
    "a4"
  );

  const {
    byLayoutKey,
    byGroupedKey,
  } = buildResultMaps(
    orderResults || []
  );

  /**
   * MUY IMPORTANTE:
   *
   * NO SE ORDENA AQUÍ.
   *
   * El orden de orderTests es exactamente
   * el orden de drag & drop enviado por ResultsPage.
   */
  const preparedTests: PreparedTest[] =
    (orderTests || [])
      .map((test) => {
        const groupedKey =
          buildGroupedTestKey(
            test.name,
            test.description,
            test.visible_description ??
              true
          );

        const layoutKey =
          safeText(test.layoutKey) ||
          groupedKey;

        const result =
          byLayoutKey.get(layoutKey) ||
          byGroupedKey.get(groupedKey);

        if (!result) {
          return null;
        }

        return {
          ...test,
          _groupKey: groupedKey,
          _layoutKey: layoutKey,
          _result: result,
        } as PreparedTest;
      })
      .filter(
        (
          test
        ): test is PreparedTest =>
          !!test
      );

  const pageBlocks =
    buildPageBlocks(preparedTests);

  /**
   * jsPDF crea inicialmente una página.
   * La usamos para el primer bloque y agregamos
   * páginas solamente ENTRE bloques.
   */
  pageBlocks.forEach(
    (block, blockIndex) => {
      if (blockIndex > 0) {
        doc.addPage();
      }

      if (block.kind === "group") {
        renderGroupedPage(
          doc,
          block.tests,
          config,
          patient,
          order
        );

        return;
      }

      renderSingleTestPage(
        doc,
        block.tests[0],
        config,
        patient,
        order
      );
    }
  );

  /**
   * Si por alguna razón no hubo resultados,
   * evitamos dejar el PDF completamente vacío.
   */
  if (pageBlocks.length === 0) {
    addResultsPageScaffold(
      doc,
      config,
      patient
    );

    doc.setFont("times", "normal");
    doc.setFontSize(11);
    doc.setTextColor(70, 70, 70);

    doc.text(
      "No existen resultados para mostrar.",
      105,
      130,
      { align: "center" }
    );

    drawFooter(
      doc,
      order,
      config,
      order.created_at || order.date
    );
  }

  if (options?.watermark) {
    addLaboratoryWatermark(
      doc,
      config
    );
  }

  const blob = doc.output("blob");

  if (options?.autoDownload) {
    downloadBlob(
      blob,
      options.fileName ||
        `resultados_${order.code}.pdf`
    );
  }

  return blob;
}
