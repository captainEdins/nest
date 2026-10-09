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
 * Matching: Prisma `contains` on SQLite compiles to `LIKE` — case-insensitive
 * for ASCII (names, NEST-R receipt numbers, phones). No mode:"insensitive"
 * (Postgres-only). No fuzzy matching — a deliberate non-goal (issue #76).
 *
 * Guardrails: q trimmed, 2–64 chars (else 400 VALIDATION with details),
 * per-kind take caps, total cap 24 rows, `force-dynamic` (session-scoped).
 * Receipt lookup additionally requires q ≥ 3 chars (NEST-R- is 7 — shorter
 * prefixes would fan out over the whole ledger).
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
  requireProfile,
  paymentScopeWhere,
  tenancyScopeWhere,
  ticketScopeWhere,
  validationError,
  visitorLogScopeWhere,
} from "@/lib/auth-guard";
import type { Profile } from "@prisma/client";
import type { SearchResultDto } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const querySchema = z.string().trim().min(2).max(64);

/** Per-kind caps keep the palette scannable and the response bounded. */
const CAP = {
  tenants: 6,
  receipts: 6,
  tickets: 5,
  listings: 4,
  applicants: 5,
  visitors: 6,
  incidents: 4,
} as const;

/** Never return more than 24 rows regardless of branch. */
const TOTAL_CAP = 24;

export async function GET(request: Request) {
  try {
    const profile = await requireProfile();
    const url = new URL(request.url);
    const parsed = querySchema.safeParse(url.searchParams.get("q") ?? "");
    if (!parsed.success) {
      throw validationError(
        parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
        "Search query must be 2–64 characters"
      );
    }
    const q = parsed.data;
    const results: SearchResultDto[] = [];

    // ---- People & money & ops (LANDLORD / CARETAKER) ------------------------
    if (profile.role === "LANDLORD" || profile.role === "CARETAKER") {
      results.push(...(await searchTenants(profile, q)));
      results.push(...(await searchReceipts(profile, q)));
      results.push(...(await searchTickets(profile, q)));
      results.push(...(await searchListings(profile, q)));
      results.push(...(await searchApplicants(profile, q)));
    }

    // ---- Tenant: their own receipts and their own tickets ------------------
    if (profile.role === "TENANT") {
      results.push(...(await searchReceipts(profile, q)));
      results.push(...(await searchTickets(profile, q)));
    }

    // ---- Agent: the funnel they own (+ receipts across their chain) ---------
    if (profile.role === "AGENT") {
      results.push(...(await searchListings(profile, q)));
      results.push(...(await searchApplicants(profile, q)));
      results.push(...(await searchReceipts(profile, q)));
    }

    // ---- Guard: the gate book they write ------------------------------------
    if (profile.role === "GUARD") {
      results.push(...(await searchVisitors(profile, q)));
      results.push(...(await searchIncidents(profile, q)));
    }

    return ok(results.slice(0, TOTAL_CAP));
  } catch (error) {
    return handleRouteError(error);
  }
}

// ---------------------------------------------------------------------------
// Branch queries — one per kind, each scoped + capped + mapped to the DTO.
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
    tab: "arrears",
    at: null,
  }));
}

/** Receipts by receipt number (NEST-R-…). Amount stays server-formatted. */
async function searchReceipts(profile: Profile, q: string): Promise<SearchResultDto[]> {
  if (profile.role === "GUARD" || q.length < 3) return []; // money endpoint — matrix §5.3
  const receipts = await db.payment.findMany({
    where: {
      status: "COMPLETED",
      receiptNo: { contains: q },
      ...(await paymentScopeWhere(profile)),
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
    id: p.receiptNo!,
    title: p.receiptNo!,
    subtitle:
      p.tenancy ? `${p.tenancy.tenant.fullName} · ${p.tenancy.unit.label}` : "Unmatched payment",
    meta: formatKes(p.amountMinor),
    tab: profile.role === "TENANT" ? "receipts" : "payments",
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
    tab: "repairs",
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
    tab: "listings",
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
    tab: "listings",
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
    tab: "visitors",
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
    tab: "incidents",
    at: i.createdAt.toISOString(),
  }));
}
