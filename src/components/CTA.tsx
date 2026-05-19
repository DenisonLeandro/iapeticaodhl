import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

const CTA = () => {
  return (
    <section className="relative py-32 px-6">
      <div className="max-w-4xl mx-auto text-center">
        <div className="relative p-16 rounded-3xl bg-glass shadow-glow overflow-hidden">
          {/* Glow effects */}
          <div className="absolute -top-20 -right-20 w-60 h-60 rounded-full bg-primary/15 blur-[80px]" />
          <div className="absolute -bottom-20 -left-20 w-60 h-60 rounded-full bg-accent/10 blur-[80px]" />

          <div className="relative z-10">
            <h2 className="font-display text-4xl md:text-5xl font-bold mb-4">
              Pronto para o{" "}
              <span className="text-gradient">futuro?</span>
            </h2>
            <p className="text-muted-foreground text-lg max-w-xl mx-auto mb-8">
              Junte-se a milhares de advogados que já estão usando IA para transformar sua prática jurídica.
            </p>
            <Button size="lg" className="px-10 py-6 text-base font-semibold shadow-glow">
              Começar agora
              <ArrowRight className="ml-2 w-5 h-5" />
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
};

export default CTA;
