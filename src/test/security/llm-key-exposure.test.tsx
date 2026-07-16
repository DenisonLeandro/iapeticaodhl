// =============================================================================
// PR-SEC-1 — Testes de regressão: exposição da credencial de IA
// =============================================================================
// A credencial vive hoje em organizations.llm_config.api_key, e a policy
// `organizations_select` permite que QUALQUER membro autenticado leia a linha.
// Enquanto o P0 não é fechado (PR-SEC-2A), estes testes congelam o problema no
// tamanho atual: nenhum arquivo novo pode passar a ler a credencial, e nenhuma
// operação não relacionada pode reenviá-la.
// =============================================================================

import { describe, it, expect, vi, beforeEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { render, renderHook, act } from "@testing-library/react";
import { screen } from "@testing-library/dom";
import { MemoryRouter } from "react-router-dom";

// ---------------------------------------------------------------------------
// 1. Guarda estática — quem pode mencionar a credencial
// ---------------------------------------------------------------------------

const SRC_DIR = path.resolve(process.cwd(), "src");

/**
 * Únicos arquivos autorizados a referenciar o campo `api_key`.
 * NÃO adicione entradas aqui. A direção correta é esvaziar esta lista:
 *   - direct-client.ts      → removido quando o caminho direto sair (PR-SEC-2A)
 *   - AISettingsPage.tsx    → campo de chave sai da UI (PR-SEC-2A)
 *   - aiSettings.ts         → tipo LLMConfig perde `api_key` (PR-SEC-2A)
 */
const API_KEY_ALLOWLIST = [
  "src/services/aiSettings.ts",
  "src/lib/ai/direct-client.ts",
  "src/pages/settings/AISettingsPage.tsx",
];

function collectSourceFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (entry.name === "test") continue; // os próprios testes citam api_key
      collectSourceFiles(path.join(dir, entry.name), acc);
    } else if (/\.tsx?$/.test(entry.name)) {
      acc.push(path.join(dir, entry.name));
    }
  }
  return acc;
}

const toRepoPath = (abs: string) =>
  path.relative(process.cwd(), abs).split(path.sep).join("/");

describe("guarda estática — leituras da credencial no frontend", () => {
  it("nenhum arquivo fora da allowlist referencia api_key", () => {
    const offenders = collectSourceFiles(SRC_DIR)
      .filter((file) => fs.readFileSync(file, "utf8").includes("api_key"))
      .map(toRepoPath)
      .filter((rel) => !API_KEY_ALLOWLIST.includes(rel))
      .sort();

    expect(
      offenders,
      `Arquivo(s) passaram a referenciar api_key. A credencial não deve ganhar ` +
        `novos leitores no frontend enquanto o P0 estiver aberto.`,
    ).toEqual([]);
  });

  it("useEconomyMode não referencia a credencial", () => {
    const src = fs.readFileSync(
      path.join(SRC_DIR, "hooks", "useEconomyMode.ts"),
      "utf8",
    );
    expect(src).not.toContain("api_key");
  });

  it("patchLLMConfig usa a RPC de merge, não update direto na tabela", () => {
    const src = fs.readFileSync(
      path.join(SRC_DIR, "services", "aiSettings.ts"),
      "utf8",
    );
    expect(src).toContain("update_llm_config_partial");
    // A substituição integral do jsonb era a causa estrutural dos round-trips.
    expect(src).not.toMatch(/\.update\(\s*\{\s*llm_config/);
  });
});

// ---------------------------------------------------------------------------
// 2. Comportamento — o patch do modo econômico não carrega a credencial
// ---------------------------------------------------------------------------

const mockPatchConfig = vi.fn();

vi.mock("@/hooks/useAISettings", () => ({
  useAISettings: () => ({
    // A credencial está deliberadamente presente no cache: o teste prova que,
    // mesmo assim, ela não entra no payload.
    config: {
      provider: "openai",
      model: "gpt-4o-mini",
      api_key: "sk-DEVE-FICAR-NO-SERVIDOR",
      economy_mode: true,
      max_docs_per_month: 100,
    },
    isLoadingConfig: false,
    patchConfig: mockPatchConfig,
    isSaving: false,
  }),
}));

import { useEconomyMode } from "@/hooks/useEconomyMode";

describe("useEconomyMode — sem round-trip da credencial", () => {
  beforeEach(() => mockPatchConfig.mockReset());

  it("envia apenas economy_mode", async () => {
    const { result } = renderHook(() => useEconomyMode());

    await act(async () => {
      await result.current.setEconomyMode(false);
    });

    expect(mockPatchConfig).toHaveBeenCalledTimes(1);
    const payload = mockPatchConfig.mock.calls[0][0];

    expect(payload).toEqual({ economy_mode: false });
    expect(payload).not.toHaveProperty("api_key");
    expect(JSON.stringify(payload)).not.toContain("sk-");
  });
});

// ---------------------------------------------------------------------------
// 3. Gate de UI — aba de Integrações IA restrita a admin
// ---------------------------------------------------------------------------

let mockRole = "intern";

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    user: { id: "user-1" },
    profile: { id: "user-1", role: mockRole },
    organization: { id: "org-1" },
  }),
}));

// As páginas filhas têm dependências próprias; aqui só interessa QUAL renderiza.
vi.mock("@/pages/settings/AISettingsPage", () => ({
  default: () => <div>CONTEUDO_INTEGRACOES_IA</div>,
}));
vi.mock("@/pages/settings/ProfilePage", () => ({
  default: () => <div>CONTEUDO_PERFIL</div>,
}));
vi.mock("@/pages/settings/UsersPage", () => ({
  default: () => <div>CONTEUDO_USUARIOS</div>,
}));
vi.mock("@/pages/settings/AICostsPage", () => ({
  default: () => <div>CONTEUDO_CUSTOS</div>,
}));
vi.mock("@/pages/settings/PlaybooksListPage", () => ({
  default: () => <div>CONTEUDO_PLAYBOOKS</div>,
}));

import SettingsPage from "@/pages/settings/SettingsPage";

const renderSettings = (initialUrl: string) =>
  render(
    <MemoryRouter initialEntries={[initialUrl]}>
      <SettingsPage />
    </MemoryRouter>,
  );

describe("SettingsPage — gate da aba Integrações IA", () => {
  it("não-admin não vê a aba", () => {
    mockRole = "intern";
    renderSettings("/settings");
    expect(screen.queryByText("Integrações IA")).not.toBeInTheDocument();
    expect(screen.queryByText("CONTEUDO_INTEGRACOES_IA")).not.toBeInTheDocument();
  });

  it("não-admin com ?tab=ai cai em Meu Perfil, sem área em branco", () => {
    // App.tsx redireciona /settings/ai e /settings/integrations para ?tab=ai.
    mockRole = "lawyer";
    renderSettings("/settings?tab=ai");
    expect(screen.queryByText("CONTEUDO_INTEGRACOES_IA")).not.toBeInTheDocument();
    expect(screen.getByText("CONTEUDO_PERFIL")).toBeInTheDocument();
  });

  it("admin vê a aba e o conteúdo com ?tab=ai", () => {
    mockRole = "admin";
    renderSettings("/settings?tab=ai");
    expect(screen.getByText("Integrações IA")).toBeInTheDocument();
    expect(screen.getByText("CONTEUDO_INTEGRACOES_IA")).toBeInTheDocument();
  });
});
