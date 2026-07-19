export type Wertungslogik = {
  typ: string;
  richtung?: "hoechster_gewinnt" | "niedrigster_gewinnt";
  messung?: string;
  strafen?: Record<string, number>;
  eingabefelder?: Array<{ name: string; label?: string }>;
  levels?: Array<{ name: string; grundpunkte: number }>;
  optionen?: Array<{ name: string; punkte_erfolg: number; punkte_fail: number }>;
};
