(function() {
    'use strict';

    // ⚙️ SUPABASE CONFIGURATION
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
            // Silent error handling
        }
    }

    // Runs immediately without blocking on external APIs
    function trackSession() {
        if (isBot()) return;

        const sessionId = getSessionId();
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

        // Attach WhatsApp conversion click listeners
        document.querySelectorAll('a[href*="wa.me"]').forEach(button => {
            button.addEventListener('click', () => {
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

                sendToSupabase('con_conversion_events', {
                    session_id: sessionId,
                    package_name: packageName,
                    estimated_value: estimatedValue
                });
            });
        });
    }

    if (document.readyState === 'complete' || document.readyState === 'interactive') {
        trackSession();
    } else {
        document.addEventListener('DOMContentLoaded', trackSession);
    }
})();
