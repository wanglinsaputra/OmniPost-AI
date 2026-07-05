

import { SELECTORS } from '../utils/selectors'
function waitForElement(selector: string, timeout = 10000): Promise<Element> {
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
      reject(new Error(`Timeout: ${selector}`))
    }, timeout)
  })
}

function safeClick(el: Element | null): boolean {
  if (!el) return false
  if (el instanceof HTMLElement) el.click()
  else el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
  return true
}

function setInputValue(element: Element, text: string): void {
  if (element instanceof HTMLTextAreaElement || element instanceof HTMLInputElement) {
    const setter = Object.getOwnPropertyDescriptor(
      window.HTMLTextAreaElement.prototype, 'value'
    )?.set
    setter?.call(element, text)
    element.dispatchEvent(new Event('input', { bubbles: true }))
    element.dispatchEvent(new Event('change', { bubbles: true }))
  } else {
    if (element instanceof HTMLElement) element.focus()
    const sel = window.getSelection()
    if (sel) {
      sel.removeAllRanges()
      const range = document.createRange()
      range.selectNodeContents(element)
      range.collapse(false)
      sel.addRange(range)
    }
    document.execCommand('insertText', false, text)
    element.dispatchEvent(new InputEvent('input', { bubbles: true, cancelable: true }))
  }
}

