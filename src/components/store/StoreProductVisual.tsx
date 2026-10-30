"use client";

type VisualKind =
  | "battery"
  | "lcd"
  | "keypad"
  | "cable"
  | "charger"
  | "glass"
  | "audio"
  | "chip"
  | "generic";

type StoreProductVisualProps = {
  name: string;
  categoryName?: string;
  unit?: string;
  imageUrl?: string | null;
};

const PALETTES = [
  { from: "#0b1220", mid: "#134e4a", accent: "#34d399", wash: "rgba(52,211,153,0.28)" },
  { from: "#14110b", mid: "#3f2e14", accent: "#e8c36a", wash: "rgba(232,195,106,0.32)" },
  { from: "#12081c", mid: "#3b0764", accent: "#c4b5fd", wash: "rgba(196,181,253,0.26)" },
  { from: "#0a1628", mid: "#1e3a5f", accent: "#7dd3fc", wash: "rgba(125,211,252,0.26)" },
  { from: "#1a0a10", mid: "#7f1d1d", accent: "#fca5a5", wash: "rgba(252,165,165,0.24)" },
  { from: "#0c1912", mid: "#14532d", accent: "#86efac", wash: "rgba(134,239,172,0.26)" },
  { from: "#16120a", mid: "#78350f", accent: "#fdba74", wash: "rgba(253,186,116,0.28)" },
  { from: "#0e1218", mid: "#1e293b", accent: "#94a3b8", wash: "rgba(148,163,184,0.22)" },
] as const;

function hashName(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = value.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash);
}

