// functions/geo.js
// Cloudflare Pages Function — retorna geolocalização REAL do visitante
// usando os dados que o próprio Cloudflare já injeta em toda requisição
// (request.cf), sem depender de nenhum serviço externo, sem latência
// extra e sem fallback fictício.
//
// Acesse via: https://432up.com/geo  (ou o domínio configurado)
//
// Rota: qualquer arquivo dentro de /functions/ vira uma rota automática
// no Cloudflare Pages. Este arquivo responde em /geo

export async function onRequest(context) {
  const { request } = context;
  const cf = request.cf;

  // Se por algum motivo o Cloudflare não injetar o objeto cf (ex: ambiente
  // de teste local, preview sem edge), não inventamos dado nenhum —
  // devolvemos null explícito para os campos, e o front decide como exibir.
  const dados = {
    city: cf?.city ?? null,
    region: cf?.regionCode ?? null,
    region_name: cf?.region ?? null,
    country: cf?.country ?? null,
    postal_code: cf?.postalCode ?? null,
    latitude: cf?.latitude ?? null,
    longitude: cf?.longitude ?? null,
    timezone: cf?.timezone ?? null,
    disponivel: !!cf?.city
  };

  return new Response(JSON.stringify(dados), {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store'
    }
  });
}
