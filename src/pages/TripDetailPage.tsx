import { useState, useMemo } from 'react';
import { useNavigate, useParams, Navigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Plus, Receipt, MoreVertical, Trash2, Share2, Edit2, BarChart3, Archive, CheckCircle, Download, ArrowLeftRight } from 'lucide-react';
import PageTransition from '../components/PageTransition';
import { useTrips, useTripExpenses } from '../hooks/useTrips';
import type { TripExpense } from '../types';
import AddTripExpenseModal from '../components/AddTripExpenseModal';
import TripAIChatAssistant from '../components/TripAIChatAssistant';
import ExpenseDetailModal from '../components/ExpenseDetailModal';
import { SettlementBreakdownModal } from '../components/SettlementBreakdownModal';
import { ConfirmationModal } from '../components/ConfirmationModal';
import { getTripIcon } from '../utils/tripIcons';
import { getExpenseIcon } from '../utils/expenseIcons';
import { useTransactions } from '../hooks/useFirestoreSync';
import { useAuth } from '../context/AuthContext';
import { downloadTripBackup } from '../utils/tripBackup';
import { tripBackupFirebaseService } from '../services/tripBackupFirebase';
import CostBreakdownModal from '../components/CostBreakdownModal';
import { calculateSettlements, generateShareText } from '../utils/minCashFlow';

