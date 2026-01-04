'use client'

import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { X, Plus, Check } from 'lucide-react'

export interface Keyword {
  id: string
  value: string
  source: 'ai' | 'manual'
  validated: boolean
}

interface KeywordsSelectorProps {
  keywords: Keyword[]
  onChange: (keywords: Keyword[]) => void
  disabled?: boolean
}

export function KeywordsSelector({ keywords, onChange, disabled }: KeywordsSelectorProps) {
  const [newKeyword, setNewKeyword] = useState('')

  const toggleKeyword = (id: string) => {
    if (disabled) return
    onChange(
      keywords.map(k => 
        k.id === id ? { ...k, validated: !k.validated } : k
      )
    )
  }

  const removeKeyword = (id: string) => {
    if (disabled) return
    onChange(keywords.filter(k => k.id !== id))
  }

  const addKeyword = () => {
    if (!newKeyword.trim() || disabled) return
    
    // Check if already exists
    if (keywords.some(k => k.value.toLowerCase() === newKeyword.toLowerCase())) {
      setNewKeyword('')
      return
    }

    onChange([
      ...keywords,
      {
        id: crypto.randomUUID(),
        value: newKeyword.trim(),
        source: 'manual',
        validated: true
      }
    ])
    setNewKeyword('')
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      addKeyword()
    }
  }

  const validatedCount = keywords.filter(k => k.validated).length

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-gray-600">
          {validatedCount} mot{validatedCount > 1 ? 's' : ''}-clé{validatedCount > 1 ? 's' : ''} validé{validatedCount > 1 ? 's' : ''}
        </div>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onChange(keywords.map(k => ({ ...k, validated: true })))}
            disabled={disabled}
          >
            Tout valider
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onChange(keywords.map(k => ({ ...k, validated: false })))}
            disabled={disabled}
          >
            Tout décocher
          </Button>
        </div>
      </div>

      {/* Keywords grid */}
      <div className="flex flex-wrap gap-2">
        {keywords.map((keyword) => (
          <Badge
            key={keyword.id}
            variant={keyword.validated ? 'default' : 'outline'}
            className={`
              cursor-pointer select-none transition-all py-1.5 px-3 text-sm
              ${keyword.validated 
                ? 'bg-teal-100 text-teal-800 border-teal-300 hover:bg-teal-200' 
                : 'bg-gray-50 text-gray-500 border-gray-300 hover:bg-gray-100'
              }
              ${keyword.source === 'ai' ? '' : 'border-dashed'}
              ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
            `}
            onClick={() => toggleKeyword(keyword.id)}
          >
            <span className="flex items-center gap-1.5">
              {keyword.validated && <Check className="h-3 w-3" />}
              {keyword.value}
              {keyword.source === 'ai' && (
                <span className="text-xs opacity-60">IA</span>
              )}
            </span>
            {!disabled && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  removeKeyword(keyword.id)
                }}
                className="ml-1.5 hover:text-red-600"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </Badge>
        ))}

        {keywords.length === 0 && (
          <div className="text-sm text-gray-400 italic">
            Aucun mot-clé détecté. Cliquez sur "Analyser" pour extraire les mots-clés de la photo.
          </div>
        )}
      </div>

      {/* Add manual keyword */}
      {!disabled && (
        <div className="flex gap-2">
          <Input
            placeholder="Ajouter un mot-clé..."
            value={newKeyword}
            onChange={(e) => setNewKeyword(e.target.value)}
            onKeyDown={handleKeyDown}
            className="flex-1"
          />
          <Button
            type="button"
            variant="outline"
            onClick={addKeyword}
            disabled={!newKeyword.trim()}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  )
}

export default KeywordsSelector
