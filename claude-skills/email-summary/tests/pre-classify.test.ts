import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the cache module before importing classifyAll
vi.mock("../src/email-cache.js", () => ({
  getClassifications: vi.fn().mockReturnValue(new Map()),
  storeStep2Result: vi.fn(),
}));

import { getClassifications, storeStep2Result } from "../src/email-cache.js";
import { classifyAll, loadConfig } from "../src/pre-classify.js";
import type { Email } from "../src/pre-classify.js";

const config = loadConfig();

beforeEach(() => {
  vi.clearAllMocks();
  // Default: no cache entries (all emails are new)
  vi.mocked(getClassifications).mockReturnValue(new Map());
});

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

  it("14. output has correct shape: { pre_classified, unclassified, from_cache }", () => {
    const emails = [
      makeEmail({ id: "x1", from: "Devika Judd <d@g.com>", fromEmail: "d@g.com" }),
      makeEmail({ id: "x2" }),
    ];
    const result = classifyAll(emails, config);
    expect(result).toHaveProperty("pre_classified");
    expect(result).toHaveProperty("unclassified");
    expect(result).toHaveProperty("from_cache");
    expect(Array.isArray(result.pre_classified)).toBe(true);
    expect(Array.isArray(result.unclassified)).toBe(true);
    expect(Array.isArray(result.from_cache)).toBe(true);
  });

  it("15. new emails call storeStep2Result with the matched/null category", () => {
    const emails = [
      makeEmail({ id: "c1", from: "Devika Judd <d@g.com>", fromEmail: "d@g.com" }),
      makeEmail({ id: "c2" }),
    ];
    classifyAll(emails, config);
    expect(vi.mocked(storeStep2Result)).toHaveBeenCalledWith("c1", "FAMILY");
    expect(vi.mocked(storeStep2Result)).toHaveBeenCalledWith("c2", null);
  });

  // Cache path 1: ai_classification set, fully done → from_cache
  it("16. cache hit with ai_classification set and no attachments needed → from_cache", () => {
    const email = makeEmail({ id: "cached1", hasAttachments: false });
    vi.mocked(getClassifications).mockReturnValue(new Map([
      ["cached1", { external_id: "cached1", pre_classification: null, ai_classification: "PEOPLE", attachments_downloaded: false }],
    ]));

    const result = classifyAll([email], config);
    expect(result.from_cache).toHaveLength(1);
    expect(result.from_cache[0].category).toBe("PEOPLE");
    expect(result.pre_classified).toHaveLength(0);
    expect(result.unclassified).toHaveLength(0);
  });

  // Cache path 2: ai_classification set, needs attachments, not yet downloaded → pre_classified
  it("17. cache hit with ai_classification=RENTAL_PROPERTY, attachments not downloaded → pre_classified", () => {
    const email = makeEmail({ id: "cached2", hasAttachments: true });
    vi.mocked(getClassifications).mockReturnValue(new Map([
      ["cached2", { external_id: "cached2", pre_classification: null, ai_classification: "RENTAL_PROPERTY", attachments_downloaded: false }],
    ]));

    const result = classifyAll([email], config);
    expect(result.pre_classified).toHaveLength(1);
    expect(result.pre_classified[0].category).toBe("RENTAL_PROPERTY");
    expect(result.from_cache).toHaveLength(0);
  });

  // Cache path 3: pre_classification set, ai_classification null, attachments done → from_cache
  it("18. cache hit with pre_classification set, ai_classification null, attachments_downloaded → from_cache", () => {
    const email = makeEmail({ id: "cached3", hasAttachments: true });
    vi.mocked(getClassifications).mockReturnValue(new Map([
      ["cached3", { external_id: "cached3", pre_classification: "RENTAL_PROPERTY", ai_classification: null, attachments_downloaded: true }],
    ]));

    const result = classifyAll([email], config);
    expect(result.from_cache).toHaveLength(1);
    expect(result.from_cache[0].category).toBe("RENTAL_PROPERTY");
    expect(result.from_cache[0].attachments_downloaded).toBe(true);
  });

  // Cache path 4: both null → unclassified (needs AI)
  it("19. cache hit with both pre_classification and ai_classification null → unclassified", () => {
    const email = makeEmail({ id: "cached4" });
    vi.mocked(getClassifications).mockReturnValue(new Map([
      ["cached4", { external_id: "cached4", pre_classification: null, ai_classification: null, attachments_downloaded: false }],
    ]));

    const result = classifyAll([email], config);
    expect(result.unclassified).toHaveLength(1);
    expect(result.unclassified[0].id).toBe("cached4");
    expect(result.pre_classified).toHaveLength(0);
    expect(result.from_cache).toHaveLength(0);
    // storeStep2Result should NOT be called for cache hits
    expect(vi.mocked(storeStep2Result)).not.toHaveBeenCalled();
  });
});
