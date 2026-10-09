"use client";

/**
 * NEST — SearchPalette (Phase 10, issue #76) · Monty-style ⌘K command palette.
 *
 * One palette, two presentations (design-system §9.3): vaul Drawer below sm
 * (thumb-reachable) · Radix Dialog ≥sm (top-anchored, D-022 2xl radius +
 * nest-card-shadow). The body — input, grouped rows, keyboard nav — is shared.
 *
 * Deep-linking: a row never renders its own record view; it routes into the
 * EXISTING surfaces (tab switch + detail-modal/pushed-screen open), so search
 * results stay consistent with the screens users already trust. Caretaker's
 * arrears is a pushed screen (not a tab) — mapped via role, not the server hint.
 *
 * Keyboard: Ctrl/⌘+K opens (global listener), ↑/↓ move, Enter picks, Esc closes.
 * Touch: every row is 44px min-height (design-system §8). Rows scroll in a
 * max-h-[60vh] list with the .nest-scrollbar treatment (§9 long lists).
 */

import * as React from "react";
import { useMediaQuery } from "@/hooks/use-media-query";
import { useI18n } from "@/lib/i18n";
import { useSearch } from "@/hooks/use-search";
import { useUIStore } from "@/lib/ui-store";
import type { Role, SearchResultDto, SearchKind } from "@/lib/types";
import { formatDate } from "@/components/nest/shared/format";
import {
  Contact,
  DoorOpen,
  Loader2,
  Megaphone,
  Receipt,
  Search,
  ShieldAlert,
  Users,
  Wrench,
  X,
  type LucideIcon,
} from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Drawer, DrawerContent, DrawerTitle } from "@/components/ui/drawer";
import { cn } from "@/lib/utils";
import type { TranslationKey } from "@/lib/i18n/en";

const KIND_ICON: Record<SearchKind, LucideIcon> = {
  TENANT: Users,
  RECEIPT: Receipt,
  TICKET: Wrench,
  LISTING: Megaphone,
  APPLICANT: Contact,
  VISITOR: DoorOpen,
  INCIDENT: ShieldAlert,
};

/** Pastel icon tiles per kind — the D-022 pastel-chip family, hue-matched to
 *  each domain (tenants/green, money/teal, repairs/amber, alerts/red). */
const KIND_TILE: Record<SearchKind, string> = {
  TENANT: "bg-primary/10 text-primary",
  RECEIPT: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  TICKET: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
  LISTING: "bg-teal-500/10 text-teal-700 dark:text-teal-400",
  APPLICANT: "bg-primary/10 text-primary",
  VISITOR: "bg-teal-500/10 text-teal-700 dark:text-teal-400",
  INCIDENT: "bg-red-500/10 text-red-700 dark:text-red-400",
};

const GROUP_ORDER: SearchKind[] = ["TENANT", "RECEIPT", "TICKET", "LISTING", "APPLICANT", "VISITOR", "INCIDENT"];

/** Literal-union cast for dynamic kind keys (codebase pattern — see
 *  guard/incidents.tsx). The dictionaries cover every SearchKind. */
const groupKey = (kind: SearchKind) => `search.group.${kind}` as TranslationKey;

export function SearchPalette({ role }: { role: Role }) {
  const isDesktop = useMediaQuery("(min-width: 640px)");
  const { t } = useI18n();
  const searchOpen = useUIStore((s) => s.searchOpen);
  const setSearchOpen = useUIStore((s) => s.setSearchOpen);

  // Global ⌘K / Ctrl+K — opens from anywhere (even while another modal is
  // closed). Only when signed in (the palette mounts inside RoleShell).
  React.useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setSearchOpen(true);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [setSearchOpen]);

  const body = <PaletteBody role={role} onClose={() => setSearchOpen(false)} />;

  if (isDesktop) {
    return (
      <Dialog open={searchOpen} onOpenChange={setSearchOpen}>
        <DialogContent
          showCloseButton={false}
          className="top-[10vh] translate-y-0 rounded-2xl p-0 gap-0 overflow-hidden nest-card-shadow sm:max-w-lg"
        >
          {/* Radix a11y contract: the dialog needs a name. Visually the input
           *  placeholder is the title; screen readers get the sr-only twin. */}
          <DialogTitle className="sr-only">{t("search.trigger")}</DialogTitle>
          {body}
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Drawer open={searchOpen} onOpenChange={setSearchOpen}>
      <DrawerContent className="rounded-t-2xl p-0 gap-0 overflow-hidden nest-card-shadow">
        <DrawerTitle className="sr-only">{t("search.trigger")}</DrawerTitle>
        {body}
      </DrawerContent>
    </Drawer>
  );
}

