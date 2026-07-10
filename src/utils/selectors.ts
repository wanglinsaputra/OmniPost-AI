

export const SELECTORS = {
  chatgpt: {
    input: '#prompt-textarea',
    sendButton: 'button[data-testid="send-button"]',
    stopButton: 'button[data-testid="stop-button"]',
    
    tempChatToggle: 'button[aria-label*="Temporary chat" i], button[aria-label*="Percakapan sementara" i]',
    
    assistantMessage: '[data-message-author-role="assistant"]:last-child',
    
    assistantText: '[data-message-author-role="assistant"]:last-child .markdown',
    
    sendButtonEnabled: 'button[data-testid="send-button"]:not([disabled])',
  },
  claude: {
    input: 'div[contenteditable="true"]',

    sendButton: 'button[aria-label*="Send" i], button[aria-label*="send message" i]',

    stopButton: 'button[aria-label*="Stop" i], button[aria-label*="stop response" i]',

    assistantMessage: '.font-claude-response',

    newChatButton: 'a[href="/new"], button[aria-label*="New chat" i]',
  },
  gemini: {
    input: 'div[contenteditable="true"][role="textbox"]',
    
    inputFallback: 'textarea',
    
    sendButton: 'gem-icon-button.send-button button',
    
    stopButton: 'button[aria-label*="Hentikan" i], button[aria-label*="Stop" i]',
    
    responseText: 'message-content .markdown.markdown-main-panel',
    
    modelMessage: 'message-content .markdown.markdown-main-panel:last-child',
    
    newChatButton: '[data-test-id="new-chat-button"] a',
    
    tempChatToggle: '[data-test-id="temp-chat-button"] button',
  },
  threads: {
    
    composeButton: 'div[aria-label*="Empty text field"]',
    
    composerInput: 'div[contenteditable="true"]',
    
    addToThreadButton: 'div[role="button"]',
    addToThreadButtonFallback: 'div[role="button"] svg[aria-label="Add"]',
    
    postButton: 'div[role="button"]',
    postButtonFallback: 'button',
    
    moreButton: 'svg[aria-label="More"]',
    
    scheduleMoreButton: 'button[aria-label="More"]',
    
    scheduleMonthHeader: 'h2 span',
    
    schedulePrevMonth: 'button[aria-label="Previous Month"]',
    
    scheduleNextMonth: 'button[aria-label="Next Month"]',
    
    scheduleDayCell: 'div[role="gridcell"]',
    
    scheduleHourInput: 'input[placeholder="hh"]',
    
    scheduleMinuteInput: 'input[placeholder="mm"]',
    
    scheduleDoneButton: 'div[role="button"]',
  },
  facebook: {
    
    createPostButton: 'div[role="button"]',
    
    composerInput: 'div[role="dialog"] [contenteditable="true"]',
    
    postButton: 'div[aria-label="Kirim"][role="button"], div[aria-label="Post"][role="button"]',
  },
  x: {
    
    composerInput: 'div[contenteditable="true"][role="textbox"]',
    
    postButton: 'button[data-testid="tweetButton"]',
    
    replyButton: 'button[data-testid="tweetButtonInline"]',
    
    addToThread: 'button[data-testid="addButton"]',
    
    addToThreadFallback: 'span:has-text("Add another tweet"), div:has-text("Add another tweet")',
  },
} as const

export type Platform = keyof typeof SELECTORS
