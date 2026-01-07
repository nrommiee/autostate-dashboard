'use client'

import { Card } from '@/components/ui/card'
import { Hammer, Construction } from 'lucide-react'

export default function LabsDamagesPage() {
  return (
    <div className="space-y-6">
      <Card className="p-12 text-center">
        <div className="max-w-md mx-auto">
          <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Hammer className="h-8 w-8 text-orange-600" />
          </div>
          <h3 className="text-lg font-semibold mb-2">Valorisation des Dégâts</h3>
          <p className="text-gray-500 mb-4">
            Module de test pour l'estimation automatique des coûts de réparation 
            basée sur l'analyse visuelle des dégâts et la base de connaissances légale.
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
            <li>• Détection automatique des dégâts</li>
            <li>• Classification par type</li>
            <li>• Estimation du coût</li>
            <li>• Grille de vétusté intégrée</li>
          </ul>
        </Card>
        <Card className="p-4 bg-gray-50">
          <h4 className="font-medium mb-2">Types de dégâts</h4>
          <ul className="text-sm text-gray-600 space-y-1">
            <li>• Trous, impacts, fissures</li>
            <li>• Taches, traces, salissures</li>
            <li>• Usure anormale</li>
            <li>• Équipements manquants</li>
          </ul>
        </Card>
        <Card className="p-4 bg-gray-50">
          <h4 className="font-medium mb-2">Sources de données</h4>
          <ul className="text-sm text-gray-600 space-y-1">
            <li>• Base légale belge</li>
            <li>• Grilles régionales</li>
            <li>• Prix du marché</li>
            <li>• Historique validé</li>
          </ul>
        </Card>
      </div>
    </div>
  )
}
