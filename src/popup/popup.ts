import type { AppStorage, JobStage } from '../utils/types'

const $ = (sel: string): HTMLElement | null => document.querySelector(sel)

async function getFromStorage<T extends keyof AppStorage>(key: T): Promise<AppStorage[T]> {
  const res = await chrome.storage.local.get(key)
  return res[key] as AppStorage[T]
}

async function setToStorage<T extends keyof AppStorage>(key: T, value: AppStorage[T]): Promise<void> {
  await chrome.storage.local.set({ [key]: value })
}

function show(view: 'dashboard' | 'settings'): void {
  const dash = $('#dashboard')
  const settings = $('#settings-panel')
  if (dash) dash.classList.toggle('hidden', view !== 'dashboard')
  if (settings) settings.classList.toggle('hidden', view !== 'settings')
}
const STAGE_PCT: Record<JobStage, number> = {
  idle: 0,
  opening_ai_tab: 10,
  ai_generating: 30,
  ai_done: 60,
  opening_social_tab: 70,
  social_posting: 85,
  done: 100,
  error: 100,
}

function renderProgress(stage: JobStage, message: string): void {
  const container = $('#progress-container')
  const label = $('#progress-label')
  const pct = $('#progress-pct')
  const fill = $('#progress-fill') as HTMLElement | null
  const msg = $('#progress-msg')
  if (!container || !fill) return

  container.classList.remove('hidden')
  const width = STAGE_PCT[stage] ?? 0
  fill.style.width = `${width}%`
  if (pct) pct.textContent = `${width}%`
  if (label) {
    label.textContent = stage === 'error' ? 'Failed' : stage === 'done' ? 'Complete' : 'Processing...'
    label.classList.toggle('text-red-600', stage === 'error')
    label.classList.toggle('text-emerald-600', stage === 'done')
    label.classList.toggle('text-gray-700', stage !== 'error' && stage !== 'done')
  }
  if (msg) msg.textContent = message
}

function hideProgress(): void {
  $('#progress-container')?.classList.add('hidden')
}

async function pollProgress(): Promise<void> {
  try {
    const progress = await chrome.runtime.sendMessage({ type: 'GET_PROGRESS' })
    // console.log('[popup] pollProgress:', progress)
    if (!progress) {
      hideProgress()
      return
    }
    renderProgress(progress.stage, progress.message)
    if (progress.stage !== 'done' && progress.stage !== 'error') {
      setTimeout(pollProgress, 1500)
    }
  } catch {
    hideProgress()
  }
}

async function doGenerateAndPost(
  action: 'post' | 'schedule',
  scheduleTime?: number
): Promise<void> {
  const prompt = ($('#prompt-input') as HTMLTextAreaElement | null)?.value.trim()
  // console.log('[popup] doGenerateAndPost:', { action, prompt, scheduleTime })
  if (!prompt) return

  const aiModel = ($('#ai-select') as HTMLSelectElement | null)?.value ?? 'chatgpt'
  const platform = ($('#platform-select') as HTMLSelectElement | null)?.value ?? 'threads'
  const paragraphCount = parseInt(($('#paragraph-count') as HTMLSelectElement | null)?.value ?? '3')
  const statusEl = $('#status-msg')
  const postBtn = $('#post-btn') as HTMLButtonElement | null
  const scheduleBtn = $('#schedule-btn') as HTMLButtonElement | null
  if (postBtn) postBtn.disabled = true
  if (scheduleBtn) scheduleBtn.disabled = true
  await chrome.runtime.sendMessage({ type: 'CLEAR_PROGRESS' }).catch(() => {})
  pollProgress()

  try {
    if (action === 'post') {
      // console.log('[popup] sending GENERATE_AND_POST')
      if (statusEl) statusEl.textContent = 'Generating & posting...'
      const res = await chrome.runtime.sendMessage({
        type: 'GENERATE_AND_POST',
        prompt,
        aiModel,
        platform,
        paragraphCount,
      })
      // console.log('[popup] GENERATE_AND_POST response:', res)
      if (res.error) throw new Error(res.error)
      if (statusEl) statusEl.textContent = 'Posted successfully!'
    } else if (action === 'schedule' && scheduleTime) {
      // console.log('[popup] sending GENERATE_AND_SCHEDULE')
      if (statusEl) statusEl.textContent = 'Generating & scheduling...'
      const res = await chrome.runtime.sendMessage({
        type: 'GENERATE_AND_SCHEDULE',
        prompt,
        aiModel,
        platform,
        time: scheduleTime,
        paragraphCount,
      })
      // console.log('[popup] GENERATE_AND_SCHEDULE response:', res)
      if (res.error) throw new Error(res.error)
      if (statusEl) statusEl.textContent = `Scheduled for ${new Date(scheduleTime).toLocaleString()}`
    }
  } catch (err) {
    // console.log('[popup] error:', err)
    if (statusEl) statusEl.textContent = `Failed: ${(err as Error).message}`
  } finally {
    if (postBtn) postBtn.disabled = false
    if (scheduleBtn) scheduleBtn.disabled = false
  }
}

async function init(): Promise<void> {
  pollProgress()
  setupDashboard()
}

async function setupDashboard(): Promise<void> {
  show('dashboard')

  $('#post-btn')?.addEventListener('click', () => doGenerateAndPost('post'))
  $('#schedule-btn')?.addEventListener('click', () => {
    $('#schedule-card')?.classList.remove('hidden')
  })
  $('#schedule-cancel-btn')?.addEventListener('click', () => {
    $('#schedule-card')?.classList.add('hidden')
  })
  $('#schedule-confirm-btn')?.addEventListener('click', async () => {
    const dtInput = $('#schedule-datetime') as HTMLInputElement | null
    if (!dtInput?.value) return
    const time = new Date(dtInput.value).getTime()
    if (time <= Date.now()) {
      const msg = $('#schedule-msg')
      if (msg) {
        msg.textContent = 'Pick a future date/time.'
        msg.classList.remove('hidden')
      }
      return
    }
    await doGenerateAndPost('schedule', time)
    $('#schedule-card')?.classList.add('hidden')
  })
  const platformSel = $('#platform-select') as HTMLSelectElement | null
  const paragWrapper = $('#paragraph-count-wrapper')
  const scheduleBtn = $('#schedule-btn')
  const scheduleCard = $('#schedule-card')
  function togglePlatformUI(): void {
    const val = platformSel?.value
    const hasMultiPost = val === 'threads'
    const hasSchedule = val === 'threads'
    if (paragWrapper) paragWrapper.classList.toggle('hidden', !hasMultiPost)
    if (scheduleBtn) scheduleBtn.classList.toggle('hidden', !hasSchedule)
    if (scheduleCard) scheduleCard.classList.add('hidden')
  }
  togglePlatformUI()
  platformSel?.addEventListener('change', togglePlatformUI)
  const savedCount = await getFromStorage('threadParagraphCount')
  const paragSelect = $('#paragraph-count') as HTMLSelectElement | null
  if (paragSelect && savedCount) paragSelect.value = String(savedCount)
  paragSelect?.addEventListener('change', () => {
    setToStorage('threadParagraphCount', parseInt(paragSelect.value))
  })
  $('#settings-btn')?.addEventListener('click', () => show('settings'))
  $('#settings-back-btn')?.addEventListener('click', () => show('dashboard'))
}

document.addEventListener('DOMContentLoaded', init)
