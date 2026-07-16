const baseUrlInput = document.getElementById('baseUrl')
const tokenInput = document.getElementById('token')
const statusEl = document.getElementById('status')
const saveBtn = document.getElementById('save')

function normalizeBaseUrl(url) {
  return url.trim().replace(/\/+$/, '')
}

chrome.storage.local.get(['baseUrl', 'token'], (data) => {
  if (data.baseUrl) baseUrlInput.value = data.baseUrl
  if (data.token) tokenInput.value = data.token
})

saveBtn.addEventListener('click', async () => {
  const baseUrl = normalizeBaseUrl(baseUrlInput.value)
  const token = tokenInput.value.trim()

  if (!baseUrl || !token) {
    statusEl.textContent = 'Both fields are required.'
    statusEl.className = 'err'
    return
  }

  statusEl.textContent = 'Checking connection…'
  statusEl.className = ''

  try {
    const res = await fetch(`${baseUrl}/api/extension/activity?limit=1`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) {
      statusEl.textContent = res.status === 401
        ? 'That token was rejected — check it was copied in full, or generate a new one from Settings.'
        : `GravHub responded with an error (${res.status}). Double-check the URL.`
      statusEl.className = 'err'
      return
    }
  } catch {
    statusEl.textContent = "Couldn't reach that URL — check it's correct and reachable from this browser."
    statusEl.className = 'err'
    return
  }

  chrome.storage.local.set({ baseUrl, token }, () => {
    statusEl.textContent = 'Connected. You can close this tab.'
    statusEl.className = 'ok'
    chrome.runtime.sendMessage({ action: 'configUpdated' })
  })
})
