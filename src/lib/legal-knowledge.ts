// ============================================
// Legal Knowledge Base - Belgian Rental Law
// ============================================
// Sources:
// - Wallonie: "Répartition des réparations et travaux d'entretien" (Moniteur Belge 08.12.2017)
// - Bruxelles: "Réparations locatives - Liste non limitative" (SNPC)

export type Region = 'wallonia' | 'brussels' | 'flanders';

export interface LegalSource {
  id: string;
  region: Region;
  title: string;
  officialTitle: string;
  source: string;
  publicationDate: string;
  url: string;
  pdfStoragePath?: string; // Supabase storage path
}

export interface RepairResponsibility {
  id: string;
  category: string;
  subcategory?: string;
  item: string;
  landlordResponsibility: string;
  tenantResponsibility: string;
  notes?: string;
  region: Region;
  sourceId: string;
}

export interface LegalCategory {
  id: string;
  name: string;
  icon: string;
  itemCount: number;
}

// ============================================
// Official Sources
// ============================================

export const LEGAL_SOURCES: LegalSource[] = [
  {
    id: 'wallonia-2017',
    region: 'wallonia',
    title: 'Répartition des réparations Wallonie',
    officialTitle: 'Répartition des réparations, travaux et entretiens à charge du bailleur ou incombant au preneur',
    source: 'Moniteur Belge',
    publicationDate: '2017-12-08',
    url: 'https://www.ejustice.just.fgov.be/mopdf/2017/12/08_1.pdf',
    pdfStoragePath: 'legal-docs/wallonia-reparations-2017.pdf'
  },
  {
    id: 'brussels-snpc',
    region: 'brussels',
    title: 'Réparations locatives Bruxelles',
    officialTitle: 'Réparations locatives - Liste non limitative des réparations locatives',
    source: 'SNPC (Syndicat National des Propriétaires et Copropriétaires)',
    publicationDate: '2023-01-01',
    url: 'https://www.snpc-nems.be/',
    pdfStoragePath: 'legal-docs/brussels-reparations-snpc.pdf'
  }
];

// ============================================
// Categories
// ============================================

export const LEGAL_CATEGORIES: LegalCategory[] = [
  { id: 'exteriors', name: 'Abords et Extérieurs', icon: '🏡', itemCount: 0 },
  { id: 'appliances', name: 'Appareils Électroménagers', icon: '🔌', itemCount: 0 },
  { id: 'elevator', name: 'Ascenseurs', icon: '🛗', itemCount: 0 },
  { id: 'heating', name: 'Chauffage', icon: '🔥', itemCount: 0 },
  { id: 'electricity', name: 'Électricité', icon: '⚡', itemCount: 0 },
  { id: 'woodwork', name: 'Menuiseries', icon: '🚪', itemCount: 0 },
  { id: 'cleaning', name: 'Nettoyage', icon: '🧹', itemCount: 0 },
  { id: 'plumbing', name: 'Plomberie', icon: '🚿', itemCount: 0 },
  { id: 'coatings', name: 'Revêtements', icon: '🎨', itemCount: 0 },
  { id: 'sanitary', name: 'Sanitaires', icon: '🚽', itemCount: 0 },
  { id: 'security', name: 'Sécurité', icon: '🔐', itemCount: 0 },
  { id: 'misc', name: 'Divers', icon: '📦', itemCount: 0 },
];

// ============================================
// Wallonia Data - Extracted from Moniteur Belge 08.12.2017
// ============================================

