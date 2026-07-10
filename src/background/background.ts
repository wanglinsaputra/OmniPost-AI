

import type { JobProgress, JobStage } from '../utils/types'
function getContentScriptPath(platform: 'ai' | 'social'): string | undefined {
  try {
    const manifest = chrome.runtime.getManifest() as Record<string, unknown>
    const scripts = (manifest.content_scripts as Array<{ js?: string[] }>) ?? []
    const idx = platform === 'ai' ? 0 : 1
    return scripts[idx]?.js?.[0]
  } catch { return undefined }
}
async function setProgress(stage: JobStage, message: string, extra?: Partial<JobProgress>): Promise<void> {
  // console.log('[BG] progress:', stage, message)
  const progress: JobProgress = {
    stage,
    message,
    updatedAt: Date.now(),
    ...extra,
  }
  await chrome.storage.local.set({ jobProgress: progress })
}

async function clearProgress(): Promise<void> {
  await chrome.storage.local.remove('jobProgress')
}
const AI_URLS = [
  { host: 'chatgpt.com', url: 'https://chatgpt.com/?temporary-chat=true' },
  { host: 'gemini.google.com', url: 'https://gemini.google.com' },
  { host: 'claude.ai', url: 'https://claude.ai/new?incognito=true' },
] as const

const SOCIAL_URLS: Record<string, string> = {
  threads: 'https://www.threads.com',
  facebook: 'https://www.facebook.com',
  x: 'https://x.com',
}

async function ensureTab(url: string, host: string): Promise<number> {
  // console.log('[BG] ensureTab:', url, 'host:', host)
  const tabs = await chrome.tabs.query({})
  const existing = tabs.find(t => t.url?.includes(host) && t.id)
  // console.log('[BG] existing tab:', existing?.id, existing?.url)
  if (existing && existing.id) {
    const tabId = existing.id
    await chrome.tabs.update(tabId, { active: true })
    const loadPromise = new Promise<void>((resolve) => {
      chrome.tabs.onUpdated.addListener(function listener(tabId_, info) {
        if (tabId_ === tabId && info.status === 'complete') {
          chrome.tabs.onUpdated.removeListener(listener)
          // console.log('[BG] tab navigated:', tabId)
          resolve()
        }
      })
    })
    await chrome.tabs.update(tabId, { url })
    await loadPromise
    return tabId
  }

  const tab = await chrome.tabs.create({ url, active: true })
// console.log('[BG] new tab id:', tab.id, 'waiting for load...')
  await new Promise<void>(resolve => {
    chrome.tabs.onUpdated.addListener(function listener(tabId, info) {
      if (tabId === tab.id && info.status === 'complete') {
        // console.log('[BG] tab loaded:', tabId)
        chrome.tabs.onUpdated.removeListener(listener)
        resolve()
      }
    })
  })
  return tab.id!
}

function sendToTab<T>(tabId: number, message: unknown, retries = 5): Promise<T> {
  return new Promise((resolve, reject) => {
    chrome.tabs.sendMessage(tabId, message, (response) => {
      if (chrome.runtime.lastError) {
        // console.log(`[BG] sendToTab error (retries left: ${retries}):`, chrome.runtime.lastError.message)
        if (retries > 0) {
          setTimeout(() => {
            sendToTab<T>(tabId, message, retries - 1).then(resolve).catch(reject)
          }, 1500)
        } else {
          reject(new Error(chrome.runtime.lastError.message))
        }
      } else if (response?.error) {
        // console.log('[BG] sendToTab response error:', response.error)
        reject(new Error(response.error))
      } else {
        // console.log('[BG] sendToTab success')
        resolve(response as T)
      }
    })
  })
}
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (sender.id !== chrome.runtime.id) return
  // ── Non-action messages pass through ──
  if (message.type === 'GET_PROGRESS' || message.type === 'CLEAR_PROGRESS') {
    if (message.type === 'GET_PROGRESS') {
      chrome.storage.local.get('jobProgress').then(res => sendResponse(res.jobProgress ?? null))
    } else {
      clearProgress().then(() => sendResponse({ success: true }))
    }
    return true
  }

  switch (message.type) {
      case 'GENERATE_POST':
        handleGeneratePost(message.prompt, message.aiModel, message.targetPlatform)
          .then(sendResponse)
          .catch((err) => sendResponse({ error: err.message }))
        break

      case 'EXECUTE_POST':
        handlePostNow(message.platform, message.content)
          .then(sendResponse)
          .catch((err) => sendResponse({ error: err.message }))
        break

      case 'SCHEDULE_POST':
        handlePostNow(message.platform, message.content, message.time)
          .then(sendResponse)
          .catch((err) => sendResponse({ error: err.message }))
        break

      case 'GENERATE_AND_POST':
        handleGenerateAndPost(message.prompt, message.platform, message.aiModel, message.paragraphCount)
          .then(sendResponse)
          .catch((err) => sendResponse({ error: err.message }))
        break

      case 'GENERATE_AND_SCHEDULE':
        handleGenerateAndSchedule(message.prompt, message.platform, message.aiModel, message.time, message.paragraphCount)
          .then(sendResponse)
          .catch((err) => sendResponse({ error: err.message }))
        break

      default:
        sendResponse({ error: `Unknown message type: ${message.type}` })
    }
    return true
  })
