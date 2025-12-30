# AutoState Admin Dashboard

Dashboard d'administration pour AutoState - Application d'états des lieux.

## Tech Stack

- **Next.js 14** - Framework React
- **TypeScript** - Type safety
- **Tailwind CSS** - Styling
- **shadcn/ui** - Components
- **Supabase** - Backend & Auth
- **Vercel** - Deployment

## Features

- ✅ Authentification Super Admin
- ✅ Liste des utilisateurs (profiles)
- ✅ Vue des dossiers par utilisateur
- ✅ Gestion des templates d'objets
- ✅ Validation des suggestions de propriétés
- 🔜 Journal d'activité
- 🔜 Export de données
- 🔜 Statistiques avancées

## Setup

### 1. Cloner le repo

```bash
git clone https://github.com/votre-username/autostate-dashboard.git
cd autostate-dashboard
```

### 2. Installer les dépendances

```bash
npm install
```

### 3. Configurer les variables d'environnement

Créer un fichier `.env.local` :

```bash
cp .env.example .env.local
```

Remplir les valeurs :

```env
NEXT_PUBLIC_SUPABASE_URL=https://woaxmqckupcgwsjbnlep.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
NEXT_PUBLIC_SUPER_ADMIN_EMAILS=nicolas@rentika.be
```

### 4. Lancer en développement

```bash
npm run dev
```

Ouvrir [http://localhost:3000](http://localhost:3000)

## Déploiement sur Vercel

### Option A: Via GitHub

1. Push sur GitHub
2. Connecter le repo à Vercel
3. Ajouter les variables d'environnement dans Vercel Dashboard
4. Deploy

### Option B: Via CLI

```bash
npm install -g vercel
vercel login
vercel --prod
```

## Structure du projet

```
src/
├── app/
│   ├── page.tsx              # Login page
│   ├── layout.tsx            # Root layout
│   ├── globals.css           # Global styles
│   └── dashboard/
│       ├── layout.tsx        # Dashboard layout (sidebar)
│       ├── page.tsx          # Dashboard home
│       ├── users/
│       │   ├── page.tsx      # Users list
│       │   └── [id]/page.tsx # User detail
│       ├── objects/
│       │   └── page.tsx      # Object templates
│       └── suggestions/
│           └── page.tsx      # Property suggestions
├── components/
│   └── ui/                   # shadcn components
├── lib/
│   ├── supabase.ts          # Supabase client & types
│   └── utils.ts             # Utilities
```

## Tables Supabase requises

Le dashboard utilise ces tables :

- `profiles` - Utilisateurs
- `inspections` - États des lieux
- `object_templates` - Templates d'objets validés
- `property_suggestions` - Suggestions de propriétés

### SQL pour créer les tables manquantes

```sql
-- Object Templates
CREATE TABLE IF NOT EXISTS object_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    default_materials TEXT[] DEFAULT '{}',
    default_properties TEXT[] DEFAULT '{}',
    is_approved BOOLEAN DEFAULT false,
    usage_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Property Suggestions
CREATE TABLE IF NOT EXISTS property_suggestions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    object_template_name TEXT NOT NULL,
    property_name TEXT NOT NULL,
    property_value TEXT,
    suggested_by_user_id UUID REFERENCES auth.users(id),
    usage_count INTEGER DEFAULT 1,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE object_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE property_suggestions ENABLE ROW LEVEL SECURITY;

-- Policies (allow all for service role)
CREATE POLICY "Service role full access" ON object_templates FOR ALL USING (true);
CREATE POLICY "Service role full access" ON property_suggestions FOR ALL USING (true);
```

## Super Admin

Seuls les emails listés dans `NEXT_PUBLIC_SUPER_ADMIN_EMAILS` peuvent se connecter.

Pour ajouter un admin, modifier la variable d'environnement :

```env
NEXT_PUBLIC_SUPER_ADMIN_EMAILS=admin1@example.com,admin2@example.com
```

## Licence

Propriétaire - AutoState / Rentika