export const WALLONIA_REPAIRS: RepairResponsibility[] = [
  // ABORDS ET EXTÉRIEURS
  {
    id: 'w-ext-1',
    category: 'exteriors',
    item: 'Antennes et Paraboles',
    landlordResponsibility: 'Répond de la vétusté et de sa suppression/remplacement en cas de danger, lorsqu\'elle a été placée par le bailleur.',
    tenantResponsibility: 'Si posée par le bailleur: vérifie le bon état des systèmes de fixation, informe le bailleur des défectuosités. Si posée par le preneur: peut installer (sauf interdiction), doit enlever à la fin et réparer les dégâts.',
    region: 'wallonia',
    sourceId: 'wallonia-2017'
  },
  {
    id: 'w-ext-2',
    category: 'exteriors',
    item: 'Avaloirs - Caniveaux',
    landlordResponsibility: '',
    tenantResponsibility: 'Enlèvement régulier des dépôts et nettoyage. Vider le panier, écumer les graisses. Enlever les débris végétaux. Nettoyer les siphons de cour.',
    region: 'wallonia',
    sourceId: 'wallonia-2017'
  },
  {
    id: 'w-ext-3',
    category: 'exteriors',
    item: 'Balcons - Terrasses - Balustrades',
    landlordResponsibility: 'Entretien des dispositifs de sécurité externe (barres d\'appui). Remplacement si dégradation par vétusté. Remplacement des balustrades et garde-corps sauf faute du preneur.',
    tenantResponsibility: 'Nettoyage régulier des dallages, caillebotis, siphons, avaloirs, garde-corps. Responsable des traces de dépôts, taches de rouille, graisse. Contrôle et informe le bailleur des altérations.',
    region: 'wallonia',
    sourceId: 'wallonia-2017'
  },
  {
    id: 'w-ext-4',
    category: 'exteriors',
    item: 'Boîtes aux lettres',
    landlordResponsibility: 'Répond de la vétusté.',
    tenantResponsibility: 'Graissage ou graphitage des serrures, pênes, charnières. Assure leur bon fonctionnement et conservation.',
    region: 'wallonia',
    sourceId: 'wallonia-2017'
  },
  {
    id: 'w-ext-5',
    category: 'exteriors',
    item: 'Chéneaux et Gouttières',
    landlordResponsibility: 'Gros entretien et réparation de la gouttière, chéneau et tuyaux de descente dégradés par vétusté ou cas fortuit.',
    tenantResponsibility: 'Nettoyage régulier pour permettre bonne évacuation des eaux pluviales.',
    region: 'wallonia',
    sourceId: 'wallonia-2017'
  },
  {
    id: 'w-ext-6',
    category: 'exteriors',
    item: 'Citerne eau de pluie',
    landlordResponsibility: 'Réparation et curage sauf clause contraire.',
    tenantResponsibility: 'Responsable si l\'eau devient inutilisable ou polluée par sa faute ou négligence.',
    region: 'wallonia',
    sourceId: 'wallonia-2017'
  },
  {
    id: 'w-ext-7',
    category: 'exteriors',
    item: 'Clôtures - Haies',
    landlordResponsibility: '',
    tenantResponsibility: 'Haies: taille régulière, remplacement des plants morts par manque d\'entretien, nettoyage des pieds, engrais. Fossés: curage périodique. Piquets/fils: interventions locales. Murs: démoussage.',
    region: 'wallonia',
    sourceId: 'wallonia-2017'
  },
  {
    id: 'w-ext-8',
    category: 'exteriors',
    item: 'Étangs et pièces d\'eau',
    landlordResponsibility: 'Curage d\'un étang (gros entretien). Réparations des bassins, conduits en cas de vice de construction.',
    tenantResponsibility: 'Nettoyage: enlèvement branches et plantes indésirables. Entretien des berges. Laisse le croît des poissons sans indemnité. Vidange avant l\'hiver. Entretien tuyauteries, vannes, robinets.',
    region: 'wallonia',
    sourceId: 'wallonia-2017'
  },
  {
    id: 'w-ext-9',
    category: 'exteriors',
    item: 'Façades',
    landlordResponsibility: 'Entretien des murs extérieurs.',
    tenantResponsibility: 'Responsable des dégâts causés par sa faute (ex: coulées de bacs à fleurs).',
    region: 'wallonia',
    sourceId: 'wallonia-2017'
  },
  {
    id: 'w-ext-10',
    category: 'exteriors',
    item: 'Fosses d\'aisance',
    landlordResponsibility: 'Curement des puits et fosses d\'aisance sauf clause contraire. Vidange sauf clause contraire.',
    tenantResponsibility: 'Pas de charge d\'entretien sauf clause contraire.',
    region: 'wallonia',
    sourceId: 'wallonia-2017'
  },
  {
    id: 'w-ext-11',
    category: 'exteriors',
    item: 'Grilles - Portail',
    landlordResponsibility: 'Gros entretien et remplacement si dégradations résultant de la vétusté.',
    tenantResponsibility: 'Réparation grille de soupirail, égout, fenêtre. Remplacement barres dégradées/cassées. Entretien et graissage serrures, rails, pivots, verrous.',
    region: 'wallonia',
    sourceId: 'wallonia-2017'
  },
  {
    id: 'w-ext-12',
    category: 'exteriors',
    subcategory: 'Jardins',
    item: 'Jardins - Arbres - Pelouses',
    landlordResponsibility: 'Éradication des taupes SI le preneur signale dès le début. Conséquences du gel ou attaque généralisée de parasites sur les haies. Abattage des arbres dangereux. Élagage des arbres à hautes tiges.',
    tenantResponsibility: 'Entretien permanent: taille périodique arbustes, haies, protection contre chenilles/mousses, tonte régulière pelouses, désherbage, bêchage. Potager: nettoyage, bêchage, fumures. Serres: entretien, remplacement vitres. Chemins: nettoyage, comblement ornières.',
    notes: 'IMPORTANT: Si signalement tardif des taupes (ex: 6 mois), la responsabilité peut basculer vers le locataire.',
    region: 'wallonia',
    sourceId: 'wallonia-2017'
  },
  {
    id: 'w-ext-13',
    category: 'exteriors',
    item: 'Paratonnerres',
    landlordResponsibility: 'Frais d\'entretien quand le système fait partie intégrante du bâtiment sauf clause contraire.',
    tenantResponsibility: 'Ne pas endommager l\'installation, aucun raccordement.',
    region: 'wallonia',
    sourceId: 'wallonia-2017'
  },
  {
    id: 'w-ext-14',
    category: 'exteriors',
    item: 'Piscines',
    landlordResponsibility: 'Dégâts liés à la grêle et intempéries. Remplacement du sable, sondes, cartouche UV sauf mauvais entretien du preneur.',
    tenantResponsibility: 'Suivre recommandations d\'utilisation. Maintenir pH neutre, lutter contre algues, désinfecter, entretenir filtration, renouveler eau, hiverner/déshiverner, vérifier chlore, entretenir accessoires, bâche, volet.',
    region: 'wallonia',
    sourceId: 'wallonia-2017'
  },
  {
    id: 'w-ext-15',
    category: 'exteriors',
    item: 'Tentes solaires',
    landlordResponsibility: '',
    tenantResponsibility: 'Aspirer régulièrement la toile. Brossage doux annuel à l\'eau claire. Replier la toile sèche. Mettre la manivelle à l\'abri. Nettoyer bras et profils.',
    region: 'wallonia',
    sourceId: 'wallonia-2017'
  },
  {
    id: 'w-ext-16',
    category: 'exteriors',
    item: 'Trottoirs',
    landlordResponsibility: 'Entretien et réparations des trottoirs extérieurs.',
    tenantResponsibility: 'Nettoyage, déneigement selon règlement communal et contrat de bail. Avertir le bailleur des défectuosités.',
    region: 'wallonia',
    sourceId: 'wallonia-2017'
  },

  // APPAREILS ÉLECTROMÉNAGERS
  {
    id: 'w-app-1',
    category: 'appliances',
    item: 'Appareils électroménagers (cuisinières, fours, hottes, frigos, lave-vaisselle, etc.)',
    landlordResponsibility: 'Transmet les modes d\'emploi. Remplacement des appareils sauf faute du preneur (pas nécessairement même marque, même niveau de service).',
    tenantResponsibility: 'Entretien général selon notices: nettoyage, détartrage, dégivrage, dégraissage, préservation joints. Menu entretien: remplacement boutons, lampes, ampoules, poignées, joints portes, serrures. Tables vitrocéramique: responsable griffures et cristallisations. Responsable des dégâts par absence d\'utilisation.',
    region: 'wallonia',
    sourceId: 'wallonia-2017'
  },

  // ASCENSEURS
  {
    id: 'w-asc-1',
    category: 'elevator',
    item: 'Ascenseurs - Monte-charges',
    landlordResponsibility: 'Remplacement éléments défectueux par usure normale, vétusté, cas fortuit ou force majeure. Contrat d\'entretien et vérifications périodiques obligatoire. Police d\'assurance RC ascenseur. Grosses réparations, réglage cabine, mise en conformité, remplacement câbles.',
    tenantResponsibility: 'Entretien périodique, visites organisme de contrôle, abonnements service d\'urgence. Prime assurance RC. Remplacement pièces d\'usure normale (contacts, boutons, fusibles, interrupteurs, plaquettes frein, ferme-portes, ampoules). Frais usage abusif (surcharge, déménagement).',
    region: 'wallonia',
    sourceId: 'wallonia-2017'
  },

  // CHAUFFAGE
  {
    id: 'w-heat-1',
    category: 'heating',
    item: 'Boilers et chauffe-eau électriques',
    landlordResponsibility: 'Remplacement éléments défectueux par usure normale, vétusté, cas fortuit, force majeure ou vice de placement.',
    tenantResponsibility: 'Si présence groupe de sécurité, l\'actionner régulièrement. Généralement plus de détartrage périodique sauf clause contraire.',
    region: 'wallonia',
    sourceId: 'wallonia-2017'
  },
  {
    id: 'w-heat-2',
    category: 'heating',
    item: 'Chauffe-eau au gaz',
    landlordResponsibility: 'Remplacement éléments défectueux. Remplacement serpentin sauf si preneur n\'a pas fait l\'entretien périodique.',
    tenantResponsibility: 'Détartrage et entretien périodique par un professionnel selon instructions fabricant et bail. Attestation d\'entretien à remettre sur demande. Remplacement joints, robinets/vannes défectueux, anodes. Vérifier évacuation gaz brûlés non obstruée.',
    region: 'wallonia',
    sourceId: 'wallonia-2017'
  },
  {
    id: 'w-heat-3',
    category: 'heating',
    item: 'Conduits de cheminées - Ramonage',
    landlordResponsibility: 'Remplacement éléments défectueux. Réparations aux conduits de fumée sauf faute du preneur. Réfection souches de cheminées.',
    tenantResponsibility: 'Réparations aux âtres, contrecœurs, chambranles et tablettes de cheminées (réparations locatives). Ramonage et nettoyage sauf clause contraire. Attestation professionnel agréé à remettre au bailleur.',
    region: 'wallonia',
    sourceId: 'wallonia-2017'
  },
  {
    id: 'w-heat-4',
    category: 'heating',
    item: 'Citerne mazout',
    landlordResponsibility: 'Remplacement éléments défectueux. Étanchéité et conformité de la citerne. Remplacement de la jauge.',
    tenantResponsibility: 'Maintenir niveau suffisant de combustible pour éviter encrassement. En cas de débordement: remise en état à charge du preneur (recours contre fournisseur). Prévenir immédiatement le bailleur.',
    region: 'wallonia',
    sourceId: 'wallonia-2017'
  },
  {
    id: 'w-heat-5',
    category: 'heating',
    item: 'Foyers à feu ouvert',
    landlordResponsibility: 'Remplacement éléments défectueux par usure normale, vétusté, cas fortuit, force majeure ou vice de placement.',
    tenantResponsibility: 'Réparations locatives: âtres, contrecœurs, chambranles, tablettes, linteaux, jambages, rideau, manteau, foyer, plaque. Nettoyer résidus combustion. Entretenir accessoires (clapet, rideau, pare-flammes, chenets, cendrier). Ramonage annuel avec preuve. Responsable de la conduite du feu et qualité du combustible.',
    region: 'wallonia',
    sourceId: 'wallonia-2017'
  },
  {
    id: 'w-heat-6',
    category: 'heating',
    item: 'Foyers à cassette ou insert',
    landlordResponsibility: 'Idem foyers à feu ouvert.',
    tenantResponsibility: 'Idem foyers à feu ouvert + nettoyer périodiquement vitres et parois avec produits spécifiques. Remplacer cordon du portillon ou joints au mastic.',
    region: 'wallonia',
    sourceId: 'wallonia-2017'
  },
  {
    id: 'w-heat-7',
    category: 'heating',
    item: 'Chaudière - Convecteurs - Radiateurs',
    landlordResponsibility: 'Remplacement éléments défectueux. Remplacement chaudière ou brûleur devenu inutilisable et vétuste.',
    tenantResponsibility: 'Entretien installation et protection contre le gel. Contrôle et entretien par technicien agréé: combustible liquide = annuel avec ramonage, gaz = selon législation ou bail. Attestation d\'entretien à remettre. Maintenir robinetterie et vannes en bon état. Manipulation régulière circulateur et vannes thermostatiques. Étanchéité raccords. Pression d\'eau adéquate. Purge radiateurs. Remplacement joints, gicleur, électrodes, vase d\'expansion, fusibles, lampes-témoins, contacteurs.',
    region: 'wallonia',
    sourceId: 'wallonia-2017'
  },

  // ÉLECTRICITÉ
  {
    id: 'w-elec-1',
    category: 'electricity',
    item: 'Installation électrique',
    landlordResponsibility: 'Remplacement éléments défectueux constituant un risque en cas d\'usage normal. Mise à disposition d\'une installation conforme aux règlements.',
    tenantResponsibility: 'Utiliser selon caractéristiques. Ne pas modifier le tableau électrique. Remplacer petits accessoires: interrupteurs, prises, témoins, fusibles, disjoncteurs, ampoules, soquets. Si modification: certification de conformité obligatoire + copie au bailleur + remise en état sauf renonciation. Conserver longueur de fils suffisante (+/- 10 cm) aux points lumineux.',
    region: 'wallonia',
    sourceId: 'wallonia-2017'
  },
  {
    id: 'w-elec-2',
    category: 'electricity',
    item: 'Parlophones et Vidéophones',
    landlordResponsibility: 'Réparation ou remplacement éléments défectueux rendant l\'équipement inutilisable.',
    tenantResponsibility: 'Pas d\'entretien en principe. Maintenir en bon état de propreté cornet, support, cordon. Remplacer capsule micro des postes. Prendre en charge petits accessoires électriques mécanisme ouvre-portes.',
    region: 'wallonia',
    sourceId: 'wallonia-2017'
  },
  {
    id: 'w-elec-3',
    category: 'electricity',
    item: 'Sonneries',
    landlordResponsibility: 'Remplacement éléments défectueux rendant l\'équipement inutilisable.',
    tenantResponsibility: 'Entretien total des sonneries et remplacement des accessoires électriques.',
    region: 'wallonia',
    sourceId: 'wallonia-2017'
  },
  {
    id: 'w-elec-4',
    category: 'electricity',
    item: 'Téléphonie et Data',
    landlordResponsibility: 'Remplacement éléments défectueux pour autant que ces équipements soient propriété du bailleur.',
    tenantResponsibility: 'Utiliser de préférence les gaines, faux-planchers et locaux techniques mis à disposition. En fin de bail, enlever tous les équipements ajoutés (câbles, boîtiers, tableaux, appareils). Réparer tous dégâts causés par pose et enlèvement.',
    region: 'wallonia',
    sourceId: 'wallonia-2017'
  },

  // MENUISERIES
  {
    id: 'w-wood-1',
    category: 'woodwork',
    item: 'Charnières, Gonds, Paumelles, Quincailleries',
    landlordResponsibility: 'Remplacement éléments défectueux par usure normale, vétusté complète, cas fortuit, force majeure ou vice de placement.',
    tenantResponsibility: 'Veiller à la propreté et bonne lubrification/graphitage des axes ou broches. Veiller à la bonne fixation. Remplacer rondelles usées. Menu entretien quincailleries. En cas de bris: présumé responsable. Entretenir métaux nobles (or, bronze, cuivre, laiton) avec produits appropriés. Ne pas peindre ni vernir les quincailleries.',
    region: 'wallonia',
    sourceId: 'wallonia-2017'
  },
  {
    id: 'w-wood-2',
    category: 'woodwork',
    item: 'Coupoles et Lanterneaux',
    landlordResponsibility: 'Remplacement éléments défectueux.',
    tenantResponsibility: 'Maintenir en bon état de propreté. Enlever dépôts et mousses sur face extérieure accessible. Actionner régulièrement partie ouvrante et graisser mécanisme de commande.',
    region: 'wallonia',
    sourceId: 'wallonia-2017'
  },
  {
    id: 'w-wood-3',
    category: 'woodwork',
    item: 'Châssis de fenêtres et Portes',
    landlordResponsibility: 'Remplacement vitres brisées/fêlées par cas fortuit, force majeure, vice de placement (si bailleur averti). Peinture boiseries extérieures aussi souvent que nécessaire.',
    tenantResponsibility: 'Nettoyage régulier côté intérieur: canaux évacuation eaux condensation, chambre décompression. Nettoyer face extérieure ouvrants accessibles. Éviter de fixer accessoires aux châssis. Faire fonctionner battants régulièrement. Entretenir systèmes de fermeture. Ne pas pratiquer découpes, entailles, trous. Responsable des taches, coups, griffures, échardes. Refixer baguettes, socles, moulures. Prévenir bailleur de la nécessité de peinture.',
    region: 'wallonia',
    sourceId: 'wallonia-2017'
  },
  {
    id: 'w-wood-4',
    category: 'woodwork',
    item: 'Escaliers',
    landlordResponsibility: 'Remplacement éléments défectueux rendant l\'usage difficile ou dangereux.',
    tenantResponsibility: 'Responsable du déchaussement des fuseaux et balustres, descellement des mains-courantes sauf usage normal. Pas responsable de l\'usure normale main-courante et ligne de foulée. Responsable des coups, éclats, percussions.',
    region: 'wallonia',
    sourceId: 'wallonia-2017'
  },
  {
    id: 'w-wood-5',
    category: 'woodwork',
    item: 'Vitres et Glaces - Vitraux',
    landlordResponsibility: 'Remplacement éléments défectueux par usage normale, cas fortuit, force majeure. Remise en état joints vétustes.',
    tenantResponsibility: 'Laver régulièrement vitres intérieures et extérieures accessibles. Responsable du bris sauf vice de pose, cas fortuit, force majeure. Supprimer inscriptions peintes/collées. Ne pas endommager films adhésifs décoratifs. Responsable dégradation joint (ex: lacérations par animal domestique).',
    region: 'wallonia',
    sourceId: 'wallonia-2017'
  },
  {
    id: 'w-wood-6',
    category: 'woodwork',
    item: 'Volets',
    landlordResponsibility: 'Remplacement éléments défectueux.',
    tenantResponsibility: 'Volet roulant: entretenir et graisser mécanisme, guides, rails. Remplacement de la sangle. Manipuler régulièrement pour éviter blocage. Nettoyer faces accessibles.',
    region: 'wallonia',
    sourceId: 'wallonia-2017'
  },

  // NETTOYAGE
  {
    id: 'w-clean-1',
    category: 'cleaning',
    item: 'Désinfection',
    landlordResponsibility: '',
    tenantResponsibility: 'Coût de la désinfection et désinsectisation (cafards, punaises, rongeurs, nuisibles). Traitement spécifique moquettes si animaux. Certains locaux (étables, chenils) doivent être désinfectés en fin de location.',
    region: 'wallonia',
    sourceId: 'wallonia-2017'
  },
  {
    id: 'w-clean-2',
    category: 'cleaning',
    item: 'Nettoyage',
    landlordResponsibility: 'Informer le preneur sur le mode d\'entretien et produits à utiliser.',
    tenantResponsibility: 'Maintenir le bien et équipements en bon état de propreté. Utiliser produits adéquats. User des lieux en bon père de famille. Lessivage plafonds et murs si empoussièrement ou souillures. Quand le preneur quitte: bien vide et propre. Frais d\'enlèvement objets, décombres, détritus.',
    region: 'wallonia',
    sourceId: 'wallonia-2017'
  },
  {
    id: 'w-clean-3',
    category: 'cleaning',
    item: 'Nicotine',
    landlordResponsibility: '',
    tenantResponsibility: 'Frais spécifiques de remise en état: lessivage peintures, couche de fond si nécessaire quel que soit degré d\'amortissement. Nettoyage voiles, tentures, tapis, textiles imprégnés. Nettoyage spécifique équipements: prises, interrupteurs, prises d\'air, radiateurs.',
    region: 'wallonia',
    sourceId: 'wallonia-2017'
  },
  {
    id: 'w-clean-4',
    category: 'cleaning',
    item: 'Pigeons',
    landlordResponsibility: 'Mise en œuvre de dispositifs (fils tendus, tiges, filets).',
    tenantResponsibility: 'Responsable des dégâts causés par ses pigeons. Désinfection si nécessaire. Empêcher les pigeons/volatiles de pénétrer dans l\'immeuble. Prévenir le bailleur si nécessaire.',
    region: 'wallonia',
    sourceId: 'wallonia-2017'
  },
  {
    id: 'w-clean-5',
    category: 'cleaning',
    item: 'Rideaux, Tentures et Voilages',
    landlordResponsibility: 'Répond de la vétusté.',
    tenantResponsibility: 'Nettoyage régulier et adéquat. Responsable des accrocs, déchirures, auréoles, brûlures de cigarettes. Remplacer cordons de manœuvre. Responsable des rétrécissements par nettoyage inadéquat. Décolorations par soleil/lumière = usure normale.',
    region: 'wallonia',
    sourceId: 'wallonia-2017'
  },

  // PLOMBERIE
  {
    id: 'w-plumb-1',
    category: 'plumbing',
    item: 'Adoucisseurs, Filtres et Appareils de traitement de l\'eau',
    landlordResponsibility: 'Remplacement éléments défectueux rendant l\'équipement sans effet. Fournit le mode d\'emploi.',
    tenantResponsibility: 'Appareils à échanges ioniques: utilisation et entretien par firme spécialisée. Prévenir sans délai en cas de défaut. Appareils électriques/magnétiques: pas d\'entretien mais ne pas débrancher. Appareils chimiques: remplacer périodiquement le produit de traitement.',
    region: 'wallonia',
    sourceId: 'wallonia-2017'
  },
  {
    id: 'w-plumb-2',
    category: 'plumbing',
    item: 'Canalisations et Tuyauteries',
    landlordResponsibility: 'Remplacement éléments défectueux rendant l\'équipement inutilisable.',
    tenantResponsibility: 'Manipuler vannes et robinets d\'arrêt plusieurs fois par an. Utiliser l\'adoucisseur sans interruption. Préserver contre le gel. Couper eau en cas d\'absence prolongée. Ne pas endommager isolation thermique. Bouchonner canalisations gaz en attente. Garantir bon écoulement. Détartrer mousseurs/brise-jet. Responsable de la corrosion provoquée, dégradations par acide, dégâts par obstruction, entartrage par non-utilisation adoucisseur.',
    region: 'wallonia',
    sourceId: 'wallonia-2017'
  },
  {
    id: 'w-plumb-3',
    category: 'plumbing',
    item: 'Chambres de visite - Égouts - Couvercles et Grilles',
    landlordResponsibility: 'Remplacement éléments défectueux.',
    tenantResponsibility: 'Veiller au bon écoulement. Ouvrir régulièrement les taques. Dégager ou déboucher si nécessaire. Ne pas obstruer conduits d\'évacuation. Supporte les frais de débouchage sauf si défaut de l\'installation.',
    region: 'wallonia',
    sourceId: 'wallonia-2017'
  },
  {
    id: 'w-plumb-4',
    category: 'plumbing',
    item: 'Compteurs d\'eau',
    landlordResponsibility: 'Si compteur de passage: remplacement suite à vétusté, cas fortuit, force majeure ou vice de placement.',
    tenantResponsibility: 'Aucune charge d\'entretien. Préserver les compteurs du gel.',
    region: 'wallonia',
    sourceId: 'wallonia-2017'
  },
  {
    id: 'w-plumb-5',
    category: 'plumbing',
    item: 'Fosses septiques - Séparateurs de graisse - Filtres bactériens',
    landlordResponsibility: 'Renseigner le preneur sur le type d\'installation, mode d\'utilisation, emplacement des regards. Vidange, curage et remplacement du substrat sauf si rendus nécessaires par faute du preneur ou clause contraire.',
    tenantResponsibility: 'Responsable du bon fonctionnement. Ne pas introduire matières/produits risquant de perturber le fonctionnement. Écumage périodique des mousses flottantes. Nettoyage annuel au jet d\'eau de la masse filtrante des filtres bactériens.',
    region: 'wallonia',
    sourceId: 'wallonia-2017'
  },

  // REVÊTEMENTS
  {
    id: 'w-coat-1',
    category: 'coatings',
    item: 'Carrelage',
    landlordResponsibility: 'Remplacement éléments défectueux par usure normale, vétusté, cas fortuit, force majeure ou vice de placement.',
    tenantResponsibility: 'Nettoyage régulier avec produits spécifiques. Éviter de percer carreaux muraux. Responsable des dégradations (trous, éclats, fissures, bris). Remplacement si quelques carreaux cassés (présomption de faute). Responsable empreintes indélébiles et surcharges causant descellements. Responsable griffures, fêlures, brisures.',
    region: 'wallonia',
    sourceId: 'wallonia-2017'
  },
  {
    id: 'w-coat-2',
    category: 'coatings',
    item: 'Clous - Crampons - Pitons - Accessoires divers',
    landlordResponsibility: '',
    tenantResponsibility: 'Enlever accessoires de tapissier, clous, crampons et réparer les dégâts. Intervenir dans les frais de restauration des décors.',
    region: 'wallonia',
    sourceId: 'wallonia-2017'
  },
  {
    id: 'w-coat-3',
    category: 'coatings',
    item: 'Enduits',
    landlordResponsibility: 'Responsable dommages constructifs: décollements, défauts mise en œuvre, fissurations, humidité sans relation avec l\'occupation.',
    tenantResponsibility: 'Responsable de tout dommage sauf cause externe (ex: humidité ascensionnelle). Réparer dégradations par clous, crampons, chevilles.',
    region: 'wallonia',
    sourceId: 'wallonia-2017'
  },
  {
    id: 'w-coat-4',
    category: 'coatings',
    item: 'Faux-plafonds',
    landlordResponsibility: 'Remplacement éléments défectueux.',
    tenantResponsibility: 'Responsable des dégradations (traces de coup et fixation, perforations, écrasements d\'arêtes, angles brisés) sauf preuve que survenues sans sa faute.',
    region: 'wallonia',
    sourceId: 'wallonia-2017'
  },
  {
    id: 'w-coat-5',
    category: 'coatings',
    item: 'Marbre et Pierre naturelle',
    landlordResponsibility: 'Réparation dégâts résultant d\'un défaut de placement, mouvements du bâtiment, vice de la matière.',
    tenantResponsibility: 'Soin particulier avec produits adéquats. Responsable griffures (sauf usage normal), coups, écornures, taches, traces de dépose, graisse, rouille. Interdit de pratiquer percements et scellements dans la pierre naturelle.',
    region: 'wallonia',
    sourceId: 'wallonia-2017'
  },
  {
    id: 'w-coat-6',
    category: 'coatings',
    item: 'Miroirs',
    landlordResponsibility: '',
    tenantResponsibility: 'Entretenir comme vitre normale. Vérifier points de fixation. Responsable de l\'oxydation du tain due à mauvaise maîtrise de l\'hygrométrie. Responsable bris, éclats, coups.',
    region: 'wallonia',
    sourceId: 'wallonia-2017'
  },
  {
    id: 'w-coat-7',
    category: 'coatings',
    item: 'Papiers de tapisserie',
    landlordResponsibility: 'Répond des vices de placement et de la vétusté.',
    tenantResponsibility: 'Dépoussiérage, lessivage (si lavables), recollage local. Maintenir climat intérieur normal. Peut être tenu à intervention dans coût remplacement, détapissage, réparation enduits. Responsable: crayonnages, griffures, éraillures, taches, souillures, coups. Interdit: peindre sur papier non prévu, retapisser sur papier existant sans enlèvement. Si papier posé: coloris et motifs doivent correspondre aux goûts usuels.',
    region: 'wallonia',
    sourceId: 'wallonia-2017'
  },
  {
    id: 'w-coat-8',
    category: 'coatings',
    item: 'Parquets',
    landlordResponsibility: 'Répond vices de placement, décolorations par UV, usure du vernis d\'escalier dans ligne de foulée. Informe le preneur du type de produit et méthode d\'entretien.',
    tenantResponsibility: 'Parquet ciré: nettoyer à sec, térébenthine pour taches, éviter cire excessive. Ne pas vitrifier sans autorisation. Parquet vitrifié: nettoyer à sec ou serpillière légèrement humide, produits régénérateurs. Remplacer lames griffées, brûlées, détériorées. Si nettoyage/raclage nécessaire: sur toute la surface. Raclage prématuré par faute = indemnité de dépréciation. Responsable dégâts par meubles lourds et talons de chaussures. Pas responsable mauvais placement ou usure normale.',
    region: 'wallonia',
    sourceId: 'wallonia-2017'
  },
  {
    id: 'w-coat-9',
    category: 'coatings',
    item: 'Peintures et Vernis',
    landlordResponsibility: 'Peintures extérieures. Pour peintures intérieures: répond de la vétusté.',
    tenantResponsibility: 'Entretenir avec grand soin selon caractéristiques. Dépoussiérage ou lavage selon type. En fin d\'occupation: pas poussiéreuses, souillées, grasses même si amorties. Si non amorties et renouvellement nécessaire par faute: supporte partie du coût au prorata durée occupation. Même amorties: réparer petites dégradations par clous, crampons, chevilles. Accord préalable pour modification. Si repeinture sans accord: même tonalité et qualité. Responsable dépôts de nicotine.',
    region: 'wallonia',
    sourceId: 'wallonia-2017'
  },
  {
    id: 'w-coat-10',
    category: 'coatings',
    item: 'Planchers et Dalles de sol',
    landlordResponsibility: 'Répond de la vétusté. Répond des dégâts liés à pose défectueuse ou produits de fixation inadéquats.',
    tenantResponsibility: 'S\'informer de la charge d\'utilisation et la respecter. Responsable des désordres résultant d\'une surcharge. Si placement d\'un revêtement: responsable des dégradations en conséquence.',
    region: 'wallonia',
    sourceId: 'wallonia-2017'
  },
  {
    id: 'w-coat-11',
    category: 'coatings',
    item: 'Revêtements muraux',
    landlordResponsibility: 'Répond de la vétusté.',
    tenantResponsibility: 'Entretien, refixer plinthes détachées sauf vice de pose. Responsable parties endommagées par sa faute, remplacement partiel ou total à ses frais.',
    region: 'wallonia',
    sourceId: 'wallonia-2017'
  },
  {
    id: 'w-coat-12',
    category: 'coatings',
    item: 'Revêtements de sol souples',
    landlordResponsibility: 'Répond vétusté ou vice de placement. Usure normale passage, poinçonnement malgré protections. Décolorations dues à lumière.',
    tenantResponsibility: 'Entretien. Réparation en proportion de durée de vie normale. Usage godets, feutres recommandé. Responsable griffures, traces de coups, déchirures, taches, traces de talons. Maintenir en bon état de propreté. Responsable manque de nettoyage et dégâts par méthode inadaptée (décolorations, shampooing inadapté).',
    region: 'wallonia',
    sourceId: 'wallonia-2017'
  },
  {
    id: 'w-coat-13',
    category: 'coatings',
    item: 'Revêtements de sol stratifiés',
    landlordResponsibility: 'Répond vétusté ou vice de placement. Usure normale passage, poinçonnement malgré protections. Décolorations dues à lumière.',
    tenantResponsibility: 'Très sensibles à l\'eau. Nettoyer à sec ou serpillière très légèrement humide. Produits régénérateurs le cas échéant. Remplacer éléments griffés, brûlés, détériorés. Responsable rayures, coups, éclats.',
    region: 'wallonia',
    sourceId: 'wallonia-2017'
  },
  {
    id: 'w-coat-14',
    category: 'coatings',
    item: 'Tapis de pierre',
    landlordResponsibility: 'Répond décolorations dues à lumière et vices de placement.',
    tenantResponsibility: 'Entretien par nettoyage approprié: aspirer régulièrement poussières et saletés. Taches: serpillière légèrement humide.',
    region: 'wallonia',
    sourceId: 'wallonia-2017'
  },

  // SANITAIRES
  {
    id: 'w-san-1',
    category: 'sanitary',
    item: 'Baignoires et Douches',
    landlordResponsibility: 'Remplacement éléments défectueux par usure normale, vétusté, cas fortuit, force majeure ou vice de placement, sauf faute du preneur.',
    tenantResponsibility: 'Réparation des éclats selon matériau. Entretenir et remplacer joint souple en périphérie. Responsable dommages par infiltrations si joint défectueux non signalé. Responsable dommages par enlèvement adhésifs antidérapants. Entretenir avec produits appropriés contre entartrage et altération du brillant. Remplacer flexible.',
    region: 'wallonia',
    sourceId: 'wallonia-2017'
  },
  {
    id: 'w-san-2',
    category: 'sanitary',
    item: 'WC et Chasses d\'eau',
    landlordResponsibility: 'Remplacement éléments défectueux, notamment flotteur, chasse d\'eau, totalité de l\'installation sauf faute du preneur.',
    tenantResponsibility: 'Chasse: remplacement joints, élimination calcaire, réparation/remplacement dispositif commande, réglage flotteur si nécessaire. WC: remplacement joints, manchon de raccord, charnières, pignons, amortisseurs, sièges et couvercles brisés. Maintenir cuvette en bon état de propreté.',
    region: 'wallonia',
    sourceId: 'wallonia-2017'
  },
  {
    id: 'w-san-3',
    category: 'sanitary',
    item: 'Appareils sanitaires et Robinetteries',
    landlordResponsibility: 'Remplacement éléments défectueux. Robinets à disque céramique: pas d\'entretien spécifique. Remplacement cartouche thermostatique.',
    tenantResponsibility: 'Réglage, nettoyage, détartrage, graissage éventuel. Remplacement joints vannes/robinets, filtres, mousseurs, flexibles, pommes. Remplacement inverseurs défectueux par manque/mauvais entretien. Nettoyage et entretien régulier éviers, lavabos, baignoires, receveurs, WC avec produits adaptés aux matériaux. Manipulation régulière robinets thermostatiques et vannes d\'arrêt. Responsable éclats, écornures, fêlures, percussions, griffures. Prévenir bailleur si joints vétustes ou défectueux.',
    region: 'wallonia',
    sourceId: 'wallonia-2017'
  },

  // SÉCURITÉ
  {
    id: 'w-sec-1',
    category: 'security',
    item: 'Clés - Badges - Cartes magnétiques - Puces',
    landlordResponsibility: 'Remplacement éléments défectueux par usure normale, vétusté, cas fortuit, force majeure ou vice de placement.',
    tenantResponsibility: 'Entretenir et graisser les serrures. Restituer TOUTES les clés (y compris copies) et remplacer les manquantes/endommagées. Clés de sécurité numérotées: remettre l\'original. En cas de vol/perte: remplacement de la/des serrure(s) avec même nombre de clés. Boîtier à code: transmettre le code en usage. Perte badge/carte/puce: coûts de fourniture et reprogrammation à charge du preneur.',
    region: 'wallonia',
    sourceId: 'wallonia-2017'
  },
  {
    id: 'w-sec-2',
    category: 'security',
    item: 'Télécommandes',
    landlordResponsibility: 'Remplacement éléments défectueux par usure normale, vétusté, cas fortuit, force majeure.',
    tenantResponsibility: 'Pas d\'entretien sauf changement piles. En cas de perte/vol: entièrement responsable. Télécommandes codifiables: prix nouveau boîtier à charge, avertir gérance, modification fréquence, frais administratifs à charge. Télécommande fréquence unique: tous frais remplacement et reprogrammation à charge. Commandes porte garage/grille: remplacer boîtier perdu et faire reprogrammer.',
    region: 'wallonia',
    sourceId: 'wallonia-2017'
  },
  {
    id: 'w-sec-3',
    category: 'security',
    item: 'Vol et Vandalisme',
    landlordResponsibility: 'En l\'absence de faute du preneur: supporte le coût de réparation des dégâts causés à l\'immeuble lors d\'effraction ou vandalisme.',
    tenantResponsibility: 'Pas responsable mais doit faire immédiatement déclaration à la police. Transmettre PV au bailleur. À défaut, pourra être tenu responsable des dommages.',
    region: 'wallonia',
    sourceId: 'wallonia-2017'
  },
  {
    id: 'w-sec-4',
    category: 'security',
    item: 'Alarme',
    landlordResponsibility: 'Remplacement éléments défectueux.',
    tenantResponsibility: 'Entretien et remplacement des piles usagées.',
    region: 'wallonia',
    sourceId: 'wallonia-2017'
  },
  {
    id: 'w-sec-5',
    category: 'security',
    item: 'Détecteurs d\'incendie',
    landlordResponsibility: 'Placement initial et remplacement éléments défectueux.',
    tenantResponsibility: 'Entretien et remplacement des piles usagées.',
    region: 'wallonia',
    sourceId: 'wallonia-2017'
  },
  {
    id: 'w-sec-6',
    category: 'security',
    item: 'Extincteurs',
    landlordResponsibility: 'Placement des extincteurs obligatoires.',
    tenantResponsibility: 'Entretien et contrôle des extincteurs (recharge, réparation).',
    region: 'wallonia',
    sourceId: 'wallonia-2017'
  },

  // DIVERS
  {
    id: 'w-misc-1',
    category: 'misc',
    item: 'Déménagement',
    landlordResponsibility: '',
    tenantResponsibility: 'Responsable de tous les dégâts provoqués au bien loué et aux parties communes, y compris ceux provoqués par ses déménageurs.',
    region: 'wallonia',
    sourceId: 'wallonia-2017'
  },
  {
    id: 'w-misc-2',
    category: 'misc',
    item: 'Installation de gaz',
    landlordResponsibility: 'Entretien des canalisations.',
    tenantResponsibility: 'Entretien des becs et robinets.',
    region: 'wallonia',
    sourceId: 'wallonia-2017'
  },
  {
    id: 'w-misc-3',
    category: 'misc',
    item: 'Mérule',
    landlordResponsibility: 'Dès qu\'il est prévenu de l\'apparition de la mérule, prend immédiatement les dispositions pour l\'éradiquer. En cas de responsabilité du preneur, exerce un recours.',
    tenantResponsibility: 'En cas d\'apparition durant l\'occupation: doit prouver que ce dommage est survenu sans sa faute. Prévenir TOUJOURS IMMÉDIATEMENT le propriétaire en cas d\'infiltration d\'eau ou apparition de champignons. Éviter de stocker du bois dans locaux humides. Assurer ventilation normale des locaux notamment caves.',
    region: 'wallonia',
    sourceId: 'wallonia-2017'
  },
  {
    id: 'w-misc-4',
    category: 'misc',
    item: 'Vide-ordures',
    landlordResponsibility: 'Remplacement éléments défectueux.',
    tenantResponsibility: 'Si encore utilisé: entretien partie privative. Responsable dégâts aux parties communes par sa faute. Responsable jet d\'objets détériorant ou obstruant.',
    region: 'wallonia',
    sourceId: 'wallonia-2017'
  },
];

