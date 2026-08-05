import { CheckCircle } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";

type SpeichernLeisteProps = {
  saveName: string;
  loading: boolean;
  loadedConfigId: string | null;
  saveMsg: string | null;
  onSaveNameChange: (val: string) => void;
  onSave: () => void;
  onSaveAsNew: () => void;
};

export function SpeichernLeiste({
  saveName,
  loading,
  loadedConfigId,
  saveMsg,
  onSaveNameChange,
  onSave,
  onSaveAsNew,
}: SpeichernLeisteProps) {
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-[10px] border border-line bg-surface p-3.5">
      <input
        type="text"
        value={saveName}
        onChange={(e) => onSaveNameChange(e.target.value)}
        placeholder="Name f&uuml;r diesen Zeitplan..."
        className="h-[38px] min-w-[200px] flex-1 rounded-[9px] border border-line-strong bg-sunken px-3 text-sm text-ink outline-none transition-colors duration-150 placeholder:text-faint focus:border-action"
      />
      <Button
        variant="primary"
        onClick={onSave}
        disabled={!saveName.trim() || loading}
      >
        {loadedConfigId ? "Aktualisieren" : "Speichern"}
      </Button>
      {loadedConfigId && (
        <Button variant="ghost" onClick={onSaveAsNew}>
          Als neu speichern
        </Button>
      )}
      {saveMsg && (
        <span className="flex items-center gap-1.5 text-[13px] text-done-tint">
          <CheckCircle size={15} weight="bold" />
          {saveMsg}
        </span>
      )}
    </div>
  );
}