// ---------------------------------------------------------------------------

function PaletteBody({ role, onClose }: { role: Role; onClose: () => void }) {
  const { t } = useI18n();
  const [query, setQuery] = React.useState("");
  const [activeIndex, setActiveIndex] = React.useState(0);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const listRef = React.useRef<HTMLDivElement>(null);
  const { data: results, isFetching } = useSearch(query);

  const flat = React.useMemo(() => results ?? [], [results]);
  const trimmed = query.trim();
  const showResults = trimmed.length >= 2;

  // Reset the cursor whenever the result set changes (new query / refetch).
  React.useEffect(() => {
    setActiveIndex(0);
  }, [flat.length, trimmed]);

  // Focus the input on open (desktop Dialog autofocuses the first focusable
  // anyway; the Drawer needs the explicit nudge for the on-screen keyboard).
  React.useEffect(() => {
    if (inputRef.current) inputRef.current.focus();
  }, []);

  function pick(result: SearchResultDto) {
    onClose();
    navigateTo(result, role);
    setQuery("");
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, flat.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (event.key === "Enter") {
      const result = flat[activeIndex];
      if (result) {
        event.preventDefault();
        pick(result);
      }
    }
  }

  // Keep the active row in view during keyboard nav (the row is 44px+; the
  // list scrolls inside max-h — scrollIntoView(block:"nearest") is enough).
  React.useEffect(() => {
    listRef.current
      ?.querySelector<HTMLElement>(`[data-idx="${activeIndex}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  return (
    <div className="flex flex-col" role="search">
      {/* Input row — flush header, hairline divider (no dialog title; the
       * placeholder IS the title. Screen-reader label via aria-label). */}
      <div className="flex items-center gap-2 px-3 h-14 border-b">
        <Search size={18} aria-hidden className="text-muted-foreground shrink-0" />
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKeyDown}
          type="search"
          role="combobox"
          aria-expanded={showResults}
          aria-controls="nest-search-results"
          aria-autocomplete="list"
          aria-label={t("search.trigger")}
          placeholder={t("search.placeholder")}
          autoComplete="off"
          spellCheck={false}
          className="flex-1 h-11 bg-transparent outline-none text-body placeholder:text-muted-foreground focus-visible:none [&::-webkit-search-cancel-button]:hidden"
        />
        {isFetching ? (
          <Loader2 size={16} aria-hidden className="animate-spin text-muted-foreground shrink-0" />
        ) : query ? (
          <button
            type="button"
            onClick={() => {
              setQuery("");
              inputRef.current?.focus();
            }}
            aria-label={t("search.clear")}
            className="h-11 w-11 grid place-items-center text-muted-foreground hover:text-foreground rounded-lg focus-visible:ring-2 focus-visible:ring-ring"
          >
            <X size={16} aria-hidden />
          </button>
        ) : null}
      </div>

      {/* Results — grouped, capped, scrollable (design-system §9 long lists). */}
      <div
        ref={listRef}
        id="nest-search-results"
        role="listbox"
        aria-label={t("search.trigger")}
        className="max-h-[60vh] overflow-y-auto nest-scrollbar overscroll-contain"
      >
        {!showResults ? (
          <p className="px-4 py-8 text-center text-body-sm text-muted-foreground">{t("search.hint")}</p>
        ) : flat.length === 0 && !isFetching ? (
          <p className="px-4 py-8 text-center text-body-sm text-muted-foreground">
            {t("search.noResults", { query: trimmed })}
          </p>
        ) : (
          GROUP_ORDER.map((kind) => {
            const rows = flat.filter((r) => r.kind === kind);
            if (rows.length === 0) return null;
            return (
              <section key={kind} aria-label={t(groupKey(kind))}>
                {/* Monty micro-label group header (D-022 uppercase tracked caption). */}
                <h3 className="px-4 pt-3 pb-1 text-caption uppercase tracking-wider text-muted-foreground font-medium">
                  {t(groupKey(kind))}
                </h3>
                {rows.map((result) => {
                  const index = flat.indexOf(result);
                  const active = index === activeIndex;
                  return (
                    <ResultRow
                      key={`${result.kind}-${result.id}`}
                      result={result}
                      index={index}
                      active={active}
                      onHover={setActiveIndex}
                      onPick={pick}
                    />
                  );
                })}
              </section>
            );
          })
        )}
      </div>

      {/* Footnote — the honest sandbox hint + keyboard affordance (desktop). */}
      <p className="px-4 py-2.5 border-t text-caption text-muted-foreground flex items-center justify-between">
        <span>{t("footer.sandbox")}</span>
        <span className="hidden sm:inline">↑↓ · Enter · Esc</span>
      </p>
    </div>
  );
}

function ResultRow({
  result,
  index,
  active,
  onHover,
  onPick,
}: {
  result: SearchResultDto;
  index: number;
  active: boolean;
  onHover: (index: number) => void;
  onPick: (result: SearchResultDto) => void;
}) {
  const { t } = useI18n();
  const Icon = KIND_ICON[result.kind];

  return (
    <button
      type="button"
      role="option"
      aria-selected={active}
      data-idx={index}
      onClick={() => onPick(result)}
      onMouseMove={() => onHover(index)}
      className={cn(
        "w-full min-h-11 px-3 py-2 flex items-center gap-3 text-left transition-colors",
        "focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring outline-none",
        active ? "bg-primary/10" : "hover:bg-muted",
      )}
    >
      <span className={cn("h-9 w-9 shrink-0 grid place-items-center rounded-xl", KIND_TILE[result.kind])}>
        <Icon size={17} aria-hidden />
      </span>
      <span className="flex-1 min-w-0">
        <span className="block text-body font-medium truncate">{result.title}</span>
        {result.subtitle || result.at ? (
          <span className="block text-caption text-muted-foreground truncate">
            {result.subtitle}
            {result.subtitle && result.at ? " · " : ""}
            {result.at ? formatDate(result.at) : ""}
          </span>
        ) : null}
      </span>
      {result.meta ? (
        <span className="shrink-0 text-caption tabular-nums px-2 py-0.5 rounded-full bg-muted text-muted-foreground border">
          {result.meta}
        </span>
      ) : null}
      <span className="sr-only">{t(groupKey(result.kind))}</span>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Deep-link routing — the ONLY place search results map to app surfaces.
// ---------------------------------------------------------------------------

function navigateTo(result: SearchResultDto, role: Role) {
  const store = useUIStore.getState();

  // ORDER MATTERS: setTab clears pushedScreen (ui-store §tab), so every
  // deep-link that pushes a detail screen must switch the tab FIRST, then
  // open the detail. Receipts open a modal (receiptView), order-independent.

  switch (result.kind) {
    case "TENANT":
      // Landlord: arrears tab. Caretaker: the pushed arrears screen (S-18a).
      if (role === "CARETAKER") {
        store.setTab("home");
        store.pushArrears();
      } else {
        store.setTab("arrears");
      }
      break;
    case "RECEIPT":
      store.setTab(result.tab === "receipts" ? "receipts" : "payments");
      store.openReceipt({ receiptNo: result.id });
      break;
    case "TICKET":
      store.setTab("repairs");
      store.openTicket(result.id);
      break;
    case "LISTING":
      store.setTab("listings");
      store.setListingsSegment("listings");
      store.openListing(result.id);
      break;
    case "APPLICANT":
      store.setTab("listings");
      store.setListingsSegment("applicants");
      store.openApplication(result.id);
      break;
    case "VISITOR":
      store.setTab("visitors");
      break;
    case "INCIDENT":
      store.setTab("incidents");
      break;
  }
}
