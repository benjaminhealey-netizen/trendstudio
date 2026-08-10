const TONES = {
  neutral: "border-[var(--color-edge)] text-[var(--color-mist)]",
  good: "border-[#2c5138] text-[#7ee2a0]",
  warn: "border-[#5c4a1c] text-[#e5c66b]",
  bad: "border-[#5c2626] text-[#f19393]",
} as const;

export type Tone = keyof typeof TONES;

export function StatusBadge({ label, tone = "neutral" }: { label: string; tone?: Tone }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-[0.08em] ${TONES[tone]}`}
    >
      {label}
    </span>
  );
}

export function toneForClientStatus(status: string): Tone {
  if (status === "live") return "good";
  if (status === "suspended") return "bad";
  if (status === "provisioning") return "warn";
  return "neutral";
}

export function toneForDeployment(status: string): Tone {
  if (status === "success") return "good";
  if (status === "failed") return "bad";
  return "warn";
}
