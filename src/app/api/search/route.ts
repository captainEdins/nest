/**
 * NEST — GET /api/search  (Phase 10, issue #76)
 *
 * The ⌘K palette's data source. READ-ONLY record lookup — no writes, so no
 * audit row and no notification (the matrix grants reads it already grants
 * via the list endpoints; this route never widens a scope, it only filters).
 *
 * Scope: every branch composes the SAME `*ScopeWhere` fragment the list
 * endpoints use (auth-guard §7.1 — routes never copy-paste conditions),
 * then adds a `contains` on top. A record you cannot list, you cannot find.
 * Deny-by-default: any role without a branch below returns [].
 *
 * Kind set (deliberate scoping, D-023): staff search is money-and-funnel
 * scoped. The gate book (visitors/incidents) is the GUARD's search domain —
 * landlord/caretaker see the gate as digests (SecurityScreen), not lookup
 * surfaces; tenants see 7 days of their own unit's traffic only. When the
 * pilot asks for staff gate lookup, add the branches here (the scope
 * fragments already grant the reads).
 *
 * Matching: Prisma `contains` on SQLite compiles to `LIKE` — case-insensitive
 * for ASCII (names, NEST-R receipt numbers, phones). No mode:"insensitive"
 * (Postgres-only). No fuzzy matching — a deliberate non-goal (issue #76).
 *
 * Guardrails: q trimmed 2–64 chars (parseSearchParams → 400 VALIDATION with
 * zod details), per-kind caps summing ≤ TOTAL_CAP for the widest branch,
 * `force-dynamic` (session-scoped). Receipt lookup additionally requires
 * q ≥ 3 chars (NEST-R- is 7 — shorter prefixes would fan out over the whole
 * ledger). Branch queries run in PARALLEL (independent reads — a landlord
 * keystroke is one round-trip batch, not five serial ones).
 */

import { z } from "zod";
import { db } from "@/lib/db";
import { formatKes } from "@/lib/money";
import {
  applicationScopeWhere,
  handleRouteError,
  incidentScopeWhere,
  listingScopeWhere,
  ok,
  parseSearchParams,
  paymentScopeWhere,
  requireProfile,
  tenancyScopeWhere,
  ticketScopeWhere,
  visitorLogScopeWhere,
} from "@/lib/auth-guard";
import type { Profile } from "@prisma/client";
import type { SearchResultDto } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const querySchema = z.object({ q: z.string().trim().min(2).max(64) });

/** Per-kind caps — the LANDLORD branch (widest) sums to exactly 24. */
const CAP = {
  tenants: 6,
  receipts: 6,
  tickets: 4,
  listings: 3,
  applicants: 5,
  visitors: 6,
  incidents: 4,
} as const;

/** Hard ceiling regardless of branch (belt + braces). */
const TOTAL_CAP = 24;

export async function GET(request: Request) {
  try {
    const profile = await requireProfile();
    const { q } = parseSearchParams(request, querySchema);

    // Branches run their kind searches in parallel (independent reads).
    // TENANT                     → own receipts + own tickets.
    // AGENT                      → listings, applicants, chain receipts.
    // GUARD                      → the gate book they write.
    // LANDLORD / CARETAKER       → tenants, receipts, tickets, funnel.
    // Anything else (future)     → [] (deny by default).
    let results: SearchResultDto[] = [];

    if (profile.role === "LANDLORD" || profile.role === "CARETAKER") {
      const [tenants, receipts, tickets, listings, applicants] = await Promise.all([
        searchTenants(profile, q),
        searchReceipts(profile, q),
        searchTickets(profile, q),
        searchListings(profile, q),
        searchApplicants(profile, q),
      ]);
      results = [...tenants, ...receipts, ...tickets, ...listings, ...applicants];
    } else if (profile.role === "TENANT") {
      const [receipts, tickets] = await Promise.all([
        searchReceipts(profile, q),
        searchTickets(profile, q),
      ]);
      results = [...receipts, ...tickets];
    } else if (profile.role === "AGENT") {
      const [listings, applicants, receipts] = await Promise.all([
        searchListings(profile, q),
        searchApplicants(profile, q),
        searchReceipts(profile, q),
      ]);
      results = [...listings, ...applicants, ...receipts];
    } else if (profile.role === "GUARD") {
      const [visitors, incidents] = await Promise.all([
        searchVisitors(profile, q),
        searchIncidents(profile, q),
      ]);
      results = [...visitors, ...incidents];
    }

    return ok(results.slice(0, TOTAL_CAP));
  } catch (error) {
    return handleRouteError(error);
  }
}

// ---------------------------------------------------------------------------
// Branch queries — one per kind, each scoped + capped + mapped to the DTO.
// The DTO carries NO tab field on purpose (PE review, PR #77): the palette's
// navigateTo() owns routing entirely, keyed by kind + the client-side role —
// server tab hints drifted from per-role tab surfaces before.
// ---------------------------------------------------------------------------

/** Tenants by name or phone, via the tenancy scope (ACTIVE only — the money view). */
async function searchTenants(profile: Profile, q: string): Promise<SearchResultDto[]> {
  const tenancies = await db.tenancy.findMany({
    where: {
      status: "ACTIVE",
      ...tenancyScopeWhere(profile),
      tenant: {
        OR: [{ fullName: { contains: q } }, { phone: { contains: q } }],
      },
    },
    select: {
      id: true,
      tenant: { select: { fullName: true } },
      unit: { select: { label: true, property: { select: { name: true } } } },
    },
    take: CAP.tenants,
    orderBy: { createdAt: "desc" },
  });
  return tenancies.map((t) => ({
    kind: "TENANT" as const,
    id: t.id,
    title: t.tenant.fullName,
    subtitle: `${t.unit.label} · ${t.unit.property.name}`,
    meta: null,
    at: null,
  }));
}

