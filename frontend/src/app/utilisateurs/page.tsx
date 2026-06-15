'use client';
import { useEffect, useState } from 'react';
import { apiFetch, getUtilisateur } from '@/lib/auth';
import { useRouter } from 'next/navigation';

const DIRECTIONS = [
  'Direction Générale',
  'Direction des Études et de la Scolarité',
  'Direction Administrative et Financière',
  'Direction des Ressources Humaines',
  'Direction de la Recherche',
  'Direction des Infrastructures',
  'Direction Informatique et Numérique',
  'Service Juridique',
];

const emptyForm = {
  nom: '', prenom: '', email: '',
  mot_de_passe: '', role: 'agent', direction: DIRECTIONS[0],
};

export default function Utilisateurs() {
  const router = useRouter();
  const user = getUtilisateur();

  useEffect(() => {
    if (user?.role !== 'admin') router.push('/');
  }, []);

  const [liste,      setListe]      = useState<any[]>([]);
  const [showForm,   setShowForm]   = useState(false);
  const [form,       setForm]       = useState<any>(emptyForm);
  const [saving,     setSaving]     = useState(false);
  const [erreur,     setErreur]     = useState('');
  const [succes,     setSucces]     = useState('');

  const charger = async () => {
    const data = await apiFetch('/auth/utilisateurs').catch(() => []);
    setListe(Array.isArray(data) ? data : []);
  };

  useEffect(() => { charger(); }, []);

  const creer = async (e: React.FormEvent) => {
    e.preventDefault();
    setErreur(''); setSucces(''); setSaving(true);
    try {
      await apiFetch('/auth/utilisateurs', {
        method: 'POST', body: JSON.stringify(form),
      });
      setSucces(`✅ Compte créé pour ${form.prenom} ${form.nom}`);
      setForm(emptyForm);
      setShowForm(false);
      charger();
    } catch (err: any) {
      setErreur(err.message);
    } finally {
      setSaving(false);
    }
  };

  const toggle = async (id: string, nom: string, actif: boolean) => {
    if (!confirm(`${actif ? 'Désactiver' : 'Réactiver'} le compte de ${nom} ?`)) return;
    try {
      await apiFetch(`/auth/utilisateurs/${id}/toggle`, { method: 'PATCH' });
      charger();
    } catch (err: any) { alert(err.message); }
  };

  const roleColors: any = {
    admin: 'bg-red-100 text-red-800',
    validateur: 'bg-amber-100 text-amber-800',
    agent: 'bg-blue-100 text-blue-800',
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-lg font-bold text-gray-800">
          👥 Gestion des utilisateurs
        </h1>
        <button
          className="btn-primary"
          onClick={() => { setShowForm(!showForm); setErreur(''); setSucces(''); }}
        >
          {showForm ? '✕ Fermer' : '+ Nouveau compte'}
        </button>
      </div>

      {succes && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-4 text-green-700 text-sm">
          {succes}
        </div>
      )}

      {/* Formulaire création */}
      {showForm && (
        <div className="card mb-4">
          <h2 className="text-sm font-semibold text-gray-600 mb-4">
            Créer un nouveau compte
          </h2>
          <form onSubmit={creer} className="space-y-3">
            {erreur && (
              <div className="bg-red-50 border border-red-200 rounded p-2 text-red-600 text-xs">
                ⚠️ {erreur}
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="form-label">Prénom *</label>
                <input className="form-input" value={form.prenom} required
                  onChange={e => setForm({ ...form, prenom: e.target.value })}
                  placeholder="Fatimata" />
              </div>
              <div>
                <label className="form-label">Nom *</label>
                <input className="form-input" value={form.nom} required
                  onChange={e => setForm({ ...form, nom: e.target.value })}
                  placeholder="OUÉDRAOGO" />
              </div>
            </div>

            <div>
              <label className="form-label">Email *</label>
              <input type="email" className="form-input" value={form.email} required
                onChange={e => setForm({ ...form, email: e.target.value })}
                placeholder="prenom.nom@univ-burkina.bf" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="form-label">Mot de passe * (min. 6 car.)</label>
                <input type="password" className="form-input" value={form.mot_de_passe} required
                  minLength={6}
                  onChange={e => setForm({ ...form, mot_de_passe: e.target.value })} />
              </div>
              <div>
                <label className="form-label">Rôle</label>
                <select className="form-input" value={form.role}
                  onChange={e => setForm({ ...form, role: e.target.value })}>
                  <option value="agent">Agent</option>
                  <option value="validateur">Validateur</option>
                  <option value="admin">Administrateur</option>
                </select>
              </div>
            </div>

            <div>
              <label className="form-label">Direction</label>
              <select className="form-input" value={form.direction}
                onChange={e => setForm({ ...form, direction: e.target.value })}>
                {DIRECTIONS.map(d => <option key={d}>{d}</option>)}
              </select>
            </div>

            {/* Explication des rôles */}
            <div className="bg-gray-50 rounded-lg p-3 text-xs text-gray-500 space-y-1">
              <p><strong className="text-red-600">Admin</strong> — Tous les droits, création de comptes, suppression et clôture de tous les dossiers</p>
              <p><strong className="text-amber-600">Validateur</strong> — Peut clôturer les dossiers</p>
              <p><strong className="text-blue-600">Agent</strong> — Consultation et création de dossiers uniquement</p>
            </div>

            <div className="flex justify-end gap-3">
              <button type="button" className="btn-secondary"
                onClick={() => setShowForm(false)}>
                Annuler
              </button>
              <button type="submit" className="btn-primary" disabled={saving}>
                {saving ? 'Création...' : '✓ Créer le compte'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Liste utilisateurs */}
      <div className="card p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: '#f8f9fa' }}>
              {['Nom','Email','Direction','Rôle','Statut','Actions'].map(h => (
                <th key={h} className="text-left px-4 py-3 text-xs text-gray-400 font-medium border-b border-gray-100">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {liste.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center py-10 text-gray-300">
                  Aucun utilisateur
                </td>
              </tr>
            ) : liste.map((u: any) => (
              <tr key={u.id}
                className={`border-b border-gray-50 hover:bg-gray-50 ${!u.actif ? 'opacity-50' : ''}`}>
                <td className="px-4 py-3 font-medium">
                  {u.prenom} {u.nom}
                </td>
                <td className="px-4 py-3 text-gray-500 text-xs">{u.email}</td>
                <td className="px-4 py-3 text-gray-500 text-xs">{u.direction}</td>
                <td className="px-4 py-3">
                  <span className={`badge ${roleColors[u.role] || 'badge-info'}`}>
                    {u.role}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className={`badge ${u.actif ? 'badge-success' : 'badge-danger'}`}>
                    {u.actif ? 'Actif' : 'Désactivé'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {u.id !== user?.id && (
                    <button
                      onClick={() => toggle(u.id, `${u.prenom} ${u.nom}`, u.actif)}
                      className={`text-xs ${u.actif ? 'text-red-400 hover:text-red-600' : 'text-green-600 hover:text-green-800'}`}
                    >
                      {u.actif ? 'Désactiver' : 'Réactiver'}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
