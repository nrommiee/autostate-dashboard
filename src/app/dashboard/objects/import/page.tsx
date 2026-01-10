'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { SOURCE_TYPE_CONFIG, DocumentSourceType } from '@/lib/objects-types'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { 
  ArrowLeft, Upload, FileText, Loader2, CheckCircle, 
  XCircle, AlertTriangle, Sparkles, FolderOpen, Trash2
} from 'lucide-react'

interface UploadedFile {
  id: string
  file: File
  name: string
  size: number
  status: 'pending' | 'uploading' | 'processing' | 'completed' | 'error'
  progress: number
  error?: string
  result?: {
    objects: number
    attributes: number
    damages: number
    cost: number
  }
}

export default function ImportPage() {
  const router = useRouter()
  
  const [sourceType, setSourceType] = useState<DocumentSourceType>('inspection_report')
  const [files, setFiles] = useState<UploadedFile[]>([])
  const [processing, setProcessing] = useState(false)
  const [dragActive, setDragActive] = useState(false)

  // Handle file selection
  const handleFiles = useCallback((newFiles: FileList | null) => {
    if (!newFiles) return
    
    const uploadFiles: UploadedFile[] = Array.from(newFiles).map(file => ({
      id: Math.random().toString(36).substr(2, 9),
      file,
      name: file.name,
      size: file.size,
      status: 'pending',
      progress: 0
    }))
    
    setFiles(prev => [...prev, ...uploadFiles])
  }, [])

  // Drag and drop handlers
  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    handleFiles(e.dataTransfer.files)
  }, [handleFiles])

  // Remove file
  const removeFile = (id: string) => {
    setFiles(prev => prev.filter(f => f.id !== id))
  }

  // Process all files
  const processFiles = async () => {
    if (files.length === 0) return
    
    setProcessing(true)
    
    for (const file of files) {
      if (file.status !== 'pending') continue
      
      // Update status to uploading
      setFiles(prev => prev.map(f => 
        f.id === file.id ? { ...f, status: 'uploading', progress: 10 } : f
      ))

      try {
        // 1. Upload file to Supabase Storage
        const fileName = `${Date.now()}_${file.name}`
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('imports')
          .upload(fileName, file.file)

        if (uploadError) throw uploadError

        setFiles(prev => prev.map(f => 
          f.id === file.id ? { ...f, progress: 30 } : f
        ))

        // 2. Create document record
        const { data: docData, error: docError } = await supabase
          .from('imported_documents')
          .insert({
            original_filename: file.name,
            file_url: uploadData.path,
            file_type: file.file.type.includes('pdf') ? 'pdf' : 
                       file.file.type.includes('word') ? 'word' : 
                       file.file.type.includes('image') ? 'image' : 'other',
            file_size_bytes: file.size,
            source_type: sourceType,
            status: 'processing',
            processing_started_at: new Date().toISOString()
          })
          .select()
          .single()

        if (docError) throw docError

        setFiles(prev => prev.map(f => 
          f.id === file.id ? { ...f, status: 'processing', progress: 50 } : f
        ))

        // 3. Call extraction API (simulated for now - you'll connect to Claude API)
        // In production, this would call your /api/extract-objects endpoint
        const extractionResult = await simulateExtraction(docData.id)

        setFiles(prev => prev.map(f => 
          f.id === file.id ? { ...f, progress: 90 } : f
        ))

        // 4. Update document with results
        await supabase
          .from('imported_documents')
          .update({
            status: 'completed',
            processing_completed_at: new Date().toISOString(),
            objects_extracted: extractionResult.objects,
            attributes_extracted: extractionResult.attributes,
            damages_extracted: extractionResult.damages,
            extraction_cost_usd: extractionResult.cost
          })
          .eq('id', docData.id)

        setFiles(prev => prev.map(f => 
          f.id === file.id ? { 
            ...f, 
            status: 'completed', 
            progress: 100,
            result: extractionResult
          } : f
        ))

      } catch (error) {
        console.error('Error processing file:', error)
        setFiles(prev => prev.map(f => 
          f.id === file.id ? { 
            ...f, 
            status: 'error', 
            error: error instanceof Error ? error.message : 'Erreur inconnue'
          } : f
        ))
      }
    }
    
    setProcessing(false)
  }

  // Simulated extraction (replace with real API call)
  async function simulateExtraction(docId: string): Promise<{
    objects: number
    attributes: number
    damages: number
    cost: number
  }> {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 2000))
    
    // In production, this would:
    // 1. Read the document content
    // 2. Send to Claude API with extraction prompt
    // 3. Parse response and create objects in database
    // 4. Return stats
    
    return {
      objects: Math.floor(Math.random() * 20) + 5,
      attributes: Math.floor(Math.random() * 50) + 10,
      damages: Math.floor(Math.random() * 30) + 5,
      cost: Math.random() * 0.05
    }
  }

  const sourceConfig = SOURCE_TYPE_CONFIG[sourceType]
  const pendingCount = files.filter(f => f.status === 'pending').length
  const completedCount = files.filter(f => f.status === 'completed').length

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/dashboard/objects">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Upload className="h-7 w-7 text-teal-600" />
            Importer des documents
          </h1>
          <p className="text-muted-foreground">
            Extraire automatiquement les objets depuis vos documents
          </p>
        </div>
      </div>

      {/* Source Type Selection */}
      <Card className="p-6">
        <h2 className="font-semibold mb-4">Type de source</h2>
        <Select value={sourceType} onValueChange={(v) => setSourceType(v as DocumentSourceType)}>
          <SelectTrigger className="w-full max-w-md">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(SOURCE_TYPE_CONFIG).map(([key, config]) => (
              <SelectItem key={key} value={key}>
                <div className="flex items-center gap-2">
                  <span>{config.icon}</span>
                  <span>{config.label}</span>
                  <Badge variant="secondary" className="ml-2">{config.targetBase}</Badge>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        
        <div className="mt-4 p-4 bg-muted/50 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-2xl">{sourceConfig.icon}</span>
            <span className="font-medium">{sourceConfig.label}</span>
            <Badge>{sourceConfig.targetBase}</Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {sourceConfig.description}
          </p>
        </div>
      </Card>

      {/* Upload Zone */}
      <Card className="p-6">
        <h2 className="font-semibold mb-4">Fichiers à traiter</h2>
        
        {/* Drag & Drop Zone */}
        <div
          className={`
            border-2 border-dashed rounded-lg p-8 text-center transition-colors
            ${dragActive ? 'border-teal-500 bg-teal-50' : 'border-gray-300 hover:border-gray-400'}
          `}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
        >
          <FolderOpen className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <p className="text-lg font-medium mb-2">
            Glissez vos fichiers ici
          </p>
          <p className="text-sm text-muted-foreground mb-4">
            Word, PDF, Images • Max 10MB par fichier
          </p>
          <label>
            <input
              type="file"
              multiple
              accept=".doc,.docx,.pdf,.png,.jpg,.jpeg"
              className="hidden"
              onChange={(e) => handleFiles(e.target.files)}
            />
            <Button variant="outline" asChild>
              <span>Parcourir les fichiers</span>
            </Button>
          </label>
        </div>

        {/* File List */}
        {files.length > 0 && (
          <div className="mt-6 space-y-3">
            {files.map(file => (
              <div 
                key={file.id}
                className="flex items-center gap-4 p-4 border rounded-lg"
              >
                <div className="p-2 bg-muted rounded">
                  <FileText className="h-6 w-6 text-muted-foreground" />
                </div>
                
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{file.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {(file.size / 1024).toFixed(1)} KB
                  </p>
                  
                  {file.status === 'uploading' || file.status === 'processing' ? (
                    <div className="mt-2">
                      <Progress value={file.progress} className="h-2" />
                      <p className="text-xs text-muted-foreground mt-1">
                        {file.status === 'uploading' ? 'Envoi...' : 'Extraction IA en cours...'}
                      </p>
                    </div>
                  ) : null}
                  
                  {file.status === 'completed' && file.result && (
                    <div className="flex items-center gap-2 mt-2 text-xs">
                      <Badge variant="secondary" className="bg-green-100 text-green-700">
                        {file.result.objects} objets
                      </Badge>
                      <Badge variant="secondary">
                        {file.result.attributes} attributs
                      </Badge>
                      <Badge variant="secondary">
                        {file.result.damages} dégâts
                      </Badge>
                      <span className="text-muted-foreground">
                        Coût: ${file.result.cost.toFixed(4)}
                      </span>
                    </div>
                  )}
                  
                  {file.status === 'error' && (
                    <p className="text-xs text-red-600 mt-1">
                      {file.error}
                    </p>
                  )}
                </div>
                
                <div className="flex items-center gap-2">
                  {file.status === 'pending' && (
                    <Badge variant="secondary">En attente</Badge>
                  )}
                  {file.status === 'uploading' && (
                    <Loader2 className="h-5 w-5 animate-spin text-teal-600" />
                  )}
                  {file.status === 'processing' && (
                    <Sparkles className="h-5 w-5 text-teal-600 animate-pulse" />
                  )}
                  {file.status === 'completed' && (
                    <CheckCircle className="h-5 w-5 text-green-600" />
                  )}
                  {file.status === 'error' && (
                    <XCircle className="h-5 w-5 text-red-600" />
                  )}
                  
                  {(file.status === 'pending' || file.status === 'error') && (
                    <Button 
                      variant="ghost" 
                      size="icon"
                      onClick={() => removeFile(file.id)}
                    >
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Actions */}
        {files.length > 0 && (
          <div className="mt-6 flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              {pendingCount > 0 && <span>{pendingCount} fichier(s) en attente • </span>}
              {completedCount > 0 && <span className="text-green-600">{completedCount} traité(s)</span>}
            </div>
            
            <div className="flex items-center gap-2">
              <Button 
                variant="outline" 
                onClick={() => setFiles([])}
                disabled={processing}
              >
                Tout effacer
              </Button>
              <Button 
                onClick={processFiles}
                disabled={processing || pendingCount === 0}
              >
                {processing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Traitement...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 mr-2" />
                    Lancer l'extraction ({pendingCount})
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Info */}
      <Card className="p-6 bg-blue-50 border-blue-200">
        <div className="flex gap-4">
          <AlertTriangle className="h-6 w-6 text-blue-600 flex-shrink-0" />
          <div>
            <h3 className="font-medium text-blue-900 mb-1">Comment ça marche ?</h3>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>1. Sélectionnez le type de source correspondant à vos documents</li>
              <li>2. Uploadez vos fichiers (rapports, catalogues, photos, devis...)</li>
              <li>3. L'IA analyse chaque document et extrait automatiquement les données</li>
              <li>4. Les objets extraits apparaissent dans le référentiel avec le statut "En attente"</li>
              <li>5. Validez ou rejetez les extractions dans le dashboard</li>
            </ul>
            <p className="text-xs text-blue-600 mt-3">
              💡 Coût estimé : ~0.02-0.05€ par rapport traité
            </p>
          </div>
        </div>
      </Card>
    </div>
  )
}
