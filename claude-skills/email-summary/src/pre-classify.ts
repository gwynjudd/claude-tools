import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import {
  getClassifications,
  storeStep2Result,
} from "./email-cache.js";

export interface Email {
  id: string;
  from: string;
  fromEmail: string;
  subject: string;
  date: string;
  snippet: string;
  body: string;
  hasAttachments: boolean;
}

export interface ClassifiedEmail extends Email {
  category: string;
  confidence: "high";
}

export interface CachedEmail extends Email {
  category: string;
  attachments_downloaded: boolean;
}

export interface Output {
  pre_classified: ClassifiedEmail[];
  unclassified: Email[];
  from_cache: CachedEmail[];
}

// Categories that require attachment download before an email is fully done
const ATTACHMENT_NEEDED_CATEGORIES = new Set(['RENTAL_PROPERTY', 'GIVING']);

export interface FamilyConfig {
  names: string[];
  emails: string[];
}

export interface CategoriesConfig {
  rentalDomains: string[];
  charities: string[];
  discardAddressPatterns: string[];
  discardBodySignals: string[];
}

export interface Config {
  family: FamilyConfig;
  categories: CategoriesConfig;
}

export function loadConfig(): Config {
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const configDir = resolve(__dirname, "../config");

  const family: FamilyConfig = JSON.parse(
    readFileSync(resolve(configDir, "family.json"), "utf-8")
  );
  const categories: CategoriesConfig = JSON.parse(
    readFileSync(resolve(configDir, "categories.json"), "utf-8")
  );

  return { family, categories };
}

function extractDomain(email: string): string {
  const atIndex = email.lastIndexOf("@");
  if (atIndex === -1) return "";
  return email.slice(atIndex + 1).toLowerCase();
}

function classify(
  email: Email,
  family: FamilyConfig,
  categories: CategoriesConfig
): string | null {
  const fromLower = email.from.toLowerCase();
  const fromEmailLower = email.fromEmail.toLowerCase();

  // Priority 1: Family
  for (const name of family.names) {
    if (fromLower.includes(name.toLowerCase())) {
      return "FAMILY";
    }
  }
  for (const familyEmail of family.emails) {
    if (fromEmailLower === familyEmail.toLowerCase()) {
      return "FAMILY";
    }
  }

  // Priority 2: Rental property — exact domain match
  const domain = extractDomain(fromEmailLower);
  for (const rentalDomain of categories.rentalDomains) {
    if (domain === rentalDomain.toLowerCase()) {
      return "RENTAL_PROPERTY";
    }
  }

  // Priority 3: Charity — case-insensitive substring in from
  for (const charity of categories.charities) {
    if (fromLower.includes(charity.toLowerCase())) {
      return "GIVING";
    }
  }

  // Priority 4: Discard address pattern — fromEmail contains pattern
  for (const pattern of categories.discardAddressPatterns) {
    if (fromEmailLower.includes(pattern.toLowerCase())) {
      return "DISCARD";
    }
  }

  // Priority 5: Discard body signal — case-insensitive substring in body
  const bodyLower = email.body.toLowerCase();
  for (const signal of categories.discardBodySignals) {
    if (bodyLower.includes(signal.toLowerCase())) {
      return "DISCARD";
    }
  }

  return null;
}

export function classifyAll(emails: Email[], config: Config): Output {
  const output: Output = { pre_classified: [], unclassified: [], from_cache: [] };
  const allIds = emails.map(e => e.id);
  const cached = getClassifications(allIds);

  for (const email of emails) {
    const entry = cached.get(email.id);

    if (!entry) {
      // Never seen — run rules, always write a row
      const category = classify(email, config.family, config.categories);
      storeStep2Result(email.id, category);
      if (category !== null) {
        output.pre_classified.push({ ...email, category, confidence: "high" });
      } else {
        output.unclassified.push(email);
      }
      continue;
    }

    const effectiveCategory = entry.ai_classification ?? entry.pre_classification;

    if (effectiveCategory !== null) {
      // Step 2 ran and a category is known (via rules or AI)
      const needsAttachments =
        ATTACHMENT_NEEDED_CATEGORIES.has(effectiveCategory) && email.hasAttachments;
      const fullyDone = !needsAttachments || entry.attachments_downloaded;
      if (fullyDone) {
        output.from_cache.push({
          ...email,
          category: effectiveCategory,
          attachments_downloaded: entry.attachments_downloaded,
        });
      } else {
        // Has a known category but attachments still needed
        output.pre_classified.push({ ...email, category: effectiveCategory, confidence: "high" });
      }
    } else {
      // Both null: step 2 ran, no rule match, AI not yet done → needs AI
      output.unclassified.push(email);
    }
  }

  return output;
}

// --- CLI entry point (only runs when executed directly, not when imported) ---

async function run(): Promise<void> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  const emails: Email[] = JSON.parse(Buffer.concat(chunks).toString("utf-8").trim());
  process.stdout.write(JSON.stringify(classifyAll(emails, loadConfig()), null, 2) + "\n");
}

const isMain = process.argv[1] === fileURLToPath(import.meta.url);
if (isMain) {
  await run();
}
