/* global chrome, document, window, URL */
const forgeUrl = document.querySelector('#forgeUrl')
const note = document.querySelector('#note')
const page = document.querySelector('#page')
let activeTab

chrome.storage.sync.get(
  { forgeUrl: 'https://forge.christianfoster.dev' },
  ({ forgeUrl: storedUrl }) => {
    forgeUrl.value = storedUrl
  },
)
chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
  activeTab = tab
  page.textContent = tab?.title || tab?.url || 'No browser page detected'
})
document.querySelector('#open').addEventListener('click', async () => {
  const baseUrl = forgeUrl.value.trim().replace(/\/$/, '')
  if (!baseUrl) return forgeUrl.focus()
  await chrome.storage.sync.set({ forgeUrl: baseUrl })
  const url = new URL(`${baseUrl}/time-tracker`)
  if (activeTab?.url) url.searchParams.set('pageUrl', activeTab.url)
  if (activeTab?.title) url.searchParams.set('pageTitle', activeTab.title)
  if (note.value.trim()) url.searchParams.set('note', note.value.trim())
  chrome.tabs.create({ url: url.toString() })
  window.close()
})
