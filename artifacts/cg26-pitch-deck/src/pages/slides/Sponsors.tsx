export default function Sponsors() {
  return (
    <div className="relative w-screen h-screen overflow-hidden bg-bg px-[6vw] py-[8vh]">
      <div className="flex items-center gap-[1vw] mb-[1.5vh]">
        <div className="h-[0.7vh] w-[3vw] bg-accent" />
        <span className="font-body font-semibold tracking-[0.3em] text-[1.3vw] text-muted uppercase">
          Fur Sponsoren
        </span>
      </div>
      <h2 className="font-display font-700 uppercase text-text text-[4.5vw] leading-none tracking-tight">
        Sichtbar, wo es zahlt
      </h2>

      <div className="grid grid-cols-3 gap-[2.5vw] mt-[7vh]">
        <div className="border border-line p-[2.5vw] h-[46vh] flex flex-col">
          <div className="font-display font-700 text-primary text-[3.5vw] leading-none">
            Reichweite
          </div>
          <p className="font-body text-[1.5vw] text-muted mt-[3vh] leading-relaxed text-pretty">
            Die gesamte Belegschaft an einem Tag - auf dem Feld, am Scoreboard
            und in der App.
          </p>
        </div>
        <div className="border border-line p-[2.5vw] h-[46vh] flex flex-col">
          <div className="font-display font-700 text-accent text-[3.5vw] leading-none">
            Praesenz
          </div>
          <p className="font-body text-[1.5vw] text-muted mt-[3vh] leading-relaxed text-pretty">
            Logo-Platzierung auf Trikots, Stationen, Live-Rangliste und im
            digitalen Scoreboard.
          </p>
        </div>
        <div className="border border-line p-[2.5vw] h-[46vh] flex flex-col">
          <div className="font-display font-700 text-text text-[3.5vw] leading-none">
            Wirkung
          </div>
          <p className="font-body text-[1.5vw] text-muted mt-[3vh] leading-relaxed text-pretty">
            Verbindung mit Teamgeist, Gesundheit und einer positiven
            Unternehmenskultur.
          </p>
        </div>
      </div>
    </div>
  );
}
