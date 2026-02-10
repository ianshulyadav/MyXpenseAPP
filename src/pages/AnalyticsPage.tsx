import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, PieChart, Wallet, Target, PiggyBank } from 'lucide-react';
import PageTransition from '../components/PageTransition';
import { useTransactions, useBudgets, useGoals } from '../hooks/useFirestoreSync';
import { useTripSettlements } from '../hooks/useTripSettlements';
import AutoSavingsCalculator from '../components/AutoSavingsCalculator';
import SpendingComparison from '../components/SpendingComparison';
import StatCard from '../components/StatCard';
import TopExpensesCard from '../components/TopExpensesCard';
import AIInsightsCard from '../components/AIInsightsCard';
import IncomeVsExpenseChart from '../components/IncomeVsExpenseChart';
import DateCalendar from '../components/DateCalendar';
import DailyTransactionCard from '../components/DailyTransactionCard';

type TimeFilter = '7days' | '30days' | '90days' | 'all';

const AnalyticsPage = () => {
  const navigate = useNavigate();
  const { transactions: allTransactionsRaw } = useTransactions();
  const { tripSettlements } = useTripSettlements();
  const { budgets } = useBudgets();
  const { goals } = useGoals();
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [timeFilter, setTimeFilter] = useState<TimeFilter>(() => {
    return (localStorage.getItem('analytics_time_filter') as TimeFilter) || '30days';
  });

  const allTransactions = useMemo(() => {
    return [...allTransactionsRaw, ...tripSettlements];
  }, [allTransactionsRaw, tripSettlements]);

  // Filter transactions based on selected time period
  const filteredTransactions = useMemo(() => {
    const now = new Date();
    return allTransactions.filter(t => {
      const tDate = new Date(t.date);
      if (timeFilter === '7days') return (now.getTime() - tDate.getTime()) / (1000 * 3600 * 24) <= 7;
      if (timeFilter === '30days') return (now.getTime() - tDate.getTime()) / (1000 * 3600 * 24) <= 30;
      if (timeFilter === '90days') return (now.getTime() - tDate.getTime()) / (1000 * 3600 * 24) <= 90;
      return true;
    });
  }, [allTransactions, timeFilter]);

  // Calculate totals and metrics
  const stats = useMemo(() => {
    let income = 0;
    let expenses = 0;

    filteredTransactions.forEach((t: any) => {
      if (t.type === 'transfer') return;

      if (t.type === 'income') {
        income += t.amount;
      } else if (t.type === 'expense') {
        expenses += t.amount;
      } else if (t.type === 'debt' || t.isTripSettlement) {
        // DESIGN NOTE: This is intentionally different from finance.ts's balance calculation.
        // finance.ts treats pending debts as balance adjustments (pendingLent/pendingBorrowed).
        // Here in Analytics, we show a CASHFLOW view where:
        //   - Lent (Pending) = Money Out (Expense-like for cashflow)
        //   - Borrowed (Pending) = Money In (Income-like for cashflow)
        //   - Settlement Out = Expense
        //   - Settlement In = Income
        // This gives users a clear picture of actual money movement.

        if (t.debtType === 'lent' && t.debtStatus === 'pending') {
          expenses += t.amount;
        } else if (t.debtType === 'borrowed' && t.debtStatus === 'pending') {
          income += t.amount;
        } else if (t.debtType === 'settlement_out') {
          expenses += t.amount;
        } else if (t.debtType === 'settlement_in') {
          income += t.amount;
        }
      }
    });

    const savings = Math.round((income - expenses) * 100) / 100;
    const rate = income > 0 ? Math.round((savings / income) * 10000) / 100 : 0;

    return {
      income: Math.round(income * 100) / 100,
      expenses: Math.round(expenses * 100) / 100,
      savings,
      rate
    };
  }, [filteredTransactions]);

  const handleFilterChange = (filter: TimeFilter) => {
    setTimeFilter(filter);
    localStorage.setItem('analytics_time_filter', filter);
  };

  const [activeSlide, setActiveSlide] = useState(0);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const scrollLeft = e.currentTarget.scrollLeft;
    const width = e.currentTarget.clientWidth;
    const newSlide = Math.round(scrollLeft / width);
    setActiveSlide(newSlide);
  };

  return (
    <PageTransition>
      <div className="bg-gray-50 dark:bg-gray-950 min-h-screen flex flex-col fixed inset-0 z-0">
        {/* Header (Fixed) */}
        <div className="bg-white dark:bg-gray-900 px-4 py-4 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center shadow-sm z-30 shrink-0">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate(-1)}
              className="p-2 -ml-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-300" />
            </button>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">Analytics</h1>
          </div>

          <div className="flex bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
            {(['7days', '30days', '90days', 'all'] as const).map((filter) => (
              <button
                key={filter}
                onClick={() => handleFilterChange(filter)}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${timeFilter === filter
                  ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                  }`}
              >
                {filter === 'all' ? 'All' : filter === '7days' ? '7D' : filter === '30days' ? '30D' : '90D'}
              </button>
            ))}
          </div>
        </div>

        {/* Horizontal Scroll Container */}
        <div
          className="flex-1 overflow-x-auto overflow-y-hidden snap-x snap-mandatory flex scrollbar-hide"
          onScroll={handleScroll}
        >

          {/* PAGE 1: Overview (Stats, AI, Calculator) */}
          <div className="w-full min-w-full shrink-0 snap-center snap-always snap-stop-always p-4 h-full overflow-y-auto pb-48 flex flex-col gap-3">
            {/* 1. Key Metrics Grid (Fixed Height) */}
            <div className="shrink-0 grid grid-cols-2 gap-2">
              <StatCard title="Income" value={`₹${stats.income.toLocaleString()}`} icon={Wallet} color="green" delay={0} />
              <StatCard title="Expenses" value={`₹${stats.expenses.toLocaleString()}`} icon={PieChart} color="red" delay={0.1} />
              <StatCard title="Savings" value={`₹${stats.savings.toLocaleString()}`} subtext={stats.savings > 0 ? "On track" : "Overspending"} icon={PiggyBank} color="blue" delay={0.2} />
              <StatCard title="Rate" value={`${stats.rate.toFixed(1)}%`} icon={Target} color="purple" delay={0.3} />
            </div>

            {/* Calculator - Collapsed by default */}
            <div className="shrink-0">
              <AutoSavingsCalculator />
            </div>

            {/* AI Insights - Moved below Smart Budget */}
            <div className="shrink-0">
              <AIInsightsCard compact={false} transactions={filteredTransactions} budgets={budgets} goals={goals} />
            </div>

            <div className="flex-1 min-h-[20px]"></div>

            <p className="shrink-0 text-center text-[10px] text-gray-400 flex items-center justify-center gap-1 animate-pulse pb-4">
              Swipe for Charts <ArrowLeft className="w-3 h-3 rotate-180" />
            </p>
          </div>

          {/* PAGE 2: Calendar & Daily Transactions */}
          <div className="w-full min-w-full shrink-0 snap-center snap-always snap-stop-always p-4 h-full overflow-y-auto pb-48 flex flex-col gap-3">
            {/* Calendar and Daily Transaction Card */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <DateCalendar
                transactions={allTransactions}
                onDateSelect={setSelectedDate}
                selectedDate={selectedDate}
              />
              <DailyTransactionCard
                selectedDate={selectedDate}
                transactions={allTransactions}
              />
            </div>

            {/* Income vs Expense Chart */}
            <div className="flex-1 min-h-[300px] bg-amber-50/50 dark:bg-amber-900/10 p-1 rounded-2xl border border-amber-100 dark:border-amber-900/20">
              <IncomeVsExpenseChart transactions={filteredTransactions} />
            </div>
          </div>

          {/* PAGE 3: Details (Comparison & Top Expenses) */}
          <div className="w-full min-w-full shrink-0 snap-center snap-always snap-stop-always p-4 h-full overflow-y-auto pb-52 flex flex-col gap-3">
            {/* Monthly Comparison */}
            <div className="shrink-0 h-[320px] bg-indigo-50/50 dark:bg-indigo-900/10 p-1 rounded-2xl border border-indigo-100 dark:border-indigo-900/20">
              <SpendingComparison transactions={filteredTransactions} />
            </div>

            {/* Top Expenses */}
            <div className="shrink-0 bg-violet-50/50 dark:bg-violet-900/10 p-1 rounded-2xl border border-violet-100 dark:border-violet-900/20">
              <TopExpensesCard transactions={filteredTransactions} />
            </div>
          </div>

        </div>

        {/* Pagination Dots (Fixed above bottom nav) */}
        <div className="absolute bottom-24 left-0 right-0 flex justify-center gap-2 z-40 pointer-events-none">
          {[0, 1, 2].map(idx => (
            <div
              key={idx}
              className={`h-1.5 rounded-full transition-all duration-300 ${activeSlide === idx ? 'w-6 bg-blue-500' : 'w-1.5 bg-gray-300 dark:bg-gray-700'}`}
            />
          ))}
        </div>
      </div>
    </PageTransition>
  );
};

export default AnalyticsPage;