function productInitials(name: string): string {
  const skip = new Set(["TO", "AND", "THE", "OF", "FOR", "A", "AN", "WITH"]);
  const parts = name
    .replace(/[^a-zA-Z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((word) => word && !skip.has(word.toUpperCase()));

  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }

  const compact = name.replace(/[^a-zA-Z0-9]/g, "");
  return (compact.slice(0, 2) || "TA").toUpperCase();
}

function shortLabel(name: string): string {
  const cleaned = name.replace(/\s+/g, " ").trim();
  if (cleaned.length <= 18) return cleaned.toUpperCase();
  return cleaned.slice(0, 16).trim().toUpperCase();
}

function resolveKind(name: string, categoryName?: string): VisualKind {
  const haystack = `${name} ${categoryName || ""}`.toLowerCase();
  if (/keypad/.test(haystack) && /lcd|display|screen/.test(haystack)) return "keypad";
  if (/keypad/.test(haystack)) return "keypad";
  if (/lcd|oled|display|screen|panel/.test(haystack)) return "lcd";
  if (/batter|batt\b/.test(haystack)) return "battery";
  if (/cable|wire|c to c|type.?c|usb/.test(haystack)) return "cable";
  if (/charg|adapter|power bank/.test(haystack)) return "charger";
  if (/glass|protector|cover|case/.test(haystack)) return "glass";
  if (/speaker|earpiece|headphone|earbud/.test(haystack)) return "audio";
  if (/ic|chip|board|flex/.test(haystack)) return "chip";
  return "generic";
}

function ProductArt({
  kind,
  name,
  accent,
}: {
  kind: VisualKind;
  name: string;
  accent: string;
}) {
  const uid = `pv-${hashName(name)}`;
  const label = shortLabel(name);
  const initials = productInitials(name);
  const isMonoLcd = /black and white|b\/w|bw\b/.test(name.toLowerCase());
  const isCobalt = /cobalt|blue/.test(name.toLowerCase());
  const bodyFill = isCobalt ? "#1d4ed8" : kind === "battery" ? "#111827" : "#0f172a";

  if (kind === "battery") {
    return (
      <svg viewBox="0 0 220 160" className="h-[7.4rem] w-auto drop-shadow-2xl" aria-hidden>
        <defs>
          <linearGradient id={`${uid}-bat`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#2a3344" />
            <stop offset="50%" stopColor={bodyFill} />
            <stop offset="100%" stopColor="#05070c" />
          </linearGradient>
          <linearGradient id={`${uid}-shine`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="white" stopOpacity="0.22" />
            <stop offset="40%" stopColor="white" stopOpacity="0" />
          </linearGradient>
        </defs>
        <rect x="92" y="18" width="36" height="12" rx="3" fill="#cbd5e1" />
        <rect x="98" y="14" width="10" height="8" rx="2" fill="#94a3b8" />
        <rect x="112" y="14" width="10" height="8" rx="2" fill="#94a3b8" />
        <rect x="52" y="28" width="116" height="108" rx="14" fill={`url(#${uid}-bat)`} stroke="rgba(255,255,255,0.18)" />
        <rect x="52" y="28" width="116" height="108" rx="14" fill={`url(#${uid}-shine)`} />
        <rect x="66" y="44" width="88" height="36" rx="6" fill="rgba(255,255,255,0.06)" stroke={`${accent}66`} />
        <text x="110" y="60" textAnchor="middle" fill={accent} fontSize="13" fontWeight="800" fontFamily="ui-sans-serif, system-ui">
          {initials}
        </text>
        <text x="110" y="74" textAnchor="middle" fill="white" fillOpacity="0.55" fontSize="7" fontWeight="700" fontFamily="ui-sans-serif, system-ui">
          LI-ION CELL
        </text>
        <text x="110" y="108" textAnchor="middle" fill="white" fillOpacity="0.78" fontSize="7.5" fontWeight="700" fontFamily="ui-sans-serif, system-ui">
          {label}
        </text>
        <rect x="74" y="118" width="72" height="6" rx="3" fill={`${accent}55`} />
      </svg>
    );
  }

  if (kind === "lcd") {
    return (
      <svg viewBox="0 0 220 160" className="h-[7.4rem] w-auto drop-shadow-2xl" aria-hidden>
        <defs>
          <linearGradient id={`${uid}-glass`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#1e293b" />
            <stop offset="100%" stopColor="#020617" />
          </linearGradient>
        </defs>
        <rect x="68" y="16" width="84" height="128" rx="16" fill="#0b1220" stroke="rgba(255,255,255,0.2)" />
        <rect x="74" y="28" width="72" height="104" rx="6" fill={isMonoLcd ? "#111827" : `url(#${uid}-glass)`} />
        <rect x="74" y="28" width="72" height="36" fill={accent} fillOpacity="0.18" />
        <text x="110" y="78" textAnchor="middle" fill={isMonoLcd ? "#e5e7eb" : accent} fontSize="16" fontWeight="800" fontFamily="ui-sans-serif, system-ui">
          {initials}
        </text>
        <text x="110" y="94" textAnchor="middle" fill="white" fillOpacity="0.5" fontSize="7" fontWeight="700" fontFamily="ui-sans-serif, system-ui">
          {isMonoLcd ? "B/W LCD" : "COLOR LCD"}
        </text>
        <circle cx="110" cy="132" r="4" fill="rgba(255,255,255,0.18)" />
      </svg>
    );
  }

  if (kind === "keypad") {
    return (
      <svg viewBox="0 0 220 160" className="h-[7.4rem] w-auto drop-shadow-2xl" aria-hidden>
        <rect x="48" y="18" width="124" height="124" rx="18" fill="#111827" stroke="rgba(255,255,255,0.16)" />
        <rect x="60" y="30" width="100" height="42" rx="6" fill="#020617" stroke={`${accent}55`} />
        <text x="110" y="56" textAnchor="middle" fill={accent} fontSize="14" fontWeight="800" fontFamily="ui-sans-serif, system-ui">
          {initials}
        </text>
        {[0, 1, 2].map((row) =>
          [0, 1, 2].map((col) => (
            <rect
              key={`${row}-${col}`}
              x={66 + col * 30}
              y={84 + row * 16}
              width="22"
              height="12"
              rx="3"
              fill="rgba(255,255,255,0.08)"
              stroke="rgba(255,255,255,0.12)"
            />
          ))
        )}
      </svg>
    );
  }

  if (kind === "cable") {
    return (
      <svg viewBox="0 0 220 160" className="h-[7.4rem] w-auto drop-shadow-2xl" aria-hidden>
        <path
          d="M46 78 C 80 28, 140 28, 174 78"
          fill="none"
          stroke={accent}
          strokeWidth="10"
          strokeLinecap="round"
        />
        <path
          d="M46 78 C 80 28, 140 28, 174 78"
          fill="none"
          stroke="#0b1220"
          strokeWidth="5"
          strokeLinecap="round"
        />
        <rect x="28" y="68" width="28" height="22" rx="5" fill="#e5e7eb" />
        <rect x="164" y="68" width="28" height="22" rx="5" fill="#e5e7eb" />
        <rect x="22" y="74" width="10" height="10" rx="2" fill="#94a3b8" />
        <rect x="188" y="74" width="10" height="10" rx="2" fill="#94a3b8" />
        <text x="110" y="124" textAnchor="middle" fill="white" fillOpacity="0.7" fontSize="9" fontWeight="800" fontFamily="ui-sans-serif, system-ui">
          {label}
        </text>
      </svg>
    );
  }

  if (kind === "charger") {
    return (
      <svg viewBox="0 0 220 160" className="h-[7.4rem] w-auto drop-shadow-2xl" aria-hidden>
        <rect x="72" y="26" width="76" height="86" rx="14" fill="#111827" stroke="rgba(255,255,255,0.16)" />
        <circle cx="110" cy="64" r="16" fill={`${accent}33`} stroke={accent} />
        <text x="110" y="69" textAnchor="middle" fill={accent} fontSize="12" fontWeight="800" fontFamily="ui-sans-serif, system-ui">
          {initials}
        </text>
        <rect x="98" y="112" width="24" height="18" rx="3" fill="#cbd5e1" />
        <path d="M110 130 C 110 148, 148 148, 168 136" fill="none" stroke={accent} strokeWidth="6" strokeLinecap="round" />
      </svg>
    );
  }

  if (kind === "glass") {
    return (
      <svg viewBox="0 0 220 160" className="h-[7.4rem] w-auto drop-shadow-2xl" aria-hidden>
        <rect x="70" y="18" width="80" height="124" rx="18" fill="rgba(255,255,255,0.08)" stroke="rgba(255,255,255,0.35)" />
        <rect x="78" y="30" width="64" height="100" rx="8" fill="rgba(148,163,184,0.12)" />
        <path d="M86 42 L126 118" stroke="white" strokeOpacity="0.35" strokeWidth="2" />
        <text x="110" y="86" textAnchor="middle" fill={accent} fontSize="14" fontWeight="800" fontFamily="ui-sans-serif, system-ui">
          {initials}
        </text>
      </svg>
    );
  }

  if (kind === "audio") {
    return (
      <svg viewBox="0 0 220 160" className="h-[7.4rem] w-auto drop-shadow-2xl" aria-hidden>
        <circle cx="78" cy="78" r="28" fill="#111827" stroke={accent} strokeWidth="4" />
        <circle cx="142" cy="78" r="28" fill="#111827" stroke={accent} strokeWidth="4" />
        <path d="M106 78 C 110 48, 130 48, 134 78" fill="none" stroke={accent} strokeWidth="5" />
        <text x="110" y="132" textAnchor="middle" fill="white" fillOpacity="0.7" fontSize="9" fontWeight="800" fontFamily="ui-sans-serif, system-ui">
          {label}
        </text>
      </svg>
    );
  }

  if (kind === "chip") {
    return (
      <svg viewBox="0 0 220 160" className="h-[7.4rem] w-auto drop-shadow-2xl" aria-hidden>
        <rect x="70" y="40" width="80" height="80" rx="10" fill="#111827" stroke={accent} />
        {Array.from({ length: 6 }).map((_, i) => (
          <g key={i}>
            <rect x={80 + i * 10} y="28" width="4" height="12" fill="#94a3b8" />
            <rect x={80 + i * 10} y="120" width="4" height="12" fill="#94a3b8" />
          </g>
        ))}
        <text x="110" y="88" textAnchor="middle" fill={accent} fontSize="16" fontWeight="800" fontFamily="ui-sans-serif, system-ui">
          {initials}
        </text>
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 220 160" className="h-[7.4rem] w-auto drop-shadow-2xl" aria-hidden>
      <rect x="58" y="30" width="104" height="96" rx="16" fill="#111827" stroke="rgba(255,255,255,0.16)" />
      <rect x="70" y="42" width="80" height="10" rx="5" fill={`${accent}55`} />
      <text x="110" y="92" textAnchor="middle" fill={accent} fontSize="28" fontWeight="800" fontFamily="ui-sans-serif, system-ui">
        {initials}
      </text>
      <text x="110" y="110" textAnchor="middle" fill="white" fillOpacity="0.5" fontSize="8" fontWeight="700" fontFamily="ui-sans-serif, system-ui">
        {label}
      </text>
    </svg>
  );
}

export function StoreProductVisual({
  name,
  categoryName,
  unit,
  imageUrl,
}: StoreProductVisualProps) {
  const hash = hashName(name);
  const palette = PALETTES[hash % PALETTES.length];
  const kind = resolveKind(name, categoryName);

  return (
    <div className="relative h-48 overflow-hidden">
      {imageUrl ? (
        <img
          src={imageUrl}
          alt={name}
          loading="lazy"
          decoding="async"
          className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110"
        />
      ) : (
        <div
          className="absolute inset-0"
          style={{
            background: `radial-gradient(circle at 30% 20%, ${palette.wash}, transparent 42%), linear-gradient(160deg, ${palette.from} 0%, ${palette.mid} 52%, #050608 100%)`,
          }}
        >
          <div
            className="absolute inset-0 opacity-20"
            style={{
              backgroundImage:
                "radial-gradient(circle at 1px 1px, rgba(255,255,255,0.18) 1px, transparent 0)",
              backgroundSize: "18px 18px",
            }}
          />
          <div className="absolute inset-0 flex items-center justify-center pt-1">
            <ProductArt kind={kind} name={name} accent={palette.accent} />
          </div>
          <div className="absolute left-3 top-3">
            <span
              className="rounded-full border px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.18em] text-white/80 backdrop-blur-sm"
              style={{ borderColor: `${palette.accent}55`, background: "rgba(0,0,0,0.28)" }}
            >
              {kind === "generic" ? "PART" : kind}
            </span>
          </div>
        </div>
      )}

      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />

      {unit && (
        <span className="absolute bottom-2 left-2 rounded-full border border-white/15 bg-black/45 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-amber-100/90 backdrop-blur-sm">
          {unit}
        </span>
      )}
    </div>
  );
}
