import { useState, useCallback } from 'react'

interface KeywordEditorProps {
  keywords: string[]
  onChange: (keywords: string[]) => void
  disabled?: boolean
  minKeywords?: number
  maxKeywords?: number
}

/**
 * KeywordEditor: Editable keyword chips with add/delete.
 *
 * Displays visual search keywords as interactive pills.
 * Users can:
 * - Delete a keyword (click X)
 * - Edit a keyword (click on text)
 * - Add new keywords (via input field)
 * - Min 3, max 10 keywords enforced
 */
export function KeywordEditor({
  keywords,
  onChange,
  disabled = false,
  minKeywords = 3,
  maxKeywords = 10,
}: KeywordEditorProps) {
  const [newKeyword, setNewKeyword] = useState('')
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const [editValue, setEditValue] = useState('')

  const handleRemove = useCallback((index: number) => {
    if (keywords.length <= minKeywords) return
    const updated = keywords.filter((_, i) => i !== index)
    onChange(updated)
  }, [keywords, onChange, minKeywords])

  const handleAdd = useCallback(() => {
    const trimmed = newKeyword.trim()
    if (!trimmed) return
    if (keywords.length >= maxKeywords) return
    if (keywords.some(k => k.toLowerCase() === trimmed.toLowerCase())) return

    onChange([...keywords, trimmed])
    setNewKeyword('')
  }, [newKeyword, keywords, onChange, maxKeywords])

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleAdd()
    }
  }, [handleAdd])

  const startEdit = useCallback((index: number) => {
    if (disabled) return
    setEditingIndex(index)
    setEditValue(keywords[index])
  }, [keywords, disabled])

  const finishEdit = useCallback(() => {
    if (editingIndex === null) return
    const trimmed = editValue.trim()
    if (trimmed && trimmed !== keywords[editingIndex]) {
      // Check for duplicates
      if (!keywords.some((k, i) => i !== editingIndex && k.toLowerCase() === trimmed.toLowerCase())) {
        const updated = [...keywords]
        updated[editingIndex] = trimmed
        onChange(updated)
      }
    }
    setEditingIndex(null)
    setEditValue('')
  }, [editingIndex, editValue, keywords, onChange])

  const handleEditKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      finishEdit()
    } else if (e.key === 'Escape') {
      setEditingIndex(null)
      setEditValue('')
    }
  }, [finishEdit])

  const canRemove = keywords.length > minKeywords
  const canAdd = keywords.length < maxKeywords

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-slate-300">
          Visual Keywords
        </label>
        <span className="text-xs text-slate-500">
          {keywords.length}/{maxKeywords} keywords
        </span>
      </div>

      {/* Keyword chips */}
      <div className="flex flex-wrap gap-2">
        {keywords.map((keyword, index) => (
          <div
            key={`${keyword}-${index}`}
            className="group inline-flex items-center gap-1.5 px-3 py-1.5
              bg-slate-700/50 border border-slate-600/50 rounded-full
              hover:border-purple-500/40 transition-all"
          >
            {editingIndex === index ? (
              <input
                type="text"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onBlur={finishEdit}
                onKeyDown={handleEditKeyDown}
                autoFocus
                className="bg-transparent text-white text-sm outline-none w-24"
              />
            ) : (
              <span
                onClick={() => startEdit(index)}
                className="text-sm text-slate-200 cursor-pointer hover:text-white transition-colors"
                title="Click to edit"
              >
                {keyword}
              </span>
            )}

            {canRemove && !disabled && editingIndex !== index && (
              <button
                type="button"
                onClick={() => handleRemove(index)}
                className="w-4 h-4 flex items-center justify-center rounded-full
                  text-slate-500 hover:text-red-400 hover:bg-red-500/10
                  opacity-0 group-hover:opacity-100 transition-all"
                title="Remove keyword"
              >
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Add new keyword */}
      {canAdd && !disabled && (
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <input
              type="text"
              value={newKeyword}
              onChange={(e) => setNewKeyword(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Add a keyword..."
              maxLength={50}
              className="w-full px-3 py-2 bg-slate-800/50 border border-slate-700/50 rounded-lg
                text-sm text-white placeholder-slate-500
                focus:outline-none focus:ring-1 focus:ring-purple-500/50 focus:border-purple-500/50
                transition-all"
            />
          </div>
          <button
            type="button"
            onClick={handleAdd}
            disabled={!newKeyword.trim()}
            className="px-3 py-2 rounded-lg text-sm font-medium
              bg-slate-700 text-slate-300
              hover:bg-slate-600 hover:text-white
              disabled:opacity-30 disabled:cursor-not-allowed
              transition-all"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
          </button>
        </div>
      )}

      {/* Hint text */}
      <p className="text-xs text-slate-500">
        These keywords will be used to find matching stock video clips.
        Click a keyword to edit, hover to delete.
      </p>
    </div>
  )
}
