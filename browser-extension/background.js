// Service worker — the only part of this extension that actually talks to
// GravHub's API. Content scripts run in mail.google.com's page context and
// would hit CORS rejections calling a different origin directly; a
// Manifest V3 background service worker with host_permissions is exempt
// from that, so content.js and popup.js both route every backend call
// through here via chrome.runtime.sendMessage rather than fetching
// directly.

const POLL_ALARM = 'gravhub-poll-activity'

async function getConfig() {
  const { baseUrl, token } = await chrome.storage.local.get(['baseUrl', 'token'])
  return { baseUrl, token }
}

async function gravhubFetch(path, options = {}) {
  const { baseUrl, token } = await getConfig()
  if (!baseUrl || !token) {
    throw new Error('Not connected — open the extension options and enter your GravHub URL and token.')
  }
  const res = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      ...(options.headers || {}),
      Authorization: `Bearer ${token}`,
    },
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error || `Request failed (${res.status})`)
  }
  return res.json()
}

async function trackSend(recipientEmail, subject) {
  return gravhubFetch('/api/extension/track-send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ recipientEmail, subject }),
  })
}

async function getActivity(limit = 50) {
  return gravhubFetch(`/api/extension/activity?limit=${limit}`)
}

async function lookupContact(email) {
  return gravhubFetch(`/api/extension/contact-lookup?email=${encodeURIComponent(email)}`)
}

// --- Polling for new engagement → desktop notifications ---------------

async function pollForEngagement() {
  const { baseUrl, token } = await getConfig()
  if (!baseUrl || !token) return

  let activity
  try {
    activity = await getActivity(50)
  } catch {
    return // not connected yet, or GravHub temporarily unreachable — just skip this tick
  }

  const { lastSeenEngagementAt } = await chrome.storage.local.get(['lastSeenEngagementAt'])
  const since = lastSeenEngagementAt ? new Date(lastSeenEngagementAt) : null
  let newestSeen = since

  for (const item of activity) {
    const events = [
      item.lastOpenedAt ? { at: item.lastOpenedAt, verb: 'opened' } : null,
      item.lastClickedAt ? { at: item.lastClickedAt, verb: 'clicked a link in' } : null,
    ].filter(Boolean)

    for (const event of events) {
      const eventDate = new Date(event.at)
      if (!since || eventDate > since) {
        const who = item.recipientName || item.recipientEmail
        chrome.notifications.create(`gravhub-${item.id}-${event.verb}`, {
          type: 'basic',
          iconUrl: 'icons/icon128.png',
          title: 'Email engagement',
          message: `${who} ${event.verb} "${item.subject}"`,
        })
      }
      if (!newestSeen || eventDate > newestSeen) newestSeen = eventDate
    }
  }

  if (newestSeen && (!since || newestSeen > since)) {
    await chrome.storage.local.set({ lastSeenEngagementAt: newestSeen.toISOString() })
  }
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create(POLL_ALARM, { periodInMinutes: 1 })
})

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === POLL_ALARM) pollForEngagement()
})

// --- Message bridge for content.js / popup.js --------------------------

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  (async () => {
    try {
      switch (message.action) {
        case 'trackSend': {
          const result = await trackSend(message.recipientEmail, message.subject)
          sendResponse({ ok: true, data: result })
          break
        }
        case 'getActivity': {
          const result = await getActivity(message.limit)
          sendResponse({ ok: true, data: result })
          break
        }
        case 'lookupContact': {
          const result = await lookupContact(message.email)
          sendResponse({ ok: true, data: result })
          break
        }
        case 'getConfig': {
          const config = await getConfig()
          sendResponse({ ok: true, data: { connected: !!(config.baseUrl && config.token), baseUrl: config.baseUrl } })
          break
        }
        case 'configUpdated': {
          pollForEngagement()
          sendResponse({ ok: true })
          break
        }
        default:
          sendResponse({ ok: false, error: 'Unknown action' })
      }
    } catch (err) {
      sendResponse({ ok: false, error: err instanceof Error ? err.message : 'Unknown error' })
    }
  })()
  return true // keep the message channel open for the async response
})
