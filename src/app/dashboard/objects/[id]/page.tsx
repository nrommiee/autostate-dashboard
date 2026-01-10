'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { 
  ObjectCategory, 
  AttributeType,
  DamageType,
  ObjectAlias,
  STATUS_CONFIG,
  DATA_TYPE_CONFIG,
  LIABILITY_CONFIG
} from '@/lib/objects-types'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Checkbox } from '@/components/ui/checkbox'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { 
  ArrowLeft, Save, Loader2, Plus, Trash2, Check,
  Package, Tags, AlertTriangle, Sparkles, GripVertical,
  Eye, EyeOff, CheckCircle, XCircle
} from 'lucide-react'

export default function ObjectDetailPage() {
  const params = useParams()
  const router = useRouter()
  const objectId = params.id as string
  
  // Object data
  const [object, setObject] = useState<any>(null)
  const [aliases, setAliases] = useState<ObjectAlias[]>([])
  const [attributes, setAttributes] = useState<any[]>([])
  const [damages, setDamages] = useState<any[]>([])
  
  // Form state
  const [canonicalName, setCanonicalName] = useState('')
  const [categoryId, setCategoryId] = useState<string>('')
  const [description, setDescription] = useState('')
  const [isCommon, setIsCommon] = useState(false)
  const [requiresPhoto, setRequiresPhoto] = useState(true)
  const [isActive, setIsActive] = useState(true)
  
  // New alias
  const [newAlias, setNewAlias] = useState('')
  
  // Reference data
  const [categories, setCategories] = useState<ObjectCategory[]>([])
  const [attributeTypes, setAttributeTypes] = useState<AttributeType[]>([])
  const [damageTypes, setDamageTypes] = useState<DamageType[]>([])
  
  // UI state
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [activeTab, setActiveTab] = useState('general')
  
  // Dialogs
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [showAttributeDialog, setShowAttributeDialog] = useState(false)
  const [editingAttribute, setEditingAttribute] = useState<any>(null)
  const [showDamageDialog, setShowDamageDialog] = useState(false)
  const [editingDamage, setEditingDamage] = useState<any>(null)

  // Load data
  const loadObject = useCallback(async () => {
    setLoading(true)
    try {
      const [catRes, attrTypeRes, dmgTypeRes] = await Promise.all([
        supabase.from('object_categories').select('*').eq('is_active', true).order('sort_order'),
        supabase.from('attribute_types').select('*').order('sort_order'),
        supabase.from('damage_types').select('*').order('sort_order')
      ])
      
      if (catRes.data) setCategories(catRes.data)
      if (attrTypeRes.data) setAttributeTypes(attrTypeRes.data)
      if (dmgTypeRes.data) setDamageTypes(dmgTypeRes.data)

      const { data: objectData } = await supabase
        .from('object_templates')
        .select('*, object_categories (*)')
        .eq('id', objectId)
        .single()

      if (objectData) {
        setObject(objectData)
        setCanonicalName(objectData.canonical_name)
        setCategoryId(objectData.category_id || '')
        setDescription(objectData.description || '')
        setIsCommon(objectData.is_common)
        setRequiresPhoto(objectData.requires_photo)
        setIsActive(objectData.is_active)
      }

      const { data: aliasData } = await supabase
        .from('object_aliases')
        .select('*')
        .eq('object_template_id', objectId)
        .order('is_primary', { ascending: false })
      if (aliasData) setAliases(aliasData)

      const { data: attrData } = await supabase
        .from('object_attributes')
        .select('*, attribute_types (*)')
        .eq('object_template_id', objectId)
        .order('sort_order')
      if (attrData) setAttributes(attrData.map(a => ({ ...a, attribute_type: a.attribute_types })))

      const { data: dmgData } = await supabase
        .from('object_damages')
        .select('*, damage_types (*)')
        .eq('object_template_id', objectId)
        .order('sort_order')
      if (dmgData) setDamages(dmgData.map(d => ({ ...d, damage_type: d.damage_types })))
    } catch (error) {
      console.error('Error loading object:', error)
    } finally {
      setLoading(false)
    }
  }, [objectId])

  useEffect(() => { loadObject() }, [loadObject])

  // Save object
  async function handleSave() {
    if (!canonicalName.trim()) return
    setSaving(true)
    try {
      await supabase
        .from('object_templates')
        .update({
          canonical_name: canonicalName.trim(),
          category_id: categoryId || null,
          description: description.trim() || null,
          is_common: isCommon,
          requires_photo: requiresPhoto,
          is_active: isActive,
          updated_at: new Date().toISOString()
        })
        .eq('id', objectId)
      await loadObject()
    } catch (error) {
      console.error('Error saving:', error)
    } finally {
      setSaving(false)
    }
  }

  // Aliases
  async function addAlias() {
    if (!newAlias.trim()) return
    try {
      await supabase.from('object_aliases').insert({
        object_template_id: objectId,
        alias_name: newAlias.trim(),
        source: 'manual'
      })
      setNewAlias('')
      await loadObject()
    } catch (error) { console.error('Error:', error) }
  }

  async function removeAlias(aliasId: string) {
    try {
      await supabase.from('object_aliases').delete().eq('id', aliasId)
      await loadObject()
    } catch (error) { console.error('Error:', error) }
  }

  async function setPrimaryAlias(aliasId: string) {
    try {
      await supabase.from('object_aliases').update({ is_primary: false }).eq('object_template_id', objectId)
      await supabase.from('object_aliases').update({ is_primary: true }).eq('id', aliasId)
      await loadObject()
    } catch (error) { console.error('Error:', error) }
  }

  // Attributes
  function openAddAttribute() {
    setEditingAttribute({
      id: null, name: '', attribute_type_id: '', data_type: 'string',
      enum_values: [], is_required: false, is_filterable: false, is_visible_on_photo: false, default_value: ''
    })
    setShowAttributeDialog(true)
  }

  function openEditAttribute(attr: any) {
    setEditingAttribute({
      id: attr.id, name: attr.name, attribute_type_id: attr.attribute_type_id || '',
      data_type: attr.data_type, enum_values: attr.enum_values || [],
      is_required: attr.is_required, is_filterable: attr.is_filterable,
      is_visible_on_photo: attr.is_visible_on_photo, default_value: attr.default_value || ''
    })
    setShowAttributeDialog(true)
  }

  async function saveAttribute() {
    if (!editingAttribute?.name.trim()) return
    try {
      const data = {
        name: editingAttribute.name,
        attribute_type_id: editingAttribute.attribute_type_id || null,
        data_type: editingAttribute.data_type,
        enum_values: editingAttribute.enum_values,
        is_required: editingAttribute.is_required,
        is_filterable: editingAttribute.is_filterable,
        is_visible_on_photo: editingAttribute.is_visible_on_photo,
        default_value: editingAttribute.default_value || null
      }
      if (editingAttribute.id) {
        await supabase.from('object_attributes').update({ ...data, updated_at: new Date().toISOString() }).eq('id', editingAttribute.id)
      } else {
        await supabase.from('object_attributes').insert({ ...data, object_template_id: objectId, status: 'validated', sort_order: attributes.length })
      }
      setShowAttributeDialog(false)
      setEditingAttribute(null)
      await loadObject()
    } catch (error) { console.error('Error:', error) }
  }

  async function removeAttribute(attrId: string) {
    try {
      await supabase.from('object_attributes').delete().eq('id', attrId)
      await loadObject()
    } catch (error) { console.error('Error:', error) }
  }

  // Damages
  function openAddDamage() {
    setEditingDamage({
      id: null, damage_type_id: '', custom_name: '', description: '',
      quantification_type: 'count', quantification_options: [],
      liability: 'tenant', liability_conditions: '', liability_source: ''
    })
    setShowDamageDialog(true)
  }

  function openEditDamage(dmg: any) {
    setEditingDamage({
      id: dmg.id, damage_type_id: dmg.damage_type_id,
      custom_name: dmg.custom_name || '', description: dmg.description || '',
      quantification_type: dmg.quantification_type, quantification_options: dmg.quantification_options || [],
      liability: dmg.liability, liability_conditions: dmg.liability_conditions || '',
      liability_source: dmg.liability_source || ''
    })
    setShowDamageDialog(true)
  }

  async function saveDamage() {
    if (!editingDamage?.damage_type_id) return
    try {
      const data = {
        damage_type_id: editingDamage.damage_type_id,
        custom_name: editingDamage.custom_name || null,
        description: editingDamage.description || null,
        quantification_type: editingDamage.quantification_type,
        quantification_options: editingDamage.quantification_options,
        liability: editingDamage.liability,
        liability_conditions: editingDamage.liability_conditions || null,
        liability_source: editingDamage.liability_source || null
      }
      if (editingDamage.id) {
        await supabase.from('object_damages').update({ ...data, updated_at: new Date().toISOString() }).eq('id', editingDamage.id)
      } else {
        await supabase.from('object_damages').insert({ ...data, object_template_id: objectId, status: 'validated', sort_order: damages.length })
      }
      setShowDamageDialog(false)
      setEditingDamage(null)
      await loadObject()
    } catch (error) { console.error('Error:', error) }
  }

  async function removeDamage(dmgId: string) {
    try {
      await supabase.from('object_damages').delete().eq('id', dmgId)
      await loadObject()
    } catch (error) { console.error('Error:', error) }
  }

  // Delete object
  async function handleDelete() {
    setDeleting(true)
    try {
      await supabase.from('object_templates').delete().eq('id', objectId)
      router.push('/dashboard/objects')
    } catch (error) { console.error('Error:', error) }
    finally { setDeleting(false) }
  }

  // Validation
  async function handleValidate() {
    await supabase.from('object_templates').update({ status: 'validated', validated_at: new Date().toISOString() }).eq('id', objectId)
    await loadObject()
  }

  async function handleReject() {
    await supabase.from('object_templates').update({ status: 'rejected' }).eq('id', objectId)
    await loadObject()
  }

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
      </div>
    )
  }

  if (!object) {
    return (
      <div className="p-6 text-center">
        <Package className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
        <h2 className="text-xl font-semibold mb-2">Objet non trouvé</h2>
        <Link href="/dashboard/objects"><Button>Retour</Button></Link>
      </div>
    )
  }

  const statusConfig = STATUS_CONFIG[object.status as keyof typeof STATUS_CONFIG]

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/objects">
            <Button variant="ghost" size="icon"><ArrowLeft className="h-5 w-5" /></Button>
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold">{object.canonical_name}</h1>
              <Badge className={`${statusConfig.bgColor} ${statusConfig.color}`}>
                {statusConfig.icon} {statusConfig.label}
              </Badge>
              {!object.is_active && <Badge variant="secondary"><EyeOff className="h-3 w-3 mr-1" />Inactif</Badge>}
            </div>
            <p className="text-muted-foreground">
              {object.occurrence_count} occurrence{object.occurrence_count > 1 ? 's' : ''} • Créé le {new Date(object.created_at).toLocaleDateString('fr-FR')}
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {object.status === 'to_validate' && (
            <>
              <Button variant="outline" onClick={handleReject}><XCircle className="h-4 w-4 mr-2 text-red-500" />Rejeter</Button>
              <Button onClick={handleValidate} className="bg-green-600 hover:bg-green-700"><CheckCircle className="h-4 w-4 mr-2" />Valider</Button>
            </>
          )}
          <Button variant="destructive" onClick={() => setShowDeleteDialog(true)}><Trash2 className="h-4 w-4 mr-2" />Supprimer</Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="general">Général</TabsTrigger>
          <TabsTrigger value="aliases">Alias {aliases.length > 0 && <Badge variant="secondary" className="ml-1">{aliases.length}</Badge>}</TabsTrigger>
          <TabsTrigger value="attributes">Attributs {attributes.length > 0 && <Badge variant="secondary" className="ml-1">{attributes.length}</Badge>}</TabsTrigger>
          <TabsTrigger value="damages">Dégâts {damages.length > 0 && <Badge variant="secondary" className="ml-1">{damages.length}</Badge>}</TabsTrigger>
        </TabsList>

        {/* General */}
        <TabsContent value="general" className="space-y-6">
          <Card className="p-6">
            <h2 className="font-semibold mb-4 flex items-center gap-2"><Package className="h-5 w-5" />Informations générales</h2>
            <div className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <Label>Nom canonique *</Label>
                  <Input value={canonicalName} onChange={(e) => setCanonicalName(e.target.value)} className="mt-1" />
                </div>
                <div>
                  <Label>Catégorie</Label>
                  <Select value={categoryId} onValueChange={setCategoryId}>
                    <SelectTrigger className="mt-1"><SelectValue placeholder="Sélectionner..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Aucune</SelectItem>
                      {categories.map(cat => <SelectItem key={cat.id} value={cat.id}>{cat.icon} {cat.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label>Description</Label>
                <Textarea value={description} onChange={(e) => setDescription(e.target.value)} className="mt-1" rows={3} />
              </div>
              <div className="flex flex-wrap items-center gap-6">
                <div className="flex items-center gap-2">
                  <Switch id="isCommon" checked={isCommon} onCheckedChange={setIsCommon} />
                  <Label htmlFor="isCommon"><Sparkles className="h-4 w-4 text-yellow-500 inline mr-1" />Objet fréquent</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch id="requiresPhoto" checked={requiresPhoto} onCheckedChange={setRequiresPhoto} />
                  <Label htmlFor="requiresPhoto">Photo obligatoire</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch id="isActive" checked={isActive} onCheckedChange={setIsActive} />
                  <Label htmlFor="isActive">{isActive ? <Eye className="h-4 w-4 inline mr-1" /> : <EyeOff className="h-4 w-4 inline mr-1" />}Actif</Label>
                </div>
              </div>
              <div className="pt-4">
                <Button onClick={handleSave} disabled={saving || !canonicalName.trim()}>
                  {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}Enregistrer
                </Button>
              </div>
            </div>
          </Card>
        </TabsContent>

        {/* Aliases */}
        <TabsContent value="aliases">
          <Card className="p-6">
            <h2 className="font-semibold mb-4 flex items-center gap-2"><Tags className="h-5 w-5" />Alias</h2>
            <div className="flex gap-2 mb-4">
              <Input value={newAlias} onChange={(e) => setNewAlias(e.target.value)} placeholder="Ajouter un alias..." onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addAlias())} />
              <Button onClick={addAlias} disabled={!newAlias.trim()}><Plus className="h-4 w-4" /></Button>
            </div>
            {aliases.length > 0 ? (
              <div className="space-y-2">
                {aliases.map((alias) => (
                  <div key={alias.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{alias.alias_name}</span>
                      {alias.is_primary && <Badge variant="secondary" className="text-xs">Principal</Badge>}
                      <span className="text-xs text-muted-foreground">({alias.occurrence_count} occ.)</span>
                    </div>
                    <div className="flex items-center gap-1">
                      {!alias.is_primary && <Button variant="ghost" size="sm" onClick={() => setPrimaryAlias(alias.id)}>Définir principal</Button>}
                      <Button variant="ghost" size="sm" onClick={() => removeAlias(alias.id)}><Trash2 className="h-4 w-4 text-red-500" /></Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : <p className="text-sm text-muted-foreground italic text-center py-8">Aucun alias</p>}
          </Card>
        </TabsContent>

        {/* Attributes */}
        <TabsContent value="attributes">
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold">📋 Attributs</h2>
              <Button onClick={openAddAttribute} variant="outline" size="sm"><Plus className="h-4 w-4 mr-1" />Ajouter</Button>
            </div>
            {attributes.length > 0 ? (
              <div className="space-y-2">
                {attributes.map((attr) => (
                  <div key={attr.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/30">
                    <div className="flex items-center gap-3">
                      <GripVertical className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="font-medium">{attr.name}</p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span>{DATA_TYPE_CONFIG[attr.data_type as keyof typeof DATA_TYPE_CONFIG]?.icon} {DATA_TYPE_CONFIG[attr.data_type as keyof typeof DATA_TYPE_CONFIG]?.label}</span>
                          {attr.is_required && <Badge variant="secondary" className="text-xs">Requis</Badge>}
                          {attr.is_filterable && <Badge variant="secondary" className="text-xs bg-blue-100 text-blue-700">Filtrant</Badge>}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="sm" onClick={() => openEditAttribute(attr)}>Modifier</Button>
                      <Button variant="ghost" size="sm" onClick={() => removeAttribute(attr.id)}><Trash2 className="h-4 w-4 text-red-500" /></Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : <p className="text-sm text-muted-foreground italic text-center py-8">Aucun attribut</p>}
          </Card>
        </TabsContent>

        {/* Damages */}
        <TabsContent value="damages">
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-orange-500" />Dégâts possibles</h2>
              <Button onClick={openAddDamage} variant="outline" size="sm"><Plus className="h-4 w-4 mr-1" />Ajouter</Button>
            </div>
            {damages.length > 0 ? (
              <div className="space-y-2">
                {damages.map((dmg) => (
                  <div key={dmg.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/30">
                    <div className="flex items-center gap-3">
                      <span className="text-xl">{dmg.damage_type?.icon || '💥'}</span>
                      <div>
                        <p className="font-medium">{dmg.custom_name || dmg.damage_type?.name || 'Dégât'}</p>
                        <Badge variant="secondary" className={`${LIABILITY_CONFIG[dmg.liability as keyof typeof LIABILITY_CONFIG]?.bgColor} ${LIABILITY_CONFIG[dmg.liability as keyof typeof LIABILITY_CONFIG]?.color} text-xs`}>
                          {LIABILITY_CONFIG[dmg.liability as keyof typeof LIABILITY_CONFIG]?.label}
                        </Badge>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="sm" onClick={() => openEditDamage(dmg)}>Modifier</Button>
                      <Button variant="ghost" size="sm" onClick={() => removeDamage(dmg.id)}><Trash2 className="h-4 w-4 text-red-500" /></Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : <p className="text-sm text-muted-foreground italic text-center py-8">Aucun dégât</p>}
          </Card>
        </TabsContent>
      </Tabs>

      {/* Delete Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-red-600"><Trash2 className="h-5 w-5 inline mr-2" />Supprimer cet objet ?</AlertDialogTitle>
            <AlertDialogDescription>Cette action est irréversible.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleting} className="bg-red-600 hover:bg-red-700">
              {deleting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Trash2 className="h-4 w-4 mr-2" />}Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Attribute Dialog */}
      <Dialog open={showAttributeDialog} onOpenChange={setShowAttributeDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editingAttribute?.id ? 'Modifier' : 'Ajouter'} un attribut</DialogTitle></DialogHeader>
          {editingAttribute && (
            <div className="space-y-4 py-4">
              <div><Label>Nom *</Label><Input value={editingAttribute.name} onChange={(e) => setEditingAttribute({ ...editingAttribute, name: e.target.value })} className="mt-1" /></div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Type</Label>
                  <Select value={editingAttribute.attribute_type_id} onValueChange={(v) => setEditingAttribute({ ...editingAttribute, attribute_type_id: v })}>
                    <SelectTrigger className="mt-1"><SelectValue placeholder="..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Aucun</SelectItem>
                      {attributeTypes.map(at => <SelectItem key={at.id} value={at.id}>{at.icon} {at.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Données</Label>
                  <Select value={editingAttribute.data_type} onValueChange={(v) => setEditingAttribute({ ...editingAttribute, data_type: v })}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(DATA_TYPE_CONFIG).map(([k, c]) => <SelectItem key={k} value={k}>{c.icon} {c.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {editingAttribute.data_type === 'enum' && (
                <div><Label>Valeurs (virgules)</Label><Input value={editingAttribute.enum_values.join(', ')} onChange={(e) => setEditingAttribute({ ...editingAttribute, enum_values: e.target.value.split(',').map((v: string) => v.trim()).filter(Boolean) })} className="mt-1" /></div>
              )}
              <div className="flex flex-wrap gap-4">
                <div className="flex items-center gap-2"><Checkbox checked={editingAttribute.is_required} onCheckedChange={(c) => setEditingAttribute({ ...editingAttribute, is_required: !!c })} /><Label>Requis</Label></div>
                <div className="flex items-center gap-2"><Checkbox checked={editingAttribute.is_filterable} onCheckedChange={(c) => setEditingAttribute({ ...editingAttribute, is_filterable: !!c })} /><Label>Filtrant</Label></div>
                <div className="flex items-center gap-2"><Checkbox checked={editingAttribute.is_visible_on_photo} onCheckedChange={(c) => setEditingAttribute({ ...editingAttribute, is_visible_on_photo: !!c })} /><Label>Visible photo</Label></div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAttributeDialog(false)}>Annuler</Button>
            <Button onClick={saveAttribute} disabled={!editingAttribute?.name?.trim()}><Check className="h-4 w-4 mr-2" />{editingAttribute?.id ? 'Modifier' : 'Ajouter'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Damage Dialog */}
      <Dialog open={showDamageDialog} onOpenChange={setShowDamageDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editingDamage?.id ? 'Modifier' : 'Ajouter'} un dégât</DialogTitle></DialogHeader>
          {editingDamage && (
            <div className="space-y-4 py-4">
              <div>
                <Label>Type *</Label>
                <Select value={editingDamage.damage_type_id} onValueChange={(v) => setEditingDamage({ ...editingDamage, damage_type_id: v })}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="..." /></SelectTrigger>
                  <SelectContent>
                    {damageTypes.map(dt => <SelectItem key={dt.id} value={dt.id}>{dt.icon} {dt.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Nom personnalisé</Label><Input value={editingDamage.custom_name} onChange={(e) => setEditingDamage({ ...editingDamage, custom_name: e.target.value })} className="mt-1" /></div>
              <div>
                <Label>Imputation</Label>
                <Select value={editingDamage.liability} onValueChange={(v) => setEditingDamage({ ...editingDamage, liability: v })}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(LIABILITY_CONFIG).map(([k, c]) => <SelectItem key={k} value={k}>{c.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Quantification</Label>
                <Select value={editingDamage.quantification_type} onValueChange={(v) => setEditingDamage({ ...editingDamage, quantification_type: v })}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="count">Comptage</SelectItem>
                    <SelectItem value="dimension">Dimension</SelectItem>
                    <SelectItem value="percentage">Pourcentage</SelectItem>
                    <SelectItem value="severity">Gravité</SelectItem>
                    <SelectItem value="none">Aucune</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Conditions</Label><Textarea value={editingDamage.liability_conditions} onChange={(e) => setEditingDamage({ ...editingDamage, liability_conditions: e.target.value })} className="mt-1" rows={2} /></div>
              <div><Label>Source légale</Label><Input value={editingDamage.liability_source} onChange={(e) => setEditingDamage({ ...editingDamage, liability_source: e.target.value })} className="mt-1" /></div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDamageDialog(false)}>Annuler</Button>
            <Button onClick={saveDamage} disabled={!editingDamage?.damage_type_id}><Check className="h-4 w-4 mr-2" />{editingDamage?.id ? 'Modifier' : 'Ajouter'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
