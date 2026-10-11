"use client";

// A text field bound to one storage key. Typing writes straight to storage (and on to the shared
// board); a value written elsewhere (another open copy, the shared board) replaces what is shown,
// except while this field is being typed in, when it waits until the field loses focus.

import { useState } from "react";
import { edit, kv, useBoardVersion } from "@/lib/duty/store";

export default function StoredText({
  storageKey,
  multiline = false,
  trim = true,
  onCommitted,
  className = "input",
  ...rest
}: {
  storageKey: string;
  multiline?: boolean;
  /** Store the value trimmed (as the original board did for names, times and phones). */
  trim?: boolean;
  /** Called after each write with the value stored. */
  onCommitted?: (value: string) => void;
  className?: string;
  placeholder?: string;
  list?: string;
  "aria-label"?: string;
  inputMode?: "text" | "tel" | "numeric";
}) {
  useBoardVersion();
  const stored = kv.get(storageKey) ?? "";
  const [draft, setDraft] = useState(stored);
  const [seen, setSeen] = useState(stored);
  const [focused, setFocused] = useState(false);
  const norm = (v: string) => (trim ? v.trim() : v);

  if (stored !== seen) {
    setSeen(stored);
    if (!focused && stored !== norm(draft)) setDraft(stored);
  }

  const onChange = (v: string) => {
    setDraft(v);
    const value = norm(v);
    edit((s) => s.set(storageKey, value), "edit");
    onCommitted?.(value);
  };
  const onBlur = () => {
    setFocused(false);
    if (stored !== norm(draft)) setDraft(stored);
  };

  return multiline ? (
    <textarea className={className} value={draft} onFocus={() => setFocused(true)} onBlur={onBlur} onChange={(e) => onChange(e.target.value)} {...rest} />
  ) : (
    <input className={className} value={draft} onFocus={() => setFocused(true)} onBlur={onBlur} onChange={(e) => onChange(e.target.value)} {...rest} />
  );
}
