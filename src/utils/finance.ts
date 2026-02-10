import type { Transaction } from '../types';

export interface TripSettlement {
    id: string;
    amount: number;
    debtType: 'lent' | 'borrowed' | 'settlement_in' | 'settlement_out';
    debtStatus: 'pending' | 'settled';
    [key: string]: any; // Allow other properties
}

/**
 * Round a monetary value to 2 decimal places to prevent floating-point drift.
 * Using Math.round avoids the precision loss of toFixed() + parseFloat().
 */
export const roundMoney = (value: number): number => {
    if (!isFinite(value)) return 0;
    return Math.round(value * 100) / 100;
};

/**
 * Safe amount getter — guards against NaN, undefined, null, and non-finite values.
 */
const safeAmount = (amount: any): number => {
    const n = Number(amount);
    return isFinite(n) ? n : 0;
};

/**
 * Calculates the total balance and other financial stats based on transactions and settlements.
 * 
 * Logic:
 * Balance = (Total Income + Borrowed Pending) - (Total Expenses + Lent Pending)
 * 
 * - Income: Standard income + Transfers FROM Secret Vault.
 * - Expenses: Standard expenses + Transfers TO Secret Vault.
 * - Debts: 
 *   - Lent (Pending): Treated as money OUT (decreases balance temporarily).
 *   - Borrowed (Pending): Treated as money IN (increases balance temporarily).
 *   - Settled Debts: Neutral (ignored).
 *   - Trip Settlements: Included in Pending Debts calculation.
 *
 * IMPORTANT: `transactions` should be raw transactions only (not including trip settlements).
 * Trip settlements are passed separately to avoid double-counting.
 */
export const calculateFinanceStats = (
    transactions: Transaction[],
    tripSettlements: TripSettlement[] = []
) => {
    let income = 0;
    let expenses = 0;
    let vaultOut = 0; // Track transfers to vault separately
    let pendingLent = 0;
    let pendingBorrowed = 0;

    // Spending stats
    let weekSpending = 0;
    let monthSpending = 0;
    const now = Date.now();
    const weekAgo = now - 7 * 24 * 60 * 60 * 1000;
    const monthAgo = now - 30 * 24 * 60 * 60 * 1000;

    const checkSpending = (t: Transaction, amount: number) => {
        const tTime = new Date(t.date).getTime();
        if (!isNaN(tTime)) {
            if (tTime >= weekAgo) weekSpending += amount;
            if (tTime >= monthAgo) monthSpending += amount;
        }
    };

    // Process Transactions
    transactions.forEach(t => {
        const amt = safeAmount(t.amount);
        if (amt === 0 && t.type !== 'transfer') return; // Skip zero/invalid amounts

        // 1. Debt Logic
        if (t.type === 'debt' || t.debtType) {
            // Only pending debts affect the balance (Liability/Asset model)
            if (t.debtStatus === 'pending') {
                // Calculate remaining amount after partial settlements
                const settledSoFar = safeAmount((t as any).settledAmount);
                const remainingAmount = roundMoney(Math.max(0, amt - settledSoFar));

                if (t.debtType === 'lent') {
                    pendingLent += remainingAmount;
                } else if (t.debtType === 'borrowed') {
                    pendingBorrowed += remainingAmount;
                }
            } else {
                // Handle Settlements (Repayments) that are fully settled/recorded
                // If this is a Settlement Transaction (not the debt itself, but the payment)
                if (t.debtType === 'settlement_in') {
                    income += amt;
                } else if (t.debtType === 'settlement_out') {
                    expenses += amt;
                }
            }
        }
        // 2. Transfer Logic (Secret Vault)
        else if (t.type === 'transfer') {
            if (t.transferFrom === 'secret_vault') {
                income += amt;
            } else if (t.transferTo === 'secret_vault') {
                vaultOut += amt;
                // Excluded from 'expenses' and 'spending' stats as per user request
            }
        }
        // 3. Income
        else if (t.type === 'income') {
            income += amt;
        }
        // 4. Standard Expense
        else {
            expenses += amt;
            checkSpending(t, amt);
        }
    });

    // Process Trip Settlements (Pending ones affect balance)
    tripSettlements.forEach(s => {
        const amt = safeAmount(s.amount);
        if (amt === 0) return;

        if (s.debtStatus === 'pending') {
            if (s.debtType === 'lent') {
                pendingLent += amt;
            } else if (s.debtType === 'borrowed') {
                pendingBorrowed += amt;
            }
        } else {
            // Handle explicit settlements in trip data
            if (s.debtType === 'settlement_in') {
                income += amt;
            } else if (s.debtType === 'settlement_out') {
                expenses += amt;
            }
        }
    });

    // Final Balance Calculation with precision rounding
    // Balance = (Income + Borrowed) - (Expenses + VaultOut + Lent)
    // "Deleting from final balance" logic: Only Pending debts reduce the balance. Settled ones vanish.
    const balance = roundMoney((income + pendingBorrowed) - (expenses + vaultOut + pendingLent));

    return {
        balance,
        income: roundMoney(income),
        expenses: roundMoney(expenses),
        pendingLent: roundMoney(pendingLent),
        pendingBorrowed: roundMoney(pendingBorrowed),
        spending: {
            week: roundMoney(weekSpending),
            month: roundMoney(monthSpending)
        }
    };
};
