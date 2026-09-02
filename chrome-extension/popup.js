/* global chrome, document, window, URL, fetch */
const forgeUrl = document.querySelector('#forgeUrl')
const note = document.querySelector('#note')
const page = document.querySelector('#page')
const pairingCode = document.querySelector('#pairingCode')
const connect = document.querySelector('#connect')
const timer = document.querySelector('#timer')
const status = document.querySelector('#status')
const elapsed = document.querySelector('#elapsed')
const stop = document.querySelector('#stop')
const syncUrl = 'https://lqgdtmrhlfcqeigqxajk.supabase.co/functions/v1/time-tracker-sync'
let activeTab
let ticker = null

chrome.storage.sync.get(
  { forgeUrl: 'https://forge.christianfoster.dev', pairingCode: '' },
  ({ forgeUrl: storedUrl, pairingCode: storedCode }) => {
    forgeUrl.value = storedUrl
    pairingCode.value = storedCode
    if (storedCode) void refreshTimer()
  },
)
chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
  activeTab = tab
  page.textContent = tab?.title || tab?.url || 'No browser page detected'
})
const formatDuration = (seconds) => {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const remainder = seconds % 60
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`
}
const request = async (action) => {
  const token = pairingCode.value.trim()
  if (!token) throw new Error('Paste the pairing code from Forge first.')
  const response = await fetch(syncUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, action }),
  })
  const result = await response.json()
  if (!response.ok) throw new Error(result.error || 'Could not sync the timer.')
  return result
}
const renderTimer = (active) => {
  if (ticker) window.clearInterval(ticker)
  ticker = null
  timer.hidden = !active
  if (!active) return
  status.textContent = active.description || 'Shared Forge timer is running'
  const tick = () => {
    const seconds = Math.max(
      0,
      Math.floor((Date.now() - new Date(active.started_at).getTime()) / 1000),
    )
    elapsed.textContent = formatDuration(seconds)
  }
  tick()
  ticker = window.setInterval(tick, 1000)
}
async function refreshTimer() {
  connect.disabled = true
  connect.textContent = 'Syncing…'
  try {
    const result = await request('get')
    await chrome.storage.sync.set({ pairingCode: pairingCode.value.trim() })
    renderTimer(result.active)
    connect.textContent = result.active ? 'Timer synced' : 'Connected to Forge'
  } catch (error) {
    timer.hidden = true
    connect.textContent = error.message
  } finally {
    connect.disabled = false
  }
}
connect.addEventListener('click', () => void refreshTimer())
stop.addEventListener('click', async () => {
  stop.disabled = true
  try {
    await request('stop')
    renderTimer(null)
    connect.textContent = 'Timer stopped and saved'
  } catch (error) {
    connect.textContent = error.message
  } finally {
    stop.disabled = false
  }
})
document.querySelector('#open').addEventListener('click', async () => {
  const baseUrl = forgeUrl.value.trim().replace(/\/$/, '')
  if (!baseUrl) return forgeUrl.focus()
  await chrome.storage.sync.set({ forgeUrl: baseUrl, pairingCode: pairingCode.value.trim() })
  const url = new URL(`${baseUrl}/time-tracker`)
  if (activeTab?.url) url.searchParams.set('pageUrl', activeTab.url)
  if (activeTab?.title) url.searchParams.set('pageTitle', activeTab.title)
  if (note.value.trim()) url.searchParams.set('note', note.value.trim())
  chrome.tabs.create({ url: url.toString() })
  window.close()
})
