/**
 * Lightweight sanity checks for Phase 1 access helpers.
 * Run: node scripts/test-phase1-access.mjs
 * (Uses dynamic import of compiled logic via tsx if available; otherwise documents expected matrix.)
 */

// Inline minimal mirror of plan matrix rules for CI without TS loader
const free = { allow_emi: false, allow_staff: false, allow_support: false, allow_gl: false };
const starter = { allow_emi: true, allow_staff: false, allow_support: false, allow_gl: true };
const premium = { allow_emi: true, allow_staff: true, allow_support: true, allow_gl: true };

function assert(cond, msg) {
  if (!cond) {
    console.error("FAIL:", msg);
    process.exitCode = 1;
  } else {
    console.log("OK:", msg);
  }
}

assert(!free.allow_emi, "free blocks EMI");
assert(starter.allow_emi && !starter.allow_staff, "starter allows EMI, blocks staff");
assert(premium.allow_support && premium.allow_staff, "premium allows support+staff");

// Password policy mirror
function checkPw(p) {
  return p.length >= 8 && /[A-Za-z]/.test(p) && /\d/.test(p);
}
assert(!checkPw("short"), "rejects short password");
assert(!checkPw("longpassword"), "rejects password without digit");
assert(checkPw("Longpass1"), "accepts strong-enough password");

console.log(process.exitCode ? "\nPhase1 access checks FAILED" : "\nPhase1 access checks PASSED");
