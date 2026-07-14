// =============================================================================
// PR-Q1A — Style guide curto do escritório (≤ 1200 chars)
// Aplicado ao prompt SOMENTE quando houver template compatível.
// =============================================================================

/**
 * Constrói o style guide adaptado ao template selecionado.
 * Se o template usa numeração arábica ("1.-, 2.-, 2.1.-"), aplicamos regras
 * fortes. Caso contrário, orientamos apenas a seguir o padrão do próprio
 * template — não impomos padrão trabalhista a qualquer peça.
 */
export function buildOfficeStyleGuide(opts: {
  uses_arabic_numbering: boolean;
  has_dados_funcionais: boolean;
  is_trabalhista_inicial: boolean;
}): string {
  const strong = opts.uses_arabic_numbering;
  const lines: string[] = [];

  lines.push("STYLE GUIDE DO ESCRITÓRIO (obrigatório quando compatível com o template selecionado):");
  lines.push("- Seguir o padrão de estrutura, numeração e linguagem do MODELO DO ESCRITÓRIO selecionado — não substituir por padrão genérico de IA.");

  if (strong) {
    lines.push("- Usar numeração arábica no estilo do modelo (ex.: \"1.-\", \"2.-\", \"2.1.-\"). Evitar algarismos romanos I, II, III quando o modelo usa arábico.");
    if (opts.is_trabalhista_inicial && opts.has_dados_funcionais) {
      lines.push("- Em inicial trabalhista, criar bloco inicial \"1.- DADOS FUNCIONAIS\" quando o modelo o contiver.");
      lines.push("- Usar blocos \"2.- PRELIMINARMENTE\", \"2.1.- DA JUSTIÇA GRATUITA\", \"2.2.- DA INVERSÃO DO ÔNUS DA PROVA\" quando o modelo os contiver.");
    }
    lines.push("- Pedido final em itens numerados (não usar bullets). Cada tópico de mérito deve terminar com pedido específico; o rol final deve reiterar todos os pedidos tratados no corpo.");
  } else {
    lines.push("- Espelhar a numeração usada pelo próprio modelo (romana, arábica ou por letras). Não converter para outro esquema.");
    lines.push("- Manter o mesmo padrão de estrutura de pedidos do modelo (itens numerados ou parágrafos, conforme o caso).");
  }

  lines.push("- Usar linguagem típica do escritório quando aplicável: \"requer seja\", \"requer sejam\", \"na forma do item\", \"sob pena de execução direta\".");
  lines.push("- PROIBIDO deixar placeholders crus no corpo final: [NOME], [CPF], [ENDEREÇO], [INSERIR VALOR], NOME DO ADVOGADO, OAB/[UF]. Se faltar dado essencial, NÃO INVENTAR — listar em seção final \"PONTOS A CONFIRMAR ANTES DO PROTOCOLO\" e/ou em missing_information.");

  const guide = lines.join("\n");
  return guide.length > 1200 ? guide.slice(0, 1200) : guide;
}
