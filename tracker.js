(function() {
    'use strict';

    // ⚙️ CONFIGURAÇÃO DO SUPABASE
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
            // Falha silenciosa
        }
    }

    // Registrar Conversão de Forma Garantida
    window.registrarConversao = function(packageName, estimatedValue) {
        const sessionId = getSessionId();
        sendToSupabase('con_conversion_events', {
            session_id: sessionId,
            package_name: packageName,
            estimated_value: estimatedValue
        });
    };

    // Execução Principal de Sessão
    function initTracker() {
        if (isBot()) return;

        const sessionId = getSessionId();
        const sourceInfo = getSourceInfo();

        const sessionPayload = {
            id: sessionId,
            city: 'Bragança Paulista',
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

        sendToSupabase('con_sessions', sessionPayload);

        // Delegação de Eventos Global (Garante captura de QUALQUER clique em link do WhatsApp)
        document.addEventListener('click', function(e) {
            const target = e.target.closest('a[href*="wa.me"]');
            if (target) {
                const href = target.getAttribute('href') || '';
                let packageName = 'Consulta Geral';
                let estimatedValue = 0.00;

                if (href.includes('1.290') || href.toLowerCase().includes('pocket')) {
                    packageName = 'Pocket Session';
                    estimatedValue = 1290.00;
                } else if (href.includes('1.990') || href.toLowerCase().includes('estate')) {
                    packageName = 'Estate Session';
                    estimatedValue = 1990.00;
                }

                window.registrarConversao(packageName, estimatedValue);
            }
        }, true);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initTracker);
    } else {
        initTracker();
    }
})();
