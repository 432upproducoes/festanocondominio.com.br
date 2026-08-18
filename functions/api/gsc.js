export async function onRequest(context) {
  const { env, request } = context;

  // 1. Verifica se a variável de ambiente existe
  if (!env.GOOGLE_SERVICE_ACCOUNT) {
    return new Response(
      JSON.stringify({ error: "Variável GOOGLE_SERVICE_ACCOUNT não configurada." }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  try {
    // Parse das credenciais JSON salvas no Cloudflare
    const credentials = JSON.parse(env.GOOGLE_SERVICE_ACCOUNT);

    // 2. Extrai parâmetros da requisição (ex: siteUrl, startDate, endDate)
    const url = new URL(request.url);
    const siteUrl = url.searchParams.get("siteUrl");

    if (!siteUrl) {
      return new Response(
        JSON.stringify({ error: "Parâmetro siteUrl é obrigatório." }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

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
          startDate: url.searchParams.get("startDate") || "2026-01-01",
          endDate: url.searchParams.get("endDate") || "2026-08-18",
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
      JSON.stringify({ error: "Erro interno", details: err.message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}

// Função auxiliar para gerar JWT e obter token de acesso do Google
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

  const signature = await signRS256(signatureInput, credentials.private_key);
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
