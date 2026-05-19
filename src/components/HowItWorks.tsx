const steps = [
  {
    number: "01",
    title: "Envie seu documento",
    description: "Faça upload de contratos, petições ou qualquer documento jurídico em PDF ou Word.",
  },
  {
    number: "02",
    title: "A IA processa",
    description: "Nossa inteligência artificial analisa, extrai dados e cruza com milhares de referências jurídicas.",
  },
  {
    number: "03",
    title: "Receba insights",
    description: "Em segundos, tenha análises detalhadas, sugestões e documentos prontos para uso.",
  },
];

const HowItWorks = () => {
  return (
    <section className="relative py-32 px-6">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-20">
          <h2 className="font-display text-4xl md:text-5xl font-bold mb-4">
            Simples de <span className="text-gradient">usar</span>
          </h2>
          <p className="text-muted-foreground text-lg">
            Três passos para transformar sua prática jurídica.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-12">
          {steps.map((step, index) => (
            <div key={step.number} className="relative text-center">
              {/* Connector line */}
              {index < steps.length - 1 && (
                <div className="hidden md:block absolute top-8 left-[60%] w-[80%] h-px bg-gradient-to-r from-primary/40 to-transparent" />
              )}
              <div className="text-6xl font-display font-bold text-gradient opacity-60 mb-4">
                {step.number}
              </div>
              <h3 className="font-display text-xl font-semibold text-foreground mb-3">
                {step.title}
              </h3>
              <p className="text-muted-foreground text-sm leading-relaxed">
                {step.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default HowItWorks;
