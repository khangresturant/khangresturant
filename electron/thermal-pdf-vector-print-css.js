/**
 * PDF export: normal vector text (antialiased), not thermal "stamp" bitmap mode.
 * Used in Electron before printToPDF → Sumatra.
 */
module.exports.THERMAL_PDF_VECTOR_PRINT_CSS =
  "html,body{" +
  "font-family:Arial,Helvetica,'Segoe UI',Tahoma,sans-serif!important;" +
  "background:#fff!important;color:#000!important;}" +
  "html,body,.receipt-container,.thermal-slip-root,.thermal-receipt-view," +
  ".receipt-container *,.thermal-receipt-view *{" +
  "-webkit-font-smoothing:antialiased!important;" +
  "-moz-osx-font-smoothing:grayscale!important;" +
  "text-rendering:auto!important;font-variant-ligatures:none!important;" +
  "text-shadow:none!important;filter:none!important;" +
  "print-color-adjust:exact!important;-webkit-print-color-adjust:exact!important;" +
  "-webkit-text-fill-color:currentColor!important;}" +
  ".font-mono,.receipt-container .font-mono,.thermal-receipt-view .font-mono{" +
  "font-family:'Courier New',Courier,monospace!important;}" +
  ".font-serif,.receipt-container .font-serif,.thermal-receipt-view .font-serif{" +
  "font-family:'Times New Roman',Times,Georgia,serif!important;}" +
  ".text-black,.text-slate-400,.text-slate-500,.text-gray-500,.text-zinc-500,.text-zinc-600,.text-zinc-700,.text-zinc-800," +
  ".receipt-container,.thermal-receipt-view," +
  ".receipt-container p,.receipt-container span,.receipt-container td,.receipt-container th,.receipt-container div,.receipt-container li," +
  ".thermal-receipt-view p,.thermal-receipt-view span,.thermal-receipt-view td,.thermal-receipt-view th,.thermal-receipt-view div,.thermal-receipt-view li{" +
  "color:#000!important;-webkit-text-fill-color:#000!important;opacity:1!important;}" +
  ".bg-black,.bg-slate-900{background-color:#000!important;}" +
  ".text-white,.bg-black .text-white,.bg-black h1,.bg-black h2,.bg-black h3," +
  ".bg-black th,.bg-black td,.bg-black span,.bg-black div,.bg-black p,.bg-black li{" +
  "color:#fff!important;-webkit-text-fill-color:#fff!important;}" +
  "hr,.border,.border-t,.border-b,.border-black," +
  ".receipt-container table,.receipt-container th,.receipt-container td," +
  ".thermal-receipt-view table,.thermal-receipt-view th,.thermal-receipt-view td{" +
  "border-color:#000!important;}" +
  "img.receipt-logo,img{image-rendering:auto!important;max-width:100%!important;}";