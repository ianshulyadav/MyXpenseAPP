import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'myxpense_accounts';

export interface Account {
    id: string;
    name: string;
    type: 'cash' | 'upi' | 'bank';
    initialBalance: number;
    icon: string;       // emoji
    color: string;      // tailwind classes
    isDefault: boolean;
    createdAt: Date;
}

const DEFAULT_ACCOUNTS: Account[] = [
    {
        id: 'acc_cash',
        name: 'Cash',
        type: 'cash',
        initialBalance: 0,
        icon: '💵',
        color: 'bg-green-100 text-green-600 dark:bg-green-900/30',
        isDefault: true,
        createdAt: new Date(),
    },
    {
        id: 'acc_upi',
        name: 'UPI',
        type: 'upi',
        initialBalance: 0,
        icon: '📱',
        color: 'bg-blue-100 text-blue-600 dark:bg-blue-900/30',
        isDefault: true,
        createdAt: new Date(),
    },
    {
        id: 'acc_bank',
        name: 'Bank Acc',
        type: 'bank',
        initialBalance: 0,
        icon: '🏦',
        color: 'bg-purple-100 text-purple-600 dark:bg-purple-900/30',
        isDefault: true,
        createdAt: new Date(),
    },
];

/**
 * Maps a paymentMethod string from a transaction to an account type.
 * Handles all historical variations (Credit Card, Debit Card, online, etc.)
 */
export function mapPaymentMethodToAccountType(method: string): 'cash' | 'upi' | 'bank' {
    const m = (method || '').toLowerCase();
    if (m.match(/upi|online/)) return 'upi';
    if (m.match(/card|debit|credit|bank/)) return 'bank';
    if (m.match(/digital|wallet/)) return 'upi'; // Map digital wallets to UPI
    return 'cash';
}

export const useAccounts = () => {
    const [accounts, setAccounts] = useState<Account[]>(DEFAULT_ACCOUNTS);
    const [loaded, setLoaded] = useState(false);

    // Load from localStorage
    useEffect(() => {
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            if (stored) {
                const parsed = JSON.parse(stored) as Account[];
                // Merge with defaults to ensure all default accounts exist
                const merged = DEFAULT_ACCOUNTS.map(def => {
                    const saved = parsed.find(a => a.id === def.id);
                    return saved ? { ...def, ...saved, isDefault: true } : def;
                });
                // Add any non-default accounts from storage
                const custom = parsed.filter(a => !DEFAULT_ACCOUNTS.some(d => d.id === a.id));
                setAccounts([...merged, ...custom]);
            }
        } catch (e) {
            console.error('Error loading accounts:', e);
        }
        setLoaded(true);
    }, []);

    const persist = useCallback((accs: Account[]) => {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(accs));
        } catch (e) {
            console.error('Error saving accounts:', e);
        }
    }, []);

    const updateAccount = useCallback((id: string, updates: Partial<Account>) => {
        setAccounts(prev => {
            const updated = prev.map(a => a.id === id ? { ...a, ...updates } : a);
            persist(updated);
            return updated;
        });
    }, [persist]);

    const setInitialBalance = useCallback((id: string, balance: number) => {
        updateAccount(id, { initialBalance: balance });
    }, [updateAccount]);

    /** Total initial balance across all accounts */
    const totalInitialBalance = accounts.reduce((sum, a) => sum + (a.initialBalance || 0), 0);

    /** Get initial balance for a specific account type */
    const getInitialBalanceByType = useCallback((type: 'cash' | 'upi' | 'bank'): number => {
        return accounts
            .filter(a => a.type === type)
            .reduce((sum, a) => sum + (a.initialBalance || 0), 0);
    }, [accounts]);

    /** Get account by ID */
    const getAccountById = useCallback((id: string) => {
        return accounts.find(a => a.id === id);
    }, [accounts]);

    return {
        accounts,
        updateAccount,
        setInitialBalance,
        totalInitialBalance,
        getInitialBalanceByType,
        getAccountById,
        loaded,
    };
};
