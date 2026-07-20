export default function Scoring() {
  return (
    <div className="relative w-screen h-screen overflow-hidden bg-bg2 px-[6vw] py-[8vh]">
      <div className="flex items-center gap-[1vw] mb-[1.5vh]">
        <div className="h-[0.7vh] w-[3vw] bg-accent" />
        <span className="font-body font-semibold tracking-[0.3em] text-[1.3vw] text-muted uppercase">
          Wertungssystem
        </span>
      </div>
      <h2 className="font-display font-700 uppercase text-text text-[4.5vw] leading-none tracking-tight">
        Punkte, die zahlen
      </h2>

      <div className="grid grid-cols-3 gap-[2.5vw] mt-[6vh]">
        <div className="bg-bg p-[2.5vw] border border-line">
          <div className="font-display font-700 text-primary text-[2.2vw] uppercase">
            Game-Punkte
          </div>
          <p className="font-body text-[1.45vw] text-muted mt-[1.5vh] leading-relaxed text-pretty">
            Die Rohleistung aus der Disziplin - Zeit, Weite oder erzielte
            Punkte je nach Spiel.
          </p>
        </div>
        <div className="bg-bg p-[2.5vw] border border-line">
          <div className="font-display font-700 text-accent text-[2.2vw] uppercase">
            Rang-Punkte
          </div>
          <p className="font-body text-[1.45vw] text-muted mt-[1.5vh] leading-relaxed text-pretty">
            Aus der Platzierung je Disziplin abgeleitet. Sie bilden die
            Grundlage der Gesamtwertung.
          </p>
        </div>
        <div className="bg-bg p-[2.5vw] border border-line">
          <div className="font-display font-700 text-text text-[2.2vw] uppercase">
            Rangliste
          </div>
          <p className="font-body text-[1.45vw] text-muted mt-[1.5vh] leading-relaxed text-pretty">
            Summe uber alle Disziplinen. Gleichstand wird uber die Anzahl der
            Top-Platzierungen aufgelost.
          </p>
        </div>
      </div>

      <div className="mt-[6vh] flex items-center gap-[3vw] bg-bg border-l-[0.6vh] border-primary px-[3vw] py-[3vh]">
        <div className="font-display font-700 text-primary text-[3vw] uppercase shrink-0">
          Fair by design
        </div>
        <p className="font-body text-[1.5vw] text-text leading-relaxed text-pretty">
          Hochste oder niedrigste Wertung gewinnt - je nach Disziplin frei
          konfigurierbar. So ist jedes Spiel korrekt und nachvollziehbar
          bewertet.
        </p>
      </div>
    </div>
  );
}
