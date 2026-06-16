'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
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
  
  // États et Ref pour le menu déroulant d'actions
  const [menuOuvert,     setMenuOuvert]     = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  // ── Fermer le menu déroulant au clic extérieur ──
  useEffect(() => {
    const fermer = (e: MouseEvent) => {
      if (menuOuvert && menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOuvert(null);
      }
    };
    document.addEventListener('mousedown', fermer);
    return () => document.removeEventListener('mousedown', fermer);
  }, [menuOuvert]);

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
      afficherToast(' Dossier créé avec succès');
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
      afficherToast(' Dossier validé — emails envoyés aux intervenants');
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

      {/* Toast de Notification */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 p-3 rounded shadow-lg text-white text-sm font-medium ${toast.type === 'ok' ? 'bg-green-600' : 'bg-red-600'}`}>
          {toast.msg}
        </div>
      )}

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
            onClick={(e) => { 
              e.stopPropagation();
              setForm(emptyForm); 
              setErreur(''); 
              setShowModal(true); 
            }}
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
                           {d.nb_alertes}
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
                          {enRetard ? ` ${Math.abs(jours)}j retard` : `${jours}j restants`}
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
                      <div 
                        ref={menuOuvert === d.id ? menuRef : null} 
                        className="relative inline-block text-left"
                      >
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setMenuOuvert(menuOuvert === d.id ? null : d.id);
                          }}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: 32,
                            height: 32,
                            borderRadius: 8,
                            border: '1px solid #E5E7EB',
                            background: menuOuvert === d.id ? '#F3F4F6' : '#fff',
                            cursor: 'pointer',
                            fontSize: 16,
                            color: '#6B7280',
                            transition: 'background 0.15s',
                          }}
                          title="Actions"
                        >
                          ⋮
                        </button>

                        {menuOuvert === d.id && (
                          <div
                            style={{
                              position: 'absolute',
                              right: 0,
                              top: '110%',
                              zIndex: 50,
                              minWidth: 190,
                              background: '#fff',
                              borderRadius: 10,
                              border: '1px solid #E5E7EB',
                              boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                              padding: 6,
                              overflow: 'hidden',
                            }}
                          >
                            <button
                              onClick={(e) => { 
                                e.stopPropagation(); 
                                ouvrirDetail(d.id); 
                                setMenuOuvert(null); 
                              }}
                              style={{
                                width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                                padding: '9px 12px', borderRadius: 7, border: 'none',
                                background: 'transparent', cursor: 'pointer',
                                fontSize: 13, color: '#1F2937', textAlign: 'left',
                              }}
                              onMouseEnter={e => (e.currentTarget.style.background = '#EFF6FF')}
                              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                            >
                              <span style={{ fontSize: 15 }}>👁</span>
                              <span>Voir le détail</span>
                            </button>

                            {peutValider(d) && d.statut !== 'Bouclé' && (
                              <button
                                onClick={(e) => { 
                                  e.stopPropagation(); 
                                  valider(d.id, d.objet); 
                                  setMenuOuvert(null); 
                                }}
                                style={{
                                  width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                                  padding: '9px 12px', borderRadius: 7, border: 'none',
                                  background: 'transparent', cursor: 'pointer',
                                  fontSize: 13, color: '#059669', textAlign: 'left',
                                }}
                                onMouseEnter={e => (e.currentTarget.style.background = '#ECFDF5')}
                                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                              >
                                <span>✔️</span>
                                <span>Valider et clôturer</span>
                              </button>
                            )}

                            {peutSupprimer(d) && (
                              <>
                                <div style={{ height: 1, background: '#F3F4F6', margin: '4px 0' }} />
                                <button
                                  onClick={(e) => { 
                                    e.stopPropagation(); 
                                    supprimer(d.id, d.objet); 
                                    setMenuOuvert(null); 
                                  }}
                                  style={{
                                    width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                                    padding: '9px 12px', borderRadius: 7, border: 'none',
                                    background: 'transparent', cursor: 'pointer',
                                    fontSize: 13, color: '#DC2626', textAlign: 'left',
                                  }}
                                  onMouseEnter={e => (e.currentTarget.style.background = '#FEF2F2')}
                                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                                >
                                  <span style={{ fontSize: 15 }}>🗑</span>
                                  <span>Supprimer</span>
                                </button>
                              </>
                            )}
                          </div>
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

      {/* ── MODAL DE CRÉATION DE DOSSIER DÉGRADÉE ET STYLISÉE ── */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden">
            
            {/* Header personnalisé avec Dégradé */}
            <div 
              style={{ background: 'linear-gradient(135deg, #EF2B2D, #009A44)' }} 
              className="p-4 flex justify-between items-center text-white"
            >
              <h2 className="text-lg font-bold">Nouveau dossier</h2>
              <button 
                onClick={() => setShowModal(false)} 
                className="text-white/80 hover:text-white text-2xl font-semibold leading-none focus:outline-none"
              >
                &times;
              </button>
            </div>
            
            {/* Corps du Formulaire */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {erreur && (
                <div className="p-3 text-sm text-red-600 bg-red-50 rounded-lg border border-red-100">
                  ⚠️ {erreur}
                </div>
              )}
              
              {/* Référence */}
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">Référence *</label>
                <input 
                  type="text" 
                  className="form-input w-full border border-gray-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500/20 focus:border-green-500 outline-none" 
                  value={form.reference} 
                  onChange={e => setForm({...form, reference: e.target.value})} 
                  placeholder="UB-2025-XXX" 
                />
              </div>

              {/* Objet */}
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">Objet du dossier *</label>
                <input 
                  type="text" 
                  className="form-input w-full border border-gray-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500/20 focus:border-green-500 outline-none" 
                  value={form.objet} 
                  onChange={e => setForm({...form, objet: e.target.value})} 
                  placeholder="Intitulé du dossier" 
                />
              </div>

              {/* Instance */}
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">Instance</label>
                <select 
                  className="form-input w-full border border-gray-200 rounded-lg px-3 py-2 bg-gray-50 focus:ring-2 focus:ring-green-500/20 focus:border-green-500 outline-none" 
                  value={form.instance} 
                  onChange={e => setForm({...form, instance: e.target.value})}
                >
                  {INSTANCES.map(inst => <option key={inst} value={inst}>{inst}</option>)}
                </select>
              </div>

              {/* Date Limite */}
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">Date limite *</label>
                <input 
                  type="date" 
                  className="form-input w-full border border-gray-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500/20 focus:border-green-500 outline-none text-gray-500" 
                  value={form.date_limite} 
                  onChange={e => setForm({...form, date_limite: e.target.value})} 
                />
              </div>

              {/* Avancement (Slider) */}
              <div>
                <div className="flex justify-between text-sm font-medium text-gray-600 mb-1">
                  <span>Avancement (%) — {form.niveau_mise_en_oeuvre}%</span>
                </div>
                <input 
                  type="range" 
                  min="0" 
                  max="100" 
                  step="5"
                  className="w-full accent-green-600 cursor-pointer" 
                  value={form.niveau_mise_en_oeuvre} 
                  onChange={e => setForm({...form, niveau_mise_en_oeuvre: parseInt(e.target.value)})} 
                />
                <div className="flex justify-between text-xs text-gray-400 mt-1">
                  <span>0%</span>
                  <span>50%</span>
                  <span>100%</span>
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">Description</label>
                <textarea 
                  className="form-input w-full h-24 border border-gray-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500/20 focus:border-green-500 outline-none resize-none" 
                  value={form.description} 
                  onChange={e => setForm({...form, description: e.target.value})} 
                  placeholder="Contexte et informations complémentaires..." 
                />
              </div>

              {/* Section Intervenants */}
              <div className="border-t border-gray-100 pt-4">
                <div className="flex justify-between items-center mb-3">
                  <span className="text-sm font-medium text-gray-600">Intervenants</span>
                  <button 
                    type="button" 
                    onClick={ajouterIntervenant} 
                    className="text-sm text-green-600 hover:text-green-700 font-medium transition-colors"
                  >
                    + Ajouter
                  </button>
                </div>
                
                <div className="space-y-3">
                  {form.intervenants.map((inter: any, idx: number) => (
                    <div key={idx} className="bg-gray-50/60 border border-gray-100 rounded-xl p-4 space-y-3 relative">
                      
                      {/* Ligne Nom / Rôle */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs text-gray-400 mb-1">Nom complet</label>
                          <input 
                            type="text" 
                            className="form-input w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm outline-none bg-white" 
                            placeholder="OUÉDRAOGO Fatimata" 
                            value={inter.nom} 
                            onChange={e => majIntervenant(idx, 'nom', e.target.value)} 
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-400 mb-1">Rôle</label>
                          <input 
                            type="text" 
                            className="form-input w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm outline-none bg-white" 
                            placeholder={idx === 0 ? "Responsable" : "Intervenant"}
                            value={inter.role} 
                            onChange={e => majIntervenant(idx, 'role', e.target.value)} 
                          />
                        </div>
                      </div>

                      {/* Ligne Direction / Email */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs text-gray-400 mb-1">Direction</label>
                          <select 
                            className="form-input w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm outline-none bg-white" 
                            value={inter.direction} 
                            onChange={e => majIntervenant(idx, 'direction', e.target.value)}
                          >
                            {DIRECTIONS.map(d => <option key={d} value={d}>{d}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs text-gray-400 mb-1">Email (alertes)</label>
                          <input 
                            type="email" 
                            className="form-input w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm outline-none bg-white" 
                            placeholder="nom@univ-burkina.bf" 
                            value={inter.email} 
                            onChange={e => majIntervenant(idx, 'email', e.target.value)} 
                          />
                        </div>
                      </div>

                      {/* Suppression dynamique d'intervenant */}
                      {form.intervenants.length > 1 && (
                        <button
                          type="button"
                          onClick={() => setForm((f: any) => ({
                            ...f,
                            intervenants: f.intervenants.filter((_: any, i: number) => i !== idx)
                          }))}
                          className="text-xs text-red-500 hover:text-red-600 flex items-center gap-1 mt-1 transition-colors"
                        >
                          &times; Retirer cet intervenant
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Actions du pied de page */}
            <div className="flex justify-end gap-3 border-t border-gray-100 p-4 bg-gray-50/40">
              <button 
                type="button" 
                onClick={() => setShowModal(false)} 
                className="px-5 py-2 border border-gray-200 text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors" 
                disabled={saving}
              >
                Annuler
              </button>
              <button 
                type="button" 
                onClick={sauvegarder} 
                className="px-5 py-2 bg-[#009A44] hover:bg-[#00843A] text-white rounded-lg text-sm font-medium shadow-sm transition-colors" 
                disabled={saving}
              >
                {saving ? 'Enregistrement...' : 'Enregistrer'}
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ── PANNEAU DÉTAIL ── */}
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
                &times;
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
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Fichiers Attachés */}
              <div className="card">
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                  Documents attachés ({dossierDetail.fichiers?.length || 0})
                </h3>
                
                <label className="block mb-4 p-4 border-2 border-dashed border-gray-200 rounded-xl hover:border-green-500 bg-gray-50/30 hover:bg-gray-50 text-center cursor-pointer transition-all">
                  <input
                    type="file"
                    className="hidden"
                    disabled={uploadEnCours}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) uploaderFichier(dossierDetail.id, f);
                    }}
                  />
                  <span className="text-sm text-gray-500 block">
                    {uploadEnCours ? '🔄 Upload en cours...' : '📎 Cliquer pour joindre un document (PDF, Word, Image)'}
                  </span>
                </label>

                {!dossierDetail.fichiers?.length ? (
                  <p className="text-sm text-gray-300 italic text-center py-2">Aucun document lié à ce dossier</p>
                ) : (
                  <div className="space-y-2">
                    {dossierDetail.fichiers.map((f: any) => (
                      <div key={f.id} className="flex items-center justify-between border border-gray-100 rounded-lg p-3 hover:bg-gray-50">
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="text-2xl flex-shrink-0">{iconeFichier(f.type_mime)}</span>
                          <div className="min-w-0">
                            <a 
                              href={`${BACKEND}${f.url}`} 
                              target="_blank" 
                              rel="noreferrer" 
                              className="text-sm font-medium text-blue-600 hover:underline block truncate"
                            >
                              {f.nom_original}
                            </a>
                            <p className="text-xs text-gray-400">
                              {tailleFormatee(f.taille)} • par {f.depose_par_prenom}
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={() => supprimerFichier(dossierDetail.id, f.nom_serveur)}
                          className="p-1.5 text-gray-400 hover:text-red-500 rounded transition-colors"
                          title="Supprimer le fichier"
                        >
                          🗑
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>
          </div>
        </div>
      )}

    </div>
  );
}
