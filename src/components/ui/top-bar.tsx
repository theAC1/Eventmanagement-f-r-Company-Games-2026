/**
 * Topbar der Desktop-Screens: 60px, Titel links, Meta/Aktionen rechts.
 * Auf schmalen Screens bricht der Inhalt in zwei Zeilen um.
 */
export function TopBar({
  title,
  children,
  className = "",
}: {
  title: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`flex min-h-[60px] flex-wrap items-center gap-x-4 gap-y-2 border-b border-line px-4 py-2 sm:px-[22px] ${className}`}
    >
      <h2 className="text-lg font-semibold tracking-[-0.02em] text-ink">{title}</h2>
      {children}
    </div>
  );
}

export function TopBarDivider() {
  return <span className="hidden h-6 w-px bg-line sm:block" aria-hidden />;
}

export function TopBarSpacer() {
  return <span className="flex-1" aria-hidden />;
}
