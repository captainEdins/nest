"use client"

/**
 * NEST — i18n runtime (single-route, dictionary-based).
 *
 * API for the Frontend Engineer:
 *
 *   import { I18nProvider, useI18n, LANGS } from "@/lib/i18n"
 *
 *   // Wrap the app ONCE (server may pass the profile's language):
 *   <I18nProvider initialLang={session.profile.language}>
 *     <App />
 *   </I18nProvider>
 *
 *   // Anywhere below it:
 *   const { lang, setLang, t } = useI18n()
 *   t("app.name")                          // -> "NEST"
 *   t("common.greeting", { name: "John" }) // -> "Hi, John" / "Habari, John"
 *   t("tenant.balance")                    // -> "Salio" when lang === "sw"
 *
 * Notes:
 * - Persistence: localStorage key "nest-lang"; <html lang> kept in sync.
 * - Hydration-safe: the first render always uses `initialLang ?? "en"`;
 *   a stored preference is applied in an effect (no SSR mismatch).
 * - Interpolation replaces every `{name}` occurrence with String(value).
 *   Numbers/money must be pre-formatted (src/lib/money.ts) before passing.
 * - Full-routing i18n is impossible (single `/` route, D-011 in DECISIONS.md)
 *   so this is a client dictionary layer, not next-intl routing.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"
import { en, type TranslationKey } from "./en"
import { sw } from "./sw"

export type Lang = "en" | "sw"

/** Languages offered in the switcher. Labels are native, language-independent. */
export const LANGS: { code: Lang; label: string }[] = [
  { code: "en", label: "English" },
  { code: "sw", label: "Kiswahili" },
]

const DICTS: Record<Lang, Record<TranslationKey, string>> = { en, sw }

const STORAGE_KEY = "nest-lang"

function isLang(value: unknown): value is Lang {
  return value === "en" || value === "sw"
}

/** Read the stored preference without throwing (private mode, SSR, tests). */
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
    // Storage unavailable (private mode / quota) — preference is session-only.
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

const I18nContext = createContext<I18nContextValue | null>(null)

export function I18nProvider({
  children,
  initialLang,
}: {
  children: ReactNode
  /** Optional server-provided language (e.g. ProfileDto.language). */
  initialLang?: Lang
}) {
  const [lang, setLangState] = useState<Lang>(initialLang ?? "en")

  // Apply a stored preference once on mount, unless the server pinned one.
  useEffect(() => {
    if (initialLang) return
    const stored = readStoredLang()
    if (stored && stored !== lang) setLangState(stored)
    // Intentionally mount-only: read localStorage exactly once.
  }, [])

  // Persist + keep <html lang> in sync with the active language.
  useEffect(() => {
    persistLang(lang)
    document.documentElement.lang = lang
  }, [lang])

  const setLang = useCallback((next: Lang) => {
    setLangState(next)
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

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

/** Access the active language and `t()`. Must be used inside <I18nProvider>. */
export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext)
  if (!ctx) {
    throw new Error("useI18n must be used within an <I18nProvider>")
  }
  return ctx
}

export { en, sw, type TranslationKey }
