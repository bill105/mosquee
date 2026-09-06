/* Seed des événements actuels du site (executé une fois : bun run prisma/seed-events.ts).
   Les 6 événements du site statique sont repris à l'identique ; l'année 2027 est
   utilisée pour qu'ils restent « à venir » (aujourd'hui : sept. 2026).
   Le script ne fait rien si la table contient déjà des événements. */
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

const EVENTS: Array<{ title: string; date: string; time: string; place: string }> = [
  { title: "Conférence : La famille en Islam", date: "2027-02-28", time: "18:30", place: "Salle principale" },
  { title: "Cercle d'étude du Coran", date: "2027-03-05", time: "14:00", place: "Salle de cours" },
  { title: "Khutba spéciale du vendredi", date: "2027-03-12", time: "13:15", place: "Mosquée — Hall" },
  { title: "Nuit de prière (Qiyam)", date: "2027-03-20", time: "02:00", place: "Mosquée — Hall" },
  { title: "Atelier Tajwid pour débutants", date: "2027-04-02", time: "16:00", place: "Salle de cours" },
  { title: "Distribution de repas (Sadaqa)", date: "2027-04-10", time: "12:00", place: "Cour de la mosquée" },
];

async function main() {
  const count = await db.mosqueEvent.count();
  if (count > 0) {
    console.log(`Seed ignoré : ${count} événement(s) déjà présent(s) en base.`);
    return;
  }
  for (const ev of EVENTS) {
    await db.mosqueEvent.create({
      data: { ...ev, date: new Date(`${ev.date}T00:00:00.000Z`) },
    });
  }
  console.log(`Seed OK : ${EVENTS.length} événements créés.`);
}

main()
  .catch((e) => {
    console.error("Seed échoué :", e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
