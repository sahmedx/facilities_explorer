import { describe, it, expect } from "vitest";
import { leversToQuery, leversFromQuery } from "./levers";
import { defaultLevers, presets } from "./base-case";

describe("URL serialization", () => {
  it("default levers produce empty query", () => {
    expect(leversToQuery(defaultLevers)).toBe("");
  });

  it("Expand-to-plan preset round-trips (and emits e=1 since default is e=0)", () => {
    const q = leversToQuery(presets.expandToPlan);
    expect(q).toContain("e=1");
    const back = leversFromQuery(q);
    expect(back.expand).toBe(true);
    expect(back.density).toBe(presets.expandToPlan.density);
    expect(back.snacksPerHCYearly).toBe(presets.expandToPlan.snacksPerHCYearly);
  });

  it("Invest-ahead preset round-trips", () => {
    const q = leversToQuery(presets.investAhead);
    expect(q).toContain("d=200");
    expect(q).toContain("b=500");
    expect(q).toContain("f=4500");
    expect(q).toContain("e=1");
    const back = leversFromQuery(q);
    expect(back.density).toBe(200);
    expect(back.buildoutCost).toBe(500);
    expect(back.fnfPerSeat).toBe(4500);
    expect(back.expand).toBe(true);
  });

  it("hcVariance encodes as integer percent", () => {
    const q = leversToQuery({ ...defaultLevers, hcVariance: -0.1 });
    expect(q).toContain("hc=-10");
    const back = leversFromQuery("?hc=10");
    expect(back.hcVariance).toBeCloseTo(0.1, 4);
  });

  it("invalid / out-of-range params fall back to defaults", () => {
    const back = leversFromQuery("?d=99999&s=abc&hc=100");
    expect(back.density).toBe(defaultLevers.density);
    expect(back.snacksPerHCYearly).toBe(defaultLevers.snacksPerHCYearly);
    expect(back.hcVariance).toBe(defaultLevers.hcVariance);
  });

  it("missing params hydrate to defaults", () => {
    const back = leversFromQuery("");
    expect(back).toEqual(defaultLevers);
  });

  it("hold-the-line preset (= defaults) produces empty query", () => {
    // defaultLevers IS the hold-the-line preset; nothing differs to encode.
    expect(leversToQuery(presets.holdLine)).toBe("");
  });

  it("expand=true (the non-default) serializes to e=1 and round-trips", () => {
    const q = leversToQuery({ ...defaultLevers, expand: true });
    expect(q).toContain("e=1");
    expect(leversFromQuery(q).expand).toBe(true);
  });

  it("invalid expand param falls back to default (false / hold-the-line)", () => {
    expect(leversFromQuery("?e=banana").expand).toBe(false);
  });
});
