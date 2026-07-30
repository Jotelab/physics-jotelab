"use client"

import { useEffect, useRef, useState, type ReactNode } from "react"
import { Check, ChevronsUpDown } from "lucide-react"

import {
  formLabelClass,
  touchFieldListClass,
  touchFieldListItemClass,
  touchFieldTriggerClass,
} from "@/lib/ui-classes"
import { cn } from "@/lib/utils"

export const builderFieldLabelClass = formLabelClass

export const builderTriggerClass = `${touchFieldTriggerClass} pr-12 lg:pr-10`

export const builderListClass = touchFieldListClass

export const builderListItemClass = touchFieldListItemClass

export function useBuilderDropdown() {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside)
    }
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [open])

  return { open, setOpen, containerRef }
}

interface BuilderDropdownListProps<T> {
  listId: string
  ariaLabel: string
  options: T[]
  selectedKey: string
  getKey: (option: T) => string
  getLabel: (option: T) => string
  /** Richer option content (icons, stars); getLabel still supplies the accessible text. */
  renderOption?: (option: T) => ReactNode
  onSelect: (option: T) => void
}

export function BuilderDropdownList<T>({
  listId,
  ariaLabel,
  options,
  selectedKey,
  getKey,
  getLabel,
  renderOption,
  onSelect,
}: BuilderDropdownListProps<T>) {
  if (options.length === 0) return null

  return (
    <ul id={listId} role="listbox" aria-label={ariaLabel} className={builderListClass}>
      {options.map((option) => {
        const key = getKey(option)
        const isSelected = selectedKey === key
        return (
          <li
            key={key}
            role="option"
            aria-selected={isSelected}
            onClick={() => onSelect(option)}
            className={cn(builderListItemClass, isSelected && "bg-muted/60")}
          >
            <Check
              className={cn(
                "size-5 shrink-0 text-primary lg:size-4",
                isSelected ? "opacity-100" : "opacity-0"
              )}
            />
            {renderOption ? renderOption(option) : getLabel(option)}
          </li>
        )
      })}
    </ul>
  )
}

interface BuilderFieldShellProps {
  label: string
  htmlFor?: string
  hint?: ReactNode
  children: ReactNode
}

export function BuilderFieldShell({ label, htmlFor, hint, children }: BuilderFieldShellProps) {
  return (
    <div className="block space-y-2">
      {htmlFor ? (
        <label htmlFor={htmlFor} className={builderFieldLabelClass}>
          {label}
        </label>
      ) : (
        <span className={builderFieldLabelClass}>{label}</span>
      )}
      {children}
      {hint}
    </div>
  )
}

interface BuilderSelectDropdownProps<T> {
  label: string
  id: string
  listId: string
  options: T[]
  value: string
  disabled?: boolean
  placeholder: string
  hint?: ReactNode
  getKey: (option: T) => string
  getLabel: (option: T) => string
  /** Richer option content in the list; getLabel still supplies the accessible text. */
  renderOption?: (option: T) => ReactNode
  /** Richer selected-value content in the trigger. */
  renderValue?: (option: T) => ReactNode
  onChange: (option: T) => void
}

export function BuilderSelectDropdown<T>({
  label,
  id,
  listId,
  options,
  value,
  disabled,
  placeholder,
  hint,
  getKey,
  getLabel,
  renderOption,
  renderValue,
  onChange,
}: BuilderSelectDropdownProps<T>) {
  const { open, setOpen, containerRef } = useBuilderDropdown()
  const selected = options.find((o) => getKey(o) === value)
  const displayLabel = selected ? getLabel(selected) : null
  const displayContent = selected && renderValue ? renderValue(selected) : displayLabel

  function handleSelect(option: T) {
    onChange(option)
    setOpen(false)
  }

  function handleKeyDown(event: React.KeyboardEvent) {
    if (event.key === "Escape") setOpen(false)
    if (event.key === "ArrowDown" && options.length > 0 && !disabled) setOpen(true)
  }

  return (
    <BuilderFieldShell label={label} htmlFor={id} hint={hint}>
      <div ref={containerRef} className="relative">
        <div className="relative">
          <button
            id={id}
            type="button"
            role="combobox"
            aria-expanded={open}
            aria-haspopup="listbox"
            aria-controls={listId}
            disabled={disabled}
            onClick={() => !disabled && setOpen((prev) => !prev)}
            onKeyDown={handleKeyDown}
            className={cn(
              builderTriggerClass,
              "block text-left",
              !displayLabel && "text-muted-foreground"
            )}
          >
            {displayContent ?? placeholder}
          </button>
          <button
            type="button"
            aria-label={`Toggle ${label} options`}
            tabIndex={-1}
            disabled={disabled}
            onClick={() => !disabled && setOpen((prev) => !prev)}
            className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-muted-foreground disabled:cursor-not-allowed lg:w-auto lg:px-2"
          >
            <ChevronsUpDown className="size-5 lg:size-4" />
          </button>
        </div>

        {open && !disabled ? (
          <BuilderDropdownList
            listId={listId}
            ariaLabel={`${label} options`}
            options={options}
            selectedKey={value}
            getKey={getKey}
            getLabel={getLabel}
            renderOption={renderOption}
            onSelect={handleSelect}
          />
        ) : null}
      </div>
    </BuilderFieldShell>
  )
}
