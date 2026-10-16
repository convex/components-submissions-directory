// Plain text message templates sent to submitters after a review outcome.
// Rendered with whitespace-pre-wrap on the Profile page and as markdown on
// GitHub, so keep formatting to line breaks, numbered lists, and dashes.
import { isCriticalCriterion } from "./reviewCriteria";

export const PREFLIGHT_CHECK_URL = "https://www.convex.dev/components/submit/check";
export const COMPONENT_AUTHORING_URL = "https://docs.convex.dev/components/authoring";
export const DIRECTORY_SITE_URL = "https://www.convex.dev/components";

const MAX_NOTE_LENGTH = 400;
const UNUSABLE_NOTE_PREFIX = "unable to check";

type CriterionResult = { name: string; passed: boolean; notes: string };

export function directoryListingUrl(pkg: { slug?: string; name: string }): string {
  return `${DIRECTORY_SITE_URL}/${pkg.slug ?? encodeURIComponent(pkg.name)}`;
}

function clip(text: string, max: number): string {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length > max ? `${clean.slice(0, max - 3).trimEnd()}...` : clean;
}

// AI summaries carry "Suggestions: ..." appended after a blank line.
function summaryLead(summary?: string): string | null {
  if (!summary) return null;
  const lead = summary.split(/\n\s*\n/)[0]?.trim();
  return lead ? clip(lead, MAX_NOTE_LENGTH * 2) : null;
}

function isUsable(criterion: CriterionResult): boolean {
  const notes = criterion.notes.trim();
  return notes.length > 0 && !notes.toLowerCase().startsWith(UNUSABLE_NOTE_PREFIX);
}

// True when a failed review has at least one reason worth sending.
export function hasRejectionReasons(
  criteria: Array<CriterionResult> | undefined,
  summary?: string,
): boolean {
  const failed = (criteria ?? []).filter((c) => !c.passed);
  if (failed.length === 0) return false;
  return failed.some(isUsable) || summaryLead(summary) !== null;
}

export function buildRejectionMessage(args: {
  displayName: string;
  criteria: Array<CriterionResult>;
  summary?: string;
}): string {
  const failed = args.criteria
    .map((criterion, index) => ({
      criterion,
      critical: isCriticalCriterion(criterion.name, index),
    }))
    .filter(({ criterion }) => !criterion.passed);

  const usable = failed.filter(({ criterion }) => isUsable(criterion));
  // Custom prompts may flag nothing critical; treat every failure as blocking then.
  const blocking = usable.some((f) => f.critical)
    ? usable.filter((f) => f.critical)
    : usable;
  const advisory = usable.some((f) => f.critical)
    ? usable.filter((f) => !f.critical)
    : [];

  const lines: Array<string> = [
    `Hi, thanks for submitting ${args.displayName} to the Convex Components Directory.`,
    "",
  ];

  if (blocking.length > 0) {
    lines.push(
      "We ran it through our component review and it isn't ready to list yet. Here's what needs to change:",
      "",
    );
    blocking.forEach(({ criterion }, i) => {
      lines.push(`${i + 1}. ${criterion.name}`);
      lines.push(`   ${clip(criterion.notes, MAX_NOTE_LENGTH)}`);
      lines.push("");
    });
  } else {
    const lead = summaryLead(args.summary);
    lines.push(
      "We ran it through our component review and it isn't ready to list yet.",
      "",
    );
    if (lead) {
      lines.push(lead, "");
    }
  }

  if (advisory.length > 0) {
    lines.push("Not blocking, but worth fixing:");
    for (const { criterion } of advisory) {
      lines.push(`- ${criterion.name}: ${clip(criterion.notes, MAX_NOTE_LENGTH)}`);
    }
    lines.push("");
  }

  lines.push(
    "Fastest way to confirm the fix: run the Component Preflight Check on your repo. It runs the same checks we use, so you'll see what passes before you resubmit.",
    PREFLIGHT_CHECK_URL,
    "",
    `Authoring guide: ${COMPONENT_AUTHORING_URL}`,
    "",
    "Once the preflight check passes, reply here and we'll take another look.",
  );

  return lines.join("\n");
}

export function buildApprovalMessage(args: {
  displayName: string;
  listingUrl: string;
}): string {
  return [
    `Hi, good news. ${args.displayName} is approved and listed in the Convex Components Directory:`,
    args.listingUrl,
    "",
    "Thanks for building it and sharing it with the community.",
    "",
    "Questions or changes to the listing? Reply here.",
  ].join("\n");
}
