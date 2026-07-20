export default function Schedule() {
  return (
    <div className="relative w-screen h-screen overflow-hidden bg-bg px-[6vw] py-[8vh]">
      <div className="flex items-center gap-[1vw] mb-[1.5vh]">
        <div className="h-[0.7vh] w-[3vw] bg-accent" />
        <span className="font-body font-semibold tracking-[0.3em] text-[1.3vw] text-muted uppercase">
          Tagesablauf
        </span>
      </div>
      <h2 className="font-display font-700 uppercase text-text text-[4.5vw] leading-none tracking-tight">
        Ein durchgetakteter Tag
      </h2>

      <div className="relative mt-[7vh] pl-[2vw]">
        <div className="absolute left-[0.6vw] top-[1vh] bottom-[1vh] w-[0.3vw] bg-line" />

        <div className="relative flex items-center gap-[2.5vw] mb-[4vh]">
          <div className="absolute -left-[1.6vw] w-[1.4vw] h-[1.4vw] rounded-full bg-primary" />
          <div className="font-display font-700 text-primary text-[2vw] w-[10vw] shrink-0">
            Vormittag
          </div>
          <p className="font-body text-[1.6vw] text-text">
            Check-in der Teams, Eroffnung und Start der ersten Disziplinen
          </p>
        </div>

        <div className="relative flex items-center gap-[2.5vw] mb-[4vh]">
          <div className="absolute -left-[1.6vw] w-[1.4vw] h-[1.4vw] rounded-full bg-accent" />
          <div className="font-display font-700 text-accent text-[2vw] w-[10vw] shrink-0">
            Mittag
          </div>
          <p className="font-body text-[1.6vw] text-text">
            Gestaffelte Mittagspause - Teams versetzt, damit der Wettkampf
            weiterlauft
          </p>
        </div>

        <div className="relative flex items-center gap-[2.5vw] mb-[4vh]">
          <div className="absolute -left-[1.6vw] w-[1.4vw] h-[1.4vw] rounded-full bg-primary" />
          <div className="font-display font-700 text-primary text-[2vw] w-[10vw] shrink-0">
            Nachmittag
          </div>
          <p className="font-body text-[1.6vw] text-text">
            Restliche Disziplinen, Duelle und Aufholjagd in der Rangliste
          </p>
        </div>

        <div className="relative flex items-center gap-[2.5vw]">
          <div className="absolute -left-[1.6vw] w-[1.4vw] h-[1.4vw] rounded-full bg-text" />
          <div className="font-display font-700 text-text text-[2vw] w-[10vw] shrink-0">
            Finale
          </div>
          <p className="font-body text-[1.6vw] text-text">
            Ehrung der Sieger und gemeinsamer Ausklang
          </p>
        </div>
      </div>

      <p className="font-body text-[1.35vw] text-muted mt-[6vh] max-w-[60vw]">
        Der Zeitplan wird automatisch erstellt - inklusive Pausen und
        gestaffelter Mittagspause, damit Feld und Teams optimal ausgelastet
        sind.
      </p>
    </div>
  );
}
