declare module 'html2pdf.js' {
  interface Html2PdfOptions {
    margin?: number | number[]
    filename?: string
    image?: { type?: string; quality?: number }
    html2canvas?: Record<string, unknown>
    jsPDF?: Record<string, unknown>
    pagebreak?: { mode?: string | string[]; before?: string; after?: string; avoid?: string }
    enableLinks?: boolean
  }

  interface Html2PdfInstance {
    set(options: Html2PdfOptions): Html2PdfInstance
    from(element: HTMLElement | string): Html2PdfInstance
    save(): Promise<void>
    toPdf(): Html2PdfInstance
    output(type?: string, options?: unknown): Promise<unknown>
  }

  export default function html2pdf(): Html2PdfInstance
}
