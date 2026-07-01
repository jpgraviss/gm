(function() {
  'use strict';
  var ENDPOINT = '__GI_ENDPOINT__';
  var SITE_ID = '__GI_SITE_ID__';

  // Visitor ID management
  function getVisitorId() {
    var id = null;
    try { id = localStorage.getItem('_gi_vid'); } catch(e) {}
    if (!id) {
      id = 'gi_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 12);
      try { localStorage.setItem('_gi_vid', id); } catch(e) {}
    }
    return id;
  }

  // Session management
  function getSessionId() {
    var sid = null;
    try { sid = sessionStorage.getItem('_gi_sid'); } catch(e) {}
    if (!sid) {
      sid = 'gs_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 8);
      try { sessionStorage.setItem('_gi_sid', sid); } catch(e) {}
    }
    return sid;
  }

  var visitorId = getVisitorId();
  var sessionId = getSessionId();
  var pageStart = Date.now();
  var maxScroll = 0;

  // Parse UTM params
  function getUtmParams() {
    var params = {};
    var search = window.location.search;
    ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'].forEach(function(key) {
      var match = search.match(new RegExp('[?&]' + key + '=([^&]*)'));
      if (match) params[key] = decodeURIComponent(match[1]);
    });
    return params;
  }

  // Check for email identification token
  function checkEmailToken() {
    var match = window.location.search.match(/[?&]_gi_eid=([^&]*)/);
    if (match) {
      var email = decodeURIComponent(match[1]);
      try { localStorage.setItem('_gi_email', email); } catch(e) {}
      return email;
    }
    try { return localStorage.getItem('_gi_email'); } catch(e) { return null; }
  }

  function send(eventType, extra) {
    var email = checkEmailToken();
    var payload = {
      siteId: SITE_ID,
      visitorId: visitorId,
      sessionId: sessionId,
      eventType: eventType,
      url: window.location.href,
      path: window.location.pathname,
      title: document.title,
      referrer: document.referrer || null,
      utm: getUtmParams(),
      timestamp: new Date().toISOString(),
      screen: { w: screen.width, h: screen.height },
      language: navigator.language,
    };
    if (email) payload.identifiedEmail = email;
    if (extra) {
      for (var k in extra) { if (extra.hasOwnProperty(k)) payload[k] = extra[k]; }
    }

    if (navigator.sendBeacon) {
      navigator.sendBeacon(ENDPOINT, JSON.stringify(payload));
    } else {
      var xhr = new XMLHttpRequest();
      xhr.open('POST', ENDPOINT, true);
      xhr.setRequestHeader('Content-Type', 'application/json');
      xhr.send(JSON.stringify(payload));
    }
  }

  // Track page view
  send('page_view');

  // Track scroll depth
  var scrollTimer = null;
  window.addEventListener('scroll', function() {
    clearTimeout(scrollTimer);
    scrollTimer = setTimeout(function() {
      var scrollTop = window.pageYOffset || document.documentElement.scrollTop;
      var docHeight = Math.max(document.body.scrollHeight, document.documentElement.scrollHeight) - window.innerHeight;
      var pct = docHeight > 0 ? Math.round((scrollTop / docHeight) * 100) : 0;
      if (pct > maxScroll) maxScroll = pct;
    }, 100);
  });

  // Track time on page + scroll on unload
  window.addEventListener('beforeunload', function() {
    send('page_leave', {
      timeOnPage: Math.round((Date.now() - pageStart) / 1000),
      scrollDepth: maxScroll,
    });
  });

  // Track outbound link clicks
  document.addEventListener('click', function(e) {
    var el = e.target;
    while (el && el.tagName !== 'A') el = el.parentElement;
    if (!el || !el.href) return;
    try {
      var linkHost = new URL(el.href).hostname;
      if (linkHost !== window.location.hostname) {
        send('outbound_click', { targetUrl: el.href });
      }
    } catch(err) {}
  });

  // Track form submissions
  document.addEventListener('submit', function(e) {
    var form = e.target;
    var data = {};
    try {
      var formData = new FormData(form);
      formData.forEach(function(val, key) {
        var k = key.toLowerCase();
        if (k.includes('email')) {
          data.formEmail = val;
          try { localStorage.setItem('_gi_email', val); } catch(ex) {}
        }
        if (k.includes('name') && !k.includes('last') && !k.includes('company')) data.formName = val;
        if (k.includes('phone') || k.includes('tel')) data.formPhone = val;
        if (k.includes('company') || k.includes('organization')) data.formCompany = val;
      });
    } catch(err) {}
    send('form_submit', { formAction: form.action || window.location.href, formData: data });
  });

  // Expose identify function for manual identification
  window.GravIntel = {
    identify: function(email, meta) {
      try { localStorage.setItem('_gi_email', email); } catch(e) {}
      send('identify', { identifiedEmail: email, identifyMeta: meta || {} });
    },
    track: function(eventName, properties) {
      send('custom', { customEvent: eventName, customProperties: properties || {} });
    },
  };
})();
