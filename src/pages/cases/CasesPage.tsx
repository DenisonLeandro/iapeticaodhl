import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { useCases, useLawyers } from "@/hooks/useCases";
import CaseForm from "@/components/cases/CaseForm";
import type { CaseFilters, CaseStatus } from "@/types/case";
import {
  COURT_OPTIONS,
  CASE_STATUS_OPTIONS,
  STATUS_BADGE_COLORS,
  STATUS_LABELS,
} from "@/types/case";

const PAGE_SIZE = 10;

function LoadingSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4">
          <Skeleton className="h-10 w-full" />
        </div>
      ))}
    </div>
  );
}

export default function CasesPage() {
  const navigate = useNavigate();
  const [filters, setFilters] = useState<CaseFilters>({
    search: "",
    status: "",
    court: "",
    assigned_to: "",
    page: 1,
    pageSize: PAGE_SIZE,
  });
  const [searchInput, setSearchInput] = useState("");

  const { cases, totalCount, isLoading, error } = useCases(filters);
  const { lawyers } = useLawyers();

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      setFilters((prev) => ({ ...prev, search: searchInput, page: 1 }));
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const handleFilterChange = useCallback(
    (key: keyof CaseFilters, value: string) => {
      setFilters((prev) => ({
        ...prev,
        [key]: value === "all" ? "" : value,
        page: 1,
      }));
    },
    [],
  );

  const handlePageChange = useCallback((newPage: number) => {
    setFilters((prev) => ({ ...prev, page: newPage }));
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">
            Processos
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Gerencie os processos judiciais do escritório
          </p>
        </div>
        <CaseForm />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[250px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por número do processo..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="pl-9"
          />
        </div>

        <Select
          value={filters.status || "all"}
          onValueChange={(value) => handleFilterChange("status", value)}
        >
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            {CASE_STATUS_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={filters.court || "all"}
          onValueChange={(value) => handleFilterChange("court", value)}
        >
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Tribunal" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os tribunais</SelectItem>
            {COURT_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={filters.assigned_to || "all"}
          onValueChange={(value) => handleFilterChange("assigned_to", value)}
        >
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Advogado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os advogados</SelectItem>
            {lawyers.map((lawyer) => (
              <SelectItem key={lawyer.id} value={lawyer.id}>
                {lawyer.full_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      {isLoading ? (
        <LoadingSkeleton />
      ) : error ? (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          Erro ao carregar processos. Tente novamente.
        </div>
      ) : cases.length === 0 ? (
        <div className="rounded-lg border border-border bg-muted/50 p-8 text-center text-muted-foreground">
          Nenhum processo encontrado
        </div>
      ) : (
        <>
          <div className="rounded-lg border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Número do Processo</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Tribunal</TableHead>
                  <TableHead>Vara</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Advogado Responsável</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cases.map((caseItem) => (
                  <TableRow
                    key={caseItem.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => navigate(`/cases/${caseItem.id}`)}
                  >
                    <TableCell className="font-medium">
                      {caseItem.case_number}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {caseItem.client_name ?? "—"}
                    </TableCell>
                    <TableCell>{caseItem.court}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {caseItem.branch ?? "—"}
                    </TableCell>
                    <TableCell>
                      <Badge
                        className={
                          STATUS_BADGE_COLORS[caseItem.status as CaseStatus]
                        }
                      >
                        {STATUS_LABELS[caseItem.status as CaseStatus]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {caseItem.lawyer_name ?? "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                {totalCount} processo{totalCount !== 1 ? "s" : ""} encontrado
                {totalCount !== 1 ? "s" : ""}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={filters.page === 1}
                  onClick={() => handlePageChange((filters.page ?? 1) - 1)}
                >
                  Anterior
                </Button>
                <span className="text-sm text-muted-foreground">
                  Página {filters.page} de {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={filters.page === totalPages}
                  onClick={() => handlePageChange((filters.page ?? 1) + 1)}
                >
                  Próxima
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
