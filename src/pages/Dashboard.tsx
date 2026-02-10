import { lazy, Suspense } from 'react';
// Lazy load heavy components
const ProfileSettingsModal = lazy(() => import('../components/ProfileSettingsModal'));
import { useNavigate } from 'react-router-dom';
import {
  Wallet,
  TrendingUp,
  TrendingDown,
  Calendar,
  CalendarDays,
  Minus,
  Plus,
  Scan,
  Sun,
  Moon,
  Bell,
  Eye,
  EyeOff,
  Filter,
  AlertTriangle,
  Edit,
  Lock,
  HandCoins,
  X,
  CreditCard,
  MoreHorizontal,
  ChevronRight,
  ArrowRightLeft
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSwipeable } from 'react-swipeable';
import NotificationsModal from '../components/NotificationsModal';

import AddTransactionModal from '../components/AddTransactionModal';
import AddGoalModal from '../components/AddGoalModal';
import UpdateGoalModal from '../components/UpdateGoalModal';
import EditGoalModal from '../components/EditGoalModal';
import PageTransition from '../components/PageTransition';

import { TransferFundsModal } from '../components/TransferFundsModal';
import MonthlyOverviewCard from '../components/MonthlyOverviewCard';
import SearchBar from '../components/SearchBar';
import LowBalanceBanner from '../components/LowBalanceBanner';
import ScanReceiptModal from '../components/ScanReceiptModal';
import BorrowMoneyModal from '../components/BorrowMoneyModal';
import { TransactionCard } from '../components/TransactionCard';
import { TransactionSkeleton, GoalSkeleton, DashboardCardSkeleton } from '../components/SkeletonLoader';

import { useAuth } from '../context/AuthContext';
import { getUnreadNotifications, getSecretVault } from '../utils/db';
import { generateUUID } from '../utils/helpers';
import { calculateFinanceStats } from '../utils/finance';
import { computeRunningBalanceMap } from '../utils/runningBalance';

import AIChatAssistant from '../components/AIChatAssistant';
import AIInsightsCard from '../components/AIInsightsCard';
import DailyDigestModal from '../components/DailyDigestModal';
import type { RecurringRule } from '../types';
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useTransactions, useBudgets, useGoals } from '../hooks/useFirestoreSync';

import DebtBreakdownModal from '../components/DebtBreakdownModal';
import { hybridDataService } from '../services/hybridDataService';
import { useTripSettlements } from '../hooks/useTripSettlements'; // Import new hook
import SettlementConfirmationModal from '../components/SettlementConfirmationModal';
import SmartPasteModal from '../components/SmartPasteModal';
import SmartParserCard from '../components/SmartParserCard';

