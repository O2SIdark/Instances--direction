'use client';
import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/auth';

export default function Dashboard() {
  const [stats,    setStats]    = useState<any>(null);
  const [dossiers, setDossiers] = useState<any[]>([]);
  const [loading,  setLoading]  = useState(true);

  useEffect(() => {
    Promise.all([
      apiFetch('/stats').catch(() => null),
      apiFetch('/dossiers').catch(() => []),
    ]).then(([s, d]) => {
      setStats(s);
      setDossiers(Array.isArray(d) ? d.slice(0, 5) : []);
      setLoading(false);
    });
  }, []);

  const badge = (s: string) => {
    const m: any = {
      'Bouclé':   'badge-success',
      'En cours': 'badge-warning',
      'En retard':'badge-danger',
      'Initié':   'badge-info',
    };
    return <span className={`badge ${m[s] || 'badge-info'}`}>{s}</span>;
  };

  if (loading) return (
    <div className="text-center py-20 text-gray-400">Chargement...</div>
  );

  return (
    <div>
      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total dossiers', value: stats?.total   ?? '—', color: 'text-gray-800' },
          { label: 'Bouclés',        value: stats?.boucles ?? '—', color: 'text-green-700' },
          { label: 'En cours',       value: stats?.en_cours ?? '—', color: 'text-amber-700' },
          { label: 'Taux délais',    value: stats ? `${stats.taux_delais}%` : '—', color: 'text-green-700' },
        ].map(c => (
          <div key={c.label} className="card">
            <p className="text-xs text-gray-500 mb-1">{c.label}</p>
            <p className={`text-3xl font-semibold ${c.color}`}>{c.value}</p>
          </div>
        ))}
      </div>

      {/* Dossiers récents */}
      <div className="card">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-600 uppercase tracking-wide">
            Dossiers récents
          </h2>
          <a href="/dossiers" className="text-xs text-green-700 hover:underline">
            Voir tout →
          </a>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100">
              {['Référence','Objet','Instance','Statut','Échéance'].map(h => (
                <th key={h} className="text-left py-2 text-xs text-gray-400 font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {dossiers.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-8 text-center text-gray-300 text-sm">
                  Aucun dossier
                </td>
              </tr>
            ) : dossiers.map((d: any) => (
              <tr key={d.id} className="border-b border-gray-50 hover:bg-gray-50">
                <td className="py-2 font-mono text-xs text-gray-600">{d.reference}</td>
                <td className="py-2 text-sm font-medium">{d.objet}</td>
                <td className="py-2 text-xs text-gray-500">{d.instance}</td>
                <td className="py-2">{badge(d.statut)}</td>
                <td className="py-2 text-xs text-gray-500">
                  {d.date_limite
                    ? new Date(d.date_limite).toLocaleDateString('fr-FR')
                    : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