/** Receipts by receipt number (NEST-R-…). Amount stays server-formatted.
 *  Explicit receiptNo NOT NULL — the `p.receiptNo!` mapping is invariant,
 *  not accidental. */
async function searchReceipts(profile: Profile, q: string): Promise<SearchResultDto[]> {
  if (profile.role === "GUARD" || q.length < 3) return []; // money endpoint — matrix §5.3
  const receipts = await db.payment.findMany({
    where: {
      status: "COMPLETED",
      ...(await paymentScopeWhere(profile)),
      receiptNo: { not: null, contains: q },
    },
    select: {
      receiptNo: true,
      amountMinor: true,
      receivedAt: true,
      tenancy: {
        select: { tenant: { select: { fullName: true } }, unit: { select: { label: true } } },
      },
    },
    take: CAP.receipts,
    orderBy: { receivedAt: "desc" },
  });
  return receipts.map((p) => ({
    kind: "RECEIPT" as const,
    id: p.receiptNo ?? "",
    title: p.receiptNo ?? "",
    subtitle:
      p.tenancy ? `${p.tenancy.tenant.fullName} · ${p.tenancy.unit.label}` : "Unmatched payment",
    meta: formatKes(p.amountMinor),
    at: p.receivedAt.toISOString(),
  }));
}

/** Tickets by title or description. */
async function searchTickets(profile: Profile, q: string): Promise<SearchResultDto[]> {
  const tickets = await db.maintenanceTicket.findMany({
    where: {
      ...ticketScopeWhere(profile),
      OR: [{ title: { contains: q } }, { description: { contains: q } }],
    },
    select: {
      id: true,
      title: true,
      status: true,
      createdAt: true,
      unit: { select: { label: true, property: { select: { name: true } } } },
    },
    take: CAP.tickets,
    orderBy: { createdAt: "desc" },
  });
  return tickets.map((t) => ({
    kind: "TICKET" as const,
    id: t.id,
    title: t.title,
    subtitle: `${t.unit.label} · ${t.unit.property.name}`,
    meta: t.status,
    at: t.createdAt.toISOString(),
  }));
}

/** Listings by title. */
async function searchListings(profile: Profile, q: string): Promise<SearchResultDto[]> {
  if (profile.role === "TENANT" || profile.role === "GUARD") return [];
  const listings = await db.listing.findMany({
    where: {
      ...listingScopeWhere(profile),
      title: { contains: q },
    },
    select: {
      id: true,
      title: true,
      rentAmountMinor: true,
      unit: { select: { property: { select: { name: true } } } },
    },
    take: CAP.listings,
    orderBy: { updatedAt: "desc" },
  });
  return listings.map((l) => ({
    kind: "LISTING" as const,
    id: l.id,
    title: l.title,
    subtitle: l.unit.property.name,
    meta: formatKes(l.rentAmountMinor),
    at: null,
  }));
}

/** Applicants by name or phone, via the application scope. */
async function searchApplicants(profile: Profile, q: string): Promise<SearchResultDto[]> {
  if (profile.role === "TENANT" || profile.role === "GUARD") return [];
  const applications = await db.listingApplication.findMany({
    where: {
      ...applicationScopeWhere(profile),
      OR: [{ applicantName: { contains: q } }, { applicantPhone: { contains: q } }],
    },
    select: {
      id: true,
      applicantName: true,
      status: true,
      listing: { select: { title: true } },
    },
    take: CAP.applicants,
    orderBy: { createdAt: "desc" },
  });
  return applications.map((a) => ({
    kind: "APPLICANT" as const,
    id: a.id,
    title: a.applicantName,
    subtitle: a.listing.title,
    meta: a.status,
    at: null,
  }));
}

/** Visitors by name or phone — the guard's gate book. */
async function searchVisitors(profile: Profile, q: string): Promise<SearchResultDto[]> {
  const visitors = await db.visitorLog.findMany({
    where: {
      ...visitorLogScopeWhere(profile),
      OR: [{ visitorName: { contains: q } }, { visitorPhone: { contains: q } }],
    },
    select: {
      id: true,
      visitorName: true,
      purpose: true,
      exitedAt: true,
      enteredAt: true,
    },
    take: CAP.visitors,
    orderBy: { enteredAt: "desc" },
  });
  return visitors.map((v) => ({
    kind: "VISITOR" as const,
    id: v.id,
    title: v.visitorName,
    subtitle: v.purpose,
    meta: v.exitedAt ? "Exited" : "On site",
    at: v.enteredAt.toISOString(),
  }));
}

/** Incidents by description. */
async function searchIncidents(profile: Profile, q: string): Promise<SearchResultDto[]> {
  const incidents = await db.incidentReport.findMany({
    where: {
      ...incidentScopeWhere(profile),
      description: { contains: q },
    },
    select: {
      id: true,
      description: true,
      severity: true,
      createdAt: true,
    },
    take: CAP.incidents,
    orderBy: { createdAt: "desc" },
  });
  return incidents.map((i) => ({
    kind: "INCIDENT" as const,
    id: i.id,
    title: i.description.length > 72 ? `${i.description.slice(0, 72)}…` : i.description,
    subtitle: null,
    meta: i.severity,
    at: i.createdAt.toISOString(),
  }));
}
