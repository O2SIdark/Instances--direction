'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { setSession } from '@/lib/auth';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

const DEMO = [
  { label: 'Administrateur', email: 'admin@univ-burkina.bf',       mdp: 'admin123' },
  { label: 'Agent',          email: 'f.ouedraogo@univ-burkina.bf', mdp: 'agent123' },
  { label: 'Validateur',     email: 'm.sawadogo@univ-burkina.bf',  mdp: 'valid123' },
];

export default function Login() {
  const router = useRouter();
  const [email,      setEmail]      = useState('admin@univ-burkina.bf');
  const [mdp,        setMdp]        = useState('admin123');
  const [erreur,     setErreur]     = useState('');
  const [chargement, setChargement] = useState(false);
  const [voirMdp,    setVoirMdp]    = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErreur('');
    setChargement(true);
    try {
      const res = await fetch(`${API}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, mot_de_passe: mdp }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Identifiants incorrects');
      setSession(data.token, data.utilisateur);
      router.push('/');
    } catch (err: any) {
      setErreur(err.message);
    } finally {
      setChargement(false);
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #EF2B2D 0%, #8B0000 50%, #009A44 100%)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '20px',
    }}>
      <div style={{
        background: '#fff', borderRadius: '16px',
        width: '100%', maxWidth: '420px',
        boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
        overflow: 'hidden',
      }}>

        {/* Header */}
        <div style={{
          background: 'linear-gradient(135deg, #EF2B2D, #009A44)',
          padding: '28px 32px', textAlign: 'center',
        }}>
          {/* Drapeau Burkina SVG */}
          <svg width="52" height="36" viewBox="0 0 52 36" style={{
            borderRadius: '4px', margin: '0 auto 12px',
            display: 'block', border: '1px solid rgba(255,255,255,0.3)',
          }}>
            <rect width="52" height="18" fill="#EF2B2D"/>
            <rect y="18" width="52" height="18" fill="#009A44"/>
            <polygon
              points="26,10 28.4,17 35,17 29.8,21.2 31.8,28 26,24 20.2,28 22.2,21.2 17,17 23.6,17"
              fill="#FCD116"
            />
          </svg>
          <p style={{ margin: 0, color: '#fff', fontSize: '16px', fontWeight: 800 }}>
            Suivi des Instances de la Direction
          </p>
          <p style={{ margin: '4px 0 0', color: 'rgba(255,255,255,0.8)', fontSize: '12px' }}>
            Gouvernance & Coordination — Burkina Faso
          </p>
        </div>

        {/* Formulaire */}
        <form onSubmit={handleSubmit} style={{ padding: '28px 32px' }}>
          <h2 style={{
            margin: '0 0 20px', textAlign: 'center',
            fontSize: '18px', fontWeight: 700, color: '#1F2937',
          }}>
            Connexion
          </h2>

          {erreur && (
            <div style={{
              background: '#FEE2E2', border: '1px solid #FECACA',
              borderRadius: '8px', padding: '10px 14px',
              marginBottom: '16px', color: '#DC2626', fontSize: '13px',
            }}>
              ⚠️ {erreur}
            </div>
          )}

          <div style={{ marginBottom: '14px' }}>
            <label className="form-label">Adresse email</label>
            <input
              type="email" required value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="prenom.nom@univ-burkina.bf"
              className="form-input"
            />
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label className="form-label">Mot de passe</label>
            <div style={{ position: 'relative' }}>
              <input
                type={voirMdp ? 'text' : 'password'}
                required value={mdp}
                onChange={e => setMdp(e.target.value)}
                placeholder="••••••••"
                className="form-input"
                style={{ paddingRight: '40px', width: '100%', boxSizing: 'border-box' }}
              />
              <button
                type="button"
                onClick={() => setVoirMdp(v => !v)}
                aria-label={voirMdp ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                style={{
                  position: 'absolute',
                  right: '10px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '16px',
                  color: '#6B7280',
                  padding: '4px',
                  lineHeight: 1,
                }}
              >
                {voirMdp ? '👁' : '👁'}
              </button>
            </div>
          </div>

          <button
            type="submit" disabled={chargement}
            style={{
              width: '100%', padding: '12px',
              background: chargement
                ? '#9CA3AF'
                : 'linear-gradient(135deg, #EF2B2D, #009A44)',
              border: 'none', borderRadius: '8px',
              color: '#fff', fontSize: '14px', fontWeight: 700,
              cursor: chargement ? 'not-allowed' : 'pointer',
            }}
          >
            {chargement ? 'Connexion...' : 'Se connecter →'}
          </button>

          {/* Comptes démo */}
          <div style={{
            marginTop: '20px', padding: '12px',
            background: '#F9FAFB', borderRadius: '8px',
            border: '1px solid #E5E7EB',
          }}>
            <p style={{
              margin: '0 0 8px', fontSize: '11px', fontWeight: 700,
              color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.05em',
            }}>
              Comptes de démonstration
            </p>
            {DEMO.map(c => (
              <button
                key={c.email} type="button"
                onClick={() => { setEmail(c.email); setMdp(c.mdp); }}
                style={{
                  display: 'block', width: '100%',
                  padding: '5px 8px', marginBottom: '4px',
                  background: 'none',
                  border: '1px solid #E5E7EB', borderRadius: '5px',
                  textAlign: 'left', cursor: 'pointer',
                  fontSize: '11px', color: '#374151',
                }}
              >
                <strong style={{ color: '#009A44' }}>{c.label}</strong>
                {' — '}{c.email}
              </button>
            ))}
          </div>
        </form>
      </div>
    </div>
  );
}
