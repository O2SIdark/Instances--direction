'use client';
import { useEffect, useState, useCallback } from 'react';
import { apiFetch, getUtilisateur } from '@/lib/auth';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';
const BACKEND = API.replace('/api', '');

const INSTANCES = [
  "Conseil d'Administration",
  'Conseil Académique',
  'Conseil Scientifique',
  'Comité de Direction',
  'Comité Pédagogique',
  'Comité Informatique',
  'Réunion de Direction',
  'Commission des Marchés',
  'Conseil Disciplinaire',
  'Assemblée Générale du Personnel',
];

const DIRECTIONS = [
  'Direction Générale',
  'Direction des Études et de la Scolarité',
  'Direction Administrative et Financière',
  'Direction des Ressources Humaines',
  'Direction de la Recherche',
  'Direction des Infrastructures',
  'Direction Informatique et Numérique',
  'Service Juridique',
  'Scolarité Centrale',
  'Service Communication',
];

const emptyForm = {
  reference: '',
  objet: '',
  instance: INSTANCES[0],
  date_limite: '',
  niveau_mise_en_oeuvre: 0,
  description: '',
  intervenants: [{ nom: '', role: 'Responsable', direction: DIRECTIONS[0], email: '' }],
};

// ── Helpers hors composant ────────────────────────────────
function badge(s: string) {
  const m: Record<string, string> = {
    'Bouclé':    'badge-success',
    'En cours':  'badge-warning',
    'En retard': 'badge-danger',
    'Initié':    'badge-info',
  };
  return <span className={`badge ${m[s] || 'badge-info'}`}>{s}</span>;
}

function iconeFichier(type: string) {
  if (type?.includes('pdf'))   return '📄';
  if (type?.includes('image')) return '🖼️';
  if (type?.includes('word'))  return '📝';
  return '📎';
}

function tailleFormatee(octets: number) {
  if (octets < 1024)        return `${octets} o`;
  if (octets < 1024 * 1024) return `${(octets / 1024).toFixed(1)} Ko`;
  return `${(octets / 1024 / 1024).toFixed(1)} Mo`;
}

