const { BrowserWindow } = require("electron");

/**
 * Prints thermal receipt HTML silently to the specified printer or system default.
 * Bypasses Windows print dialog completely (Zero Popup).
 *
 * @param {object} params
 * @param {string} params.html - Full rendered receipt HTML
 * @param {string} [params.printerName] - Target Windows thermal printer name (e.g. "POS-80", "Kitchen-XP")
 * @param {number} [params.copies=1] - Number of receipt copies
 * @returns {Promise<{ success: boolean, printer: string }>}
 */
async function printThermalSilent({ html, printerName, copies = 1 }) {
  if (!html || typeof html !== "string") {
    throw new Error("Receipt HTML content is required for printing.");
  }

  return new Promise((resolve, reject) => {
    let printWindow = new BrowserWindow({
      show: false,
      width: 400,
      height: 600,
      webPreferences: {
        offscreen: true,
        nodeIntegration: false,
        contextIsolation: true,
      },
    });

    const cleanup = () => {
      if (printWindow) {
        try {
          printWindow.destroy();
        } catch {
          // Window already destroyed
        }
        printWindow = null;
      }
    };

    const targetPrinter = printerName?.trim() || "";

    printWindow.webContents.on("did-finish-load", () => {
      // Small delay to allow CSS styling, fonts, and layout to compute accurately
      setTimeout(async () => {
        if (!printWindow) return;

        try {
          const printers = await printWindow.webContents.getPrintersAsync();
          let matchedPrinter = targetPrinter;

          if (targetPrinter) {
            const found = printers.some(
              (p) => p.name.toLowerCase() === targetPrinter.toLowerCase()
            );
            if (!found) {
              console.warn(
                `[Electron Print] Target printer "${targetPrinter}" not found among installed printers. Using system default.`
              );
              matchedPrinter = "";
            }
          }

          const printOptions = {
            silent: true,
            printBackground: true,
            copies: Math.max(1, Math.floor(Number(copies) || 1)),
            margins: { marginType: "none" },
          };

          if (matchedPrinter) {
            printOptions.deviceName = matchedPrinter;
          }

          printWindow.webContents.print(printOptions, (success, failureReason) => {
            cleanup();
            if (success) {
              resolve({
                success: true,
                printer: matchedPrinter || "System Default",
              });
            } else {
              reject(
                new Error(
                  `Silent thermal print failed: ${failureReason || "Hardware communication error"}`
                )
              );
            }
          });
        } catch (err) {
          cleanup();
          reject(err);
        }
      }, 250);
    });

    printWindow.webContents.on("did-fail-load", (_event, errorCode, errorDescription) => {
      cleanup();
      reject(new Error(`Failed to load receipt HTML into print worker: ${errorDescription} (${errorCode})`));
    });

    // Load HTML via data URI
    const dataUrl = `data:text/html;charset=utf-8,${encodeURIComponent(html)}`;
    printWindow.loadURL(dataUrl);
  });
}

module.exports = { printThermalSilent };
