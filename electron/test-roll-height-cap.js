const {
  clampThermalRollHeightMm,
  THERMAL_ROLL_MAX_HEIGHT_MM,
  estimateSlipHeightMm,
} = require("./thermal-pdf");

const big = estimateSlipHeightMm("<div></div>".repeat(800));
const capped = clampThermalRollHeightMm(5000, 80);
const small = clampThermalRollHeightMm(120, 80);

console.log(`MAX_MM=${THERMAL_ROLL_MAX_HEIGHT_MM}`);
console.log(`estimate_big=${big} (must be <= ${THERMAL_ROLL_MAX_HEIGHT_MM})`);
console.log(`clamp_5000=${capped} (expect ${THERMAL_ROLL_MAX_HEIGHT_MM})`);
console.log(`clamp_120=${small} (expect >= 108 portrait min for 80mm width)`);

if (big > THERMAL_ROLL_MAX_HEIGHT_MM || capped !== 297 || small < 108) {
  process.exit(1);
}
console.log("HEIGHT_CAP_OK");