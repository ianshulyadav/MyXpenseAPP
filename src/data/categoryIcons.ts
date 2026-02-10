import { Utensils, Car, ShoppingBag, Gamepad2, Zap, Heart, GraduationCap, MoreHorizontal } from 'lucide-react';

// ============================================
// DEFAULT CATEGORIES (backward compatible)
// ============================================
export interface CategoryDef {
    id: string;
    name: string;
    icon?: any;            // lucide icon component (for defaults)
    iconAsset?: string;    // webp filename from /category-icons/
    iconEmoji?: string;    // emoji icon
    iconType: 'lucide' | 'asset' | 'emoji';
    color: string;
    isDefault: boolean;
    parentGroup?: string;
}

export const DEFAULT_CATEGORIES: CategoryDef[] = [
    { id: 'food', name: 'Food', icon: Utensils, iconType: 'lucide', color: 'bg-red-100 text-red-500 dark:bg-red-900/30', isDefault: true },
    { id: 'transport', name: 'Transport', icon: Car, iconType: 'lucide', color: 'bg-blue-100 text-blue-500 dark:bg-blue-900/30', isDefault: true },
    { id: 'shopping', name: 'Shopping', icon: ShoppingBag, iconType: 'lucide', color: 'bg-green-100 text-green-500 dark:bg-green-900/30', isDefault: true },
    { id: 'entertainment', name: 'Entertainment', icon: Gamepad2, iconType: 'lucide', color: 'bg-purple-100 text-purple-500 dark:bg-purple-900/30', isDefault: true },
    { id: 'bills', name: 'Bills', icon: Zap, iconType: 'lucide', color: 'bg-yellow-100 text-yellow-500 dark:bg-yellow-900/30', isDefault: true },
    { id: 'health', name: 'Health', icon: Heart, iconType: 'lucide', color: 'bg-pink-100 text-pink-500 dark:bg-pink-900/30', isDefault: true },
    { id: 'education', name: 'Education', icon: GraduationCap, iconType: 'lucide', color: 'bg-indigo-100 text-indigo-500 dark:bg-indigo-900/30', isDefault: true },
    { id: 'other', name: 'Other', icon: MoreHorizontal, iconType: 'lucide', color: 'bg-gray-100 text-gray-500 dark:bg-gray-700/50', isDefault: true },
];

// ============================================
// POCKAW ICON GROUPS
// ============================================
export interface IconGroup {
    name: string;
    icons: string[];
}

function generateIcons(prefix: string, count: number): string[] {
    return Array.from({ length: count }, (_, i) => `category-${prefix}-${i + 1}.webp`);
}

export const ICON_GROUPS: IconGroup[] = [
    { name: 'Food', icons: generateIcons('food', 39) },
    { name: 'Shopping', icons: generateIcons('shopping', 46) },
    { name: 'Transportation', icons: generateIcons('transportation', 25) },
    { name: 'Housing', icons: generateIcons('housing', 31) },
    { name: 'Entertainment', icons: generateIcons('entertainment', 33) },
    { name: 'Travel', icons: generateIcons('travel', 15) },
    { name: 'Education', icons: generateIcons('education', 11) },
    { name: 'Finance', icons: generateIcons('finance', 11) },
    { name: 'Health', icons: generateIcons('health', 5) },
    { name: 'Utilities', icons: generateIcons('utilities', 6) },
];

export const ALL_ICON_ASSETS = ICON_GROUPS.flatMap(g => g.icons);

// ============================================
// COLOR OPTIONS for custom categories
// ============================================
export const CATEGORY_COLORS = [
    'bg-red-100 text-red-500 dark:bg-red-900/30',
    'bg-orange-100 text-orange-500 dark:bg-orange-900/30',
    'bg-amber-100 text-amber-500 dark:bg-amber-900/30',
    'bg-yellow-100 text-yellow-500 dark:bg-yellow-900/30',
    'bg-lime-100 text-lime-500 dark:bg-lime-900/30',
    'bg-green-100 text-green-500 dark:bg-green-900/30',
    'bg-emerald-100 text-emerald-500 dark:bg-emerald-900/30',
    'bg-teal-100 text-teal-500 dark:bg-teal-900/30',
    'bg-cyan-100 text-cyan-500 dark:bg-cyan-900/30',
    'bg-sky-100 text-sky-500 dark:bg-sky-900/30',
    'bg-blue-100 text-blue-500 dark:bg-blue-900/30',
    'bg-indigo-100 text-indigo-500 dark:bg-indigo-900/30',
    'bg-violet-100 text-violet-500 dark:bg-violet-900/30',
    'bg-purple-100 text-purple-500 dark:bg-purple-900/30',
    'bg-fuchsia-100 text-fuchsia-500 dark:bg-fuchsia-900/30',
    'bg-pink-100 text-pink-500 dark:bg-pink-900/30',
    'bg-rose-100 text-rose-500 dark:bg-rose-900/30',
    'bg-gray-100 text-gray-500 dark:bg-gray-700/50',
];

// Utility to get icon URL from asset filename
export const getIconUrl = (filename: string) => `/category-icons/${filename}`;
