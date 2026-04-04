import { describe, it, expect } from "vitest";
import { SELECTORS } from "../../src/ui/selectors.js";

describe("SELECTORS", () => {
  it("INPUT has contenteditable first and >= 3 selectors", () => { expect(SELECTORS.INPUT[0]).toBe('[contenteditable="true"]'); expect(SELECTORS.INPUT.length).toBeGreaterThanOrEqual(3); });
  it("SUBMIT has >= 2 selectors", () => { expect(SELECTORS.SUBMIT.length).toBeGreaterThanOrEqual(2); });
  it("STOP has >= 2 selectors", () => { expect(SELECTORS.STOP.length).toBeGreaterThanOrEqual(2); });
  it("RESPONSE has >= 1 selector with prose", () => { expect(SELECTORS.RESPONSE.length).toBeGreaterThanOrEqual(1); expect(SELECTORS.RESPONSE[0]).toContain("prose"); });
  it("MODE has all four modes", () => { expect(SELECTORS.MODE.search.length).toBeGreaterThanOrEqual(1); expect(SELECTORS.MODE.research.length).toBeGreaterThanOrEqual(1); expect(SELECTORS.MODE.labs.length).toBeGreaterThanOrEqual(1); expect(SELECTORS.MODE.learn.length).toBeGreaterThanOrEqual(1); });
});
