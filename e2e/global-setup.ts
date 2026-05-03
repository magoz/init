import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import { reset } from 'drizzle-seed'
import * as schema from '@/lib/services/db/schema'
import { ensureTestEnvironment } from './utils/ensure-test-environment'

const globalSetup = async () => {
  ensureTestEnvironment('Database reset')

  console.log('🧹 Resetting database...')

  // Use direct connection for reset (drizzle-seed doesn't support Effect-wrapped db)
  const sql = neon(process.env.DATABASE_URL!)
  const db = drizzle({ client: sql, relations: schema.relations })

  await reset(db, schema)

  console.log('✅ Database reset complete')
}

export default globalSetup
