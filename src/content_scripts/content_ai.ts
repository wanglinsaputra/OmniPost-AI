

import { SELECTORS } from '../utils/selectors'
type AIPlatform = 'chatgpt' | 'gemini' | 'claude'

function detectPlatform(): AIPlatform | null {
  const host = window.location.hostname
  // console.log('[content_ai] detectPlatform -> host:', host)
  if (host.includes('chatgpt.com')) return 'chatgpt'
  if (host.includes('gemini.google.com')) return 'gemini'
  if (host.includes('claude.ai')) return 'claude'
  // console.log('[content_ai] unknown platform')
  return null
}
function waitForElement(selector: string, timeout = 15000): Promise<Element> {
  return new Promise((resolve, reject) => {
    const el = document.querySelector(selector)
    if (el) return resolve(el)

    const observer = new MutationObserver(() => {
      const found = document.querySelector(selector)
      if (found) {
        observer.disconnect()
        resolve(found)
      }
    })

    observer.observe(document.body, { childList: true, subtree: true })

    setTimeout(() => {
      observer.disconnect()
      reject(new Error(`Timeout waiting for: ${selector}`))
    }, timeout)
  })
}
function waitForElementGone(selector: string, timeout = 60000): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!document.querySelector(selector)) return resolve()

    const observer = new MutationObserver(() => {
      if (!document.querySelector(selector)) {
        observer.disconnect()
        resolve()
      }
    })

    observer.observe(document.body, { childList: true, subtree: true })

    setTimeout(() => {
      observer.disconnect()
      reject(new Error(`Timeout: element still present: ${selector}`))
    }, timeout)
  })
}
function setInputValue(element: Element, text: string): void {
  if (element instanceof HTMLTextAreaElement || element instanceof HTMLInputElement) {
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
      window.HTMLTextAreaElement.prototype, 'value'
    )?.set
    nativeInputValueSetter?.call(element, text)
    element.dispatchEvent(new Event('input', { bubbles: true }))
    element.dispatchEvent(new Event('change', { bubbles: true }))
  } else {
    element.textContent = text
    element.dispatchEvent(new InputEvent('input', { bubbles: true, cancelable: true }))
    element.dispatchEvent(new Event('change', { bubbles: true }))
  }
}
function safeClick(el: Element | null): boolean {
  if (!el) return false
  if (el instanceof HTMLElement) el.click()
  else {
    const ev = new MouseEvent('click', { bubbles: true, cancelable: true })
    el.dispatchEvent(ev)
  }
  return true
}
async function handleChatGPT(prompt: string): Promise<string> {
  // console.log('[content_ai] handleChatGPT start, prompt:', prompt.slice(0, 80))
  const tempToggle = document.querySelector(SELECTORS.chatgpt.tempChatToggle)
  // console.log('[content_ai] temp toggle found:', !!tempToggle)
  if (tempToggle) safeClick(tempToggle)
  // console.log('[content_ai] waiting for input...')
  const input = await waitForElement(SELECTORS.chatgpt.input)
  // console.log('[content_ai] input found, typing prompt')
  setInputValue(input, prompt)
  await new Promise(r => setTimeout(r, 500))
  const sendBtn = document.querySelector(SELECTORS.chatgpt.sendButton) as HTMLButtonElement | null
  // console.log('[content_ai] send button:', sendBtn)
  if (!sendBtn) throw new Error('ChatGPT: send button not found')
  if ('disabled' in sendBtn && (sendBtn as HTMLButtonElement).disabled) {
    // console.log('[content_ai] send disabled, waiting 1s')
    await new Promise(r => setTimeout(r, 1000))
  }
  // console.log('[content_ai] clicking send')
  safeClick(sendBtn)
  // console.log('[content_ai] waiting for stop button...')
  await waitForElement(SELECTORS.chatgpt.stopButton)
  // console.log('[content_ai] stop appeared, waiting for it to disappear...')
  await waitForElementGone(SELECTORS.chatgpt.stopButton)
  // console.log('[content_ai] stop gone, generation done')

  await new Promise(r => setTimeout(r, 1000))
  // console.log('[content_ai] extracting response')
  const responseEl = document.querySelector(SELECTORS.chatgpt.assistantText)
  // console.log('[content_ai] response el:', responseEl)
  if (!responseEl) throw new Error('ChatGPT: no response found')
  const text = responseEl.textContent?.trim() ?? ''
  const cleaned = text
    .replace(/^(Berikut|Here( is|'s)|Ini|Tentu|Tentu saja|Of course|Sure|Absolutely|Saya buatkan|Saya tuliskan).*?\n/i, '')
    .replace(/\n*(Jika|Jika ingin|Anda bisa|Feel free|Let me know|Semoga).*$/is, '')
    .replace(/^Edit\s*\n*/gm, '')
    .trim()
  // console.log('[content_ai] response text:', cleaned.slice(0, 150))
  return cleaned
}
async function handleGemini(prompt: string): Promise<string> {
  // console.log('[content_ai] handleGemini start, prompt:', prompt.slice(0, 80))

  const tempToggle = document.querySelector(SELECTORS.gemini.tempChatToggle)
  // console.log('[content_ai] gemini temp toggle found:', !!tempToggle)
  if (tempToggle) {
    safeClick(tempToggle)
    await new Promise(r => setTimeout(r, 2000))
  }
  let input: Element
  try {
    input = await waitForElement(SELECTORS.gemini.input)
  } catch {
    input = await waitForElement(SELECTORS.gemini.inputFallback)
  }
  // console.log('[content_ai] input found, typing')
  setInputValue(input, prompt)
  await new Promise(r => setTimeout(r, 500))
  let sendBtn = document.querySelector(SELECTORS.gemini.sendButton) as HTMLElement | null
  if (!sendBtn) {
    sendBtn = Array.from(document.querySelectorAll('button')).find(
      b => b.textContent?.toLowerCase().includes('send') || b.textContent?.toLowerCase().includes('kirim')
    ) as HTMLElement | null
  }
  // console.log('[content_ai] gemini send button:', sendBtn)
  if (!sendBtn) throw new Error('Gemini: send button not found')
  // console.log('[content_ai] clicking gemini send')
  safeClick(sendBtn)
  // console.log('[content_ai] waiting for gemini stop button')
  let stopBtn: Element | null = document.querySelector(SELECTORS.gemini.stopButton)
  if (!stopBtn) {
    stopBtn = Array.from(document.querySelectorAll('button')).find(
      b => b.textContent?.toLowerCase().includes('stop')
    ) ?? null
  }
  if (stopBtn) {
    // console.log('[content_ai] waiting for gemini stop to disappear')
    await waitForElementGone(SELECTORS.gemini.stopButton, 120000)
  } else {
    // console.log('[content_ai] no stop btn found, waiting 15s')
    await new Promise(r => setTimeout(r, 15000))
  }
  await new Promise(r => setTimeout(r, 2000))
  // console.log('[content_ai] extracting gemini response')
  let responseEl = document.querySelector(SELECTORS.gemini.modelMessage)
  if (!responseEl) responseEl = document.querySelector(SELECTORS.gemini.responseText)
  if (!responseEl) {
    responseEl = document.querySelector('message-content .markdown')
  }
  // console.log('[content_ai] gemini response el:', responseEl)
  if (!responseEl) return ''

  const text = responseEl.textContent?.trim() ?? ''
  const cleaned = text
    .replace(/^(Berikut|Here( is|'s)|Ini|Tentu|Tentu saja|Of course|Sure|Absolutely|Saya buatkan|Saya tuliskan).*?\n/i, '')
    .replace(/\n*(Jika|Jika ingin|Anda bisa|Feel free|Let me know|Semoga).*$/is, '')
    .replace(/^Edit\s*\n*/gm, '')
    .trim()
  // console.log('[content_ai] gemini response text:', cleaned.slice(0, 150))
  return cleaned
}
async function handleClaude(prompt: string): Promise<string> {
  // console.log('[content_ai] handleClaude start, prompt:', prompt.slice(0, 80))

  let input: Element
  try {
    input = await waitForElement(SELECTORS.claude.input, 15000)
  } catch {
    input = await waitForElement('textarea, [role="textbox"]', 15000)
  }
  // console.log('[content_ai] claude input found, typing')
  setInputValue(input, prompt)
  await new Promise(r => setTimeout(r, 500))

  let sendBtn = document.querySelector(SELECTORS.claude.sendButton) as HTMLElement | null
  if (!sendBtn) {
    sendBtn = Array.from(document.querySelectorAll('button')).find(
      b => (b.getAttribute('aria-label')?.toLowerCase().includes('send') || b.textContent?.toLowerCase().includes('send'))
    ) as HTMLElement | null
  }
  // console.log('[content_ai] claude send button:', sendBtn)
  if (!sendBtn) throw new Error('Claude: send button not found')
  if (sendBtn instanceof HTMLButtonElement && sendBtn.disabled) {
    await new Promise(r => setTimeout(r, 1000))
  }
  safeClick(sendBtn)

  // console.log('[content_ai] waiting for claude stop button...')
  let stopBtn = document.querySelector(SELECTORS.claude.stopButton)
  if (!stopBtn) {
    stopBtn = Array.from(document.querySelectorAll('button')).find(
      b => b.textContent?.toLowerCase().includes('stop')
    ) ?? null
  }
  if (stopBtn) {
    await waitForElementGone(SELECTORS.claude.stopButton, 120000)
  } else {
    // console.log('[content_ai] no stop btn, waiting 15s')
    await new Promise(r => setTimeout(r, 15000))
  }
  await new Promise(r => setTimeout(r, 2000))

  // console.log('[content_ai] extracting claude response')
  const article = document.querySelector(SELECTORS.claude.assistantMessage)
  if (!article) throw new Error('Claude: no response found')
  const paragraphs = Array.from(article.querySelectorAll('p'))
  const text = paragraphs.map(p => p.textContent?.trim() ?? '').filter(Boolean).join('\n')
  const cleaned = text
    .replace(/^(Berikut|Here( is|'s)|Ini|Tentu|Tentu saja|Of course|Sure|Absolutely|Saya buatkan|Saya tuliskan).*?\n/i, '')
    .replace(/\n*(Jika|Jika ingin|Anda bisa|Feel free|Let me know|Semoga).*$/is, '')
    .replace(/^Edit\s*\n*/gm, '')
    .trim()
  // console.log('[content_ai] claude response text:', cleaned.slice(0, 150))
  return cleaned
}
function buildThreadsPrompt(paragraphCount: number): string {
  if (paragraphCount <= 1) return 'Output ONLY the post content. No greetings, no introductions, no explanations, no offers for alternative versions. Write a single short engaging paragraph. Topic:'
  const parts: string[] = ['Output ONLY the post content. No greetings, no introductions, no explanations, no offers for alternative versions.']
  parts.push(`Write exactly ${paragraphCount} short engaging paragraphs.`)
  for (let i = 2; i <= paragraphCount; i++) {
    parts.push(`Add ---PARAGRAF ${i}---- before paragraph ${i}.`)
  }
  parts.push('Each paragraph must be self-contained and thread-friendly. Topic:')
  return parts.join(' ')
}

function buildXPrompt(paragraphCount: number): string {
  const parts: string[] = ['Output ONLY the post content. No greetings, no introductions, no explanations, no offers for alternative versions.']
  parts.push('Write a single tweet. The ENTIRE tweet MUST be under 280 characters. Topic:')
  return parts.join(' ')
}

const PLATFORM_PROMPTS: Record<string, (count: number) => string> = {
  threads: (count) => buildThreadsPrompt(count),
  x: (count) => buildXPrompt(count),
  facebook: () => 'Output ONLY the post content. No greetings, no introductions, no explanations, no offers for alternative versions. Write a single engaging Facebook post with a catchy hook and conversational tone. Topic:',
}

function buildPrompt(userPrompt: string, targetPlatform?: string, paragraphCount = 3): string {
  const builder = targetPlatform && PLATFORM_PROMPTS[targetPlatform]
  if (builder) return builder(paragraphCount) + ' ' + userPrompt
  return userPrompt
}
async function ensureTempChat(): Promise<void> {
  // console.log('[content_ai] temp chat enabled via URL')
  await new Promise(r => setTimeout(r, 1000))
}
async function ensureNewChat(): Promise<void> {
  const newBtnSelectors = [
    SELECTORS.gemini.newChatButton,
    'a[aria-label*="Percakapan baru" i]',
    'a[aria-label*="New chat" i]',
    'a[aria-label*="Chat baru" i]',
  ]
  for (const sel of newBtnSelectors) {
    const btns = document.querySelectorAll(sel)
    for (const btn of Array.from(btns)) {
      safeClick(btn)
      await new Promise(r => setTimeout(r, 2000))
      return
    }
  }
  const addBtn = document.querySelector('button:has(svg[aria-label*="New" i])') ||
    document.querySelector('button:has(svg[aria-label*="Add" i])')
  if (addBtn) safeClick(addBtn)
}
async function handleGenerate(prompt: string, targetPlatform?: string, paragraphCount = 3): Promise<{ content: string }> {
  // console.log('[content_ai] handleGenerate:', { prompt: prompt.slice(0, 80), targetPlatform, paragraphCount })
  const platform = detectPlatform()
  // console.log('[content_ai] platform detected:', platform)
  if (!platform) throw new Error('Unknown AI platform')
  // console.log('[content_ai] ensuring new/temp chat...')
  if (platform === 'chatgpt') {
    await ensureTempChat()
  } else {
    await ensureNewChat()
  }
  await new Promise(r => setTimeout(r, 1000))
  const finalPrompt = buildPrompt(prompt, targetPlatform, paragraphCount)
  // console.log('[content_ai] final prompt:', finalPrompt.slice(0, 120))

  // console.log('[content_ai] calling handle', platform)
  const content = platform === 'chatgpt'
    ? await handleChatGPT(finalPrompt)
    : platform === 'claude'
    ? await handleClaude(finalPrompt)
    : await handleGemini(finalPrompt)

  return { content }
}
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (sender.id !== chrome.runtime.id) return
  if (message.type === 'AI_GENERATE') {
    // console.log('[content_ai] starting handleGenerate')
    handleGenerate(message.prompt, message.targetPlatform, message.paragraphCount)
      .then(res => {
        // console.log('[content_ai] success, sending response')
        sendResponse(res)
      })
      .catch(err => {
        // console.log('[content_ai] error:', err.message)
        sendResponse({ error: err.message })
      })
    return true
  }
})
