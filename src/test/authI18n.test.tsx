import { describe, expect, it, afterEach, beforeEach, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { TooltipProvider } from "@/components/ui/tooltip";
import { dict, useI18nStore } from "@/lib/i18n";

/**
 * The administrator sign-in page shipped with every string hardcoded in English.
 * The language toggle sat in its own corner switching a store nothing on the
 * page read, so pressing తెలుగు visibly did nothing — the single most reported
 * "Telugu is broken" symptom, and not a font or translation problem at all.
 *
 * These tests exist because that class of bug is invisible to the type checker
 * and to every other test in the suite: hardcoded copy compiles perfectly.
 */

// The page redirects on an existing session, so auth is stubbed to "signed out".
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      getSession: () => Promise.resolve({ data: { session: null } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
      signInWithPassword: () => Promise.resolve({ error: null }),
    },
  },
}));

import Auth from "@/pages/Auth";

function renderAuth() {
  return render(
    <TooltipProvider>
      <MemoryRouter>
        <Auth />
      </MemoryRouter>
    </TooltipProvider>,
  );
}

/**
 * Reads the whole rendered document rather than querying for an element whose
 * entire text is the string. Several of these strings — the "Private · Secure ·
 * Trusted" line especially — are bare text nodes sitting between separator
 * spans, so no single element's textContent equals them and getByText cannot
 * see them at all. What the test actually cares about is "does this word appear
 * on the page in this language", which is exactly a document-text question.
 */
function pageText(): string {
  return document.body.textContent ?? "";
}

beforeEach(() => useI18nStore.getState().setMode("en"));
afterEach(() => {
  cleanup();
  useI18nStore.getState().setMode("en");
});

describe("administrator sign-in is bilingual", () => {
  it("renders English chrome in English mode", () => {
    renderAuth();
    const text = pageText();
    expect(text).toContain(dict.authWelcomeBack.en);
    expect(text).toContain(dict.authEmailLabel.en);
    expect(text).toContain(dict.authFooterNote.en);
    expect(text).toContain(dict.authTrustPrivate.en);
  });

  it("switches the ENTIRE page to Telugu, not a mix", () => {
    useI18nStore.getState().setMode("te");
    renderAuth();
    const text = pageText();

    // The card
    expect(text).toContain(dict.authWelcomeBack.te);
    expect(text).toContain(dict.authEmailLabel.te);
    expect(text).toContain(dict.authPasswordLabel.te);
    expect(text).toContain(dict.authFooterNote.te);

    // The editorial panel — the half that was easiest to forget
    expect(text).toContain(dict.authPrivateWorkspace.te);
    expect(text).toContain(dict.authHeadlineLine1.te);
    expect(text).toContain(dict.authLede.te);
    expect(text).toContain(dict.authTrustPrivate.te);

    // And nothing English left behind. A page that switches the card but keeps
    // the headline in English is the exact failure this guards.
    expect(text).not.toContain(dict.authWelcomeBack.en);
    expect(text).not.toContain(dict.authEmailLabel.en);
    expect(text).not.toContain(dict.authLede.en);
    expect(text).not.toContain(dict.authHeadlineLine1.en);
  });

  it("has a distinct Telugu translation for every auth string", () => {
    // A key whose Telugu is a copy of its English is an untranslated string that
    // still passes a "renders in te mode" assertion. Placeholders are exempt:
    // an email example reads the same in both.
    const exempt = new Set(["authEmailPlaceholder"]);
    const untranslated = Object.entries(dict)
      .filter(([key]) => key.startsWith("auth") && !exempt.has(key))
      .filter(([, v]) => v.en.trim() === v.te.trim())
      .map(([key]) => key);

    expect(untranslated).toEqual([]);
  });
});
