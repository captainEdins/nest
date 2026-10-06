"use client"

/**
 * NEST — i18n runtime (single-route, dictionary-based).
 *
 * API for the Frontend Engineer (full guide: docs/design/personas-journeys.md §7):
 *
 *   import { I18nProvider, useI18n, LANGS, type Lang } from "@/lib/i18n"
 *
 *   // Wrap the app ONCE (the session gate may pass the profile's language):
 *   <I18nProvider initialLang={session.profile.language}>
 *     <App />
 *   </I18nProvider>
 *
 *   // Anywhere below it:
 *   const { lang, setLang, t } = useI18n()
 *   t("app.name")                                   // -> "NEST"
 *   t("common.greeting", { name: "John" })          // -> "Hi, John" / "Habari, John"
 *   t("offline.itemsSynced", { count: 3 })          // -> "3 items synced" / "Vitu 3 vimetumwa"
 *   t("misc.phaseNotice", { phase: "Phase 2" })     // -> "This module arrives in Phase 2"
 *
 *   // Language switcher (labels are native, never translated):
 *   LANGS // -> [{ value: "en", label: "English" }, { value: "sw", label: "Kiswahili" }]
 *
 * Behavior:
 * - The language is an external store (localStorage key "nest-lang"), read via
 *   useSyncExternalStore: hydration-safe with no setState-in-effect (the
 *   server renders `initialLang ?? "en"`, then the stored preference wins
 *   after mount — one silent re-render, never a hydration mismatch).
 * - The device's stored choice outranks `initialLang` so the login-screen
 *   toggle keeps working after sign-in; `initialLang` is only the fallback.
 * - setLang writes through to localStorage, keeps an in-memory mirror for
 *   private-mode browsers where storage throws, and notifies every subscriber
 *   (same-tab via a custom event; other tabs via the native "storage" event).
 * - <html lang> is kept in sync with the active language.
 * - `t()` replaces every `{name}` occurrence with String(value). Numbers and
 *   money must be pre-formatted (src/lib/money.ts formatKes) before passing.
 * - Full-routing i18n is impossible (single `/` route, D-011 in DECISIONS.md),
 *   so this is a client dictionary layer, not next-intl routing.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react"
import { en, type TranslationKey } from "./en"
import { sw } from "./sw"

/** The two languages NEST ships in Phase 1. */
export type Lang = "en" | "sw"

/** Languages offered in the switcher. `value` feeds setLang; labels are native. */
export const LANGS: { value: Lang; label: string }[] = [
  { value: "en", label: "English" },
  { value: "sw", label: "Kiswahili" },
]

const DICTS: Record<Lang, Record<TranslationKey, string>> = { en, sw }

/** localStorage key for the persisted language preference. */
const STORAGE_KEY = "nest-lang"

/** Dispatched by setLang so same-tab subscribers re-read the store. */
const LANG_CHANGE_EVENT = "nest-lang-change"

/**
 * In-memory mirror of the current choice. Set on every setLang so the app
 * works even when localStorage throws (private mode / quota): without this,
 * a failed write would make the switcher appear dead on some browsers.
 */
let memoryLang: Lang | null = null

function isLang(value: unknown): value is Lang {
  return value === "en" || value === "sw"
}

/** Read the stored preference without throwing (private mode, SSR, old browsers). */
function readStoredLang(): Lang | null {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    return isLang(stored) ? stored : null
  } catch {
    return null
  }
}

function persistLang(lang: Lang): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, lang)
  } catch {
    // Storage unavailable — memoryLang still holds the choice for this session.
  }
}

/** Client snapshot: memory choice > stored choice > server default > "en". */
function makeGetSnapshot(fallback: Lang | undefined): () => Lang {
  return () => memoryLang ?? readStoredLang() ?? fallback ?? "en"
}

/** Subscribe to language changes: same-tab custom event + cross-tab "storage". */
function subscribe(onStoreChange: () => void): () => void {
  window.addEventListener(LANG_CHANGE_EVENT, onStoreChange)
  window.addEventListener("storage", onStoreChange)
  return () => {
    window.removeEventListener(LANG_CHANGE_EVENT, onStoreChange)
    window.removeEventListener("storage", onStoreChange)
  }
}

export interface I18nContextValue {
  /** Currently active language. */
  lang: Lang
  /** Switch language; persists to localStorage and syncs <html lang>. */
  setLang: (lang: Lang) => void
  /**
   * Translate a key. `{name}` placeholders are replaced with the given vars
   * (numbers are stringified; format money/dates before passing them).
   */
  t: (key: TranslationKey, vars?: Record<string, string | number>) => string
}

const LanguageContext = createContext<I18nContextValue | null>(null)

export function I18nProvider({
  children,
  initialLang,
}: {
  children: ReactNode
  /** Optional server-provided language (e.g. ProfileDto.language). */
  initialLang?: Lang
}) {
  // External store: localStorage + memory mirror. During SSR/hydration React
  // uses getServerSnapshot (initialLang ?? "en"), then swaps in the client
  // snapshot after mount — no setState-in-effect, no hydration mismatch.
  const lang = useSyncExternalStore(
    subscribe,
    makeGetSnapshot(initialLang),
    () => initialLang ?? "en",
  )

  // Keep <html lang> in sync (external system — the one effect we need).
  useEffect(() => {
    document.documentElement.lang = lang
  }, [lang])

  const setLang = useCallback((next: Lang) => {
    memoryLang = next
    persistLang(next)
    window.dispatchEvent(new Event(LANG_CHANGE_EVENT))
  }, [])

  const t = useCallback(
    (key: TranslationKey, vars?: Record<string, string | number>): string => {
      const dict = DICTS[lang] ?? en
      let text = dict[key] ?? en[key]
      if (vars) {
        for (const [name, value] of Object.entries(vars)) {
          text = text.split(`{${name}}`).join(String(value))
        }
      }
      return text
    },
    [lang],
  )

  const value = useMemo<I18nContextValue>(
    () => ({ lang, setLang, t }),
    [lang, setLang, t],
  )

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
}

/** Access the active language and `t()`. Must be used inside <I18nProvider>. */
export function useI18n(): I18nContextValue {
  const ctx = useContext(LanguageContext)
  if (!ctx) {
    throw new Error("useI18n must be used within an <I18nProvider>")
  }
  return ctx
}

export { en, sw, type TranslationKey }
