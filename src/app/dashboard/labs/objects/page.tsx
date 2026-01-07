'use client'

import { Card } from '@/components/ui/card'
import { Eye, Construction } from 'lucide-react'

export default function LabsObjectsPage() {
  return (
    <div className="space-y-6">
      <Card className="p-12 text-center">
        <div className="max-w-md mx-auto">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Eye className="h-8 w-8 text-green-600" />
          </div>
          <h3 className="text-lg font-semibold mb-2">Vision Objets</h3>
          <p className="text-gray-500 mb-4">
            Module de test pour la détection et l'identification des objets et équipements 
            dans les photos de pièces (électroménager, meubles, équipements...).
          </p>
          <div className="flex items-center justify-center gap-2 text-orange-600 bg-orange-50 rounded-lg p-3">
            <Construction className="h-5 w-5" />
            <span className="text-sm font-medium">En cours de développement</span>
          </div>
        </div>
      </Card>

      <div className="grid md:grid-cols-3 gap-4">
        <Card className="p-4 bg-gray-50">
          <h4 className="font-medium mb-2">Fonctionnalités prévues</h4>
          <ul className="text-sm text-gray-600 space-y-1">
            <li>• Détection multi-objets</li>
            <li>• Classification par catégorie</li>
            <li>• Estimation de l'état</li>
            <li>• Bounding boxes visuels</li>
          </ul>
        </Card>
        <Card className="p-4 bg-gray-50">
          <h4 className="font-medium mb-2">Cas d'usage</h4>
          <ul className="text-sm text-gray-600 space-y-1">
            <li>• Inventaire automatique</li>
            <li>• État des lieux meublé</li>
            <li>• Détection d'anomalies</li>
            <li>• Comparaison entrée/sortie</li>
          </ul>
        </Card>
        <Card className="p-4 bg-gray-50">
          <h4 className="font-medium mb-2">Intégration</h4>
          <ul className="text-sm text-gray-600 space-y-1">
            <li>• App iOS AutoState</li>
            <li>• API publique</li>
            <li>• Rapport PDF</li>
            <li>• Base de données objets</li>
          </ul>
        </Card>
      </div>
    </div>
  )
}
