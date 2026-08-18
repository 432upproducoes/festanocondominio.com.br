export async function onRequest(context) {
  const { env, request } = context;

  // Trata requisição Preflight (CORS)
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    });
  }

  // 1. Verifica se a variável de ambiente existe
  if (!env.GOOGLE_SERVICE_ACCOUNT) {
    return new Response(
      JSON.stringify({ error: "Variável GOOGLE_SERVICE_ACCOUNT não configurada no Cloudflare." }),
      { status: 500, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } }
    );
  }

  try {
    // Parse das credenciais JSON salvas no Cloudflare
    const credentials = typeof env.GOOGLE_SERVICE_ACCOUNT === "string" 
      ? JSON.parse(env.GOOGLE_SERVICE_ACCOUNT) 
      : env.GOOGLE_SERVICE_ACCOUNT;

    // 2. Extrai parâmetros da requisição
    const url = new URL(request.url);
    // IMPORTANTE: propriedade no Search Console é do tipo "prefixo de URL" (cadeado),
    // então o siteUrl precisa ser a URL completa, não "sc-domain:..."
    const siteUrl = url.searchParams.get("siteUrl") || "https://festanocondominio.com.br/";
    const startDate = url.searchParams.get("startDate") || "2026-01-01";
    const endDate = url.searchParams.get("endDate") || new Date().toISOString().split("T")[0];

    // 3. Obter Access Token usando as credenciais da Service Account
    const accessToken = await getGoogleAccessToken(credentials);

    // 4. Faz a requisição para a API do Search Console
    const gscResponse = await fetch(
      `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          startDate: startDate,
          endDate: endDate,
          dimensions: ["date", "query", "page"],
          rowLimit: 100,
        }),
      }
    );

    const data = await gscResponse.json();

    return new Response(JSON.stringify(data), {
      status: gscResponse.status,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: "Erro interno no worker", details: err.message }),
      { status: 500, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } }
    );
  }
}

// Gerar JWT e obter token de acesso do Google
async function getGoogleAccessToken(credentials) {
  const header = { alg: "RS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const claimSet = {
    iss: credentials.client_email,
    scope: "https://www.googleapis.com/auth/webmasters.readonly",
    aud: credentials.token_uri || "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now,
  };

  const base64UrlHeader = base64UrlEncode(JSON.stringify(header));
  const base64UrlClaimSet = base64UrlEncode(JSON.stringify(claimSet));
  const signatureInput = `${base64UrlHeader}.${base64UrlClaimSet}`;

  // Corrige formatação da chave privada (substitui \n literais por quebras reais)
  const formattedPrivateKey = credentials.private_key.replace(/\\n/g, "\n");
  
  const signature = await signRS256(signatureInput, formattedPrivateKey);
  const jwt = `${signatureInput}.${signature}`;

  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });

  const tokenData = await tokenResponse.json();
  
  if (!tokenData.access_token) {
    throw new Error(tokenData.error_description || tokenData.error || "Falha ao obter token no Google");
  }

  return tokenData.access_token;
}

function base64UrlEncode(str) {
  return btoa(str)
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

async function signRS256(message, privateKeyPem) {
  const pemHeader = "-----BEGIN PRIVATE KEY-----";
  const pemFooter = "-----END PRIVATE KEY-----";
  
  const pemContents = privateKeyPem
    .replace(pemHeader, "")
    .replace(pemFooter, "")
    .replace(/\s/g, "");

  const binaryDerString = atob(pemContents);
  const binaryDer = new Uint8Array(binaryDerString.length);
  for (let i = 0; i < binaryDerString.length; i++) {
    binaryDer[i] = binaryDerString.charCodeAt(i);
  }

  const key = await crypto.subtle.importKey(
    "pkcs8",
    binaryDer.buffer,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const encoder = new TextEncoder();
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    encoder.encode(message)
  );

  return btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}
