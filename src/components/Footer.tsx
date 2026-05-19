import { Scale } from "lucide-react";

const Footer = () => {
  return (
    <footer className="border-t border-border py-12 px-6">
      <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-2">
          <Scale className="w-5 h-5 text-primary" />
          <span className="font-display text-lg font-bold text-foreground">Peticionamento</span>
          <span className="text-xs font-semibold text-accent ml-1">com IA</span>
        </div>
        <p className="text-sm text-muted-foreground">
          © 2026 Peticionamento com IA. Todos os direitos reservados.
        </p>
      </div>
    </footer>
  );
};

export default Footer;
