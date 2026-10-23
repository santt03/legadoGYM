import { pool, GYM_ID } from './db.js'

export async function notifyMember(memberId: string, type: 'MEMBERSHIP' | 'ROUTINE' | 'DIET' | 'ANNOUNCEMENT', title: string, body: string, dedupeKey: string) {
  await pool.query('INSERT INTO member_notifications (id,member_id,type,title,body,dedupe_key) VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (member_id,dedupe_key) DO NOTHING', [crypto.randomUUID(), memberId, type, title, body, dedupeKey])
}
export async function notifyActiveMembers(title: string, body: string, key: string) {
  const members = await pool.query<{ id: string }>('SELECT id FROM members WHERE gym_id=$1 AND inactive=false AND start_date<=CURRENT_DATE AND end_date>=CURRENT_DATE', [GYM_ID])
  await Promise.all(members.rows.map((member) => notifyMember(member.id, 'ANNOUNCEMENT', title, body, `announcement:${key}`)))
  return members.rowCount || 0
}
export async function ensureMembershipReminder(memberId: string, endDate: string, inactive: boolean) {
  if (inactive) return
  const today = new Date(); today.setHours(12, 0, 0, 0)
  const end = new Date(`${endDate.slice(0, 10)}T12:00:00`)
  const days = Math.round((end.getTime() - today.getTime()) / 86400000)
  if (![7, 3, 1, 0].includes(days)) return
  const label = days === 0 ? 'vence hoy' : days === 1 ? 'vence mañana' : `vence en ${days} días`
  await notifyMember(memberId, 'MEMBERSHIP', 'Tu membresía está por vencer', `Tu cuota ${label}. Consultá en recepción para renovarla.`, `membership:${endDate.slice(0, 10)}:${days}`)
}
