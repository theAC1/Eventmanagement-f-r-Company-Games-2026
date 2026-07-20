const base = import.meta.env.BASE_URL;

export default function Title() {
  return (
    <div className="relative w-screen h-screen overflow-hidden bg-bg">
      <img
        src={`${base}hero-event.jpg`}
        crossOrigin="anonymous"
        alt="Company Games Event"
        className="absolute inset-0 w-full h-full object-cover"
      />
      <div className="absolute inset-0 bg-gradient-to-r from-bg via-bg/85 to-bg/20" />
      <div className="absolute inset-0 bg-gradient-to-t from-bg via-transparent to-bg/40" />

      <div className="absolute top-[8vh] left-[6vw] flex items-center gap-[1.5vw]">
        <img
          src={`${base}logo.png`}
          crossOrigin="anonymous"
          alt="Company Games Logo"
          className="h-[11vh] w-auto drop-shadow-2xl"
        />
      </div>

      <div className="absolute bottom-[12vh] left-[6vw] max-w-[62vw]">
        <div className="flex items-center gap-[1vw] mb-[2vh]">
          <div className="h-[0.7vh] w-[4vw] bg-accent" />
          <span className="font-body font-semibold tracking-[0.35em] text-[1.4vw] text-muted uppercase">
            Firmen-Sportevent
          </span>
        </div>
        <h1 className="font-display font-700 text-text uppercase leading-[0.92] tracking-tight text-[8.5vw]">
          Company Games
          <span className="text-primary"> 2026</span>
        </h1>
        <p className="font-body text-[2.2vw] text-text/90 mt-[2.5vh] max-w-[48vw] text-pretty">
          Deine Firma - mit Teamwork zum Erfolg.
        </p>
      </div>

      <div className="absolute bottom-[5vh] right-[6vw] text-right">
        <p className="font-body text-[1.3vw] text-muted uppercase tracking-widest">
          Pitch fur Sponsoren & Leitung
        </p>
      </div>
    </div>
  );
}
