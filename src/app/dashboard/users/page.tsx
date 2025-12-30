'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase, Profile } from '@/lib/supabase'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Search, ChevronRight, User } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { fr } from 'date-fns/locale'

export default function UsersPage() {
  const router = useRouter()
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [filteredProfiles, setFilteredProfiles] = useState<Profile[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchProfiles = async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false })

      if (data) {
        setProfiles(data)
        setFilteredProfiles(data)
      }
      setLoading(false)
    }

    fetchProfiles()
  }, [])

  useEffect(() => {
    const filtered = profiles.filter((profile) => {
      const searchLower = searchQuery.toLowerCase()
      return (
        profile.email?.toLowerCase().includes(searchLower) ||
        profile.full_name?.toLowerCase().includes(searchLower) ||
        profile.company_name?.toLowerCase().includes(searchLower)
      )
    })
    setFilteredProfiles(filtered)
  }, [searchQuery, profiles])

  const getSubscriptionBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-green-100 text-green-700">Actif</Badge>
      case 'trialing':
        return <Badge className="bg-blue-100 text-blue-700">Essai</Badge>
      case 'canceled':
        return <Badge className="bg-red-100 text-red-700">Annulé</Badge>
      default:
        return <Badge variant="secondary">Gratuit</Badge>
    }
  }

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Utilisateurs</h1>
          <p className="text-muted-foreground">
            {profiles.length} utilisateurs enregistrés
          </p>
        </div>
      </div>

      {/* Search */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher par nom, email ou entreprise..."
              className="pl-10"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Users List */}
      <Card>
        <CardHeader>
          <CardTitle>Tous les utilisateurs</CardTitle>
          <CardDescription>
            Cliquez sur un utilisateur pour voir ses dossiers
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600"></div>
            </div>
          ) : filteredProfiles.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <User className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Aucun utilisateur trouvé</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredProfiles.map((profile) => (
                <div
                  key={profile.id}
                  onClick={() => router.push(`/dashboard/users/${profile.id}`)}
                  className="flex items-center gap-4 p-4 rounded-lg border hover:bg-accent transition-colors cursor-pointer group"
                >
                  <Avatar className="h-12 w-12">
                    <AvatarImage src={profile.avatar_url || ''} />
                    <AvatarFallback className="bg-teal-100 text-teal-700 text-lg">
                      {profile.full_name?.charAt(0) || profile.email?.charAt(0) || '?'}
                    </AvatarFallback>
                  </Avatar>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium truncate">
                        {profile.full_name || 'Sans nom'}
                      </p>
                      {profile.is_super_admin && (
                        <Badge variant="outline" className="text-xs">Admin</Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground truncate">
                      {profile.email}
                    </p>
                    {profile.company_name && (
                      <p className="text-sm text-muted-foreground truncate">
                        {profile.company_name}
                      </p>
                    )}
                  </div>

                  <div className="text-right">
                    {getSubscriptionBadge(profile.subscription_status)}
                    <p className="text-xs text-muted-foreground mt-1">
                      Inscrit {formatDistanceToNow(new Date(profile.created_at), { 
                        addSuffix: true, 
                        locale: fr 
                      })}
                    </p>
                  </div>

                  <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-foreground transition-colors" />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
