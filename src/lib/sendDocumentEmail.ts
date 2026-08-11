import { supabase } from "@/lib/supabaseClient";

export type SendDocumentType = "orden" | "resultados" | "factura";

async function blobToBase64(blob: Blob): Promise<string> {
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(String(reader.result || ""));
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export async function sendDocumentEmail(params: {
  to: string;
  documentType: SendDocumentType;
  orderCode: string;
  patientName?: string;
  pdfBlob?: Blob;
  pdfUrl?: string;
  filename?: string;
}) {
  const body: Record<string, any> = {
    to: params.to,
    documentType: params.documentType,
    orderCode: params.orderCode,
    patientName: params.patientName || "",
    filename: params.filename,
  };

  if (params.pdfBlob) {
    body.pdfBase64 = await blobToBase64(params.pdfBlob);
  } else if (params.pdfUrl) {
    body.pdfUrl = params.pdfUrl;
  } else {
    throw new Error("Debe proporcionar pdfBlob o pdfUrl");
  }

  const { data, error } = await supabase.functions.invoke("send-document-email", {
    body,
  });

  if (error) {
    throw new Error(error.message || "No se pudo invocar la función");
  }

  if (!data?.ok) {
    throw new Error(data?.error || "No se pudo enviar el correo");
  }

  return data;
}