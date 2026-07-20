export default function Scoreboard() {
  return (
    <div className="relative w-screen h-screen overflow-hidden bg-bg px-[6vw] py-[8vh]">
      <div className="absolute top-[8vh] right-[6vw] flex items-center gap-[1vw]">
        <span className="w-[1.1vw] h-[1.1vw] rounded-full bg-accent" />
        <span className="font-body font-semibold text-[1.3vw] text-accent uppercase tracking-widest">
          Live
        </span>
      </div>

      <div className="flex items-center gap-[1vw] mb-[1.5vh]">
        <div className="h-[0.7vh] w-[3vw] bg-accent" />
        <span className="font-body font-semibold tracking-[0.3em] text-[1.3vw] text-muted uppercase">
          Scoreboard
        </span>
      </div>
      <h2 className="font-display font-700 uppercase text-text text-[4.5vw] leading-none tracking-tight">
        Spannung bis zur letzten Runde
      </h2>

      <div className="mt-[6vh] space-y-[1.6vh] max-w-[70vw]">
        <div className="flex items-center gap-[2vw] bg-bg2 border-l-[0.8vh] border-primary px-[2.5vw] py-[2.2vh]">
          <div className="font-display font-700 text-primary text-[3vw] w-[4vw]">1</div>
          <div className="w-[1.2vw] h-[1.2vw] rounded-full bg-primary" />
          <div className="font-display font-600 text-text text-[2.2vw] uppercase flex-1">
            Team Blau
          </div>
          <div className="font-display font-700 text-text text-[2.6vw]">248</div>
        </div>
        <div className="flex items-center gap-[2vw] bg-bg2 border-l-[0.8vh] border-accent px-[2.5vw] py-[2.2vh]">
          <div className="font-display font-700 text-accent text-[3vw] w-[4vw]">2</div>
          <div className="w-[1.2vw] h-[1.2vw] rounded-full bg-accent" />
          <div className="font-display font-600 text-text text-[2.2vw] uppercase flex-1">
            Team Rot
          </div>
          <div className="font-display font-700 text-text text-[2.6vw]">241</div>
        </div>
        <div className="flex items-center gap-[2vw] bg-bg2 border-l-[0.8vh] border-line px-[2.5vw] py-[2.2vh]">
          <div className="font-display font-700 text-muted text-[3vw] w-[4vw]">3</div>
          <div className="w-[1.2vw] h-[1.2vw] rounded-full bg-text" />
          <div className="font-display font-600 text-text text-[2.2vw] uppercase flex-1">
            Team Grun
          </div>
          <div className="font-display font-700 text-text text-[2.6vw]">227</div>
        </div>
      </div>

      <p className="font-body text-[1.35vw] text-muted mt-[6vh] max-w-[60vw]">
        Die Rangliste aktualisiert sich automatisch und ist fur alle sichtbar -
        so bleibt der Wettkampf bis zur letzten Disziplin offen. (Beispielhafte
        Darstellung.)
      </p>
    </div>
  );
}