// ============================================
// Brussels Data - Extracted from SNPC Document
// (Simplified version - similar structure to Wallonia)
// ============================================

export const BRUSSELS_REPAIRS: RepairResponsibility[] = [
  // Note: Brussels follows similar principles but with some regional variations
  // This is a representative selection based on the SNPC document
  
  // ABORDS ET EXTÉRIEURS
  {
    id: 'b-ext-1',
    category: 'exteriors',
    item: 'Antennes et Paraboles',
    landlordResponsibility: 'Répond de la vétusté et de sa suppression/remplacement en cas de danger, lorsqu\'elle a été placée par le bailleur.',
    tenantResponsibility: 'Si posée par le bailleur: vérifie le bon état des systèmes de fixation, informe le bailleur des défectuosités. Si posée par le preneur: doit enlever à la fin et réparer les dégâts causés.',
    region: 'brussels',
    sourceId: 'brussels-snpc'
  },
  {
    id: 'b-ext-2',
    category: 'exteriors',
    item: 'Avaloirs - Caniveaux',
    landlordResponsibility: '',
    tenantResponsibility: 'Enlèvement régulier des dépôts et nettoyage de ces dispositifs, en collectant les dépôts et en vidant le panier. Nettoyage régulier des siphons de cour.',
    region: 'brussels',
    sourceId: 'brussels-snpc'
  },
  {
    id: 'b-ext-3',
    category: 'exteriors',
    item: 'Balcons - Terrasses - Balustrades et Garde-corps',
    landlordResponsibility: 'Entretien des dispositifs de sécurité externe (barres d\'appui). Remplacement si dégradation par vétusté ou sauf faute du preneur.',
    tenantResponsibility: 'Nettoyage régulier des dallages et caillebotis (mousses), des siphons et avaloirs, des garde-corps. Responsable des traces de dépôts de bacs à fleurs, taches de rouille, de graisse. Contrôle et informe le bailleur de l\'altération de la peinture ou dégradations.',
    region: 'brussels',
    sourceId: 'brussels-snpc'
  },
  {
    id: 'b-ext-4',
    category: 'exteriors',
    item: 'Boîtes aux lettres',
    landlordResponsibility: 'Répond de la vétusté.',
    tenantResponsibility: 'Graissage ou graphitage des serrures, pênes, charnières ou paumelles, assure leur bon fonctionnement et conservation.',
    region: 'brussels',
    sourceId: 'brussels-snpc'
  },
  {
    id: 'b-ext-5',
    category: 'exteriors',
    item: 'Chéneaux et Gouttières',
    landlordResponsibility: 'Gros entretien et réparation de la gouttière, du chéneau et des tuyaux de descente dégradés ou détachés par vétusté ou cas fortuit.',
    tenantResponsibility: 'Nettoyage régulier afin de permettre une bonne évacuation des eaux pluviales. En cas de difficulté d\'accès, les parties fixent les modalités de nettoyage.',
    region: 'brussels',
    sourceId: 'brussels-snpc'
  },
  {
    id: 'b-ext-6',
    category: 'exteriors',
    subcategory: 'Jardins',
    item: 'Jardins - Arbres - Arbustes - Haies - Pelouses',
    landlordResponsibility: 'L\'éradication des taupes est à charge du bailleur à condition que le preneur signale leur envahissement dès le début. Conséquences du gel ou attaque généralisée de parasites. Abattage des arbres dangereux. Élagage des arbres à hautes tiges.',
    tenantResponsibility: 'Entretien permanent du jardin: taille périodique arbustes, haies et plantes vivaces; protection contre chenilles, mousses; tonte régulière pelouses avec élimination de l\'herbe; traitement contre mauvaises herbes; désherbage, bêchage, binage. Restituer le jardin dans le même état d\'entretien et de développement.',
    notes: 'IMPORTANT: Le signalement tardif des taupes (ex: après 6 mois) peut transférer la responsabilité au locataire selon le droit belge.',
    region: 'brussels',
    sourceId: 'brussels-snpc'
  },

  // APPAREILS ÉLECTROMÉNAGERS
  {
    id: 'b-app-1',
    category: 'appliances',
    item: 'Appareils électroménagers',
    landlordResponsibility: 'Transmet les modes d\'emploi au preneur. Remplacement des appareils sauf en cas de faute du preneur. Pas nécessaire de remplacer par même marque, même niveau de service suffit.',
    tenantResponsibility: 'Entretien général basé sur notices d\'emploi et d\'entretien. Nettoyage, détartrage, dégivrage, dégraissage des équipements et filtres. Menu entretien: remplacement boutons de commande, lampes témoins, ampoules, poignées, joints des portes, serrures.',
    region: 'brussels',
    sourceId: 'brussels-snpc'
  },

  // CHAUFFAGE
  {
    id: 'b-heat-1',
    category: 'heating',
    item: 'Boilers et Chauffe-eau électriques',
    landlordResponsibility: 'Remplacement des éléments défectueux par suite d\'usure normale, vétusté, cas fortuit, force majeure ou vice de placement.',
    tenantResponsibility: 'Si présence d\'un groupe de sécurité, l\'actionner régulièrement. Généralement pas de détartrage périodique sauf clause contraire.',
    region: 'brussels',
    sourceId: 'brussels-snpc'
  },
  {
    id: 'b-heat-2',
    category: 'heating',
    item: 'Chaudière - Convecteurs - Radiateurs',
    landlordResponsibility: 'Remplacement des éléments défectueux. Remplacement de la chaudière ou du brûleur devenu inutilisable et vétuste.',
    tenantResponsibility: 'Entretien de l\'installation et protection contre le gel. Contrôle et entretien par technicien agréé conformément à la législation. Attestation d\'entretien à remettre sur demande. Maintenir robinetterie et vannes en bon état. Purge des radiateurs.',
    region: 'brussels',
    sourceId: 'brussels-snpc'
  },

  // SANITAIRES
  {
    id: 'b-san-1',
    category: 'sanitary',
    item: 'Baignoires et Douches',
    landlordResponsibility: 'Remplacement des éléments défectueux par suite d\'usure normale, vétusté, cas fortuit, force majeure ou vice de placement, sauf en cas de faute du preneur.',
    tenantResponsibility: 'Réparation des éclats dans les règles de l\'art. Entretien et remplacement du joint souple en périphérie. Responsable des dommages provoqués par infiltrations suite à défectuosité du joint non signalée. Entretien avec produits appropriés pour éviter l\'entartrage. Remplacement du flexible.',
    region: 'brussels',
    sourceId: 'brussels-snpc'
  },
  {
    id: 'b-san-2',
    category: 'sanitary',
    item: 'WC et Chasses d\'eau',
    landlordResponsibility: 'Remplacement des éléments défectueux, notamment le flotteur du réservoir, la chasse d\'eau ainsi que la totalité de l\'installation (sauf en cas de faute du preneur).',
    tenantResponsibility: 'Chasse: remplacement des joints et élimination du calcaire. Réparation et remplacement du dispositif de commande. Réglage du flotteur si nécessaire. WC: remplacement joints, manchon de raccord, charnières, sièges et couvercles brisés. Maintenir la cuvette en bon état de propreté.',
    region: 'brussels',
    sourceId: 'brussels-snpc'
  },

  // SÉCURITÉ
  {
    id: 'b-sec-1',
    category: 'security',
    item: 'Clés - Badges - Cartes magnétiques',
    landlordResponsibility: 'Remplacement des éléments défectueux par suite d\'usure normale, vétusté, cas fortuit, force majeure ou vice de placement.',
    tenantResponsibility: 'Entretien et graissage des serrures. Restituer toutes les clés (y compris exemplaires supplémentaires) et remplacer les clés manquantes, endommagées ou hors d\'usage. En cas de vol ou perte: remplacement de la/des serrure(s) concernée(s).',
    region: 'brussels',
    sourceId: 'brussels-snpc'
  },
  {
    id: 'b-sec-2',
    category: 'security',
    item: 'Détecteurs d\'incendie',
    landlordResponsibility: 'Placement initial et remplacement des éléments défectueux par suite d\'usure normale, vétusté, cas fortuit, force majeure ou vice de placement.',
    tenantResponsibility: 'Entretien et remplacement des piles usagées.',
    region: 'brussels',
    sourceId: 'brussels-snpc'
  },
];

