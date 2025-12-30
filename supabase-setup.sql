-- ============================================
-- AutoState Dashboard - Tables SQL
-- À exécuter dans Supabase SQL Editor
-- ============================================

-- ============================================
-- 1. TABLE: object_templates
-- Templates d'objets validés pour l'encodage
-- ============================================

CREATE TABLE IF NOT EXISTS object_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    default_materials TEXT[] DEFAULT '{}',
    default_properties TEXT[] DEFAULT '{}',
    is_approved BOOLEAN DEFAULT false,
    usage_count INTEGER DEFAULT 0,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index pour recherche rapide
CREATE INDEX IF NOT EXISTS idx_object_templates_category ON object_templates(category);
CREATE INDEX IF NOT EXISTS idx_object_templates_name ON object_templates(name);
CREATE INDEX IF NOT EXISTS idx_object_templates_approved ON object_templates(is_approved);

-- ============================================
-- 2. TABLE: property_suggestions
-- Suggestions de propriétés par les utilisateurs
-- ============================================

CREATE TABLE IF NOT EXISTS property_suggestions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    object_template_id UUID REFERENCES object_templates(id) ON DELETE SET NULL,
    object_template_name TEXT NOT NULL,
    property_name TEXT NOT NULL,
    property_value TEXT,
    suggested_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    usage_count INTEGER DEFAULT 1,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    reviewed_by UUID REFERENCES auth.users(id),
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index
CREATE INDEX IF NOT EXISTS idx_property_suggestions_status ON property_suggestions(status);
CREATE INDEX IF NOT EXISTS idx_property_suggestions_object ON property_suggestions(object_template_name);

-- ============================================
-- 3. TABLE: detected_objects_log
-- Log de tous les objets détectés (pour analytics)
-- ============================================

CREATE TABLE IF NOT EXISTS detected_objects_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    inspection_id UUID,
    room_id UUID,
    room_name TEXT,
    object_name TEXT NOT NULL,
    category TEXT,
    material TEXT,
    color TEXT,
    condition TEXT,
    extra_properties JSONB DEFAULT '{}',
    ai_confidence FLOAT,
    template_id UUID REFERENCES object_templates(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index
CREATE INDEX IF NOT EXISTS idx_detected_objects_user ON detected_objects_log(user_id);
CREATE INDEX IF NOT EXISTS idx_detected_objects_name ON detected_objects_log(object_name);
CREATE INDEX IF NOT EXISTS idx_detected_objects_created ON detected_objects_log(created_at DESC);

-- ============================================
-- 4. Ajouter colonne is_super_admin à profiles
-- ============================================

ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS is_super_admin BOOLEAN DEFAULT false;

-- ============================================
-- 5. RLS Policies
-- ============================================

-- Enable RLS
ALTER TABLE object_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE property_suggestions ENABLE ROW LEVEL SECURITY;
ALTER TABLE detected_objects_log ENABLE ROW LEVEL SECURITY;

-- Object Templates: tout le monde peut lire, seuls les admins peuvent modifier
CREATE POLICY "Anyone can read approved templates"
    ON object_templates FOR SELECT
    USING (is_approved = true OR auth.uid() IN (SELECT id FROM profiles WHERE is_super_admin = true));

CREATE POLICY "Admins can insert templates"
    ON object_templates FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() IN (SELECT id FROM profiles WHERE is_super_admin = true));

CREATE POLICY "Admins can update templates"
    ON object_templates FOR UPDATE
    TO authenticated
    USING (auth.uid() IN (SELECT id FROM profiles WHERE is_super_admin = true));

CREATE POLICY "Admins can delete templates"
    ON object_templates FOR DELETE
    TO authenticated
    USING (auth.uid() IN (SELECT id FROM profiles WHERE is_super_admin = true));

-- Property Suggestions: users peuvent créer, admins peuvent tout faire
CREATE POLICY "Users can create suggestions"
    ON property_suggestions FOR INSERT
    TO authenticated
    WITH CHECK (true);

CREATE POLICY "Users can read own suggestions"
    ON property_suggestions FOR SELECT
    TO authenticated
    USING (
        suggested_by_user_id = auth.uid() 
        OR auth.uid() IN (SELECT id FROM profiles WHERE is_super_admin = true)
    );

CREATE POLICY "Admins can update suggestions"
    ON property_suggestions FOR UPDATE
    TO authenticated
    USING (auth.uid() IN (SELECT id FROM profiles WHERE is_super_admin = true));

