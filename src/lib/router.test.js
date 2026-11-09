import { describe, it, expect } from "vitest";
import { parseRoute, currentPath, ROUTES } from "./router.js";

describe("router pe hash", () => {
  it("normalizeaza calea din hash", () => {
    expect(currentPath("")).toBe("/");
    expect(currentPath("#")).toBe("/");
    expect(currentPath("#/clasament/")).toBe("/clasament");
    expect(currentPath("#clasament")).toBe("/clasament");
    expect(currentPath("#/zilnic?x=1")).toBe("/zilnic");
  });

  it("recunoaste rutele statice", () => {
    expect(parseRoute("#/").name).toBe("home");
    expect(parseRoute("#/zilnic").name).toBe("daily");
    expect(parseRoute("#/realizari").name).toBe("achievements");
    expect(parseRoute("#/clasament").name).toBe("leaderboard");
    expect(parseRoute("#/turing").name).toBe("turing");
  });

  it("extrage parametrii", () => {
    expect(parseRoute("#/nivel/hard")).toEqual({ name: "level", params: { level: "hard" } });
    expect(parseRoute("#/puzzle/42")).toEqual({ name: "puzzle", params: { id: 42 } });
  });

  it("rutele necunoscute sau malformate -> notFound", () => {
    expect(parseRoute("#/nu-exista").name).toBe("notFound");
    expect(parseRoute("#/puzzle/abc").name).toBe("notFound");
    expect(parseRoute("#/nivel/").name).toBe("notFound");
  });

  it("ROUTES si parseRoute sunt inverse", () => {
    expect(parseRoute(ROUTES.puzzle(7))).toEqual({ name: "puzzle", params: { id: 7 } });
    expect(parseRoute(ROUTES.level("expert")).params.level).toBe("expert");
    expect(parseRoute(ROUTES.leaderboard()).name).toBe("leaderboard");
  });
});
