import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { LogOut, Users, LayoutDashboard, Briefcase } from 'lucide-react'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: recruiter } = await supabase.from('recruiters').select('full_name, company_name').eq('id', user.id).single()

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <aside className="w-56 bg-white border-r border-gray-100 flex flex-col">
        <div className="px-5 py-5 border-b border-gray-100">
          <span className="text-xl font-bold text-blue-700">Doqit</span>
          <p className="text-xs text-gray-400 mt-1">{recruiter?.company_name}</p>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1">
          {[
            { href: '/dashboard', icon: LayoutDashboard, label: 'Inicio' },
            { href: '/dashboard/candidates', icon: Users, label: 'Candidatos' },
            { href: '/dashboard/positions', icon: Briefcase, label: 'Posiciones' },
          ].map(({ href, icon: Icon, label }) => (
            <Link key={href} href={href} className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-50 hover:text-gray-900">
              <Icon size={16} />
              {label}
            </Link>
          ))}
        </nav>
        <div className="px-3 py-4 border-t border-gray-100">
          <p className="text-xs text-gray-500 px-3 mb-2">{recruiter?.full_name}</p>
          <form action="/api/auth/signout" method="POST">
            <button type="submit" className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-500 hover:text-gray-900 w-full">
              <LogOut size={16} /> Salir
            </button>
          </form>
        </div>
      </aside>
      {/* Main */}
      <main className="flex-1 p-8 overflow-auto">{children}</main>
    </div>
  )
}
