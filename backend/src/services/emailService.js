const nodemailer = require('nodemailer');
require('dotenv').config();

// ── Création du transporteur SMTP ─────────────────────────
function creerTransporteur() {
  return nodemailer.createTransport({
    host:   process.env.MAIL_HOST   || 'smtp.gmail.com',
    port:   parseInt(process.env.MAIL_PORT || '587'),
    secure: process.env.MAIL_SECURE === 'true', // false pour port 587
    auth: {
      user: process.env.MAIL_USER,
      pass: process.env.MAIL_PASSWORD,
    },
    tls: {
      rejectUnauthorized: false, // évite les erreurs de certificat
    },
  });
}

// ── Test de connexion SMTP ────────────────────────────────
async function testerConnexion() {
  if (!process.env.MAIL_USER || !process.env.MAIL_PASSWORD) {
    console.log('⚠️  Email non configuré (MAIL_USER / MAIL_PASSWORD manquants)');
    return false;
  }
  try {
    const t = creerTransporteur();
    await t.verify();
    console.log('✅ SMTP Gmail configuré correctement');
    return true;
  } catch (err) {
    console.error('❌ SMTP erreur:', err.message);
    console.error('   → Vérifiez MAIL_USER et MAIL_PASSWORD dans .env');
    console.error('   → Utilisez un App Password Gmail (pas votre mot de passe habituel)');
    return false;
  }
}

// ── Template HTML email alerte ────────────────────────────
function templateAlerte({ priorite, dossier, objet, motif, responsable }) {
  const cfg = {
    Critique: { couleur: '#DC2626', bg: '#FEE2E2', icone: '🔴' },
    Modérée:  { couleur: '#D97706', bg: '#FEF3C7', icone: '🟡' },
    Info:     { couleur: '#2563EB', bg: '#DBEAFE', icone: '🔵' },
  };
  const c = cfg[priorite] || cfg.Info;

  return `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
</head>
<body style="margin:0;padding:0;background:#F3F4F6;
  font-family:'Segoe UI',Roboto,Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0">
 <tr><td align="center" style="padding:32px 16px;">
  <table width="560" cellpadding="0" cellspacing="0"
   style="background:#fff;border-radius:12px;
     overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.1);">

   <!-- Header rouge/vert Burkina -->
   <tr>
    <td style="background:linear-gradient(135deg,#EF2B2D,#009A44);
      padding:24px 32px;text-align:center;">
     <table cellpadding="0" cellspacing="0" style="margin:0 auto 12px;">
      <tr>
       <td style="background:#EF2B2D;width:40px;height:28px;
         border-radius:3px 0 0 3px;"></td>
       <td style="background:#009A44;width:40px;height:28px;
         border-radius:0 3px 3px 0;"></td>
      </tr>
     </table>
     <p style="margin:0;color:#fff;font-size:16px;font-weight:800;">
       Suivi des Instances de la Direction
     </p>
     <p style="margin:4px 0 0;color:rgba(255,255,255,0.8);font-size:12px;">
       Gouvernance &amp; Coordination — Burkina Faso
     </p>
    </td>
   </tr>

   <!-- Badge alerte -->
   <tr>
    <td style="padding:24px 32px 8px;">
     <div style="display:inline-block;background:${c.bg};
       border:1px solid ${c.couleur}40;border-radius:8px;
       padding:8px 16px;">
      <span style="color:${c.couleur};font-size:14px;font-weight:800;">
        ${c.icone} Alerte ${priorite}
      </span>
     </div>
    </td>
   </tr>

   <!-- Dossier concerné -->
   <tr>
    <td style="padding:8px 32px 16px;">
     <div style="background:#F9FAFB;border-radius:8px;padding:16px;
       border-left:4px solid ${c.couleur};">
      <p style="margin:0 0 4px;font-size:11px;color:#6B7280;
        text-transform:uppercase;letter-spacing:0.06em;">
        Dossier concerné
      </p>
      <p style="margin:0 0 4px;font-size:20px;font-weight:800;
        color:#1D4ED8;">${dossier}</p>
      <p style="margin:0;font-size:14px;color:#111827;
        font-weight:600;">${objet}</p>
     </div>
    </td>
   </tr>

   <!-- Motif -->
   <tr>
    <td style="padding:0 32px 16px;">
     <p style="margin:0 0 6px;font-size:12px;color:#6B7280;
       text-transform:uppercase;letter-spacing:0.05em;">Motif</p>
     <p style="margin:0;font-size:14px;color:#374151;
       line-height:1.6;">${motif}</p>
    </td>
   </tr>

   <!-- Responsable -->
   <tr>
    <td style="padding:0 32px 24px;">
     <div style="background:#EFF6FF;border-radius:8px;padding:12px 16px;
       border:1px solid #BFDBFE;">
      <p style="margin:0 0 2px;font-size:11px;color:#1D4ED8;
        text-transform:uppercase;letter-spacing:0.05em;">
        Intervenant responsable
      </p>
      <p style="margin:0;font-size:14px;font-weight:700;color:#1E40AF;">
        ${responsable}
      </p>
     </div>
    </td>
   </tr>

   <!-- Bouton -->
   <tr>
    <td style="padding:0 32px 28px;">
     <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/dossiers"
      style="display:inline-block;
        background:linear-gradient(135deg,#EF2B2D,#009A44);
        color:#fff;text-decoration:none;padding:12px 28px;
        border-radius:8px;font-size:14px;font-weight:700;">
       → Voir le tableau de bord
     </a>
    </td>
   </tr>

   <!-- Footer -->
   <tr>
    <td style="background:#F9FAFB;padding:14px 32px;
      border-top:1px solid #E5E7EB;">
     <p style="margin:0;font-size:11px;color:#9CA3AF;text-align:center;">
       Message automatique — Ne pas répondre directement à cet email.<br/>
       Système de Gestion des Instances de la Direction · Burkina Faso
     </p>
    </td>
   </tr>

  </table>
 </td></tr>
</table>
</body></html>`;
}

