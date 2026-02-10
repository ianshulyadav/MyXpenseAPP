import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, TrendingUp, TrendingDown, Search, Filter, ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import PageTransition from '../components/PageTransition';
import SearchBar from '../components/SearchBar';
import { TransactionSummaryBar } from '../components/TransactionSummaryBar';
import { TransactionCard } from '../components/TransactionCard';
import { useTransactions } from '../hooks/useFirestoreSync';
import { useTripSettlements } from '../hooks/useTripSettlements';
import { computeRunningBalanceMap } from '../utils/runningBalance';
import type { Transaction } from '../types';
import { TransactionListSkeleton } from '../components/Skeleton';

const TransactionsPage = () => {
  const navigate = useNavigate();
  const { transactions, loading: transactionsLoading, removeTransaction } = useTransactions();
  const { tripSettlements, loading: tripSettlementsLoading } = useTripSettlements();
  const [searchQuery, setSearchQuery] = useState('');

  // Combined transactions list
  const allTransactions = useMemo(() => {
    return [...transactions, ...tripSettlements];
  }, [transactions, tripSettlements]);

  // Loading state
  const loading = transactionsLoading || tripSettlementsLoading;

  // New Filter States
  const [showFilters, setShowFilters] = useState(false);
  const filterDropdownRef = useRef<HTMLDivElement>(null);
  const [filterType, setFilterType] = useState<'all' | 'income' | 'expense' | 'debt' | 'trip' | 'settlement'>('all');
  const [filterPeriod, setFilterPeriod] = useState<'all' | 'today' | 'week' | 'month' | 'custom'>('all');
  const [filterPayment, setFilterPayment] = useState<'all' | 'upi' | 'cash' | 'card'>('all');
  const [customDateRange, setCustomDateRange] = useState<{ start: string; end: string }>({ start: '', end: '' });

  const [swipedTransaction, setSwipedTransaction] = useState<string | null>(null);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedTransactions, setSelectedTransactions] = useState<Set<string>>(new Set());
  const longPressTimerRef = useRef<number | null>(null);
  const [page, setPage] = useState(1);
  const ITEMS_PER_PAGE = 50; // Load 50 transactions at a time



  // Calculate Running Balances for UI — uses shared utility for consistency with Dashboard
  const runningBalanceMap = useMemo(() => {
    return computeRunningBalanceMap(transactions, tripSettlements);
  }, [transactions, tripSettlements]);



  // Handle click outside to close filters
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (filterDropdownRef.current && !filterDropdownRef.current.contains(event.target as Node)) {
        setShowFilters(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const filteredTransactions = useMemo(() => {
    if (loading) return [];

    let filtered = [...allTransactions];
    const now = new Date();
    const todayStr = now.toDateString();

    // 1. Filter by Type
    if (filterType === 'income') {
      filtered = filtered.filter(t => t.type === 'income');
    } else if (filterType === 'expense') {
      filtered = filtered.filter(t => t.type === 'expense');
    } else if (filterType === 'debt') {
      filtered = filtered.filter(t => t.type === 'debt');
    } else if (filterType === 'trip') {
      filtered = filtered.filter(t => !!(t as any).tripId);
    } else if (filterType === 'settlement') {
      // Show only settled debts or transactions explicitly categorized as settlements
      filtered = filtered.filter(t => t.debtStatus === 'settled' || t.category?.toLowerCase().includes('settlement'));
    } else if (filterType === 'all') {
      // Hide debt transactions by default, but show settled ones (Completed Settlements)
      // AND Show pending trip settlements/debts so they appear in history (requested by user)
      // Or maybe we should show them? User said "Similar show for the settlements Transaction Card... is showing without deducting"
      // This implies they WANT to see them.
      // Let's show all debts in "All" filter to be safe and transparent about balance.
      // filtered = filtered.filter(t => t.type !== 'debt' || t.debtStatus === 'settled'); 
      // User's screenshot shows "Lent to Ar" (Debt) in Recent Transactions.
      // So 'All' should definitely include Debts.
    }

    // 2. Filter by Payment Method
    if (filterPayment !== 'all') {
      filtered = filtered.filter(t => t.paymentMethod?.toLowerCase() === filterPayment);
    }

    // 3. Filter by Period
    if (filterPeriod === 'today') {
      filtered = filtered.filter(t => new Date(t.date).toDateString() === todayStr);
    } else if (filterPeriod === 'week') {
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      filtered = filtered.filter(t => new Date(t.date) >= weekAgo);
    } else if (filterPeriod === 'month') {
      const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      filtered = filtered.filter(t => new Date(t.date) >= monthAgo);
    } else if (filterPeriod === 'custom' && customDateRange.start && customDateRange.end) {
      const start = new Date(customDateRange.start);
      start.setHours(0, 0, 0, 0);
      const end = new Date(customDateRange.end);
      end.setHours(23, 59, 59, 999);
      filtered = filtered.filter(t => {
        const d = new Date(t.date);
        return d >= start && d <= end;
      });
    }

    // 4. Filter by Search Query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(t =>
        t.description?.toLowerCase().includes(query) ||
        t.category?.toLowerCase().includes(query) ||
        t.paymentMethod?.toLowerCase().includes(query)
      );
    }

    // Sort by recently added: newest first, with secondary sort on createdAt
    filtered.sort((a: any, b: any) => {
      const dateA = new Date(a.date).getTime();
      const dateB = new Date(b.date).getTime();
      if (dateA === dateB) {
        const createdA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const createdB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return createdB - createdA;
      }
      return dateB - dateA;
    });

    return filtered;
  }, [allTransactions, loading, filterType, filterPeriod, filterPayment, customDateRange, searchQuery]);

  const displayedTransactions = useMemo(() => {
    const start = 0;
    const end = page * ITEMS_PER_PAGE;
    return filteredTransactions.slice(start, end);
  }, [filteredTransactions, page]);

  // Handle search input change
  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query);
  }, []);

  const handleLoadMore = useCallback(() => {
    setPage(prev => prev + 1);
  }, []);

  const handleDeleteTransaction = useCallback(async (id: string) => {
    try {
      await removeTransaction(id);
      setSwipedTransaction(null);
    } catch (error) {
      console.error('Error deleting transaction:', error);
    }
  }, [removeTransaction]);

  const handleLongPressStart = useCallback((transactionId: string) => {
    const timer = window.setTimeout(() => {
      setSelectionMode(true);
      setSelectedTransactions(new Set([transactionId]));
      longPressTimerRef.current = null;
    }, 800); // 800ms for long press
    longPressTimerRef.current = timer;
  }, []);

  const handleLongPressEnd = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  const handleToggleSelect = useCallback((transactionId: string) => {
    if (!selectionMode) return;

    setSelectedTransactions(prev => {
      const newSet = new Set(prev);
      if (newSet.has(transactionId)) {
        newSet.delete(transactionId);
      } else {
        newSet.add(transactionId);
      }

      // Exit selection mode if no transactions selected
      if (newSet.size === 0) {
        setSelectionMode(false);
      }

      return newSet;
    });
  }, [selectionMode]);

  const handleCancelSelection = useCallback(() => {
    setSelectionMode(false);
    setSelectedTransactions(new Set());
  }, []);

  const getSelectedTransactionObjects = (): Transaction[] => {
    // This is cheap enough to run on render or could be memoized if needed
    return filteredTransactions.filter(t => selectedTransactions.has(t.id));
  };

  const totalIncome = filteredTransactions.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
  const totalExpense = filteredTransactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);

  return (
    <>
      <PageTransition>
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 pb-32">
          {/* Header */}
          <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-40">
            <div className="max-w-md mx-auto px-4 py-4">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-3">
                  <button onClick={() => navigate('/')} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700">
                    <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-300" />
                  </button>
                  <div>
                    <h1 className="text-xl font-bold text-gray-900 dark:text-white">All Transactions</h1>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{filteredTransactions.length} transactions</p>
                  </div>
                </div>
              </div>

              {/* Summary Cards */}
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div className="bg-green-50 dark:bg-green-900/20 rounded-xl p-3 border border-green-200 dark:border-green-800">
                  <div className="flex items-center space-x-2 mb-1">
                    <TrendingUp className="w-4 h-4 text-green-500" />
                    <span className="text-xs text-gray-600 dark:text-gray-400">Total Income</span>
                  </div>
                  <p className="text-lg font-bold text-green-600 dark:text-green-400">₹{totalIncome.toLocaleString()}</p>
                </div>
                <div className="bg-red-50 dark:bg-red-900/20 rounded-xl p-3 border border-red-200 dark:border-red-800">
                  <div className="flex items-center space-x-2 mb-1">
                    <TrendingDown className="w-4 h-4 text-red-500" />
                    <span className="text-xs text-gray-600 dark:text-gray-400">Total Expense</span>
                  </div>
                  <p className="text-lg font-bold text-red-600 dark:text-red-400">₹{totalExpense.toLocaleString()}</p>
                </div>
              </div>

              {/* Search and Filters Row */}
              <div className="mb-3 flex gap-2 relative z-20">
                {/* Filter Button */}
                <div ref={filterDropdownRef}>
                  <button
                    onClick={() => setShowFilters(!showFilters)}
                    className={`h-[42px] px-3 rounded-xl border transition-all flex items-center justify-center gap-2 ${showFilters || filterType !== 'all' || filterPeriod !== 'all' || filterPayment !== 'all'
                      ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-400'
                      : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300'
                      }`}
                  >
                    <Filter className="w-4 h-4" />
                    <span className="hidden sm:inline text-sm font-medium">Filters</span>
                    {(filterType !== 'all' || filterPeriod !== 'all' || filterPayment !== 'all') && (
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-500 text-[10px] text-white">
                        {(filterType !== 'all' ? 1 : 0) + (filterPeriod !== 'all' ? 1 : 0) + (filterPayment !== 'all' ? 1 : 0)}
                      </span>
                    )}
                    <ChevronDown className={`w-4 h-4 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
                  </button>

                  {/* Filter Dropdown */}
                  <AnimatePresence>
                    {showFilters && (
                      <motion.div
                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                        className="absolute top-12 left-0 right-0 bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-700 p-4 z-50 origin-top"
                      >
                        <div className="flex items-center justify-between mb-4">
                          <h3 className="font-semibold text-gray-900 dark:text-white">Filters</h3>
                          {(filterType !== 'all' || filterPeriod !== 'all' || filterPayment !== 'all') && (
                            <button
                              onClick={() => {
                                setFilterType('all');
                                setFilterPeriod('all');
                                setFilterPayment('all');
                                setCustomDateRange({ start: '', end: '' });
                              }}
                              className="text-xs text-red-500 font-medium hover:text-red-600"
                            >
                              Reset All
                            </button>
                          )}
                        </div>

                        {/* Filter by Type */}
                        <div className="mb-4">
                          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Type</p>
                          <div className="flex flex-wrap gap-2">
                            {['all', 'income', 'expense', 'trip', 'settlement'].map((t) => (
                              <button
                                key={t}
                                onClick={() => setFilterType(t as any)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${filterType === t
                                  ? 'bg-blue-500 text-white'
                                  : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                                  }`}
                              >
                                {t.charAt(0).toUpperCase() + t.slice(1)}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Filter by Payment Method */}
                        <div className="mb-4">
                          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Payment</p>
                          <div className="flex flex-wrap gap-2">
                            {['all', 'upi', 'cash', 'card'].map((p) => (
                              <button
                                key={p}
                                onClick={() => setFilterPayment(p as any)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${filterPayment === p
                                  ? 'bg-blue-500 text-white'
                                  : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                                  }`}
                              >
                                {p === 'upi' ? 'UPI' : p.charAt(0).toUpperCase() + p.slice(1)}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Filter by Period */}
                        <div className="mb-4">
                          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Period</p>
                          <div className="flex flex-wrap gap-2">
                            {['all', 'today', 'week', 'month', 'custom'].map((p) => (
                              <button
                                key={p}
                                onClick={() => setFilterPeriod(p as any)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${filterPeriod === p
                                  ? 'bg-blue-500 text-white'
                                  : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                                  }`}
                              >
                                {p.charAt(0).toUpperCase() + p.slice(1)}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Custom Date Range */}
                        {filterPeriod === 'custom' && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="overflow-hidden"
                          >
                            <div className="flex gap-2 items-center bg-gray-50 dark:bg-gray-700/50 p-2 rounded-xl border border-gray-100 dark:border-gray-700">
                              <div className="flex-1">
                                <label className="text-[10px] text-gray-500 block mb-1 ml-1">From</label>
                                <input
                                  type="date"
                                  value={customDateRange.start}
                                  onChange={(e) => setCustomDateRange(prev => ({ ...prev, start: e.target.value }))}
                                  className="w-full bg-white dark:bg-gray-700 rounded-lg px-2 py-1 text-xs border border-gray-200 dark:border-gray-600 focus:ring-2 focus:ring-blue-500 outline-none"
                                />
                              </div>
                              <div className="flex-1">
                                <label className="text-[10px] text-gray-500 block mb-1 ml-1">To</label>
                                <input
                                  type="date"
                                  value={customDateRange.end}
                                  onChange={(e) => setCustomDateRange(prev => ({ ...prev, end: e.target.value }))}
                                  className="w-full bg-white dark:bg-gray-700 rounded-lg px-2 py-1 text-xs border border-gray-200 dark:border-gray-600 focus:ring-2 focus:ring-blue-500 outline-none"
                                />
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Search Bar - Flex 1 to take remaining space */}
                <div className="flex-1">
                  <SearchBar onSearch={handleSearch} placeholder="Search..." />
                </div>
              </div>
            </div>
          </div>

          {/* Transactions List */}
          <div className="max-w-md mx-auto p-4">
            {loading ? (
              <TransactionListSkeleton count={8} />
            ) : filteredTransactions.length > 0 ? (
              <>
                <AnimatePresence>
                  {displayedTransactions.map((transaction) => (
                    <TransactionCard
                      key={transaction.id}
                      transaction={transaction}
                      isSelected={selectedTransactions.has(transaction.id)}
                      selectionMode={selectionMode}
                      isSwiped={swipedTransaction === transaction.id && !selectionMode}
                      onSwipe={setSwipedTransaction}
                      onLongPressStart={handleLongPressStart}
                      onLongPressEnd={handleLongPressEnd}
                      onToggleSelect={handleToggleSelect}
                      onDelete={handleDeleteTransaction}
                      runningBalance={runningBalanceMap.get(transaction.id)}
                    />
                  ))}
                </AnimatePresence>

                {/* Load More Button */}
                {displayedTransactions.length < filteredTransactions.length && (
                  <motion.button
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    onClick={handleLoadMore}
                    className="w-full mt-4 py-3 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white rounded-xl font-medium shadow-md transition-all"
                  >
                    Load More ({filteredTransactions.length - displayedTransactions.length} more)
                  </motion.button>
                )}
              </>
            ) : (
              <div className="text-center py-12">
                <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Search className="w-8 h-8 text-gray-400" />
                </div>
                <p className="text-gray-500 dark:text-gray-400 text-sm">No transactions found</p>
                <p className="text-gray-400 dark:text-gray-500 text-xs mt-1">Try adjusting your filters</p>
              </div>
            )}
          </div>

          {/* Transaction Summary Bar */}
          <AnimatePresence>
            {selectionMode && selectedTransactions.size > 0 && (
              <TransactionSummaryBar
                selectedTransactions={getSelectedTransactionObjects()}
                onCancel={handleCancelSelection}
              />
            )}
          </AnimatePresence>
        </div>
      </PageTransition>
    </>
  );
};

export default TransactionsPage;
