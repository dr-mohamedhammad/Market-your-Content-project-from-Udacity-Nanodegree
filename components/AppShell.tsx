"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useApp } from "./Providers";
import { IconBook, IconChart, IconHistory, IconHome, IconSettings } from "./Icons";

export function AppShell({ children, wide = false }: { children: React.ReactNode; wide?: boolean }) {
  const { t } = useApp();
  const path = usePathname();
  const items = [
    { href: "/", label: t.home, Icon: IconHome },
    { href: "/history", label: t.history, Icon: IconHistory },
    { href: "/vocabulary", label: t.vocabulary, Icon: IconBook },
    { href: "/progress", label: t.progress, Icon: IconChart },
    { href: "/settings", label: t.settings, Icon: IconSettings },
  ];
  const active = (href: string) => (href === "/" ? path === "/" : path.startsWith(href));
  return (
    <div className="min-h-dvh md:flex">
      <aside className="hidden md:flex md:w-60 md:flex-col md:gap-1 md:border-e border-soft md:p-4 md:sticky md:top-0 md:h-dvh">
        <div className="flex items-center gap-2 px-2 py-3 mb-4">
          <img src="/icons/icon-192.png" alt="" className="w-9 h-9 rounded-xl" />
          <span className="font-bold">{t.appName}</span>
        </div>
        {items.map(({ href, label, Icon }) => (
          <Link key={href} href={href} className={`flex items-center gap-3 rounded-xl px-3 py-2.5 font-medium transition ${active(href) ? "bg-brand-600 text-white" : "hover:bg-brand-500/10"}`}>
            <Icon /> {label}
          </Link>
        ))}
      </aside>
      <main className={`flex-1 mx-auto w-full ${wide ? "max-w-5xl" : "max-w-3xl"} px-4 pt-5 pb-28 md:pb-10 md:px-8`}>{children}</main>
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-30 border-t border-soft safe-bottom" style={{ background: "color-mix(in srgb, var(--card) 92%, transparent)", backdropFilter: "blur(12px)" }}>
        <div className="grid grid-cols-5">
          {items.map(({ href, label, Icon }) => (
            <Link key={href} href={href} className={`flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-medium ${active(href) ? "text-brand-600 dark:text-brand-400" : "muted"}`}>
              <Icon className="w-6 h-6" />
              {label}
            </Link>
          ))}
        </div>
      </nav>
    </div>
  );
}

export function PageTitle({ title, subtitle, action }: { title: string; subtitle?: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-end justify-between gap-3 mb-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        {subtitle && <p className="muted text-sm mt-1">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function Spinner({ className = "w-5 h-5" }: { className?: string }) {
  return <span className={`inline-block rounded-full border-2 border-current border-t-transparent animate-spin ${className}`} aria-hidden="true" />;
}

export function ErrorBox({ message, onRetry, retryLabel }: { message: string; onRetry?: () => void; retryLabel?: string }) {
  return (
    <div role="alert" className="rounded-2xl border border-red-300/60 bg-red-50 text-red-800 dark:bg-red-950/40 dark:text-red-200 dark:border-red-900 p-3 text-sm flex items-center justify-between gap-3">
      <span>{message}</span>
      {onRetry && <button className="btn btn-ghost !py-1.5 !min-h-0 text-sm" onClick={onRetry}>{retryLabel ?? "Retry"}</button>}
    </div>
  );
}
