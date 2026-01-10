'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { 
  ObjectCategory, 
  AttributeType,
  DamageType,
  ObjectAttributeFormData,
  ObjectDamageFormData,
  DATA_TYPE_CONFIG,
  LIABILITY_CONFIG,
  AttributeDataType,
  DamageLiability,
  QuantificationType
} from '@/lib/objects-types'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { 
  ArrowLeft, Save, Loader2, Plus, Trash2, X, 
  Package, Tags, AlertTriangle, Sparkles, GripVertical,
  Check
} from 'lucide-react'

export default function CreateObjectPage() {
  const router = useRouter()
  
  // Form state
  const [canonicalName, setCanonicalName] = useState('')
  const [categoryId, setCategoryId] = useState<string>('')
  const [description, setDescription] = useState('')
  const [isCommon, setIsCommon] = useState(false)
  const [requiresPhoto, setRequiresPhoto] = useState(true)
  
  // Aliases
  const [aliases, setAliases] = useState<string[]>([])
  const [newAlias, setNewAlias] = useState('')
  
  // Attributes
  const [attributes, setAttributes] = useState<ObjectAttributeFormData[]>([])
  const [showAttributeDialog, setShowAttributeDialog] = useState(false)
  const [editingAttribute, setEditingAttribute] = useState<ObjectAttributeFormData | null>(null)
  const [editingAttributeIndex, setEditingAttributeIndex] = useState<number | null>(null)
  
  // Damages
  const [damages, setDamages] = useState<ObjectDamageFormData[]>([])
  const [showDamageDialog, setShowDamageDialog] = useState(false)
  const [editingDamage, setEditingDamage] = useState<ObjectDamageFormData | null>(null)
  const [editingDamageIndex, setEditingDamageIndex] = useState<number | null>(null)
  
  // Reference data
  const [categories, setCategories] = useState<ObjectCategory[]>([])
  const [attributeTypes, setAttributeTypes] = useState<AttributeType[]>([])
  const [damageTypes, setDamageTypes] = useState<DamageType[]>([])
  
  // UI state
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)

  // ============================================
  // LOAD REFERENCE DATA
  // ============================================
  useEffect(() => {
    async function loadData() {
      setLoading(true)
      try {
        const [catRes, attrRes, dmgRes] = await Promise.all([
          supabase.from('object_categories').select('*').eq('is_active', true).order('sort_order'),
          supabase.from('attribute_types').select('*').order('sort_order'),
          supabase.from('damage_types').select('*').order('sort_order')
        ])
        
        if (catRes.data) setCategories(catRes.data)
        if (attrRes.data) setAttributeTypes(attrRes.data)
        if (dmgRes.data) setDamageTypes(dmgRes.data)
      } catch (error) {
        console.error('Error loading reference data:', error)
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [])

  // ============================================
  // ALIASES
  // ============================================
  function addAlias() {
    if (newAlias.trim() && !aliases.includes(newAlias.trim())) {
      setAliases([...aliases, newAlias.trim()])
      setNewAlias('')
    }
  }

  function removeAlias(index: number) {
    setAliases(aliases.filter((_, i) => i !== index))
  }

  // ============================================
  // ATTRIBUTES
  // ============================================
  function openAddAttribute() {
    setEditingAttribute({
      name: '',
      attribute_type_id: '',
      data_type: 'string',
      enum_values: [],
      is_required: false,
      is_filterable: false,
      is_visible_on_photo: false,
      default_value: ''
    })
    setEditingAttributeIndex(null)
    setShowAttributeDialog(true)
  }

  function openEditAttribute(attr: ObjectAttributeFormData, index: number) {
    setEditingAttribute({ ...attr })
    setEditingAttributeIndex(index)
    setShowAttributeDialog(true)
  }

  function saveAttribute() {
    if (!editingAttribute || !editingAttribute.name.trim()) return
    
    if (editingAttributeIndex !== null) {
      const updated = [...attributes]
      updated[editingAttributeIndex] = editingAttribute
      setAttributes(updated)
    } else {
      setAttributes([...attributes, editingAttribute])
    }
    
    setShowAttributeDialog(false)
    setEditingAttribute(null)
    setEditingAttributeIndex(null)
  }

  function removeAttribute(index: number) {
    setAttributes(attributes.filter((_, i) => i !== index))
  }

  // ============================================
  // DAMAGES
  // ============================================
  function openAddDamage() {
    setEditingDamage({
      damage_type_id: '',
      custom_name: '',
      description: '',
      quantification_type: 'count',
      quantification_options: [],
      liability: 'tenant',
      liability_conditions: '',
      liability_source: '',
      severity_coefficients: {}
    })
    setEditingDamageIndex(null)
    setShowDamageDialog(true)
  }

  function openEditDamage(dmg: ObjectDamageFormData, index: number) {
    setEditingDamage({ ...dmg })
    setEditingDamageIndex(index)
    setShowDamageDialog(true)
  }

  function saveDamage() {
    if (!editingDamage || !editingDamage.damage_type_id) return
    
    if (editingDamageIndex !== null) {
      const updated = [...damages]
      updated[editingDamageIndex] = editingDamage
      setDamages(updated)
    } else {
      setDamages([...damages, editingDamage])
    }
    
    setShowDamageDialog(false)
    setEditingDamage(null)
    setEditingDamageIndex(null)
  }

  function removeDamage(index: number) {
    setDamages(damages.filter((_, i) => i !== index))
  }

  // ============================================
  // SAVE
  // ============================================
  async function handleSave() {
    if (!canonicalName.trim()) return
    
    setSaving(true)
    try {
      // 1. Create the object template
      const { data: objectData, error: objectError } = await supabase
        .from('object_templates')
        .insert({
          canonical_name: canonicalName.trim(),
          category_id: categoryId || null,
          description: description.trim() || null,
          is_common: isCommon,
          requires_photo: requiresPhoto,
          status: 'validated', // Manual creation = validated
          source: 'manual'
        })
        .select()
        .single()

      if (objectError) throw objectError

      const objectId = objectData.id

      // 2. Create aliases
      if (aliases.length > 0) {
        const aliasInserts = aliases.map((alias, i) => ({
          object_template_id: objectId,
          alias_name: alias,
          is_primary: i === 0,
          source: 'manual'
        }))
        
        await supabase.from('object_aliases').insert(aliasInserts)
      }

      // 3. Create attributes
      if (attributes.length > 0) {
        const attrInserts = attributes.map((attr, i) => ({
          object_template_id: objectId,
          name: attr.name,
          attribute_type_id: attr.attribute_type_id || null,
          data_type: attr.data_type,
          enum_values: attr.enum_values,
          is_required: attr.is_required,
          is_filterable: attr.is_filterable,
          is_visible_on_photo: attr.is_visible_on_photo,
          default_value: attr.default_value || null,
          status: 'validated',
          sort_order: i
        }))
        
        await supabase.from('object_attributes').insert(attrInserts)
      }

      // 4. Create damages
      if (damages.length > 0) {
        const dmgInserts = damages.map((dmg, i) => ({
          object_template_id: objectId,
          damage_type_id: dmg.damage_type_id,
          custom_name: dmg.custom_name || null,
          description: dmg.description || null,
          quantification_type: dmg.quantification_type,
          quantification_options: dmg.quantification_options,
          liability: dmg.liability,
          liability_conditions: dmg.liability_conditions || null,
          liability_source: dmg.liability_source || null,
          severity_coefficients: dmg.severity_coefficients,
          status: 'validated',
          sort_order: i
        }))
        
        await supabase.from('object_damages').insert(dmgInserts)
      }

      router.push(`/dashboard/objects/${objectId}`)
    } catch (error) {
      console.error('Error saving object:', error)
      alert('Erreur lors de la sauvegarde')
    } finally {
      setSaving(false)
    }
  }

  // ============================================
  // RENDER
  // ============================================
  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
      </div>
    )
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/dashboard/objects">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold">Créer un objet</h1>
          <p className="text-muted-foreground">
            Ajouter un nouvel objet au référentiel
          </p>
        </div>
      </div>

      {/* Main Form */}
      <Card className="p-6">
        <h2 className="font-semibold mb-4 flex items-center gap-2">
          <Package className="h-5 w-5" />
          Informations générales
        </h2>
        
        <div className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="name">Nom canonique *</Label>
              <Input
                id="name"
                value={canonicalName}
                onChange={(e) => setCanonicalName(e.target.value)}
                placeholder="Ex: Mitigeur"
                className="mt-1"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Le nom officiel et unique de l'objet
              </p>
            </div>
            
            <div>
              <Label htmlFor="category">Catégorie</Label>
              <Select value={categoryId} onValueChange={setCategoryId}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Sélectionner une catégorie" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map(cat => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {cat.icon} {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Description de l'objet, caractéristiques générales..."
              className="mt-1"
              rows={3}
            />
          </div>

          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <Switch
                id="isCommon"
                checked={isCommon}
                onCheckedChange={setIsCommon}
              />
              <Label htmlFor="isCommon" className="flex items-center gap-1">
                <Sparkles className="h-4 w-4 text-yellow-500" />
                Objet fréquent
              </Label>
            </div>
            
            <div className="flex items-center gap-2">
              <Switch
                id="requiresPhoto"
                checked={requiresPhoto}
                onCheckedChange={setRequiresPhoto}
              />
              <Label htmlFor="requiresPhoto">Photo obligatoire</Label>
            </div>
          </div>
        </div>
      </Card>

      {/* Aliases */}
      <Card className="p-6">
        <h2 className="font-semibold mb-4 flex items-center gap-2">
          <Tags className="h-5 w-5" />
          Alias (synonymes)
        </h2>
        <p className="text-sm text-muted-foreground mb-4">
          Termes alternatifs utilisés pour désigner cet objet
        </p>
        
        <div className="flex gap-2 mb-4">
          <Input
            value={newAlias}
            onChange={(e) => setNewAlias(e.target.value)}
            placeholder="Ajouter un alias..."
            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addAlias())}
          />
          <Button onClick={addAlias} disabled={!newAlias.trim()}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        
        {aliases.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {aliases.map((alias, i) => (
              <Badge key={i} variant="secondary" className="gap-1 pr-1">
                {alias}
                <button 
                  onClick={() => removeAlias(i)}
                  className="ml-1 hover:bg-gray-300 rounded p-0.5"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground italic">Aucun alias défini</p>
        )}
      </Card>

      {/* Attributes */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="font-semibold flex items-center gap-2">
              📋 Attributs
            </h2>
            <p className="text-sm text-muted-foreground">
              Caractéristiques descriptives de l'objet
            </p>
          </div>
          <Button onClick={openAddAttribute} variant="outline" size="sm">
            <Plus className="h-4 w-4 mr-1" />
            Ajouter
          </Button>
        </div>
        
        {attributes.length > 0 ? (
          <div className="space-y-2">
            {attributes.map((attr, i) => (
              <div 
                key={i}
                className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/30"
              >
                <div className="flex items-center gap-3">
                  <GripVertical className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="font-medium">{attr.name}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>{DATA_TYPE_CONFIG[attr.data_type].icon} {DATA_TYPE_CONFIG[attr.data_type].label}</span>
                      {attr.is_required && <Badge variant="secondary" className="text-xs">Requis</Badge>}
                      {attr.is_filterable && <Badge variant="secondary" className="text-xs">Filtrant</Badge>}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="sm" onClick={() => openEditAttribute(attr, i)}>
                    Modifier
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => removeAttribute(i)}>
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground italic text-center py-4">
            Aucun attribut défini
          </p>
        )}
      </Card>

      {/* Damages */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="font-semibold flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-orange-500" />
              Dégâts possibles
            </h2>
            <p className="text-sm text-muted-foreground">
              Types de dégâts applicables à cet objet
            </p>
          </div>
          <Button onClick={openAddDamage} variant="outline" size="sm">
            <Plus className="h-4 w-4 mr-1" />
            Ajouter
          </Button>
        </div>
        
        {damages.length > 0 ? (
          <div className="space-y-2">
            {damages.map((dmg, i) => {
              const damageType = damageTypes.find(dt => dt.id === dmg.damage_type_id)
              return (
                <div 
                  key={i}
                  className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/30"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xl">{damageType?.icon || '💥'}</span>
                    <div>
                      <p className="font-medium">
                        {dmg.custom_name || damageType?.name || 'Dégât'}
                      </p>
                      <div className="flex items-center gap-2 text-xs">
                        <Badge 
                          variant="secondary" 
                          className={LIABILITY_CONFIG[dmg.liability].bgColor + ' ' + LIABILITY_CONFIG[dmg.liability].color}
                        >
                          {LIABILITY_CONFIG[dmg.liability].label}
                        </Badge>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="sm" onClick={() => openEditDamage(dmg, i)}>
                      Modifier
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => removeDamage(i)}>
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground italic text-center py-4">
            Aucun dégât défini
          </p>
        )}
      </Card>

      {/* Save Button */}
      <div className="flex justify-end gap-2">
        <Link href="/dashboard/objects">
          <Button variant="outline">Annuler</Button>
        </Link>
        <Button onClick={handleSave} disabled={saving || !canonicalName.trim()}>
          {saving ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Save className="h-4 w-4 mr-2" />
          )}
          Créer l'objet
        </Button>
      </div>

      {/* Attribute Dialog */}
      <Dialog open={showAttributeDialog} onOpenChange={setShowAttributeDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingAttributeIndex !== null ? 'Modifier l\'attribut' : 'Ajouter un attribut'}
            </DialogTitle>
          </DialogHeader>
          
          {editingAttribute && (
            <div className="space-y-4 py-4">
              <div>
                <Label>Nom de l'attribut *</Label>
                <Input
                  value={editingAttribute.name}
                  onChange={(e) => setEditingAttribute({ ...editingAttribute, name: e.target.value })}
                  placeholder="Ex: Matériau"
                  className="mt-1"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Type d'attribut</Label>
                  <Select 
                    value={editingAttribute.attribute_type_id} 
                    onValueChange={(v) => setEditingAttribute({ ...editingAttribute, attribute_type_id: v })}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Sélectionner..." />
                    </SelectTrigger>
                    <SelectContent>
                      {attributeTypes.map(at => (
                        <SelectItem key={at.id} value={at.id}>
                          {at.icon} {at.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <Label>Type de données</Label>
                  <Select 
                    value={editingAttribute.data_type} 
                    onValueChange={(v) => setEditingAttribute({ ...editingAttribute, data_type: v as AttributeDataType })}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(DATA_TYPE_CONFIG).map(([key, config]) => (
                        <SelectItem key={key} value={key}>
                          {config.icon} {config.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {editingAttribute.data_type === 'enum' && (
                <div>
                  <Label>Valeurs possibles (séparées par des virgules)</Label>
                  <Input
                    value={editingAttribute.enum_values.join(', ')}
                    onChange={(e) => setEditingAttribute({ 
                      ...editingAttribute, 
                      enum_values: e.target.value.split(',').map(v => v.trim()).filter(Boolean)
                    })}
                    placeholder="Ex: blanc, noir, gris, beige"
                    className="mt-1"
                  />
                </div>
              )}

              <div>
                <Label>Valeur par défaut</Label>
                <Input
                  value={editingAttribute.default_value}
                  onChange={(e) => setEditingAttribute({ ...editingAttribute, default_value: e.target.value })}
                  placeholder="Optionnel"
                  className="mt-1"
                />
              </div>

              <div className="flex flex-wrap gap-4">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="attr_required"
                    checked={editingAttribute.is_required}
                    onCheckedChange={(c) => setEditingAttribute({ ...editingAttribute, is_required: !!c })}
                  />
                  <Label htmlFor="attr_required">Requis</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="attr_filterable"
                    checked={editingAttribute.is_filterable}
                    onCheckedChange={(c) => setEditingAttribute({ ...editingAttribute, is_filterable: !!c })}
                  />
                  <Label htmlFor="attr_filterable">Filtrant (matching)</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="attr_visible"
                    checked={editingAttribute.is_visible_on_photo}
                    onCheckedChange={(c) => setEditingAttribute({ ...editingAttribute, is_visible_on_photo: !!c })}
                  />
                  <Label htmlFor="attr_visible">Visible sur photo</Label>
                </div>
              </div>
            </div>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAttributeDialog(false)}>
              Annuler
            </Button>
            <Button onClick={saveAttribute} disabled={!editingAttribute?.name.trim()}>
              <Check className="h-4 w-4 mr-2" />
              {editingAttributeIndex !== null ? 'Modifier' : 'Ajouter'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Damage Dialog */}
      <Dialog open={showDamageDialog} onOpenChange={setShowDamageDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingDamageIndex !== null ? 'Modifier le dégât' : 'Ajouter un dégât'}
            </DialogTitle>
          </DialogHeader>
          
          {editingDamage && (
            <div className="space-y-4 py-4">
              <div>
                <Label>Type de dégât *</Label>
                <Select 
                  value={editingDamage.damage_type_id} 
                  onValueChange={(v) => setEditingDamage({ ...editingDamage, damage_type_id: v })}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Sélectionner un type..." />
                  </SelectTrigger>
                  <SelectContent>
                    {damageTypes.map(dt => (
                      <SelectItem key={dt.id} value={dt.id}>
                        {dt.icon} {dt.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Nom personnalisé (optionnel)</Label>
                <Input
                  value={editingDamage.custom_name}
                  onChange={(e) => setEditingDamage({ ...editingDamage, custom_name: e.target.value })}
                  placeholder="Ex: Cristallisation (pour vitrocéramique)"
                  className="mt-1"
                />
              </div>

              <div>
                <Label>Imputation</Label>
                <Select 
                  value={editingDamage.liability} 
                  onValueChange={(v) => setEditingDamage({ ...editingDamage, liability: v as DamageLiability })}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(LIABILITY_CONFIG).map(([key, config]) => (
                      <SelectItem key={key} value={key}>
                        {config.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Type de quantification</Label>
                <Select 
                  value={editingDamage.quantification_type} 
                  onValueChange={(v) => setEditingDamage({ ...editingDamage, quantification_type: v as QuantificationType })}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="count">Comptage (1, 2, 3...)</SelectItem>
                    <SelectItem value="dimension">Dimension (cm, m²)</SelectItem>
                    <SelectItem value="percentage">Pourcentage</SelectItem>
                    <SelectItem value="severity">Gravité (léger, moyen, grave)</SelectItem>
                    <SelectItem value="none">Aucune</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Conditions d'imputation</Label>
                <Textarea
                  value={editingDamage.liability_conditions}
                  onChange={(e) => setEditingDamage({ ...editingDamage, liability_conditions: e.target.value })}
                  placeholder="Ex: Sauf vice de fabrication"
                  className="mt-1"
                  rows={2}
                />
              </div>

              <div>
                <Label>Source (référence légale)</Label>
                <Input
                  value={editingDamage.liability_source}
                  onChange={(e) => setEditingDamage({ ...editingDamage, liability_source: e.target.value })}
                  placeholder="Ex: Grille Wallonie 2024"
                  className="mt-1"
                />
              </div>
            </div>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDamageDialog(false)}>
              Annuler
            </Button>
            <Button onClick={saveDamage} disabled={!editingDamage?.damage_type_id}>
              <Check className="h-4 w-4 mr-2" />
              {editingDamageIndex !== null ? 'Modifier' : 'Ajouter'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
