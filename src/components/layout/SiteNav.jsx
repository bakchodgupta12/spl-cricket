import { Link } from 'react-router-dom'

export default function SiteNav() {
  return (
    <nav
      style={{
        background: 'var(--color-surface)',
        borderBottom: '1px solid var(--color-border)',
      }}
      className="px-4 sm:px-6 py-2 flex items-center gap-3"
    >
      <Link to="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
        <img
          src="/spl-logo.svg"
          alt="SPL"
          style={{ height: '32px', width: 'auto' }}
        />
        <span
          style={{ color: 'var(--color-heading)' }}
          className="font-semibold text-sm tracking-tight hidden sm:inline"
        >
          SPL Hub
        </span>
      </Link>
    </nav>
  )
}
