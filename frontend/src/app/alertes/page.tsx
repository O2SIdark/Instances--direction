'use client';
import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/auth';

const CFG_PRIORITE: Record<string, {
  bg: string; border: string; text: string;
  icone: string; label: string;
}> = {
  Critique: {
    bg: '#FEF2F2', border: '#FECACA',
    text: '#DC2626', icone: '', label: 'Critique',
  },
  'Modérée': {
    bg: '#FFFBEB', border: '#FDE68A',
    text: '#D97706', icone: '', label: 'Modérée',
  },
  Info: {
    bg: '#EFF6FF', border: '#BFDBFE',
    text: '#2563EB', icone: '', label: 'Info',
  },
};

export default function Alertes() {
  const [alertes,  setAlertes]  = useState<any[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [filtre,   setFiltre]   = useState('');
  const [envoi,    setEnvoi]    = useState<string | null>(null);
  const [emailModal, setEmailModal] = useState<any>(null);
  const [emailDest,  setEmailDest]  = useState('');

  useEffect(() => {
    apiFetch('/alertes')
      .then(data => { setAlertes(Array.isArray(data) ? data : []); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const alertesFiltrees = filtre
    ? alertes.filter(a => a.priorite === filtre)
    : alertes;

  const nb = {
    critique: alertes.filter(a => a.priorite === 'Critique').length,
    moderee:  alertes.filter(a => a.priorite === 'Modérée').length,
    info:     alertes.filter(a => a.priorite === 'Info').length,
  };

  const envoyerEmail = async () => {
    if (!emailDest || !emailModal) return;
    setEnvoi(emailModal.id);
    try {
      await apiFetch('/alertes/envoyer-email', {
        method: 'POST',
        body: JSON.stringify({
          destinataire: emailDest,
          priorite:     emailModal.priorite,
          dossier:      emailModal.dossier,
          objet:        emailModal.objet,
          motif:        emailModal.motif,
          responsable:  emailModal.responsable,
        }),
      });
      alert(` Email envoyé à ${emailDest}`);
      setEmailModal(null);
      setEmailDest('');
    } catch (err: any) {
      alert(` Erreur : ${err.message}`);
    } finally { setEnvoi(null); }
  };

  if (loading) return (
    <div className="text-center py-20 text-gray-300">
      Chargement des alertes...
    </div>
  );

  return (
    <div className="space-y-5">

      {/* ── Résumé compteurs ── */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Critiques',  val: nb.critique, couleur: '#DC2626',
            bg: '#FEF2F2', icone: '' },
          { label: 'Modérées',   val: nb.moderee,  couleur: '#D97706',
            bg: '#FFFBEB', icone: '' },
          { label: 'Info',       val: nb.info,     couleur: '#2563EB',
            bg: '#EFF6FF', icone: '' },
        ].map(c => (
          <button
            key={c.label}
            onClick={() => setFiltre(
              filtre === c.label.replace('Critiques','Critique')
                              .replace('Modérées','Modérée')
                ? ''
                : c.label.replace('Critiques','Critique')
                         .replace('Modérées','Modérée')
            )}
            style={{
              background: c.bg,
              border: `2px solid ${c.couleur}30`,
              borderRadius: 12, padding: '16px',
              textAlign: 'center', cursor: 'pointer',
              transition: 'all 0.15s',
              boxShadow: filtre === c.label.replace('Critiques','Critique')
                                           .replace('Modérées','Modérée')
                ? `0 0 0 3px ${c.couleur}40` : 'none',
            }}
          >
            <p style={{ fontSize: 28, margin: '0 0 4px' }}>{c.icone}</p>
            <p style={{
              fontSize: 32, fontWeight: 900,
              color: c.couleur, margin: 0,
            }}>
              {c.val}
            </p>
            <p style={{ fontSize: 12, color: c.couleur, margin: 0 }}>
              {c.label}
            </p>
          </button>
        ))}
      </div>

      {/* ── Filtre actif ── */}
      {filtre && (
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600">
            Filtre actif : <strong>{filtre}</strong>
          </span>
          <button onClick={() => setFiltre('')}
            className="text-xs text-gray-400 hover:text-gray-600">
            ✕ Effacer
          </button>
        </div>
      )}

      {/* ── Liste des alertes ── */}
      {alertesFiltrees.length === 0 ? (
        <div className="card text-center py-16">
          <p className="text-4xl mb-3"></p>
          <p className="text-gray-400 font-medium">
            {filtre
              ? `Aucune alerte "${filtre}"`
              : 'Aucune alerte active — tout est en ordre !'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {alertesFiltrees.map((a: any, i: number) => {
            const cfg = CFG_PRIORITE[a.priorite] || CFG_PRIORITE.Info;
            return (
              <div
                key={a.id || i}
                style={{
                  background:   cfg.bg,
                  border:       `1px solid ${cfg.border}`,
                  borderLeft:   `4px solid ${cfg.text}`,
                  borderRadius: 10,
                  padding:      '14px 16px',
                }}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 min-w-0">
                    {/* Icone priorité */}
                    <span style={{ fontSize: 22, flexShrink: 0 }}>
                      {cfg.icone}
                    </span>

                    <div className="min-w-0">
                      {/* Badges */}
                      <div className="flex gap-2 flex-wrap mb-1">
                        <span style={{
                          background: cfg.text,
                          color: '#fff',
                          borderRadius: 4,
                          padding: '1px 8px',
                          fontSize: 11,
                          fontWeight: 700,
                        }}>
                          {cfg.label}
                        </span>
                        <span className="font-mono text-xs
                          bg-white px-2 py-0.5 rounded border
                          border-gray-200 text-gray-700 font-bold">
                          {a.dossier}
                        </span>
                        {a.type === 'validation' && (
                          <span className="badge badge-success text-xs">
                             Bouclé
                          </span>
                        )}
                      </div>

                      {/* Objet */}
                      <p className="text-sm font-semibold text-gray-800
                        leading-tight mb-1">
                        {a.objet}
                      </p>

                      {/* Motif */}
                      <p style={{
                        color: cfg.text,
                        fontSize: 13,
                        fontWeight: 600,
                      }}>
                        {a.motif}
                      </p>

                      {/* Responsable + date */}
                      <div className="flex gap-3 mt-1 text-xs
                        text-gray-400">
                        <span>👤 {a.responsable}</span>
                        {a.created_at && (
                          <span>
                            🕐 {new Date(a.created_at)
                              .toLocaleDateString('fr-FR')}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Bouton envoyer email */}
                  {a.type !== 'validation' && (
                    <button
                      onClick={() => {
                        setEmailModal(a);
                        setEmailDest('');
                      }}
                      style={{
                        background: '#fff',
                        border: `1px solid ${cfg.border}`,
                        borderRadius: 7,
                        padding: '6px 12px',
                        fontSize: 12,
                        fontWeight: 600,
                        color: cfg.text,
                        cursor: 'pointer',
                        whiteSpace: 'nowrap',
                        flexShrink: 0,
                      }}
                      title="Envoyer cette alerte par email"
                    >
                         Envoyer
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Modal envoi email ── */}
      {emailModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center
          justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div style={{
              background: 'linear-gradient(135deg,#EF2B2D,#009A44)',
              borderRadius: '12px 12px 0 0',
            }} className="p-4 flex justify-between items-center">
              <h3 className="text-white font-bold">
                 Envoyer l'alerte par email
              </h3>
              <button onClick={() => setEmailModal(null)}
                className="text-white/70 hover:text-white text-xl">
                ×
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="bg-gray-50 rounded-lg p-3 text-sm">
                <p className="text-gray-500 text-xs mb-1">
                  Alerte concernée
                </p>
                <p className="font-bold text-gray-800">
                  {emailModal.dossier}
                </p>
                <p className="text-gray-600">{emailModal.motif}</p>
              </div>

              <div>
                <label className="form-label">
                  Adresse email du destinataire *
                </label>
                <input
                  type="email"
                  className="form-input"
                  placeholder="responsable@univ-burkina.bf"
                  value={emailDest}
                  onChange={e => setEmailDest(e.target.value)}
                  autoFocus
                />
              </div>

              <div className="flex gap-3 justify-end">
                <button className="btn-secondary"
                  onClick={() => setEmailModal(null)}>
                  Annuler
                </button>
                <button
                  className="btn-primary"
                  onClick={envoyerEmail}
                  disabled={!emailDest || !!envoi}
                >
                  {envoi ? ' Envoi...' : ' Envoyer'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