// ═════════════════════════════════════════════════════════
export default function Dossiers() {
  const user = getUtilisateur();

  const [dossiers,       setDossiers]       = useState<any[]>([]);
  const [loading,        setLoading]        = useState(true);
  const [filtreStatut,   setFiltreStatut]   = useState('');
  const [filtreInstance, setFiltreInstance] = useState('');
  const [recherche,      setRecherche]      = useState('');
  const [showModal,      setShowModal]      = useState(false);
  const [dossierDetail,  setDossierDetail]  = useState<any>(null);
  const [form,           setForm]           = useState<any>(emptyForm);
  const [saving,         setSaving]         = useState(false);
  const [erreur,         setErreur]         = useState('');
  const [uploadEnCours,  setUploadEnCours]  = useState(false);
  const [toast,          setToast]          = useState<{ msg: string; type: 'ok' | 'err' } | null>(null);

  // ── Toast ───────────────────────────────────────────────
  const afficherToast = (msg: string, type: 'ok' | 'err' = 'ok') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  // ── Charger la liste ────────────────────────────────────
  const charger = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filtreStatut)   params.set('statut',    filtreStatut);
      if (filtreInstance) params.set('instance',   filtreInstance);
      if (recherche)      params.set('recherche',  recherche);
      const data = await apiFetch(`/dossiers?${params}`);
      setDossiers(Array.isArray(data) ? data : []);
    } catch {
      setDossiers([]);
    }
    setLoading(false);
  }, [filtreStatut, filtreInstance, recherche]);

  useEffect(() => { charger(); }, [charger]);

  // ── Détail dossier ──────────────────────────────────────
  const ouvrirDetail = async (id: string) => {
    try {
      const d = await apiFetch(`/dossiers/${id}`);
      setDossierDetail(d);
    } catch {
      afficherToast('Erreur lors du chargement', 'err');
    }
  };

  const fermerDetail = () => setDossierDetail(null);

  // ── Créer dossier ───────────────────────────────────────
  const sauvegarder = async () => {
    setErreur('');
    if (!form.reference || !form.objet || !form.date_limite) {
      setErreur('Référence, objet et date limite sont obligatoires.');
      return;
    }
    setSaving(true);
    try {
      await apiFetch('/dossiers', {
        method: 'POST',
        body: JSON.stringify({
          ...form,
          intervenants: form.intervenants.filter((i: any) => i.nom.trim()),
        }),
      });
      setShowModal(false);
      setForm(emptyForm);
      afficherToast('✅ Dossier créé avec succès');
      charger();
    } catch (err: any) {
      setErreur(err.message);
    } finally {
      setSaving(false);
    }
  };

  // ── Supprimer ───────────────────────────────────────────
  const supprimer = async (id: string, objet: string) => {
    if (!confirm(`Supprimer définitivement "${objet}" ?`)) return;
    try {
      await apiFetch(`/dossiers/${id}`, { method: 'DELETE' });
      afficherToast('🗑 Dossier supprimé');
      if (dossierDetail?.id === id) fermerDetail();
      charger();
    } catch (err: any) {
      afficherToast(err.message, 'err');
    }
  };

  // ── Valider (admin ou créateur) ─────────────────────────
  const valider = async (id: string, objet: string) => {
    if (!confirm(`Valider et clôturer "${objet}" ? Cette action est irréversible.`)) return;
    try {
      await apiFetch(`/dossiers/${id}/valider`, { method: 'PATCH' });
      afficherToast('✅ Dossier validé — emails envoyés aux intervenants');
      if (dossierDetail?.id === id) await ouvrirDetail(id);
      charger();
    } catch (err: any) {
      afficherToast(err.message, 'err');
    }
  };

  // ── Upload fichier ──────────────────────────────────────
  const uploaderFichier = async (id: string, fichier: File) => {
    setUploadEnCours(true);
    try {
      const formData = new FormData();
      formData.append('fichier', fichier);
      const token = localStorage.getItem('token');
      const res = await fetch(`${API}/dossiers/${id}/fichiers`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      afficherToast('📎 Fichier ajouté avec succès');
      await ouvrirDetail(id);
    } catch (err: any) {
      afficherToast(err.message, 'err');
    } finally {
      setUploadEnCours(false);
    }
  };

  // ── Supprimer fichier ───────────────────────────────────
  const supprimerFichier = async (dossierId: string, nomServeur: string) => {
    if (!confirm('Supprimer ce fichier ?')) return;
    try {
      await apiFetch(`/dossiers/${dossierId}/fichiers/${nomServeur}`, {
        method: 'DELETE',
      });
      afficherToast('Fichier supprimé');
      await ouvrirDetail(dossierId);
    } catch (err: any) {
      afficherToast(err.message, 'err');
    }
  };

  // ── Export CSV ──────────────────────────────────────────
  const exporterCSV = () => {
    const token = localStorage.getItem('token');
    fetch(`${API}/dossiers/export/csv`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.blob())
      .then(blob => {
        const url  = URL.createObjectURL(blob);
        const a    = document.createElement('a');
        a.href     = url;
        a.download = `dossiers_${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        URL.revokeObjectURL(url);
      })
      .catch(() => afficherToast('Erreur export', 'err'));
  };

  // ── Helpers intervenants du formulaire ──────────────────
  const ajouterIntervenant = () =>
    setForm((f: any) => ({
      ...f,
      intervenants: [
        ...f.intervenants,
        { nom: '', role: 'Intervenant', direction: DIRECTIONS[0], email: '' },
      ],
    }));

  const majIntervenant = (idx: number, k: string, v: string) =>
    setForm((f: any) => ({
      ...f,
      intervenants: f.intervenants.map((iv: any, i: number) =>
        i === idx ? { ...iv, [k]: v } : iv
      ),
    }));

  // ── Droits ─────────────────────────────────────────────
  const peutSupprimer = (d: any) =>
    user?.role === 'admin' || d.cree_par === user?.id;

  const peutValider = (d: any) =>
    user?.role === 'admin' || d.cree_par === user?.id;

  // ═══════════════════════════════════════════════════════
  // RENDU
  // ═══════════════════════════════════════════════════════
  return (
    <div>

      {/* ── Filtres + actions ── */}
      <div className="flex flex-wrap gap-3 mb-4 items-center">

        <select
          className="form-input w-auto"
          value={filtreStatut}
          onChange={e => setFiltreStatut(e.target.value)}
        >
          <option value="">Tous les statuts</option>
          {['Initié', 'En cours', 'Bouclé', 'En retard'].map(s => (
            <option key={s}>{s}</option>
          ))}
        </select>

        <select
          className="form-input w-auto"
          value={filtreInstance}
          onChange={e => setFiltreInstance(e.target.value)}
        >
          <option value="">Toutes instances</option>
          {INSTANCES.map(i => <option key={i}>{i}</option>)}
        </select>

        <input
          className="form-input"
          style={{ maxWidth: 200 }}
          placeholder="🔍 Rechercher..."
          value={recherche}
          onChange={e => setRecherche(e.target.value)}
        />

        <span className="text-xs text-gray-400">
          {dossiers.length} dossier{dossiers.length > 1 ? 's' : ''}
        </span>

        <div className="flex gap-2 ml-auto">
          <button
            onClick={exporterCSV}
            className="btn-secondary"
            title="Exporter en CSV"
          >
            ⬇️ Exporter CSV
          </button>
          <button
            className="btn-primary"
            onClick={() => { setForm(emptyForm); setErreur(''); setShowModal(true); }}
          >
            + Nouveau dossier
          </button>
        </div>
      </div>

      {/* ── Tableau ── */}
      <div className="card p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: '#f8f9fa' }}>
              {['Référence', 'Objet', 'Instance', 'Date limite', 'Avancement', 'Statut', 'Actions'].map(h => (
                <th
                  key={h}
                  className="text-left px-4 py-3 text-xs text-gray-400 font-medium border-b border-gray-100"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} className="text-center py-12 text-gray-300">
                  Chargement...
                </td>
              </tr>
            ) : dossiers.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center py-12 text-gray-300">
                  Aucun dossier trouvé
                </td>
              </tr>
            ) : (
              dossiers.map((d: any) => {
                const jours = Math.ceil(
                  (new Date(d.date_limite).getTime() - Date.now()) / 86400000
                );
                const enRetard = d.statut !== 'Bouclé' && jours < 0;

                return (
                  <tr key={d.id} className="border-b border-gray-50 hover:bg-gray-50">

                    {/* Référence */}
                    <td className="px-4 py-3">
                      <p className="font-mono text-xs text-blue-700 font-bold">
                        {d.reference}
                      </p>
                      {(d.nb_alertes || 0) > 0 && (
                        <span className="badge badge-danger" style={{ fontSize: 10 }}>
                          🔔 {d.nb_alertes}
                        </span>
                      )}
                    </td>

                    {/* Objet */}
                    <td className="px-4 py-3">
                      <p className="font-medium text-sm leading-tight max-w-xs" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {d.objet}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {d.createur_prenom} {d.createur_nom}
                      </p>
                    </td>

                    {/* Instance */}
                    <td className="px-4 py-3">
                      <span className="bg-blue-50 text-blue-700 text-xs px-2 py-0.5 rounded">
                        {d.instance}
                      </span>
                    </td>

                    {/* Date limite */}
                    <td className="px-4 py-3">
                      <p className={`text-xs font-bold ${enRetard ? 'text-red-600' : 'text-gray-600'}`}>
                        {new Date(d.date_limite).toLocaleDateString('fr-FR')}
                      </p>
                      {d.statut !== 'Bouclé' && (
                        <p className={`text-xs mt-0.5 ${
                          enRetard ? 'text-red-500' : jours <= 7 ? 'text-amber-500' : 'text-gray-400'
                        }`}>
                          {enRetard ? `⚠️ ${Math.abs(jours)}j retard` : `${jours}j restants`}
                        </p>
                      )}
                    </td>

                    {/* Avancement */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-1.5 bg-gray-100 rounded-full">
                          <div
                            className="h-1.5 rounded-full transition-all"
                            style={{
                              width: `${d.niveau_mise_en_oeuvre || 0}%`,
                              background:
                                d.niveau_mise_en_oeuvre === 100 ? '#009A44' :
                                d.niveau_mise_en_oeuvre >= 50  ? '#F59E0B' : '#EF2B2D',
                            }}
                          />
                        </div>
                        <span className="text-xs text-gray-500 w-8">
                          {d.niveau_mise_en_oeuvre || 0}%
                        </span>
                      </div>
                    </td>

                    {/* Statut */}
                    <td className="px-4 py-3">{badge(d.statut)}</td>

                    {/* Actions */}
                    <td className="px-4 py-3">
                      <div className="flex gap-2 items-center flex-wrap">
                        <button
                          onClick={() => ouvrirDetail(d.id)}
                          className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                        >
                          👁 Voir
                        </button>
                        {peutValider(d) && d.statut !== 'Bouclé' && (
                          <button
                            onClick={() => valider(d.id, d.objet)}
                            className="text-xs text-green-600 hover:text-green-800 font-medium"
                          >
                            ✅ Valider
                          </button>
                        )}
                        {peutSupprimer(d) && (
                          <button
                            onClick={() => supprimer(d.id, d.objet)}
                            className="text-xs text-red-400 hover:text-red-600"
                          >
                            🗑
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* ════ PANNEAU DÉTAIL ════ */}
      {dossierDetail && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-end"
          style={{ background: 'rgba(0,0,0,0.5)' }}
        >
          <div
            className="bg-white flex flex-col"
            style={{ width: '100%', maxWidth: 680, minHeight: '100vh', overflowY: 'auto' }}
          >
            {/* Header */}
            <div
              style={{ background: 'linear-gradient(135deg,#EF2B2D,#009A44)', flexShrink: 0 }}
              className="p-5 flex items-start justify-between"
            >
              <div>
                <p className="text-white/70 text-xs font-mono mb-1">
                  {dossierDetail.reference}
                </p>
                <h2 className="text-white font-bold text-base leading-tight" style={{ maxWidth: 500 }}>
                  {dossierDetail.objet}
                </h2>
                <div className="flex gap-2 mt-2 flex-wrap">
                  {badge(dossierDetail.statut)}
                  {dossierDetail.valide_par_nom && (
                    <span className="badge badge-success">
                      ✅ Validé par {dossierDetail.valide_par_nom}
                    </span>
                  )}
                </div>
              </div>
              <button
                onClick={fermerDetail}
                className="text-white/70 hover:text-white ml-4"
                style={{ fontSize: 26, lineHeight: 1, background: 'none', border: 'none', cursor: 'pointer' }}
              >
                ×
              </button>
            </div>

            {/* Corps */}
            <div className="flex-1 p-5 space-y-5" style={{ overflowY: 'auto' }}>

              {/* Infos générales */}
              <div className="card">
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                  Informations générales
                </h3>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-xs text-gray-400">Instance</p>
                    <p className="font-medium">{dossierDetail.instance}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">Date limite</p>
                    <p className="font-medium">
                      {new Date(dossierDetail.date_limite).toLocaleDateString('fr-FR')}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 mb-1">Avancement</p>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-2 bg-gray-100 rounded-full">
                        <div
                          className="h-2 rounded-full"
                          style={{
                            width: `${dossierDetail.niveau_mise_en_oeuvre}%`,
                            background: '#009A44',
                          }}
                        />
                      </div>
                      <span className="text-xs font-bold text-gray-600">
                        {dossierDetail.niveau_mise_en_oeuvre}%
                      </span>
                    </div>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">Créé par</p>
                    <p className="font-medium">
                      {dossierDetail.createur_prenom} {dossierDetail.createur_nom}
                    </p>
                  </div>
                  {dossierDetail.date_fin_effective && (
                    <div>
                      <p className="text-xs text-gray-400">Date de clôture</p>
                      <p className="font-medium text-green-700">
                        {new Date(dossierDetail.date_fin_effective).toLocaleDateString('fr-FR')}
                      </p>
                    </div>
                  )}
                  {dossierDetail.valide_par_nom && (
                    <div>
                      <p className="text-xs text-gray-400">Validé par</p>
                      <p className="font-medium text-green-700">
                        {dossierDetail.valide_par_nom}
                      </p>
                    </div>
                  )}
                </div>
                {dossierDetail.description && (
                  <div className="mt-3 pt-3 border-t border-gray-100">
                    <p className="text-xs text-gray-400 mb-1">Description</p>
                    <p className="text-sm text-gray-700 leading-relaxed">
                      {dossierDetail.description}
                    </p>
                  </div>
                )}
              </div>

              {/* Intervenants */}
              <div className="card">
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                  Intervenants ({dossierDetail.intervenants?.length || 0})
                </h3>
                {!dossierDetail.intervenants?.length ? (
                  <p className="text-sm text-gray-300 italic">Aucun intervenant assigné</p>
                ) : (
                  <div className="space-y-2">
                    {dossierDetail.intervenants.map((iv: any) => (
                      <div
                        key={iv.id}
                        className="flex items-center justify-between bg-gray-50 rounded-lg p-3"
                      >
                        <div>
                          <p className="text-sm font-semibold">{iv.nom}</p>
                          <p className="text-xs text-gray-500">
                            {iv.role}{iv.direction ? ` — ${iv.direction}` : ''}
                          </p>
                          {iv.email && (
                            <p className="text-xs text-blue-600">{iv.email}</p>
                          )}
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-gray-400">Avancement</p>
                          <p className="text-sm font-bold text-green-700">{iv.avancement}%</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Tâches */}
              {(dossierDetail.taches?.length || 0) > 0 && (
                <div className="card">
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                    Tâches ({dossierDetail.taches.length})
                  </h3>
                  <div className="space-y-2">
                    {dossierDetail.taches.map((t: any) => (
                      <div
                        key={t.id}
                        className="flex items-center justify-between bg-gray-50 rounded-lg p-3"
                      >
                        <div>
                          <p className="text-sm font-medium">{t.titre}</p>
                          {t.responsable && (
                            <p className="text-xs text-gray-500">{t.responsable}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          {t.date_echeance && (
                            <span className="text-xs text-gray-400">
                              {new Date(t.date_echeance).toLocaleDateString('fr-FR')}
                            </span>
                          )}
                          <span className={`badge ${
                            t.statut === 'Terminée' ? 'badge-success' :
                            t.statut === 'En cours' ? 'badge-warning' : 'badge-info'
                          }`}>
                            {t.statut}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Fichiers */}
              <div className="card">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Fichiers ({dossierDetail.fichiers?.length || 0})
                  </h3>
                  <label
                    className="btn-secondary text-xs cursor-pointer"
                    style={{ padding: '4px 12px' }}
                  >
                    {uploadEnCours ? '⏳ Upload...' : '📎 Ajouter un fichier'}
                    <input
                      type="file"
                      className="hidden"
                      accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                      disabled={uploadEnCours}
                      onChange={e => {
                        const f = e.target.files?.[0];
                        if (f) uploaderFichier(dossierDetail.id, f);
                        e.target.value = '';
                      }}
                    />
                  </label>
                </div>

                {!dossierDetail.fichiers?.length ? (
                  <div className="text-center py-8">
                    <p style={{ fontSize: 36, marginBottom: 8 }}>📂</p>
                    <p className="text-sm text-gray-300">Aucun fichier joint</p>
                    <p className="text-xs text-gray-300 mt-1">PDF, Word, Images (max 10 Mo)</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {dossierDetail.fichiers.map((f: any, i: number) => (
                      <div
                        key={i}
                        className="flex items-center justify-between bg-gray-50 rounded-lg p-3 hover:bg-gray-100"
                        style={{ transition: 'background 0.15s' }}
                      >
                        <div className="flex items-center gap-3" style={{ minWidth: 0 }}>
                          <span style={{ fontSize: 22, flexShrink: 0 }}>
                            {iconeFichier(f.type)}
                          </span>
                          <div style={{ minWidth: 0 }}>
                            <a
                              href={`${BACKEND}${f.url}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-sm font-medium text-blue-700 hover:underline"
                              style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                            >
                              {f.nom}
                            </a>
                            <p className="text-xs text-gray-400">
                              {tailleFormatee(f.taille)} · {f.ajoute_par} ·{' '}
                              {new Date(f.date).toLocaleDateString('fr-FR')}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2" style={{ flexShrink: 0 }}>
                          <a
                            href={`${BACKEND}${f.url}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-blue-600 hover:text-blue-800"
                            title="Ouvrir"
                          >
                            ↗
                          </a>
                          <button
                            onClick={() => supprimerFichier(dossierDetail.id, f.nomServeur)}
                            className="text-xs text-red-400 hover:text-red-600"
                            title="Supprimer ce fichier"
                            style={{ background: 'none', border: 'none', cursor: 'pointer' }}
                          >
                            🗑
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Alertes / historique */}
              {(dossierDetail.alertes?.length || 0) > 0 && (
                <div className="card">
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                    Historique
                  </h3>
                  <div className="space-y-2">
                    {dossierDetail.alertes.map((a: any) => (
                      <div key={a.id} className="bg-gray-50 rounded-lg p-3">
                        <p className="text-sm text-gray-700">{a.message}</p>
                        <p className="text-xs text-gray-400 mt-1">
                          {new Date(a.created_at).toLocaleDateString('fr-FR')}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Footer actions */}
            <div
              className="p-4 border-t border-gray-100 bg-gray-50 flex gap-3 justify-between"
              style={{ flexShrink: 0 }}
            >
              {peutValider(dossierDetail) && dossierDetail.statut !== 'Bouclé' ? (
                <button
                  onClick={() => valider(dossierDetail.id, dossierDetail.objet)}
                  className="btn-primary flex-1"
                  style={{ background: 'linear-gradient(135deg,#009A44,#006B30)' }}
                >
                  ✅ Valider et clôturer ce dossier
                </button>
              ) : dossierDetail.statut === 'Bouclé' ? (
                <div className="flex-1 text-center">
                  <span className="badge badge-success" style={{ fontSize: 13, padding: '8px 16px' }}>
                    ✅ Dossier bouclé — Traitement terminé
                  </span>
                </div>
              ) : (
                <div className="flex-1" />
              )}
              <button onClick={fermerDetail} className="btn-secondary">
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ════ MODAL NOUVEAU DOSSIER ════ */}
      {showModal && (
        <div
          className="fixed inset-0 flex items-start justify-center z-50 overflow-y-auto"
          style={{ background: 'rgba(0,0,0,0.45)', paddingTop: 40, paddingBottom: 40 }}
        >
          <div className="bg-white rounded-xl shadow-xl w-full" style={{ maxWidth: 540 }}>

            {/* Header */}
            <div
              style={{
                background: 'linear-gradient(135deg,#EF2B2D,#009A44)',
                borderRadius: '12px 12px 0 0',
              }}
              className="flex items-center justify-between p-5"
            >
              <h3 className="font-bold text-white text-base">Nouveau dossier</h3>
              <button
                onClick={() => setShowModal(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.7)', fontSize: 22 }}
              >
                ×
              </button>
            </div>

            <div className="p-5 space-y-4" style={{ maxHeight: '70vh', overflowY: 'auto' }}>

              {erreur && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-600 text-sm">
                  ⚠️ {erreur}
                </div>
              )}

              <div>
                <label className="form-label">Référence *</label>
                <input
                  className="form-input"
                  placeholder="UB-2025-XXX"
                  value={form.reference}
                  onChange={e => setForm({ ...form, reference: e.target.value })}
                />
              </div>

              <div>
                <label className="form-label">Objet du dossier *</label>
                <input
                  className="form-input"
                  placeholder="Intitulé du dossier"
                  value={form.objet}
                  onChange={e => setForm({ ...form, objet: e.target.value })}
                />
              </div>

              <div>
                <label className="form-label">Instance</label>
                <select
                  className="form-input"
                  value={form.instance}
                  onChange={e => setForm({ ...form, instance: e.target.value })}
                >
                  {INSTANCES.map(i => <option key={i}>{i}</option>)}
                </select>
              </div>

              <div>
                <label className="form-label">Date limite *</label>
                <input
                  type="date"
                  className="form-input"
                  value={form.date_limite}
                  onChange={e => setForm({ ...form, date_limite: e.target.value })}
                />
              </div>

              <div>
                <label className="form-label">
                  Avancement (%) — {form.niveau_mise_en_oeuvre}%
                </label>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  value={form.niveau_mise_en_oeuvre}
                  onChange={e => setForm({ ...form, niveau_mise_en_oeuvre: parseInt(e.target.value) })}
                  className="w-full accent-green-600"
                />
                <div className="flex justify-between text-xs text-gray-400 mt-1">
                  <span>0%</span><span>50%</span><span>100%</span>
                </div>
              </div>

              <div>
                <label className="form-label">Description</label>
                <textarea
                  className="form-input"
                  rows={2}
                  placeholder="Contexte et informations complémentaires..."
                  value={form.description}
                  onChange={e => setForm({ ...form, description: e.target.value })}
                />
              </div>

              {/* Intervenants */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="form-label mb-0">Intervenants</label>
                  <button
                    type="button"
                    onClick={ajouterIntervenant}
                    className="text-xs text-green-700 hover:underline"
                  >
                    + Ajouter
                  </button>
                </div>
                {form.intervenants.map((iv: any, idx: number) => (
                  <div
                    key={idx}
                    className="border border-gray-100 rounded-lg p-3 mb-2 bg-gray-50"
                  >
                    <div className="grid grid-cols-2 gap-2 mb-2">
                      <div>
                        <label className="form-label">Nom complet</label>
                        <input
                          className="form-input text-xs"
                          placeholder="OUÉDRAOGO Fatimata"
                          value={iv.nom}
                          onChange={e => majIntervenant(idx, 'nom', e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="form-label">Rôle</label>
                        <input
                          className="form-input text-xs"
                          placeholder="Responsable"
                          value={iv.role}
                          onChange={e => majIntervenant(idx, 'role', e.target.value)}
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="form-label">Direction</label>
                        <select
                          className="form-input text-xs"
                          value={iv.direction}
                          onChange={e => majIntervenant(idx, 'direction', e.target.value)}
                        >
                          {DIRECTIONS.map(d => <option key={d}>{d}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="form-label">Email (alertes)</label>
                        <input
                          type="email"
                          className="form-input text-xs"
                          placeholder="nom@univ-burkina.bf"
                          value={iv.email}
                          onChange={e => majIntervenant(idx, 'email', e.target.value)}
                        />
                      </div>
                    </div>
                    {form.intervenants.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setForm((f: any) => ({
                          ...f,
                          intervenants: f.intervenants.filter((_: any, i: number) => i !== idx),
                        }))}
                        className="text-xs text-red-400 hover:text-red-600 mt-2"
                      >
                        ✕ Retirer cet intervenant
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-3 p-5 border-t">
              <button className="btn-secondary" onClick={() => setShowModal(false)}>
                Annuler
              </button>
              <button className="btn-primary" onClick={sauvegarder} disabled={saving}>
                {saving ? 'Enregistrement...' : 'Enregistrer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Toast ── */}
      {toast && (
        <div
          style={{
            position:     'fixed',
            bottom:       24,
            left:         '50%',
            transform:    'translateX(-50%)',
            background:   toast.type === 'ok' ? '#009A44' : '#DC2626',
            color:        '#fff',
            padding:      '12px 28px',
            borderRadius: 10,
            fontSize:     14,
            fontWeight:   600,
            zIndex:       9999,
            boxShadow:    '0 4px 20px rgba(0,0,0,0.2)',
            whiteSpace:   'nowrap',
          }}
        >
          {toast.msg}
        </div>
      )}
    </div>
  );
}
