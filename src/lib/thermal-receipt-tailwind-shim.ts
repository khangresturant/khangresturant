/**
 * Tailwind utility shims for thermal print HTML loaded offline (file://) —
 * no dashboard stylesheets or @import bundles.
 */
export const THERMAL_RECEIPT_TAILWIND_SHIM_CSS = `
    .border { border: 1px solid #000000 !important; }
    .border-2 { border: 2px solid #000000 !important; }
    .border-t { border-top: 1px solid #000000 !important; }
    .border-b { border-bottom: 1px solid #000000 !important; }
    .border-r { border-right: 1px solid #000000 !important; }
    .border-l { border-left: 1px solid #000000 !important; }
    .border-y { border-top: 1px solid #000000 !important; border-bottom: 1px solid #000000 !important; }
    .border-x { border-left: 1px solid #000000 !important; border-right: 1px solid #000000 !important; }
    .border-t-2 { border-top: 2px solid #000000 !important; }
    .border-b-2 { border-bottom: 2px solid #000000 !important; }
    .border-y-2 { border-top: 2px solid #000000 !important; border-bottom: 2px solid #000000 !important; }
    .border-y-4 { border-top: 4px solid #000000 !important; border-bottom: 4px solid #000000 !important; }
    .border-dashed { border-style: dashed !important; border-color: #000000 !important; }
    .border-dotted { border-style: dotted !important; border-color: #000000 !important; }
    .border-double { border-style: double !important; border-color: #000000 !important; }
    .divide-y > * + * { border-top: 1px solid #000000 !important; }
    .divide-black\\/30 > * + * { border-top: 1px solid #000000 !important; }
    .border-black\\/40, .border-black\\/30, .border-black\\/20, .border-black\\/10 { border-color: #000000 !important; }

    table {
      width: 100% !important;
      border-collapse: collapse !important;
    }

    img {
      max-width: 100% !important;
      display: block !important;
      image-rendering: -webkit-optimize-contrast;
      image-rendering: crisp-edges;
      filter: none !important;
    }

    .w-16 { width: 56px !important; min-width: 56px !important; max-width: 56px !important; }
    .h-16 { height: 56px !important; min-height: 56px !important; max-height: 56px !important; }
    .w-20 { width: 72px !important; min-width: 72px !important; max-width: 72px !important; }
    .h-20 { height: 72px !important; min-height: 72px !important; max-height: 72px !important; }
    .w-10 { width: 36px !important; }
    .h-10 { height: 36px !important; }
    .w-auto { width: auto !important; }
    .h-auto { height: auto !important; }
    .w-full { width: 100% !important; }
    .h-full { height: 100% !important; }
    .h-1\\.5 { height: 6px !important; }
    .h-3 { height: 12px !important; }
    .h-9 { height: 36px !important; }
    .object-contain { object-fit: contain !important; }
    .overflow-hidden { overflow: hidden !important; }

    .flex { display: flex !important; }
    .flex-col { flex-direction: column !important; }
    .flex-wrap { flex-wrap: wrap !important; }
    .grid { display: grid !important; }
    .grid-cols-2 { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; }
    .col-span-2 { grid-column: span 2 / span 2 !important; }
    .items-center { align-items: center !important; }
    .items-start { align-items: flex-start !important; }
    .items-end { align-items: flex-end !important; }
    .justify-between { justify-content: space-between !important; }
    .justify-center { justify-content: center !important; }
    .justify-end { justify-content: flex-end !important; }
    .text-center { text-align: center !important; }
    .text-right { text-align: right !important; }
    .text-left { text-align: left !important; }
    .uppercase { text-transform: uppercase !important; }
    .font-mono { font-family: 'Courier New', Courier, monospace !important; }
    .font-serif { font-family: 'Times New Roman', Times, Georgia, serif !important; }
    .font-sans { font-family: Arial, Helvetica, sans-serif !important; }
    .font-black { font-weight: 900 !important; }
    .font-bold { font-weight: 700 !important; }
    .font-semibold { font-weight: 600 !important; }
    .font-medium { font-weight: 500 !important; }
    .font-normal { font-weight: 400 !important; }
    .truncate { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .italic { font-style: italic !important; }
    .underline { text-decoration: underline !important; }
    .whitespace-nowrap { white-space: nowrap !important; }
    .inline-block { display: inline-block !important; }
    .mx-auto { margin-left: auto !important; margin-right: auto !important; }
    .tracking-wider { letter-spacing: 0.05em !important; }
    .tracking-wide { letter-spacing: 0.025em !important; }
    .tracking-widest { letter-spacing: 0.1em !important; }
    .leading-tight { line-height: 1.25 !important; }
    .leading-none { line-height: 1 !important; }

    .text-zinc-300, .text-zinc-500, .text-zinc-600, .text-zinc-700, .text-zinc-800 {
      color: #000000 !important;
      -webkit-text-fill-color: #000000 !important;
    }
  .bg-slate-50 { background-color: #f4f4f5 !important; }

    .gap-0\\.5 { gap: 2px !important; }
    .gap-1 { gap: 4px !important; }
    .gap-1\\.5 { gap: 6px !important; }
    .gap-2 { gap: 8px !important; }
    .gap-3 { gap: 12px !important; }
    .gap-4 { gap: 16px !important; }
    .gap-x-2 { column-gap: 8px !important; }
    .gap-y-0\\.5 { row-gap: 2px !important; }

    .space-y-0\\.5 > * + * { margin-top: 2px !important; }
    .space-y-1 > * + * { margin-top: 4px !important; }
    .space-y-1\\.5 > * + * { margin-top: 6px !important; }
    .space-y-2 > * + * { margin-top: 8px !important; }

    .text-\\[7\\.5px\\] { font-size: 7.5px !important; line-height: 1.1 !important; }
    .text-\\[8px\\] { font-size: 8px !important; line-height: 1.15 !important; }
    .text-\\[8\\.5px\\] { font-size: 8.5px !important; line-height: 1.2 !important; }
    .text-\\[9px\\] { font-size: 9px !important; line-height: 1.2 !important; }
    .text-\\[9\\.5px\\] { font-size: 9.5px !important; line-height: 1.25 !important; }
    .text-\\[10px\\] { font-size: 10px !important; line-height: 1.3 !important; }
    .text-\\[11px\\] { font-size: 11px !important; line-height: 1.3 !important; }
    .text-\\[12px\\] { font-size: 12px !important; line-height: 1.3 !important; }
    .text-xs { font-size: 11px !important; }
    .text-sm { font-size: 13px !important; }
    .text-base { font-size: 15px !important; }

    .p-0\\.5 { padding: 2px !important; }
    .p-1 { padding: 4px !important; }
    .p-1\\.5 { padding: 6px !important; }
    .p-2 { padding: 8px !important; }
    .p-2\\.5 { padding: 10px !important; }
    .p-3\\.5 { padding: 12px !important; }
    .py-0\\.5 { padding-top: 2px !important; padding-bottom: 2px !important; }
    .py-1 { padding-top: 4px !important; padding-bottom: 4px !important; }
    .py-1\\.5 { padding-top: 6px !important; padding-bottom: 6px !important; }
    .py-2 { padding-top: 8px !important; padding-bottom: 8px !important; }
    .px-0\\.5 { padding-left: 2px !important; padding-right: 2px !important; }
    .px-1 { padding-left: 4px !important; padding-right: 4px !important; }
    .px-1\\.5 { padding-left: 6px !important; padding-right: 6px !important; }
    .px-2 { padding-left: 8px !important; padding-right: 8px !important; }
    .px-3 { padding-left: 12px !important; padding-right: 12px !important; }
    .pt-0\\.5 { padding-top: 2px !important; }
    .pt-1 { padding-top: 4px !important; }
    .pt-2 { padding-top: 8px !important; }
    .pb-0\\.5 { padding-bottom: 2px !important; }
    .pb-1 { padding-bottom: 4px !important; }
    .pb-2 { padding-bottom: 8px !important; }
    .pr-2 { padding-right: 8px !important; }
    .pl-1 { padding-left: 4px !important; }

    .my-1 { margin-top: 4px !important; margin-bottom: 4px !important; }
    .my-1\\.5 { margin-top: 6px !important; margin-bottom: 6px !important; }
    .my-2 { margin-top: 8px !important; margin-bottom: 8px !important; }
    .mt-0\\.5 { margin-top: 2px !important; }
    .mt-1 { margin-top: 4px !important; }
    .mt-2 { margin-top: 8px !important; }
    .mt-2\\.5 { margin-top: 10px !important; }
    .mb-1 { margin-bottom: 4px !important; }
    .mb-2 { margin-bottom: 8px !important; }
    .mb-2\\.5 { margin-bottom: 10px !important; }
    .-mx-2 { margin-left: -8px !important; margin-right: -8px !important; }
    .-mt-2 { margin-top: -8px !important; }
    .mr-1\\.5 { margin-right: 6px !important; }

    .rounded { border-radius: 3px !important; }
    .rounded-xs { border-radius: 2px !important; }
    .rounded-sm { border-radius: 2px !important; }
    .rounded-md { border-radius: 4px !important; }
    .rounded-lg { border-radius: 6px !important; }
    .rounded-xl { border-radius: 8px !important; }
    .rounded-full { border-radius: 9999px !important; }
    .rounded-t-sm { border-top-left-radius: 2px !important; border-top-right-radius: 2px !important; }

    div.thermal-receipt-view {
      width: 100% !important;
      max-width: 100% !important;
      margin: 0 !important;
      box-shadow: none !important;
      background: #ffffff !important;
      color: #000000 !important;
    }
    html, body {
      background: #ffffff !important;
      color: #000000 !important;
    }
`;