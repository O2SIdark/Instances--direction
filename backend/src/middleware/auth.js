const jwt = require('jsonwebtoken');
require('dotenv').config();

function authMiddleware(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Token manquant ou invalide' });
  }
  try {
    req.utilisateur = jwt.verify(
      header.split(' ')[1],
      process.env.JWT_SECRET
    );
    next();
  } catch {
    return res.status(401).json({ message: 'Token expiré ou invalide' });
  }
}

module.exports = { authMiddleware };
