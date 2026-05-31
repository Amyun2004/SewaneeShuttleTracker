// Thin re-export so every component does `import { cn } from '@/lib/cn'`
// instead of pulling clsx directly. If we ever swap for tailwind-merge
// (which de-duplicates conflicting Tailwind classes), it's a one-line
// change here instead of touching every component.
import { clsx, type ClassValue } from "clsx";

export function cn(...inputs: ClassValue[]): string {
  return clsx(inputs);
}