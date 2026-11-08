/**
 * Handler central de erori — converteste erorile Mongoose/JWT in raspunsuri
 * curate, fara a scurge detalii interne in productie.
 */

export function notFound(req, res) {
  res.status(404).json({ error: "Rută inexistentă." });
}

export function errorHandler(error, _req, res, _next) {
  // Erori de validare Mongoose.
  if (error.name === "ValidationError") {
    const first = Object.values(error.errors)[0];
    return res.status(400).json({ error: first?.message || "Date invalide." });
  }

  // Cast la ObjectId invalid (de ex. userId malformat).
  if (error.name === "CastError") {
    return res.status(400).json({ error: "Identificator invalid." });
  }

  console.error("[error]", error);
  res.status(500).json({ error: "Eroare internă de server." });
}
