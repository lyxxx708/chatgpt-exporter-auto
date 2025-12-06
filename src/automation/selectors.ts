// Chat input related selectors
export const INPUT_SELECTORS = {
    // Input root (contentEditable container)
    root: '#prompt-textarea',

    // Paragraph node inside the input
    paragraph: '#prompt-textarea > p',

    // Fallback container if root changes
    fallbackContainer: '#prompt-textarea',
}

// Send button selectors
export const SEND_BUTTON_SELECTORS = {
    // Candidate selectors are tried in order, with try/catch to avoid SyntaxError crashes.
    candidates: [
        'button[data-testid="send-button"]',
        '#composer-submit-button',
        'button[aria-label*="Send message"]',
        'button[aria-label*="发送"]',
    ],
}

// More button selectors for future extension
export const MORE_BUTTON_SELECTORS = {
    primary: '#composer-plus-btn',
    fallback:
        '#thread-bottom > div > div > div.pointer-events-auto.relative.z-1.flex.h-\\[var\\(--composer-container-height,100%\\)\\].max-w-full.flex-\\[var\\(--composer-container-flex,1\\)\\].flex-col > form > div:nth-child(2) > div > div.\\[grid-area\\:leading\\] > span',
}

// Attachment panel selectors (not used yet)
export const ATTACHMENT_PANEL_SELECTORS = {
    panelRoot:
        '#radix-_r_qc_ > div.empty\\:hidden.\\[\\:not\\(\\:has\\(div\\:not\\(\\[role\\=group\\]\\)\\)\\)\\]\:hidden.before\\:bg-token-border-default.content-sheet\\:before\\:my-3.content-sheet\\:before\\:mx-6.before\\:mx-4.before\\:my-1.before\\:block.before\\:h-px.first\\:before\\:hidden.\\[\\&\\:nth-child\\(1_of_\\:has\\(div\\:not\\(\\[role\\=group\\]\\)\\)\\)\\]\:before\\:hidden.content-sheet\\:content-sheet-inset-section',
}
