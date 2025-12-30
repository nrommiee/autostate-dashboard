'use client'

import { useEffect, useState } from 'react'
import { supabase, PropertySuggestion } from '@/lib/supabase'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  Check, 
  X, 
  Lightbulb, 
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { fr } from 'date-fns/locale'

export default function SuggestionsPage() {
  const [suggestions, setSuggestions] = useState<PropertySuggestion[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('pending')

  useEffect(() => {
    fetchSuggestions()
  }, [])

  const fetchSuggestions = async () => {
    const { data, error } = await supabase
      .from('property_suggestions')
      .select('*')
      .order('created_at', { ascending: false })

    if (data) {
      setSuggestions(data)
    }
    setLoading(false)
  }

  const updateSuggestionStatus = async (id: string, status: 'approved' | 'rejected') => {
    const { error } = await supabase
      .from('property_suggestions')
      .update({ status })
      .eq('id', id)

    if (!error) {
      setSuggestions(prev => 
        prev.map(s => s.id === id ? { ...s, status } : s)
      )
    }
  }

  const filteredSuggestions = suggestions.filter(s => {
    if (activeTab === 'pending') return s.status === 'pending'
    if (activeTab === 'approved') return s.status === 'approved'
    if (activeTab === 'rejected') return s.status === 'rejected'
    return true
  })

  const pendingCount = suggestions.filter(s => s.status === 'pending').length
  const approvedCount = suggestions.filter(s => s.status === 'approved').length
  const rejectedCount = suggestions.filter(s => s.status === 'rejected').length

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'approved':
        return <CheckCircle className="h-4 w-4 text-green-600" />
      case 'rejected':
        return <XCircle className="h-4 w-4 text-red-600" />
      default:
        return <Clock className="h-4 w-4 text-orange-600" />
    }
  }

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Suggestions</h1>
        <p className="text-muted-foreground">
          Validez les nouvelles propriétés d'objets suggérées par les utilisateurs
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-3 mb-6">
        <Card className="border-orange-200 bg-orange-50">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-orange-700">En attente</p>
                <p className="text-3xl font-bold text-orange-900">{pendingCount}</p>
              </div>
              <Clock className="h-8 w-8 text-orange-600" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-green-200 bg-green-50">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-green-700">Approuvées</p>
                <p className="text-3xl font-bold text-green-900">{approvedCount}</p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-red-700">Rejetées</p>
                <p className="text-3xl font-bold text-red-900">{rejectedCount}</p>
              </div>
              <XCircle className="h-8 w-8 text-red-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="pending" className="gap-2">
            <Clock className="h-4 w-4" />
            En attente
            {pendingCount > 0 && (
              <Badge variant="secondary" className="ml-1">{pendingCount}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="approved" className="gap-2">
            <CheckCircle className="h-4 w-4" />
            Approuvées
          </TabsTrigger>
          <TabsTrigger value="rejected" className="gap-2">
            <XCircle className="h-4 w-4" />
            Rejetées
          </TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab}>
          <Card>
            <CardContent className="pt-6">
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600"></div>
                </div>
              ) : filteredSuggestions.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Lightbulb className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Aucune suggestion {activeTab === 'pending' ? 'en attente' : ''}</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredSuggestions.map((suggestion) => (
                    <div
                      key={suggestion.id}
                      className="flex items-center gap-4 p-4 rounded-lg border"
                    >
                      <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
                        <Lightbulb className="h-5 w-5 text-purple-700" />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-medium">
                            {suggestion.property_name}
                          </p>
                          {getStatusIcon(suggestion.status)}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Pour: <span className="font-medium">{suggestion.object_template_name}</span>
                        </p>
                        {suggestion.property_value && (
                          <p className="text-sm text-muted-foreground">
                            Exemple: "{suggestion.property_value}"
                          </p>
                        )}
                        <p className="text-xs text-muted-foreground mt-1">
                          Suggéré {formatDistanceToNow(new Date(suggestion.created_at), { 
                            addSuffix: true, 
                            locale: fr 
                          })}
                          {suggestion.usage_count > 1 && (
                            <span className="ml-2">• Utilisé {suggestion.usage_count}x</span>
                          )}
                        </p>
                      </div>

                      {suggestion.status === 'pending' && (
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-green-600 hover:text-green-700 hover:bg-green-50"
                            onClick={() => updateSuggestionStatus(suggestion.id, 'approved')}
                          >
                            <Check className="h-4 w-4 mr-1" />
                            Approuver
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            onClick={() => updateSuggestionStatus(suggestion.id, 'rejected')}
                          >
                            <X className="h-4 w-4 mr-1" />
                            Rejeter
                          </Button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
