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
    <div className="flex items-center gap-3 border border-zinc-800 rounded-lg p-4">
      <input
        type="text"
        value={saveName}
        onChange={(e) => onSaveNameChange(e.target.value)}
        placeholder="Name fuer diesen Zeitplan..."
        className="flex-1 bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-zinc-500"
      />
      <button
        onClick={onSave}
        disabled={!saveName.trim() || loading}
        className="px-4 py-2 bg-white text-black text-sm font-medium rounded-lg hover:bg-zinc-200 transition disabled:opacity-50"
      >
        {loadedConfigId ? "Aktualisieren" : "Speichern"}
      </button>
      {loadedConfigId && (
        <button
          onClick={onSaveAsNew}
          className="px-3 py-2 text-xs text-zinc-500 hover:text-white transition"
        >
          Als neu speichern
        </button>
      )}
      {saveMsg && <span className="text-sm text-emerald-400">{saveMsg}</span>}
    </div>
  );
}