// ============================================
// Combined Data and Helpers
// ============================================

export const ALL_REPAIRS: RepairResponsibility[] = [
  ...WALLONIA_REPAIRS,
  ...BRUSSELS_REPAIRS,
];

// Get repairs by region
export function getRepairsByRegion(region: Region): RepairResponsibility[] {
  return ALL_REPAIRS.filter(r => r.region === region);
}

// Get repairs by category
export function getRepairsByCategory(categoryId: string, region?: Region): RepairResponsibility[] {
  let repairs = ALL_REPAIRS.filter(r => r.category === categoryId);
  if (region) {
    repairs = repairs.filter(r => r.region === region);
  }
  return repairs;
}

// Search repairs
export function searchRepairs(query: string, region?: Region): RepairResponsibility[] {
  const lowerQuery = query.toLowerCase();
  let repairs = ALL_REPAIRS.filter(r => 
    r.item.toLowerCase().includes(lowerQuery) ||
    r.landlordResponsibility.toLowerCase().includes(lowerQuery) ||
    r.tenantResponsibility.toLowerCase().includes(lowerQuery) ||
    (r.notes && r.notes.toLowerCase().includes(lowerQuery))
  );
  if (region) {
    repairs = repairs.filter(r => r.region === region);
  }
  return repairs;
}

