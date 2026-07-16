// Injected into mail.google.com. Detects compose windows, adds a Track
// toggle, and — if tracking is on — embeds a tracking pixel + rewrites
// links into the compose body BEFORE Gmail actually sends the message.
//
// Gmail has no API to hook into its send action, and its DOM is
// unversioned/obfuscated and changes without notice — this uses the same
// technique real tools (Mailtrack, HubSpot's own extension, Streak) use:
// intercept the Send button click in the capture phase, do the async work
// needed (mint a tracking id, mutate the compose body), then re-dispatch
// the click so Gmail's own handler fires normally on the now-modified DOM.
//
// The selectors below (data-tooltip/aria-label/name attributes) were
// chosen because they're accessibility-related, not styling-related, so
// they tend to be the most stable part of Gmail's DOM — but "tends to be"
// is not "guaranteed." If tracking silently stops working after a Gmail
// update, this file — specifically findSendButton/extractComposeInfo — is
// where to look first.

const trackingEnabledByCompose = new WeakMap()
const sendInProgress = new WeakSet()
const attachedComposeEls = new WeakSet()

let cachedBaseUrl = null

function sendMessage(action, payload = {}) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ action, ...payload }, (response) => {
      resolve(response || { ok: false, error: 'No response' })
    })
  })
}

async function getBaseUrl() {
  if (cachedBaseUrl) return cachedBaseUrl
  const res = await sendMessage('getConfig')
  cachedBaseUrl = res.ok ? res.data.baseUrl : null
  return cachedBaseUrl
}

function base64UrlEncode(str) {
  return btoa(unescape(encodeURIComponent(str)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

// --- Finding compose windows --------------------------------------------

function findComposeBodies() {
  return Array.from(document.querySelectorAll('div[aria-label="Message Body"], div[g_editable="true"][role="textbox"]'))
}

function findComposeContainer(bodyEl) {
  return bodyEl.closest('[role="dialog"]') || bodyEl.closest('table[role="presentation"]')?.closest('div') || bodyEl.parentElement
}

function findSendButton(composeEl) {
  return composeEl.querySelector('[data-tooltip^="Send"], div[role="button"][aria-label^="Send"], div[role="button"][aria-label^="Send "]')
}

function extractRecipientEmail(composeEl) {
  // Recipient chips carry a real `email` attribute in Gmail's compose
  // header regardless of display name — first one found in the To/Cc/Bcc
  // row is used as the tracked recipient (matches the rest of the app's
  // existing "one contact per thread" simplification, see lib/gmail-fetch.ts).
  const chip = composeEl.querySelector('[email]')
  return chip?.getAttribute('email') || null
}

function extractSubject(composeEl) {
  return composeEl.querySelector('input[name="subjectbox"]')?.value || ''
}

// --- Tracking toggle badge ------------------------------------------------

function injectToggleBadge(composeEl) {
  if (composeEl.querySelector('.gravhub-track-badge')) return
  const badge = document.createElement('div')
  badge.className = 'gravhub-track-badge gravhub-track-on'
  badge.textContent = '● Tracking on'
  badge.title = 'Click to toggle open/click tracking for this email'
  badge.addEventListener('click', (e) => {
    e.preventDefault()
    e.stopPropagation()
    const next = !trackingEnabledByCompose.get(composeEl)
    trackingEnabledByCompose.set(composeEl, next)
    badge.textContent = next ? '● Tracking on' : '○ Tracking off'
    badge.classList.toggle('gravhub-track-on', next)
    badge.classList.toggle('gravhub-track-off', !next)
  })

  // Positioned as a small floating pill rather than integrated into
  // Gmail's own toolbar icon row — that row is the most obfuscated,
  // frequently-changing part of the compose DOM, and getting an inserted
  // element to actually stay laid out correctly there is far more fragile
  // than a self-contained absolutely-positioned badge.
  composeEl.style.position = composeEl.style.position || 'relative'
  composeEl.appendChild(badge)
}

// --- Pixel + link injection ------------------------------------------------

async function injectTracking(bodyEl, trackedEmailId, baseUrl) {
  const links = bodyEl.querySelectorAll('a[href]')
  links.forEach((a) => {
    const original = a.getAttribute('href')
    if (!original || original.startsWith(`${baseUrl}/api/track/`)) return
    const token = base64UrlEncode(JSON.stringify({ trackedEmailId, url: original }))
    a.setAttribute('href', `${baseUrl}/api/track/click/ext/${token}`)
  })

  const pixel = document.createElement('img')
  pixel.src = `${baseUrl}/api/track/open/${trackedEmailId}`
  pixel.width = 1
  pixel.height = 1
  pixel.alt = ''
  pixel.style.cssText = 'display:none !important;width:1px;height:1px;border:0;'
  bodyEl.appendChild(pixel)
}

// --- Send interception ------------------------------------------------

function attachSendInterceptor(composeEl, bodyEl) {
  composeEl.addEventListener(
    'click',
    async (e) => {
      const sendBtn = e.target.closest('[data-tooltip^="Send"], div[role="button"][aria-label^="Send"]')
      if (!sendBtn || !composeEl.contains(sendBtn)) return
      if (sendInProgress.has(composeEl)) return // this is our own re-dispatched click — let it through
      if (trackingEnabledByCompose.get(composeEl) === false) return // user turned tracking off for this email

      e.preventDefault()
      e.stopImmediatePropagation()

      try {
        const baseUrl = await getBaseUrl()
        const recipientEmail = extractRecipientEmail(composeEl)
        if (baseUrl && recipientEmail) {
          const subject = extractSubject(composeEl)
          const result = await sendMessage('trackSend', { recipientEmail, subject })
          if (result.ok) {
            await injectTracking(bodyEl, result.data.trackedEmailId, baseUrl)
          } else {
            console.warn('[GravHub Tracking] track-send failed, sending untracked:', result.error)
          }
        }
      } catch (err) {
        console.warn('[GravHub Tracking] failed to prepare tracking, sending untracked:', err)
      }

      sendInProgress.add(composeEl)
      sendBtn.click()
      setTimeout(() => sendInProgress.delete(composeEl), 3000)
    },
    true, // capture phase — must run before Gmail's own send handler
  )
}

// --- Wiring up new compose windows as they appear -----------------------

function attachToCompose(bodyEl) {
  const composeEl = findComposeContainer(bodyEl)
  if (!composeEl || attachedComposeEls.has(composeEl)) return
  attachedComposeEls.add(composeEl)
  trackingEnabledByCompose.set(composeEl, true)

  injectToggleBadge(composeEl)
  attachSendInterceptor(composeEl, bodyEl)
}

function scan() {
  for (const bodyEl of findComposeBodies()) attachToCompose(bodyEl)
}

const observer = new MutationObserver(() => scan())
observer.observe(document.body, { childList: true, subtree: true })
scan()
