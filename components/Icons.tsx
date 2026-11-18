// Small inline icon set (stroke icons, 24×24) – no external icon dependency.
type P = { className?: string };
const base = (d: React.ReactNode, className = "w-5 h-5") => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">{d}</svg>
);
export const IconHome = ({ className }: P) => base(<><path d="M3 10.5 12 3l9 7.5" /><path d="M5 9.5V21h14V9.5" /><path d="M10 21v-6h4v6" /></>, className);
export const IconBook = ({ className }: P) => base(<><path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H20v17H6.5A2.5 2.5 0 0 0 4 21.5z" /><path d="M4 21.5V4.5" /><path d="M8 7h8M8 11h6" /></>, className);
export const IconLibrary = ({ className }: P) => base(<><path d="M4 19V5a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v14" /><path d="M9 19V7a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v12" /><path d="m14.5 6.5 3-1 3.5 13-3 1z" /><path d="M3 20h18" /></>, className);
export const IconHistory = ({ className }: P) => base(<><path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 3v5h5" /><path d="M12 7v5l3 2" /></>, className);
export const IconChart = ({ className }: P) => base(<><path d="M3 3v18h18" /><path d="m7 15 4-4 3 3 5-6" /></>, className);
export const IconSettings = ({ className }: P) => base(<><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" /></>, className);
export const IconMic = ({ className }: P) => base(<><rect x="9" y="2" width="6" height="12" rx="3" /><path d="M5 10a7 7 0 0 0 14 0" /><path d="M12 17v4M8 21h8" /></>, className);
export const IconStop = ({ className }: P) => base(<rect x="6" y="6" width="12" height="12" rx="2" />, className);
export const IconSend = ({ className }: P) => base(<><path d="M22 2 11 13" /><path d="M22 2 15 22l-4-9-9-4z" /></>, className);
export const IconPlay = ({ className }: P) => base(<><path d="M11 5 6 9H2v6h4l5 4z" /><path d="M15.5 8.5a5 5 0 0 1 0 7" /><path d="M19 5a10 10 0 0 1 0 14" /></>, className);
export const IconKeyboard = ({ className }: P) => base(<><rect x="2" y="6" width="20" height="12" rx="2" /><path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M7 14h10" /></>, className);
export const IconSpark = ({ className }: P) => base(<><path d="M12 3v4M12 17v4M3 12h4M17 12h4" /><path d="m5.6 5.6 2.8 2.8M15.6 15.6l2.8 2.8M5.6 18.4l2.8-2.8M15.6 8.4l2.8-2.8" /></>, className);
export const IconFlame = ({ className }: P) => base(<path d="M12 22c4 0 7-2.7 7-7 0-3-2-5.5-3.5-7-.3 2-1.5 3-2.5 3 .5-3-1-6-4-8 0 3-2 5-3.5 6.5C4.3 11.7 5 14 5 15c0 4.3 3 7 7 7z" />, className);
export const IconCheck = ({ className }: P) => base(<path d="m5 12 5 5L20 7" />, className);
export const IconX = ({ className }: P) => base(<path d="M18 6 6 18M6 6l12 12" />, className);
export const IconArrow = ({ className }: P) => base(<path d="M5 12h14M13 6l6 6-6 6" />, className);
export const IconBack = ({ className }: P) => base(<path d="M19 12H5M11 18l-6-6 6-6" />, className);
export const IconRefresh = ({ className }: P) => base(<><path d="M21 12a9 9 0 1 1-2.6-6.4L21 8" /><path d="M21 3v5h-5" /></>, className);
export const IconPlus = ({ className }: P) => base(<path d="M12 5v14M5 12h14" />, className);
export const IconTrash = ({ className }: P) => base(<><path d="M3 6h18M8 6V4h8v2M6 6l1 15h10l1-15" /></>, className);
export const IconClock = ({ className }: P) => base(<><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>, className);
