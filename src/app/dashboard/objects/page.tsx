'use client'

import { useEffect, useState } from 'react'
import { supabase, ObjectTemplate } from '@/lib/supabase'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { 
  Search, 
  Plus,
  Boxes,
  Check,
  Clock,
  MoreHorizontal,
  Flame,
  Zap,
  Droplet,
  Sofa,
  DoorOpen
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { fr } from 'date-fns/locale'

const categoryIcons: Record<string, React.ReactNode> = {
  'Chauffage / Ventilation': <Flame className="h-4 w-4" />,
  'Électricité': <Zap className="h-4 w-4" />,
  'Plomberie': <Droplet className="h-4 w-4" />,
  'Mobilier': <Sofa className="h-4 w-4" />,
  'Porte & Fenêtre': <DoorOpen className="h-4 w-4" />,
}

const categoryColors: Record<string, string> = {
  'Chauffage / Ventilation': 'bg-red-100 text-red-700',
  'Électricité': 'bg-orange-100 text-orange-700',
  'Plomberie': 'bg-blue-100 text-blue-700',
  'Mobilier': 'bg-amber-100 text-amber-700',
  'Porte & Fenêtre': 'bg-indigo-100 text-indigo-700',
  'Électroménager': 'bg-cyan-100 text-cyan-700',
  'Mur, Sol & Plafond': 'bg-gray-100 text-gray-700',
}

export default function ObjectsPage() {
  const [objects, setObjects] = useState<ObjectTemplate[]>([])
  const [filteredObjects, setFilteredObjects] = useState<ObjectTemplate[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchObjects = async () => {
      const { data, error } = await supabase
        .from('object_templates')
        .select('*')
        .order('usage_count', { ascending: false })

      if (data) {
        setObjects(data)
        setFilteredObjects(data)
      }
      setLoading(false)
    }

    fetchObjects()
  }, [])

  useEffect(() => {
    const filtered = objects.filter((obj) => {
      const searchLower = searchQuery.toLowerCase()
      return (
        obj.name.toLowerCase().includes(searchLower) ||
        obj.category.toLowerCase().includes(searchLower)
      )
    })
    setFilteredObjects(filtered)
  }, [searchQuery, objects])

  const groupedByCategory = filteredObjects.reduce((acc, obj) => {
    if (!acc[obj.category]) {
      acc[obj.category] = []
    }
    acc[obj.category].push(obj)
    return acc
  }, {} as Record<string, ObjectTemplate[]>)

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Objets</h1>
          <p className="text-muted-foreground">
            {objects.length} templates d'objets
          </p>
        </div>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Ajouter un objet
        </Button>
      </div>

      {/* Search */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher un objet ou une catégorie..."
              className="pl-10"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Objects by Category */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600"></div>
        </div>
      ) : Object.keys(groupedByCategory).length === 0 ? (
        <Card>
          <CardContent className="py-12">
            <div className="text-center text-muted-foreground">
              <Boxes className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Aucun objet trouvé</p>
              <p className="text-sm mt-2">
                Les objets créés par les utilisateurs apparaîtront ici
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {Object.entries(groupedByCategory).map(([category, items]) => (
            <Card key={category}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <span className={`p-2 rounded-lg ${categoryColors[category] || 'bg-gray-100 text-gray-700'}`}>
                    {categoryIcons[category] || <Boxes className="h-4 w-4" />}
                  </span>
                  {category}
                  <Badge variant="secondary" className="ml-2">
                    {items.length}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                  {items.map((obj) => (
                    <div
                      key={obj.id}
                      className="p-4 rounded-lg border hover:bg-accent/50 transition-colors cursor-pointer"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <h3 className="font-medium">{obj.name}</h3>
                        {obj.is_approved ? (
                          <Check className="h-4 w-4 text-green-600" />
                        ) : (
                          <Clock className="h-4 w-4 text-orange-600" />
                        )}
                      </div>
                      
                      {obj.default_materials?.length > 0 && (
                        <div className="flex flex-wrap gap-1 mb-2">
                          {obj.default_materials.slice(0, 3).map((mat) => (
                            <Badge key={mat} variant="outline" className="text-xs">
                              {mat}
                            </Badge>
                          ))}
                          {obj.default_materials.length > 3 && (
                            <Badge variant="outline" className="text-xs">
                              +{obj.default_materials.length - 3}
                            </Badge>
                          )}
                        </div>
                      )}
                      
                      {obj.default_properties?.length > 0 && (
                        <p className="text-xs text-muted-foreground mb-2">
                          Propriétés: {obj.default_properties.join(', ')}
                        </p>
                      )}
                      
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>Utilisé {obj.usage_count}x</span>
                        <span>
                          {formatDistanceToNow(new Date(obj.created_at), { 
                            addSuffix: true, 
                            locale: fr 
                          })}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