const Dashboard = () => {
  const navigate = useNavigate();
  const { userProfile } = useAuth();

  // Animation Variants
  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.02
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 5 },
    show: { opacity: 1, y: 0 }
  };

  // Firestore hooks for real-time data
  const { transactions: transactionsRaw, loading: transactionsLoading, addTransaction, removeTransaction, updateTransaction, refreshTransactions } = useTransactions();
  const { budgets, loading: budgetsLoading } = useBudgets();
  const { goals, loading: goalsLoading, refreshGoals } = useGoals();
  const { tripSettlements, loading: tripSettlementsLoading, refreshTrips, setTripSettlements, breakdownAdjustments } = useTripSettlements();

  // Combine Transactions and Trip Settlements for UI Lists & Calculations
  const transactions = useMemo(() => {
    return [...transactionsRaw, ...tripSettlements];
  }, [transactionsRaw, tripSettlements]);

  // State Definitions
  const [userName, setUserName] = useState('User');
  const [balance, setBalance] = useState(0);
  const [weekSpending, setWeekSpending] = useState(0);
  const [monthSpending, setMonthSpending] = useState(0);
  const [filteredTransactions, setFilteredTransactions] = useState<any[]>([]);
  const [isDark, setIsDark] = useState(false);
  const [isBalanceVisible, setIsBalanceVisible] = useState(() => {
    const saved = sessionStorage.getItem('myxpense_balance_visible');
    return saved === 'true';
  });

  const [activeFilter, setActiveFilter] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddTransaction, setShowAddTransaction] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isLowBalance, setIsLowBalance] = useState(false);
  const [lowBalanceThreshold, setLowBalanceThreshold] = useState(1000);
  const [showDailyDigest, setShowDailyDigest] = useState(false);

  // Previously missing states
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [swipedTransaction, setSwipedTransaction] = useState<string | null>(null);
  const [showExpenseFilter, setShowExpenseFilter] = useState(false);
  const [expenseFilterPeriod, setExpenseFilterPeriod] = useState('Lifetime');

  // Load user data
  useEffect(() => {
    const userData = localStorage.getItem('user_data');
    if (userData) {
      const { name } = JSON.parse(userData);
      setUserName(name || 'User');
    }

    // Low balance threshold
    const threshold = localStorage.getItem('low_balance_threshold');
    if (threshold) setLowBalanceThreshold(parseInt(threshold));
  }, []);

  const combinedDebtsTotals = useMemo(() => {
    let toReceive = 0;
    let toPay = 0;

    // Regular debts (Pending) - Use transactionsRaw
    const regularDebts = transactionsRaw.filter(t => t.type === 'debt' && t.debtStatus === 'pending');

    // Settled debts (History)
    const settledDebts = transactionsRaw.filter(t => t.type === 'debt' && t.debtStatus === 'settled');

    regularDebts.forEach(t => {
      // Calculate remaining amount for partial settlements
      const settledSoFar = (t as any).settledAmount || 0;
      const pendingAmount = Math.max(0, t.amount - settledSoFar);

      if (t.debtType === 'lent') {
        toReceive += pendingAmount;
      } else if (t.debtType === 'borrowed') {
        toPay += pendingAmount;
      }
    });

    // Trip settlements
    tripSettlements.forEach(s => {
      // debtType is already computed relative to currentUser in fetchTripSettlements
      if (s.debtType === 'lent') {
        toReceive += s.amount;
      } else if (s.debtType === 'borrowed') {
        toPay += s.amount;
      }
    });

    // Sort settled debts by date (newest first)
    settledDebts.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return { toReceive, toPay, allDebts: [...regularDebts, ...tripSettlements, ...settledDebts] };
  }, [transactionsRaw, tripSettlements]);

  // Refs
  const filterDropdownRef = useRef<HTMLDivElement>(null);

  // Modals
  const [showNotifications, setShowNotifications] = useState(false);
  const [showSmartPaste, setShowSmartPaste] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showAddGoal, setShowAddGoal] = useState(false);

  const [showTransferModal, setShowTransferModal] = useState(false);
  const [showUpdateGoal, setShowUpdateGoal] = useState(false);
  const [showEditGoal, setShowEditGoal] = useState(false);
  const [showScanReceipt, setShowScanReceipt] = useState(false);
  const [showBorrowModal, setShowBorrowModal] = useState(false);
  const [showSettlementConfirm, setShowSettlementConfirm] = useState(false);
  const [selectedSettlementTransaction, setSelectedSettlementTransaction] = useState<any>(null);

  // Notifications
  const [selectedGoal, setSelectedGoal] = useState<any>(null);
  const [transactionType, setTransactionType] = useState<'expense' | 'income'>('expense');
  const [profilePicture, setProfilePicture] = useState<string | null>(null);
  const [showBalanceBreakdown, setShowBalanceBreakdown] = useState(false);
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);
  const [showDebtModal, setShowDebtModal] = useState(false);
  const [hasVault, setHasVault] = useState(false);

  const [debtModalType, setDebtModalType] = useState<'lent' | 'borrowed'>('lent');
  const [showSettlements, setShowSettlements] = useState(false);
  // Trip settlements hook called at top, remove from here if it was duplicated later (it was in line 202)

  const [pendingRules, setPendingRules] = useState<RecurringRule[]>([]);


  useEffect(() => {
    if (!userProfile?.uid) return;

    const checkDailyDigest = () => {
      const savedRulesStr = localStorage.getItem('recurring_rules');
      if (!savedRulesStr) return;

      const rules: RecurringRule[] = JSON.parse(savedRulesStr);
      const today = new Date();
      const dayIndex = today.getDay(); // 0-6
      const todayStr = today.toISOString().split('T')[0];

      const dueRules = rules.filter(rule => {
        if (!rule.isActive) return false;
        if (rule.lastGeneratedDate === todayStr) return false;
        return rule.activeDays.includes(dayIndex);
      });

      if (dueRules.length > 0) {
        setPendingRules(dueRules);
        setShowDailyDigest(true);
      }
    };

    // Small delay to ensure app load
    const timer = setTimeout(checkDailyDigest, 1000);
    return () => clearTimeout(timer);
  }, [userProfile]);

  const handleDailyDigestConfirm = async (confirmedItems: { ruleId: string; amount: number; note: string }[]) => {
    if (!userProfile?.uid) return;

    const savedRulesStr = localStorage.getItem('recurring_rules');
    const rules: RecurringRule[] = savedRulesStr ? JSON.parse(savedRulesStr) : [];
    const todayStr = new Date().toISOString().split('T')[0];

    // 1. Create Transactions
    for (const item of confirmedItems) {
      const rule = rules.find(r => r.id === item.ruleId);
      if (rule) {
        const transaction = {
          id: `recurring_${Date.now()}_${rule.id}`,
          userId: userProfile.uid,
          type: 'expense' as const,
          amount: item.amount,
          category: rule.category,
          description: `${rule.title} ${item.note ? `- ${item.note}` : ''}`,
          paymentMethod: 'cash', // Default or could be improved
          date: new Date(),
          createdAt: new Date(),
          updatedAt: new Date()
        };
        await addTransaction(transaction);
      }
    }

    // 2. Update Rules (lastGeneratedDate)
    const updatedRules = rules.map(rule => {
      if (confirmedItems.some(i => i.ruleId === rule.id)) {
        return { ...rule, lastGeneratedDate: todayStr };
      }
      return rule;
    });

    localStorage.setItem('recurring_rules', JSON.stringify(updatedRules));

    setShowDailyDigest(false);
    window.location.reload(); // Refresh to show new transactions
  };







  const calculateStats = useCallback(() => {
    if (!transactions || transactions.length === 0) {
      setBalance(0);
      setWeekSpending(0);
      setMonthSpending(0);
      setIsLowBalance(false);
      return;
    }

    const stats = calculateFinanceStats(transactionsRaw, tripSettlements);
    setBalance(stats.balance);
    setWeekSpending(stats.spending.week);
    setMonthSpending(stats.spending.month);

    // Check for low balance
    setIsLowBalance(stats.balance < lowBalanceThreshold);
  }, [transactions, transactionsRaw, tripSettlements, lowBalanceThreshold]);

  // Calculate stats when transactions change
  useEffect(() => {
    if (!transactionsLoading) {
      calculateStats();
      setFilteredTransactions(transactions);
      setIsLoading(false);
    }
  }, [transactions, transactionsLoading, calculateStats]);

  // Set loading state based on all hooks
  useEffect(() => {
    setIsLoading(transactionsLoading || budgetsLoading || goalsLoading || tripSettlementsLoading);
  }, [transactionsLoading, budgetsLoading, goalsLoading, tripSettlementsLoading]);

  // Calculate Running Balances for UI — uses shared utility for consistency with TransactionsPage
  const runningBalanceMap = useMemo(() => {
    return computeRunningBalanceMap(transactionsRaw, tripSettlements);
  }, [transactionsRaw, tripSettlements]);

  // Load user preferences
  useEffect(() => {
    const name = userProfile?.name || localStorage.getItem('myxpense_user_name') || 'User';
    setUserName(name.split(' ')[0]);

    const savedProfilePicture = localStorage.getItem('profile_picture');
    setProfilePicture(savedProfilePicture);

    const isDarkMode = localStorage.getItem('theme') === 'dark';
    setIsDark(isDarkMode);
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    }
  }, [userProfile]);

  // NOTE: Duplicate useEffect blocks removed — the identical hooks at lines 304-315 already handle
  // calculateStats/setFilteredTransactions/setIsLoading. Having them twice caused redundant re-renders.

  // Load unread notifications count
  useEffect(() => {
    const loadUnreadCount = async () => {
      if (userProfile?.uid) {
        try {
          const unreadNotifs = await getUnreadNotifications(userProfile.uid);
          setUnreadNotificationCount(unreadNotifs.length);
        } catch (error) {
          console.error('Error loading unread notifications:', error);
        }
      }
    };

    loadUnreadCount();
    // Reload every 30 seconds
    const interval = setInterval(loadUnreadCount, 30000);
    return () => clearInterval(interval);
  }, [userProfile?.uid]);

  // Load vault data for Total Worth feature
  useEffect(() => {
    const loadVaultData = async () => {
      if (!userProfile?.uid) return;

      try {
        const vault = await getSecretVault(userProfile.uid);

        if (vault) {
          setHasVault(true);
        } else {
          setHasVault(false);
        }
      } catch (error) {
        console.error('Error loading vault data:', error);
        setHasVault(false);
      }
    };

    loadVaultData();
  }, [userProfile?.uid]);

  // Preload navigation pages for instant navigation
  useEffect(() => {
    const preloadPages = async () => {
      try {
        void import('./AnalyticsPage');
        void import('./BudgetsPage');
        void import('./GoalsPage');
      } catch (error) {
        console.error('Error preloading pages:', error);
      }
    };

    if (!isLoading) {
      const timer = setTimeout(preloadPages, 1000);
      return () => clearTimeout(timer);
    }
  }, [isLoading]);

  const handleNotificationChange = async () => {
    if (userProfile?.uid) {
      const unreadNotifs = await getUnreadNotifications(userProfile.uid);
      setUnreadNotificationCount(unreadNotifs.length);
    }
  };

  const handlePullToRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await new Promise(resolve => setTimeout(resolve, 1000));
    calculateStats();
    setIsRefreshing(false);
  }, [calculateStats]);

  const pullHandlers = useSwipeable({
    onSwipedDown: () => {
      if (window.scrollY === 0 && !isRefreshing) {
        handlePullToRefresh();
      }
    },
    trackMouse: false
  });

  // Handle click outside filter dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (filterDropdownRef.current && !filterDropdownRef.current.contains(event.target as Node)) {
        setShowExpenseFilter(false);
      }
    };

    if (showExpenseFilter) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showExpenseFilter]);

  const toggleTheme = () => {
    const newDarkMode = !isDark;
    setIsDark(newDarkMode);

    if (newDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  const formatAmount = (amount: number, hideIfNeeded = true) => {
    if (!isBalanceVisible && hideIfNeeded) {
      return '••••••';
    }
    // Handle negative amounts with proper formatting
    if (amount < 0) {
      return `-₹${Math.abs(amount).toLocaleString()}`;
    }
    return `₹${amount.toLocaleString()}`;
  };

  const getFilteredExpenses = () => {
    const now = new Date();
    let filteredExpenses = transactions.filter(t => t.type === 'expense');

    switch (expenseFilterPeriod) {
      case 'Year':
        const yearAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
        filteredExpenses = filteredExpenses.filter(t => new Date(t.date) >= yearAgo);
        break;
      case 'Six Months':
        const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 6, now.getDate());
        filteredExpenses = filteredExpenses.filter(t => new Date(t.date) >= sixMonthsAgo);
        break;
      case 'Last Month':
        const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
        filteredExpenses = filteredExpenses.filter(t => new Date(t.date) >= lastMonth);
        break;
      case 'Lifetime':
      default:
        // Show all expenses
        break;
    }

    return filteredExpenses.reduce((sum, t) => sum + t.amount, 0);
  };

  const handleFilterTransactions = (filter: string) => {
    setActiveFilter(filter);
    let filtered = [...transactions];

    // Base filter logic
    if (filter === 'Lent') {
      filtered = filtered.filter(t => t.type === 'debt' && t.debtType === 'lent');
    } else if (filter === 'Borrowed') {
      filtered = filtered.filter(t => t.type === 'debt' && t.debtType === 'borrowed');
    } else if (filter === 'All') {
      // Show everything
    } else {
      // For specific non-debt filters (Income, Expenses), we filter by type
      // For date filters (Today, etc), we currently include everything matching the date

      if (filter === 'Income') {
        filtered = filtered.filter(t => t.type === 'income');
      } else if (filter === 'Expenses') {
        filtered = filtered.filter(t => t.type === 'expense');
      } else if (filter === 'Today') {
        const today = new Date().toDateString();
        filtered = filtered.filter(t => new Date(t.date).toDateString() === today);
      } else if (filter === 'This Week') {
        const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        filtered = filtered.filter(t => new Date(t.date) >= weekAgo);
      } else if (filter === '30 Days') {
        const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        filtered = filtered.filter(t => new Date(t.date) >= monthAgo);
      }
    }

    if (searchQuery) {
      filtered = filtered.filter(t =>
        t.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.category?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.paymentMethod?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Sort by date: newest first, with secondary sort on createdAt if available
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

    setFilteredTransactions(filtered);
  };

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    let filtered = [...transactions];

    // Exclude 'debt' type from general transaction filters unless specifically handled
    filtered = filtered.filter(t => t.type !== 'debt');

    if (activeFilter === 'Income') {
      filtered = filtered.filter(t => t.type === 'income');
    } else if (activeFilter === 'Expenses') {
      filtered = filtered.filter(t => t.type === 'expense');
    } else if (activeFilter === 'Today') {
      const today = new Date().toDateString();
      filtered = filtered.filter(t => new Date(t.date).toDateString() === today);
    } else if (activeFilter === 'This Week') {
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      filtered = filtered.filter(t => new Date(t.date) >= weekAgo);
    } else if (activeFilter === '30 Days') {
      const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      filtered = filtered.filter(t => new Date(t.date) >= monthAgo);
    }

    if (query) {
      filtered = filtered.filter(t =>
        t.description?.toLowerCase().includes(query.toLowerCase()) ||
        t.category?.toLowerCase().includes(query.toLowerCase()) ||
        t.paymentMethod?.toLowerCase().includes(query.toLowerCase())
      );
    }

    setFilteredTransactions(filtered);
  };

  const handleDeleteTransaction = async (id: string) => {
    try {
      await removeTransaction(id);
      setSwipedTransaction(null);
    } catch (error) {
      console.error('Error deleting transaction:', error);
    }
  };

  const handleQuickAddAction = (action: 'expense' | 'income' | 'borrow' | 'scan' | 'plan' | 'goal') => {
    if (action === 'expense') {
      setTransactionType('expense');
      setShowAddTransaction(true);
    } else if (action === 'income') {
      setTransactionType('income');
      setShowAddTransaction(true);
    } else if (action === 'borrow') {
      setShowBorrowModal(true);
    } else if (action === 'scan') {
      setShowScanReceipt(true);
    } else if (action === 'plan') {
      navigate('/trips');
    } else if (action === 'goal') {
      setShowAddGoal(true);
    }
  };

  const handleUpdateGoal = (goal: any) => {
    setSelectedGoal(goal);
    setShowUpdateGoal(true);
  };

  const handleEditGoal = (goal: any) => {
    setSelectedGoal(goal);
    // ... rest of handleEditGoal logic if any
  };

  const handleSmartParseSave = async (parsedTransactions: any[]) => {
    try {
      for (const t of parsedTransactions) {
        await addTransaction({
          ...t,
          userId: userProfile?.uid,
          createdAt: new Date(),
          updatedAt: new Date(),
          // Ensure ID is unique or let db generate
          id: generateUUID()
        });
      }
      refreshTransactions();
    } catch (error) {
      console.error("Error saving parsed transactions:", error);
    }
  };




  return (
    <>
      <PageTransition>
        <div {...pullHandlers} className="bg-gray-50 dark:bg-gray-900 min-h-screen transition-colors duration-300 relative pb-20">
          {/* Pull to Refresh Indicator */}
          <AnimatePresence>
            {isRefreshing && (
              <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="fixed top-16 left-1/2 -translate-x-1/2 z-50 bg-blue-500 text-white px-4 py-2 rounded-full shadow-lg"
              >
                Refreshing...
              </motion.div>
            )}
          </AnimatePresence>

          {/* Navigation */}
          <nav className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-40 transition-colors duration-300">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-r from-blue-500 to-blue-600 rounded-xl flex items-center justify-center">
                    <Wallet className="w-6 h-6 sm:w-7 sm:h-7 text-white" />
                  </div>
                  <div>
                    <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">MyXpense</h1>
                    <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">{getGreeting()}, {userName}!</p>
                  </div>
                </div>
                <div className="flex items-center space-x-2 sm:space-x-3">
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={toggleTheme}
                    className="p-2 sm:p-2.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  >
                    {isDark ? <Sun className="w-5 h-5 sm:w-6 sm:h-6 text-gray-300" /> : <Moon className="w-5 h-5 sm:w-6 sm:h-6 text-gray-600" />}
                  </motion.button>
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setShowNotifications(true)}
                    className="relative p-2 sm:p-2.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  >
                    <Bell className="w-5 h-5 sm:w-6 sm:h-6 text-gray-600 dark:text-gray-300" />
                    {unreadNotificationCount > 0 && (
                      <>
                        <motion.span
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center text-[10px] font-bold text-white shadow-lg z-10"
                        >
                          {unreadNotificationCount > 9 ? '9+' : unreadNotificationCount}
                        </motion.span>
                        <motion.span
                          animate={{ scale: [1, 1.3, 1], opacity: [0.7, 0, 0.7] }}
                          transition={{ duration: 2, repeat: Infinity }}
                          className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full"
                        />
                      </>
                    )}
                  </motion.button>
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setShowProfile(true)}
                    className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center overflow-hidden border-2 border-white dark:border-gray-700 shadow-md"
                  >
                    {profilePicture ? (
                      <img src={profilePicture} alt="Profile" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-white text-sm sm:text-base font-medium">{userName.charAt(0).toUpperCase()}</span>
                    )}
                  </motion.button>
                </div>
              </div>
            </div>
          </nav>

          {/* Main Content */}
          <div className="max-w-7xl mx-auto pb-36">
            {isLoading ? (
              <div className="p-4 space-y-4">
                <DashboardCardSkeleton />
                <div className="grid grid-cols-2 gap-3">
                  <DashboardCardSkeleton />
                  <DashboardCardSkeleton />
                </div>
              </div>
            ) : (
              <>
                {/* Balance Overview */}
                <motion.div
                  variants={containerVariants}
                  initial="hidden"
                  animate="show"
                  className="px-4 sm:px-6 lg:px-8 py-4 space-y-3 sm:space-y-4"
                >
                  <motion.div
                    variants={itemVariants}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setShowBalanceBreakdown(true)}
                    className={`rounded-2xl p-4 text-white transition-all duration-300 shadow-lg cursor-pointer ${isLowBalance
                      ? 'bg-gradient-to-br from-red-500 via-red-600 to-orange-600'
                      : 'bg-gradient-to-br from-blue-500 via-blue-600 to-indigo-600'
                      }`}
                  >
                    {isLowBalance && (
                      <div className="flex items-center gap-2 mb-3 bg-white/20 rounded-lg p-2">
                        <AlertTriangle className="w-4 h-4" />
                        <p className="text-xs font-medium">Low Balance Alert!</p>
                      </div>
                    )}
                    <div className="flex items-center justify-between mb-3 sm:mb-4">
                      <h2 className="text-base sm:text-lg font-medium opacity-90">Total Balance</h2>
                      <div className="flex items-center space-x-2">
                        <div className="relative" ref={filterDropdownRef}>
                          <motion.button
                            whileTap={{ scale: 0.95 }}
                            onClick={(e) => {
                              e.stopPropagation();
                              setShowExpenseFilter(!showExpenseFilter);
                            }}
                            className={`p-1.5 rounded-lg transition-all ${showExpenseFilter
                              ? 'bg-white/30 shadow-lg'
                              : 'hover:bg-white/20'
                              }`}
                          >
                            <Filter className="w-4 h-4 sm:w-5 sm:h-5" />
                          </motion.button>
                          <AnimatePresence>
                            {showExpenseFilter && (
                              <motion.div
                                initial={{ opacity: 0, y: -10, scale: 0.95 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                exit={{ opacity: 0, y: -10, scale: 0.95 }}
                                transition={{ duration: 0.15 }}
                                onClick={(e) => e.stopPropagation()}
                                className="absolute right-0 top-full mt-3 bg-white dark:bg-gray-800 rounded-xl shadow-2xl border-2 border-gray-200 dark:border-gray-600 overflow-hidden w-44 z-50"
                              >
                                <div className="bg-gradient-to-r from-blue-500 to-indigo-600 px-3 py-2">
                                  <p className="text-xs font-semibold text-white">Filter Period</p>
                                </div>
                                <div className="py-1">
                                  {['Lifetime', 'Year', 'Six Months', 'Last Month'].map((period) => (
                                    <motion.button
                                      key={period}
                                      whileHover={{ x: 4 }}
                                      whileTap={{ scale: 0.98 }}
                                      onClick={() => {
                                        setExpenseFilterPeriod(period);
                                        setShowExpenseFilter(false);
                                      }}
                                      className={`w-full text-left px-4 py-2.5 text-sm transition-all flex items-center justify-between ${expenseFilterPeriod === period
                                        ? 'bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/30 dark:to-indigo-900/30 text-blue-600 dark:text-blue-400 font-semibold border-l-4 border-blue-500'
                                        : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                                        }`}
                                    >
                                      <span>{period}</span>
                                      {expenseFilterPeriod === period && (
                                        <motion.div
                                          initial={{ scale: 0 }}
                                          animate={{ scale: 1 }}
                                          className="w-2 h-2 rounded-full bg-blue-500"
                                        />
                                      )}
                                    </motion.button>
                                  ))}
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                        <motion.button
                          whileTap={{ scale: 0.95 }}
                          onClick={(e) => {
                            e.stopPropagation(); // Prevent card click from opening popup
                            if (isBalanceVisible) {
                              // Hiding - just hide without popup
                              setIsBalanceVisible(false);
                              sessionStorage.setItem('myxpense_balance_visible', 'false');
                            } else {
                              // Showing - just show balance, do NOT open popup
                              setIsBalanceVisible(true);
                              sessionStorage.setItem('myxpense_balance_visible', 'true');
                            }
                          }}
                          className="p-1 rounded hover:bg-white/20 transition-colors"
                        >
                          {isBalanceVisible ? <Eye className="w-4 h-4 sm:w-5 sm:h-5" /> : <EyeOff className="w-4 h-4 sm:w-5 sm:h-5" />}
                        </motion.button>
                      </div>
                    </div>
                    <motion.div
                      key={balance}
                      initial={{ scale: 0.9, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ duration: 0.3 }}
                      className={`text-3xl sm:text-4xl font-bold mb-2 ${balance < 0 ? 'text-red-300' : ''}`}
                    >
                      {formatAmount(balance)}
                    </motion.div>
                    <div className="grid grid-cols-1 gap-2">
                      <div className="bg-white/20 rounded-xl p-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            <TrendingDown className="w-4 h-4" />
                            <span className="text-xs opacity-90">Total Expenses ({expenseFilterPeriod})</span>
                          </div>
                          <div className="text-base font-bold">{formatAmount(getFilteredExpenses())}</div>
                        </div>
                      </div>
                    </div>
                  </motion.div>

                  {/* Secret Vault Card - Compact Pill */}
                  {hasVault && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.05 }}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => navigate('/vault')}
                      className="bg-gradient-to-r from-amber-400 to-amber-600 rounded-xl p-3 text-white shadow-md cursor-pointer flex items-center justify-between"
                    >
                      <div className="flex items-center gap-3">
                        <div className="p-1.5 bg-white/20 rounded-lg">
                          <Lock className="w-4 h-4 text-white" />
                        </div>
                        <span className="text-sm font-semibold text-white">Secret Vault</span>
                      </div>
                      <ChevronRight className="w-4 h-4 text-white/80" />
                    </motion.div>
                  )}

                  {/* Weekly & Monthly Stats */}
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="grid grid-cols-2 gap-3"
                  >
                    <div className="bg-white dark:bg-gray-800 rounded-xl p-3 shadow-md border border-gray-100 dark:border-gray-700">
                      <div className="flex items-center space-x-2 mb-1">
                        <div className="w-7 h-7 bg-blue-50 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
                          <Calendar className="w-3.5 h-3.5 text-blue-500" />
                        </div>
                        <span className="text-xs text-gray-600 dark:text-gray-400 font-medium">This Week</span>
                      </div>
                      <div className="text-sm font-bold text-gray-900 dark:text-white">{formatAmount(weekSpending, false)}</div>
                    </div>
                    <div className="bg-white dark:bg-gray-800 rounded-xl p-3 shadow-md border border-gray-100 dark:border-gray-700">
                      <div className="flex items-center space-x-2 mb-1">
                        <div className="w-7 h-7 bg-purple-50 dark:bg-purple-900/30 rounded-lg flex items-center justify-center">
                          <CalendarDays className="w-3.5 h-3.5 text-purple-500" />
                        </div>
                        <span className="text-xs text-gray-600 dark:text-gray-400 font-medium">Last 30 Days</span>
                      </div>
                      <div className="text-sm font-bold text-gray-900 dark:text-white">{formatAmount(monthSpending, false)}</div>
                    </div>
                  </motion.div>
                </motion.div>

                {/* Quick Actions - 5 Item Grid */}
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.15 }}
                  className="px-4 mb-3"
                >
                  <div className="grid grid-cols-4 gap-2">
                    {/* Expense */}
                    <motion.button
                      whileHover={{ scale: 1.05, y: -2 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => handleQuickAddAction('expense')}
                      className="aspect-square flex flex-col items-center justify-center p-1 bg-white dark:bg-gray-800 rounded-xl shadow-md border border-gray-100 dark:border-gray-700 transition-all hover:shadow-lg"
                    >
                      <div className="w-8 h-8 md:w-10 md:h-10 bg-gradient-to-br from-red-400 to-red-600 rounded-xl flex items-center justify-center mb-1 shadow-sm">
                        <Minus className="w-4 h-4 md:w-5 md:h-5 text-white" />
                      </div>
                      <span className="text-[10px] md:text-xs font-semibold text-gray-900 dark:text-white truncate w-full text-center">Expense</span>
                    </motion.button>

                    {/* Income */}
                    <motion.button
                      whileHover={{ scale: 1.05, y: -2 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => handleQuickAddAction('income')}
                      className="aspect-square flex flex-col items-center justify-center p-1 bg-white dark:bg-gray-800 rounded-xl shadow-md border border-gray-100 dark:border-gray-700 transition-all hover:shadow-lg"
                    >
                      <div className="w-8 h-8 md:w-10 md:h-10 bg-gradient-to-br from-green-400 to-green-600 rounded-xl flex items-center justify-center mb-1 shadow-sm">
                        <Plus className="w-4 h-4 md:w-5 md:h-5 text-white" />
                      </div>
                      <span className="text-[10px] md:text-xs font-semibold text-gray-900 dark:text-white truncate w-full text-center">Income</span>
                    </motion.button>

                    {/* Borrow */}
                    <motion.button
                      whileHover={{ scale: 1.05, y: -2 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => handleQuickAddAction('borrow')}
                      className="aspect-square flex flex-col items-center justify-center p-1 bg-white dark:bg-gray-800 rounded-xl shadow-md border border-gray-100 dark:border-gray-700 transition-all hover:shadow-lg relative"
                    >
                      <div className="w-8 h-8 md:w-10 md:h-10 bg-gradient-to-br from-amber-400 to-amber-600 rounded-xl flex items-center justify-center mb-1 shadow-sm">
                        <HandCoins className="w-4 h-4 md:w-5 md:h-5 text-white" />
                      </div>
                      <span className="text-[10px] md:text-xs font-semibold text-gray-900 dark:text-white truncate w-full text-center">Borrow</span>
                    </motion.button>

                    {/* Scan */}
                    <motion.button
                      whileHover={{ scale: 1.05, y: -2 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => handleQuickAddAction('scan')}
                      className="aspect-square flex flex-col items-center justify-center p-1 bg-white dark:bg-gray-800 rounded-xl shadow-md border border-gray-100 dark:border-gray-700 transition-all hover:shadow-lg"
                    >
                      <div className="w-8 h-8 md:w-10 md:h-10 bg-gradient-to-br from-purple-400 to-purple-600 rounded-xl flex items-center justify-center mb-1 shadow-sm">
                        <Scan className="w-4 h-4 md:w-5 md:h-5 text-white" />
                      </div>
                      <span className="text-[10px] md:text-xs font-semibold text-gray-900 dark:text-white truncate w-full text-center">Scan</span>
                    </motion.button>
                  </div>
                </motion.div>



                {/* Smart Parser Inline Card */}
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="px-4 mb-6"
                >
                  <SmartParserCard onSave={handleSmartParseSave} />
                </motion.div>




                {/* Low Balance Banner */}
                <LowBalanceBanner balance={balance} threshold={lowBalanceThreshold} />

                {/* Settlements & AI Insights Header Row */}
                <div className="px-4 sm:px-6 lg:px-8 mb-3 flex items-center justify-between">
                  <button
                    onClick={() => setShowSettlements(!showSettlements)}
                    className="flex items-center gap-2 text-gray-900 dark:text-white font-semibold group"
                  >
                    <div className={`p-1 rounded-full transition-colors ${showSettlements ? 'bg-gray-100 dark:bg-gray-800' : 'group-hover:bg-gray-50 dark:group-hover:bg-gray-800/50'}`}>
                      {showSettlements ? <ChevronRight className="w-4 h-4 rotate-90 transition-transform" /> : <ChevronRight className="w-4 h-4 transition-transform" />}
                    </div>
                    <span>Settlements</span>

                    {/* Compact Debt Badges (Visible when collapsed) */}
                    {!showSettlements && (combinedDebtsTotals.toPay > 0 || combinedDebtsTotals.toReceive > 0) && (
                      <div className="flex items-center gap-2 text-xs font-medium ml-2">
                        {combinedDebtsTotals.toReceive > 0 && (
                          <span className="text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 px-2 py-0.5 rounded-full flex items-center">
                            +{formatAmount(combinedDebtsTotals.toReceive)}
                          </span>
                        )}
                        {combinedDebtsTotals.toPay > 0 && (
                          <span className="text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-900/20 px-2 py-0.5 rounded-full flex items-center">
                            -{formatAmount(combinedDebtsTotals.toPay)}
                          </span>
                        )}
                      </div>
                    )}
                  </button>

                  <div className="flex items-center gap-2">
                    {/* AI Insight - Compact Mode Inline */}
                    <div className="scale-90 origin-right">
                      <AIInsightsCard
                        compact={true}
                        transactions={transactions}
                        budgets={budgets}
                        goals={goals}
                      />
                    </div>

                  </div>
                </div>



                {/* Settlements Content */}
                <div className="px-4 sm:px-6 lg:px-8 mb-6">
                  <AnimatePresence>
                    {showSettlements && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="grid grid-cols-2 gap-3 overflow-hidden"
                      >
                        <motion.div
                          whileTap={{ scale: 0.98 }}
                          onClick={() => {
                            setDebtModalType('lent');
                            setShowDebtModal(true);
                          }}
                          className="bg-emerald-50 dark:bg-emerald-900/20 p-4 rounded-2xl border border-emerald-100 dark:border-emerald-800/30 shadow-sm cursor-pointer"
                        >
                          <div className="flex items-center gap-2 mb-2">
                            <div className="p-1.5 bg-emerald-100 dark:bg-emerald-800/40 rounded-lg">
                              <TrendingUp className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                            </div>
                            <span className="text-xs font-semibold text-emerald-800 dark:text-emerald-300">To Receive</span>
                          </div>
                          <p className="text-xl font-bold text-emerald-700 dark:text-emerald-400">{formatAmount(combinedDebtsTotals.toReceive, false)}</p>
                          <p className="text-[10px] text-emerald-600/80 dark:text-emerald-400/60 mt-1">Tap for breakdown</p>
                        </motion.div>

                        <motion.div
                          whileTap={{ scale: 0.98 }}
                          onClick={() => {
                            setDebtModalType('borrowed');
                            setShowDebtModal(true);
                          }}
                          className="bg-rose-50 dark:bg-rose-900/20 p-4 rounded-2xl border border-rose-100 dark:border-rose-800/30 shadow-sm cursor-pointer"
                        >
                          <div className="flex items-center gap-2 mb-2">
                            <div className="p-1.5 bg-rose-100 dark:bg-rose-800/40 rounded-lg">
                              <TrendingDown className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                            </div>
                            <span className="text-xs font-semibold text-rose-800 dark:text-rose-300">To Pay</span>
                          </div>
                          <p className="text-xl font-bold text-rose-700 dark:text-rose-400">{formatAmount(combinedDebtsTotals.toPay, false)}</p>
                          <p className="text-[10px] text-rose-600/80 dark:text-rose-400/60 mt-1">Tap for breakdown</p>
                        </motion.div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Recent Goals - Beautiful Visual Cards */}
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="px-4 mb-3"
                >
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Recent Goals</h3>
                    <button onClick={() => navigate('/goals')} className="text-blue-500 text-sm font-semibold hover:text-blue-600 transition-colors">View All</button>
                  </div>
                  {isLoading ? (
                    <GoalSkeleton />
                  ) : goals.length > 0 ? (
                    <div className="space-y-3">
                      {goals.slice(0, 3).map((goal, index) => {
                        const percentage = Math.min(Math.round(((goal.currentAmount || 0) / goal.targetAmount) * 100), 100);
                        const colors = [
                          { gradient: 'from-purple-500 via-purple-600 to-indigo-600', light: 'bg-purple-500', progressBg: 'bg-purple-200' },
                          { gradient: 'from-blue-500 via-blue-600 to-cyan-600', light: 'bg-blue-500', progressBg: 'bg-blue-200' },
                          { gradient: 'from-teal-500 via-teal-600 to-emerald-600', light: 'bg-teal-500', progressBg: 'bg-teal-200' },
                        ];
                        const color = colors[index % colors.length];

                        return (
                          <motion.div
                            key={goal.id}
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: index * 0.1 }}
                            whileHover={{ scale: 1.01 }}
                            className={`bg-gradient-to-r ${color.gradient} rounded-xl p-3 text-white shadow-md relative overflow-hidden`}
                          >
                            {/* Subtle background decoration */}
                            <div className="absolute top-0 right-0 w-20 h-20 bg-white/5 rounded-full -mr-10 -mt-10"></div>

                            <div className="relative z-10 flex items-center justify-between gap-2">
                              {/* Left: Goal Info */}
                              <div className="flex-1 min-w-0">
                                <h4 className="font-semibold text-sm mb-0.5 truncate">{goal.name}</h4>
                                <div className="flex items-center gap-2 mb-1.5">
                                  <p className="text-[11px] opacity-90">
                                    ₹{(goal.currentAmount || 0).toLocaleString()} / ₹{goal.targetAmount.toLocaleString()}
                                  </p>
                                  <span className="text-[10px] font-semibold bg-white/20 px-1.5 py-0.5 rounded-full">
                                    {percentage}%
                                  </span>
                                </div>
                                {/* Compact Progress Bar */}
                                <div className="w-full h-1.5 bg-white/30 rounded-full overflow-hidden">
                                  <motion.div
                                    initial={{ width: 0 }}
                                    animate={{ width: `${percentage}%` }}
                                    transition={{ duration: 0.8, ease: "easeOut", delay: index * 0.1 }}
                                    className="h-full bg-white rounded-full"
                                  />
                                </div>
                              </div>

                              {/* Right: Action Buttons */}
                              <div className="flex gap-1.5 shrink-0">
                                <motion.button
                                  whileTap={{ scale: 0.9 }}
                                  whileHover={{ scale: 1.05 }}
                                  onClick={() => handleEditGoal(goal)}
                                  className="w-8 h-8 bg-white/20 backdrop-blur-sm rounded-lg flex items-center justify-center hover:bg-white/30 transition-all"
                                >
                                  <Edit className="w-3.5 h-3.5" />
                                </motion.button>
                                <motion.button
                                  whileTap={{ scale: 0.9 }}
                                  whileHover={{ scale: 1.05 }}
                                  onClick={() => handleUpdateGoal(goal)}
                                  className="w-8 h-8 bg-white/20 backdrop-blur-sm rounded-lg flex items-center justify-center hover:bg-white/30 transition-all"
                                >
                                  <Plus className="w-4 h-4" />
                                </motion.button>
                              </div>
                            </div>
                          </motion.div>
                        );
                      })}
                    </div>
                  ) : (
                    <motion.div
                      whileTap={{ scale: 0.98 }}
                      onClick={() => setShowAddGoal(true)}
                      className="bg-gradient-to-r from-purple-500 to-indigo-600 rounded-2xl p-6 text-white cursor-pointer hover:from-purple-600 hover:to-indigo-700 transition-all shadow-lg"
                    >
                      <div className="flex items-center justify-center text-center gap-3">
                        <Plus className="w-6 h-6" />
                        <span className="text-base font-semibold">Add Your First Goal</span>
                      </div>
                    </motion.div>
                  )}
                </motion.div>

                {/* Recent Transactions - Compact */}
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.25 }}
                  className="px-4 mb-3"
                >
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Recent Transactions</h3>
                    <button onClick={() => navigate('/transactions')} className="text-blue-500 text-xs font-medium">View All</button>
                  </div>

                  {/* Search Bar */}
                  <div className="mb-2">
                    <SearchBar onSearch={handleSearch} />
                  </div>

                  {/* Transaction Filters */}
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {['All', 'Income', 'Expenses', 'Lent', 'Borrowed', 'Today', 'This Week', '30 Days'].map((filter) => (
                      <motion.button
                        key={filter}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => handleFilterTransactions(filter)}
                        className={`px-2 py-0.5 rounded-lg text-[10px] font-medium transition-colors ${activeFilter === filter
                          ? 'bg-blue-500 text-white'
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
                          }`}
                      >
                        {filter}
                      </motion.button>
                    ))}
                  </div>

                  <div className="space-y-1.5">
                    {isLoading ? (
                      <>
                        <TransactionSkeleton />
                        <TransactionSkeleton />
                        <TransactionSkeleton />
                      </>
                    ) : filteredTransactions.length > 0 ? (
                      <AnimatePresence>
                        {filteredTransactions.slice(0, 4).map((transaction) => (
                          <TransactionCard
                            key={transaction.id}
                            transaction={transaction}
                            runningBalance={runningBalanceMap.get(transaction.id)}
                            isSelected={false}
                            selectionMode={false}
                            isSwiped={swipedTransaction === transaction.id}
                            onSwipe={(id) => setSwipedTransaction(id)}
                            onLongPressStart={() => { }}
                            onLongPressEnd={() => { }}
                            onToggleSelect={() => { }}
                            onDelete={handleDeleteTransaction}
                          />
                        ))}
                      </AnimatePresence>
                    ) : (
                      <div className="text-center py-6 text-gray-500 dark:text-gray-400 text-xs">
                        No transactions yet. Start by adding an expense or income!
                      </div>
                    )}
                  </div>
                </motion.div>

                {/* Monthly Overview Chart - Below Transactions */}
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="px-4 sm:px-6 lg:px-8 mb-6"
                >
                  <MonthlyOverviewCard transactions={transactions} />
                </motion.div>
              </>
            )}
          </div>

          {/* Modals */}

          <NotificationsModal
            isOpen={showNotifications}
            onClose={() => setShowNotifications(false)}
            onNotificationChange={handleNotificationChange}
          />
          {/* Daily Digest Modal */}


          <Suspense fallback={null}>
            <ProfileSettingsModal
              isOpen={showProfile}
              onClose={() => setShowProfile(false)}
              onProfileUpdate={handleNotificationChange}
              currentBalance={balance}
            />
          </Suspense>
          <AddTransactionModal
            isOpen={showAddTransaction}
            onClose={() => setShowAddTransaction(false)}
            type={transactionType}
            onTransactionAdded={refreshTransactions}
          />
          <AddGoalModal
            isOpen={showAddGoal}
            onClose={() => setShowAddGoal(false)}
            onGoalAdded={refreshGoals}
          />
          <UpdateGoalModal
            isOpen={showUpdateGoal}
            onClose={() => setShowUpdateGoal(false)}
            goal={selectedGoal}
            onUpdate={refreshGoals}
          />
          <EditGoalModal
            isOpen={showEditGoal}
            onClose={() => setShowEditGoal(false)}
            goal={selectedGoal}
            onUpdate={refreshGoals}
          />
          <ScanReceiptModal
            isOpen={showScanReceipt}
            onClose={() => setShowScanReceipt(false)}
            onTransactionExtracted={refreshTransactions}
          />
          <TransferFundsModal
            isOpen={showTransferModal}
            onClose={() => setShowTransferModal(false)}
            onTransferComplete={refreshTransactions}
          />
          <BorrowMoneyModal
            isOpen={showBorrowModal}
            onClose={() => {
              setShowBorrowModal(false);
              refreshTransactions();
            }}
          />

          <DebtBreakdownModal
            isOpen={showDebtModal}
            onClose={() => setShowDebtModal(false)}
            title={debtModalType === 'lent' ? 'Money You Lent' : 'Money You Borrowed'}
            type={debtModalType}
            transactions={combinedDebtsTotals.allDebts.filter(t => t.debtType === debtModalType)}
            onSettle={(transaction) => {
              setSelectedSettlementTransaction(transaction);
              setShowSettlementConfirm(true);
              setShowDebtModal(false);
            }}
            onCardClick={(transaction) => {
              // Navigate to trip when clicking the card
              if (transaction.tripId) {
                navigate(`/trips/${transaction.tripId}`);
              }
            }}
          />

          <SettlementConfirmationModal
            isOpen={showSettlementConfirm}
            onClose={() => setShowSettlementConfirm(false)}
            transaction={selectedSettlementTransaction}
            onConfirm={async (data) => {
              const t = selectedSettlementTransaction;
              if (!t) return;

              try {
                // Determine transactions to create based on split
                const payments = [];
                if (data.paymentMethod === 'hybrid' && data.split) {
                  if (data.split.cash > 0) payments.push({ amount: data.split.cash, method: 'cash' });
                  if (data.split.online > 0) payments.push({ amount: data.split.online, method: 'UPI' });
                } else {
                  payments.push({ amount: data.amount, method: data.paymentMethod === 'online' ? 'UPI' : 'cash' });
                }

                if (t.isTripSettlement) {
                  // TRIP SETTLEMENT
                  // Only record in trip expenses - NO separate transaction history entry
                  // to avoid double-counting. useTripSettlements will recalculate balances
                  // based on the updated trip expenses.
                  for (const payment of payments) {
                    const transfer = {
                      id: `settlement_${Date.now()}_${Math.random()}`,
                      tripId: t.tripId,
                      userId: userProfile?.uid || '',
                      type: 'transfer' as const,
                      title: `Settlement: ${t.borrowerName} → ${t.lenderName} (${payment.method})`,
                      amount: payment.amount,
                      category: 'settlement',
                      icon: '💸',
                      date: new Date(),
                      from: t.debtType === 'lent' ? t.borrowerId : userProfile?.uid,
                      transferredTo: t.debtType === 'lent' ? userProfile?.uid : t.lenderId,
                      split: [] as any[],
                      createdAt: new Date(),
                      updatedAt: new Date(),
                      paymentMethod: payment.method // Record method in trip expense
                    };
                    await hybridDataService.saveTripExpense(transfer);
                    // NOTE: Removed duplicate addTransaction() call that was causing
                    // settlements to be counted twice in the balance calculation
                  }
                  // Optimistic Update: Remove from UI immediately
                  setTripSettlements(prev => prev.filter(item => item.id !== t.id));
                  refreshTrips(); // Trigger background sync
                } else {
                  // REGULAR DEBT SETTLEMENT
                  const isFullSettlement = Math.abs(data.amount - t.amount) < 0.1;

                  // 1. Update the debt transaction
                  if (isFullSettlement) {
                    await updateTransaction(t.id, {
                      debtStatus: 'settled',
                      settledAmount: t.amount, // Track full settlement
                      updatedAt: new Date()
                    });
                  } else {
                    // Partial: Keep original amount, track settled amount
                    // This preserves history: "Lent ₹800" stays as ₹800
                    const previousSettled = t.settledAmount || 0;
                    await updateTransaction(t.id, {
                      settledAmount: previousSettled + data.amount, // Accumulate settlements
                      updatedAt: new Date()
                    });
                  }

                  // 2. Create Payment/Income Transactions
                  for (const payment of payments) {
                    const isLent = t.debtType === 'lent';
                    const settlementTransaction = {
                      id: generateUUID(),
                      userId: userProfile?.uid || '',
                      type: 'debt' as const,
                      debtType: isLent ? 'settlement_in' as const : 'settlement_out' as const,
                      debtStatus: 'settled' as const,
                      amount: payment.amount,
                      category: t.debtType === 'lent' ? 'Debt Received' : 'Debt Paid',
                      paymentMethod: payment.method,
                      date: new Date().toISOString(),
                      borrowerName: t.borrowerName,
                      lenderName: t.lenderName,
                      description: `Settlement: ${t.debtType === 'lent' ? t.borrowerName + ' returned' : 'Paid to ' + t.lenderName} (${payment.method})`,
                      createdAt: new Date(),
                      updatedAt: new Date()
                    };

                    // Optimistic Update: Update UI instantly by updating filteredTransactions
                    const newSettlementTx = settlementTransaction;
                    setFilteredTransactions(prev => {
                      // Update original debt status
                      const updated = prev.map(pt =>
                        pt.id === t.id
                          ? { ...pt, debtStatus: 'settled', updatedAt: new Date() }
                          : pt
                      );
                      // Add new settlement transaction(s)
                      return [newSettlementTx, ...updated];
                    });
                  }
                }

                setShowSettlementConfirm(false);
                refreshTransactions(); // Async fetch to ensure consistency

              } catch (error) {
                console.error('Failed to settle:', error);
              }
            }}
          />

          <SmartPasteModal
            isOpen={showSmartPaste}
            onClose={() => setShowSmartPaste(false)}
            onSave={async (parsedItems) => {
              try {
                for (const item of parsedItems) {
                  if (item.type === 'debt' && item.debtType) {
                    // Handle Debt
                    const isLent = item.debtType === 'lent';
                    await addTransaction({
                      id: `debt_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
                      userId: userProfile?.uid || '',
                      type: 'debt',
                      debtType: item.debtType,
                      amount: item.amount,
                      category: isLent ? 'Money Lent' : 'Money Borrowed',
                      description: item.description || (isLent ? `Lent to ${item.entity}` : `Borrowed from ${item.entity}`),
                      date: item.date,
                      paymentMethod: 'Other', // Unknown source usually
                      debtStatus: 'pending',
                      borrowerName: isLent ? item.entity : 'Me',
                      lenderName: isLent ? 'Me' : item.entity,
                      createdAt: new Date(),
                      updatedAt: new Date()
                    });
                  } else {
                    // Handle Income or Expense
                    await addTransaction({
                      id: `sms_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
                      userId: userProfile?.uid || '',
                      type: item.type === 'income' ? 'income' : 'expense',
                      amount: item.amount,
                      category: item.category || (item.type === 'income' ? 'Salary' : 'General'),
                      description: item.description || (item.type === 'income' ? `Received from ${item.entity}` : `Paid to ${item.entity}`),
                      date: item.date,
                      paymentMethod: item.paymentMethod || 'Cash', // Use detected method
                      createdAt: new Date(),
                      updatedAt: new Date()
                    });
                  }
                }
                refreshTransactions(); // Refresh UI
              } catch (e) {
                console.error("Failed to save parsed items", e);
              }
            }}
          />

          {/* Balance Breakdown Modal */}
          <AnimatePresence>
            {showBalanceBreakdown && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center z-[100] sm:p-4 font-sans"
                onClick={() => setShowBalanceBreakdown(false)}
              >
                <motion.div
                  initial={{ y: '100%' }}
                  animate={{ y: 0 }}
                  exit={{ y: '100%', transition: { type: 'tween', duration: 0.2, ease: 'easeIn' } }}
                  transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                  onClick={e => e.stopPropagation()}
                  className="bg-white dark:bg-gray-900 w-full max-w-md rounded-t-3xl sm:rounded-3xl overflow-hidden shadow-2xl h-[60vh] sm:h-auto flex flex-col"
                >
                  {/* Header */}
                  <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-6 text-white shrink-0">
                    <div className="flex justify-between items-start mb-1">
                      <div>
                        <h2 className="text-xl font-bold">Balance Breakdown</h2>
                        <p className="text-blue-100 text-xs mt-0.5">By Payment Method</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            setShowTransferModal(true);
                            setShowBalanceBreakdown(false);
                          }}
                          className="p-1.5 bg-white/20 hover:bg-white/30 rounded-full transition-colors flex items-center justify-center"
                          title="Transfer Funds"
                        >
                          <ArrowRightLeft className="w-4 h-4 text-white" />
                        </button>
                        <button onClick={() => setShowBalanceBreakdown(false)} className="p-1.5 bg-white/20 hover:bg-white/30 rounded-full transition-colors">
                          <X className="w-4 h-4 text-white" />
                        </button>
                      </div>
                    </div>
                    <div className="mt-4 flex justify-between items-end">
                      <div>
                        <p className="text-blue-100 text-xs mb-1">Total Balance</p>
                        <p className="text-3xl font-bold">₹{balance.toLocaleString()}</p>
                      </div>
                    </div>
                  </div>

                  {/* Content */}
                  <div className="p-6 overflow-y-auto flex-1 bg-gray-50 dark:bg-gray-800/50">
                    <div className="space-y-3">
                      {(() => {
                        // Calculate breakdown
                        const breakdown = {
                          UPI: 0,
                          Cash: 0,
                          Card: 0,
                          Other: 0
                        };


                        transactions.forEach(t => {
                          let amount = 0;

                          // Handle transfers (between payment methods or vault)
                          if (t.type === 'transfer' && t.transferFrom && t.transferTo) {
                            // Transfer TO vault = money leaves the source (vaultOut in finance.ts)
                            if (t.transferTo === 'secret_vault') {
                              // Deduct from source payment method
                              const sourceKey = (t.transferFrom === 'upi' || t.transferFrom === 'online') ? 'UPI' :
                                t.transferFrom === 'cash' ? 'Cash' :
                                  t.transferFrom === 'card' ? 'Card' : null;

                              if (sourceKey) {
                                breakdown[sourceKey as keyof typeof breakdown] -= t.amount;
                              }
                            }
                            // Transfer FROM vault = income to destination (income in finance.ts)
                            else if (t.transferFrom === 'secret_vault') {
                              // Add to destination payment method
                              const destKey = (t.transferTo === 'upi' || t.transferTo === 'online') ? 'UPI' :
                                t.transferTo === 'cash' ? 'Cash' :
                                  t.transferTo === 'card' ? 'Card' : null;

                              if (destKey) {
                                breakdown[destKey as keyof typeof breakdown] += t.amount;
                              }
                            }
                            // Regular transfers between payment methods (net zero)
                            else {
                              const sourceKey = (t.transferFrom === 'upi' || t.transferFrom === 'online') ? 'UPI' :
                                t.transferFrom === 'cash' ? 'Cash' :
                                  t.transferFrom === 'card' ? 'Card' : null;
                              const destKey = (t.transferTo === 'upi' || t.transferTo === 'online') ? 'UPI' :
                                t.transferTo === 'cash' ? 'Cash' :
                                  t.transferTo === 'card' ? 'Card' : null;

                              if (sourceKey) breakdown[sourceKey as keyof typeof breakdown] -= t.amount;
                              if (destKey) breakdown[destKey as keyof typeof breakdown] += t.amount;
                            }
                            return;
                          }

                          // Handle income, expenses, and debts
                          if (t.type === 'income') amount = t.amount;
                          else if (t.type === 'expense') amount = -t.amount;
                          else if (t.type === 'debt') {
                            // Only pending debts affect balance - calculate remaining after partial settlements
                            if (t.debtStatus === 'pending') {
                              const settledSoFar = (t as any).settledAmount || 0;
                              const remainingAmount = Math.max(0, t.amount - settledSoFar);

                              if (t.debtType === 'lent') amount = -remainingAmount;
                              else if (t.debtType === 'borrowed') amount = remainingAmount;
                            }
                            // Settlement transactions (in/out) adjust the balance
                            if (t.debtType === 'settlement_in') amount = t.amount;
                            else if (t.debtType === 'settlement_out') amount = -t.amount;
                          }

                          if ((t as any).isTripSettlement) return;

                          const method = t.paymentMethod || 'Cash';
                          if (method.match(/upi|online/i)) breakdown.UPI += amount;
                          else if (method.match(/cash/i)) breakdown.Cash += amount;
                          else if (method.match(/card|debit|credit/i)) breakdown.Card += amount;
                          else breakdown.Cash += amount; // Default unrecognized methods to Cash
                        });

                        // Apply adjustments calculated from raw trip expenses
                        Object.entries(breakdownAdjustments || {}).forEach(([method, adjustment]) => {
                          if (method === 'UPI') breakdown.UPI += adjustment;
                          else if (method === 'Cash') breakdown.Cash += adjustment;
                          else if (method === 'Card') breakdown.Card += adjustment;
                          else breakdown.Other += adjustment;
                        });


                        const sorted = Object.entries(breakdown)
                          .filter(([method]) => method !== 'Other')
                          .sort((a, b) => b[1] - a[1]);

                        return sorted.map(([method, amount], index) => {
                          const isPositive = amount >= 0;
                          const percent = balance !== 0 ? Math.abs(amount / balance) * 100 : 0;

                          return (
                            <motion.div
                              key={method}
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: index * 0.05 }}
                              className="bg-white dark:bg-gray-800 p-4 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700"
                            >
                              <div className="flex justify-between items-center mb-2">
                                <div className="flex items-center gap-3">
                                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${method === 'UPI' ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/30' :
                                    method === 'Cash' ? 'bg-green-50 text-green-600 dark:bg-green-900/30' :
                                      method === 'Card' ? 'bg-purple-50 text-purple-600 dark:bg-purple-900/30' :
                                        'bg-gray-50 text-gray-600 dark:bg-gray-700'
                                    }`}>
                                    {method === 'UPI' ? <Scan className="w-5 h-5" /> :
                                      method === 'Cash' ? <Wallet className="w-5 h-5" /> :
                                        method === 'Card' ? <CreditCard className="w-5 h-5" /> :
                                          <MoreHorizontal className="w-5 h-5" />}
                                  </div>
                                  <div>
                                    <p className="font-semibold text-gray-900 dark:text-white capitalize">{method}</p>
                                    <div className="flex items-center gap-2 mt-0.5">
                                      <div className="w-16 h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                                        <div
                                          className={`h-full rounded-full ${isPositive ? 'bg-emerald-500' : 'bg-red-500'}`}
                                          style={{ width: `${Math.min(percent, 100)}%` }}
                                        />
                                      </div>
                                    </div>
                                  </div>
                                </div>
                                <div className="text-right">
                                  <p className={`font-bold ${isPositive ? 'text-emerald-500' : 'text-red-500'}`}>
                                    {isPositive ? '+' : ''}₹{amount.toLocaleString()}
                                  </p>
                                </div>
                              </div>
                            </motion.div>
                          );
                        });
                      })()}
                    </div>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {showDailyDigest && (
              <DailyDigestModal
                pendingRules={pendingRules}
                onConfirm={handleDailyDigestConfirm}
                onRemindLater={() => setShowDailyDigest(false)}
              />
            )}
          </AnimatePresence>

          {/* AI Chat Assistant - Floating Button */}
          <AIChatAssistant
            transactions={transactions}
            budgets={budgets}
            goals={goals}
            onGoalAdded={() => { }}
            onGoalUpdated={() => { }}
          />
        </div>
      </PageTransition >

      {/* Bottom Navigation */}

    </>
  );
};

export default Dashboard;
