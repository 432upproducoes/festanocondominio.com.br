<!-- Tracking de Visitas e Conversões - Versão Estável Mínima -->
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
    var durationSent = false;

    function sendData(table, payload, isExit) {
        var url = SUPABASE_URL + '/rest/v1/' + table;
        var dataStr = JSON.stringify(payload);

        if (isExit && navigator.sendBeacon) {
            navigator.sendBeacon(url, new Blob([dataStr], { type: 'application/json' }));
            return;
        }

        fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': SUPABASE_KEY,
                'Authorization': 'Bearer ' + SUPABASE_KEY
            },
            body: dataStr,
            keepalive: !!isExit
        }).catch(function(){});
    }

    var src = {
        source: 'direct',
        medium: 'none',
        campaign: 'none',
        referrer: document.referrer || 'direct'
    };

    // Registro Inicial
    sendData('con_sessions', {
        id: visitId,
        city: 'Bragança Paulista',
        region: 'SP',
        is_bot: false,
        source: src.source,
        medium: src.medium,
        campaign: src.campaign,
        referrer: src.referrer,
        device: /Mobi|Android|iPhone/i.test(navigator.userAgent) ? 'mobile' : 'desktop',
        page_path: window.location.pathname,
        duration_seconds: 0
    }, false);

    // Duração Final
    function recordFinalDuration() {
        if (durationSent) return;
        durationSent = true;
        var finalSeconds = Math.max(1, Math.round((Date.now() - startTime) / 1000));

        sendData('con_sessions', {
            id: visitId + '_end',
            city: 'Bragança Paulista',
            region: 'SP',
            is_bot: false,
            source: src.source,
            medium: src.medium,
            campaign: src.campaign,
            referrer: src.referrer,
            device: /Mobi|Android|iPhone/i.test(navigator.userAgent) ? 'mobile' : 'desktop',
            page_path: window.location.pathname,
            duration_seconds: finalSeconds
        }, true);
    }

    window.addEventListener('pagehide', recordFinalDuration);
    document.addEventListener('visibilitychange', function() {
        if (document.visibilityState === 'hidden') recordFinalDuration();
    });

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
        }, false);
    }, true);

})();