const TripDetailPage = () => {
  const { tripId } = useParams<{ tripId: string }>();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const { trips, loading: tripsLoading, removeTrip, updateTrip } = useTrips();
  const { expenses, addExpense, updateExpense, removeExpense } = useTripExpenses(tripId || '');
  const { transactions, addTransaction, updateTransaction, removeTransaction } = useTransactions();
  const [activeTab, setActiveTab] = useState<'expenses' | 'balances' | 'chat'>('expenses');
  const [showAddExpense, setShowAddExpense] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState<TripExpense | null>(null);
  const [showExpenseDetail, setShowExpenseDetail] = useState(false);
  const [selectedSettlement, setSelectedSettlement] = useState<{ debtor: any; creditor: any } | null>(null);
  const [showSettlementDetail, setShowSettlementDetail] = useState(false);
  const [showMyExpensesDetail, setShowMyExpensesDetail] = useState(false);
  const [showCostBreakdown, setShowCostBreakdown] = useState(false);
  const [filterTypes, setFilterTypes] = useState({ expense: true, income: true, transfer: true });

  const trip = trips.find(t => t.id === tripId);

  const { isFrozen, isLocked } = useMemo(() => {
    if (!trip) return { isFrozen: false, isLocked: false };
    const now = new Date();
    const tripDate = new Date(trip.createdAt);
    const ageInDays = (now.getTime() - tripDate.getTime()) / (1000 * 60 * 60 * 24);

    return {
      isFrozen: ageInDays > 90, // No new expenses
      isLocked: ageInDays > 100 // No settlements (Force Close only)
    };
  }, [trip]);






  // Calculate balances
  const balances = useMemo(() => {
    if (!trip) return [];

    const participantBalances: Record<string, number> = {};
    trip.participants.forEach(p => {
      participantBalances[p.id] = 0;
    });

    expenses.forEach(expense => {
      if (expense.type === 'expense' && expense.paidBy) {
        participantBalances[expense.paidBy] += expense.amount;
        expense.split.forEach(split => {
          participantBalances[split.participantId] -= split.amount;
        });
      } else if (expense.type === 'income' && expense.receivedBy) {
        // Income is personal pocket money - only add to receiver's balance, no splits
        participantBalances[expense.receivedBy] += expense.amount;
      } else if (expense.type === 'transfer' && expense.from && expense.transferredTo) {
        // When someone transfers money TO another person, they are SETTLING debt:
        // - The person who pays (from) increases their balance (they're paying off what they owe/giving credit)
        // - The person who receives (transferredTo) decreases their balance (their credit is being paid off)
        // Example: If I owe Friend ₹200 and I transfer ₹300, I overpaid by ₹100, so Friend now owes ME ₹100
        participantBalances[expense.from] += expense.amount;
        participantBalances[expense.transferredTo] -= expense.amount;
      }
    });

    return Object.entries(participantBalances).map(([participantId, balance]) => ({
      participant: trip.participants.find(p => p.id === participantId),
      balance
    })).filter(b => b.participant);
  }, [trip, expenses]);

  // Calculate total expenses
  const totalExpenses = useMemo(() => {
    return expenses
      .filter(e => e.type === 'expense')
      .reduce((sum, e) => sum + e.amount, 0);
  }, [expenses]);

  // Calculate my expenses
  const myExpenses = useMemo(() => {
    const myParticipant = trip?.participants.find(p => p.isCurrentUser);
    if (!myParticipant) return 0;

    return expenses
      .filter(e => e.type === 'expense')
      .reduce((sum, e) => {
        const mySplit = e.split.find(s => s.participantId === myParticipant.id);
        return sum + (mySplit?.amount || 0);
      }, 0);
  }, [trip, expenses]);

  // Get previous settlements
  const previousSettlements = useMemo(() => {
    return expenses.filter(e => e.type === 'transfer' && e.category === 'settlement');
  }, [expenses]);

  const [isUpdating, setIsUpdating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const handleDeleteTrip = () => {
    setShowMenu(false);
    if (!trip) return;
    setShowDeleteConfirm(true);
  };

  const confirmDeleteTrip = async () => {
    if (!trip) return;
    try {
      setIsDeleting(true);
      await removeTrip(trip.id);
      // Wait a moment for IDB to sync effectively before navigating
      // Although await removeTrip should be enough
      navigate('/trips');
    } catch (error) {
      console.error('Error deleting trip:', error);
      alert('Failed to delete trip');
    } finally {
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  const handleShareTrip = async () => {
    setShowMenu(false);
    if (!trip) return;

    // Use the new settlement calculation and share text generation
    const { balances: calculatedBalances, settlements } = calculateSettlements(trip, expenses);
    const shareText = generateShareText(trip, expenses, settlements, calculatedBalances);

    if (navigator.share) {
      try {
        await navigator.share({
          title: trip.name,
          text: shareText,
        });
      } catch (error) {
        if (error instanceof Error && error.name !== 'AbortError') {

        }
      }
    } else {
      try {
        await navigator.clipboard.writeText(shareText);
        alert('Trip summary copied to clipboard!');
      } catch (error) {
        console.error('Error copying to clipboard:', error);
        alert('Unable to share trip details');
      }
    }
  };

  const handleEditTrip = () => {
    setShowMenu(false);
    setShowEditTrip(true);
  };

  const [showEditTrip, setShowEditTrip] = useState(false);

  const handleUpdateTripDetails = async (name: string, participantNames: string[]) => {
    if (!trip || !currentUser) return;

    const updatedParticipants = participantNames.map((pName, index) => {
      const existing = trip.participants.find(p => p.name.trim().toLowerCase() === pName.trim().toLowerCase());
      if (existing) {
        return {
          ...existing,
          name: pName.trim()
        };
      }
      return {
        id: `participant_${Date.now()}_${Math.random()}`,
        name: pName.trim(),
        isCurrentUser: index === 0 && !trip.participants.some((p: any) => p.isCurrentUser && p.name !== pName)
      };
    });

    const updatedTrip = {
      ...trip,
      name,
      participants: updatedParticipants,
      updatedAt: new Date()
    };

    await updateTrip(updatedTrip);
    setShowEditTrip(false);
  };

  const handleInsights = () => {
    setShowMenu(false);
    setActiveTab('balances');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleArchiveTrip = async () => {
    setShowMenu(false);
    if (!trip || !window.confirm(`Archive ${trip.name}? This will archive the trip without recording expenses in transaction history. Click "End Trip" to record expenses.`)) return;

    // Archive only - don't sync to transactions
    const updatedTrip = {
      ...trip,
      archived: true,
      endedAt: new Date(),
      updatedAt: new Date()
    };

    try {
      await updateTrip(updatedTrip);
    } catch (error) {
      console.error('Error archiving trip:', error);
      alert('Failed to archive trip. Please try again.');
    }
  };

  const handleEndTrip = async () => {
    setShowMenu(false);
    if (!trip || !window.confirm(`End ${trip.name}? This will add your expenses to your main transaction history and mark the trip as complete.`)) return;

    await endOrArchiveTrip();
  };

  const endOrArchiveTrip = async () => {
    if (!trip || !currentUser) return;

    const myParticipant = trip.participants.find(p => p.isCurrentUser);
    const incomeTransactionId = `trip_income_${trip.id}_${currentUser.uid}`;
    const newSettlementTransactionId: string | undefined = trip.settlementTransactionId;

    // Calculate my income from the trip (pocket money received during trip)
    const myIncome = expenses
      .filter(e => e.type === 'income' && e.receivedBy === myParticipant?.id)
      .reduce((sum, e) => sum + e.amount, 0);

    // Add expenses to main transaction history (Split by payment method)
    if (myParticipant) {
      const myExpensesByMethod: Record<string, number> = {};

      expenses.forEach(e => {
        if (e.type === 'expense') {
          const mySplit = e.split.find(s => s.participantId === myParticipant.id);
          if (mySplit && mySplit.amount > 0) {
            // Normalize payment method
            let method = e.paymentMethod || 'Cash';
            if (method === 'online') method = 'UPI';

            myExpensesByMethod[method] = (myExpensesByMethod[method] || 0) + mySplit.amount;
          }
        }
      });

      const methods = ['Cash', 'UPI', 'Card'];
      for (const method of methods) {
        const amount = myExpensesByMethod[method] || 0;
        // ID format: trip_summary_tripId_userId_method
        const transactionId = `trip_summary_${trip.id}_${currentUser.uid}_${method}`;

        const existingTransaction = transactions.find(t => t.id === transactionId);

        if (amount > 0) {
          const transactionData = {
            id: transactionId,
            userId: currentUser.uid,
            type: 'expense' as const,
            amount: amount,
            category: 'travel',
            description: `${trip.name} - Trip Expenses (${method})`,
            paymentMethod: method,
            date: new Date(),
            tripId: trip.id,
            tripName: trip.name,
            createdAt: new Date(),
            updatedAt: new Date()
          };

          // Cast paymentMethod to any to avoid TS issues if strict literal check fails
          if (existingTransaction) {
            await updateTransaction(transactionId, {
              amount,
              updatedAt: new Date()
            });
          } else {
            await addTransaction(transactionData as any);
          }
        } else if (existingTransaction) {
          await removeTransaction(transactionId);
        }
      }

      // Legacy cleanup: if there was a single settlementTransactionId, remove it if it doesn't match new format
      if (trip.settlementTransactionId && !trip.settlementTransactionId.includes('_Cash') && !trip.settlementTransactionId.includes('_UPI')) {
        const oldT = transactions.find(t => t.id === trip.settlementTransactionId);
        if (oldT) await removeTransaction(trip.settlementTransactionId);
      }
    }

    // Add income to main transaction history (pocket money received during trip)
    if (myParticipant && myIncome > 0) {
      const incomeData = {
        id: incomeTransactionId,
        userId: currentUser.uid,
        type: 'income' as const,
        amount: myIncome,
        category: 'Other Income',
        description: `${trip.name} - Trip Income (Pocket Money)`,
        paymentMethod: 'cash',
        date: new Date(),
        tripId: trip.id,
        tripName: trip.name,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      try {
        const existingIncomeTransaction = transactions.find(t => t.id === incomeTransactionId);
        if (existingIncomeTransaction) {
          await updateTransaction(incomeTransactionId, {
            amount: myIncome,
            updatedAt: new Date()
          });
        } else {
          await addTransaction(incomeData);
        }
      } catch (error) {
        console.error('Error adding trip income to transaction history:', error);
      }
    }

    const updatedTrip = {
      ...trip,
      ended: true,
      archived: false,
      endedAt: new Date(),
      settlementTransactionId: newSettlementTransactionId,
      updatedAt: new Date()
    };

    try {
      await updateTrip(updatedTrip);
      navigate('/trips');
    } catch (error) {
      console.error('Error updating trip:', error);
      alert('Failed to update trip. Please try again.');
    }
  };

  const handleAddExpense = async (expense: TripExpense) => {
    await addExpense(expense);
    setShowAddExpense(false);
  };

  const syncExpensesToHistory = async (currentExpenses: TripExpense[]) => {
    if (!trip || !currentUser) return;

    const myParticipant = trip.participants.find(p => p.isCurrentUser);
    if (!myParticipant) return;

    try {
      const myExpensesByMethod: Record<string, number> = {};

      currentExpenses.forEach(e => {
        if (e.type === 'expense') {
          const mySplit = e.split.find(s => s.participantId === myParticipant.id);
          if (mySplit && mySplit.amount > 0) {
            let method = e.paymentMethod || 'Cash';
            if (method === 'online') method = 'UPI';
            myExpensesByMethod[method] = (myExpensesByMethod[method] || 0) + mySplit.amount;
          }
        }
      });

      const methods = ['Cash', 'UPI', 'Card'];
      for (const method of methods) {
        const amount = myExpensesByMethod[method] || 0;
        const transactionId = `trip_summary_${trip.id}_${currentUser.uid}_${method}`;
        const existingTransaction = transactions.find(t => t.id === transactionId);

        if (amount > 0) {
          if (existingTransaction) {
            await updateTransaction(transactionId, { amount, updatedAt: new Date() });
          } else {
            await addTransaction({
              id: transactionId,
              userId: currentUser.uid,
              type: 'expense',
              amount: amount,
              category: 'travel',
              description: `${trip.name} - Trip Expenses (${method})`,
              paymentMethod: method,
              date: new Date(),
              tripId: trip.id,
              tripName: trip.name,
              createdAt: new Date(),
              updatedAt: new Date()
            } as any);
          }
        } else if (existingTransaction) {
          await removeTransaction(transactionId);
        }
      }
    } catch (error) {
      console.error('Error syncing individual expenses:', error);
    }
  };

  const handleUpdateTrip = async () => {
    if (!trip || !currentUser) return;
    try {
      setIsUpdating(true);
      await syncExpensesToHistory(expenses);
      alert('Trip expenses synced successfully!');
    } catch (error) {
      console.error('Error syncing:', error);
      alert('Failed to sync expenses.');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleForceClose = async () => {
    if (!trip || !currentUser) return;

    if (!window.confirm('Force Close this trip? This will write off any remaining balances as Bad Debt (Expense) or Debt Forgiven (Income) in your main history. This cannot be undone.')) {
      return;
    }

    const myBalanceObj = balances.find(b => b.participant?.isCurrentUser);
    const myBalance = myBalanceObj ? myBalanceObj.balance : 0;

    if (Math.abs(myBalance) < 0.01) {
      alert('Balance is already zero. No write-off needed.');
      return;
    }

    try {
      const isOwed = myBalance > 0;
      const amount = Math.abs(myBalance);

      const transactionData = {
        id: `force_close_${trip.id}_${Date.now()}`,
        userId: currentUser.uid,
        type: isOwed ? 'expense' : 'income',
        amount: amount,
        category: isOwed ? 'Bad Debt' : 'Debt Forgiven',
        description: `Force Close: ${trip.name} - ${isOwed ? 'Bad Debt (Unpaid by others)' : 'Debt Forgiven (Unpaid by me)'}`,
        paymentMethod: 'equity', // Special internal type
        date: new Date(),
        tripId: trip.id,
        tripName: trip.name,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await addTransaction(transactionData as any);

      // Mark as force closed (optional, but good for UI)
      await updateTrip({
        ...trip,
        archived: true, // Auto archive
        ended: true,
        updatedAt: new Date()
      });

      alert(`Trip closed. Recorded ${isOwed ? 'Expense' : 'Income'} of ₹${amount.toFixed(2)}.`);
      navigate('/trips');
    } catch (error) {
      console.error('Error force closing:', error);
      alert('Failed to force close trip.');
    }
  };

  // Calculate if there are pending updates for completed trips
  const hasUpdates = useMemo(() => {
    if (!trip || !trip.ended || !currentUser) return false;

    const myParticipant = trip.participants.find(p => p.isCurrentUser);
    if (!myParticipant) return false;

    // Calculate current total for this user
    const currentMyTotal = expenses
      .filter(e => e.type === 'expense')
      .reduce((sum, e) => {
        const split = e.split.find(s => s.participantId === myParticipant.id);
        return sum + (split?.amount || 0);
      }, 0);

    // Try to find the settlement transaction
    const settlementTransaction = transactions.find(t => t.id === trip.settlementTransactionId);

    // Also check for method-specific summary transactions
    const methods = ['Cash', 'UPI', 'Card'];
    let summaryTotal = 0;
    methods.forEach(method => {
      const transactionId = `trip_summary_${trip.id}_${currentUser.uid}_${method}`;
      const t = transactions.find(tx => tx.id === transactionId);
      if (t) summaryTotal += t.amount;
    });

    if (summaryTotal > 0 && Math.abs(summaryTotal - currentMyTotal) > 0.01) {
      return true;
    }

    // Fallback/Legacy check
    if (settlementTransaction) {
      return currentMyTotal !== settlementTransaction.amount;
    } else if (trip.settlementTransactionId && currentMyTotal > 0) {
      return true;
    }

    return false;
  }, [trip, expenses, transactions, currentUser]);

  const handleExpenseClick = (expense: TripExpense) => {
    setSelectedExpense(expense);
    setShowExpenseDetail(true);
  };

  const handleNavigatePrev = () => {
    if (!selectedExpense) return;
    const currentIndex = expenses.findIndex(e => e.id === selectedExpense.id);
    if (currentIndex > 0) {
      setSelectedExpense(expenses[currentIndex - 1]);
    }
  };

  const handleNavigateNext = () => {
    if (!selectedExpense) return;
    const currentIndex = expenses.findIndex(e => e.id === selectedExpense.id);
    if (currentIndex < expenses.length - 1) {
      setSelectedExpense(expenses[currentIndex + 1]);
    }
  };

  const handleEditExpense = () => {
    setShowExpenseDetail(false);
    if (selectedExpense) {
      setSelectedExpenseToEdit(selectedExpense);
      setShowEditExpense(true);
    }
  };

  const [showEditExpense, setShowEditExpense] = useState(false);
  const [selectedExpenseToEdit, setSelectedExpenseToEdit] = useState<TripExpense | null>(null);

  const handleUpdateExpense = async (expense: TripExpense) => {
    await updateExpense(expense);
    setShowEditExpense(false);
    setSelectedExpenseToEdit(null);

    // Sync if trip is ended/archived
    if (currentUser && (trip?.ended || trip?.archived)) {
      // Create optimistically updated list
      const updatedExpenses = expenses.map(e => e.id === expense.id ? expense : e);

      // Update method-based summaries
      await syncExpensesToHistory(updatedExpenses);

      // Legacy/Settlement Transaction Update (Keep existing logic if needed for backward compatibility or single settlement txn)
      if (trip.settlementTransactionId) {
        const updatedMyExpenses = updatedExpenses
          .filter(e => e.type === 'expense' && e.id !== selectedExpenseToEdit?.id) // Wait, why filter selectedExpenseToEdit? Because typical reduce pattern. Here 'updatedExpenses' already has the edit. 
          // Actually, let's just re-calculate from updatedExpenses directly.
          .reduce((sum, e) => {
            const myParticipant = trip.participants.find(p => p.isCurrentUser);
            if (!myParticipant) return sum;
            const mySplit = e.split.find(s => s.participantId === myParticipant.id);
            return sum + (mySplit?.amount || 0);
          }, 0);

        const existingTransaction = transactions.find(t => t.id === trip.settlementTransactionId);
        if (updatedMyExpenses > 0 && existingTransaction) {
          await updateTransaction(trip.settlementTransactionId, { amount: updatedMyExpenses, updatedAt: new Date() });
        } else if (updatedMyExpenses === 0 && existingTransaction) {
          await removeTransaction(trip.settlementTransactionId);
          await updateTrip({ ...trip, settlementTransactionId: undefined, updatedAt: new Date() });
        }
      }
    }
  };

  const handleBackupToFirebase = async () => {
    if (!trip || !currentUser) return;

    try {
      setShowMenu(false);
      await tripBackupFirebaseService.backupTripToFirebase(currentUser.uid, trip, expenses);
      alert('✅ Trip backup saved to Firebase!');
    } catch (error) {
      console.error('Backup failed:', error);
      alert('Failed to backup to Firebase. Please try again.');
    }
  };

  const handleDeleteExpense = async (expenseId: string) => {
    if (!window.confirm('Delete this expense?')) return;

    await removeExpense(expenseId);
    setShowExpenseDetail(false);

    if (currentUser && (trip?.ended || trip?.archived)) {
      const remainingExpenses = expenses.filter(e => e.id !== expenseId);

      // Sync method-based summaries
      await syncExpensesToHistory(remainingExpenses);

      // Legacy/Settlement Transaction Update
      if (trip.settlementTransactionId) {
        const myParticipant = trip.participants.find(p => p.isCurrentUser);
        if (myParticipant) {
          const newTotal = remainingExpenses
            .filter(e => e.type === 'expense')
            .reduce((sum, e) => {
              const mySplit = e.split.find(s => s.participantId === myParticipant.id);
              return sum + (mySplit?.amount || 0);
            }, 0);

          const existingTransaction = transactions.find(t => t.id === trip.settlementTransactionId);
          if (newTotal > 0 && existingTransaction) {
            await updateTransaction(trip.settlementTransactionId, { amount: newTotal, updatedAt: new Date() });
          } else if (existingTransaction) {
            await removeTransaction(trip.settlementTransactionId);
            await updateTrip({ ...trip, settlementTransactionId: undefined, updatedAt: new Date() });
          }
        }
      }
    }
  };

  if (tripsLoading) {
    return (
      <PageTransition>
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
            <p className="text-gray-500 dark:text-gray-400">Loading trip...</p>
          </div>
        </div>
      </PageTransition>
    );
  }

  if (!trip) {
    return <Navigate to="/trips" replace />;
  }

  // Confirmation Modal
  const renderModals = () => (
    <ConfirmationModal
      isOpen={showDeleteConfirm}
      title="Delete Trip?"
      message={`Are you sure you want to delete "${trip?.name}"? This will permanently delete the trip and all associated expenses. This action cannot be undone.`}
      confirmText="Delete Trip"
      cancelText="Cancel"
      isDangerous={true}
      isLoading={isDeleting}
      onConfirm={confirmDeleteTrip}
      onCancel={() => setShowDeleteConfirm(false)}
    />
  );

  return (
    <PageTransition>
      {renderModals()}
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 pb-24">
        {/* Header */}
        <div className="bg-gradient-to-br from-blue-500 to-teal-500 text-white sticky top-0 z-40 select-none">
          <div className="max-w-md mx-auto px-4 py-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-3">
                <button onClick={() => navigate('/trips')} className="p-2 rounded-lg hover:bg-white/10">
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <div className="flex items-center gap-3">
                  {(() => {
                    const { icon: TripIcon, color } = getTripIcon(trip.icon || trip.name);
                    return (
                      <div className={`w-10 h-10 bg-gradient-to-br ${color} rounded-xl flex items-center justify-center shadow-lg`}>
                        <TripIcon className="w-5 h-5 text-white" />
                      </div>
                    );
                  })()}
                  <div>
                    <h1 className="text-xl font-bold">{trip.name}</h1>
                    <p className="text-xs text-white/70">{trip.participants.length} participants</p>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {trip.ended && hasUpdates && !isLocked && (
                  <button
                    onClick={handleUpdateTrip}
                    disabled={isUpdating}
                    className="px-3 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-1 disabled:opacity-70 disabled:cursor-not-allowed"
                  >
                    {isUpdating ? (
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      'Update Trip'
                    )}
                  </button>
                )}
                {!trip.ended && !isLocked && (
                  <button
                    onClick={handleEndTrip}
                    className="px-3 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-1"
                  >
                    <CheckCircle className="w-4 h-4" />
                    End Trip
                  </button>
                )}
                <div className="relative">
                  <button onClick={() => setShowMenu(!showMenu)} className="p-2 rounded-lg hover:bg-white/10">
                    <MoreVertical className="w-5 h-5" />
                  </button>
                  {showMenu && (
                    <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-lg py-1 z-50">
                      <button
                        onClick={handleShareTrip}
                        className="w-full px-4 py-2 text-left text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                      >
                        <Share2 className="w-4 h-4" />
                        Share
                      </button>
                      {!isLocked && (
                        <button
                          onClick={handleEditTrip}
                          className="w-full px-4 py-2 text-left text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                        >
                          <Edit2 className="w-4 h-4" />
                          Edit
                        </button>
                      )}
                      <button
                        onClick={handleInsights}
                        className="w-full px-4 py-2 text-left text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                      >
                        <BarChart3 className="w-4 h-4" />
                        Insights
                      </button>
                      <button
                        onClick={() => {
                          downloadTripBackup(trip, expenses);
                          setShowMenu(false);
                        }}
                        className="w-full px-4 py-2 text-left text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                      >
                        <Download className="w-4 h-4" />
                        Download Backup
                      </button>
                      <button
                        onClick={handleBackupToFirebase}
                        className="w-full px-4 py-2 text-left text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                      >
                        <Download className="w-4 h-4" />
                        Backup to Cloud
                      </button>
                      <button
                        onClick={handleArchiveTrip}
                        className="w-full px-4 py-2 text-left text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                      >
                        <Archive className="w-4 h-4" />
                        Archive
                      </button>
                      <button
                        onClick={handleDeleteTrip}
                        disabled={isDeleting}
                        className="w-full px-4 py-2 text-left text-red-600 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2 disabled:opacity-50"
                      >
                        {isDeleting ? (
                          <div className="w-4 h-4 border-2 border-red-600/30 border-t-red-600 rounded-full animate-spin" />
                        ) : (
                          <>
                            <Trash2 className="w-4 h-4" />
                            Delete
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setShowMyExpensesDetail(true)}
                className="bg-white/10 backdrop-blur-sm rounded-lg p-3 cursor-pointer hover:bg-white/20 transition-colors text-left"
              >
                <p className="text-xs text-white/70 mb-1">My Expenses</p>
                <p className="text-xl font-bold">₹{myExpenses.toFixed(2)}</p>
                <p className="text-xs text-white/60 mt-1">Tap to view breakdown</p>
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setShowCostBreakdown(true)}
                className="bg-white/10 backdrop-blur-sm rounded-lg p-3 cursor-pointer hover:bg-white/20 transition-colors text-left"
              >
                <p className="text-xs text-white/70 mb-1">Total Expenses</p>
                <p className="text-xl font-bold">₹{totalExpenses.toFixed(2)}</p>
                <p className="text-xs text-white/60 mt-1">Tap for breakdown</p>
              </motion.button>
            </div>

            {/* Tabs */}
            <div className="flex bg-white/10 backdrop-blur-sm rounded-lg p-1">
              <button
                onClick={() => setActiveTab('expenses')}
                className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${activeTab === 'expenses' ? 'bg-white text-blue-600' : 'text-white/70'
                  }`}
              >
                Expenses
              </button>
              <button
                onClick={() => setActiveTab('balances')}
                className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${activeTab === 'balances' ? 'bg-white text-blue-600' : 'text-white/70'
                  }`}
              >
                Balances
              </button>
              <button
                onClick={() => setActiveTab('chat')}
                className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${activeTab === 'chat' ? 'bg-white text-blue-600' : 'text-white/70'
                  }`}
              >
                AI Chat
              </button>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="max-w-md mx-auto px-4 py-4">
          {isFrozen && (
            <div className={`border-l-4 p-4 mb-4 rounded-r-lg ${isLocked ? 'bg-red-50 dark:bg-red-900/20 border-red-500' : 'bg-amber-50 dark:bg-amber-900/20 border-amber-500'}`}>
              <div className="flex items-center gap-2">
                <Archive className={`w-5 h-5 ${isLocked ? 'text-red-500' : 'text-amber-500'}`} />
                <div>
                  <h3 className={`text-sm font-medium ${isLocked ? 'text-red-800 dark:text-red-200' : 'text-amber-800 dark:text-amber-200'}`}>
                    {isLocked ? 'Trip Locked (100+ Days)' : 'Trip Frozen (90+ Days)'}
                  </h3>
                  <p className={`text-xs ${isLocked ? 'text-red-600 dark:text-red-300' : 'text-amber-600 dark:text-amber-300'}`}>
                    {isLocked
                      ? 'This trip is permanently locked. Unsettled balances must be written off.'
                      : 'New expenses disabled. You can still settle pending debts until 100 days.'}
                  </p>
                  {isLocked && balances.some(b => b.participant?.isCurrentUser && Math.abs(b.balance) > 0.01) && (
                    <button
                      onClick={handleForceClose}
                      className="mt-2 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-medium rounded-md transition-colors"
                    >
                      Force Close & Write Off Balance
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
          <AnimatePresence mode="wait">
            {activeTab === 'expenses' && (
              <motion.div
                key="expenses"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
              >
                {expenses.length === 0 ? (
                  <div className="text-center py-12">
                    <Receipt className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                    <p className="text-gray-500 dark:text-gray-400">No expenses yet</p>
                  </div>
                ) : (
                  <>
                    {/* Filter Buttons */}
                    <div className="flex gap-2 mb-4">
                      <button
                        onClick={() => setFilterTypes({ ...filterTypes, expense: !filterTypes.expense })}
                        className={`flex-1 py-2 px-3 rounded-lg text-xs font-medium transition-all ${filterTypes.expense
                          ? 'bg-red-500 text-white shadow-md'
                          : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                          }`}
                      >
                        Expense
                      </button>
                      <button
                        onClick={() => setFilterTypes({ ...filterTypes, income: !filterTypes.income })}
                        className={`flex-1 py-2 px-3 rounded-lg text-xs font-medium transition-all ${filterTypes.income
                          ? 'bg-green-500 text-white shadow-md'
                          : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                          }`}
                      >
                        Income
                      </button>
                      <button
                        onClick={() => setFilterTypes({ ...filterTypes, transfer: !filterTypes.transfer })}
                        className={`flex-1 py-2 px-3 rounded-lg text-xs font-medium transition-all ${filterTypes.transfer
                          ? 'bg-purple-500 text-white shadow-md'
                          : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                          }`}
                      >
                        Transfer
                      </button>
                    </div>

                    {/* Expenses List */}
                    <div className="space-y-2">
                      {expenses
                        .filter(e => filterTypes[e.type as keyof typeof filterTypes])
                        .map((expense, index) => {
                          const participant = trip.participants.find(p =>
                            p.id === (expense.paidBy || expense.receivedBy || expense.from)
                          );
                          const { icon: ExpenseIcon, color } = getExpenseIcon(expense.title, expense.category);
                          return (
                            <motion.div
                              key={expense.id}
                              initial={{ opacity: 0, y: 5 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: index * 0.02 }}
                              className="bg-white dark:bg-gray-800 rounded-xl p-2.5 shadow-sm cursor-pointer hover:shadow-md transition-all"
                              onClick={() => handleExpenseClick(expense)}
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  {expense.type === 'transfer' ? (
                                    <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-indigo-500 rounded-lg flex items-center justify-center">
                                      <ArrowLeftRight className="w-4 h-4 text-white" />
                                    </div>
                                  ) : (
                                    <div className={`w-8 h-8 bg-gradient-to-br ${color} rounded-lg flex items-center justify-center`}>
                                      <ExpenseIcon className="w-4 h-4 text-white" />
                                    </div>
                                  )}
                                  <div className="min-w-0">
                                    <h4 className="text-sm font-medium text-gray-900 dark:text-white truncate">{expense.title}</h4>
                                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                                      {expense.type === 'expense' && participant?.name}
                                      {expense.type === 'income' && `From ${participant?.name}`}
                                      {expense.type === 'transfer' && (() => {
                                        const fromP = trip.participants.find(p => p.id === expense.from);
                                        const toP = trip.participants.find(p => p.id === expense.transferredTo);
                                        const fromName = fromP?.isCurrentUser ? 'You' : fromP?.name;
                                        const toName = toP?.isCurrentUser ? 'You' : toP?.name;
                                        return `${fromName} → ${toName}`;
                                      })()}
                                    </p>
                                  </div>
                                </div>
                                <div className="text-right flex-shrink-0">
                                  <p className={`text-sm font-bold ${expense.type === 'expense' ? 'text-red-600' : expense.type === 'income' ? 'text-green-600' : 'text-purple-600'
                                    }`}>
                                    {expense.type === 'expense' ? '-' : '+'}₹{expense.amount.toFixed(0)}
                                  </p>
                                  <p className="text-[10px] text-gray-400">
                                    {new Date(expense.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                                  </p>
                                </div>
                              </div>
                            </motion.div>
                          );
                        })}
                    </div>
                  </>
                )}
              </motion.div>
            )}

            {activeTab === 'balances' && (
              <motion.div
                key="balances"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
              >
                <h3 className="font-semibold text-gray-900 dark:text-white mb-3 text-sm">Current Balances</h3>
                <div className="space-y-2">
                  {balances.map(({ participant, balance }) => {
                    const isPositive = balance >= 0.01;
                    const isNegative = balance <= -0.01;
                    const isSettled = !isPositive && !isNegative;

                    return (
                      <div
                        key={participant?.id}
                        className={`rounded-lg p-3 flex items-center justify-between border ${isPositive
                          ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800/30'
                          : isNegative
                            ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800/30'
                            : 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700'
                          }`}
                      >
                        <div className="flex items-center gap-2">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-xs ${isPositive ? 'bg-gradient-to-br from-green-400 to-emerald-500' :
                            isNegative ? 'bg-gradient-to-br from-red-400 to-orange-500' :
                              'bg-gradient-to-br from-gray-400 to-gray-500'
                            }`}>
                            {participant?.name[0].toUpperCase()}
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-900 dark:text-white">
                              {participant?.isCurrentUser ? currentUser?.displayName || participant?.name : participant?.name}
                            </p>
                            <p className={`text-xs ${isPositive ? 'text-green-600 dark:text-green-400' :
                              isNegative ? 'text-red-600 dark:text-red-400' :
                                'text-gray-500 dark:text-gray-400'
                              }`}>
                              {isSettled ? 'Settled ✓' :
                                isPositive ? 'receives' : 'pays'}
                            </p>
                          </div>
                        </div>
                        <p className={`text-lg font-bold ${isPositive ? 'text-green-600 dark:text-green-400' :
                          isNegative ? 'text-red-600 dark:text-red-400' :
                            'text-gray-500 dark:text-gray-400'
                          }`}>
                          ₹{Math.abs(balance).toFixed(0)}
                        </p>
                      </div>
                    );
                  })}
                </div>

                {/* Settlements to be Done */}
                {(() => {
                  const { settlements } = calculateSettlements(trip, expenses);
                  if (settlements.length === 0) return null;

                  return (
                    <div className="mt-5">
                      <h4 className="font-semibold text-gray-900 dark:text-white mb-3">
                        Settlements to be Done
                      </h4>
                      <div className="space-y-2">
                        {settlements.map((settlement, index) => {
                          // settlement.from and settlement.to are TripParticipant objects
                          const isFromCurrentUser = settlement.from.isCurrentUser;
                          const isToCurrentUser = settlement.to.isCurrentUser;
                          const fromName = isFromCurrentUser
                            ? 'You'
                            : settlement.from.name;
                          const toName = isToCurrentUser
                            ? 'You'
                            : settlement.to.name;

                          return (
                            <motion.button
                              key={`${settlement.from.id}-${settlement.to.id}-${index}`}
                              initial={{ opacity: 0, y: 8 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: index * 0.08, type: 'spring', stiffness: 300 }}
                              whileHover={{ scale: 1.02, y: -1 }}
                              whileTap={{ scale: 0.98 }}
                              onClick={() => {
                                const debtor = balances.find(b => b.participant?.id === settlement.from.id);
                                const creditor = balances.find(b => b.participant?.id === settlement.to.id);
                                if (debtor && creditor) {
                                  setSelectedSettlement({ debtor, creditor });
                                  setShowSettlementDetail(true);
                                }
                              }}
                              className="w-full bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 hover:from-amber-100 hover:to-orange-100 dark:hover:from-amber-900/30 dark:hover:to-orange-900/30 rounded-xl p-3 text-left transition-all border border-amber-100 dark:border-amber-800/30 shadow-sm"
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex-1">
                                  <p className="text-sm text-gray-700 dark:text-gray-300">
                                    {isFromCurrentUser ? 'You will give' : `${fromName} will give`}
                                  </p>
                                  <p className="text-xs text-gray-500 dark:text-gray-400">
                                    {isToCurrentUser ? 'You will receive' : `${toName} will receive`}
                                  </p>
                                </div>
                                <div className="text-right">
                                  <p className="text-xl font-bold text-amber-600 dark:text-amber-400">
                                    ₹{settlement.amount.toFixed(0)}
                                  </p>
                                  <p className="text-[10px] text-amber-500/70">
                                    pending
                                  </p>
                                </div>
                              </div>
                            </motion.button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}

                {/* Previous Settlements */}
                {previousSettlements.length > 0 && (
                  <div className="mt-4">
                    <h4 className="font-semibold text-gray-900 dark:text-white mb-2 text-sm">Previous Settlements</h4>
                    <div className="space-y-2">
                      {previousSettlements.map((settlement, index) => {
                        const fromParticipant = trip.participants.find(p => p.id === settlement.from);
                        const toParticipant = trip.participants.find(p => p.id === settlement.transferredTo);

                        const isCurrentUserFrom = fromParticipant?.isCurrentUser || settlement.from === currentUser?.uid;
                        const isCurrentUserTo = toParticipant?.isCurrentUser || settlement.transferredTo === currentUser?.uid;

                        const fromName = fromParticipant?.name || 'Unknown';
                        const toName = toParticipant?.name || 'Unknown';

                        return (
                          <motion.div
                            key={settlement.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.05 }}
                            className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3 border border-green-100 dark:border-green-800/30"
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <p className="text-xs text-gray-600 dark:text-gray-400">
                                  {isCurrentUserFrom ? 'You gave' : `${fromName} gave`}
                                </p>
                                <p className="text-xs text-gray-600 dark:text-gray-400">
                                  {isCurrentUserTo ? 'You received' : `${toName} received`}
                                </p>
                                <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                                  {new Date(settlement.date).toLocaleDateString()}
                                </p>
                              </div>
                              <div className="text-right flex-shrink-0">
                                <p className="text-lg font-bold text-green-600 dark:text-green-400">
                                  ₹{settlement.amount.toFixed(2)}
                                </p>
                                <p className="text-xs text-gray-500 dark:text-gray-400">
                                  settled
                                </p>
                              </div>
                            </div>
                          </motion.div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </motion.div>
            )}

            {activeTab === 'chat' && (
              <motion.div
                key="chat"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 top-[280px] bg-gray-50 dark:bg-gray-900 flex flex-col overflow-hidden z-10"
              >
                <TripAIChatAssistant trip={trip} expenses={expenses} onAddExpense={handleAddExpense} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Add Expense FAB */}
        {activeTab === 'expenses' && !isFrozen && (
          <button
            onClick={() => setShowAddExpense(true)}
            className="fixed bottom-20 right-4 w-14 h-14 bg-blue-500 text-white rounded-full shadow-lg flex items-center justify-center hover:bg-blue-600 transition-colors z-30"
          >
            <Plus className="w-6 h-6" />
          </button>
        )}

        {/* Add Expense Modal */}
        {showAddExpense && (
          <AddTripExpenseModal
            trip={trip}
            onClose={() => setShowAddExpense(false)}
            onAdd={handleAddExpense}
          />
        )}

        {/* Expense Detail Modal */}
        {showExpenseDetail && selectedExpense && (
          <ExpenseDetailModal
            expense={selectedExpense}
            trip={trip}
            onClose={() => {
              setShowExpenseDetail(false);
              setSelectedExpense(null);
            }}
            onEdit={handleEditExpense}
            onDelete={handleDeleteExpense}
            onNavigatePrev={handleNavigatePrev}
            onNavigateNext={handleNavigateNext}
            hasPrev={expenses.findIndex(e => e.id === selectedExpense.id) > 0}
            hasNext={expenses.findIndex(e => e.id === selectedExpense.id) < expenses.length - 1}
          />
        )}

        {/* Edit Expense Modal */}
        {showEditExpense && selectedExpenseToEdit && (
          <AddTripExpenseModal
            trip={trip}
            onClose={() => {
              setShowEditExpense(false);
              setSelectedExpenseToEdit(null);
            }}
            onAdd={handleUpdateExpense}
            initialExpense={selectedExpenseToEdit}
          />
        )}

        {/* Settlement Breakdown Modal */}
        {showSettlementDetail && selectedSettlement && trip && (
          <SettlementBreakdownModal
            isOpen={showSettlementDetail}
            onClose={() => {
              setShowSettlementDetail(false);
              setSelectedSettlement(null);
            }}
            debtor={selectedSettlement.debtor}
            creditor={selectedSettlement.creditor}
            expenses={expenses}
            trip={trip}
            onSettle={async (transfer) => {
              await addExpense(transfer);
            }}
          />
        )}

        {/* My Expenses Detail Modal */}
        {showMyExpensesDetail && trip && (
          <MyExpensesDetailModal
            isOpen={showMyExpensesDetail}
            onClose={() => setShowMyExpensesDetail(false)}
            trip={trip}
            expenses={expenses}
            myExpenses={myExpenses}
          />
        )}

        {/* Cost Breakdown Modal */}
        {showCostBreakdown && trip && (
          <CostBreakdownModal
            isOpen={showCostBreakdown}
            onClose={() => setShowCostBreakdown(false)}
            trip={trip}
            expenses={expenses}
          />
        )}

        {/* Edit Trip Modal */}
        {showEditTrip && trip && (
          <EditTripModal
            trip={trip}
            onClose={() => setShowEditTrip(false)}
            onUpdate={handleUpdateTripDetails}
          />
        )}
      </div>
    </PageTransition>
  );
};

const MyExpensesDetailModal = ({ isOpen, onClose, trip, expenses, myExpenses }: {
  isOpen: boolean;
  onClose: () => void;
  trip: any;
  expenses: TripExpense[];
  myExpenses: number;
}) => {
  if (!isOpen) return null;

  const myParticipant = trip.participants.find((p: any) => p.isCurrentUser);
  if (!myParticipant) return null;

  const myExpensesList = expenses
    .filter(e => e.type === 'expense')
    .map(e => {
      const mySplit = e.split.find(s => s.participantId === myParticipant.id);
      if (!mySplit || mySplit.amount === 0) return null;
      return {
        ...e,
        myShare: mySplit.amount
      };
    })
    .filter(Boolean);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-center justify-center"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: '100%', opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: '100%', opacity: 0 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="bg-white dark:bg-gray-800 rounded-3xl w-full max-w-md max-h-[85vh] overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-gradient-to-br from-blue-500 to-indigo-600 text-white p-6 z-10">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-2xl font-bold">My Expenses</h2>
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/10">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <p className="text-white/80 text-sm">Your share from {trip.name}</p>
          <div className="mt-4 bg-white/20 backdrop-blur-sm rounded-lg p-4">
            <p className="text-sm text-white/70 mb-1">Total My Expenses</p>
            <p className="text-3xl font-bold">₹{myExpenses.toFixed(2)}</p>
          </div>
        </div>

        <div className="p-6 overflow-y-auto max-h-[calc(85vh-200px)]">
          {myExpensesList.length > 0 ? (
            <div className="space-y-3">
              {myExpensesList.map((expense: any, index: number) => {
                const { icon: ExpenseIcon, color } = getExpenseIcon(expense.title, expense.category);
                return (
                  <motion.div
                    key={expense.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="bg-gray-50 dark:bg-gray-700 rounded-xl p-4"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 bg-gradient-to-br ${color} rounded-xl flex items-center justify-center shadow-md`}>
                          <ExpenseIcon className="w-5 h-5 text-white" />
                        </div>
                        <div>
                          <h4 className="font-medium text-gray-900 dark:text-white">{expense.title}</h4>
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            Total: ₹{expense.amount.toFixed(2)}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-red-600 dark:text-red-400">₹{expense.myShare.toFixed(2)}</p>
                        <p className="text-xs text-gray-500">My share</p>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-12">
              <p className="text-gray-500 dark:text-gray-400">No expenses found</p>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
};

const EditTripModal = ({ trip, onClose, onUpdate }: {
  trip: any;
  onClose: () => void;
  onUpdate: (name: string, participants: string[]) => void;
}) => {
  const [tripName, setTripName] = useState(trip.name);
  const [participantInput, setParticipantInput] = useState('');
  const [participants, setParticipants] = useState<string[]>(
    trip.participants.map((p: any) => p.name)
  );
  const [isUpdating, setIsUpdating] = useState(false);

  const handleAddParticipant = () => {
    if (participantInput.trim() && !participants.includes(participantInput.trim())) {
      setParticipants([...participants, participantInput.trim()]);
      setParticipantInput('');
    }
  };

  const handleRemoveParticipant = (index: number) => {
    if (index === 0) return; // Can't remove "Me"
    setParticipants(participants.filter((_, i) => i !== index));
  };

  const handleUpdate = async () => {
    if (tripName.trim() && participants.length > 0 && !isUpdating) {
      setIsUpdating(true);
      try {
        await onUpdate(tripName.trim(), participants);
      } finally {
        setIsUpdating(false);
      }
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 100, opacity: 0 }}
        className="bg-white dark:bg-gray-800 rounded-3xl w-full max-w-md max-h-[85vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-6">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Edit Trip</h2>

          {/* Trip Name */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Trip Name
            </label>
            <input
              type="text"
              value={tripName}
              onChange={e => setTripName(e.target.value)}
              className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="e.g., Goa Trip 2024"
            />
          </div>

          {/* Participants */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Participants
            </label>
            <div className="space-y-2 mb-3">
              {participants.map((participant, index) => (
                <div key={index} className="flex items-center justify-between bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-gradient-to-br from-blue-400 to-purple-400 rounded-full flex items-center justify-center text-white font-bold text-sm">
                      {participant[0].toUpperCase()}
                    </div>
                    <span className="text-gray-900 dark:text-white font-medium">
                      {participant}
                      {index === 0 && <span className="ml-2 text-xs text-gray-500">(Me)</span>}
                    </span>
                  </div>
                  {index > 0 && (
                    <button
                      onClick={() => handleRemoveParticipant(index)}
                      className="text-red-500 hover:text-red-600"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>
              ))}
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                value={participantInput}
                onChange={e => setParticipantInput(e.target.value)}
                onKeyPress={e => e.key === 'Enter' && handleAddParticipant()}
                className="flex-1 px-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Add participant name"
              />
              <button
                onClick={handleAddParticipant}
                className="px-4 py-3 bg-blue-500 text-white rounded-xl hover:bg-blue-600 transition-colors"
              >
                Add
              </button>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-3 bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white rounded-xl font-medium hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleUpdate}
              disabled={!tripName.trim() || participants.length === 0 || isUpdating}
              className="flex-1 px-4 py-3 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-xl font-medium hover:from-blue-600 hover:to-indigo-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isUpdating ? 'Updating...' : 'Update Trip'}
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default TripDetailPage;
