"use client";

const TABS = [
  { key: "uebersicht", label: "Übersicht" },
  { key: "zeitachse", label: "Zeitachse" },
  { key: "aktivitaet", label: "Aktivität" },
  { key: "korrekturen", label: "Korrekturen" },
] as const;

type TabBarProps = {
  activeTab: string;
  onChange: (tab: string) => void;
};

/** Segmented Control gemäss Redesign: Track sunken, aktives Segment aktionsblau. */
export function TabBar({ activeTab, onChange }: TabBarProps) {
  return (
    <nav className="inline-flex rounded-[9px] border border-line-strong bg-sunken p-0.5">
      {TABS.map((tab) => {
        const isActive = activeTab === tab.key;
        return (
          <button
            key={tab.key}
            type="button"
            aria-pressed={isActive}
            onClick={() => onChange(tab.key)}
            className={`whitespace-nowrap rounded-[7px] px-3 py-[5px] text-xs transition-colors duration-150 ${
              isActive
                ? "bg-action font-semibold text-on-action"
                : "font-medium text-ink-3 hover:text-ink"
            }`}
          >
            {tab.label}
          </button>
        );
      })}
    </nav>
  );
}