function findByText(selector: string, text: string): Element | null {
  return Array.from(document.querySelectorAll(selector))
    .find(el => el.textContent?.trim() === text) ?? null
}
async function postToThreads(text: string, scheduleTime?: number): Promise<void> {
  // console.log('[content_social] postToThreads start, text length:', text.length)

  let composeBtn = document.querySelector('button[aria-label="Create"]')
  // console.log('[content_social] Create button:', composeBtn)
  if (!composeBtn) {
    composeBtn = document.querySelector(SELECTORS.threads.composeButton)
    // console.log('[content_social] compose btn (empty field):', composeBtn)
  }
  if (!composeBtn) {
    composeBtn = document.querySelector('a[href="/new"]')
    // console.log('[content_social] new thread fallback btn:', composeBtn)
  }
  if (composeBtn) {
    safeClick(composeBtn)
    // console.log('[content_social] clicked compose')
    await new Promise(r => setTimeout(r, 2000))
  }
  let input: Element
  try {
    input = await waitForElement(SELECTORS.threads.composerInput)
  } catch {
    throw new Error('Threads: contenteditable input not found')
  }
  // console.log('[content_social] contenteditable found:', !!input)

  if (input instanceof HTMLElement) input.focus()
  await new Promise(r => setTimeout(r, 300))
  const parts = text.split(/---\s*paragraf\s*\d+\s*---+|---PARAGRAF\s*\d+----+/i).filter(Boolean)
  // console.log('[content_social] thread parts:', parts.length)

  for (let i = 0; i < parts.length; i++) {
    // console.log('[content_social] typing part', i + 1, '/', parts.length, ':', parts[i].slice(0, 60))

    if (i > 0) {
      await new Promise(r => setTimeout(r, 2000))
      let editors: NodeListOf<Element>
      try {
        await waitForElement(SELECTORS.threads.composerInput, 8000)
      } catch {
        throw new Error('Threads: next editor not found for part ' + (i + 1))
      }
      editors = document.querySelectorAll(SELECTORS.threads.composerInput)
      const newInput = editors[editors.length - 1]
      // console.log('[content_social] editor count:', editors.length, 'using index:', editors.length - 1)
      if (newInput instanceof HTMLElement) newInput.focus()
      await new Promise(r => setTimeout(r, 200))
      setInputValue(newInput, parts[i])
    } else {
      setInputValue(input, parts[i])
    }

    await new Promise(r => setTimeout(r, 500))
    if (i < parts.length - 1) {
      // console.log('[content_social] clicking Add to thread...')
      const addBtn = findByText('div[role="button"]', 'Add to thread')
      // console.log('[content_social] add btn:', addBtn)
      if (addBtn) {
        safeClick(addBtn)
        await new Promise(r => setTimeout(r, 1500))
      } else {
        // console.log('[content_social] Add to thread not found, trying button fallback')
        const addBtn2 = Array.from(document.querySelectorAll('button'))
          .find(b => b.textContent?.trim() === 'Add to thread')
        if (addBtn2) {
          safeClick(addBtn2)
          await new Promise(r => setTimeout(r, 1500))
        } else {
          throw new Error('Add to thread button not found')
        }
      }
    }
  }
  if (scheduleTime) {
    const composerDialog = document.querySelector('[role="dialog"]')
    let moreBtn: Element | null = null
    if (composerDialog) {
      moreBtn = Array.from(composerDialog.querySelectorAll('div[role="button"]'))
        .find(el => el.textContent?.trim() === 'More' && el.offsetParent !== null)
    }
    if (!moreBtn) {
      const allMoreBtns = Array.from(document.querySelectorAll('div[role="button"]'))
        .filter(el => el.textContent?.trim() === 'More' && el.offsetParent !== null)
      moreBtn = allMoreBtns.find(b => {
        const r = b.getBoundingClientRect()
        return r.y > 50 && r.y < 150
      }) || null
    }
    // console.log('[content_social] more btn:', moreBtn)
    if (!moreBtn) throw new Error('Threads: More button not found in composer')
    safeClick(moreBtn)
    await new Promise(r => setTimeout(r, 1500))
    const scheduleOption = findByText('[role="menuitem"]', 'Schedule...') || findByText('span', 'Schedule...') || findByText('div[role="button"]', 'Schedule...')
    // console.log('[content_social] schedule option:', scheduleOption)
    if (!scheduleOption) throw new Error('Threads: Schedule... option not found in menu')
    safeClick(scheduleOption)
    await new Promise(r => setTimeout(r, 1500))

    const dt = new Date(scheduleTime)
    const hourStr = String(dt.getHours()).padStart(2, '0')
    const minStr = String(dt.getMinutes()).padStart(2, '0')
    const targetDateStr = dt.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
    // console.log('[content_social] target date str:', targetDateStr)

    const targetMonth = dt.getMonth()
    const targetYear = dt.getFullYear()
    for (let attempt = 0; attempt < 24; attempt++) {
      const headerEl = document.querySelector(SELECTORS.threads.scheduleMonthHeader)
      if (!headerEl) break
      const headerText = headerEl.textContent?.trim() || ''
      // console.log('[content_social] current month header:', headerText)

      const [mName, yStr] = headerText.split(' ')
      const currentYear = parseInt(yStr, 10)
      const months = ['January','February','March','April','May','June','July','August','September','October','November','December']
      const currentMonth = months.indexOf(mName)

      if (currentYear === targetYear && currentMonth === targetMonth) break

      const btn = document.querySelector(
        currentYear > targetYear || (currentYear === targetYear && currentMonth > targetMonth)
          ? SELECTORS.threads.schedulePrevMonth
          : SELECTORS.threads.scheduleNextMonth
      ) as HTMLElement | null
      if (btn) btn.click()
      await new Promise(r => setTimeout(r, 500))
    }
    const dayCells = document.querySelectorAll(SELECTORS.threads.scheduleDayCell)
    let dayClicked = false
    for (const cell of dayCells) {
      const label = (cell as HTMLElement).getAttribute('aria-label') || cell.textContent?.trim() || ''
      if (label.startsWith(targetDateStr) || label.includes(targetDateStr)) {
        ;(cell as HTMLElement).click()
        dayClicked = true
        // console.log('[content_social] clicked day cell:', label)
        break
      }
    }
    // console.log('[content_social] day clicked:', dayClicked)
    if (!dayClicked) throw new Error('Threads: target date cell not found in calendar')
    await new Promise(r => setTimeout(r, 500))
    const hourInput = document.querySelector(SELECTORS.threads.scheduleHourInput) as HTMLInputElement | null
    if (hourInput) {
      hourInput.focus()
      hourInput.value = hourStr
      hourInput.dispatchEvent(new Event('input', { bubbles: true }))
    }
    const minInput = document.querySelector(SELECTORS.threads.scheduleMinuteInput) as HTMLInputElement | null
    if (minInput) {
      minInput.focus()
      minInput.value = minStr
      minInput.dispatchEvent(new Event('input', { bubbles: true }))
    }

    await new Promise(r => setTimeout(r, 500))
    const doneBtn = findByText('div[role="button"]', 'Done') || findByText('button', 'Done')
    // console.log('[content_social] done btn:', doneBtn)
    if (!doneBtn) throw new Error('Threads: Done button not found in schedule picker')
    safeClick(doneBtn)
    await new Promise(r => setTimeout(r, 1500))
    const allScheduleBtns = Array.from(document.querySelectorAll('div[role="button"]'))
      .filter(el => el.textContent?.trim() === 'Schedule')
    const scheduleBtn = allScheduleBtns.length > 0 ? allScheduleBtns[allScheduleBtns.length - 1] : null
    // console.log('[content_social] schedule btn:', scheduleBtn)
    if (!scheduleBtn) throw new Error('Threads: Schedule button not found after Done')
    safeClick(scheduleBtn)
    await new Promise(r => setTimeout(r, 1500))
  } else {
    // console.log('[content_social] looking for Post button')
    const allPostBtns = Array.from(document.querySelectorAll('div[role="button"]'))
      .filter(el => el.textContent?.trim() === 'Post')
    let postBtn: Element | null = allPostBtns.length > 0 ? allPostBtns[allPostBtns.length - 1] : null
    if (!postBtn) {
      const allBtnPost = Array.from(document.querySelectorAll('button'))
        .filter(el => el.textContent?.trim() === 'Post')
      postBtn = allBtnPost.length > 0 ? allBtnPost[allBtnPost.length - 1] : null
    }
    // console.log('[content_social] post btn:', postBtn, '| text:', postBtn?.textContent?.trim())
    if (postBtn) {
      safeClick(postBtn)
      await new Promise(r => setTimeout(r, 2000))
      // console.log('[content_social] post clicked')
    } else {
      // console.log('[content_social] Post button not found')
      throw new Error('Post button not found')
    }
  }
  // console.log('[content_social] postToThreads done')
}
async function postToFacebook(text: string): Promise<void> {
  // console.log('[content_social] postToFacebook start, text length:', text.length)

  let createBtn = Array.from(document.querySelectorAll(SELECTORS.facebook.createPostButton))
    .find(el => el.textContent?.trim().includes('Apa yang Anda pikirkan'))
  if (!createBtn) {
    createBtn = Array.from(document.querySelectorAll(SELECTORS.facebook.createPostButton))
      .find(el => el.textContent?.trim().includes("What's on your mind?"))
  }
  // console.log('[content_social] fb create btn:', createBtn)
  if (!createBtn) throw new Error('Facebook: create post button not found')
  safeClick(createBtn)
  await new Promise(r => setTimeout(r, 1500))

  const input = await waitForElement(SELECTORS.facebook.composerInput)
  setInputValue(input, text)
  await new Promise(r => setTimeout(r, 500))
  let postBtn = document.querySelector(SELECTORS.facebook.postButton)
  if (!postBtn) {
    postBtn = findByText(SELECTORS.facebook.createPostButton, 'Kirim')
  }
// console.log('[content_social] fb post btn:', postBtn)
  if (postBtn) safeClick(postBtn)
  // console.log('[content_social] postToFacebook done')
}
async function postToX(text: string): Promise<void> {
  let input: Element
  try {
    input = await waitForElement(SELECTORS.x.composerInput)
  } catch {
    throw new Error('X: composer input not found')
  }
  if (input instanceof HTMLElement) input.focus()
  await new Promise(r => setTimeout(r, 300))
  setInputValue(input, text)
  await new Promise(r => setTimeout(r, 500))
  const postBtn = document.querySelector(SELECTORS.x.postButton) || document.querySelector(SELECTORS.x.replyButton)
  if (!postBtn) throw new Error('X: post button not found')
  safeClick(postBtn)
  await new Promise(r => setTimeout(r, 2000))
}
async function handlePost(platform: string, text: string, scheduleTime?: number): Promise<void> {
  // console.log('[content_social] handlePost:', { platform, textLength: text.length, scheduleTime })
  switch (platform) {
    case 'threads':
      await postToThreads(text, scheduleTime)
      break
    case 'facebook':
      await postToFacebook(text)
      break
    case 'x':
      await postToX(text, scheduleTime)
      break
    default:
      throw new Error(`Unsupported platform: ${platform}`)
  }
}
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (sender.id !== chrome.runtime.id) return
  switch (message.type) {
    case 'SOCIAL_POST':
      // console.log('[content_social] starting handlePost')
      handlePost(message.platform, message.content, message.scheduleTime)
        .then(() => {
          // console.log('[content_social] post success')
          sendResponse({ success: true })
        })
        .catch(err => {
          // console.log('[content_social] post error:', err.message)
          sendResponse({ error: err.message })
        })
      return true

    case 'SOCIAL_POST_MULTI':
      handlePost(message.platform, message.content, message.scheduleTime)
        .then(() => {
          // console.log('[content_social] multi-post success')
          sendResponse({ success: true })
        })
        .catch(err => {
          // console.log('[content_social] multi-post error:', err.message)
          sendResponse({ error: err.message })
        })
      return true
  }
})
