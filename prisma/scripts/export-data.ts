/* Exporte le contenu actuel de la base locale (SQLite) vers prisma/seed-data.json.
   Ce fichier est ensuite lu à la mise en ligne (Vercel + Neon) par
   scripts/seed-cloud.mjs pour remplir automatiquement la base cloud.
   → Les dons (Donation) ne sont PAS exportés : données personnelles. */
import { PrismaClient } from '@prisma/client'
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'

const db = new PrismaClient()

async function main() {
  const [events, audios] = await Promise.all([
    db.mosqueEvent.findMany({ orderBy: { id: 'asc' } }),
    db.mosqueAudio.findMany({ orderBy: { id: 'asc' } }),
  ])

  const payload = {
    exportedAt: new Date().toISOString(),
    events: events.map(e => ({
      ...e,
      date: e.date.toISOString(),
      createdAt: e.createdAt.toISOString(),
      updatedAt: e.updatedAt.toISOString(),
    })),
    audios: audios.map(a => ({
      ...a,
      createdAt: a.createdAt.toISOString(),
    })),
  }

  const out = join(process.cwd(), 'prisma', 'seed-data.json')
  writeFileSync(out, JSON.stringify(payload, null, 2), 'utf8')
  console.log(`OK — exporté : ${events.length} événement(s), ${audios.length} audio(s) → ${out}`)
}

main()
  .catch(err => { console.error('Erreur export :', err); process.exit(1) })
  .finally(() => db.$disconnect())
