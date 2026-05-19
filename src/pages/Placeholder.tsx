import { Construction } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface PlaceholderProps {
  title: string;
}

const Placeholder = ({ title }: PlaceholderProps) => {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Card className="w-full max-w-md bg-glass border-border">
        <CardHeader className="text-center">
          <Construction className="mx-auto h-12 w-12 text-muted-foreground mb-2" />
          <CardTitle className="font-display text-xl">{title}</CardTitle>
        </CardHeader>
        <CardContent className="text-center">
          <p className="text-muted-foreground">
            Este módulo está em construção e estará disponível em breve.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default Placeholder;
