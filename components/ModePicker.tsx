"use client";
import type { Dict } from "@/lib/i18n";
import type { Mode } from "@/lib/types";
import { useApp } from "./Providers";

export function modeLabel(m: Mode, t: Dict) {
  return m === "free" ? t.modeFree : m === "roleplay" ? t.modeRoleplay : t.modeIntensive;
}

const MODE_DESC: Record<Mode, { en: string; ar: string }> = {
  free: { en: "Natural chat on the topic", ar: "دردشة طبيعية حول الموضوع" },
  roleplay: { en: "Real-life situation, you play a role", ar: "موقف واقعي وتلعب دورًا" },
  intensive: { en: "Focused corrections & drills", ar: "تصحيحات وتمارين مركزة" },
};

export function ModePicker({ value, onChange }: { value: Mode; onChange: (m: Mode) => void }) {
  const { t, lang } = useApp();
  return (
    <div className="grid grid-cols-3 gap-2" role="radiogroup">
      {(["free", "roleplay", "intensive"] as Mode[]).map((m) => (
        <button
          key={m}
          role="radio"
          aria-checked={value === m}
          onClick={() => onChange(m)}
          className={`rounded-2xl border p-3 text-start transition ${value === m ? "border-brand-500 bg-brand-500/10 ring-2 ring-brand-500/30" : "border-soft hover:bg-brand-500/5"}`}
        >
          <span className="block font-semibold text-sm">{modeLabel(m, t)}</span>
          <span className="block text-[11px] muted mt-0.5 leading-snug">{MODE_DESC[m][lang]}</span>
        </button>
      ))}
    </div>
  );
}

export function ScoreBadge({ score }: { score: number }) {
  const cls = score >= 7.5 ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200" : score >= 5.5 ? "bg-brand-100 text-brand-800 dark:bg-brand-700/30 dark:text-brand-200" : "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200";
  return <span className={`rounded-full px-2.5 py-1 text-sm font-bold tabular-nums shrink-0 ${cls}`}>{score.toFixed(1)}</span>;
}
