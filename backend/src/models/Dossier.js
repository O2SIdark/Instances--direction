const mongoose = require("mongoose");

const tacheSchema = new mongoose.Schema({
  titre: { type: String, required: true },
  responsable: { type: String, required: true },
  statut: {
    type: String,
    enum: ["À faire", "En cours", "Terminée"],
    default: "À faire",
  },
  dateEcheance: { type: Date },
});

const intervenantSchema = new mongoose.Schema({
  nom: { type: String, required: true },
  role: { type: String, required: true },
  avancement: { type: Number, min: 0, max: 100, default: 0 },
});

const dossierSchema = new mongoose.Schema(
  {
    reference: { type: String, required: true, unique: true, trim: true },
    objet: { type: String, required: true, trim: true },
    instance: {
      type: String,
      required: true,
      enum: [
        "Conseil des ministres",
        "Comité de direction",
        "Réunion interministérielle",
        "Réunion technique",
      ],
    },
    dateLimite: { type: Date, required: true },
    dateFinEffective: { type: Date },
    statut: {
      type: String,
      enum: ["Initié", "En cours", "Bouclé", "En retard"],
      default: "Initié",
    },
    niveauMiseEnOeuvre: { type: Number, min: 0, max: 100, default: 0 },
    intervenants: [intervenantSchema],
    taches: [tacheSchema],
    alertes: [
      {
        type: { type: String },
        message: { type: String },
        date: { type: Date, default: Date.now },
        lue: { type: Boolean, default: false },
      },
    ],
  },
  { timestamps: true }
);

// Mettre à jour le statut automatiquement
dossierSchema.pre("save", function (next) {
  const now = new Date();
  if (this.niveauMiseEnOeuvre === 100) {
    this.statut = "Bouclé";
    if (!this.dateFinEffective) this.dateFinEffective = now;
  } else if (this.dateLimite < now && this.statut !== "Bouclé") {
    this.statut = "En retard";
  } else if (this.niveauMiseEnOeuvre > 0) {
    this.statut = "En cours";
  }
  next();
});

module.exports = mongoose.model("Dossier", dossierSchema);
