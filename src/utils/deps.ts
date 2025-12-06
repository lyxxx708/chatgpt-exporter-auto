import html2canvas from 'html2canvas'
import JSZip from 'jszip'

const prefix = '[ChatGPT Exporter]'

export function getJSZip() {
    const globalZip = (globalThis as any).JSZip as typeof JSZip | undefined
    const ctor = (JSZip as unknown as typeof JSZip | undefined) ?? globalZip
    if (!ctor) {
        console.error(`${prefix} JSZip is not available. Ensure the userscript header keeps the jszip @require line.`)
        return null
    }
    return ctor
}

export function getHtml2Canvas() {
    const globalFn = (globalThis as any).html2canvas as typeof html2canvas | undefined
    const fn = (html2canvas as unknown as typeof html2canvas | undefined) ?? globalFn
    if (!fn) {
        console.error(`${prefix} html2canvas is not available. Ensure the userscript header keeps the html2canvas @require line.`)
        return null
    }
    return fn
}
