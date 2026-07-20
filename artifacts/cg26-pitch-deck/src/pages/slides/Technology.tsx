const base = import.meta.env.BASE_URL;

export default function Technology() {
  return (
    <div className="relative w-screen h-screen overflow-hidden bg-bg flex">
      <div className="flex-1 h-full flex flex-col justify-center px-[6vw]">
        <div className="flex items-center gap-[1vw] mb-[2vh]">
          <div className="h-[0.7vh] w-[3vw] bg-accent" />
          <span className="font-body font-semibold tracking-[0.3em] text-[1.3vw] text-muted uppercase">
            Die Technologie
          </span>
        </div>
        <h2 className="font-display font-700 uppercase text-text text-[4.5vw] leading-none tracking-tight">
          Eine App fur den ganzen Tag
        </h2>
        <p className="font-body text-[1.7vw] text-muted mt-[3vh] leading-relaxed text-pretty max-w-[40vw]">
          Vom Check-in bis zur Siegerehrung lauft alles uber eine eigens
          gebaute Event-Plattform - live, mobil und ohne Zettelwirtschaft.
        </p>

        <div className="grid grid-cols-2 gap-[2vw] mt-[5vh] max-w-[42vw]">
          <div className="bg-bg2 border border-line p-[1.8vw]">
            <div className="font-display font-600 text-primary text-[1.7vw] uppercase">
              Live-Rangliste
            </div>
            <p className="font-body text-[1.3vw] text-muted mt-[1vh]">
              Automatische Aktualisierung fur alle sichtbar
            </p>
          </div>
          <div className="bg-bg2 border border-line p-[1.8vw]">
            <div className="font-display font-600 text-accent text-[1.7vw] uppercase">
              Ergebnis-Eingabe
            </div>
            <p className="font-body text-[1.3vw] text-muted mt-[1vh]">
              Schiedsrichter erfassen Ergebnisse direkt am Feld
            </p>
          </div>
          <div className="bg-bg2 border border-line p-[1.8vw]">
            <div className="font-display font-600 text-primary text-[1.7vw] uppercase">
              Zeitplan-Engine
            </div>
            <p className="font-body text-[1.3vw] text-muted mt-[1vh]">
              Automatische Spielplanung mit Pausen
            </p>
          </div>
          <div className="bg-bg2 border border-line p-[1.8vw]">
            <div className="font-display font-600 text-accent text-[1.7vw] uppercase">
              Situationsplan
            </div>
            <p className="font-body text-[1.3vw] text-muted mt-[1vh]">
              Interaktive Karte aller Stationen
            </p>
          </div>
        </div>
      </div>

      <div className="w-[38vw] h-full relative">
        <img
          src={`${base}hero-app.jpg`}
          crossOrigin="anonymous"
          alt="App auf dem Smartphone"
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-l from-transparent to-bg" />
      </div>
    </div>
  );
}
