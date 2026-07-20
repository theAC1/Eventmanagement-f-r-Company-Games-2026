export default function Overview() {
  return (
    <div className="relative w-screen h-screen overflow-hidden bg-bg px-[6vw] py-[8vh]">
      <div className="absolute top-0 right-0 h-full w-[38vw] bg-bg2" />
      <div className="absolute top-0 right-[38vw] h-full w-[0.4vw] bg-line" />

      <div className="relative z-10 h-full flex flex-col justify-center max-w-[52vw]">
        <div className="flex items-center gap-[1vw] mb-[2.5vh]">
          <div className="h-[0.7vh] w-[3vw] bg-accent" />
          <span className="font-body font-semibold tracking-[0.3em] text-[1.3vw] text-muted uppercase">
            Das Event
          </span>
        </div>
        <h2 className="font-display font-700 uppercase text-text text-[5vw] leading-[0.95] tracking-tight text-balance">
          Ein Tag. Ein Team. Ein Ziel.
        </h2>
        <p className="font-body text-[1.9vw] text-muted mt-[3vh] leading-relaxed text-pretty">
          Die Company Games bringen die gesamte Belegschaft an einem Tag
          zusammen - im sportlichen Wettkampf, abseits des Arbeitsalltags.
          Kollegen werden zu Teamkollegen, Abteilungsgrenzen verschwinden.
        </p>
      </div>

      <div className="absolute right-0 top-0 h-full w-[38vw] flex flex-col justify-center px-[4vw] gap-[5vh]">
        <div>
          <div className="font-display font-700 text-primary text-[5.5vw] leading-none">
            1
          </div>
          <p className="font-body text-[1.5vw] text-text mt-[0.5vh]">
            Event-Tag fur die ganze Firma
          </p>
        </div>
        <div>
          <div className="font-display font-700 text-accent text-[5.5vw] leading-none">
            2 Modi
          </div>
          <p className="font-body text-[1.5vw] text-text mt-[0.5vh]">
            Solo- und Duell-Disziplinen
          </p>
        </div>
        <div>
          <div className="font-display font-700 text-text text-[5.5vw] leading-none">
            Live
          </div>
          <p className="font-body text-[1.5vw] text-text mt-[0.5vh]">
            Wertung & Rangliste in Echtzeit
          </p>
        </div>
      </div>
    </div>
  );
}
