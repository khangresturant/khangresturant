/** Keep in sync with src/lib/thermal-sharp-text-css.ts — all receipt templates. */
module.exports.THERMAL_SHARP_PRINT_CSS =
  "html,body,.receipt-container,.thermal-slip-root,.thermal-receipt-view{" +
  "-webkit-font-smoothing:none!important;text-rendering:geometricPrecision!important;" +
  "-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important;}" +
  ".text-black,.text-slate-400,.text-slate-500,.text-gray-500,.receipt-container,.thermal-receipt-view," +
  ".receipt-container th,.receipt-container td,.receipt-container p,.receipt-container span:not(.text-white)," +
  ".thermal-receipt-view p,.thermal-receipt-view span:not(.text-white),.thermal-receipt-view div:not(.bg-black){" +
  "color:#000!important;-webkit-text-fill-color:#000!important;}" +
  ".bg-black,.bg-slate-900{background-color:#000!important;}" +
  ".text-white,.bg-black .text-white,.bg-black h1,.bg-black h2,.bg-black h3,.bg-black th,.bg-black td,.bg-black span,.bg-black div,.bg-black p{" +
  "color:#fff!important;-webkit-text-fill-color:#fff!important;-webkit-text-stroke:0!important;}" +
  "hr,.border,.border-t,.border-b,.border-black,.receipt-container table,.receipt-container th,.receipt-container td{" +
  "border-color:#000!important;}";