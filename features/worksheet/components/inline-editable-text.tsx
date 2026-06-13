"use client"

import { useEffect, useRef, useState, type RefObject } from "react"

import { cn } from "@/lib/utils"

type InlineEditableTextProps = {
  value: string
  onChange: (value: string) => void
  editable: boolean
  multiline?: boolean
  className?: string
  inputClassName?: string
  ariaLabel: string
}

export function InlineEditableText({
  value,
  onChange,
  editable,
  multiline = false,
  className,
  inputClassName,
  ariaLabel,
}: InlineEditableTextProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null)

  useEffect(() => {
    if (!isEditing) {
      setDraft(value)
    }
  }, [value, isEditing])

  useEffect(() => {
    if (!isEditing) {
      return
    }

    inputRef.current?.focus()
    inputRef.current?.select()
  }, [isEditing])

  function commit() {
    const trimmed = draft.trim()
    if (trimmed) {
      onChange(trimmed)
    } else {
      setDraft(value)
    }
    setIsEditing(false)
  }

  function cancel() {
    setDraft(value)
    setIsEditing(false)
  }

  if (!editable) {
    if (multiline) {
      return <p className={className}>{value}</p>
    }

    return <span className={className}>{value}</span>
  }

  if (isEditing) {
    const sharedClassName = cn(
      "w-full resize-none border-0 bg-transparent p-0 shadow-none outline-none ring-1 ring-primary/30",
      "print:border-0 print:ring-0 print:shadow-none",
      inputClassName
    )

    if (multiline) {
      return (
        <textarea
          ref={inputRef as RefObject<HTMLTextAreaElement>}
          value={draft}
          rows={2}
          aria-label={ariaLabel}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={commit}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.preventDefault()
              cancel()
            }
          }}
          className={sharedClassName}
        />
      )
    }

    return (
      <input
        ref={inputRef as RefObject<HTMLInputElement>}
        type="text"
        value={draft}
        aria-label={ariaLabel}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault()
            commit()
          }
          if (event.key === "Escape") {
            event.preventDefault()
            cancel()
          }
        }}
        className={sharedClassName}
      />
    )
  }

  const displayClassName = cn(
    className,
    "cursor-text rounded-sm transition-colors",
    "hover:bg-muted/40 print:hover:bg-transparent",
    "print:cursor-auto"
  )

  if (multiline) {
    return (
      <p
        role="button"
        tabIndex={0}
        aria-label={ariaLabel}
        onClick={() => setIsEditing(true)}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault()
            setIsEditing(true)
          }
        }}
        className={displayClassName}
      >
        {value}
      </p>
    )
  }

  return (
    <span
      role="button"
      tabIndex={0}
      aria-label={ariaLabel}
      onClick={() => setIsEditing(true)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault()
          setIsEditing(true)
        }
      }}
      className={displayClassName}
    >
      {value}
    </span>
  )
}
