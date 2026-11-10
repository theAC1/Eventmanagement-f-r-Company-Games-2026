-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "GameTyp" AS ENUM ('RETURNEE', 'NEU');

-- CreateEnum
CREATE TYPE "GameStatus" AS ENUM ('ENTWURF', 'BEREIT', 'AKTIV', 'ABGESCHLOSSEN');

-- CreateEnum
CREATE TYPE "GameModus" AS ENUM ('SOLO', 'DUELL');

-- CreateEnum
CREATE TYPE "PersonRolle" AS ENUM ('ADMIN', 'ORGA', 'SCHIEDSRICHTER', 'HELFER');

-- CreateEnum
CREATE TYPE "MaterialKategorie" AS ENUM ('SPONSOR', 'MIETE', 'KAUF', 'EIGENBAU', 'VERBRAUCH', 'INFRASTRUKTUR');

-- CreateEnum
CREATE TYPE "MaterialStatus" AS ENUM ('OFFEN', 'ANGEFRAGT', 'BESTAETIGT', 'VORHANDEN', 'GELIEFERT');

-- CreateEnum
CREATE TYPE "SlotStatus" AS ENUM ('GEPLANT', 'AKTIV', 'ABGESCHLOSSEN');

-- CreateEnum
CREATE TYPE "InfraTyp" AS ENUM ('STROM', 'WASSER', 'WEG', 'PARKPLATZ', 'ZUSCHAUER', 'SANITAER', 'SONSTIGES');

-- CreateEnum
CREATE TYPE "GamedayModus" AS ENUM ('INAKTIV', 'TEST', 'HOT');

-- CreateEnum
CREATE TYPE "ErgebnisStatus" AS ENUM ('AUSSTEHEND', 'LAUFEND', 'EINGETRAGEN', 'VERIFIZIERT', 'KORRIGIERT');

-- CreateEnum
CREATE TYPE "VerifikationsMethode" AS ENUM ('QR_SCAN', 'MANUELL');

-- CreateTable
CREATE TABLE "Game" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "typ" "GameTyp" NOT NULL,
    "status" "GameStatus" NOT NULL DEFAULT 'ENTWURF',
    "kurzbeschreibung" TEXT,
    "modus" "GameModus" NOT NULL,
    "teamsProSlot" INTEGER NOT NULL DEFAULT 1,
    "einfuehrungMin" INTEGER NOT NULL DEFAULT 3,
    "playtimeMin" INTEGER NOT NULL DEFAULT 10,
    "reserveMin" INTEGER NOT NULL DEFAULT 2,
    "regeln" TEXT,
    "wertungstyp" TEXT,
    "wertungslogik" JSONB,
    "flaecheLaengeM" DOUBLE PRECISION,
    "flaecheBreiteM" DOUBLE PRECISION,
    "helferAnzahl" INTEGER NOT NULL DEFAULT 1,
    "stromNoetig" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Game_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GameVariante" (
    "id" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "beschreibung" TEXT,
    "istAktiv" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "GameVariante_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Team" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nummer" INTEGER NOT NULL,
    "captainName" TEXT,
    "captainEmail" TEXT,
    "farbe" TEXT NOT NULL DEFAULT '#6b7280',
    "logoUrl" TEXT,
    "motto" TEXT,
    "teilnehmerAnzahl" INTEGER,
    "teilnehmerNamen" JSONB,
    "qrToken" TEXT NOT NULL,
    "checkinCode" TEXT NOT NULL,
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Team_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Person" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "username" TEXT,
    "passwordHash" TEXT,
    "rolle" "PersonRolle" NOT NULL,
    "istAktiv" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Person_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MaterialItem" (
    "id" TEXT NOT NULL,
    "gameId" TEXT,
    "name" TEXT NOT NULL,
    "kategorie" "MaterialKategorie" NOT NULL,
    "menge" TEXT,
    "beschreibung" TEXT,
    "status" "MaterialStatus" NOT NULL DEFAULT 'OFFEN',
    "verantwortlichId" TEXT,
    "sponsor" TEXT,
    "kostenGeschaetzt" DECIMAL(10,2),
    "kostenEffektiv" DECIMAL(10,2),
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MaterialItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MaterialKommentar" (
    "id" TEXT NOT NULL,
    "materialId" TEXT NOT NULL,
    "autorId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MaterialKommentar_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ZeitplanConfig" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "anzahlTeams" INTEGER NOT NULL,
    "blockDauerMin" INTEGER NOT NULL DEFAULT 15,
    "wechselzeitMin" INTEGER NOT NULL DEFAULT 5,
    "startZeit" TEXT NOT NULL,
    "endZeit" TEXT NOT NULL,
    "pausen" JSONB NOT NULL DEFAULT '[]',
    "mittagspause" JSONB,
    "istAktiv" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ZeitplanConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ZeitplanSlot" (
    "id" TEXT NOT NULL,
    "configId" TEXT NOT NULL,
    "runde" INTEGER NOT NULL,
    "startZeit" TEXT NOT NULL,
    "endZeit" TEXT NOT NULL,
    "gameId" TEXT,
    "status" "SlotStatus" NOT NULL DEFAULT 'GEPLANT',
    "schiedsrichterId" TEXT,

    CONSTRAINT "ZeitplanSlot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ZeitplanSlotTeam" (
    "slotId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,

    CONSTRAINT "ZeitplanSlotTeam_pkey" PRIMARY KEY ("slotId","teamId")
);

