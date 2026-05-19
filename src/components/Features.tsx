import { FileSearch, BookOpen, FileText, Shield, Zap, MessageSquare } from "lucide-react";

const features = [
  {
    icon: FileSearch,
    title: "Análise de Documentos",
    description: "Upload de contratos, petições e pareceres. Nossa IA extrai informações-chave, identifica cláusulas críticas e sugere melhorias.",
  },
  {
    icon: BookOpen,
    title: "Pesquisa Jurisprudencial",
    description: "Busque decisões relevantes em segundos. A IA cruza milhares de julgados e entrega os mais pertinentes ao seu caso.",
  },
  {
    icon: FileText,
    title: "Geração de Peças",
    description: "Crie petições, contratos e pareceres com base em modelos inteligentes que se adaptam ao contexto do caso.",
  },
  {
    icon: MessageSquare,
    title: "Assistente Jurídico",
    description: "Converse com a IA sobre qualquer tema jurídico. Tire dúvidas, peça resumos e obtenha orientações fundamentadas.",
  },
  {
    icon: Shield,
    title: "Segurança Total",
    description: "Seus dados são criptografados e processados com os mais altos padrões de segurança e conformidade com a LGPD.",
  },
  {
    icon: Zap,
    title: "Automação de Prazos",
    description: "Monitore prazos processuais automaticamente. Receba alertas e nunca mais perca um deadline importante.",
  },
];

const Features = () => {
  return (
    <section className="relative py-32 px-6">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="font-display text-4xl md:text-5xl font-bold mb-4">
            Tudo que você precisa,{" "}
            <span className="text-gradient">em um só lugar</span>
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Ferramentas poderosas de IA projetadas especificamente para o profissional do Direito.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="group relative p-8 rounded-2xl bg-glass transition-all duration-300 hover:shadow-glow hover:-translate-y-1"
            >
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-5 group-hover:bg-primary/20 transition-colors">
                <feature.icon className="w-6 h-6 text-primary" />
              </div>
              <h3 className="font-display text-xl font-semibold text-foreground mb-3">
                {feature.title}
              </h3>
              <p className="text-muted-foreground leading-relaxed text-sm">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Features;
