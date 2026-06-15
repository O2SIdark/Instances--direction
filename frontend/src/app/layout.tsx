import type { Metadata } from 'next';
import './globals.css';
import NavWrapper from './NavWrapper';

export const metadata: Metadata = {
  title: 'Suivi des Instances de la Direction — Burkina Faso',
  description: 'Tableau de bord de gestion des instances',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>
        <NavWrapper>{children}</NavWrapper>
      </body>
    </html>
  );
}
