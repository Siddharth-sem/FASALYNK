import pg from 'pg'

const { Pool } = pg

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
})

export async function checkDatabaseConnection() {
  const result = await pool.query('SELECT NOW() AS current_time')
  return result.rows[0].current_time
}