const AI_MODEL_MAP: Record<string, typeof AI_URLS[number]> = {
  chatgpt: AI_URLS[0],
  gemini: AI_URLS[1],
  claude: AI_URLS[2],
}

async function handleGeneratePost(prompt: string, aiModel = 'chatgpt', targetPlatform?: string, paragraphCount = 3): Promise<{ content: string }> {
  // console.log('[BG] handleGeneratePost start:', { prompt, aiModel, targetPlatform, paragraphCount })
  await setProgress('opening_ai_tab', `Opening ${aiModel} tab...`)
  const aiEntry = AI_MODEL_MAP[aiModel] ?? AI_URLS[0]
  const tabId = await ensureTab(aiEntry.url, aiEntry.host)
  await setProgress('ai_generating', `Injecting prompt into ${aiModel}...`)
  // console.log('[BG] waiting 1s for content script...')
  await new Promise(r => setTimeout(r, 1000))
  const aiScriptPath = getContentScriptPath('ai')
  if (aiScriptPath) {
    try {
      await chrome.scripting.executeScript({ target: { tabId }, files: [aiScriptPath] })
      // console.log('[BG] AI content script injected:', aiScriptPath)
      await new Promise(r => setTimeout(r, 500))
    } catch (err) {
      // console.log('[BG] AI injection error:', err)
    }
  }

  try {
    // console.log('[BG] sending AI_GENERATE to tab:', tabId)
    const result = await sendToTab<{ content: string }>(tabId, {
      type: 'AI_GENERATE',
      prompt,
      targetPlatform,
      paragraphCount,
    })
    // console.log('[BG] AI response received:', result?.content?.slice(0, 100))
    await setProgress('ai_done', 'AI generation complete', { content: result.content })
    return result
  } catch (err) {
    await setProgress('error', `AI generation failed: ${(err as Error).message}`, { error: (err as Error).message })
    throw err
  }
}
async function handlePostNow(
  platform: string,
  content: string,
  scheduleTime?: number
): Promise<{ success: boolean }> {
  // console.log('[BG] handlePostNow start:', { platform, content: content?.slice(0, 100), scheduleTime })
  await setProgress('opening_social_tab', `Opening ${platform} tab...`)
  const socialUrl = SOCIAL_URLS[platform]
  if (!socialUrl) throw new Error(`Unknown platform: ${platform}`)

  const tabId = await ensureTab(socialUrl, platform)
  await setProgress('social_posting', `Posting to ${platform}...`)
  // console.log('[BG] waiting 1.5s then injecting content script...')
  await new Promise(r => setTimeout(r, 1500))
  const socialScriptPath = getContentScriptPath('social')
  if (socialScriptPath) {
    try {
      await chrome.scripting.executeScript({ target: { tabId }, files: [socialScriptPath] })
      // console.log('[BG] social content script injected:', socialScriptPath)
      await new Promise(r => setTimeout(r, 500))
    } catch (err) {
      // console.log('[BG] social injection error:', err)
    }
  }

  try {
    // console.log('[BG] sending SOCIAL_POST to tab:', tabId)
    await sendToTab(tabId, {
      type: 'SOCIAL_POST',
      platform,
      content,
      scheduleTime,
    })
    // console.log('[BG] social post success')
    await setProgress('done', `Posted to ${platform} successfully!`)
    return { success: true }
  } catch (err) {
    await setProgress('error', `Post failed: ${(err as Error).message}`, { error: (err as Error).message })
    throw err
  }
}
async function handleGenerateAndPost(
  prompt: string,
  platform: string,
  aiModel = 'chatgpt',
  paragraphCount = 3
): Promise<{ success: boolean }> {
  // console.log('[BG] handleGenerateAndPost:', { prompt: prompt.slice(0, 80), platform, aiModel, paragraphCount })
  const { content } = await handleGeneratePost(prompt, aiModel, platform, paragraphCount)
  // console.log('[BG] generate done, now posting content length:', content.length)
  await handlePostNow(platform, content)
  // console.log('[BG] pipeline complete')
  return { success: true }
}
async function handleGenerateAndSchedule(
  prompt: string,
  platform: string,
  aiModel = 'chatgpt',
  scheduleTime: number,
  paragraphCount = 3
): Promise<{ success: boolean }> {
  // console.log('[BG] handleGenerateAndSchedule:', { prompt: prompt.slice(0, 80), platform, aiModel, scheduleTime, paragraphCount })
  const { content } = await handleGeneratePost(prompt, aiModel, platform, paragraphCount)
  // console.log('[BG] generate done, now scheduling content length:', content.length)
  await handlePostNow(platform, content, scheduleTime)
  // console.log('[BG] schedule pipeline complete')
  return { success: true }
}
chrome.alarms.onAlarm.addListener(async (alarm) => {
  const key = `scheduled_${alarm.name}`
  const stored = await chrome.storage.local.get(key)
  const data = stored[key] as { content: string; platform: string } | undefined
  if (!data) return

  try {
    await handlePostNow(data.platform, data.content)
  } catch (err) {
    // console.error('Scheduled post failed:', err)
  }

  await chrome.storage.local.remove(key)
})
