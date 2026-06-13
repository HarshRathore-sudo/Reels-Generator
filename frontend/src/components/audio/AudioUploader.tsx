import { useState, useCallback, useRef } from 'react'
import { useAudioUpload } from '../../hooks/useAudioUpload'
import type { AudioFile } from '../../types'

const ALLOWED_EXTENSIONS = ['.mp3', '.wav', '.m4a', '.aac', '.ogg', '.flac', '.wma', '.webm']
const MAX_FILE_SIZE = 50 * 1024 * 1024 // 50MB

interface AudioUploaderProps {
  projectId: string
  /** Called when upload is confirmed. Passes AudioFile + original File */
  onUploadComplete: (audio: AudioFile, file: File) => void
}

export function AudioUploader({ projectId, onUploadComplete }: AudioUploaderProps) {
  const { uploadFile, progress, isUploading, error, clearError } = useAudioUpload(projectId)
  const [isDragOver, setIsDragOver] = useState(false)
  const [validationError, setValidationError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const validateFile = useCallback((file: File): string | null => {
    const name = file.name.toLowerCase()
    const hasValidExt = ALLOWED_EXTENSIONS.some(ext => name.endsWith(ext))
    if (!hasValidExt) {
      return `Unsupported format. Allowed: ${ALLOWED_EXTENSIONS.join(', ')}`
    }
    if (file.size > MAX_FILE_SIZE) {
      return `File too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Maximum: 50MB`
    }
    return null
  }, [])

  const handleFile = useCallback(async (file: File) => {
    clearError()
    setValidationError(null)

    const validErr = validateFile(file)
    if (validErr) {
      setValidationError(validErr)
      return
    }

    const result = await uploadFile(file)
    if (result) {
      onUploadComplete(result, file)
    }
  }, [uploadFile, onUploadComplete, clearError, validateFile])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)

    const files = e.dataTransfer.files
    if (files.length > 0) {
      handleFile(files[0])
    }
  }, [handleFile])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)
  }, [])

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files && files.length > 0) {
      handleFile(files[0])
    }
    // Reset input so same file can be selected again
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }, [handleFile])

  const handleClick = () => {
    if (!isUploading) {
      fileInputRef.current?.click()
    }
  }

  const displayError = validationError || error

  return (
    <div className="w-full">
      {/* Drop Zone */}
      <div
        onClick={handleClick}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={`
          relative border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer
          transition-all duration-200
          ${isDragOver
            ? 'border-purple-400 bg-purple-500/10 scale-[1.01]'
            : 'border-slate-600 hover:border-slate-500 hover:bg-slate-800/50'
          }
          ${isUploading ? 'pointer-events-none opacity-70' : ''}
        `}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="audio/*"
          onChange={handleFileInput}
          className="hidden"
          aria-label="Upload audio file"
        />

        {isUploading ? (
          <div className="space-y-4">
            <div className="flex justify-center">
              <svg className="w-12 h-12 text-purple-400 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            </div>
            <p className="text-slate-300 font-medium">Uploading audio...</p>
            <div className="max-w-xs mx-auto">
              <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-purple-500 rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="text-sm text-slate-400 mt-1">{progress}%</p>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex justify-center">
              <svg className="w-12 h-12 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 8.25H7.5a2.25 2.25 0 00-2.25 2.25v9a2.25 2.25 0 002.25 2.25h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25H15m0-3l-3-3m0 0l-3 3m3-3v11.25" />
              </svg>
            </div>
            <div>
              <p className="text-slate-200 font-medium text-lg">
                Drop your audio file here
              </p>
              <p className="text-slate-400 text-sm mt-1">
                or click to browse
              </p>
            </div>
            <p className="text-slate-500 text-xs">
              MP3, WAV, M4A, AAC, OGG, FLAC, WMA, WebM (max 50MB)
            </p>
          </div>
        )}
      </div>

      {/* Error message */}
      {displayError && (
        <div className="mt-3 flex items-center gap-2 text-red-400 text-sm">
          <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>{displayError}</span>
        </div>
      )}
    </div>
  )
}
