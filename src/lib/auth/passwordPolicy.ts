/**
 * Client + server password policy helpers (AUTH-02).
 * Supabase project Auth settings should also enforce min length.
 */

export const PASSWORD_MIN_LENGTH = 8;

export type PasswordCheck = {
  ok: boolean;
  errors: string[];
  score: number; // 0–4
};

export function checkPasswordStrength(password: string): PasswordCheck {
  const errors: string[] = [];
  let score = 0;

  if (!password || password.length < PASSWORD_MIN_LENGTH) {
    errors.push(`Password must be at least ${PASSWORD_MIN_LENGTH} characters.`);
  } else {
    score += 1;
  }

  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) {
    score += 1;
  } else {
    errors.push("Include both uppercase and lowercase letters.");
  }

  if (/\d/.test(password)) {
    score += 1;
  } else {
    errors.push("Include at least one number.");
  }

  if (/[^A-Za-z0-9]/.test(password)) {
    score += 1;
  } else {
    // soft: not required for ok, but recommended
  }

  // Minimum gate for "ok": length + (letters variety OR digit)
  const ok =
    password.length >= PASSWORD_MIN_LENGTH &&
    (/[A-Za-z]/.test(password) && /\d/.test(password));

  if (ok && errors.length > 0) {
    // Soft recommendations only when hard rules pass
    return { ok: true, errors: [], score };
  }

  return {
    ok,
    errors: ok
      ? []
      : errors.length
        ? errors
        : ["Password does not meet security requirements."],
    score,
  };
}
