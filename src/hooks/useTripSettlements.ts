import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTrips } from './useTrips';
import { calculateSettlements } from '../utils/minCashFlow';
import { hybridDataService } from '../services/hybridDataService';

export const useTripSettlements = () => {
    const { userProfile } = useAuth();
    const { trips, loading: tripsLoading, refreshTrips } = useTrips();
    const [tripSettlements, setTripSettlements] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [breakdownAdjustments, setBreakdownAdjustments] = useState<Record<string, number>>({});


    useEffect(() => {
        const fetchTripSettlements = async () => {
            if (tripsLoading) return;

            if (!userProfile?.uid) {
                setLoading(false);
                return;
            }

            if (!trips.length) {
                setTripSettlements([]);
                setBreakdownAdjustments({});
                setLoading(false);
                return;
            }

            const newSettlements: any[] = [];
            const adjustments: Record<string, number> = {
                Cash: 0,
                UPI: 0,
                Card: 0,
                Other: 0
            };

            for (const trip of trips) {
                if (trip.archived) continue;

                try {
                    const expenses = await hybridDataService.getTripExpenses(trip.id);
                    const { settlements } = calculateSettlements(trip, expenses);

                    // --- 1. Calculate Settlements (Who owes Who) ---
                    for (const s of settlements) {
                        // Check if current user is involved
                        const isMeFrom = s.from.isCurrentUser || s.from.id === userProfile.uid;
                        const isMeTo = s.to.isCurrentUser || s.to.id === userProfile.uid;

                        if (isMeFrom || isMeTo) {
                            // Resolve names with fallbacks
                            let borrowerName = s.from.name;
                            if (s.from.isCurrentUser || s.from.id === userProfile.uid) {
                                borrowerName = userProfile.name || 'Me';
                            } else if (!borrowerName) {
                                borrowerName = 'Unknown Participant';
                            }

                            let lenderName = s.to.name;
                            if (s.to.isCurrentUser || s.to.id === userProfile.uid) {
                                lenderName = userProfile.name || 'Me';
                            } else if (!lenderName) {
                                lenderName = 'Unknown Participant';
                            }

                            newSettlements.push({
                                id: `trip_settlement_${trip.id}_${s.from.id}_${s.to.id}`,
                                type: 'debt',
                                debtType: isMeTo ? 'lent' : 'borrowed', // Note: This affects "To Receive" (lent) vs "To Pay" (borrowed)
                                debtStatus: 'pending',
                                amount: s.amount,
                                date: trip.createdAt,
                                borrowerName: borrowerName,
                                lenderName: lenderName,
                                borrowerId: s.from.id,
                                lenderId: s.to.id,
                                description: `Trip: ${trip.name}`,
                                tripId: trip.id,
                                expectedDate: null,
                                isTripSettlement: true,
                                category: 'Trip Settlement'
                            });
                        }
                    }

                    // --- 2. Calculate Balance Breakdown Adjustments (Funding Source Correction) ---
                    // This fixes the "Payment Method" attribution for trip lending/borrowing
                    for (const e of expenses) {
                        // Normalize Payment Method
                        let method = 'Cash';
                        const pm = (e.paymentMethod || '').toLowerCase();
                        if (pm.includes('upi') || pm.includes('online')) method = 'UPI';
                        else if (pm.includes('card') || pm.includes('debit') || pm.includes('credit')) method = 'Card';
                        else if (pm.includes('net banking')) method = 'Other';

                        // Check if I paid or received
                        // NOTE: TripExpense interface might vary, ensure accessors are safe
                        // Assuming getTripExpenses returns typed objects similar to minCashFlow expectations
                        const paidByMe = e.paidBy === userProfile.uid ||
                            trip.participants.find(p => p.id === e.paidBy && p.isCurrentUser);

                        // Amount I Paid (Outflow)
                        const amountPaid = paidByMe ? e.amount : 0;

                        // Amount I Consumed (My Share) - Used for Expense Logic
                        const mySplit = e.split.find(s => s.participantId === userProfile.uid ||
                            trip.participants.find(p => p.id === s.participantId && p.isCurrentUser));
                        const amountConsumed = mySplit ? mySplit.amount : 0;

                        if (e.type === 'expense') {
                            // FORMULA: Adjustment = Share - Paid
                            // Logic: 
                            // - The Dashboard Summary loop subtracts "Share" (My Expense). 
                            // - The Account Balance should be reduced by "Paid" (My Outflow).
                            // - We need to add (Share - Paid) to convert "-Share" to "-Paid".
                            // Example: Paid 100, Share 40. Summary -40. Target -100.
                            // -40 + (40 - 100) = -100. Correct.
                            adjustments[method] = (adjustments[method] || 0) + (amountConsumed - amountPaid);
                        } else if (e.type === 'transfer') {
                            // Transfers are not in Summary (usually).
                            // If I Sent: Outflow. Adjustment -= Amount.
                            // If I Received: Inflow. Adjustment += Amount.
                            // e.from and e.transferredTo are likely IDs.

                            const iSent = e.from === userProfile.uid ||
                                trip.participants.find(p => p.id === e.from && p.isCurrentUser);

                            const iReceived = e.transferredTo === userProfile.uid ||
                                trip.participants.find(p => p.id === e.transferredTo && p.isCurrentUser);

                            if (iSent) {
                                adjustments[method] = (adjustments[method] || 0) - e.amount;
                            }
                            if (iReceived) {
                                adjustments[method] = (adjustments[method] || 0) + e.amount;
                            }
                        }
                        // Income type is handled by 'trip_income' summary typically, so ignore here to avoid double add.
                    }

                } catch (error) {
                    console.error(`Error calculating settlements for trip ${trip.id}:`, error);
                }
            }
            setTripSettlements(newSettlements);
            setBreakdownAdjustments(adjustments);
            setLoading(false);
        };

        fetchTripSettlements();
    }, [trips, userProfile, tripsLoading]);

    return { tripSettlements, loading, refreshTrips, setTripSettlements, breakdownAdjustments };
};
