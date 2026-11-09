/**
 * Teste HTTP ale aplicatiei Express FARA baza de date: verifica raspunsurile
 * care nu trebuie sa depinda de MongoDB (coduri de eroare, CORS, auth, 503).
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";

let server;
let base;

beforeAll(async () => {
  delete process.env.MONGODB_URI; // fortam "baza indisponibila"
  process.env.CORS_ORIGIN = "http://localhost:5173";
  const { createApp } = await import("../src/app.js");
  server = createApp().listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});

afterAll(() => new Promise((resolve) => server.close(resolve)));

describe("API fara baza de date", () => {
  it("health raporteaza starea bazei (503 cand e deconectata)", async () => {
    const response = await fetch(`${base}/api/health`);
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ ok: false, db: "disconnected" });
  });

  it("rutele care au nevoie de DB raspund rapid cu 503, nu atarna", async () => {
    const started = Date.now();
    const response = await fetch(`${base}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "a@b.ro", password: "123456" }),
    });
    expect(response.status).toBe(503);
    expect(Date.now() - started).toBeLessThan(2000);
  });

  it("JSON invalid -> 400 (nu 500)", async () => {
    const response = await fetch(`${base}/api/health-nu-exista`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{nu e json",
    });
    expect(response.status).toBe(400);
  });

  it("origine CORS nepermisa -> 403 (nu 500)", async () => {
    const response = await fetch(`${base}/api/health`, {
      headers: { Origin: "https://site-strain.example" },
    });
    expect(response.status).toBe(403);
  });

  it("origine CORS permisa trece", async () => {
    const response = await fetch(`${base}/api/health`, {
      headers: { Origin: "http://localhost:5173" },
    });
    expect(response.headers.get("access-control-allow-origin")).toBe("http://localhost:5173");
  });
});
