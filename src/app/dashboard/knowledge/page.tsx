'use client'

import { useState, useMemo } from 'react'
import { 
  Book, 
  Search, 
  Filter, 
  Download,
  ExternalLink,
  ChevronRight,
  ChevronDown,
  Scale,
  Home,
  User,
  Info,
  FileText,
  MapPin
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  ALL_REPAIRS,
  LEGAL_CATEGORIES,
  LEGAL_SOURCES,
  type Region,
  type RepairResponsibility,
  getRegionDisplayName,
  getRegionFlag,
  getRegionFromPostalCode,
  getCategoryStats,
} from '@/lib/legal-knowledge'

export default function KnowledgePage() {
  const [selectedRegion, setSelectedRegion] = useState<Region | 'all'>('all')
  const [selectedCategory, setSelectedCategory] = useState<string | 'all'>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [expandedCategories, setExpandedCategories] = useState<string[]>([])
  const [postalCodeInput, setPostalCodeInput] = useState('')
  const [detectedRegion, setDetectedRegion] = useState<Region | null>(null)

  // Filter repairs based on selection
  const filteredRepairs = useMemo(() => {
    let repairs = ALL_REPAIRS

    if (selectedRegion !== 'all') {
      repairs = repairs.filter(r => r.region === selectedRegion)
    }

    if (selectedCategory !== 'all') {
      repairs = repairs.filter(r => r.category === selectedCategory)
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      repairs = repairs.filter(r =>
        r.item.toLowerCase().includes(query) ||
        r.landlordResponsibility.toLowerCase().includes(query) ||
        r.tenantResponsibility.toLowerCase().includes(query)
      )
    }

    return repairs
  }, [selectedRegion, selectedCategory, searchQuery])

  // Group repairs by category
  const repairsByCategory = useMemo(() => {
    const grouped: Record<string, RepairResponsibility[]> = {}
    filteredRepairs.forEach(repair => {
      if (!grouped[repair.category]) {
        grouped[repair.category] = []
      }
      grouped[repair.category].push(repair)
    })
    return grouped
  }, [filteredRepairs])

  const toggleCategory = (categoryId: string) => {
    setExpandedCategories(prev =>
      prev.includes(categoryId)
        ? prev.filter(id => id !== categoryId)
        : [...prev, categoryId]
    )
  }

  const handlePostalCodeLookup = () => {
    const region = getRegionFromPostalCode(postalCodeInput)
    setDetectedRegion(region)
    if (region) {
      setSelectedRegion(region)
    }
  }

  const totalWallonia = ALL_REPAIRS.filter(r => r.region === 'wallonia').length
  const totalBrussels = ALL_REPAIRS.filter(r => r.region === 'brussels').length

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Book className="h-6 w-6 text-teal-600" />
            Base de connaissances EDL
          </h1>
          <p className="text-muted-foreground mt-1">
            Répartition des réparations entre bailleur et locataire selon la législation belge
          </p>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-teal-100 rounded-lg">
                <Scale className="h-6 w-6 text-teal-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{ALL_REPAIRS.length}</p>
                <p className="text-sm text-muted-foreground">Éléments référencés</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-amber-100 rounded-lg">
                <span className="text-2xl">🐓</span>
              </div>
              <div>
                <p className="text-2xl font-bold">{totalWallonia}</p>
                <p className="text-sm text-muted-foreground">Règles Wallonie</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-blue-100 rounded-lg">
                <span className="text-2xl">🏛️</span>
              </div>
              <div>
                <p className="text-2xl font-bold">{totalBrussels}</p>
                <p className="text-sm text-muted-foreground">Règles Bruxelles</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-purple-100 rounded-lg">
                <FileText className="h-6 w-6 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{LEGAL_SOURCES.length}</p>
                <p className="text-sm text-muted-foreground">Sources officielles</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Postal Code Lookup */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <MapPin className="h-4 w-4" />
            Détection automatique de la région
          </CardTitle>
          <CardDescription>
            Entrez le code postal du bien pour déterminer la législation applicable
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2 items-center">
            <Input
              placeholder="Code postal (ex: 4000)"
              value={postalCodeInput}
              onChange={(e) => setPostalCodeInput(e.target.value)}
              className="max-w-[200px]"
              onKeyDown={(e) => e.key === 'Enter' && handlePostalCodeLookup()}
            />
            <Button onClick={handlePostalCodeLookup} variant="secondary">
              Détecter
            </Button>
            {detectedRegion && (
              <Badge variant="outline" className="ml-2 flex items-center gap-1">
                {getRegionFlag(detectedRegion)} {getRegionDisplayName(detectedRegion)}
              </Badge>
            )}
            {postalCodeInput && detectedRegion === null && (
              <Badge variant="destructive" className="ml-2">
                Code postal non reconnu
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Main Content */}
      <Tabs defaultValue="browse" className="space-y-4">
        <TabsList>
          <TabsTrigger value="browse">Parcourir</TabsTrigger>
          <TabsTrigger value="sources">Sources officielles</TabsTrigger>
        </TabsList>

        {/* Browse Tab */}
        <TabsContent value="browse" className="space-y-4">
          {/* Filters */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-wrap gap-4">
                <div className="flex-1 min-w-[200px]">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Rechercher (ex: robinet, chaudière, mur...)"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>

                <Select value={selectedRegion} onValueChange={(v) => setSelectedRegion(v as Region | 'all')}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Région" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Toutes les régions</SelectItem>
                    <SelectItem value="wallonia">🐓 Wallonie</SelectItem>
                    <SelectItem value="brussels">🏛️ Bruxelles</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="Catégorie" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Toutes les catégories</SelectItem>
                    {LEGAL_CATEGORIES.map(cat => (
                      <SelectItem key={cat.id} value={cat.id}>
                        {cat.icon} {cat.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Results */}
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              {filteredRepairs.length} élément(s) trouvé(s)
            </p>

            {Object.entries(repairsByCategory).map(([categoryId, repairs]) => {
              const category = LEGAL_CATEGORIES.find(c => c.id === categoryId)
              if (!category) return null

              const isExpanded = expandedCategories.includes(categoryId)

              return (
                <Card key={categoryId}>
                  <button
                    onClick={() => toggleCategory(categoryId)}
                    className="w-full px-6 py-4 flex items-center justify-between hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{category.icon}</span>
                      <div className="text-left">
                        <h3 className="font-semibold">{category.name}</h3>
                        <p className="text-sm text-muted-foreground">
                          {repairs.length} élément(s)
                        </p>
                      </div>
                    </div>
                    {isExpanded ? (
                      <ChevronDown className="h-5 w-5 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-5 w-5 text-muted-foreground" />
                    )}
                  </button>

                  {isExpanded && (
                    <CardContent className="pt-0 pb-4">
                      <div className="border-t pt-4 space-y-4">
                        {repairs.map((repair) => (
                          <RepairCard key={repair.id} repair={repair} />
                        ))}
                      </div>
                    </CardContent>
                  )}
                </Card>
              )
            })}

            {filteredRepairs.length === 0 && (
              <Card>
                <CardContent className="py-12 text-center">
                  <Search className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
                  <h3 className="font-semibold mb-2">Aucun résultat</h3>
                  <p className="text-sm text-muted-foreground">
                    Essayez de modifier vos critères de recherche
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        {/* Sources Tab */}
        <TabsContent value="sources" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {LEGAL_SOURCES.map((source) => (
              <Card key={source.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">
                        {source.region === 'wallonia' ? '🐓' : '🏛️'}
                      </span>
                      <div>
                        <CardTitle className="text-base">{source.title}</CardTitle>
                        <CardDescription>{source.source}</CardDescription>
                      </div>
                    </div>
                    <Badge variant="outline">
                      {new Date(source.publicationDate).toLocaleDateString('fr-BE')}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-4">
                    {source.officialTitle}
                  </p>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" asChild>
                      <a href={source.url} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="h-4 w-4 mr-2" />
                        Source officielle
                      </a>
                    </Button>
                    {source.pdfStoragePath && (
                      <Button variant="outline" size="sm">
                        <Download className="h-4 w-4 mr-2" />
                        Télécharger PDF
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Additional Resources */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Ressources complémentaires</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <a
                  href="https://logement.wallonie.be/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                >
                  <div className="p-2 bg-amber-100 rounded-lg">
                    <span className="text-xl">🐓</span>
                  </div>
                  <div>
                    <p className="font-medium text-sm">Logement Wallonie</p>
                    <p className="text-xs text-muted-foreground">Site officiel</p>
                  </div>
                  <ExternalLink className="h-4 w-4 text-muted-foreground ml-auto" />
                </a>

                <a
                  href="https://logement.brussels/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                >
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <span className="text-xl">🏛️</span>
                  </div>
                  <div>
                    <p className="font-medium text-sm">Logement Brussels</p>
                    <p className="text-xs text-muted-foreground">Site officiel</p>
                  </div>
                  <ExternalLink className="h-4 w-4 text-muted-foreground ml-auto" />
                </a>

                <a
                  href="https://www.ejustice.just.fgov.be/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                >
                  <div className="p-2 bg-gray-100 rounded-lg">
                    <Scale className="h-5 w-5 text-gray-600" />
                  </div>
                  <div>
                    <p className="font-medium text-sm">Moniteur Belge</p>
                    <p className="text-xs text-muted-foreground">Législation officielle</p>
                  </div>
                  <ExternalLink className="h-4 w-4 text-muted-foreground ml-auto" />
                </a>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

// Repair Card Component
function RepairCard({ repair }: { repair: RepairResponsibility }) {
  return (
    <div className="p-4 rounded-lg border bg-card">
      <div className="flex items-start justify-between mb-3">
        <div>
          <h4 className="font-medium">{repair.item}</h4>
          {repair.subcategory && (
            <p className="text-xs text-muted-foreground">{repair.subcategory}</p>
          )}
        </div>
        <Badge variant="outline" className="flex items-center gap-1">
          {repair.region === 'wallonia' ? '🐓' : '🏛️'}
          {repair.region === 'wallonia' ? 'Wallonie' : 'Bruxelles'}
        </Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Landlord */}
        <div className="p-3 rounded-lg bg-blue-50 border border-blue-100">
          <div className="flex items-center gap-2 mb-2">
            <Home className="h-4 w-4 text-blue-600" />
            <span className="text-sm font-medium text-blue-900">Bailleur (propriétaire)</span>
          </div>
          <p className="text-sm text-blue-800">
            {repair.landlordResponsibility || (
              <span className="italic text-blue-600">Aucune obligation spécifique</span>
            )}
          </p>
        </div>

        {/* Tenant */}
        <div className="p-3 rounded-lg bg-amber-50 border border-amber-100">
          <div className="flex items-center gap-2 mb-2">
            <User className="h-4 w-4 text-amber-600" />
            <span className="text-sm font-medium text-amber-900">Locataire (preneur)</span>
          </div>
          <p className="text-sm text-amber-800">
            {repair.tenantResponsibility || (
              <span className="italic text-amber-600">Aucune obligation spécifique</span>
            )}
          </p>
        </div>
      </div>

      {repair.notes && (
        <div className="mt-3 p-3 rounded-lg bg-red-50 border border-red-100">
          <div className="flex items-start gap-2">
            <Info className="h-4 w-4 text-red-600 mt-0.5 shrink-0" />
            <p className="text-sm text-red-800">{repair.notes}</p>
          </div>
        </div>
      )}
    </div>
  )
}
