import type { DocumentGenerationFormData } from "@/lib/validators/document-generation";

export const DEMO_FORM_DATA: DocumentGenerationFormData = {
  documentType: "petition",
  autor: {
    nome: "Maria Clara dos Santos",
    cpfCnpj: "123.456.789-00",
    endereco: "Rua das Flores, 245, Apt 302, Boa Viagem, Recife-PE, CEP 51020-030",
    profissao: "Professora",
    estadoCivil: "Casado(a)",
  },
  reu: {
    nome: "Construtora Horizonte Ltda.",
    cpfCnpj: "12.345.678/0001-90",
    endereco: "Av. Conselheiro Aguiar, 1500, Sala 701, Boa Viagem, Recife-PE",
  },
  tribunal: "TJPE",
  vara: "2ª Vara Cível da Comarca do Recife",
  fatos:
    "A autora adquiriu imóvel residencial (Apt 1204, Ed. Solar das Palmeiras) da ré em 15/03/2024 pelo valor de R$ 350.000,00. Após a entrega das chaves em 01/08/2024, foram constatados graves defeitos estruturais: infiltrações no teto da suíte, rachaduras na parede da sala e problemas hidráulicos no banheiro social. A autora notificou extrajudicialmente a ré em 10/09/2024, concedendo prazo de 30 dias para reparos, sem qualquer resposta ou providência.",
  fundamentacao:
    "Código de Defesa do Consumidor, arts. 18 e 35 (responsabilidade por vícios do produto). Código Civil, arts. 441 a 446 (vícios redibitórios). Súmula 543 do STJ (rescisão contratual por culpa do fornecedor).",
  pedidos:
    "1) Rescisão do contrato de compra e venda com devolução integral dos valores pagos (R$ 350.000,00), corrigidos monetariamente;\n2) Condenação ao pagamento de danos morais no valor de R$ 15.000,00;\n3) Condenação ao pagamento de custas processuais e honorários advocatícios.",
  valorCausa: "R$ 365.000,00",
  provas: "Documental (contrato, notificação extrajudicial, fotos dos defeitos), pericial (engenharia civil), testemunhal (vizinhos e síndico do condomínio).",
  justicaGratuita: true,
  instrucoesAdicionais:
    "Enfatizar jurisprudência recente do TJPE sobre vícios construtivos e responsabilidade objetiva das construtoras. Utilizar linguagem formal e técnica.",
};
