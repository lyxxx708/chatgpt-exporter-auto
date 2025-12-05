// 聊天输入相关的 selector
export const INPUT_SELECTORS = {
  // 输入根节点（contentEditable 容器）
  root: '#prompt-textarea',

  // 输入内容的 <p> 节点（用户提供的“从小到大”最小一级）
  paragraph: '#prompt-textarea > p',

  // 若未来 root 变了，可以再加更多 fallback，这里先用用户提供的第二级：
  fallbackContainer:
    '#thread-bottom > div > div > div.pointer-events-auto.relative.z-1.flex.h-\\[var\\(--composer-container-height,100%\\)\\].max-w-full.flex-\\[var\\(--composer-container-flex,1\\)\\].flex-col > form > div:nth-child(2) > div',
} as const

// 发送按钮 selector
export const SEND_BUTTON_SELECTORS = {
  // 首选：非常干净的 id
  primary: '#composer-submit-button',

  // fallback：完整路径备用（可能不一定需要）
  fallbackContainer:
    '#thread-bottom > div > div > div.pointer-events-auto.relative.z-1.flex.h-\\[var\\(--composer-container-height,100%\\)\\].max-w-full.flex-\\[var\\(--composer-container-flex,1\\)\\].flex-col > form > div:nth-child(2) > div > div.flex.items-center.gap-2.\\[grid-area\\:trailing\\] > div',
} as const

// 更多功能按钮（加图片、文件等）selector（后续扩展用）
export const MORE_BUTTON_SELECTORS = {
  primary: '#composer-plus-btn',
  fallback:
    '#thread-bottom > div > div > div.pointer-events-auto.relative.z-1.flex.h-\\[var\\(--composer-container-height,100%\\)\\].max-w-full.flex-\\[var\\(--composer-container-flex,1\\)\\].flex-col > form > div:nth-child(2) > div > div.\\[grid-area\\:leading\\] > span',
} as const

// 更多功能弹出区域（目前只是记录一下，暂时不用）
export const ATTACHMENT_PANEL_SELECTORS = {
  panelRoot:
    '#radix-_r_qc_ > div.empty\\:hidden.\\[\\:not\\(\\:has\\(div\\:not\\(\\[role\\=group\\\\]\\)\\)\\)\\)\\]\:hidden.before\\:bg-token-border-default.content-sheet\\:before\\:my-3.content-sheet\\:before\\:mx-6.before\\:mx-4.before\\:my-1.before\\:block.before\\:h-px.first\\:before\\:hidden.\\[\\&\\:nth-child\\(1_of_\\:has\\(div\\:not\\(\\[role\\=group\\\\]\\)\\)\\)\\)\\]\:before\\:hidden.content-sheet\\:content-sheet-inset-section',
} as const