-- Detected Objects Log: users voient les leurs, admins voient tout
CREATE POLICY "Users can insert own objects"
    ON detected_objects_log FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can read own objects"
    ON detected_objects_log FOR SELECT
    TO authenticated
    USING (
        user_id = auth.uid() 
        OR auth.uid() IN (SELECT id FROM profiles WHERE is_super_admin = true)
    );

-- ============================================
-- 6. Fonctions utilitaires
-- ============================================

-- Fonction pour incrémenter usage_count d'un template
CREATE OR REPLACE FUNCTION increment_template_usage(template_id UUID)
RETURNS void AS $$
BEGIN
    UPDATE object_templates 
    SET usage_count = usage_count + 1,
        updated_at = NOW()
    WHERE id = template_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fonction pour incrémenter usage_count d'une suggestion
CREATE OR REPLACE FUNCTION increment_suggestion_usage(suggestion_id UUID)
RETURNS void AS $$
BEGIN
    UPDATE property_suggestions 
    SET usage_count = usage_count + 1
    WHERE id = suggestion_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fonction pour approuver une suggestion et créer/maj le template
CREATE OR REPLACE FUNCTION approve_suggestion(
    p_suggestion_id UUID,
    p_reviewer_id UUID
)
RETURNS void AS $$
DECLARE
    v_suggestion property_suggestions%ROWTYPE;
    v_template_id UUID;
BEGIN
    -- Get suggestion
    SELECT * INTO v_suggestion FROM property_suggestions WHERE id = p_suggestion_id;
    
    IF v_suggestion IS NULL THEN
        RAISE EXCEPTION 'Suggestion not found';
    END IF;
    
    -- Update suggestion status
    UPDATE property_suggestions 
    SET status = 'approved',
        reviewed_by = p_reviewer_id,
        reviewed_at = NOW()
    WHERE id = p_suggestion_id;
    
    -- Find or create template
    SELECT id INTO v_template_id 
    FROM object_templates 
    WHERE name = v_suggestion.object_template_name 
    LIMIT 1;
    
    IF v_template_id IS NULL THEN
        -- Create new template
        INSERT INTO object_templates (name, category, default_properties, is_approved, created_by)
        VALUES (v_suggestion.object_template_name, 'Autre', ARRAY[v_suggestion.property_name], true, p_reviewer_id)
        RETURNING id INTO v_template_id;
    ELSE
        -- Add property to existing template
        UPDATE object_templates 
        SET default_properties = array_append(default_properties, v_suggestion.property_name),
            updated_at = NOW()
        WHERE id = v_template_id
        AND NOT (v_suggestion.property_name = ANY(default_properties));
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 7. Données initiales (templates de base)
-- ============================================

INSERT INTO object_templates (name, category, default_materials, default_properties, is_approved, usage_count) VALUES
-- Chauffage / Ventilation
('Radiateur', 'Chauffage / Ventilation', ARRAY['Fonte', 'Acier', 'Aluminium'], ARRAY['Nombre d''éléments', 'Type de thermostat', 'Marque'], true, 0),
('Convecteur', 'Chauffage / Ventilation', ARRAY['Acier', 'Aluminium'], ARRAY['Puissance', 'Marque', 'Thermostat'], true, 0),
('Chaudière', 'Chauffage / Ventilation', ARRAY['Acier'], ARRAY['Marque', 'Modèle', 'Puissance', 'Type'], true, 0),
('VMC', 'Chauffage / Ventilation', ARRAY['Plastique', 'Aluminium'], ARRAY['Type', 'Marque'], true, 0),
('Grille de ventilation', 'Chauffage / Ventilation', ARRAY['Plastique', 'Aluminium', 'Inox'], ARRAY['Dimensions'], true, 0),

-- Électricité
('Interrupteur', 'Électricité', ARRAY['Plastique'], ARRAY['Type', 'Marque', 'Couleur'], true, 0),
('Prise électrique', 'Électricité', ARRAY['Plastique'], ARRAY['Type', 'Nombre de ports'], true, 0),
('Tableau électrique', 'Électricité', ARRAY['Plastique', 'Métal'], ARRAY['Nombre de rangées', 'Marque'], true, 0),
('Luminaire', 'Électricité', ARRAY['Métal', 'Plastique', 'Verre'], ARRAY['Type', 'Nombre d''ampoules'], true, 0),
('Spot encastré', 'Électricité', ARRAY['Aluminium', 'Plastique'], ARRAY['Type', 'Diamètre'], true, 0),
('Applique murale', 'Électricité', ARRAY['Métal', 'Verre', 'Plastique'], ARRAY['Type'], true, 0),

