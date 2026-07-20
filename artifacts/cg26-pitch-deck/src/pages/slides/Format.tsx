export default function Format() {
  return (
    <div className="relative w-screen h-screen overflow-hidden bg-bg px-[6vw] py-[8vh]">
      <div className="flex items-center gap-[1vw] mb-[1.5vh]">
        <div className="h-[0.7vh] w-[3vw] bg-accent" />
        <span className="font-body font-semibold tracking-[0.3em] text-[1.3vw] text-muted uppercase">
          Spielformat
        </span>
      </div>
      <h2 className="font-display font-700 uppercase text-text text-[4.5vw] leading-none tracking-tight">
        Disziplinen in zwei Modi
      </h2>

      <div className="grid grid-cols-2 gap-[3vw] mt-[6vh]">
        <div className="bg-bg2 border-t-[0.5vh] border-primary p-[3vw]">
          <div className="font-display font-700 text-primary text-[2.6vw] uppercase tracking-wide">
            Solo
          </div>
          <p className="font-body text-[1.6vw] text-muted mt-[1.5vh] leading-relaxed text-pretty">
            Jedes Team stellt sich der Disziplin allein. Gewertet wird die
            eigene Leistung - Zeit, Weite oder Punkte.
          </p>
          <div className="mt-[3vh] space-y-[1.5vh] font-body text-[1.5vw] text-text">
            <div className="flex items-center gap-[1vw]">
              <span className="text-primary">-</span> Eigene Bestleistung zahlt
            </div>
            <div className="flex items-center gap-[1vw]">
              <span className="text-primary">-</span> Faire Wertung fur alle Teams
            </div>
            <div className="flex items-center gap-[1vw]">
              <span className="text-primary">-</span> Parallel spielbar
            </div>
          </div>
        </div>

        <div className="bg-bg2 border-t-[0.5vh] border-accent p-[3vw]">
          <div className="font-display font-700 text-accent text-[2.6vw] uppercase tracking-wide">
            Duell
          </div>
          <p className="font-body text-[1.6vw] text-muted mt-[1.5vh] leading-relaxed text-pretty">
            Zwei Teams treten direkt gegeneinander an. Kopf an Kopf, mit klarem
            Sieger pro Begegnung.
          </p>
          <div className="mt-[3vh] space-y-[1.5vh] font-body text-[1.5vw] text-text">
            <div className="flex items-center gap-[1vw]">
              <span className="text-accent">-</span> Direkter Wettkampf
            </div>
            <div className="flex items-center gap-[1vw]">
              <span className="text-accent">-</span> Spannung fur Zuschauer
            </div>
            <div className="flex items-center gap-[1vw]">
              <span className="text-accent">-</span> Klare Sieger je Runde
            </div>
          </div>
        </div>
      </div>

      <p className="font-body text-[1.4vw] text-muted mt-[5vh]">
        Jede Disziplin hat eine feste Spielzeit und eine hinterlegte
        Wertungslogik - vom Zeitrennen bis zum Punktespiel.
      </p>
    </div>
  );
}
