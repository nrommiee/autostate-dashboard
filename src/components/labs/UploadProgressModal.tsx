'use client'

import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { 
  Upload, 
  CheckCircle2, 
  XCircle, 
  Loader2, 
  Clock, 
  FolderOpen,
  AlertTriangle,
  X,
  RotateCcw,
  ChevronDown,
  ChevronUp
} from 'lucide-react'

// ============================================
// TYPES
// ============================================

export interface UploadState {
  status: 'idle' | 'compressing' | 'uploading' | 'completed' | 'error' | 'cancelled'
  totalFiles: number
  completedFiles: number
  currentBatch: number
  totalBatches: number
  
  // Compteurs détaillés
  uploadedCount: number
  analyzedCount: number
  errorCount: number
  
  // Fichiers en erreur
  errors: { filename: string; error: string }[]
  
  // Dossiers créés/utilisés
  foldersCreated: string[]
  
  // Temps
  startTime: number | null
  estimatedRemainingMs: number | null
  
  // Pour reprise
  pendingFiles: string[] // noms des fichiers pas encore traités
}

interface UploadProgressModalProps {
  open: boolean
  state: UploadState
  onClose: () => void
  onCancel: () => void
  onRetryErrors: () => void
}

// ============================================
// HELPERS
// ============================================

function formatTime(ms: number): string {
  if (ms < 1000) return '< 1 sec'
  const seconds = Math.floor(ms / 1000)
  if (seconds < 60) return `${seconds} sec`
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60
  if (minutes < 60) return `${minutes} min ${remainingSeconds > 0 ? remainingSeconds + ' sec' : ''}`
  const hours = Math.floor(minutes / 60)
  const remainingMinutes = minutes % 60
  return `${hours}h ${remainingMinutes}min`
}

function formatTimeShort(ms: number): string {
  if (ms < 1000) return '< 1s'
  const seconds = Math.floor(ms / 1000)
  if (seconds < 60) return `~${seconds}s`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `~${minutes}min`
  const hours = Math.floor(minutes / 60)
  const remainingMinutes = minutes % 60
  return `~${hours}h${remainingMinutes > 0 ? remainingMinutes + 'm' : ''}`
}

// ============================================
// COMPONENT
// ============================================

