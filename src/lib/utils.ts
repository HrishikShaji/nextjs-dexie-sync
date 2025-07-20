import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getSyncColor(status: "pending" | "synced" | "error") {
  switch (status) {
    case "pending": return "bg-yellow-500";
    case "synced": return "bg-green-500";
    case "error": return "bg-red-500";
    default: return "bg-yellow-500"
  }
}
export const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
