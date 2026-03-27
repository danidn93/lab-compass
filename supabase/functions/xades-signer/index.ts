import { SignedXml } from "npm:xml-crypto";
import forge from "npm:node-forge";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

function certDigestSha1Base64(cert: any): string {
  const der = forge.asn1.toDer(forge.pki.certificateToAsn1(cert)).getBytes();
  const md = forge.md.sha1.create();
  md.update(der);
  return forge.util.encode64(md.digest().getBytes());
}

function escapeXml(value: string): string {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function buildIssuerName(cert: any): string {
  return cert.issuer.attributes
    .map((a: any) => `${a.shortName || a.name}=${a.value}`)
    .join(",");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => null);
    const xml = body?.xml;
    const p12Base64 = body?.p12_base64;
    const password = body?.password;

    if (!xml || !p12Base64 || !password) {
      return jsonResponse(
        {
          error: "Faltan datos requeridos: xml, p12_base64, password",
        },
        400
      );
    }

    // 1) Leer certificado P12
    const p12Der = forge.util.decode64(p12Base64);
    const p12Asn1 = forge.asn1.fromDer(p12Der);
    const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, password);

    let privateKey: any = null;
    let cert: any = null;

    for (const safeContent of p12.safeContents) {
      for (const safeBag of safeContent.safeBags) {
        if (
          safeBag.type === forge.pki.oids.pkcs8ShroudedKeyBag ||
          safeBag.type === forge.pki.oids.keyBag
        ) {
          privateKey = safeBag.key;
        }

        if (safeBag.type === forge.pki.oids.certBag) {
          cert = safeBag.cert;
        }
      }
    }

    if (!privateKey || !cert) {
      throw new Error("No se pudo extraer la llave privada o el certificado del .p12");
    }

    const pemKey = forge.pki.privateKeyToPem(privateKey);
    const pemCert = forge.pki
      .certificateToPem(cert)
      .replace("-----BEGIN CERTIFICATE-----", "")
      .replace("-----END CERTIFICATE-----", "")
      .replace(/\r/g, "")
      .replace(/\n/g, "");

    const signingTime = new Date().toISOString();
    const certDigestValue = certDigestSha1Base64(cert);
    const issuerName = escapeXml(buildIssuerName(cert));
    const serialNumber = escapeXml(String(cert.serialNumber));

    // IDs fijos para referencia interna
    const signatureId = "Signature-1";
    const signedPropertiesId = "SignedProperties-1";

    // 2) Construir objeto XAdES
    const xadesObject = `
<ds:Object>
  <xades:QualifyingProperties Target="#${signatureId}" xmlns:xades="http://uri.etsi.org/01903/v1.3.2#">
    <xades:SignedProperties Id="${signedPropertiesId}">
      <xades:SignedSignatureProperties>
        <xades:SigningTime>${escapeXml(signingTime)}</xades:SigningTime>
        <xades:SigningCertificate>
          <xades:Cert>
            <xades:CertDigest>
              <ds:DigestMethod Algorithm="http://www.w3.org/2000/09/xmldsig#sha1"/>
              <ds:DigestValue>${certDigestValue}</ds:DigestValue>
            </xades:CertDigest>
            <xades:IssuerSerial>
              <ds:X509IssuerName>${issuerName}</ds:X509IssuerName>
              <ds:X509SerialNumber>${serialNumber}</ds:X509SerialNumber>
            </xades:IssuerSerial>
          </xades:Cert>
        </xades:SigningCertificate>
      </xades:SignedSignatureProperties>
    </xades:SignedProperties>
  </xades:QualifyingProperties>
</ds:Object>`.trim();

    // 3) Firmar XML
    const sig = new SignedXml();

    sig.privateKey = pemKey;
    sig.signatureAlgorithm = "http://www.w3.org/2001/04/xmldsig-more#rsa-sha256";
    sig.canonicalizationAlgorithm =
      "http://www.w3.org/TR/2001/REC-xml-c14n-20010315";

    sig.addReference({
      xpath: "//*[local-name()='factura']",
      transforms: [
        "http://www.w3.org/2000/09/xmldsig#enveloped-signature",
        "http://www.w3.org/TR/2001/REC-xml-c14n-20010315",
      ],
      digestAlgorithm: "http://www.w3.org/2001/04/xmlenc#sha256",
    });

    sig.addReference({
      xpath: `//*[@Id='${signedPropertiesId}']`,
      transforms: [
        "http://www.w3.org/TR/2001/REC-xml-c14n-20010315",
      ],
      digestAlgorithm: "http://www.w3.org/2001/04/xmlenc#sha256",
      uri: `#${signedPropertiesId}`,
      type: "http://uri.etsi.org/01903#SignedProperties",
    });

    sig.keyInfoProvider = {
      getKeyInfo() {
        return `<ds:X509Data><ds:X509Certificate>${pemCert}</ds:X509Certificate></ds:X509Data>`;
      },
      getKey() {
        return null;
      },
    };

    sig.computeSignature(xml, {
      location: {
        reference: "//*[local-name()='factura']",
        action: "append",
      },
      prefix: "ds",
      attrs: {
        Id: signatureId,
      },
    });

    let signedXml = sig.getSignedXml();

    // 4) Insertar XAdES dentro de Signature
    signedXml = signedXml.replace("</ds:Signature>", `${xadesObject}</ds:Signature>`);

    if (!signedXml.includes("QualifyingProperties")) {
      throw new Error("La firma generada no incluye QualifyingProperties");
    }

    if (!signedXml.includes("SignedProperties")) {
      throw new Error("La firma generada no incluye SignedProperties");
    }

    if (!signedXml.includes("X509Certificate")) {
      throw new Error("La firma generada no incluye X509Certificate");
    }

    return jsonResponse({
      ok: true,
      signed_xml: signedXml,
    });
  } catch (error: any) {
    return jsonResponse(
      {
        error: error?.message || "Error interno al firmar XML",
      },
      500
    );
  }
});