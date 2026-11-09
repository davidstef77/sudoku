import { describe, it, expect } from "vitest";
import api, { getToken } from "./api.js";

describe("obiectul api", () => {
  it("expune getToken (folosit de App.jsx pentru sincronizare)", () => {
    expect(typeof api.getToken).toBe("function");
    expect(api.getToken()).toBe(getToken());
  });
});
