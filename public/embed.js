(function () {
  var script = document.currentScript;
  if (!script) return;

  var slug = script.getAttribute('data-form');
  if (!slug) return;

  var trigger = script.getAttribute('data-trigger') || 'button';
  var delay = parseInt(script.getAttribute('data-delay') || '5', 10);
  var position = script.getAttribute('data-position') || 'center';
  var animation = script.getAttribute('data-animation') || 'fade';
  var overlay = script.getAttribute('data-overlay') !== 'false';
  var color = script.getAttribute('data-color') || '#015035';
  var buttonText = script.getAttribute('data-button-text') || 'Contact Us';
  var scrollPct = parseInt(script.getAttribute('data-scroll') || '50', 10);
  var origin = script.src.replace(/\/embed\.js.*$/, '');
  var cookieKey = 'ghf_dismiss_' + slug;
  var shown = false;

  function getCookie(name) {
    var m = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
    return m ? m[1] : null;
  }

  function setCookie(name, val, hours) {
    var d = new Date();
    d.setTime(d.getTime() + hours * 3600000);
    document.cookie = name + '=' + val + ';path=/;expires=' + d.toUTCString() + ';SameSite=Lax';
  }

  if (getCookie(cookieKey)) return;

  var wrapper = document.createElement('div');
  wrapper.id = 'ghf-popup-' + slug;
  wrapper.style.cssText = 'display:none;position:fixed;z-index:2147483647;top:0;left:0;width:100%;height:100%;';

  var backdropEl = null;
  if (overlay) {
    backdropEl = document.createElement('div');
    backdropEl.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);';
    backdropEl.addEventListener('click', dismiss);
    wrapper.appendChild(backdropEl);
  }

  var posStyles = {
    center: 'position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:90%;max-width:520px;max-height:90vh;',
    'bottom-right': 'position:absolute;bottom:16px;right:16px;width:400px;max-width:calc(100% - 32px);max-height:80vh;',
    'bottom-left': 'position:absolute;bottom:16px;left:16px;width:400px;max-width:calc(100% - 32px);max-height:80vh;',
  };

  var container = document.createElement('div');
  container.style.cssText = (posStyles[position] || posStyles.center) +
    'background:#fff;border-radius:16px;box-shadow:0 25px 50px rgba(0,0,0,0.25);overflow:hidden;display:flex;flex-direction:column;';

  if (animation === 'fade') {
    container.style.opacity = '0';
    container.style.transition = 'opacity 0.3s ease';
  } else if (animation === 'slide-up') {
    container.style.opacity = '0';
    container.style.transform = (position === 'center' ? 'translate(-50%,-50%) ' : '') + 'translateY(30px)';
    container.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
  }

  var closeBtn = document.createElement('button');
  closeBtn.innerHTML = '&times;';
  closeBtn.style.cssText = 'position:absolute;top:8px;right:8px;z-index:10;width:32px;height:32px;border-radius:50%;border:none;background:rgba(0,0,0,0.08);color:#333;font-size:20px;line-height:1;cursor:pointer;display:flex;align-items:center;justify-content:center;';
  closeBtn.addEventListener('click', dismiss);
  container.appendChild(closeBtn);

  var iframe = document.createElement('iframe');
  iframe.src = origin + '/f/' + slug + '?embed=1';
  iframe.style.cssText = 'width:100%;border:none;flex:1;min-height:400px;border-radius:0 0 16px 16px;';
  iframe.setAttribute('title', 'Form');
  container.appendChild(iframe);

  wrapper.appendChild(container);
  document.body.appendChild(wrapper);

  if (trigger === 'button') {
    var btn = document.createElement('button');
    btn.textContent = buttonText;
    btn.style.cssText = 'position:fixed;z-index:2147483646;bottom:20px;right:20px;padding:12px 24px;border-radius:50px;border:none;color:#fff;font-size:14px;font-weight:600;cursor:pointer;box-shadow:0 4px 12px rgba(0,0,0,0.15);font-family:system-ui,-apple-system,sans-serif;background:' + color + ';';
    btn.addEventListener('click', function () {
      btn.style.display = 'none';
      showPopup();
    });
    document.body.appendChild(btn);
    wrapper._triggerBtn = btn;
  }

  function showPopup() {
    if (shown) return;
    if (getCookie(cookieKey)) return;
    shown = true;
    wrapper.style.display = 'block';
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        container.style.opacity = '1';
        if (animation === 'slide-up') {
          container.style.transform = (position === 'center' ? 'translate(-50%,-50%)' : 'translateY(0)');
        }
      });
    });
  }

  function dismiss() {
    wrapper.style.display = 'none';
    setCookie(cookieKey, '1', 24);
    shown = false;
    if (wrapper._triggerBtn) {
      wrapper._triggerBtn.style.display = 'none';
    }
  }

  if (trigger === 'delay') {
    setTimeout(showPopup, delay * 1000);
  } else if (trigger === 'exit-intent') {
    document.addEventListener('mouseout', function handler(e) {
      if (e.clientY < 5 && !shown) {
        showPopup();
        document.removeEventListener('mouseout', handler);
      }
    });
  } else if (trigger === 'scroll') {
    window.addEventListener('scroll', function handler() {
      var scrollTop = window.pageYOffset || document.documentElement.scrollTop;
      var docHeight = document.documentElement.scrollHeight - document.documentElement.clientHeight;
      if (docHeight > 0 && (scrollTop / docHeight) * 100 >= scrollPct) {
        showPopup();
        window.removeEventListener('scroll', handler);
      }
    });
  }

  window.addEventListener('message', function (e) {
    if (e.source !== iframe.contentWindow) return;
    if (e.data && e.data.type === 'gravhub:resize' && typeof e.data.height === 'number') {
      iframe.style.height = Math.min(e.data.height + 20, window.innerHeight * 0.8) + 'px';
    }
    if (e.data && e.data.type === 'gravhub:submitted') {
      setTimeout(dismiss, 2500);
    }
  });
})();
