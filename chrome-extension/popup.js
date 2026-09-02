/* global chrome, document, window, URL, fetch, Option */
const forgeUrl = document.querySelector('#forgeUrl')
const note = document.querySelector('#note')
const activeNote = document.querySelector('#activeNote')
const pairingCode = document.querySelector('#pairingCode')
const connect = document.querySelector('#connect')
const settingsToggle = document.querySelector('#settingsToggle')
const setupPanel = document.querySelector('#setupPanel')
const syncStatus = document.querySelector('#syncStatus')
const timer = document.querySelector('#timer')
const project = document.querySelector('#project')
const elapsed = document.querySelector('#elapsed')
const startedAt = document.querySelector('#startedAt')
const stop = document.querySelector('#stop')
const projectId = document.querySelector('#projectId')
const start = document.querySelector('#start')
const startControls = document.querySelector('#startControls')
const syncUrl = 'https://lqgdtmrhlfcqeigqxajk.supabase.co/functions/v1/time-tracker-sync'
let activeTab
let activeTimer = null
let ticker = null

const showStatus = (message) => {
  syncStatus.textContent = message
}

chrome.storage.sync.get(
  { forgeUrl: 'https://forge.christianfoster.dev', pairingCode: '', projectId: '' },
  ({ forgeUrl: storedUrl, pairingCode: storedCode, projectId: storedProjectId }) => {
    forgeUrl.value = storedUrl
    pairingCode.value = storedCode
    projectId.dataset.savedValue = storedProjectId
    if (storedCode) void refreshTimer()
    else {
      setupPanel.hidden = false
      settingsToggle.setAttribute('aria-expanded', 'true')
      showStatus('Pair this extension with Forge to begin.')
    }
  },
)

chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
  activeTab = tab
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
  activeTimer = active
  timer.hidden = !active
  startControls.hidden = Boolean(active)
  if (!active) return
  project.textContent = active.projects?.name || 'Forge project'
  activeNote.value = active.description || ''
  startedAt.textContent = `Started ${new Date(active.started_at).toLocaleString([], {
    dateStyle: 'medium',
    timeStyle: 'short',
  })}`
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
    showStatus(result.active ? 'Shared timer is running.' : 'Connected to Forge.')
  } catch (error) {
    renderTimer(null)
    showStatus(error.message)
  } finally {
    connect.disabled = false
    connect.textContent = 'Sync with Forge'
  }
}

settingsToggle.addEventListener('click', () => {
  setupPanel.hidden = !setupPanel.hidden
  settingsToggle.setAttribute('aria-expanded', String(!setupPanel.hidden))
})

connect.addEventListener('click', () => void refreshTimer())

start.addEventListener('click', async () => {
  if (!projectId.value) {
    showStatus('Choose a project first.')
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
    showStatus('Shared timer is running.')
  } catch (error) {
    showStatus(error.message)
  } finally {
    start.disabled = false
    start.textContent = 'Start timer'
  }
})

activeNote.addEventListener('change', async () => {
  if (!activeTimer) return
  activeNote.disabled = true
  try {
    const result = await request('update', { description: activeNote.value.trim() })
    renderTimer(result.active)
    showStatus('Work note saved.')
  } catch (error) {
    activeNote.value = activeTimer.description || ''
    showStatus(error.message)
  } finally {
    activeNote.disabled = false
  }
})

stop.addEventListener('click', async () => {
  stop.disabled = true
  stop.textContent = 'Stopping…'
  try {
    await request('stop')
    renderTimer(null)
    showStatus('Timer stopped and saved.')
  } catch (error) {
    showStatus(error.message)
  } finally {
    stop.disabled = false
    stop.textContent = 'Stop timer'
  }
})

document.querySelector('#open').addEventListener('click', async () => {
  const baseUrl = forgeUrl.value.trim().replace(/\/$/, '')
  if (!baseUrl) {
    setupPanel.hidden = false
    settingsToggle.setAttribute('aria-expanded', 'true')
    return forgeUrl.focus()
  }
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
