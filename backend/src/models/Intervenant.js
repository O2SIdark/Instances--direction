const mongoose = require("mongoose");

const intervenantSchema = new mongoose.Schema(
  {
    nom: { type: String, required: true, trim: true },
    direction: { type: String, required: true, trim: true },
    role: { type: String, required: true, trim: true },
    email: { type: String, trim: true },
    telephone: { type: String, trim: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Intervenant", intervenantSchema);
