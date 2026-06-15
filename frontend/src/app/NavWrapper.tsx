'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { getUtilisateur, clearSession, isLoggedIn } from '@/lib/auth';
import type { Utilisateur } from '@/lib/auth';

export default function NavWrapper({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<Utilisateur | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const u = getUtilisateur();
    setUser(u);
    if (!isLoggedIn() && pathname !== '/login') {
      router.push('/login');
    }
  }, [pathname]);

  function logout() {
    clearSession();
    router.push('/login');
  }

  if (pathname === '/login') return <>{children}</>;
  if (!mounted || !user) return null;

  const navLinks = [
    { href: '/', label: 'Tableau de bord' },
    { href: '/dossiers', label: 'Dossiers' },
    { href: '/stats', label: 'Statistiques' },
    { href: '/alertes', label: 'Alertes' },
    ...(user.role === 'admin'
      ? [{ href: '/utilisateurs', label: 'Utilisateurs' }]
      : []),
  ];

  return (
    <>
      <header style={{ background: '#EF2B2D', borderBottom: '3px solid #009A44' }}>
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <svg width="36" height="26" viewBox="0 0 36 26">
              <rect width="36" height="13" fill="#EF2B2D" />
              <rect y="13" width="36" height="13" fill="#009A44" />
              <polygon
                points="18,7 19.8,13 25,13 20.8,16.2 22.3,21 18,17.8 13.7,21 15.2,16.2 11,13 16.2,13"
                fill="#FCD116"
              />
            </svg>

            <div>
              <p className="text-white font-bold text-sm">
                Suivi des Instances de la Direction
              </p>
              <p className="text-red-100 text-xs">
                Burkina Faso
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <p className="text-white text-xs font-bold">
                {user.prenom} {user.nom}
              </p>
              <p className="text-red-200 text-xs">
                {user.role} — {user.direction}
              </p>
            </div>

            <button
              onClick={logout}
              className="text-white text-xs border border-white/30 px-3 py-1.5 rounded-lg"
            >
              Déconnexion
            </button>
          </div>
        </div>
      </header>

      <nav style={{ background: '#009A44' }}>
        <div className="max-w-7xl mx-auto px-4 flex gap-1">
          {navLinks.map(item => (
            <a
              key={item.href}
              href={item.href}
              className="text-sm px-4 py-3 text-white"
            >
              {item.label}
            </a>
          ))}
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 py-6">{children}</main>
    </>
  );
}
