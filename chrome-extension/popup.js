/* global chrome, document, window, URL, fetch, Option */
const forgeUrl = document.querySelector('#forgeUrl')
const note = document.querySelector('#note')
const page = document.querySelector('#page')
const pairingCode = document.querySelector('#pairingCode')
const connect = document.querySelector('#connect')
const timer = document.querySelector('#timer')
const project = document.querySelector('#project')
const status = document.querySelector('#status')
const elapsed = document.querySelector('#elapsed')
const startedAt = document.querySelector('#startedAt')
const stop = document.querySelector('#stop')
const projectId = document.querySelector('#projectId')
const start = document.querySelector('#start')
const startControls = document.querySelector('#startControls')
const syncUrl = 'https://lqgdtmrhlfcqeigqxajk.supabase.co/functions/v1/time-tracker-sync'
let activeTab
let ticker = null

chrome.storage.sync.get(
  { forgeUrl: 'https://forge.christianfoster.dev', pairingCode: '', projectId: '' },
  ({ forgeUrl: storedUrl, pairingCode: storedCode, projectId: storedProjectId }) => {
    forgeUrl.value = storedUrl
    pairingCode.value = storedCode
    projectId.dataset.savedValue = storedProjectId
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
const request = async (action, payload = {}) => {
  const token = pairingCode.value.trim()
  if (!token) throw new Error('Paste the pairing code from Forge first.')
  const response = await fetch(syncUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, action, ...payload }),
  })
  const result = await response.json()
  if (!response.ok) throw new Error(result.error || 'Could not sync the timer.')
  return result
}
const renderProjects = (projects) => {
  const current = projectId.value || projectId.dataset.savedValue || ''
  projectId.replaceChildren(new Option('Choose a project', ''))
  projects.forEach((item) => projectId.add(new Option(item.name, item.id)))
  projectId.value = projects.some((item) => item.id === current) ? current : ''
}
const renderTimer = (active) => {
  if (ticker) window.clearInterval(ticker)
  ticker = null
  timer.hidden = !active
  startControls.hidden = Boolean(active)
  if (!active) return
  project.textContent = active.projects?.name || 'Forge project'
  status.textContent = active.description || 'No work note added'
  startedAt.textContent = `Started ${new Date(active.started_at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}`
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
    renderProjects(result.projects || [])
    renderTimer(result.active)
    connect.textContent = result.active ? 'Timer synced' : 'Connected to Forge'
  } catch (error) {
    renderTimer(null)
    connect.textContent = error.message
  } finally {
    connect.disabled = false
  }
}
connect.addEventListener('click', () => void refreshTimer())
start.addEventListener('click', async () => {
  if (!projectId.value) {
    connect.textContent = 'Choose a project first.'
    return
  }
  start.disabled = true
  start.textContent = 'Starting…'
  try {
    const result = await request('start', {
      projectId: projectId.value,
      description: note.value.trim(),
      pageUrl: activeTab?.url,
      pageTitle: activeTab?.title,
    })
    await chrome.storage.sync.set({ projectId: projectId.value })
    renderTimer(result.active)
    connect.textContent = 'Shared timer is running'
  } catch (error) {
    connect.textContent = error.message
  } finally {
    start.disabled = false
    start.textContent = 'Start shared timer'
  }
})
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
  await chrome.storage.sync.set({
    forgeUrl: baseUrl,
    pairingCode: pairingCode.value.trim(),
    projectId: projectId.value,
  })
  const url = new URL(`${baseUrl}/time-tracker`)
  if (activeTab?.url) url.searchParams.set('pageUrl', activeTab.url)
  if (activeTab?.title) url.searchParams.set('pageTitle', activeTab.title)
  if (note.value.trim()) url.searchParams.set('note', note.value.trim())
  chrome.tabs.create({ url: url.toString() })
  window.close()
})
