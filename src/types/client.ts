export interface ClientAddress {
  street: string;
  number: string;
  complement?: string;
  neighborhood: string;
  city: string;
  state: string; // UF (2 chars)
  zip_code: string; // CEP
}

export interface Client {
  id: string;
  organization_id: string;
  full_name: string;
  document_type: "cpf" | "cnpj" | null;
  document_number: string | null;
  email: string | null;
  phone: string | null;
  address: ClientAddress | null;
  notes: string | null;
  deleted_at: string | null;
  created_at: string;
  created_by: string | null;
  updated_at: string;
}

export interface ClientFormData {
  full_name: string;
  document_type: "cpf" | "cnpj";
  document_number: string;
  email: string;
  phone: string;
  address: ClientAddress;
  notes: string;
}

export interface ClientListParams {
  search?: string;
  page: number;
  pageSize: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

export interface ClientListResult {
  data: Client[];
  count: number;
}

export interface ClientInteraction {
  id: string;
  organization_id: string;
  client_id: string;
  interaction_date: string;
  subject: string;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ClientFile {
  id: string;
  organization_id: string;
  client_id: string;
  file_name: string;
  file_type: string | null;
  file_size: number | null;
  storage_path: string;
  description: string | null;
  uploaded_by: string | null;
  created_at: string;
}
