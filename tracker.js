<!-- Tracking de Visitas e Conversões - Versão com Detecção de SO/Navegador/UTMs/Termos -->
;(function() {
    'use strict';

    function isBot() {
        var ua = (navigator.userAgent || '').toLowerCase();
        return /bot|crawler|spider|slurp|googlebot|bingbot|headless|lighthouse|pagespeed/.test(ua);
    }
    if (isBot()) return;
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

    // Identificação Precisa de SO e Navegador
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

    // Identificação de Origem, UTMs e Termos de Busca
    var query = window.location.search || '';
    var ref = document.referrer || '';
    var utmSource = 'Acesso Direto';
    var utmCampaign = 'Geral / Orgânico';
    var utmTerm = 'Geral / Sem Termo';

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
        city: 'Bragança Paulista',
        region: 'SP',
        is_bot: false,
        source: utmSource,
        medium: utmTerm,
        campaign: utmCampaign,
        referrer: ref || 'direct',
        device: detectDeviceDetails(),
        page_path: window.location.pathname,
        duration_seconds: 0
    };

    // Registro Inicial
    sendData('con_sessions', baseData);

    // Heartbeat: Atualiza o tempo a cada 5s
    setInterval(function() {
        var elapsed = Math.round((Date.now() - startTime) / 1000);
        baseData.duration_seconds = elapsed;
        sendData('con_sessions', baseData);
    }, 5000);

    // Rastreio de Rolagem por Seções
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

    // Conversões WhatsApp
    document.addEventListener('click', function(e) {
        var link = e.target.closest ? e.target.closest('a[href*="wa.me"]') : null;
        if (!link) return;

        var href = (link.getAttribute('href') || '').toLowerCase();
        var packageName = 'Consulta Geral';
        var value = 0;

        if (href.indexOf('1.290') > -1 || href.indexOf('pocket') > -1) {
            packageName = 'Pocket Session';
            value = 1290;
        } else if (href.indexOf('1.990') > -1 || href.indexOf('estate') > -1) {
            packageName = 'Estate Session';
            value = 1990;
        }

        sendData('con_conversion_events', {
            session_id: visitId,
            package_name: packageName,
            estimated_value: value
        });
    }, true);

})();
