/**
 * Handler central de erori — converteste erorile Mongoose/JWT/body-parser
 * in raspunsuri curate, fara a scurge detalii interne in productie.
 */

export function notFound(req, res) {
  res.status(404).json({ error: "Rută inexistentă." });
}

/** Eroare cu status HTTP explicit (ex. CORS respins). */
export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
    this.expose = true;
  }
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

  // Baza de date indisponibila in timpul cererii.
  if (error.name === "MongoServerSelectionError" || error.name === "MongoNotConnectedError") {
    return res.status(503).json({ error: "Baza de date nu este disponibilă momentan." });
  }

  // Erori cu status 4xx de la body-parser (JSON invalid = 400, payload prea mare = 413)
  // sau HttpError proprii. Inainte toate deveneau 500.
  const status = Number(error.status || error.statusCode);
  if (status >= 400 && status < 500) {
    const messages = {
      "entity.parse.failed": "Corpul cererii nu este JSON valid.",
      "entity.too.large": "Cererea este prea mare.",
    };
    const message =
      messages[error.type] || (error.expose ? error.message : null) || "Cerere invalidă.";
    return res.status(status).json({ error: message });
  }

  console.error("[error]", error);
  res.status(500).json({ error: "Eroare internă de server." });
}
