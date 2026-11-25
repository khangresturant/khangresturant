/** One physical test: HTML → PDF → pdf-to-printer (restored path). */
const { app } = require("electron");
const { printThermalSilent } = require("./printer");

const PRINTER = "Black Copper BC-85AC";

const TEST_HTML = `<!DOCTYPE html>
<html><head>
<meta charset="utf-8" />
<meta name="x-thermal-width-mm" content="80" />
<style>
@page { size: 80mm auto portrait; margin: 0; }
body { margin: 0; font: bold 14px Arial; width: 80mm; color: #000; }
</style>
</head><body>
<p align="center">PDF PRINT TEST</p>
<p align="center">${new Date().toLocaleString()}</p>
<hr/>
<p>KOT restore test</p>
</body></html>`;

app.whenReady().then(async () => {
  try {
    const result = await printThermalSilent({
      html: TEST_HTML,
      printerName: PRINTER,
      copies: 1,
    });
    console.log(
      `PRINT_PDF_RESULT=OK printer="${result.printer}" method="${result.method || "pdf"}"`
    );
    app.exit(0);
  } catch (err) {
    console.log(
      `PRINT_PDF_RESULT=FAIL error="${err instanceof Error ? err.message : err}"`
    );
    app.exit(1);
  }
});