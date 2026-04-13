#!/usr/bin/env python3
# Reads pre-classified email JSON from stdin and outputs a compact digest
# for the plan-my-day agent to classify and format.
# Usage: fetch-emails.sh | summarize-emails.sh
import json, sys

data = json.load(sys.stdin)
pre = data.get("pre_classified", [])
unc = data.get("unclassified", [])

print(f"PRE-CLASSIFIED ({len(pre)} emails):")
for e in pre:
    print(f"  [{e['category']}] ID:{e['id']} | {e['from']} — {e['subject']}")

print(f"\nUNCLASSIFIED ({len(unc)} emails):")
for e in unc:
    print(f"  ID:{e['id']} | {e['from']} — {e['subject']}")
    snippet = (e.get("snippet") or "").strip()
    if snippet:
        print(f"    {snippet[:150]}")
    body = (e.get("body") or "").strip()
    if body and body != snippet:
        print(f"    body: {body[:300]}")
