'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase, Mission, MissionData, MissionRoom, computeMissionStats } from '@/lib/supabase'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  ArrowLeft, 
  MapPin, 
  Calendar, 
  Clock,
  Building,
  User,
  Home,
  DoorOpen,
  Camera,
  Timer,
  FileText,
  Key,
  Gauge,
  Shield,
  Users,
  Phone,
  Mail,
  Ruler,
  Box,
  AlertTriangle,
  CheckCircle,
  XCircle
} from 'lucide-react'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'

export default function MissionDetailPage() {
  const params = useParams()
  const router = useRouter()
  const missionId = params.id as string
  
  const [mission, setMission] = useState<Mission | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchMission = async () => {
      const { data, error } = await supabase
        .from('missions')
        .select('*')
        .eq('id', missionId)
        .single()

      if (data) {
        setMission(data)
      }
      setLoading(false)
    }

    fetchMission()
  }, [missionId])

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge className="bg-green-100 text-green-700">Terminé</Badge>
      case 'inProgress':
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
        return <Badge className="bg-green-100 text-green-700">État des lieux d'entrée</Badge>
      case 'exit':
        return <Badge className="bg-red-100 text-red-700">État des lieux de sortie</Badge>
      case 'intermediate':
        return <Badge className="bg-orange-100 text-orange-700">État des lieux intermédiaire</Badge>
      default:
        return <Badge variant="outline">{type}</Badge>
    }
  }

  const formatTimeSpent = (seconds: number) => {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    if (hours > 0) {
      return `${hours}h ${minutes}min`
    }
    return `${minutes}min`
  }

  const getRoomStatusIcon = (status: string) => {
    switch (status) {
      case 'Complète':
        return <CheckCircle className="h-4 w-4 text-green-600" />
      case 'Incomplète':
        return <AlertTriangle className="h-4 w-4 text-orange-600" />
      default:
        return <XCircle className="h-4 w-4 text-gray-400" />
    }
  }

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600"></div>
      </div>
    )
  }

  if (!mission) {
    return (
      <div className="p-8">
        <div className="text-center py-12">
          <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <h2 className="text-xl font-semibold mb-2">Mission non trouvée</h2>
          <Button variant="outline" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Retour
          </Button>
        </div>
      </div>
    )
  }

  const data = mission.data as MissionData
  const stats = computeMissionStats(data)

  return (
    <div className="p-8">
      {/* Back button */}
      <Button 
        variant="ghost" 
        className="mb-6"
        onClick={() => router.back()}
      >
        <ArrowLeft className="h-4 w-4 mr-2" />
        Retour
      </Button>

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-2xl font-bold">
              {data.address?.fullAddress || 'Sans adresse'}
            </h1>
            {getStatusBadge(data.status)}
          </div>
          <div className="flex items-center gap-4 text-muted-foreground">
            {getTypeBadge(data.missionType)}
            <span className="flex items-center gap-1">
              <Calendar className="h-4 w-4" />
              {data.dateTime ? format(new Date(data.dateTime), 'dd MMMM yyyy à HH:mm', { locale: fr }) : 'Non planifié'}
            </span>
            <span>Réf: {mission.report_number}</span>
          </div>
        </div>
        
        {mission.pdf_url && (
          <Button asChild>
            <a href={mission.pdf_url} target="_blank" rel="noopener noreferrer">
              <FileText className="h-4 w-4 mr-2" />
              Voir le PDF
            </a>
          </Button>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-5 mb-6">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Pièces</p>
                <p className="text-2xl font-bold">{stats.totalRooms}</p>
              </div>
              <DoorOpen className="h-8 w-8 text-teal-600" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Photos</p>
                <p className="text-2xl font-bold">{stats.totalPhotos}</p>
              </div>
              <Camera className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Objets</p>
                <p className="text-2xl font-bold">{stats.totalObjects}</p>
              </div>
              <Box className="h-8 w-8 text-purple-600" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Temps passé</p>
                <p className="text-2xl font-bold">{formatTimeSpent(data.operatorData?.totalTimeSpent || 0)}</p>
              </div>
              <Timer className="h-8 w-8 text-orange-600" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Complétion</p>
                <p className="text-2xl font-bold">{stats.completionPercentage}%</p>
              </div>
              <div className="w-12 h-12 rounded-full border-4 border-teal-200 flex items-center justify-center">
                <span className="text-xs font-bold text-teal-600">{stats.completionPercentage}%</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="rooms">
        <TabsList>
          <TabsTrigger value="rooms">
            <DoorOpen className="h-4 w-4 mr-2" />
            Pièces ({data.rooms?.length || 0})
          </TabsTrigger>
          <TabsTrigger value="parties">
            <Users className="h-4 w-4 mr-2" />
            Parties ({data.parties?.length || 0})
          </TabsTrigger>
          <TabsTrigger value="counters">
            <Gauge className="h-4 w-4 mr-2" />
            Compteurs ({data.counters?.length || 0})
          </TabsTrigger>
          <TabsTrigger value="keys">
            <Key className="h-4 w-4 mr-2" />
            Clés ({data.keys?.length || 0})
          </TabsTrigger>
          <TabsTrigger value="security">
            <Shield className="h-4 w-4 mr-2" />
            Sécurité
          </TabsTrigger>
        </TabsList>

        {/* Rooms Tab */}
        <TabsContent value="rooms">
          <Card>
            <CardHeader>
              <CardTitle>Pièces inspectées</CardTitle>
              <CardDescription>Détail de chaque pièce avec mesures et objets détectés</CardDescription>
            </CardHeader>
            <CardContent>
              {data.rooms?.length === 0 ? (
                <p className="text-center py-8 text-muted-foreground">Aucune pièce ajoutée</p>
              ) : (
                <div className="space-y-4">
                  {data.rooms?.map((room: MissionRoom) => {
                    const roomPhotos = (room.wallPhotos?.length || 0) + 
                                       (room.floorPhotos?.length || 0) + 
                                       (room.ceilingPhotos?.length || 0) + 
                                       (room.equipmentPhotos?.length || 0)
                    
                    return (
                      <div key={room.id} className="p-4 rounded-lg border">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-3">
                            {getRoomStatusIcon(room.status)}
                            <div>
                              <h3 className="font-semibold">{room.name}</h3>
                              <p className="text-sm text-muted-foreground">
                                {room.captureMode} • Créé le {format(new Date(room.createdAt), 'dd/MM/yyyy HH:mm', { locale: fr })}
                              </p>
                            </div>
                          </div>
                          <Badge variant={room.status === 'Complète' ? 'default' : 'secondary'}>
                            {room.status}
                          </Badge>
                        </div>

                        <div className="grid grid-cols-4 gap-4 mb-3">
                          <div className="text-center p-2 bg-muted rounded">
                            <p className="text-lg font-semibold">{roomPhotos}</p>
                            <p className="text-xs text-muted-foreground">Photos</p>
                          </div>
                          <div className="text-center p-2 bg-muted rounded">
                            <p className="text-lg font-semibold">{room.detectedObjects?.length || 0}</p>
                            <p className="text-xs text-muted-foreground">Objets</p>
                          </div>
                          <div className="text-center p-2 bg-muted rounded">
                            <p className="text-lg font-semibold">{room.inventoryItems?.length || 0}</p>
                            <p className="text-xs text-muted-foreground">Inventaire</p>
                          </div>
                          <div className="text-center p-2 bg-muted rounded">
                            <p className="text-lg font-semibold">{room.audioNotes?.length || 0}</p>
                            <p className="text-xs text-muted-foreground">Notes audio</p>
                          </div>
                        </div>

                        {/* Measurements */}
                        {room.measurements && (
                          <div className="mt-3 p-3 bg-blue-50 rounded-lg">
                            <div className="flex items-center gap-2 mb-2">
                              <Ruler className="h-4 w-4 text-blue-600" />
                              <span className="font-medium text-blue-900">Mesures LiDAR</span>
                            </div>
                            <div className="grid grid-cols-3 gap-4 text-sm">
                              <div>
                                <span className="text-blue-600">Surface murs:</span>
                                <span className="ml-2 font-medium">{room.measurements.wallsArea?.toFixed(2)} m²</span>
                              </div>
                              {typeof room.measurements.floorArea === 'number' && (
                                <div>
                                  <span className="text-blue-600">Surface sol:</span>
                                  <span className="ml-2 font-medium">{room.measurements.floorArea.toFixed(2)} m²</span>
                                </div>
                              )}
                              {typeof room.measurements.ceilingArea === 'number' && (
                                <div>
                                  <span className="text-blue-600">Surface plafond:</span>
                                  <span className="ml-2 font-medium">{room.measurements.ceilingArea.toFixed(2)} m²</span>
                                </div>
                              )}
                            </div>
                            {room.measurements.walls && room.measurements.walls.length > 0 && (
                              <div className="mt-2 flex flex-wrap gap-2">
                                {room.measurements.walls.map((wall) => (
                                  <Badge key={wall.id} variant="outline" className="text-blue-700">
                                    {wall.label}: {wall.area.toFixed(2)} m²
                                  </Badge>
                                ))}
                              </div>
                            )}
                          </div>
                        )}

                        {/* Detected Objects */}
                        {room.detectedObjects && room.detectedObjects.length > 0 && (
                          <div className="mt-3">
                            <p className="text-sm font-medium mb-2">Objets détectés:</p>
                            <div className="flex flex-wrap gap-2">
                              {room.detectedObjects.map((obj: any, idx: number) => (
                                <Badge key={idx} variant="secondary">
                                  {obj.name || obj.object || 'Objet'}
                                  {obj.condition && ` - ${obj.condition}`}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Parties Tab */}
        <TabsContent value="parties">
          <Card>
            <CardHeader>
              <CardTitle>Parties prenantes</CardTitle>
              <CardDescription>Propriétaires, locataires et autres intervenants</CardDescription>
            </CardHeader>
            <CardContent>
              {data.parties?.length === 0 ? (
                <p className="text-center py-8 text-muted-foreground">Aucune partie ajoutée</p>
              ) : (
                <div className="grid gap-4 md:grid-cols-2">
                  {data.parties?.map((party) => (
                    <div key={party.id} className="p-4 rounded-lg border">
                      <div className="flex items-center gap-2 mb-3">
                        <Badge>{party.role}</Badge>
                        {party.isCompany && <Badge variant="outline">Société</Badge>}
                      </div>
                      
                      <h3 className="font-semibold mb-2">
                        {party.isCompany 
                          ? party.companyName 
                          : `${party.firstName} ${party.lastName}`.trim() || 'Non renseigné'
                        }
                      </h3>
                      
                      {party.isCompany && party.representativeFirstName && (
                        <p className="text-sm text-muted-foreground mb-2">
                          Représenté par: {party.representativeFirstName} {party.representativeLastName}
                        </p>
                      )}
                      
                      <div className="space-y-1 text-sm">
                        {party.email && (
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <Mail className="h-3 w-3" />
                            {party.email}
                          </div>
                        )}
                        {party.phone && (
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <Phone className="h-3 w-3" />
                            {party.phone}
                          </div>
                        )}
                        {party.street && (
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <MapPin className="h-3 w-3" />
                            {party.street} {party.number}, {party.postalCode} {party.city}
                          </div>
                        )}
                        {party.enterpriseNumber && (
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <Building className="h-3 w-3" />
                            BCE: {party.enterpriseNumber}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Counters Tab */}
        <TabsContent value="counters">
          <Card>
            <CardHeader>
              <CardTitle>Compteurs</CardTitle>
              <CardDescription>Relevés des compteurs d'eau, gaz et électricité</CardDescription>
            </CardHeader>
            <CardContent>
              {data.counters?.length === 0 ? (
                <p className="text-center py-8 text-muted-foreground">Aucun compteur ajouté</p>
              ) : (
                <div className="grid gap-4 md:grid-cols-3">
                  {data.counters?.map((counter: any, idx: number) => (
                    <div key={idx} className="p-4 rounded-lg border">
                      <div className="flex items-center gap-2 mb-2">
                        <Gauge className="h-5 w-5 text-teal-600" />
                        <span className="font-medium">{counter.type || 'Compteur'}</span>
                      </div>
                      <p className="text-2xl font-bold">{counter.value || '-'}</p>
                      {counter.ean && <p className="text-xs text-muted-foreground">EAN: {counter.ean}</p>}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Keys Tab */}
        <TabsContent value="keys">
          <Card>
            <CardHeader>
              <CardTitle>Clés et badges</CardTitle>
              <CardDescription>Inventaire des clés remises</CardDescription>
            </CardHeader>
            <CardContent>
              {data.keys?.length === 0 ? (
                <p className="text-center py-8 text-muted-foreground">Aucune clé ajoutée</p>
              ) : (
                <div className="grid gap-4 md:grid-cols-4">
                  {data.keys?.map((key: any, idx: number) => (
                    <div key={idx} className="p-4 rounded-lg border text-center">
                      <Key className="h-8 w-8 mx-auto mb-2 text-yellow-600" />
                      <p className="font-medium">{key.type || 'Clé'}</p>
                      <p className="text-2xl font-bold">{key.quantity || 1}</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Security Tab */}
        <TabsContent value="security">
          <Card>
            <CardHeader>
              <CardTitle>Sécurité</CardTitle>
              <CardDescription>Détecteurs de fumée et conformité régionale</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="p-4 rounded-lg border">
                  <div className="flex items-center gap-2 mb-2">
                    <MapPin className="h-5 w-5 text-blue-600" />
                    <span className="font-medium">Région</span>
                  </div>
                  <p className="text-lg">{data.security?.region || 'Non définie'}</p>
                </div>
                
                <div className="p-4 rounded-lg border">
                  <div className="flex items-center gap-2 mb-2">
                    <Shield className="h-5 w-5 text-red-600" />
                    <span className="font-medium">Détecteurs de fumée</span>
                  </div>
                  {data.security?.smokeDetectors?.length === 0 ? (
                    <p className="text-muted-foreground">Aucun détecteur ajouté</p>
                  ) : (
                    <div className="grid gap-2">
                      {data.security?.smokeDetectors?.map((detector: any, idx: number) => (
                        <div key={idx} className="flex items-center justify-between p-2 bg-muted rounded">
                          <span>{detector.location || `Détecteur ${idx + 1}`}</span>
                          <Badge variant={detector.working ? 'default' : 'destructive'}>
                            {detector.working ? 'Fonctionnel' : 'Non fonctionnel'}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
