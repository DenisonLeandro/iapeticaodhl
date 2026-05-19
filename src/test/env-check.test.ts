import { describe, it, expect, vi, beforeEach } from "vitest";

describe("Backend client wrapper", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
  });

  it("returns missing_url when no URL or project ID", async () => {
    vi.stubEnv("VITE_SUPABASE_URL", "");
    vi.stubEnv("VITE_SUPABASE_PROJECT_ID", "");
    vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", "test-key");

    const { getBackendConfigStatus } = await import("../lib/backend/client");
    expect(getBackendConfigStatus()).toBe("missing_url");
  });

  it("returns missing_key when URL present but no key", async () => {
    vi.stubEnv("VITE_SUPABASE_URL", "https://test.supabase.co");
    vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", "");
    vi.stubEnv("VITE_SUPABASE_ANON_KEY", "");

    const { getBackendConfigStatus } = await import("../lib/backend/client");
    expect(getBackendConfigStatus()).toBe("missing_key");
  });

  it("returns ok when URL and key are set", async () => {
    vi.stubEnv("VITE_SUPABASE_URL", "https://test.supabase.co");
    vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", "test-key");

    const { getBackendConfigStatus } = await import("../lib/backend/client");
    expect(getBackendConfigStatus()).toBe("ok");
  });

  it("falls back to project ID for URL", async () => {
    vi.stubEnv("VITE_SUPABASE_URL", "");
    vi.stubEnv("VITE_SUPABASE_PROJECT_ID", "myproject");
    vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", "test-key");

    const { getBackendConfigStatus } = await import("../lib/backend/client");
    expect(getBackendConfigStatus()).toBe("ok");
  });

  it("falls back to ANON_KEY for key", async () => {
    vi.stubEnv("VITE_SUPABASE_URL", "https://test.supabase.co");
    vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", "");
    vi.stubEnv("VITE_SUPABASE_ANON_KEY", "anon-key");

    const { getBackendConfigStatus } = await import("../lib/backend/client");
    expect(getBackendConfigStatus()).toBe("ok");
  });

  it("importing the module does not throw even without env vars", async () => {
    vi.stubEnv("VITE_SUPABASE_URL", "");
    vi.stubEnv("VITE_SUPABASE_PROJECT_ID", "");
    vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", "");

    // This should NOT throw — lazy init
    const mod = await import("../lib/backend/client");
    expect(mod.getBackendConfigStatus).toBeDefined();
    expect(mod.supabase).toBeDefined();
  });

  it("checkEnvVars delegates to config status", async () => {
    vi.stubEnv("VITE_SUPABASE_URL", "https://test.supabase.co");
    vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", "test-key");

    const { checkEnvVars } = await import("../components/ErrorBoundary");
    expect(checkEnvVars()).toBe(true);
  });
});
