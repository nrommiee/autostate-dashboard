'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  Scale, 
  TrendingDown, 
  DollarSign, 
  FileText
} from 'lucide-react';

const subNavItems = [
  {
    name: 'Cadre Juridique',
    href: '/dashboard/knowledge/legal',
    icon: Scale,
    description: 'Répartitions locatives, articles de loi'
  },
  {
    name: 'Grilles de Vétusté',
    href: '/dashboard/knowledge/depreciation',
    icon: TrendingDown,
    description: 'Durées de vie, taux d\'abattement'
  },
  {
    name: 'Prix Unitaires',
    href: '/dashboard/knowledge/prices',
    icon: DollarSign,
    description: 'Tarifs UGEB, taux horaires'
  },
];

export default function KnowledgeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="flex flex-col h-full">
      {/* Sub-navigation */}
      <div className="border-b border-gray-200 bg-white px-6 py-3">
        <div className="flex items-center gap-2 text-sm text-gray-500 mb-3">
          <FileText className="w-4 h-4" />
          <span>Base de Connaissances</span>
        </div>
        <div className="flex gap-2">
          {subNavItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`
                  flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors
                  ${isActive 
                    ? 'bg-teal-500 text-white' 
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }
                `}
              >
                <item.icon className="w-4 h-4" />
                {item.name}
              </Link>
            );
          })}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {children}
      </div>
    </div>
  );
}
