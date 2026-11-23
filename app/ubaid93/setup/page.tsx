export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { adminUserExists } from '../../../lib/admin/auth'
import s from '../admin.module.css'
import SetupForm from './SetupForm'

export default async function SetupPage() {
  const exists = await adminUserExists()
  if (exists) redirect('/ubaid93')

  return (
    <div className={s.authWrap}>
      <div className={`${s.panel} ${s.authCard}`}>
        <h1 className={s.title} style={{ fontSize: 20 }}>Create the admin account</h1>
        <p className={s.lede} style={{ marginBottom: 20, fontSize: 13 }}>
          This page works only until an account exists; after that it sends you to the console.
        </p>
        <SetupForm />
      </div>
    </div>
  )
}
