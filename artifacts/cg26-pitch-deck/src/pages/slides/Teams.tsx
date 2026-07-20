const base = import.meta.env.BASE_URL;

export default function Teams() {
  return (
    <div className="relative w-screen h-screen overflow-hidden bg-bg flex">
      <div className="w-[48vw] h-full relative">
        <img
          src={`${base}hero-teams.jpg`}
          crossOrigin="anonymous"
          alt="Team Huddle"
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-transparent to-bg" />
      </div>

      <div className="flex-1 h-full flex flex-col justify-center px-[5vw]">
        <div className="flex items-center gap-[1vw] mb-[2vh]">
          <div className="h-[0.7vh] w-[3vw] bg-accent" />
          <span className="font-body font-semibold tracking-[0.3em] text-[1.3vw] text-muted uppercase">
            Teamstruktur
          </span>
        </div>
        <h2 className="font-display font-700 uppercase text-text text-[4.5vw] leading-none tracking-tight">
          Farbe bekennen
        </h2>
        <p className="font-body text-[1.7vw] text-muted mt-[3vh] leading-relaxed text-pretty max-w-[38vw]">
          Jede Abteilung wird zum Team - mit eigenem Namen, Nummer und
          Teamfarbe. Diese Identitat zieht sich durch den ganzen Tag: vom
          Trikot bis zur Live-Rangliste.
        </p>

        <div className="mt-[5vh] space-y-[3vh]">
          <div className="flex items-start gap-[2vw]">
            <div className="w-[1vw] h-[7vh] bg-primary shrink-0" />
            <div>
              <div className="font-display font-600 text-text text-[2vw] uppercase">
                Name & Farbe
              </div>
              <p className="font-body text-[1.4vw] text-muted">
                Wiedererkennbar auf Feld und Scoreboard
              </p>
            </div>
          </div>
          <div className="flex items-start gap-[2vw]">
            <div className="w-[1vw] h-[7vh] bg-accent shrink-0" />
            <div>
              <div className="font-display font-600 text-text text-[2vw] uppercase">
                QR-Check-in
              </div>
              <p className="font-body text-[1.4vw] text-muted">
                Schneller Team-Check-in pro Disziplin per QR-Code
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