// Get category stats
export function getCategoryStats(region?: Region): LegalCategory[] {
  return LEGAL_CATEGORIES.map(cat => ({
    ...cat,
    itemCount: ALL_REPAIRS.filter(r => 
      r.category === cat.id && (!region || r.region === region)
    ).length
  }));
}

// ============================================
// Belgian Postal Code to Region Mapping
// ============================================

export function getRegionFromPostalCode(postalCode: string): Region | null {
  const code = parseInt(postalCode, 10);
  
  if (isNaN(code)) return null;
  
  // Brussels Capital Region: 1000-1299
  if (code >= 1000 && code <= 1299) {
    return 'brussels';
  }
  
  // Wallonia: 
  // - Walloon Brabant: 1300-1499
  // - Hainaut: 6000-6599, 7000-7999
  // - Liège: 4000-4999
  // - Luxembourg: 6600-6999
  // - Namur: 5000-5999
  if (
    (code >= 1300 && code <= 1499) ||
    (code >= 4000 && code <= 4999) ||
    (code >= 5000 && code <= 5999) ||
    (code >= 6000 && code <= 6999) ||
    (code >= 7000 && code <= 7999)
  ) {
    return 'wallonia';
  }
  
  // Flanders: everything else (1500-3999, 8000-9999)
  if (
    (code >= 1500 && code <= 3999) ||
    (code >= 8000 && code <= 9999)
  ) {
    return 'flanders';
  }
  
  return null;
}

// Get region display name
export function getRegionDisplayName(region: Region): string {
  const names: Record<Region, string> = {
    wallonia: 'Wallonie',
    brussels: 'Bruxelles-Capitale',
    flanders: 'Flandre'
  };
  return names[region];
}

// Get region flag/emoji
export function getRegionFlag(region: Region): string {
  const flags: Record<Region, string> = {
    wallonia: '🐓', // Coq wallon
    brussels: '🏛️', // Brussels
    flanders: '🦁'  // Flemish lion
  };
  return flags[region];
}
