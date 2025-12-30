'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase, Profile, Inspection } from '@/lib/supabase'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  ArrowLeft, 
  FolderOpen, 
  MapPin, 
  Calendar, 
  Clock,
  Building,
  Mail,
  Phone,
  User
} from 'lucide-react'
import { formatDistanceToNow, format } from 'date-fns'
import { fr } from 'date-fns/locale'

export default function UserDetailPage() {
  const params = useParams()
  const router = useRouter()
  const userId = params.id as string
  
  const [profile, setProfile] = useState<Profile | null>(null)
  const [inspections, setInspections] = useState<Inspection[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      // Fetch profile
      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single()

      if (profileData) {
        setProfile(profileData)
      }

      // Fetch inspections
      const { data: inspectionsData } = await supabase
        .from('inspections')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })

      if (inspectionsData) {
        setInspections(inspectionsData)
      }

      setLoading(false)
    }

    fetchData()
  }, [userId])

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge className="bg-green-100 text-green-700">Terminé</Badge>
      case 'in_progress':
        return <Badge className="bg-blue-100 text-blue-700">En cours</Badge>
      case 'draft':
        return <Badge variant="secondary">Brouillon</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  const getTypeBadge = (type: string) => {
    switch (type) {
      case 'entry':
        return <Badge variant="outline" className="border-green-300 text-green-700">Entrée</Badge>
      case 'exit':
        return <Badge variant="outline" className="border-red-300 text-red-700">Sortie</Badge>
      default:
        return <Badge variant="outline">{type}</Badge>
    }
  }

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600"></div>
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="p-8">
        <div className="text-center py-12">
          <User className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <h2 className="text-xl font-semibold mb-2">Utilisateur non trouvé</h2>
          <Button variant="outline" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Retour
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="p-8">
      {/* Back button */}
      <Button 
        variant="ghost" 
        className="mb-6"
        onClick={() => router.push('/dashboard/users')}
      >
        <ArrowLeft className="h-4 w-4 mr-2" />
        Retour aux utilisateurs
      </Button>

      {/* Profile Header */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="flex items-start gap-6">
            <Avatar className="h-20 w-20">
              <AvatarImage src={profile.avatar_url || ''} />
              <AvatarFallback className="bg-teal-100 text-teal-700 text-2xl">
                {profile.full_name?.charAt(0) || profile.email?.charAt(0) || '?'}
              </AvatarFallback>
            </Avatar>

            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-2xl font-bold">
                  {profile.full_name || 'Sans nom'}
                </h1>
                {profile.is_super_admin && (
                  <Badge>Super Admin</Badge>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Mail className="h-4 w-4" />
                  {profile.email}
                </div>
                {profile.company_name && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Building className="h-4 w-4" />
                    {profile.company_name}
                  </div>
                )}
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Calendar className="h-4 w-4" />
                  Inscrit le {format(new Date(profile.created_at), 'dd MMMM yyyy', { locale: fr })}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">Abonnement:</span>
                  {profile.subscription_status === 'active' ? (
                    <Badge className="bg-green-100 text-green-700">Actif</Badge>
                  ) : (
                    <Badge variant="secondary">Gratuit</Badge>
                  )}
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Inspections */}
      <Tabs defaultValue="inspections">
        <TabsList>
          <TabsTrigger value="inspections">
            Dossiers ({inspections.length})
          </TabsTrigger>
          <TabsTrigger value="activity">
            Activité
          </TabsTrigger>
        </TabsList>

        <TabsContent value="inspections">
          <Card>
            <CardHeader>
              <CardTitle>États des lieux</CardTitle>
              <CardDescription>
                Tous les dossiers créés par cet utilisateur
              </CardDescription>
            </CardHeader>
            <CardContent>
              {inspections.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <FolderOpen className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Aucun dossier créé</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {inspections.map((inspection) => (
                    <div
                      key={inspection.id}
                      className="flex items-center gap-4 p-4 rounded-lg border hover:bg-accent/50 transition-colors"
                    >
                      <div className="w-12 h-12 rounded-lg bg-teal-100 flex items-center justify-center">
                        <FolderOpen className="h-6 w-6 text-teal-700" />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-medium truncate">
                            {inspection.address || 'Sans adresse'}
                          </p>
                          {getTypeBadge(inspection.type)}
                        </div>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {format(new Date(inspection.created_at), 'dd/MM/yyyy', { locale: fr })}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {formatDistanceToNow(new Date(inspection.updated_at), { 
                              addSuffix: true, 
                              locale: fr 
                            })}
                          </span>
                        </div>
                      </div>

                      <div className="text-right">
                        {getStatusBadge(inspection.status)}
                        <p className="text-xs text-muted-foreground mt-1">
                          {inspection.sync_status === 'synced' ? '✓ Synchronisé' : 'Non sync'}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="activity">
          <Card>
            <CardHeader>
              <CardTitle>Activité récente</CardTitle>
              <CardDescription>
                Journal des actions de l'utilisateur
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12 text-muted-foreground">
                <p>Bientôt disponible</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
