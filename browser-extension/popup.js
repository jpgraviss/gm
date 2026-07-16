const feedEl = document.getElementById('feed')
const disconnectedEl = document.getElementById('disconnected')
const emptyEl = document.getElementById('empty')

function sendMessage(action, payload = {}) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({ action, ...payload }, (response) => {
      if (!response) return reject(new Error('No response from background worker'))
      if (!response.ok) return reject(new Error(response.error || 'Request failed'))
      resolve(response.data)
    })
  })
}

function initials(name) {
  return (name || '?')
    .split(/\s+/)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase())
    .join('') || '?'
}

function timeAgo(iso) {
  const diffMs = Date.now() - new Date(iso).getTime()
  const mins = Math.round(diffMs / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.round(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.round(hrs / 24)
  return `${days}d ago`
}

function isToday(iso) {
  const d = new Date(iso)
  const now = new Date()
  return d.toDateString() === now.toDateString()
}

function isYesterday(iso) {
  const d = new Date(iso)
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  return d.toDateString() === yesterday.toDateString()
}

function renderItem(item) {
  const who = item.recipientName || item.recipientEmail
  const lastEventAt = [item.lastClickedAt, item.lastOpenedAt, item.sentAt].filter(Boolean)
    .sort((a, b) => new Date(b) - new Date(a))[0]
  const isPriority = item.clickCount > 0 || item.openCount > 1

  const actionText = item.clickCount > 0
    ? `Clicked a link in <span class="subject">${escapeHtml(item.subject)}</span>`
    : item.openCount > 0
      ? `Opened <span class="subject">${escapeHtml(item.subject)}</span>`
      : `Sent <span class="subject">${escapeHtml(item.subject)}</span>`

  const meta = item.openCount > 0
    ? `${item.openCount} open${item.openCount === 1 ? '' : 's'}${item.clickCount > 0 ? ` · ${item.clickCount} click${item.clickCount === 1 ? '' : 's'}` : ''}`
    : 'Not opened yet'

  const div = document.createElement('div')
  div.className = `item${isPriority ? ' priority' : ''}`
  div.innerHTML = `
    <div class="avatar">${initials(who)}</div>
    <div class="item-body">
      <div class="item-name">${escapeHtml(who)}</div>
      <div class="item-action">${actionText}</div>
      <div class="item-meta">${meta}</div>
    </div>
    <div class="item-time">${timeAgo(lastEventAt)}</div>
  `
  return div
}

function escapeHtml(str) {
  const div = document.createElement('div')
  div.textContent = str || ''
  return div.innerHTML
}

function sectionLabel(text) {
  const div = document.createElement('div')
  div.className = 'section-label'
  div.textContent = text
  return div
}

async function load() {
  feedEl.innerHTML = ''
  emptyEl.hidden = true
  disconnectedEl.hidden = true

  const config = await sendMessage('getConfig').catch(() => ({ connected: false }))
  if (!config.connected) {
    disconnectedEl.hidden = false
    return
  }

  let activity
  try {
    activity = await sendMessage('getActivity', { limit: 50 })
  } catch (err) {
    emptyEl.hidden = false
    emptyEl.querySelector('p').textContent = err.message
    return
  }

  if (!activity || activity.length === 0) {
    emptyEl.hidden = false
    return
  }

  const priority = []
  const today = []
  const yesterday = []
  const older = []

  for (const item of activity) {
    const engagedAt = item.lastClickedAt || item.lastOpenedAt
    const isPriority = item.clickCount > 0 || item.openCount > 1
    if (isPriority) priority.push(item)
    else if (engagedAt && isToday(engagedAt)) today.push(item)
    else if (engagedAt && isYesterday(engagedAt)) yesterday.push(item)
    else if (engagedAt) older.push(item)
  }

  const sections = [
    ['Priority', priority],
    ['Today', today],
    ['Yesterday', yesterday],
    ['Earlier', older],
  ]

  for (const [label, items] of sections) {
    if (items.length === 0) continue
    feedEl.appendChild(sectionLabel(label))
    for (const item of items) feedEl.appendChild(renderItem(item))
  }

  if (feedEl.children.length === 0) {
    emptyEl.hidden = false
  }
}

document.getElementById('refresh').addEventListener('click', load)
document.getElementById('openOptions').addEventListener('click', () => chrome.runtime.openOptionsPage())

load()
