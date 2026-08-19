/* Tracking de Visitas e Conversões
   Reescrito: zero fallback fictício, cidade real via Cloudflare Function,
   heartbeat pausável, captura de valor dinâmico via data-attribute. */
;(function() {
    'use strict';

    function isBotUserAgent() {
        var ua = (navigator.userAgent || '').toLowerCase();
        return /bot|crawler|spider|slurp|googlebot|bingbot|headless|lighthouse|pagespeed|duckduckbot|baiduspider|yandexbot|semrushbot|ahrefsbot|mj12bot|dotbot|petalbot|bytespider|gptbot|ccbot|facebookexternalhit|whatsapp|telegrambot|discordbot|phantomjs|puppeteer|playwright|selenium/.test(ua);
    }

    function pareceAutomatizado() {
        try {
            if (navigator.webdriver === true) return true;
            if (Array.isArray(navigator.languages) && navigator.languages.length === 0) return true;
        } catch (e) {}
        return false;
    }

    function isBot() {
        return isBotUserAgent() || pareceAutomatizado();
    }

    var detectedAsBot = isBot();

    if (isBotUserAgent()) return;
    try { if (window.self !== window.top) return; } catch(e) { return; }

    var SUPABASE_URL = "https://paetkspbfejtjjkngqej.supabase.co";
    var SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBhZXRrc3BiZmVqdGpqa25ncWVqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA5MDU2OTgsImV4cCI6MjA4NjQ4MTY5OH0.IiYweZ2g3bP7b0o7VvBW5LLb6d1oHtSNFUZlVkIsdsA";

    var visitId = null;
    try { visitId = sessionStorage.getItem('con_sid'); } catch(e) {}
    if (!visitId) {
        visitId = 'vis_' + Date.now() + '_' + Math.random().toString(36).substring(2, 15);
        try { sessionStorage.setItem('con_sid', visitId); } catch(e) {}
    }

    var startTime = Date.now();

    function sendData(table, payload) {
        var url = SUPABASE_URL + '/rest/v1/' + table;
        fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': SUPABASE_KEY,
                'Authorization': 'Bearer ' + SUPABASE_KEY,
                'Prefer': 'resolution=merge-duplicates'
            },
            body: JSON.stringify(payload)
        }).catch(function(){});
    }

    function detectDeviceDetails() {
        var ua = navigator.userAgent || '';
        var os = 'Desktop';
        var browser = 'Navegador';

        if (/iPad/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) os = 'iPad';
        else if (/iPhone/i.test(ua)) os = 'iPhone';
        else if (/Android/i.test(ua)) os = 'Android';
        else if (/Windows/i.test(ua)) os = 'Windows PC';
        else if (/Macintosh/i.test(ua)) os = 'Mac';

        if (/Edg/i.test(ua)) browser = 'Edge';
        else if (/Chrome/i.test(ua) && !/Edg/i.test(ua)) browser = 'Chrome';
        else if (/Safari/i.test(ua) && !/Chrome/i.test(ua)) browser = 'Safari';
        else if (/Firefox/i.test(ua)) browser = 'Firefox';

        return os + ' (' + browser + ')';
    }

    // --- Origem, UTMs e Termos: sem fallback fictício.
    // Antes: 'Acesso Direto', 'Geral / Orgânico', 'Geral / Sem Termo'
    // (dados inventados que se misturavam com dados reais na análise).
    // Agora: null quando não há informação, e o dashboard decide o texto
    // de exibição ("Acesso direto" É uma leitura válida de null aqui,
    // mas fica explícito que é ausência de dado, não um valor gravado).
    var query = window.location.search || '';
    var ref = document.referrer || '';
    var utmSource = null;
    var utmCampaign = null;
    var utmTerm = null;

    if (query.indexOf('utm_source=') > -1) {
        var mSrc = query.match(/utm_source=([^&]+)/);
        if (mSrc) utmSource = decodeURIComponent(mSrc[1]);
    } else if (ref.indexOf('google') > -1) {
        utmSource = 'Google Orgânico';
    } else if (ref.indexOf('instagram') > -1 || ref.indexOf('facebook') > -1) {
        utmSource = 'Meta / Instagram';
    } else if (ref.indexOf('tiktok') > -1) {
        utmSource = 'TikTok';
    } else if (ref.indexOf('openai') > -1 || ref.indexOf('chatgpt') > -1) {
        utmSource = 'ChatGPT / AI';
    } else if (!ref) {
        utmSource = 'Acesso Direto'; // isso é um fato observável (sem referrer), não um chute
    } else {
        utmSource = ref; // guarda o referrer cru em vez de inventar rótulo
    }

    if (query.indexOf('utm_campaign=') > -1) {
        var mCmp = query.match(/utm_campaign=([^&]+)/);
        if (mCmp) utmCampaign = decodeURIComponent(mCmp[1]);
    }

    if (query.indexOf('utm_term=') > -1) {
        var mTrm = query.match(/utm_term=([^&]+)/);
        if (mTrm) utmTerm = decodeURIComponent(mTrm[1]);
    }

    var baseData = {
        id: visitId,
        city: null,
        region: null,
        is_bot: detectedAsBot,
        source: utmSource,
        medium: utmTerm,
        campaign: utmCampaign,
        referrer: ref || null,
        device: detectDeviceDetails(),
        page_path: window.location.pathname,
        duration_seconds: 0
    };

    // --- Geolocalização real via Cloudflare Function (/geo).
    // Sem fallback de cidade fixa. Se a chamada falhar ou não vier
    // preenchida, o campo fica null e é isso — não inventamos localização.
    function buscarGeoReal() {
        fetch('/geo', { cache: 'no-store' })
            .then(function(res) { return res.ok ? res.json() : null; })
            .then(function(geo) {
                if (geo && geo.disponivel) {
                    baseData.city = geo.city;
                    baseData.region = geo.region_name || geo.region;
                }
                // envia (ou reenvia) a sessão já com dado real de cidade,
                // ou com null explícito se a função não retornou nada
                sendData('con_sessions', baseData);
            })
            .catch(function() {
                sendData('con_sessions', baseData);
            });
    }

    buscarGeoReal();

    // --- Heartbeat: pausa quando a aba não está visível, evitando
    // "tempo fantasma" contado enquanto o usuário está em outra aba/app,
    // e evitando gravações desnecessárias no banco.
    var heartbeatTimer = null;

    function tick() {
        var elapsed = Math.round((Date.now() - startTime) / 1000);
        baseData.duration_seconds = elapsed;
        sendData('con_sessions', baseData);
    }

    function iniciarHeartbeat() {
        if (heartbeatTimer) return;
        heartbeatTimer = setInterval(tick, 5000);
    }

    function pausarHeartbeat() {
        if (!heartbeatTimer) return;
        clearInterval(heartbeatTimer);
        heartbeatTimer = null;
    }

    document.addEventListener('visibilitychange', function() {
        if (document.hidden) {
            pausarHeartbeat();
        } else {
            iniciarHeartbeat();
        }
    });

    if (!document.hidden) iniciarHeartbeat();

    // --- Rastreio de Rolagem por Seções (sem alteração de lógica)
    var viewedSections = {};
    if ('IntersectionObserver' in window) {
        var observer = new IntersectionObserver(function(entries) {
            entries.forEach(function(entry) {
                if (entry.isIntersecting) {
                    var secId = entry.target.id;
                    if (secId && !viewedSections[secId]) {
                        viewedSections[secId] = true;
                        sendData('con_conversion_events', {
                            session_id: visitId,
                            package_name: 'Visualizou Seção: #' + secId,
                            estimated_value: 0
                        });
                    }
                }
            });
        }, { threshold: 0.5 });

        document.addEventListener('DOMContentLoaded', function() {
            var sections = document.querySelectorAll('section[id]');
            sections.forEach(function(sec) { observer.observe(sec); });
        });
    }

    // --- Conversões WhatsApp: captura valor e nome do pacote via
    // atributos data-* no botão/link, funcionando mesmo com valores
    // dinâmicos (ex: calculadora). Fallback textual antigo (string no
    // href tipo "1.290") removido — não é confiável se o texto mudar.
    //
    // Uso esperado no HTML do botão/link:
    //   <a href="https://wa.me/55..." data-package="Pocket Session" data-value="1290">
    // ou, para valores 100% dinâmicos (calculadora):
    //   <a href="..." class="whatsapp-cta" data-package="Orçamento Personalizado" data-value="3450.00">
    // O botão deve ter esses data-* atualizados via JS sempre que o
    // valor calculado mudar (ex: no evento 'input'/'change' da calculadora).
    document.addEventListener('click', function(e) {
        var link = e.target.closest ? e.target.closest('a[href*="wa.me"]') : null;
        if (!link) return;

        var packageName = link.getAttribute('data-package');
        var rawValue = link.getAttribute('data-value');
        var value = rawValue !== null ? parseFloat(rawValue) : null;

        // Sem data-attribute presente: não inventamos "Consulta Geral"
        // nem valor 0 — gravamos null e fica claro na análise que essa
        // informação não estava disponível na origem, não que o valor
        // real fosse zero.
        sendData('con_conversion_events', {
            session_id: visitId,
            package_name: packageName || null,
            estimated_value: (value !== null && !isNaN(value)) ? value : null
        });
    }, true);

})();