-- Plomberie
('Lavabo', 'Plomberie', ARRAY['Céramique', 'Porcelaine', 'Inox'], ARRAY['Dimensions', 'Type'], true, 0),
('WC', 'Plomberie', ARRAY['Céramique', 'Porcelaine'], ARRAY['Type', 'Mécanisme chasse'], true, 0),
('Baignoire', 'Plomberie', ARRAY['Acrylique', 'Fonte', 'Acier émaillé'], ARRAY['Dimensions', 'Type'], true, 0),
('Douche', 'Plomberie', ARRAY['Acrylique', 'Carrelage', 'Verre'], ARRAY['Type', 'Dimensions'], true, 0),
('Robinet', 'Plomberie', ARRAY['Chrome', 'Inox', 'Laiton'], ARRAY['Type', 'Marque'], true, 0),
('Évier', 'Plomberie', ARRAY['Inox', 'Céramique', 'Résine'], ARRAY['Nombre de bacs', 'Dimensions'], true, 0),
('Chauffe-eau', 'Plomberie', ARRAY['Acier'], ARRAY['Capacité', 'Marque', 'Type'], true, 0),

-- Porte & Fenêtre
('Porte intérieure', 'Porte & Fenêtre', ARRAY['Bois', 'MDF', 'PVC'], ARRAY['Type', 'Dimensions', 'Sens d''ouverture'], true, 0),
('Porte d''entrée', 'Porte & Fenêtre', ARRAY['Bois', 'PVC', 'Aluminium', 'Acier'], ARRAY['Type', 'Serrure', 'Vitrage'], true, 0),
('Fenêtre', 'Porte & Fenêtre', ARRAY['PVC', 'Bois', 'Aluminium'], ARRAY['Type', 'Vitrage', 'Dimensions'], true, 0),
('Volet', 'Porte & Fenêtre', ARRAY['PVC', 'Bois', 'Aluminium'], ARRAY['Type', 'Motorisation'], true, 0),
('Store', 'Porte & Fenêtre', ARRAY['Tissu', 'PVC', 'Aluminium'], ARRAY['Type', 'Motorisation', 'Dimensions'], true, 0),

-- Électroménager
('Réfrigérateur', 'Électroménager', ARRAY['Acier', 'Plastique'], ARRAY['Marque', 'Modèle', 'Capacité', 'Classe énergie'], true, 0),
('Four', 'Électroménager', ARRAY['Acier', 'Inox'], ARRAY['Marque', 'Type', 'Dimensions'], true, 0),
('Plaque de cuisson', 'Électroménager', ARRAY['Vitrocéramique', 'Inox', 'Gaz'], ARRAY['Marque', 'Type', 'Nombre de feux'], true, 0),
('Hotte', 'Électroménager', ARRAY['Inox', 'Verre'], ARRAY['Marque', 'Type', 'Largeur'], true, 0),
('Lave-vaisselle', 'Électroménager', ARRAY['Acier', 'Plastique'], ARRAY['Marque', 'Capacité'], true, 0),
('Lave-linge', 'Électroménager', ARRAY['Acier', 'Plastique'], ARRAY['Marque', 'Capacité'], true, 0),
('Sèche-linge', 'Électroménager', ARRAY['Acier', 'Plastique'], ARRAY['Marque', 'Capacité', 'Type'], true, 0),

-- Mur, Sol & Plafond
('Mur', 'Mur, Sol & Plafond', ARRAY['Peinture', 'Papier peint', 'Carrelage', 'Crépi'], ARRAY['Couleur', 'Finition'], true, 0),
('Sol', 'Mur, Sol & Plafond', ARRAY['Parquet', 'Carrelage', 'Vinyle', 'Moquette', 'Béton'], ARRAY['Type', 'Couleur'], true, 0),
('Plafond', 'Mur, Sol & Plafond', ARRAY['Peinture', 'Plâtre', 'Lambris'], ARRAY['Type', 'Couleur', 'Hauteur'], true, 0),
('Plinthe', 'Mur, Sol & Plafond', ARRAY['Bois', 'MDF', 'PVC', 'Carrelage'], ARRAY['Hauteur', 'Couleur'], true, 0)

ON CONFLICT DO NOTHING;

-- ============================================
-- 8. Marquer un utilisateur comme super admin
-- À adapter avec ton email
-- ============================================

UPDATE profiles 
SET is_super_admin = true 
WHERE email = 'nicolas@rentika.be';

-- ============================================
-- FIN
-- ============================================
