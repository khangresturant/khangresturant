const { contextBridge, ipcRenderer } = require("electron");

/**
 * Preload script securely bridges Electron main process with the Next.js React frontend.
 * Only exposes safe, whitelisted POS hardware methods.
 */
contextBridge.exposeInMainWorld("electronAPI", {
  isDesktop: true,
  getPrinters: () => ipcRenderer.invoke("get-printers"),
  printThermalSilent: (html, printerName, copies = 1) =>
    ipcRenderer.invoke("print-thermal-silent", { html, printerName, copies }),
  getSystemInfo: () => ipcRenderer.invoke("get-system-info"),
});
