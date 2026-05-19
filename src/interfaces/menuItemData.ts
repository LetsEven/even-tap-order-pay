// Custom field para campos personalizados del menú
export interface CustomFieldOption {
  id: string;
  name: string;
  price: number;
}

export interface CustomField {
  id: string;
  name: string;
  type: string;
  options?: CustomFieldOption[];
  required?: boolean;
  maxSelections?: number;
}

// Interface que coincide con la estructura de la base de datos
export interface MenuItem {
  id: number;
  section_id: number;
  name: string;
  description: string | null;
  image_url: string | null;
  price: number;
  discount: number;
  custom_fields: CustomField[];
  is_available: boolean;
  is_out_of_stock?: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
}

// Interface legacy para compatibilidad con código existente
export interface MenuItemData {
  id: number;
  name: string;
  description: string;
  price: number;
  images: string[];
  features: string[];
  discount: number;
  customFields?: Array<{
    fieldId: string;
    fieldName: string;
    selectedOptions: Array<{
      optionId: string;
      optionName: string;
      price: number;
    }>;
  }>;
  extraPrice?: number;
}
