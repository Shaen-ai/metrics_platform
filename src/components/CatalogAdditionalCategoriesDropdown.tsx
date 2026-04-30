"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface CategoryOption {
  value: string;
  label: string;
  disabled?: boolean;
}

interface CatalogAdditionalCategoriesDropdownProps {
  options: CategoryOption[];
  value: string[];
  onChange: (value: string[]) => void;
  placeholder: string;
  emptyLabel: string;
}

export function CatalogAdditionalCategoriesDropdown({
  options,
  value,
  onChange,
  placeholder,
  emptyLabel,
}: CatalogAdditionalCategoriesDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const selected = useMemo(() => new Set(value), [value]);
  const selectedOptions = options.filter((option) => selected.has(option.value));

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, []);

  const toggleOption = (option: CategoryOption) => {
    if (option.disabled) return;
    if (selected.has(option.value)) {
      onChange(value.filter((item) => item !== option.value));
      return;
    }
    onChange([...value, option.value]);
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        className="flex min-h-10 w-full items-center justify-between gap-2 rounded-lg border border-[var(--input)] bg-[var(--background)] px-3 py-2 text-left text-sm focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
      >
        <span
          className={cn(
            "flex-1 truncate",
            selectedOptions.length === 0 && "text-[var(--muted-foreground)]",
          )}
        >
          {selectedOptions.length > 0
            ? selectedOptions.map((option) => option.label).join(", ")
            : placeholder}
        </span>
        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 text-[var(--muted-foreground)] transition-transform",
            isOpen && "rotate-180",
          )}
        />
      </button>

      {selectedOptions.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {selectedOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => toggleOption(option)}
              className="inline-flex items-center gap-1 rounded-full border border-[var(--border)] bg-[var(--muted)] px-2.5 py-1 text-xs text-[var(--foreground)]"
            >
              {option.label}
              <X className="h-3 w-3" />
            </button>
          ))}
        </div>
      )}

      {isOpen && (
        <div className="absolute z-30 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-[var(--border)] bg-[var(--background)] p-1 shadow-lg">
          {options.length === 0 ? (
            <p className="px-3 py-2 text-sm text-[var(--muted-foreground)]">
              {emptyLabel}
            </p>
          ) : (
            options.map((option) => {
              const isSelected = selected.has(option.value);
              return (
                <button
                  key={option.value}
                  type="button"
                  disabled={option.disabled}
                  onClick={() => toggleOption(option)}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors",
                    option.disabled
                      ? "cursor-not-allowed opacity-50"
                      : "hover:bg-[var(--muted)]",
                  )}
                >
                  <span
                    className={cn(
                      "flex h-4 w-4 shrink-0 items-center justify-center rounded border border-[var(--border)]",
                      isSelected && "border-[var(--primary)] bg-[var(--primary)] text-white",
                    )}
                  >
                    {isSelected && <Check className="h-3 w-3" />}
                  </span>
                  <span className="truncate">{option.label}</span>
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
