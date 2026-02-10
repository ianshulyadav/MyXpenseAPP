import type { Transaction } from '../types';
import { calculateFinanceStats, roundMoney, type TripSettlement } from './finance';

/**
 * Computes a map of transaction ID → running balance for display in transaction lists.
 *
 * Uses a "top-down" approach:
 * 1. Get the authoritative current balance from calculateFinanceStats
 * 2. Sort transactions newest → oldest
 * 3. Walk backwards, reversing each transaction's effect to find the balance at each point
 *
 * This ensures the running balance is always consistent with the main balance.
 *
 * @param transactionsRaw - Raw transactions (NOT including trip settlements)
 * @param tripSettlements - Trip settlement pseudo-transactions
 * @returns Map of transaction ID → balance after that transaction
 */
export function computeRunningBalanceMap(
    transactionsRaw: Transaction[],
    tripSettlements: TripSettlement[]
): Map<string, number> {
    const allTransactions = [...transactionsRaw, ...tripSettlements];

    if (allTransactions.length === 0) return new Map<string, number>();

    // 1. Get the authoritative Current Total Balance
    const { balance: currentTotalBalance } = calculateFinanceStats(transactionsRaw, tripSettlements);

    const map = new Map<string, number>();

    // 2. Pre-parse dates into a cache to avoid repeated parsing (perf for large datasets)
    const dateCache = new Map<string, number>();
    const createdCache = new Map<string, number>();

    for (const t of allTransactions) {
        const d = new Date(t.date).getTime();
        dateCache.set(t.id, isNaN(d) ? 0 : d);
        const c = t.createdAt ? new Date(t.createdAt).getTime() : 0;
        createdCache.set(t.id, isNaN(c) ? 0 : c);
    }

    // 3. Sort Newest → Oldest (Descending)
    const sortedDescending = [...allTransactions].sort((a: any, b: any) => {
        const aTime = dateCache.get(a.id) || 0;
        const bTime = dateCache.get(b.id) || 0;
        if (aTime === bTime) {
            const cA = createdCache.get(a.id) || 0;
            const cB = createdCache.get(b.id) || 0;
            return cB - cA;
        }
        return bTime - aTime;
    });

    let currentBalance = currentTotalBalance;

    for (const t of sortedDescending) {
        // Store the balance *at the end* of this transaction state
        map.set(t.id, roundMoney(currentBalance));

        const amt = isFinite(t.amount) ? t.amount : 0;

        // 4. Reverse the effect of this transaction to find the balance *before* it
        if (t.type === 'income') {
            currentBalance -= amt;
        } else if (t.type === 'expense') {
            currentBalance += amt;
        } else if (t.type === 'transfer') {
            if (t.transferFrom === 'secret_vault') {
                currentBalance -= amt; // Was Income (+), reverse it
            } else if (t.transferTo === 'secret_vault') {
                currentBalance += amt; // Was Expense (-), reverse it
            }
        } else if (t.type === 'debt' || (t as any).isTripSettlement) {
            // For pending debts with partial settlements, use the remaining amount
            const settledSoFar = (t as any).settledAmount || 0;
            const effectiveAmt = (t.debtStatus === 'pending' && settledSoFar > 0)
                ? Math.max(0, amt - settledSoFar)
                : amt;

            if (t.debtStatus === 'pending') {
                if (t.debtType === 'lent') {
                    currentBalance += effectiveAmt; // Reverse of (- amount)
                } else if (t.debtType === 'borrowed') {
                    currentBalance -= effectiveAmt; // Reverse of (+ amount)
                }
            } else if (t.debtStatus === 'settled') {
                // Settled debts have 0 effect on current balance in calculateFinanceStats,
                // but the transaction record represents the historical event.
                // We do NOT reverse settled debts because they are already excluded
                // from the authoritative balance calculation.
                // (The settlement_in/settlement_out transactions handle the cashflow.)
            }

            // Handle settlement transactions (explicit transfer direction)
            if (t.debtType === 'settlement_out') {
                currentBalance += amt; // Reverse of Expense
            } else if (t.debtType === 'settlement_in') {
                currentBalance -= amt; // Reverse of Income
            }
        }
    }

    return map;
}
