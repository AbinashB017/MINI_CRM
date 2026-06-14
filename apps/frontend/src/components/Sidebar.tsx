import { NavLink, useLocation } from 'react-router-dom'
import {
  LayoutDashboard,
  Users,
  Target,
  Megaphone,
  Sparkles,
  Zap,
} from 'lucide-react'
import { clsx } from 'clsx'

const NAV_ITEMS = [
  { label: 'Dashboard',  href: '/dashboard',  icon: LayoutDashboard },
  { label: 'Customers',  href: '/customers',  icon: Users },
  { label: 'Segments',   href: '/segments',   icon: Target },
  { label: 'Campaigns',  href: '/campaigns',  icon: Megaphone },
  { label: 'AI Chat',    href: '/chat',       icon: Sparkles, highlight: true },
]

export default function Sidebar() {
  const location = useLocation()

  return (
    <aside className="w-60 bg-white border-r border-border flex flex-col h-screen sticky top-0">
      {/* Logo */}
      <div className="p-5 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-gradient-to-br from-primary to-primary-dark rounded-xl flex items-center justify-center shadow-sm">
            <Zap className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="font-bold text-text-primary text-sm leading-tight">Xeno CRM</div>
            <div className="text-text-muted text-xs">AI-Native Platform</div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon
          const isActive = location.pathname.startsWith(item.href)

          if (item.highlight) {
            return (
              <NavLink
                key={item.href}
                to={item.href}
                className={clsx(
                  'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all duration-150 mt-2',
                  isActive
                    ? 'bg-gradient-to-r from-primary to-primary-dark text-white shadow-md'
                    : 'bg-primary-light text-primary hover:bg-primary hover:text-white group'
                )}
              >
                <Icon className="w-4 h-4 flex-shrink-0" />
                <span>{item.label}</span>
                {!isActive && (
                  <span className="ml-auto text-xs bg-primary text-white px-1.5 py-0.5 rounded-full group-hover:bg-white group-hover:text-primary transition-colors">
                    NEW
                  </span>
                )}
              </NavLink>
            )
          }

          return (
            <NavLink
              key={item.href}
              to={item.href}
              className={clsx(
                'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150',
                isActive
                  ? 'bg-primary-light text-primary'
                  : 'text-text-muted hover:bg-surface hover:text-text-primary'
              )}
            >
              <Icon
                className={clsx(
                  'w-4 h-4 flex-shrink-0 transition-colors',
                  isActive ? 'text-primary' : 'text-text-muted'
                )}
              />
              <span>{item.label}</span>
              {isActive && (
                <span className="ml-auto w-1.5 h-1.5 rounded-full bg-primary" />
              )}
            </NavLink>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-border">
        <div className="flex items-center gap-2.5 px-2">
          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-primary-light to-primary flex items-center justify-center text-xs font-bold text-white">
            M
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-medium text-text-primary truncate">Marketer</div>
            <div className="text-xs text-text-muted truncate">Fashion Brand</div>
          </div>
        </div>
      </div>
    </aside>
  )
}
