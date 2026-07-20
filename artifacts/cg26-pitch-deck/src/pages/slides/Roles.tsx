export default function Roles() {
  return (
    <div className="relative w-screen h-screen overflow-hidden bg-bg2 px-[6vw] py-[8vh]">
      <div className="flex items-center gap-[1vw] mb-[1.5vh]">
        <div className="h-[0.7vh] w-[3vw] bg-accent" />
        <span className="font-body font-semibold tracking-[0.3em] text-[1.3vw] text-muted uppercase">
          Rollen & Zugriff
        </span>
      </div>
      <h2 className="font-display font-700 uppercase text-text text-[4.5vw] leading-none tracking-tight">
        Jeder mit klarer Aufgabe
      </h2>

      <div className="grid grid-cols-4 gap-[2vw] mt-[7vh]">
        <div className="bg-bg p-[2vw] border-t-[0.5vh] border-primary h-[42vh] flex flex-col">
          <div className="font-display font-700 text-primary text-[2vw] uppercase">
            Admin
          </div>
          <p className="font-body text-[1.35vw] text-muted mt-[2vh] leading-relaxed text-pretty">
            Spiele, Teams, Material und Situationsplan verwalten - die
            volle Kontrolle uber das Event.
          </p>
        </div>
        <div className="bg-bg p-[2vw] border-t-[0.5vh] border-accent h-[42vh] flex flex-col">
          <div className="font-display font-700 text-accent text-[2vw] uppercase">
            Orga
          </div>
          <p className="font-body text-[1.35vw] text-muted mt-[2vh] leading-relaxed text-pretty">
            Organisation und Koordination am Event-Tag, Uberblick uber den
            gesamten Ablauf.
          </p>
        </div>
        <div className="bg-bg p-[2vw] border-t-[0.5vh] border-primary h-[42vh] flex flex-col">
          <div className="font-display font-700 text-primary text-[2vw] uppercase">
            Schieds- richter
          </div>
          <p className="font-body text-[1.35vw] text-muted mt-[2vh] leading-relaxed text-pretty">
            Team-Check-in per QR und Ergebnis-Eingabe direkt an der
            Station.
          </p>
        </div>
        <div className="bg-bg p-[2vw] border-t-[0.5vh] border-accent h-[42vh] flex flex-col">
          <div className="font-display font-700 text-accent text-[2vw] uppercase">
            Helfer
          </div>
          <p className="font-body text-[1.35vw] text-muted mt-[2vh] leading-relaxed text-pretty">
            Unterstutzung an den Stationen und im Ablauf - dort, wo
            Hande gebraucht werden.
          </p>
        </div>
      </div>

      <p className="font-body text-[1.35vw] text-muted mt-[6vh]">
        Sichere Anmeldung mit rollenbasiertem Zugriff - jeder sieht genau das,
        was er fur seine Aufgabe braucht.
      </p>
    </div>
  );
}