-- CreateTable
CREATE TABLE "Situationsplan" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "hintergrundbildUrl" TEXT,
    "massstab" DOUBLE PRECISION,
    "istAktiv" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Situationsplan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GamePosition" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "x" DOUBLE PRECISION NOT NULL,
    "y" DOUBLE PRECISION NOT NULL,
    "rotation" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "nummer" TEXT NOT NULL DEFAULT '',
    "oeffentlich" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "GamePosition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomFeld" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "nummer" TEXT NOT NULL DEFAULT '',
    "farbe" TEXT NOT NULL DEFAULT '#6b7280',
    "breiteM" DOUBLE PRECISION NOT NULL DEFAULT 10,
    "laengeM" DOUBLE PRECISION NOT NULL DEFAULT 10,
    "x" DOUBLE PRECISION NOT NULL,
    "y" DOUBLE PRECISION NOT NULL,
    "rotation" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "oeffentlich" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "CustomFeld_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InfrastrukturElement" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "typ" "InfraTyp" NOT NULL,
    "label" TEXT,
    "x" DOUBLE PRECISION NOT NULL,
    "y" DOUBLE PRECISION NOT NULL,
    "oeffentlich" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "InfrastrukturElement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GamedayConfig" (
    "id" TEXT NOT NULL,
    "modus" "GamedayModus" NOT NULL DEFAULT 'INAKTIV',
    "startedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "startedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GamedayConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Ergebnis" (
    "id" TEXT NOT NULL,
    "zeitplanSlotId" TEXT,
    "gameId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "rohdaten" JSONB NOT NULL,
    "gamePunkte" DOUBLE PRECISION,
    "rangImGame" INTEGER,
    "rangPunkte" INTEGER,
    "status" "ErgebnisStatus" NOT NULL DEFAULT 'AUSSTEHEND',
    "eingetragenVonId" TEXT,
    "eingetragenUm" TIMESTAMP(3),
    "qrVerifiziert" BOOLEAN NOT NULL DEFAULT false,
    "qrTimestamp" TIMESTAMP(3),
    "istTest" BOOLEAN NOT NULL DEFAULT false,
    "commitId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Ergebnis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ErgebnisHistory" (
    "id" TEXT NOT NULL,
    "ergebnisId" TEXT NOT NULL,
    "vorher" JSONB,
    "nachher" JSONB NOT NULL,
    "gamePunkteVorher" DOUBLE PRECISION,
    "gamePunkteNachher" DOUBLE PRECISION,
    "statusVorher" "ErgebnisStatus",
    "statusNachher" "ErgebnisStatus" NOT NULL,
    "geaendertVonId" TEXT,
    "geaendertUm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "grund" TEXT,

    CONSTRAINT "ErgebnisHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QRVerifikation" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "zeitplanSlotId" TEXT NOT NULL,
    "schiedsrichterId" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "methode" "VerifikationsMethode" NOT NULL,

    CONSTRAINT "QRVerifikation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Game_slug_key" ON "Game"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Team_nummer_key" ON "Team"("nummer");

-- CreateIndex
CREATE UNIQUE INDEX "Team_qrToken_key" ON "Team"("qrToken");

-- CreateIndex
CREATE UNIQUE INDEX "Team_checkinCode_key" ON "Team"("checkinCode");

-- CreateIndex
CREATE UNIQUE INDEX "Person_username_key" ON "Person"("username");

-- CreateIndex
CREATE INDEX "MaterialItem_gameId_idx" ON "MaterialItem"("gameId");

-- CreateIndex
CREATE INDEX "MaterialItem_status_idx" ON "MaterialItem"("status");

-- CreateIndex
CREATE INDEX "ZeitplanSlot_configId_idx" ON "ZeitplanSlot"("configId");

-- CreateIndex
CREATE UNIQUE INDEX "GamePosition_planId_gameId_key" ON "GamePosition"("planId", "gameId");

-- CreateIndex
CREATE INDEX "Ergebnis_gameId_idx" ON "Ergebnis"("gameId");

-- CreateIndex
CREATE INDEX "Ergebnis_teamId_idx" ON "Ergebnis"("teamId");

-- CreateIndex
CREATE UNIQUE INDEX "Ergebnis_gameId_teamId_key" ON "Ergebnis"("gameId", "teamId");

-- CreateIndex
CREATE INDEX "ErgebnisHistory_ergebnisId_idx" ON "ErgebnisHistory"("ergebnisId");

-- CreateIndex
CREATE INDEX "ErgebnisHistory_geaendertUm_idx" ON "ErgebnisHistory"("geaendertUm");

-- AddForeignKey
ALTER TABLE "Game" ADD CONSTRAINT "Game_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "Person"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Game" ADD CONSTRAINT "Game_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "Person"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameVariante" ADD CONSTRAINT "GameVariante_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Team" ADD CONSTRAINT "Team_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "Person"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Team" ADD CONSTRAINT "Team_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "Person"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialItem" ADD CONSTRAINT "MaterialItem_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialItem" ADD CONSTRAINT "MaterialItem_verantwortlichId_fkey" FOREIGN KEY ("verantwortlichId") REFERENCES "Person"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialItem" ADD CONSTRAINT "MaterialItem_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "Person"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialItem" ADD CONSTRAINT "MaterialItem_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "Person"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialKommentar" ADD CONSTRAINT "MaterialKommentar_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "MaterialItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialKommentar" ADD CONSTRAINT "MaterialKommentar_autorId_fkey" FOREIGN KEY ("autorId") REFERENCES "Person"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ZeitplanSlot" ADD CONSTRAINT "ZeitplanSlot_configId_fkey" FOREIGN KEY ("configId") REFERENCES "ZeitplanConfig"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ZeitplanSlot" ADD CONSTRAINT "ZeitplanSlot_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ZeitplanSlot" ADD CONSTRAINT "ZeitplanSlot_schiedsrichterId_fkey" FOREIGN KEY ("schiedsrichterId") REFERENCES "Person"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ZeitplanSlotTeam" ADD CONSTRAINT "ZeitplanSlotTeam_slotId_fkey" FOREIGN KEY ("slotId") REFERENCES "ZeitplanSlot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ZeitplanSlotTeam" ADD CONSTRAINT "ZeitplanSlotTeam_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GamePosition" ADD CONSTRAINT "GamePosition_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Situationsplan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GamePosition" ADD CONSTRAINT "GamePosition_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomFeld" ADD CONSTRAINT "CustomFeld_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Situationsplan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InfrastrukturElement" ADD CONSTRAINT "InfrastrukturElement_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Situationsplan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GamedayConfig" ADD CONSTRAINT "GamedayConfig_startedById_fkey" FOREIGN KEY ("startedById") REFERENCES "Person"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ergebnis" ADD CONSTRAINT "Ergebnis_zeitplanSlotId_fkey" FOREIGN KEY ("zeitplanSlotId") REFERENCES "ZeitplanSlot"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ergebnis" ADD CONSTRAINT "Ergebnis_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ergebnis" ADD CONSTRAINT "Ergebnis_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ergebnis" ADD CONSTRAINT "Ergebnis_eingetragenVonId_fkey" FOREIGN KEY ("eingetragenVonId") REFERENCES "Person"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ErgebnisHistory" ADD CONSTRAINT "ErgebnisHistory_ergebnisId_fkey" FOREIGN KEY ("ergebnisId") REFERENCES "Ergebnis"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ErgebnisHistory" ADD CONSTRAINT "ErgebnisHistory_geaendertVonId_fkey" FOREIGN KEY ("geaendertVonId") REFERENCES "Person"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QRVerifikation" ADD CONSTRAINT "QRVerifikation_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QRVerifikation" ADD CONSTRAINT "QRVerifikation_zeitplanSlotId_fkey" FOREIGN KEY ("zeitplanSlotId") REFERENCES "ZeitplanSlot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QRVerifikation" ADD CONSTRAINT "QRVerifikation_schiedsrichterId_fkey" FOREIGN KEY ("schiedsrichterId") REFERENCES "Person"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
