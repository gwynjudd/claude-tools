import { describe, it, expect } from "vitest";
import { classifyAll, loadConfig } from "../src/pre-classify.js";
import type { Email } from "../src/pre-classify.js";

const config = loadConfig();

function makeEmail(overrides: Partial<Email> & { id: string }): Email {
  return {
    from: "Test User <test@example.com>",
    fromEmail: "test@example.com",
    subject: "Test Subject",
    date: "2026-01-01",
    snippet: "snippet",
    body: "Hello, this is a regular email.",
    hasAttachments: false,
    ...overrides,
  };
}

describe("pre-classify", () => {
  it("1. family name match — Devika Judd", () => {
    const { pre_classified, unclassified } = classifyAll(
      [makeEmail({ id: "1", from: "Devika Judd <devika@gmail.com>", fromEmail: "devika@gmail.com" })],
      config
    );
    expect(pre_classified).toHaveLength(1);
    expect(pre_classified[0].category).toBe("FAMILY");
    expect(unclassified).toHaveLength(0);
  });

  it("2. family name match case-insensitive — devika judd", () => {
    const { pre_classified } = classifyAll(
      [makeEmail({ id: "2", from: "devika judd <devika@gmail.com>", fromEmail: "devika@gmail.com" })],
      config
    );
    expect(pre_classified).toHaveLength(1);
    expect(pre_classified[0].category).toBe("FAMILY");
  });

  it("3. another family name variant — Lalage Sales", () => {
    const { pre_classified } = classifyAll(
      [makeEmail({ id: "3", from: "Lalage Sales <lalage@x.com>", fromEmail: "lalage@x.com" })],
      config
    );
    expect(pre_classified).toHaveLength(1);
    expect(pre_classified[0].category).toBe("FAMILY");
  });

  it("4. rental domain exact match — aspireproperty.co.nz", () => {
    const { pre_classified } = classifyAll(
      [makeEmail({ id: "4", from: "Agent <agent@aspireproperty.co.nz>", fromEmail: "agent@aspireproperty.co.nz" })],
      config
    );
    expect(pre_classified).toHaveLength(1);
    expect(pre_classified[0].category).toBe("RENTAL_PROPERTY");
  });

  it("5. rental domain subdomain should NOT match", () => {
    const { pre_classified, unclassified } = classifyAll(
      [makeEmail({ id: "5", from: "Agent <x@sub.aspireproperty.co.nz>", fromEmail: "x@sub.aspireproperty.co.nz" })],
      config
    );
    expect(pre_classified).toHaveLength(0);
    expect(unclassified).toHaveLength(1);
  });

  it("6. charity name match — Barnardos NZ", () => {
    const { pre_classified } = classifyAll(
      [makeEmail({ id: "6", from: "Barnardos NZ <info@barnardos.org.nz>", fromEmail: "info@barnardos.org.nz" })],
      config
    );
    expect(pre_classified).toHaveLength(1);
    expect(pre_classified[0].category).toBe("GIVING");
  });

  it("7. charity name case-insensitive — barnardos", () => {
    const { pre_classified } = classifyAll(
      [makeEmail({ id: "7", from: "barnardos <x@y.com>", fromEmail: "x@y.com" })],
      config
    );
    expect(pre_classified).toHaveLength(1);
    expect(pre_classified[0].category).toBe("GIVING");
  });

  it("8. discard address pattern — noreply@bigco.com", () => {
    const { pre_classified } = classifyAll(
      [makeEmail({ id: "8", from: "BigCo <noreply@bigco.com>", fromEmail: "noreply@bigco.com" })],
      config
    );
    expect(pre_classified).toHaveLength(1);
    expect(pre_classified[0].category).toBe("DISCARD");
  });

  it("9. discard body signal — body contains 'unsubscribe'", () => {
    const { pre_classified } = classifyAll(
      [makeEmail({ id: "9", body: "Click here to unsubscribe from our list." })],
      config
    );
    expect(pre_classified).toHaveLength(1);
    expect(pre_classified[0].category).toBe("DISCARD");
  });

  it("10. body signal case-insensitive — UNSUBSCRIBE", () => {
    const { pre_classified } = classifyAll(
      [makeEmail({ id: "10", body: "Click here to UNSUBSCRIBE." })],
      config
    );
    expect(pre_classified).toHaveLength(1);
    expect(pre_classified[0].category).toBe("DISCARD");
  });

  it("11. no match → appears in unclassified", () => {
    const { pre_classified, unclassified } = classifyAll(
      [makeEmail({ id: "11", from: "Random Person <random@random.com>", fromEmail: "random@random.com", body: "Just a regular message." })],
      config
    );
    expect(pre_classified).toHaveLength(0);
    expect(unclassified).toHaveLength(1);
    expect(unclassified[0].id).toBe("11");
  });

  it("12. first-match-wins: family name + unsubscribe body → FAMILY", () => {
    const { pre_classified } = classifyAll(
      [makeEmail({ id: "12", from: "Sam Judd <sam@example.com>", fromEmail: "sam@example.com", body: "Please unsubscribe me." })],
      config
    );
    expect(pre_classified).toHaveLength(1);
    expect(pre_classified[0].category).toBe("FAMILY");
  });

  it("13. all matched emails have confidence 'high'", () => {
    const emails = [
      makeEmail({ id: "a", from: "Devika Judd <d@g.com>", fromEmail: "d@g.com" }),
      makeEmail({ id: "b", from: "Agent <agent@aspireproperty.co.nz>", fromEmail: "agent@aspireproperty.co.nz" }),
      makeEmail({ id: "c", body: "unsubscribe" }),
    ];
    const { pre_classified } = classifyAll(emails, config);
    expect(pre_classified).toHaveLength(3);
    for (const e of pre_classified) {
      expect(e.confidence).toBe("high");
    }
  });

  it("14. output has correct shape: { pre_classified, unclassified }", () => {
    const emails = [
      makeEmail({ id: "x1", from: "Devika Judd <d@g.com>", fromEmail: "d@g.com" }),
      makeEmail({ id: "x2" }),
    ];
    const result = classifyAll(emails, config);
    expect(result).toHaveProperty("pre_classified");
    expect(result).toHaveProperty("unclassified");
    expect(Array.isArray(result.pre_classified)).toBe(true);
    expect(Array.isArray(result.unclassified)).toBe(true);
  });
});
