import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
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

function safeJsonParse(text: string) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const PAYPHONE_TOKEN = Deno.env.get("PAYPHONE_TOKEN");

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return jsonResponse(
        {
          ok: false,
          approved: false,
          message: "Faltan variables de entorno de Supabase.",
        },
        500
      );
    }

    if (!PAYPHONE_TOKEN) {
      return jsonResponse(
        {
          ok: false,
          approved: false,
          message: "Falta la secret PAYPHONE_TOKEN.",
        },
        500
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const body = await req.json();
    const id = Number(body?.id || 0);
    const clientTransactionId = String(body?.clientTransactionId || "").trim();

    if (!id || !clientTransactionId) {
      return jsonResponse(
        {
          ok: false,
          approved: false,
          message: "Los campos id y clientTransactionId son obligatorios.",
        },
        400
      );
    }

    const confirmPayload = {
      id,
      clientTxId: clientTransactionId,
    };

    console.log("PAYPHONE VERIFY INPUT", {
      id,
      clientTransactionId,
      tokenPrefix: PAYPHONE_TOKEN.slice(0, 8),
      now: new Date().toISOString(),
    });

    const payphoneResp = await fetch(
      "https://pay.payphonetodoesposible.com/api/button/V2/Confirm",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${PAYPHONE_TOKEN}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(confirmPayload),
      }
    );

    const rawText = await payphoneResp.text();

    console.log("PAYPHONE VERIFY STATUS", payphoneResp.status);
    console.log("PAYPHONE VERIFY RAW", rawText);

    const parsed = safeJsonParse(rawText);

    if (!parsed) {
      return jsonResponse(
        {
          ok: false,
          approved: false,
          message:
            "Payphone devolvió una respuesta no JSON al confirmar la transacción.",
          status: payphoneResp.status,
          response: {
            raw: rawText,
          },
          debug: {
            endpoint:
              "https://pay.payphonetodoesposible.com/api/button/V2/Confirm",
            sentPayload: confirmPayload,
          },
        },
        500
      );
    }

    if (!payphoneResp.ok) {
      return jsonResponse(
        {
          ok: false,
          approved: false,
          message:
            parsed?.message ||
            "Payphone devolvió un error al confirmar la transacción.",
          status: payphoneResp.status,
          response: parsed,
          debug: {
            endpoint:
              "https://pay.payphonetodoesposible.com/api/button/V2/Confirm",
            sentPayload: confirmPayload,
          },
        },
        400
      );
    }

    // Payphone documenta statusCode 3 = Approved, 2 = Canceled
    if (Number(parsed?.statusCode) !== 3) {
      return jsonResponse({
        ok: true,
        approved: false,
        message:
          parsed?.message ||
          parsed?.transactionStatus ||
          "La transacción no fue aprobada.",
        response: parsed,
      });
    }

    const orderId = String(parsed?.optionalParameter || "").trim();
    if (!orderId) {
      return jsonResponse(
        {
          ok: false,
          approved: false,
          message:
            "Payphone aprobó la transacción, pero no devolvió optionalParameter con el ID de la orden.",
          response: parsed,
        },
        400
      );
    }

    const amountPaid = Number(parsed?.amount || 0) / 100;
    const transactionId = String(parsed?.transactionId || "").trim();
    const authorizationCode = String(parsed?.authorizationCode || "").trim();
    const reference = String(parsed?.reference || "").trim();

    const paymentReference = [
      "PAYPHONE",
      transactionId ? `TX:${transactionId}` : null,
      authorizationCode ? `AUTH:${authorizationCode}` : null,
      clientTransactionId ? `CTX:${clientTransactionId}` : null,
    ]
      .filter(Boolean)
      .join(" | ");

    // Evitar duplicados
    const { data: existingPayment, error: existingPaymentError } = await supabase
      .from("orden_pagos")
      .select("id")
      .eq("order_id", orderId)
      .eq("reference", paymentReference)
      .maybeSingle();

    if (existingPaymentError) {
      return jsonResponse(
        {
          ok: false,
          approved: false,
          message: "Error verificando si el pago ya fue registrado.",
          detail: existingPaymentError.message,
        },
        500
      );
    }

    if (!existingPayment) {
      const { error: insertPaymentError } = await supabase
        .from("orden_pagos")
        .insert([
          {
            order_id: orderId,
            amount: amountPaid,
            payment_method: "PAYPHONE",
            reference: paymentReference,
            notes: reference || "Pago registrado desde portal del paciente",
          },
        ]);

      if (insertPaymentError) {
        return jsonResponse(
          {
            ok: false,
            approved: false,
            message: "No se pudo registrar el pago en orden_pagos.",
            detail: insertPaymentError.message,
          },
          500
        );
      }
    }

    const { data: order, error: orderError } = await supabase
      .from("ordenes")
      .select(
        `
        id,
        code,
        access_key,
        total,
        paid_amount,
        payment_status,
        status
      `
      )
      .eq("id", orderId)
      .single();

    if (orderError || !order) {
      return jsonResponse(
        {
          ok: false,
          approved: true,
          message:
            "Pago confirmado, pero no se pudo obtener la orden actualizada.",
          detail: orderError?.message || null,
          response: parsed,
        },
        500
      );
    }

    return jsonResponse({
      ok: true,
      approved: true,
      message: "Pago confirmado correctamente.",
      orderId: order.id,
      orderCode: order.code,
      accessKey: order.access_key,
      total: order.total,
      paidAmount: order.paid_amount,
      paymentStatus: order.payment_status,
      orderStatus: order.status,
      response: parsed,
    });
  } catch (error: any) {
    console.error("PAYPHONE VERIFY FATAL", error);

    return jsonResponse(
      {
        ok: false,
        approved: false,
        message: error?.message || "Error interno en payphone-verify.",
      },
      500
    );
  }
});