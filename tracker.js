(function() {
    'use strict';

    // ⚙️ CONFIGURAÇÃO DO SUPABASE
    const SUPABASE_URL = "https://www.432up.com/supabase-api";
    const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBhZXRrc3BiZmVqdGpqa25ncWVqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA5MDU2OTgsImV4cCI6MjA4NjQ4MTY5OH0.IiYweZ2g3bP7b0o7VvBW5LLb6d1oHtSNFUZlVkIsdsA";

    function isBot() {
        const userAgent = navigator.userAgent.toLowerCase();
        const botKeywords = ['bot', 'crawler', 'spider', 'slurp', 'googlebot', 'bingbot', 'facebookexternalhit', 'headlesschrome', 'lighthouse'];
        return botKeywords.some(keyword => userAgent.includes(keyword)) || !navigator.languages || navigator.languages.length === 0 || !!window.navigator.webdriver;
    }

    function getSessionId() {
        let sid = sessionStorage.getItem('con_session_id');
        if (!sid) {
            sid = 'con_' + Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
            sessionStorage.setItem('con_session_id', sid);
        }
        return sid;
    }

    function getSourceInfo() {
        const urlParams = new URLSearchParams(window.location.search);
        return {
            source: urlParams.get('utm_source') || 'direct',
            medium: urlParams.get('utm_medium') || 'none',
            campaign: urlParams.get('utm_campaign') || 'none',
            referrer: document.referrer || 'direct'
        };
    }

    // Geolocalização ultrarrápida com fallback seguro (Timeout de 1.2s)
    async function getGeoLocation() {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 1200);

        try {
            const res = await fetch('https://ipapi.co/json/', { signal: controller.signal });
            clearTimeout(timeoutId);
            if (res.ok) {
                const data = await res.json();
                return { city: data.city || 'Desconhecido', region: data.region || 'Desconhecido', ip: data.ip || '' };
            }
        } catch (e) {
            // Ignora erro de timeout ou adblock
        }
        return { city: 'Desconhecido', region: 'Desconhecido', ip: '' };
    }

    async function sendToSupabase(table, data) {
        try {
            await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'apikey': SUPABASE_ANON_KEY,
                    'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                    'Prefer': 'return=minimal'
                },
                body: JSON.stringify(data),
                keepalive: true
            });
        } catch (err) {
            console.error('Erro ao enviar dados pro Supabase:', err);
        }
    }

    // Execução Principal
    async function initTracker() {
        if (isBot()) return;

        const sessionId = getSessionId();
        const sourceInfo = getSourceInfo();
        const geo = await getGeoLocation();

        const sessionPayload = {
            id: sessionId,
            ip_address: geo.ip,
            city: geo.city,
            region: geo.region,
            is_bot: false,
            source: sourceInfo.source,
            medium: sourceInfo.medium,
            campaign: sourceInfo.campaign,
            referrer: sourceInfo.referrer,
            device: /Mobi|Android/i.test(navigator.userAgent) ? 'mobile' : 'desktop',
            browser: navigator.userAgent,
            page_path: window.location.pathname
        };

        // Envia a Sessão
        await sendToSupabase('con_sessions', sessionPayload);

        // Captura Cliques nos Botões do WhatsApp
        document.querySelectorAll('a[href*="wa.me"]').forEach(button => {
            button.addEventListener('click', (e) => {
                const href = button.getAttribute('href') || '';
                let packageName = 'Consulta Geral';
                let estimatedValue = 0.00;

                if (href.includes('1.290') || href.toLowerCase().includes('pocket')) {
                    packageName = 'Pocket Session';
                    estimatedValue = 1290.00;
                } else if (href.includes('1.990') || href.toLowerCase().includes('estate')) {
                    packageName = 'Estate Session';
                    estimatedValue = 1990.00;
                }

                // Envia a conversão assincronamente sem travar a abertura da aba
                sendToSupabase('con_conversion_events', {
                    session_id: sessionId,
                    package_name: packageName,
                    estimated_value: estimatedValue
                });
            });
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initTracker);
    } else {
        initTracker();
    }
})();