// ── Envoi d'une alerte par email ──────────────────────────
async function envoyerAlerteEmail({ destinataire, priorite, dossier,
                                     objet, motif, responsable }) {
  if (!process.env.MAIL_USER || !process.env.MAIL_PASSWORD) {
    console.log('⚠️  Email ignoré : SMTP non configuré');
    return false;
  }
  try {
    const transporter = creerTransporteur();
    await transporter.sendMail({
      from:    process.env.MAIL_FROM || process.env.MAIL_USER,
      to:      destinataire,
      subject: `🔔 [${priorite}] Dossier ${dossier} — ${motif}`,
      html:    templateAlerte({ priorite, dossier, objet, motif, responsable }),
    });
    console.log(` Email envoyé à ${destinataire}`);
    return true;
  } catch (err) {
    console.error(` Échec envoi email à ${destinataire}:`, err.message);
    return false;
  }
}

// ── Email de validation de dossier ───────────────────────
async function envoyerEmailValidation({ destinataire, dossier,
                                         objet, validePar }) {
  if (!process.env.MAIL_USER || !process.env.MAIL_PASSWORD) return false;
  try {
    const transporter = creerTransporteur();
    await transporter.sendMail({
      from:    process.env.MAIL_FROM || process.env.MAIL_USER,
      to:      destinataire,
      subject: `✅ Dossier ${dossier} validé — ${objet}`,
      html: `<!DOCTYPE html>
<html><head><meta charset="UTF-8"/></head>
<body style="margin:0;padding:0;background:#F3F4F6;
  font-family:'Segoe UI',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0">
<tr><td align="center" style="padding:32px 16px;">
<table width="560" cellpadding="0" cellspacing="0"
  style="background:#fff;border-radius:12px;overflow:hidden;
    box-shadow:0 4px 20px rgba(0,0,0,0.1);">
<tr>
  <td style="background:linear-gradient(135deg,#EF2B2D,#009A44);
    padding:24px 32px;text-align:center;">
    <p style="margin:0;color:#fff;font-size:16px;font-weight:800;">
      ✅ Dossier Validé
    </p>
    <p style="margin:4px 0 0;color:rgba(255,255,255,0.8);font-size:12px;">
      Suivi des Instances — Burkina Faso
    </p>
  </td>
</tr>
<tr>
  <td style="padding:28px 32px;">
    <div style="background:#D1FAE5;border-radius:8px;padding:16px;
      border-left:4px solid #059669;margin-bottom:16px;">
      <p style="margin:0 0 4px;font-size:11px;color:#065F46;
        text-transform:uppercase;">Dossier validé</p>
      <p style="margin:0 0 2px;font-size:20px;font-weight:800;
        color:#059669;">${dossier}</p>
      <p style="margin:0;font-size:14px;color:#111827;">${objet}</p>
    </div>
    <p style="color:#374151;font-size:14px;line-height:1.6;">
      Ce dossier a été <strong>validé et clôturé</strong>
      par <strong>${validePar}</strong>.
      Le traitement est désormais marqué comme terminé.
    </p>
    <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/dossiers"
      style="display:inline-block;margin-top:16px;
        background:linear-gradient(135deg,#EF2B2D,#009A44);
        color:#fff;text-decoration:none;padding:12px 28px;
        border-radius:8px;font-size:14px;font-weight:700;">
      → Voir le dossier
    </a>
  </td>
</tr>
<tr>
  <td style="background:#F9FAFB;padding:14px 32px;
    border-top:1px solid #E5E7EB;">
    <p style="margin:0;font-size:11px;color:#9CA3AF;text-align:center;">
      Message automatique · Système Gestion Instances · Burkina Faso
    </p>
  </td>
</tr>
</table></td></tr></table>
</body></html>`,
    });
    console.log(`📧 Email validation envoyé à ${destinataire}`);
    return true;
  } catch (err) {
    console.error('❌ Email validation:', err.message);
    return false;
  }
}

module.exports = {
  testerConnexion,
  envoyerAlerteEmail,
  envoyerEmailValidation,
};
