import { describe, it, expect, vi, afterEach } from "vitest";
import api, { getToken } from "./api.js";

const ok = (body) => ({ ok: true, status: 200, json: async () => body });
const fail = (status, body = {}) => ({ ok: false, status, json: async () => body });

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("obiectul api", () => {
  it("expune getToken (folosit de App.jsx pentru sincronizare)", () => {
    expect(typeof api.getToken).toBe("function");
    expect(api.getToken()).toBe(getToken());
  });
});

describe("request: erori clare + reincercari", () => {
  it("timeout -> mesaj clar (nu 'Fetch is aborted') si reincearca o data", async () => {
    vi.useFakeTimers();
    // Ca Safari: abort-ul respinge cu AbortError "Fetch is aborted", fara motiv.
    const fetchMock = vi.fn((_url, { signal }) => new Promise((_, reject) => {
      signal.addEventListener("abort", () =>
        reject(Object.assign(new Error("Fetch is aborted"), { name: "AbortError" }))
      );
    }));
    vi.stubGlobal("fetch", fetchMock);

    const promise = api.fetchLeaderboard();
    const assertion = expect(promise).rejects.toMatchObject({
      code: "timeout",
      message: expect.stringMatching(/răspunde greu/),
    });
    await vi.runAllTimersAsync();
    await assertion;
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("eroare de retea -> mesaj clar", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", vi.fn(async () => { throw new TypeError("Load failed"); }));
    const promise = api.fetchLeaderboard();
    const assertion = expect(promise).rejects.toMatchObject({ code: "network" });
    await vi.runAllTimersAsync();
    await assertion;
  });

  it("503 apoi succes -> reincercarea reuseste", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(fail(503, { error: "Baza de date nu este disponibilă" }))
      .mockResolvedValueOnce(ok({ entries: [] }));
    vi.stubGlobal("fetch", fetchMock);
    const promise = api.fetchLeaderboard();
    await vi.runAllTimersAsync();
    await expect(promise).resolves.toEqual({ entries: [] });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("erorile 4xx nu se reincearca, iar mesajul serverului e pastrat", async () => {
    const fetchMock = vi.fn().mockResolvedValue(fail(401, { error: "Email sau parolă greșită." }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(api.fetchLeaderboard()).rejects.toMatchObject({
      status: 401,
      message: "Email sau parolă greșită.",
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("inregistrarea NU se reincearca (nu dublam contul)", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn().mockResolvedValue(fail(503));
    vi.stubGlobal("fetch", fetchMock);
    const promise = api.register("a@b.ro", "123456", "");
    const assertion = expect(promise).rejects.toMatchObject({ status: 503 });
    await vi.runAllTimersAsync();
    await assertion;
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
