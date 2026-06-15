'use client';
import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/auth';

export default function Stats() {
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    apiFetch('/stats').then(setStats).catch(() => {});
  }, []);

  if (!stats) return (
    <div className="text-center py-20 text-gray-300">Chargement...</div>
  );

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total dossiers',      value: stats.total,              color: 'text-gray-800' },
          { label: 'Traités dans délai',  value: stats.boucles_dans_delais, color: 'text-green-700' },
          { label: 'En retard',           value: stats.en_retard,           color: 'text-red-600' },
          { label: 'Taux respect délais', value: `${stats.taux_delais}%`,   color: 'text-green-700' },
        ].map(c => (
          <div key={c.label} className="card text-center">
            <p className="text-xs text-gray-400 mb-1">{c.label}</p>
            <p className={`text-3xl font-bold ${c.color}`}>{c.value}</p>
          </div>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="card">
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">
            Répartition par instance
          </h3>
          <div className="space-y-3">
            {stats.parInstance?.map((item: any) => {
              const pct = stats.total
                ? Math.round((Number(item.count) / Number(stats.total)) * 100)
                : 0;
              return (
                <div key={item._id}>
                  <div className="flex justify-between text-xs text-gray-500 mb-1">
                    <span>{item._id}</span>
                    <span>{item.count} dossier{item.count > 1 ? 's' : ''}</span>
                  </div>
                  <div className="w-full h-2 bg-gray-100 rounded-full">
                    <div className="h-2 rounded-full"
                      style={{ width: `${pct}%`, background: '#009A44' }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="card">
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">
            Répartition par statut
          </h3>
          <div className="space-y-3">
            {stats.parStatut?.map((item: any) => {
              const colors: any = {
                'Bouclé':   '#009A44',
                'En cours': '#F59E0B',
                'En retard':'#EF4444',
                'Initié':   '#3B82F6',
              };
              const pct = stats.total
                ? Math.round((Number(item.count) / Number(stats.total)) * 100)
                : 0;
              return (
                <div key={item._id}>
                  <div className="flex justify-between text-xs text-gray-500 mb-1">
                    <span>{item._id}</span>
                    <span>{item.count} ({pct}%)</span>
                  </div>
                  <div className="w-full h-2 bg-gray-100 rounded-full">
                    <div className="h-2 rounded-full"
                      style={{ width: `${pct}%`, background: colors[item._id] || '#6B7280' }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