export function UploadProgressModal({ 
  open, 
  state, 
  onClose, 
  onCancel,
  onRetryErrors 
}: UploadProgressModalProps) {
  const [showErrors, setShowErrors] = useState(false)
  const [elapsedTime, setElapsedTime] = useState(0)
  
  // Update elapsed time
  useEffect(() => {
    if (state.status === 'uploading' && state.startTime) {
      const interval = setInterval(() => {
        setElapsedTime(Date.now() - state.startTime!)
      }, 1000)
      return () => clearInterval(interval)
    }
  }, [state.status, state.startTime])
  
  const progress = state.totalFiles > 0 
    ? Math.round((state.completedFiles / state.totalFiles) * 100) 
    : 0
    
  const isActive = state.status === 'compressing' || state.status === 'uploading'
  const isCompleted = state.status === 'completed'
  const hasErrors = state.errorCount > 0
  
  // Calcul temps restant estimé
  const avgTimePerFile = state.completedFiles > 0 && elapsedTime > 0
    ? elapsedTime / state.completedFiles
    : 3000 // Estimation par défaut: 3 sec/photo
  const remainingFiles = state.totalFiles - state.completedFiles
  const estimatedRemaining = remainingFiles * avgTimePerFile

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !isActive && onClose()}>
      <DialogContent className="sm:max-w-lg" onPointerDownOutside={(e) => isActive && e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isActive && <Loader2 className="h-5 w-5 animate-spin text-teal-600" />}
            {isCompleted && !hasErrors && <CheckCircle2 className="h-5 w-5 text-green-600" />}
            {isCompleted && hasErrors && <AlertTriangle className="h-5 w-5 text-orange-500" />}
            {state.status === 'error' && <XCircle className="h-5 w-5 text-red-600" />}
            {state.status === 'cancelled' && <X className="h-5 w-5 text-gray-500" />}
            
            {state.status === 'compressing' && 'Compression des images...'}
            {state.status === 'uploading' && 'Import en cours...'}
            {state.status === 'completed' && (hasErrors ? 'Import terminé avec erreurs' : 'Import terminé !')}
            {state.status === 'error' && 'Erreur d\'import'}
            {state.status === 'cancelled' && 'Import annulé'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Progress bar principale */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Progression</span>
              <span className="font-medium">{state.completedFiles} / {state.totalFiles}</span>
            </div>
            <Progress value={progress} className="h-3" />
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{progress}%</span>
              {isActive && estimatedRemaining > 0 && (
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  Restant : {formatTimeShort(estimatedRemaining)}
                </span>
              )}
            </div>
          </div>

          {/* Stats détaillées */}
          <div className="grid grid-cols-3 gap-3">
            <Card className="p-3 text-center">
              <div className="flex items-center justify-center gap-1 mb-1">
                <Upload className="h-4 w-4 text-blue-500" />
              </div>
              <p className="text-2xl font-bold text-blue-600">{state.uploadedCount}</p>
              <p className="text-xs text-muted-foreground">Uploadées</p>
            </Card>
            
            <Card className="p-3 text-center">
              <div className="flex items-center justify-center gap-1 mb-1">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
              </div>
              <p className="text-2xl font-bold text-green-600">{state.analyzedCount}</p>
              <p className="text-xs text-muted-foreground">Analysées IA</p>
            </Card>
            
            <Card className="p-3 text-center">
              <div className="flex items-center justify-center gap-1 mb-1">
                <XCircle className="h-4 w-4 text-red-500" />
              </div>
              <p className="text-2xl font-bold text-red-600">{state.errorCount}</p>
              <p className="text-xs text-muted-foreground">Erreurs</p>
            </Card>
          </div>

          {/* Dossiers créés */}
          {state.foldersCreated.length > 0 && (
            <div className="p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <FolderOpen className="h-4 w-4 text-teal-600" />
                <span className="text-sm font-medium">Dossiers ({state.foldersCreated.length})</span>
              </div>
              <div className="flex flex-wrap gap-1">
                {state.foldersCreated.slice(0, 5).map((folder, i) => (
                  <Badge key={i} variant="secondary" className="text-xs">
                    {folder}
                  </Badge>
                ))}
                {state.foldersCreated.length > 5 && (
                  <Badge variant="outline" className="text-xs">
                    +{state.foldersCreated.length - 5} autres
                  </Badge>
                )}
              </div>
            </div>
          )}

          {/* Temps écoulé */}
          {(isActive || isCompleted) && elapsedTime > 0 && (
            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <Clock className="h-4 w-4" />
              Temps écoulé : {formatTime(elapsedTime)}
            </div>
          )}

          {/* Erreurs détaillées */}
          {hasErrors && (
            <div className="border rounded-lg overflow-hidden">
              <button 
                onClick={() => setShowErrors(!showErrors)}
                className="w-full flex items-center justify-between p-3 bg-red-50 hover:bg-red-100 transition-colors"
              >
                <span className="flex items-center gap-2 text-sm font-medium text-red-700">
                  <AlertTriangle className="h-4 w-4" />
                  {state.errorCount} erreur(s)
                </span>
                {showErrors ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </button>
              
              {showErrors && (
                <div className="max-h-32 overflow-y-auto p-2 space-y-1 bg-white">
                  {state.errors.map((err, i) => (
                    <div key={i} className="text-xs p-2 bg-red-50 rounded">
                      <span className="font-medium">{err.filename}</span>
                      <span className="text-red-600 ml-2">{err.error}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between pt-2 border-t">
          {isActive ? (
            <>
              <p className="text-xs text-muted-foreground">
                Ne fermez pas cette fenêtre
              </p>
              <Button variant="outline" onClick={onCancel} className="text-red-600">
                <X className="h-4 w-4 mr-2" />
                Annuler
              </Button>
            </>
          ) : (
            <>
              {hasErrors && (
                <Button variant="outline" onClick={onRetryErrors}>
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Réessayer les erreurs
                </Button>
              )}
              <div className="flex-1" />
              <Button onClick={onClose}>
                Fermer
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ============================================
// UPLOAD MANAGER HOOK
// ============================================

const STORAGE_KEY = 'autostate_upload_state'
const CONCURRENT_UPLOADS = 5

interface UseUploadManagerOptions {
  onComplete?: () => void
  onError?: (error: string) => void
}

export function useUploadManager(options: UseUploadManagerOptions = {}) {
  const [state, setState] = useState<UploadState>({
    status: 'idle',
    totalFiles: 0,
    completedFiles: 0,
    currentBatch: 0,
    totalBatches: 0,
    uploadedCount: 0,
    analyzedCount: 0,
    errorCount: 0,
    errors: [],
    foldersCreated: [],
    startTime: null,
    estimatedRemainingMs: null,
    pendingFiles: [],
  })
  
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [cancelRequested, setCancelRequested] = useState(false)
  
  // Restore state from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        // Only restore if there are pending files
        if (parsed.pendingFiles?.length > 0 && parsed.status !== 'completed') {
          setState(parsed)
          setIsModalOpen(true)
        }
      } catch (e) {
        localStorage.removeItem(STORAGE_KEY)
      }
    }
  }, [])
  
  // Save state to localStorage
  const saveState = (newState: UploadState) => {
    setState(newState)
    if (newState.status !== 'idle' && newState.status !== 'completed') {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newState))
    } else {
      localStorage.removeItem(STORAGE_KEY)
    }
  }
  
  // Compress image
  const compressImage = async (file: File): Promise<File> => {
    return new Promise((resolve, reject) => {
      if (file.size < 500 * 1024) {
        resolve(file)
        return
      }
      
      const img = new window.Image()
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')
      
      img.onload = () => {
        let { width, height } = img
        const MAX = 1200
        
        if (width > height && width > MAX) {
          height = Math.round((height * MAX) / width)
          width = MAX
        } else if (height > MAX) {
          width = Math.round((width * MAX) / height)
          height = MAX
        }
        
        canvas.width = width
        canvas.height = height
        ctx?.drawImage(img, 0, 0, width, height)
        
        canvas.toBlob(
          blob => blob 
            ? resolve(new File([blob], file.name, { type: 'image/jpeg' }))
            : reject(new Error('Compression failed')),
          'image/jpeg',
          0.8
        )
      }
      
      img.onerror = () => reject(new Error('Failed to load image'))
      img.src = URL.createObjectURL(file)
    })
  }
  
  // Upload single file
  const uploadFile = async (file: File): Promise<{ success: boolean; folder?: string; error?: string }> => {
    try {
      // Compress
      let compressed: File
      try {
        compressed = await compressImage(file)
      } catch {
        compressed = file
      }
      
      // Convert to base64 for the form
      const formData = new FormData()
      formData.append('files', compressed)
      formData.append('auto_cluster', 'true')
      
      const res = await fetch('/api/labs/experiments/photos', {
        method: 'POST',
        body: formData,
      })
      
      if (!res.ok) {
        const error = await res.json()
        return { success: false, error: error.error || 'Upload failed' }
      }
      
      const data = await res.json()
      
      if (data.error_count > 0 && data.errors?.length > 0) {
        return { success: false, error: data.errors[0].error }
      }
      
      // Get folder name from response
      const folderName = data.uploaded?.[0]?.experiment_folders?.name || 'Non classé'
      
      return { success: true, folder: folderName }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  }
  
  // Process files in parallel batches
  const processFiles = async (files: File[]) => {
    const totalFiles = files.length
    const totalBatches = Math.ceil(totalFiles / CONCURRENT_UPLOADS)
    
    const newState: UploadState = {
      status: 'uploading',
      totalFiles,
      completedFiles: 0,
      currentBatch: 0,
      totalBatches,
      uploadedCount: 0,
      analyzedCount: 0,
      errorCount: 0,
      errors: [],
      foldersCreated: [],
      startTime: Date.now(),
      estimatedRemainingMs: null,
      pendingFiles: files.map(f => f.name),
    }
    
    saveState(newState)
    setIsModalOpen(true)
    setCancelRequested(false)
    
    const foldersSet = new Set<string>()
    let completed = 0
    let uploaded = 0
    let analyzed = 0
    let errors: { filename: string; error: string }[] = []
    
    // Process in batches
    for (let batch = 0; batch < totalBatches; batch++) {
      if (cancelRequested) {
        saveState({
          ...newState,
          status: 'cancelled',
          completedFiles: completed,
          uploadedCount: uploaded,
          analyzedCount: analyzed,
          errorCount: errors.length,
          errors,
          foldersCreated: Array.from(foldersSet),
          pendingFiles: files.slice(completed).map(f => f.name),
        })
        return
      }
      
      const start = batch * CONCURRENT_UPLOADS
      const end = Math.min(start + CONCURRENT_UPLOADS, totalFiles)
      const batchFiles = files.slice(start, end)
      
      // Update state for current batch
      saveState({
        ...newState,
        currentBatch: batch + 1,
        completedFiles: completed,
        uploadedCount: uploaded,
        analyzedCount: analyzed,
        errorCount: errors.length,
        errors,
        foldersCreated: Array.from(foldersSet),
        pendingFiles: files.slice(completed).map(f => f.name),
      })
      
      // Process batch in parallel
      const results = await Promise.all(
        batchFiles.map(file => uploadFile(file))
      )
      
      // Update counts
      for (let i = 0; i < results.length; i++) {
        const result = results[i]
        completed++
        
        if (result.success) {
          uploaded++
          analyzed++ // Since we wait for Claude
          if (result.folder) {
            foldersSet.add(result.folder)
          }
        } else {
          errors.push({
            filename: batchFiles[i].name,
            error: result.error || 'Unknown error',
          })
        }
      }
      
      // Update state after batch
      saveState({
        ...newState,
        completedFiles: completed,
        uploadedCount: uploaded,
        analyzedCount: analyzed,
        errorCount: errors.length,
        errors,
        foldersCreated: Array.from(foldersSet),
        pendingFiles: files.slice(completed).map(f => f.name),
      })
    }
    
    // Complete
    const finalState: UploadState = {
      status: 'completed',
      totalFiles,
      completedFiles: completed,
      currentBatch: totalBatches,
      totalBatches,
      uploadedCount: uploaded,
      analyzedCount: analyzed,
      errorCount: errors.length,
      errors,
      foldersCreated: Array.from(foldersSet),
      startTime: newState.startTime,
      estimatedRemainingMs: 0,
      pendingFiles: [],
    }
    
    saveState(finalState)
    options.onComplete?.()
  }
  
  // Start upload
  const startUpload = async (files: FileList | File[]) => {
    const fileArray = Array.from(files)
    
    if (fileArray.length === 0) return
    
    if (fileArray.length > 50) {
      options.onError?.('Maximum 50 photos par import')
      return
    }
    
    // Compression phase
    saveState({
      ...state,
      status: 'compressing',
      totalFiles: fileArray.length,
      completedFiles: 0,
      startTime: Date.now(),
    })
    setIsModalOpen(true)
    
    await processFiles(fileArray)
  }
  
  // Cancel upload
  const cancelUpload = () => {
    setCancelRequested(true)
  }
  
  // Retry errors
  const retryErrors = () => {
    // This would need the original files - for now just close
    localStorage.removeItem(STORAGE_KEY)
    saveState({
      ...state,
      status: 'idle',
      errors: [],
      errorCount: 0,
    })
  }
  
  // Close modal
  const closeModal = () => {
    if (state.status !== 'uploading' && state.status !== 'compressing') {
      setIsModalOpen(false)
      if (state.status === 'completed') {
        localStorage.removeItem(STORAGE_KEY)
        saveState({
          status: 'idle',
          totalFiles: 0,
          completedFiles: 0,
          currentBatch: 0,
          totalBatches: 0,
          uploadedCount: 0,
          analyzedCount: 0,
          errorCount: 0,
          errors: [],
          foldersCreated: [],
          startTime: null,
          estimatedRemainingMs: null,
          pendingFiles: [],
        })
      }
    }
  }
  
  return {
    state,
    isModalOpen,
    startUpload,
    cancelUpload,
    retryErrors,
    closeModal,
  }
}
