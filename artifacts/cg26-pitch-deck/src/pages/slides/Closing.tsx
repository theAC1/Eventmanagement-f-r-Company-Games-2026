const base = import.meta.env.BASE_URL;

export default function Closing() {
  return (
    <div className="relative w-screen h-screen overflow-hidden bg-bg">
      <img
        src={`${base}hero-teams.jpg`}
        crossOrigin="anonymous"
        alt="Team"
        className="absolute inset-0 w-full h-full object-cover opacity-30"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-bg via-bg/90 to-bg/70" />

      <div className="relative z-10 h-full flex flex-col items-center justify-center text-center px-[8vw]">
        <img
          src={`${base}logo.png`}
          crossOrigin="anonymous"
          alt="Company Games Logo"
          className="h-[16vh] w-auto drop-shadow-2xl"
        />
        <h2 className="font-display font-700 uppercase text-text text-[6vw] leading-[0.95] tracking-tight mt-[4vh] text-balance">
          Werden Sie Teil von 2026
        </h2>
        <p className="font-body text-[2vw] text-muted mt-[3vh] max-w-[55vw] text-pretty">
          Als Partner, Sponsor oder Team - gestalten Sie den Tag mit, der Ihre
          Firma zusammenbringt.
        </p>
        <div className="flex items-center gap-[1vw] mt-[5vh]">
          <div className="h-[0.6vh] w-[3vw] bg-primary" />
          <span className="font-display font-600 text-[1.6vw] text-text uppercase tracking-[0.2em]">
            Deine Firma - mit Teamwork zum Erfolg
          </span>
          <div className="h-[0.6vh] w-[3vw] bg-accent" />
        </div>
      </div>
    </div>
  );
}
