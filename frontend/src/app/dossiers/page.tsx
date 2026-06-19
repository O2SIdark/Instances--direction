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
    'Bouclé':    'bg-green-100 text-green-800 border border-green-200',
    'En cours':  'bg-amber-100 text-amber-800 border border-amber-200',
    'En retard': 'bg-red-100 text-red-800 border border-red-200',
    'Initié':    'bg-blue-100 text-blue-800 border border-blue-200',
  };
  return <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${m[s] || 'bg-gray-100 text-gray-800'}`}>{s}</span>;
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

  // ── Fermer le menu déroulant au clic extérieur 
  useEffect(() => {
    const fermer = (e: MouseEvent) => {
      if (menuOuvert && menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOuvert(null);
      }
    };
    document.addEventListener('mousedown', fermer);
    return () => document.removeEventListener('mousedown', fermer);
  }, [menuOuvert]);

  // ── Toast 
  const afficherToast = (msg: string, type: 'ok' | 'err' = 'ok') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  // ── Charger la liste 
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

  // ── Détail dossier 
  const ouvrirDetail = async (id: string) => {
    try {
      const d = await apiFetch(`/dossiers/${id}`);
      setDossierDetail(d);
    } catch {
      afficherToast('Erreur lors du chargement', 'err');
    }
  };

  const fermerDetail = () => setDossierDetail(null);

  // ── Créer dossier 
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
      afficherToast('Dossier créé avec succès');
      charger();
    } catch (err: any) {
      setErreur(err.message);
    } finally {
      setSaving(false);
    }
  };

  // ── Supprimer 
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

  // ── Valider (admin ou créateur) 
  const valider = async (id: string, objet: string) => {
    if (!confirm(`Valider et clôturer "${objet}" ? Cette action est irréversible.`)) return;
    try {
      await apiFetch(`/dossiers/${id}/valider`, { method: 'PATCH' });
      afficherToast('Dossier validé — emails envoyés aux intervenants');
      if (dossierDetail?.id === id) await ouvrirDetail(id);
      charger();
    } catch (err: any) {
      afficherToast(err.message, 'err');
    }
  };

  // ── Upload fichier 
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

  // ── Supprimer fichier 
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

  // ── Export CSV 
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

  // ── Helpers intervenants du formulaire 
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

  // ── Droits 
  const peutSupprimer = (d: any) =>
    user?.role === 'admin' || d.cree_par === user?.id;

  const peutValider = (d: any) =>
    user?.role === 'admin' || d.cree_par === user?.id;

  // ═══════════════════════════════════════════════════════
  // RENDU
  // ═══════════════════════════════════════════════════════
  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto">

      {/* Toast de Notification */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 p-3 rounded-xl shadow-lg text-white text-sm font-medium transition-all duration-300 ${toast.type === 'ok' ? 'bg-green-600' : 'bg-red-600'}`}>
          {toast.msg}
        </div>
      )}

      {/* ── Filtres + actions ── */}
      <div className="flex flex-wrap gap-3 mb-6 items-center">

        <select
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500/20 focus:border-green-500 outline-none w-auto bg-white"
          value={filtreStatut}
          onChange={e => setFiltreStatut(e.target.value)}
        >
          <option value="">Tous les statuts</option>
          {['Initié', 'En cours', 'Bouclé', 'En retard'].map(s => (
            <option key={s}>{s}</option>
          ))}
        </select>

        <select
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500/20 focus:border-green-500 outline-none w-auto bg-white"
          value={filtreInstance}
          onChange={e => setFiltreInstance(e.target.value)}
        >
          <option value="">Toutes instances</option>
          {INSTANCES.map(i => <option key={i}>{i}</option>)}
        </select>

        <input
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500/20 focus:border-green-500 outline-none w-full md:w-48 bg-white"
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
            className="px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
            title="Exporter en CSV"
          >
            ⬇️ Exporter CSV
          </button>
          <button
            className="px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg shadow-sm transition-colors"
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
      <div className="bg-white border border-gray-100 rounded-xl shadow-sm overflow-hidden overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50/75 border-b border-gray-100">
              {['Référence', 'Objet', 'Instance', 'Date limite', 'Avancement', 'Statut', 'Actions'].map(h => (
                <th
                  key={h}
                  className="text-left px-4 py-3 text-xs text-gray-400 font-medium uppercase tracking-wider"
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
                  <tr key={d.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">

                    {/* Référence */}
                    <td className="px-4 py-3.5">
                      <p className="font-mono text-xs text-blue-700 font-bold">
                        {d.reference}
                      </p>
                      {(d.nb_alertes || 0) > 0 && (
                        <span className="inline-block mt-1 bg-red-100 text-red-700 rounded-full px-2 py-0.5 text-[10px] font-bold">
                           {d.nb_alertes} alerte(s)
                        </span>
                      )}
                    </td>

                    {/* Objet */}
                    <td className="px-4 py-3.5">
                      <p className="font-medium text-sm leading-tight max-w-xs truncate">
                        {d.objet}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {d.createur_prenom} {d.createur_nom}
                      </p>
                    </td>

                    {/* Instance */}
                    <td className="px-4 py-3.5">
                      <span className="bg-blue-50 text-blue-700 text-xs px-2 py-0.5 rounded">
                        {d.instance}
                      </span>
                    </td>

                    {/* Date limite */}
                    <td className="px-4 py-3.5">
                      <p className={`text-xs font-bold ${enRetard ? 'text-red-600' : 'text-gray-600'}`}>
                        {new Date(d.date_limite).toLocaleDateString('fr-FR')}
                      </p>
                      {d.statut !== 'Bouclé' && (
                        <p className={`text-[11px] mt-0.5 ${
                          enRetard ? 'text-red-500' : jours <= 7 ? 'text-amber-500' : 'text-gray-400'
                        }`}>
                          {enRetard ? `${Math.abs(jours)}j retard` : `${jours}j restants`}
                        </p>
                      )}
                    </td>

                    {/* Avancement */}
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-1.5 bg-gray-100 rounded-full">
                          <div
                            className="h-1.5 rounded-full transition-all duration-300"
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
                    <td className="px-4 py-3.5">{badge(d.statut)}</td>

                    {/* Actions */}
                    <td className="px-4 py-3.5">
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
                          className={`flex items-center justify-center w-8 h-8 rounded-lg border border-gray-200 cursor-pointer text-lg transition-colors ${menuOuvert === d.id ? 'bg-gray-100 text-gray-800' : 'bg-white hover:bg-gray-50 text-gray-500'}`}
                          title="Actions"
                        >
                          ⋮
                        </button>

                        {menuOuvert === d.id && (
                          <div
                            className="absolute right-0 top-full mt-1 z-50 min-width-[190px] w-48 bg-white rounded-xl border border-gray-200 shadow-xl p-1.5 overflow-hidden"
                          >
                            <button
                              onClick={(e) => { 
                                e.stopPropagation(); 
                                ouvrirDetail(d.id); 
                                setMenuOuvert(null); 
                              }}
                              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-800 transition-colors text-left"
                            >
                              <span></span>
                              <span>Voir le détail</span>
                            </button>

                            {peutValider(d) && d.statut !== 'Bouclé' && (
                              <button
                                onClick={(e) => { 
                                  e.stopPropagation(); 
                                  valider(d.id, d.objet); 
                                  setMenuOuvert(null); 
                                }}
                                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-green-600 hover:bg-green-50 transition-colors text-left font-medium"
                              >
                                <span></span>
                                <span>Valider / Clôturer</span>
                              </button>
                            )}

                            {peutSupprimer(d) && (
                              <>
                                <div className="h-px bg-gray-100 my-1" />
                                <button
                                  onClick={(e) => { 
                                    e.stopPropagation(); 
                                    supprimer(d.id, d.objet); 
                                    setMenuOuvert(null); 
                                  }}
                                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-red-600 hover:bg-red-50 transition-colors text-left"
                                >
                                  <span></span>
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
          <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden">
            
            {/* Header personnalisé avec Dégradé Burkina */}
            <div 
              style={{ background: 'linear-gradient(135deg, #EF2B2D, #009A44)' }} 
              className="px-6 py-4 flex justify-between items-center text-white"
            >
              <h2 className="text-lg font-bold">Nouveau dossier</h2>
              <button 
                onClick={() => setShowModal(false)} 
                className="text-white/80 hover:text-white text-2xl font-bold leading-none focus:outline-none"
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
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500/20 focus:border-green-500 outline-none" 
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
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500/20 focus:border-green-500 outline-none" 
                  value={form.objet} 
                  onChange={e => setForm({...form, objet: e.target.value})} 
                  placeholder="Intitulé du dossier" 
                />
              </div>

              {/* Instance */}
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">Instance</label>
                <select 
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-green-500/20 focus:border-green-500 outline-none" 
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
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500/20 focus:border-green-500 outline-none text-gray-600" 
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
                  className="w-full h-24 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500/20 focus:border-green-500 outline-none resize-none" 
                  value={form.description} 
                  onChange={e => setForm({...form, description: e.target.value})} 
                  placeholder="Contexte et informations complémentaires..." 
                />
              </div>

              {/* Section Intervenants */}
              <div className="border-t border-gray-100 pt-4">
                <div className="flex justify-between items-center mb-3">
                  <span className="text-sm font-semibold text-gray-700">Intervenants</span>
                  <button 
                    type="button" 
                    onClick={ajouterIntervenant} 
                    className="text-xs text-green-600 hover:text-green-700 font-bold bg-green-50 px-2 py-1 rounded"
                  >
                    + Ajouter un intervenant
                  </button>
                </div>
                
                <div className="space-y-3">
                  {form.intervenants.map((inter: any, idx: number) => (
                    <div key={idx} className="bg-gray-50/50 border border-gray-100 rounded-xl p-4 space-y-3 relative">
                      
                      {/* Ligne Nom / Rôle */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[10px] uppercase font-semibold text-gray-400 mb-1">Nom complet</label>
                          <input 
                            type="text" 
                            className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm outline-none bg-white" 
                            placeholder="OUÉDRAOGO Fatimata" 
                            value={inter.nom} 
                            onChange={e => majIntervenant(idx, 'nom', e.target.value)} 
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] uppercase font-semibold text-gray-400 mb-1">Rôle</label>
                          <input 
                            type="text" 
                            className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm outline-none bg-white" 
                            placeholder={idx === 0 ? "Responsable" : "Intervenant"}
                            value={inter.role} 
                            onChange={e => majIntervenant(idx, 'role', e.target.value)} 
                          />
                        </div>
                      </div>

                      {/* Ligne Direction / Email */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[10px] uppercase font-semibold text-gray-400 mb-1">Direction</label>
                          <select 
                            className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm outline-none bg-white" 
                            value={inter.direction} 
                            onChange={e => majIntervenant(idx, 'direction', e.target.value)}
                          >
                            {DIRECTIONS.map(d => <option key={d} value={d}>{d}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="block text-[10px] uppercase font-semibold text-gray-400 mb-1">Email (pour alertes)</label>
                          <input 
                            type="email" 
                            className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm outline-none bg-white" 
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
                          className="text-xs text-red-500 hover:text-red-600 flex items-center gap-1 mt-1 font-semibold"
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
                className="px-5 py-2 border border-gray-200 text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-100 transition-colors" 
                disabled={saving}
              >
                Annuler
              </button>
              <button 
                type="button" 
                onClick={sauvegarder} 
                className="px-5 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium shadow-sm transition-colors" 
                disabled={saving}
              >
                {saving ? 'Enregistrement...' : 'Enregistrer'}
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ── PANNEAU DÉTAIL DÉROULANT ── */}
      {dossierDetail && (
        <div className="fixed inset-0 z-50 flex items-start justify-end bg-black/40 p-0 md:p-4">
          <div className="bg-white h-full max-w-xl w-full shadow-2xl overflow-y-auto flex flex-col p-6 rounded-l-2xl md:rounded-2xl border-l border-gray-100">
            
            {/* Header du panneau */}
            <div className="flex justify-between items-center border-b pb-4 mb-4">
              <div>
                <span className="text-xs font-mono font-bold text-blue-700 bg-blue-50 px-2 py-1 rounded">
                  {dossierDetail.reference}
                </span>
                <h3 className="text-lg font-extrabold text-gray-800 mt-2">{dossierDetail.objet}</h3>
              </div>
              <button 
                onClick={fermerDetail} 
                className="text-gray-400 hover:text-gray-600 text-3xl font-bold leading-none"
              >
                &times;
              </button>
            </div>

            {/* Infos Principales */}
            <div className="space-y-4 flex-1">
              <div>
                <span className="text-xs uppercase font-bold text-gray-400">Instance</span>
                <p className="text-sm font-medium text-gray-700 mt-1">{dossierDetail.instance}</p>
              </div>

              <div>
                <span className="text-xs uppercase font-bold text-gray-400">Description</span>
                <p className="text-sm text-gray-600 mt-1 whitespace-pre-line bg-gray-50 p-3 rounded-xl border border-gray-100">
                  {dossierDetail.description || 'Aucune description fournie.'}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-xs uppercase font-bold text-gray-400">Statut</span>
                  <div className="mt-1">{badge(dossierDetail.statut)}</div>
                </div>
                <div>
                  <span className="text-xs uppercase font-bold text-gray-400">Date limite</span>
                  <p className="text-sm font-bold text-gray-700 mt-1">
                    {new Date(dossierDetail.date_limite).toLocaleDateString('fr-FR')}
                  </p>
                </div>
              </div>

              {/* Pièces jointes (Fichiers) */}
              <div className="border-t border-gray-100 pt-4">
                <h4 className="text-sm font-bold text-gray-700 mb-2">📎 Pièces jointes ({dossierDetail.fichiers?.length || 0})</h4>
                
                {/* Liste des fichiers */}
                <div className="space-y-2 mb-3">
                  {dossierDetail.fichiers && dossierDetail.fichiers.map((f: any, i: number) => (
                    <div key={i} className="flex items-center justify-between p-2.5 bg-gray-50/70 border border-gray-100 rounded-xl text-xs">
                      <div className="flex items-center gap-2 truncate">
                        <span>{iconeFichier(f.type)}</span>
                        <a 
                          href={f.url} 
                          target="_blank" 
                          rel="noopener noreferrer" 
                          className="font-medium text-blue-600 hover:underline truncate"
                        >
                          {f.nom}
                        </a>
                        <span className="text-gray-400">({tailleFormatee(f.taille)})</span>
                      </div>
                      <button 
                        onClick={() => supprimerFichier(dossierDetail.id, f.nomServeur)}
                        className="text-red-500 hover:text-red-700 font-bold px-2"
                        title="Supprimer la pièce jointe"
                      >
                        &times;
                      </button>
                    </div>
                  ))}
                </div>

                {/* Bouton d'upload vers Cloudinary */}
                <div>
                  <label className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-semibold text-green-700 bg-green-50 hover:bg-green-100 rounded-lg cursor-pointer transition-colors">
                    <span>{uploadEnCours ? '⏳ Transfert...' : '➕ Ajouter un fichier'}</span>
                    <input 
                      type="file" 
                      className="hidden" 
                      disabled={uploadEnCours}
                      onChange={(e) => {
                        if (e.target.files && e.target.files[0]) {
                          uploaderFichier(dossierDetail.id, e.target.files[0]);
                        }
                      }}
                    />
                  </label>
                  <p className="text-[10px] text-gray-400 mt-1">Formats acceptés : PDF, Word, Images (Max 10 Mo)</p>
                </div>
              </div>

              {/* Intervenants */}
              <div className="border-t border-gray-100 pt-4">
                <h4 className="text-sm font-bold text-gray-700 mb-2">👥 Intervenants ({dossierDetail.intervenants?.length || 0})</h4>
                <div className="space-y-2">
                  {dossierDetail.intervenants && dossierDetail.intervenants.map((iv: any, i: number) => (
                    <div key={i} className="p-3 bg-gray-50/50 border border-gray-100 rounded-xl text-xs flex justify-between items-center">
                      <div>
                        <p className="font-bold text-gray-800">{iv.nom}</p>
                        <p className="text-gray-400">{iv.role} — {iv.direction}</p>
                      </div>
                      <span className="font-mono bg-white px-2 py-0.5 rounded border text-gray-500 font-bold">
                        {iv.avancement || 0}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>

            </div>

            {/* Pied de page du panneau */}
            <div className="border-t border-gray-100 pt-4 mt-6 flex gap-2">
              {peutValider(dossierDetail) && dossierDetail.statut !== 'Bouclé' && (
                <button 
                  onClick={() => valider(dossierDetail.id, dossierDetail.objet)}
                  className="flex-1 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-semibold shadow-sm transition-colors"
                >
                  Valider et clôturer
                </button>
              )}
              <button 
                onClick={fermerDetail}
                className="px-4 py-2 border border-gray-200 text-gray-600 hover:bg-gray-100 rounded-lg text-sm font-medium transition-colors"
              >
                Fermer
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
