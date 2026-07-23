(function() {
    'use strict';

    // ⚙️ SUPABASE CONFIGURATION (URL direta, sem passar pelo Worker do 432up.com)
    const SUPABASE_URL = "https://paetkspbfejtjjkngqej.supabase.co";
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

    async function sendToSupabase(table, data) {
        try {
            const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
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
            if (!res.ok) {
                const errText = await res.text().catch(() => '');
                console.warn('[tracker] Falha ao gravar em', table, res.status, errText);
            }
        } catch (err) {
            console.warn('[tracker] Erro de rede ao gravar em', table, err);
        }
    }

    let sessionId; // preenchido em trackSession()

    function packageFromHref(href) {
        const h = (href || '').toLowerCase();
        if (h.includes('1.290') || h.includes('pocket')) {
            return { packageName: 'Pocket Session', estimatedValue: 1290.00 };
        }
        if (h.includes('1.990') || h.includes('estate')) {
            return { packageName: 'Estate Session', estimatedValue: 1990.00 };
        }
        return { packageName: 'Consulta Geral', estimatedValue: 0.00 };
    }

    // Listener delegado: funciona mesmo se os botões wa.me forem
    // renderizados/inseridos na página DEPOIS do tracker.js carregar.
    function attachDelegatedClickTracking() {
        document.addEventListener('click', function(event) {
            const link = event.target.closest('a[href*="wa.me"]');
            if (!link) return;

            const href = link.getAttribute('href') || '';
            const { packageName, estimatedValue } = packageFromHref(href);

            sendToSupabase('con_conversion_events', {
                session_id: sessionId,
                package_name: packageName,
                estimated_value: estimatedValue
            });
        }, true); // captura na fase de captura, dispara antes de qualquer navegação
    }

    // Runs immediately without blocking on external APIs
    function trackSession() {
        if (isBot()) return;

        sessionId = getSessionId();
        const sourceInfo = getSourceInfo();

        const sessionPayload = {
            id: sessionId,
            city: 'Bragança Paulista', // Default location fallback
            region: 'SP',
            is_bot: false,
            source: sourceInfo.source,
            medium: sourceInfo.medium,
            campaign: sourceInfo.campaign,
            referrer: sourceInfo.referrer,
            device: /Mobi|Android|iPhone/i.test(navigator.userAgent) ? 'mobile' : 'desktop',
            browser: navigator.userAgent,
            page_path: window.location.pathname
        };

        // Send session payload immediately
        sendToSupabase('con_sessions', sessionPayload);

        // Optional non-blocking GeoIP check with 1-second timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 1000);

        fetch('https://ipapi.co/json/', { signal: controller.signal })
            .then(res => res.ok ? res.json() : null)
            .then(data => {
                clearTimeout(timeoutId);
                if (data && data.city) {
                    // Update session location if resolved
                    sendToSupabase('con_sessions', {
                        id: sessionId,
                        city: data.city,
                        region: data.region || 'SP',
                        ip_address: data.ip || ''
                    });
                }
            })
            .catch(() => {});

        // Attach WhatsApp conversion click listener (delegado, cobre botões futuros também)
        attachDelegatedClickTracking();
    }

    if (document.readyState === 'complete' || document.readyState === 'interactive') {
        trackSession();
    } else {
        document.addEventListener('DOMContentLoaded', trackSession);
    }
})();
