"use client";

const TABS = [
  { key: "uebersicht", label: "Übersicht" },
  { key: "aktivitaet", label: "Aktivität" },
  { key: "korrekturen", label: "Korrekturen" },
] as const;

type TabBarProps = {
  activeTab: string;
  onChange: (tab: string) => void;
};

export function TabBar({ activeTab, onChange }: TabBarProps) {
  return (
    <nav className="flex gap-6 border-b border-zinc-800">
      {TABS.map((tab) => {
        const isActive = activeTab === tab.key;
        return (
          <button
            key={tab.key}
            onClick={() => onChange(tab.key)}
            className={`pb-2.5 text-sm font-medium transition ${
              isActive
                ? "text-white border-b-2 border-white"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            {tab.label}
          </button>
        );
      })}
    </nav>
  );
}
