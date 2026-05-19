import { Scale } from "lucide-react";
import { Button } from "@/components/ui/button";

const Navbar = () => {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 px-6 py-4">
      <div className="max-w-6xl mx-auto flex items-center justify-between bg-glass rounded-2xl px-6 py-3">
        <div className="flex items-center gap-2">
          <Scale className="w-6 h-6 text-primary" />
          <span className="font-display text-xl font-bold text-foreground">Peticionamento</span>
          <span className="text-xs font-semibold text-accent ml-1">com IA</span>
        </div>

        <div className="hidden md:flex items-center gap-8">
          {["Funcionalidades", "Como funciona", "Preços"].map((item) => (
            <a key={item} href="#" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              {item}
            </a>
          ))}
        </div>

        <Button size="sm" className="font-semibold">
          Acessar
        </Button>
      </div>
    </nav>
  );
};

export default Navbar;
