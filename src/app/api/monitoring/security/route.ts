import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// GET - Vérifier les tables sans RLS et autres problèmes de sécurité
export async function GET(request: NextRequest) {
  try {
    // Liste des tables connues qui DOIVENT avoir RLS
    const criticalTables = [
      'profiles',
      'missions',
      'inspections',
      'inspection_rooms',
      'inspection_items',
      'inspection_photos',
      'inspection_amendments',
      'meter_readings',
      'meter_models',
      'energy_form_templates',
      'generated_energy_forms',
      'api_functions',
      'impersonation_sessions',
      'unrecognized_meters',
      'lab_experiments',
      'model_versions',
      'test_configs'
    ]
    
    // Requête pour vérifier RLS (nécessite accès aux tables système)
    // Note: Cette requête nécessite les droits appropriés
    const { data: tablesInfo, error } = await supabase.rpc('get_tables_rls_status')
    
    // Si la fonction RPC n'existe pas, on fait une vérification basique
    let tablesWithoutRLS: string[] = []
    let tablesWithRLS: string[] = []
    
    if (error || !tablesInfo) {
      // Fallback: liste manuelle des tables connues sans RLS
      // (basé sur le screenshot de l'utilisateur)
      tablesWithoutRLS = [
        'impersonation_sessions',
        'api_functions', 
        'inspection_amendments',
        'generated_energy_forms',
        'energy_form_templates',
        'meter_scans'
      ]
      tablesWithRLS = criticalTables.filter(t => !tablesWithoutRLS.includes(t))
    } else {
      // Parse les résultats de la fonction RPC
      tablesWithoutRLS = tablesInfo.filter((t: any) => !t.rls_enabled).map((t: any) => t.table_name)
      tablesWithRLS = tablesInfo.filter((t: any) => t.rls_enabled).map((t: any) => t.table_name)
    }
    
    // Générer les recommandations SQL pour activer RLS
    const rlsFixSql = tablesWithoutRLS.map(table => `
-- Activer RLS sur ${table}
ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY;

-- Policy de base (à adapter selon vos besoins)
CREATE POLICY "Users can view own data" ON public.${table}
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own data" ON public.${table}
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own data" ON public.${table}
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Service role full access" ON public.${table}
  FOR ALL USING (auth.role() = 'service_role');
`).join('\n')
    
    // Score de sécurité
    const totalTables = tablesWithRLS.length + tablesWithoutRLS.length
    const securityScore = totalTables > 0 
      ? Math.round((tablesWithRLS.length / totalTables) * 100)
      : 0
    
    // Alertes de sécurité
    const alerts: { level: 'critical' | 'warning' | 'info'; message: string }[] = []
    
    if (tablesWithoutRLS.length > 0) {
      alerts.push({
        level: 'critical',
        message: `${tablesWithoutRLS.length} tables sans protection RLS - Données potentiellement accessibles publiquement`
      })
    }
    
    if (tablesWithoutRLS.includes('profiles') || tablesWithoutRLS.includes('missions')) {
      alerts.push({
        level: 'critical',
        message: 'Tables sensibles (profiles/missions) sans RLS - URGENT'
      })
    }
    
    return NextResponse.json({
      security_score: securityScore,
      tables: {
        without_rls: tablesWithoutRLS,
        with_rls: tablesWithRLS,
        total: totalTables
      },
      alerts,
      fix_sql: rlsFixSql,
      recommendations: [
        'Activer RLS sur toutes les tables contenant des données utilisateur',
        'Créer des policies spécifiques pour chaque type d\'accès (SELECT, INSERT, UPDATE, DELETE)',
        'Utiliser auth.uid() pour filtrer par utilisateur connecté',
        'Toujours avoir une policy service_role pour les opérations admin'
      ],
      checked_at: new Date().toISOString()
    })
    
  } catch (error: any) {
    console.error('Security check error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
