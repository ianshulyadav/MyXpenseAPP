import { useState, useEffect, useCallback } from 'react';
import { DEFAULT_CATEGORIES, type CategoryDef } from '../data/categoryIcons';

const STORAGE_KEY = 'myxpense_custom_categories';

export const useCategories = () => {
    const [customCategories, setCustomCategories] = useState<CategoryDef[]>([]);
    const [loaded, setLoaded] = useState(false);

    // Load from localStorage
    useEffect(() => {
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            if (stored) {
                const parsed = JSON.parse(stored) as CategoryDef[];
                setCustomCategories(parsed);
            }
        } catch (e) {
            console.error('Error loading custom categories:', e);
        }
        setLoaded(true);
    }, []);

    // Save to localStorage whenever custom categories change
    const persist = useCallback((cats: CategoryDef[]) => {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(cats));
        } catch (e) {
            console.error('Error saving custom categories:', e);
        }
    }, []);

    const addCategory = useCallback((cat: Omit<CategoryDef, 'id' | 'isDefault'>) => {
        const newCat: CategoryDef = {
            ...cat,
            id: `custom_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
            isDefault: false,
        };
        setCustomCategories(prev => {
            const updated = [...prev, newCat];
            persist(updated);
            return updated;
        });
        return newCat;
    }, [persist]);

    const editCategory = useCallback((id: string, updates: Partial<CategoryDef>) => {
        setCustomCategories(prev => {
            const updated = prev.map(c => c.id === id ? { ...c, ...updates } : c);
            persist(updated);
            return updated;
        });
    }, [persist]);

    const deleteCategory = useCallback((id: string) => {
        setCustomCategories(prev => {
            const updated = prev.filter(c => c.id !== id);
            persist(updated);
            return updated;
        });
    }, [persist]);

    // Merged list: defaults first, then custom
    const allCategories: CategoryDef[] = [...DEFAULT_CATEGORIES, ...customCategories];

    // Get a category by ID (handles both default and custom)
    const getCategoryById = useCallback((id: string): CategoryDef | undefined => {
        return DEFAULT_CATEGORIES.find(c => c.id === id) || customCategories.find(c => c.id === id);
    }, [customCategories]);

    return {
        categories: allCategories,
        customCategories,
        defaultCategories: DEFAULT_CATEGORIES,
        addCategory,
        editCategory,
        deleteCategory,
        getCategoryById,
        loaded,
    };
};
