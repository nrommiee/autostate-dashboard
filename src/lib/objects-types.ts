// ============================================
// AUTOSTATE - Types pour BASE 1 : Référentiel Métier
// ============================================

// ============================================
// CATÉGORIES
// ============================================
export interface ObjectCategory {
  id: string
  name: string
  slug: string
  icon: string
  color: string
  description: string | null
  sort_order: number
  is_active: boolean
  created_at: string
  updated_at: string
}

// ============================================
// OBJETS (Templates)
// ============================================
export type ObjectStatus = 'pending' | 'to_validate' | 'validated' | 'rejected'
export type ObjectSource = 'manual' | 'import' | 'ai_detected'

export interface ObjectTemplate {
  id: string
  canonical_name: string
  category_id: string | null
  description: string | null
  status: ObjectStatus
  occurrence_count: number
  validation_threshold: number
  source: ObjectSource
  source_document_id: string | null
  is_active: boolean
  is_common: boolean
  requires_photo: boolean
  validated_by: string | null
  validated_at: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface ObjectTemplateWithStats extends ObjectTemplate {
  category_name: string | null
  category_icon: string | null
  category_color: string | null
  alias_count: number
  attribute_count: number
  damage_count: number
  relation_count: number
}

export interface ObjectTemplateWithRelations extends ObjectTemplateWithStats {
  aliases: ObjectAlias[]
  attributes: ObjectAttribute[]
  damages: ObjectDamageWithType[]
  parent_relations: ObjectRelationWithObjects[]
  child_relations: ObjectRelationWithObjects[]
}

// ============================================
// ALIAS
// ============================================
export interface ObjectAlias {
  id: string
  object_template_id: string
  alias_name: string
  occurrence_count: number
  source: ObjectSource
  is_primary: boolean
  created_at: string
}

// ============================================
// TYPES D'ATTRIBUTS
// ============================================
export interface AttributeType {
  id: string
  name: string
  slug: string
  description: string | null
  icon: string
  sort_order: number
}

// ============================================
// ATTRIBUTS
// ============================================
export type AttributeDataType = 'string' | 'enum' | 'boolean' | 'number' | 'date'

export interface ObjectAttribute {
  id: string
  object_template_id: string
  name: string
  attribute_type_id: string | null
  data_type: AttributeDataType
  enum_values: string[]
  is_required: boolean
  is_filterable: boolean
  is_visible_on_photo: boolean
  default_value: string | null
  status: ObjectStatus
  occurrence_count: number
  sort_order: number
  created_at: string
  updated_at: string
}

export interface ObjectAttributeWithType extends ObjectAttribute {
  attribute_type?: AttributeType
}

// ============================================
// TYPES DE DÉGÂTS
// ============================================
export type DamageSeverity = 'minor' | 'medium' | 'major' | 'critical'
export type DamageLiability = 'tenant' | 'landlord' | 'shared' | 'unknown'

export interface DamageType {
  id: string
  name: string
  slug: string
  description: string | null
  icon: string
  severity_default: DamageSeverity
  default_liability: DamageLiability
  sort_order: number
  created_at: string
}

// ============================================
// DÉGÂTS PAR OBJET
// ============================================
export type QuantificationType = 'count' | 'dimension' | 'percentage' | 'severity' | 'none'

export interface SeverityCoefficients {
  first?: number
  '2_to_5'?: number
  '6_to_10'?: number
  more_than_10?: number
  [key: string]: number | undefined
}

export interface ObjectDamage {
  id: string
  object_template_id: string
  damage_type_id: string
  custom_name: string | null
  description: string | null
  quantification_type: QuantificationType
  quantification_options: string[]
  liability: DamageLiability
  liability_conditions: string | null
  liability_source: string | null
  severity_coefficients: SeverityCoefficients
  status: ObjectStatus
  occurrence_count: number
  sort_order: number
  created_at: string
  updated_at: string
}

export interface ObjectDamageWithType extends ObjectDamage {
  damage_type?: DamageType
}

// ============================================
// RELATIONS
// ============================================
export type RelationType = 'contains' | 'connected_to' | 'part_of'

export interface ObjectRelation {
  id: string
  parent_object_id: string
  child_object_id: string
  relation_type: RelationType
  min_count: number
  max_count: number | null
  status: ObjectStatus
  occurrence_count: number
  created_at: string
}

export interface ObjectRelationWithObjects extends ObjectRelation {
  parent_object?: ObjectTemplate
  child_object?: ObjectTemplate
}

// ============================================
// DOCUMENTS IMPORTÉS
// ============================================
export type DocumentSourceType = 
  | 'inspection_report'
  | 'supplier_catalog'
  | 'product_photo'
  | 'repair_quote'
  | 'legal_document'

export type DocumentStatus = 'pending' | 'processing' | 'completed' | 'failed'

export interface ImportedDocument {
  id: string
  original_filename: string
  file_url: string | null
  file_type: string | null
  file_size_bytes: number | null
  source_type: DocumentSourceType
  status: DocumentStatus
  processing_started_at: string | null
  processing_completed_at: string | null
  error_message: string | null
  extraction_raw: Record<string, any> | null
  extraction_tokens_input: number | null
  extraction_tokens_output: number | null
  extraction_cost_usd: number | null
  objects_extracted: number
  attributes_extracted: number
  damages_extracted: number
  was_anonymized: boolean
  anonymization_log: Record<string, any> | null
  uploaded_by: string | null
  created_at: string
  updated_at: string
}

// ============================================
// EXTRACTIONS
// ============================================
export type ExtractionType = 'object' | 'attribute' | 'damage' | 'relation' | 'alias'

export interface DocumentExtraction {
  id: string
  document_id: string
  extraction_type: ExtractionType
  extracted_text: string
  extracted_context: string | null
  linked_object_id: string | null
  linked_attribute_id: string | null
  linked_damage_id: string | null
  linked_alias_id: string | null
  confidence_score: number | null
  was_new: boolean
  was_merged: boolean
  created_at: string
}

// ============================================
// VALIDATION
// ============================================
export type ValidationAction = 'validate' | 'reject' | 'merge' | 'edit' | 'delete'

export interface ValidationHistory {
  id: string
  entity_type: ExtractionType
  entity_id: string
  action: ValidationAction
  previous_status: string | null
  new_status: string | null
  changes: Record<string, any> | null
  notes: string | null
  performed_by: string | null
  performed_at: string
}

export interface ValidationThreshold {
  id: string
  entity_type: ExtractionType
  threshold_count: number
  description: string | null
  updated_at: string
}

// ============================================
// STATS & DASHBOARD
// ============================================
export interface ObjectsStats {
  total: number
  pending: number
  to_validate: number
  validated: number
  rejected: number
  by_category: { category_name: string; count: number; icon: string }[]
  recent_extractions: number
  documents_processed: number
}

// ============================================
// FORMULAIRES
// ============================================
export interface ObjectTemplateFormData {
  canonical_name: string
  category_id: string | null
  description: string
  is_common: boolean
  requires_photo: boolean
  aliases: string[]
}

export interface ObjectAttributeFormData {
  name: string
  attribute_type_id: string | null
  data_type: AttributeDataType
  enum_values: string[]
  is_required: boolean
  is_filterable: boolean
  is_visible_on_photo: boolean
  default_value: string
}

export interface ObjectDamageFormData {
  damage_type_id: string
  custom_name: string
  description: string
  quantification_type: QuantificationType
  quantification_options: string[]
  liability: DamageLiability
  liability_conditions: string
  liability_source: string
  severity_coefficients: SeverityCoefficients
}

// ============================================
// CONFIGURATION UI
// ============================================
export const STATUS_CONFIG: Record<ObjectStatus, {
  label: string
  color: string
  bgColor: string
  icon: string
}> = {
  pending: {
    label: 'En attente',
    color: 'text-gray-600',
    bgColor: 'bg-gray-100',
    icon: '⏳'
  },
  to_validate: {
    label: 'À valider',
    color: 'text-orange-600',
    bgColor: 'bg-orange-100',
    icon: '🔔'
  },
  validated: {
    label: 'Validé',
    color: 'text-green-600',
    bgColor: 'bg-green-100',
    icon: '✅'
  },
  rejected: {
    label: 'Rejeté',
    color: 'text-red-600',
    bgColor: 'bg-red-100',
    icon: '❌'
  }
}

export const LIABILITY_CONFIG: Record<DamageLiability, {
  label: string
  color: string
  bgColor: string
}> = {
  tenant: {
    label: 'Locataire',
    color: 'text-red-600',
    bgColor: 'bg-red-100'
  },
  landlord: {
    label: 'Bailleur',
    color: 'text-blue-600',
    bgColor: 'bg-blue-100'
  },
  shared: {
    label: 'Partagé',
    color: 'text-purple-600',
    bgColor: 'bg-purple-100'
  },
  unknown: {
    label: 'À déterminer',
    color: 'text-gray-600',
    bgColor: 'bg-gray-100'
  }
}

export const SEVERITY_CONFIG: Record<DamageSeverity, {
  label: string
  color: string
  bgColor: string
}> = {
  minor: {
    label: 'Mineur',
    color: 'text-green-600',
    bgColor: 'bg-green-100'
  },
  medium: {
    label: 'Moyen',
    color: 'text-yellow-600',
    bgColor: 'bg-yellow-100'
  },
  major: {
    label: 'Important',
    color: 'text-orange-600',
    bgColor: 'bg-orange-100'
  },
  critical: {
    label: 'Critique',
    color: 'text-red-600',
    bgColor: 'bg-red-100'
  }
}

export const DATA_TYPE_CONFIG: Record<AttributeDataType, {
  label: string
  icon: string
}> = {
  string: { label: 'Texte', icon: '📝' },
  enum: { label: 'Liste de choix', icon: '📋' },
  boolean: { label: 'Oui/Non', icon: '✓' },
  number: { label: 'Nombre', icon: '🔢' },
  date: { label: 'Date', icon: '📅' }
}

export const SOURCE_TYPE_CONFIG: Record<DocumentSourceType, {
  label: string
  icon: string
  description: string
  targetBase: string
}> = {
  inspection_report: {
    label: 'Rapport état des lieux',
    icon: '📋',
    description: 'Extrait objets, attributs, dégâts, relations',
    targetBase: 'BASE 1'
  },
  supplier_catalog: {
    label: 'Catalogue fournisseur',
    icon: '🛒',
    description: 'Extrait variantes, prix, EAN, specs',
    targetBase: 'BASE 2'
  },
  product_photo: {
    label: 'Photo produit',
    icon: '📸',
    description: 'Extrait marque, modèle, prix via vision IA',
    targetBase: 'BASE 2'
  },
  repair_quote: {
    label: 'Devis réparation',
    icon: '🧾',
    description: 'Extrait coûts main d\'œuvre, temps, déplacement',
    targetBase: 'BASE 3'
  },
  legal_document: {
    label: 'Document légal',
    icon: '📜',
    description: 'Extrait règles régionales, imputations',
    targetBase: 'BASE 3'
  }
}
