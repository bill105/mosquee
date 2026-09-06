/* Remplit la base cloud (Neon/PostgreSQL) avec le contenu existant de la mosquée
   (événements + audios) — UNIQUEMENT si les tables sont encore vides.
   Exécuté automatiquement à chaque déploiement Vercel (voir vercel.json).
   → Idempotent : ne touche jamais aux données déjà présentes. */
import { PrismaClient } from '@prisma/client'
import { readFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const dataPath = join(here, '..', 'prisma', 'seed-data.json')

const db = new PrismaClient()

async function main() {
  if (!existsSync(dataPath)) {
    console.log('Info : prisma/seed-data.json absent — rien a importer.')
    return
  }
  const data = JSON.parse(readFileSync(dataPath, 'utf8'))

  if (Array.isArray(data.events) && data.events.length > 0) {
    const count = await db.mosqueEvent.count()
    if (count === 0) {
      await db.mosqueEvent.createMany({
        data: data.events.map(e => ({
          id: e.id,
          title: e.title,
          date: new Date(e.date),
          time: e.time ?? '',
          place: e.place ?? '',
          imageUrl: e.imageUrl ?? '',
          createdAt: new Date(e.createdAt),
          updatedAt: new Date(e.updatedAt),
        })),
      })
      // Après insertion avec des id explicites, on resynchronise le compteur auto-increment PostgreSQL
      await db.$executeRawUnsafe(
        `SELECT setval(pg_get_serial_sequence('"MosqueEvent"', 'id'), (SELECT COALESCE(MAX(id), 1) FROM "MosqueEvent"))`
      )
      console.log(`OK : ${data.events.length} evenement(s) importe(s).`)
    } else {
      console.log(`Info : evenements deja presents (${count}) — import ignore.`)
    }
  }

  if (Array.isArray(data.audios) && data.audios.length > 0) {
    const count = await db.mosqueAudio.count()
    if (count === 0) {
      await db.mosqueAudio.createMany({
        data: data.audios.map(a => ({
          id: a.id,
          title: a.title,
          audioUrl: a.audioUrl,
          createdAt: new Date(a.createdAt),
        })),
      })
      await db.$executeRawUnsafe(
        `SELECT setval(pg_get_serial_sequence('"MosqueAudio"', 'id'), (SELECT COALESCE(MAX(id), 1) FROM "MosqueAudio"))`
      )
      console.log(`OK : ${data.audios.length} audio(s) importe(s).`)
    } else {
      console.log(`Info : audios deja presents (${count}) — import ignore.`)
    }
  }
}

main()
  .then(() => console.log('OK : base de donnees prete.'))
  .catch(err => { console.error('Erreur import :', err); process.exit(1) })
  .finally(() => db.$disconnect())
