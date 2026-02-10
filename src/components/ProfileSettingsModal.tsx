import { useState, useEffect, memo } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import {
  X,
  Camera,
  Edit2,
  Bell,
  Database,
  Download,
  Upload,
  Trash2,
  User,
  LogOut,
  ChevronDown,
  HelpCircle,
  MessageCircle,
  BellOff,
  Globe,
  Shield,
  Fingerprint,
  Check,
  Clock,
  Calendar,
  Lock,
  ChevronRight,
  Repeat,
  Plus,
  Tag
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';
import EditNameModal from './EditNameModal';
import { clearAllData as clearAllDBData, getSecretVault, saveSecretVault, getBudgets, getGoals, getTrips, getTripExpenses, getTransactions, type SecretVault, type VaultTransaction } from '../utils/db';
import { encryptData, decryptData } from '../utils/security';
import SecretVaultSetup from './SecretVaultSetup';
import SecretVaultPINEntry from './SecretVaultPINEntry';
import SecretVaultDashboard from './SecretVaultDashboard';
import SecretVaultForgotPIN from './SecretVaultForgotPIN';
import RecurringRulesList from './RecurringRulesList';
import AddRecurringRuleForm from './AddRecurringRuleForm';
import UserManual from './UserManual';
import ManageCategoriesModal from './ManageCategoriesModal';
import type { RecurringRule } from '../types';

interface ProfileSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onProfileUpdate?: () => void;
  currentBalance: number;
}

const ProfileSettingsModal = ({ isOpen, onClose, onProfileUpdate, currentBalance }: ProfileSettingsModalProps) => {
  const navigate = useNavigate();
  const { signOut, userProfile, updateUserName, updateUserPhoto, currentUser } = useAuth();
  const [showNotifications, setShowNotifications] = useState(false);
  const [showDataManagement, setShowDataManagement] = useState(false);
  const [showAccountSettings, setShowAccountSettings] = useState(false);
  const [showPrivacySettings, setShowPrivacySettings] = useState(false);
  const [showPreferences, setShowPreferences] = useState(false);
  const [showRecurringPayments, setShowRecurringPayments] = useState(false);
  const [showEditName, setShowEditName] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [vibrationIntensity, setVibrationIntensity] = useState('medium');
  const [lowBalanceAlerts, setLowBalanceAlerts] = useState(true);
  const [budgetReminders, setBudgetReminders] = useState(true);
  const [userName, setUserName] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [profilePicture, setProfilePicture] = useState<string | null>(null);
  const [currency, setCurrency] = useState('INR');
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [lowBalanceThreshold, setLowBalanceThreshold] = useState(500);
  const [showUpdateAnimation, setShowUpdateAnimation] = useState(false);
  const [showUserManual, setShowUserManual] = useState(false);
  const [showManageCategories, setShowManageCategories] = useState(false);
  const [isDeletingData, setIsDeletingData] = useState(false);

  const [dailyReminderEnabled, setDailyReminderEnabled] = useState(false);
  const [biDailyEnabled, setBiDailyEnabled] = useState(false);
  const [selectedDays, setSelectedDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [reminderTime, setReminderTime] = useState('09:00');
  const [reminderTime2, setReminderTime2] = useState('21:00');

  // ... (Vault state omitted for brevity, keeping existing)
  const [vaultMode, setVaultMode] = useState<'none' | 'setup' | 'pin-entry' | 'dashboard' | 'forgot-pin'>('none');
  const [vaultData, setVaultData] = useState<SecretVault | null>(null);
  const [vaultBalance, setVaultBalance] = useState(0);
  const [vaultHistory, setVaultHistory] = useState<VaultTransaction[]>([]);

  // Recurring Rules State
  const [recurringRules, setRecurringRules] = useState<RecurringRule[]>([]);
  const [showAddRule, setShowAddRule] = useState(false);
  const [editingRule, setEditingRule] = useState<RecurringRule | null>(null);

  // Vault helpers
  const loadVaultData = async () => {
    if (!userProfile?.uid) return;

    const vault = await getSecretVault(userProfile.uid);
    if (vault) {
      setVaultData(vault);
      // Balance will be decrypted after PIN verification
      setVaultHistory(vault.vaultHistory || []);
    }
  };

  useBodyScrollLock(isOpen);

  useEffect(() => {
    // ... (Keeping existing useEffect logic for local storage loading)
    const savedNotificationsEnabled = localStorage.getItem('notifications_enabled');
    const savedVibrationIntensity = localStorage.getItem('vibration_intensity') || 'medium';
    const savedLowBalanceAlerts = localStorage.getItem('low_balance_alerts');
    const savedBudgetReminders = localStorage.getItem('budget_reminders');
    const savedUserName = userProfile?.name || localStorage.getItem('myxpense_user_name') || 'User';
    const savedUserEmail = localStorage.getItem('myxpense_user_email') || '';
    const savedProfilePicture = localStorage.getItem('profile_picture');
    const savedCurrency = localStorage.getItem('myxpense_currency') || 'INR';
    const savedBiometric = localStorage.getItem('biometric_enabled') === 'true';
    const savedLowBalanceThreshold = localStorage.getItem('low_balance_threshold');
    const savedDailyReminder = localStorage.getItem('daily_reminder_enabled') === 'true';
    const savedBiDaily = localStorage.getItem('bi_daily_reminder_enabled') === 'true';
    const savedSelectedDays = localStorage.getItem('daily_reminder_days');
    const savedReminderTime = localStorage.getItem('daily_reminder_time') || '09:00';
    const savedReminderTime2 = localStorage.getItem('bi_daily_reminder_time') || '21:00';

    setNotificationsEnabled(savedNotificationsEnabled !== 'false');
    setVibrationIntensity(savedVibrationIntensity);
    setLowBalanceAlerts(savedLowBalanceAlerts !== 'false');
    setBudgetReminders(savedBudgetReminders !== 'false');
    setUserName(savedUserName);
    setUserEmail(savedUserEmail);
    setProfilePicture(savedProfilePicture);
    setCurrency(savedCurrency);
    setBiometricEnabled(savedBiometric);
    setLowBalanceThreshold(savedLowBalanceThreshold ? parseInt(savedLowBalanceThreshold) : 500);
    setDailyReminderEnabled(savedDailyReminder);
    setBiDailyEnabled(savedBiDaily);
    if (savedSelectedDays) {
      setSelectedDays(JSON.parse(savedSelectedDays));
    }
    setReminderTime(savedReminderTime);
    setReminderTime2(savedReminderTime2);

    // Load Recurring Rules
    const savedRules = localStorage.getItem('recurring_rules');
    if (savedRules) {
      setRecurringRules(JSON.parse(savedRules));
    }

    loadVaultData();
  }, [isOpen, userProfile]);




  const saveRecurringRules = (rules: RecurringRule[]) => {
    setRecurringRules(rules);
    localStorage.setItem('recurring_rules', JSON.stringify(rules));
  };

  const handleAddRule = (ruleData: any) => {
    if (!userProfile?.uid) return;

    const newRule: RecurringRule = {
      id: ruleData.id || `rule_${Date.now()}`,
      userId: userProfile.uid,
      title: ruleData.title,
      baseAmount: ruleData.baseAmount,
      category: ruleData.category,
      activeDays: ruleData.activeDays,
      lastGeneratedDate: null,
      isActive: ruleData.isActive,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    if (ruleData.id) {
      // Edit existing
      const updatedRules = recurringRules.map(r => r.id === ruleData.id ? newRule : r);
      saveRecurringRules(updatedRules);
    } else {
      // Add new
      saveRecurringRules([...recurringRules, newRule]);
    }

    setShowAddRule(false);
    setEditingRule(null);
    showSuccessAnimation();
  };

  const handleDeleteRule = (id: string) => {
    if (confirm('Delete this recurring payment rule?')) {
      const updatedRules = recurringRules.filter(r => r.id !== id);
      saveRecurringRules(updatedRules);
    }
  };

  const handleToggleRuleActive = (id: string, isActive: boolean) => {
    const updatedRules = recurringRules.map(r => r.id === id ? { ...r, isActive } : r);
    saveRecurringRules(updatedRules);
  };

  const handleEditRule = (rule: RecurringRule) => {
    setEditingRule(rule);
    setShowAddRule(true);
  };



  if (!isOpen) return null;

  const showSuccessAnimation = () => {
    setShowUpdateAnimation(true);
    setTimeout(() => setShowUpdateAnimation(false), 2000);
    if (onProfileUpdate) {
      onProfileUpdate();
    }
  };

  // Helper for logout
  const handleLogout = async () => {
    // Clear local storage explicitly on logout to match user request "instantly delete all local db"
    // Although signOut calls clearAllData (IDB), explicit localStorage clear is safer.
    localStorage.clear();
    await signOut();
    onClose();
    window.location.href = '/login';
  };



  const handleExportData = async () => {
    if (!userProfile?.uid) {
      alert('Please log in to export data.');
      return;
    }

    try {
      const [transactions, goals, budgets, trips] = await Promise.all([
        getTransactions(userProfile.uid),
        getGoals(userProfile.uid),
        getBudgets(userProfile.uid),
        getTrips(userProfile.uid)
      ]);

      const allTripExpenses = await Promise.all(
        trips.map(trip => getTripExpenses(trip.id))
      );
      const tripExpenses = allTripExpenses.flat();

      const data = {
        transactions,
        goals,
        budgets,
        trips,
        tripExpenses,
        exportDate: new Date().toISOString(),
        version: '2.0.0'
      };

      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `myxpense-backup-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      showSuccessAnimation();
    } catch (error) {
      console.error('Export error:', error);
      alert('Error exporting data. Please try again.');
    }
  };



  // ... (Other handlers)
  // For brevity sake, I'm assuming we keep previous handlers. 
  // I must be careful not to delete them if I replace a large chunk.
  // The replace_file_content tool is better used with specific chunks if I don't want to re-paste everything.
  // BUT the instruction is to START at line 1.
  // Wait, I am replacing lines 1-800 which is huge. I should probably be more surgical to avoid deleting helper functions.
  // I will restart the tool call strategy to be safe.

  const parseCSV = (text: string): Array<Record<string, string>> => {
    const lines = text.split('\n').filter(line => line.trim());
    if (lines.length < 2) return [];

    const headers = lines[0].split(',').map(h => h.trim().replace(/^["']|["']$/g, '').toLowerCase());
    const rows: Array<Record<string, string>> = [];

    for (let i = 1; i < lines.length; i++) {
      const values: string[] = [];
      let current = '';
      let inQuotes = false;

      for (const char of lines[i]) {
        if (char === '"' && !inQuotes) {
          inQuotes = true;
        } else if (char === '"' && inQuotes) {
          inQuotes = false;
        } else if (char === ',' && !inQuotes) {
          values.push(current.trim().replace(/^["']|["']$/g, ''));
          current = '';
        } else {
          current += char;
        }
      }
      values.push(current.trim().replace(/^["']|["']$/g, ''));

      if (values.length === headers.length) {
        const row: Record<string, string> = {};
        headers.forEach((header, index) => {
          row[header] = values[index];
        });
        rows.push(row);
      }
    }
    return rows;
  };

  const importCSV = async (file: File) => {
    const text = await file.text();
    const rows = parseCSV(text);

    if (rows.length === 0) {
      alert('No valid data found in CSV file.');
      return;
    }

    if (!userProfile?.uid) {
      alert('User not logged in. Please log in to import data.');
      return;
    }

    const { saveTransaction } = await import('../utils/db');
    let imported = 0;

    for (const row of rows) {
      const amount = parseFloat(row.amount || row.value || '0');
      if (isNaN(amount) || amount === 0) continue;

      const type = (row.type?.toLowerCase() === 'income' ||
        row.category?.toLowerCase() === 'income' ||
        amount > 0 && !row.type) ? 'income' : 'expense';

      const transaction = {
        id: `imported_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        userId: userProfile.uid,
        type: type as 'income' | 'expense',
        amount: Math.abs(amount),
        category: row.category || (type === 'income' ? 'Other Income' : 'other'),
        description: row.description || row.note || row.memo || row.title || '',
        paymentMethod: row.payment_method || row.paymentmethod || row.method || 'cash',
        date: row.date ? new Date(row.date) : new Date(),
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await saveTransaction(transaction);
      imported++;
    }

    return imported;
  };

  const handleImportData = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json,.csv,text/csv';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        const isCSV = file.name.toLowerCase().endsWith('.csv') || file.type === 'text/csv';

        if (isCSV) {
          try {
            const importedCount = await importCSV(file);
            showSuccessAnimation();
            alert(`Successfully imported ${importedCount} transactions from CSV! Refreshing...`);
            input.remove();
            setTimeout(() => window.location.reload(), 1000);
          } catch (error) {
            console.error('CSV Import error:', error);
            alert('Error importing CSV. Please check the file format and try again.');
          }
          return;
        }

        const reader = new FileReader();
        reader.onload = async (event) => {
          try {
            const data = JSON.parse(event.target?.result as string);

            if (!data.transactions && !data.goals && !data.budgets && !data.trips) {
              alert('Invalid backup file. No data found.');
              return;
            }

            if (!userProfile?.uid) {
              alert('User not logged in. Please log in to import data.');
              return;
            }

            const { saveTransaction, saveBudget, saveGoal, saveTrip, saveTripExpense } = await import('../utils/db');

            const importedCounts = { transactions: 0, goals: 0, budgets: 0, trips: 0, tripExpenses: 0 };

            if (data.transactions && Array.isArray(data.transactions)) {
              for (const transaction of data.transactions) {
                const transactionWithUserId = {
                  ...transaction,
                  userId: userProfile.uid,
                  date: transaction.date ? new Date(transaction.date) : new Date(),
                  createdAt: transaction.createdAt ? new Date(transaction.createdAt) : new Date(),
                  updatedAt: new Date()
                };
                await saveTransaction(transactionWithUserId);
                importedCounts.transactions++;
              }
            }

            if (data.goals && Array.isArray(data.goals)) {
              for (const goal of data.goals) {
                const goalWithUserId = {
                  ...goal,
                  userId: userProfile.uid,
                  deadline: goal.deadline ? new Date(goal.deadline) : undefined,
                  createdAt: goal.createdAt ? new Date(goal.createdAt) : new Date(),
                  updatedAt: new Date()
                };
                await saveGoal(goalWithUserId);
                importedCounts.goals++;
              }
            }

            if (data.budgets && Array.isArray(data.budgets)) {
              for (const budget of data.budgets) {
                const budgetWithUserId = {
                  ...budget,
                  userId: userProfile.uid,
                  startDate: budget.startDate ? new Date(budget.startDate) : new Date(),
                  endDate: budget.endDate ? new Date(budget.endDate) : new Date(),
                  createdAt: budget.createdAt ? new Date(budget.createdAt) : new Date(),
                  updatedAt: new Date()
                };
                await saveBudget(budgetWithUserId);
                importedCounts.budgets++;
              }
            }

            // Handle trips import
            if (data.trips && Array.isArray(data.trips)) {
              for (const trip of data.trips) {
                const tripWithUserId = {
                  ...trip,
                  userId: userProfile.uid,
                  createdAt: trip.createdAt ? new Date(trip.createdAt) : new Date(),
                  updatedAt: new Date(),
                  endedAt: trip.endedAt ? new Date(trip.endedAt) : undefined
                };
                await saveTrip(tripWithUserId);
                importedCounts.trips++;
              }
            }

            // Handle trip expenses import
            if (data.tripExpenses && Array.isArray(data.tripExpenses)) {
              for (const expense of data.tripExpenses) {
                const expenseWithUserId = {
                  ...expense,
                  userId: userProfile.uid,
                  date: expense.date ? new Date(expense.date) : new Date(),
                  createdAt: expense.createdAt ? new Date(expense.createdAt) : new Date(),
                  updatedAt: new Date()
                };
                await saveTripExpense(expenseWithUserId);
                importedCounts.tripExpenses++;
              }
            }

            showSuccessAnimation();
            const importSummary = Object.entries(importedCounts)
              .filter(([_, count]) => count > 0)
              .map(([type, count]) => `${count} ${type}`)
              .join(', ');
            alert(`Data imported successfully! (${importSummary}) Refreshing...`);
            input.remove();
            setTimeout(() => window.location.reload(), 1000);
          } catch (error) {
            console.error('Import error:', error);
            alert('Error importing data. Please check the file format and try again.');
          }
        };
        reader.readAsText(file);
      }

      setTimeout(() => input.remove(), 100);
    };
    input.click();
  };

  const handleClearAllData = async () => {
    if (confirm('Are you sure you want to clear all data? This action cannot be undone.')) {
      setIsDeletingData(true);
      try {
        // Clear remote data first if logged in
        if (userProfile?.uid) {
          try {
            const { getFirestoreSync } = await import('../services/firestoreSync');
            await getFirestoreSync(userProfile.uid).deleteAllUserData();
          } catch (e) {
            console.error("Failed to clear remote data", e);
            // Continue to clear local data even if remote fails
          }
        }

        // Clear Local Data (Unconditional)
        // We want to wipe everything to ensure a clean slate
        localStorage.clear();

        // Clear IndexedDB (Unconditional)
        try {
          await clearAllDBData();
        } catch (e) {
          console.error("Failed to clear IndexedDB", e);
        }

        showSuccessAnimation();

        // Close modal and navigate to home
        onClose();
        setTimeout(() => {
          setIsDeletingData(false);
          navigate('/', { replace: true });
          window.location.reload();
        }, 1000);
      } catch (error) {
        console.error('Error clearing data:', error);
        alert('Error clearing data. Please try again.');
        setIsDeletingData(false);
      }
    }
  };

  const handleDeleteAccount = async () => {
    if (confirm('Are you sure you want to delete your account? This will permanently delete all your data and access. This action cannot be undone.')) {
      setIsDeletingData(true);
      try {
        // 1. Delete all remote data
        if (userProfile?.uid) {
          try {
            const { getFirestoreSync } = await import('../services/firestoreSync');
            await getFirestoreSync(userProfile.uid).deleteAllUserData();
          } catch (e) {
            console.error("Failed to delete remote data", e);
          }
        }

        // 2. Delete all local data
        localStorage.clear();
        await clearAllDBData();

        // 3. Delete Auth Account
        if (currentUser) {
          await currentUser.delete();
        }

        // 4. Cleanup and redirect
        await signOut();
        onClose();
        window.location.href = '/login';

      } catch (error) {
        console.error("Error deleting account:", error);
        alert("Failed to delete account. You may need to sign in again to verify your identity before deleting.");
        setIsDeletingData(false);
      }
    }
  };

  const handleHelpFeedback = () => {
    navigate('/manual');
  };

  const toggleNotifications = async () => {
    const newState = !notificationsEnabled;
    setNotificationsEnabled(newState);
    localStorage.setItem('notifications_enabled', String(newState));

    if (newState && 'Notification' in window) {
      if (Notification.permission === 'default') {
        await Notification.requestPermission();
      }
    }
    showSuccessAnimation();
  };

  const handleVibrationIntensityChange = async (intensity: string) => {
    setVibrationIntensity(intensity);
    localStorage.setItem('vibration_intensity', intensity);

    // Preview vibration
    if (intensity !== 'off' && 'vibrate' in navigator) {
      const { getVibrationPattern } = await import('../utils/fcm');
      navigator.vibrate(getVibrationPattern());
    }

    showSuccessAnimation();
  };

  const toggleLowBalanceAlerts = () => {
    const newState = !lowBalanceAlerts;
    setLowBalanceAlerts(newState);
    localStorage.setItem('low_balance_alerts', String(newState));
    showSuccessAnimation();
  };

  const toggleBudgetReminders = () => {
    const newState = !budgetReminders;
    setBudgetReminders(newState);
    localStorage.setItem('budget_reminders', String(newState));
    showSuccessAnimation();
  };

  const toggleBiometric = () => {
    const newState = !biometricEnabled;
    setBiometricEnabled(newState);
    localStorage.setItem('biometric_enabled', String(newState));
    showSuccessAnimation();
  };

  const toggleDailyReminder = async () => {
    const newState = !dailyReminderEnabled;
    setDailyReminderEnabled(newState);
    localStorage.setItem('daily_reminder_enabled', String(newState));
    showSuccessAnimation();

    // Reschedule or cancel daily reminders
    if (newState) {
      const { scheduleDailyReminder } = await import('../utils/fcm');
      scheduleDailyReminder();
    } else {
      const { cancelDailyReminder } = await import('../utils/fcm');
      cancelDailyReminder();
    }
  };

  const toggleDay = async (day: number) => {
    const newDays = selectedDays.includes(day)
      ? selectedDays.filter(d => d !== day)
      : [...selectedDays, day].sort();
    setSelectedDays(newDays);
    localStorage.setItem('daily_reminder_days', JSON.stringify(newDays));
    showSuccessAnimation();

    // Reschedule daily reminders
    const { scheduleDailyReminder } = await import('../utils/fcm');
    scheduleDailyReminder();
  };

  const handleTimeChange = async (time: string) => {
    setReminderTime(time);
    localStorage.setItem('daily_reminder_time', time);
    showSuccessAnimation();

    // Reschedule daily reminders
    const { scheduleDailyReminder } = await import('../utils/fcm');
    scheduleDailyReminder();
  };

  const handleTime2Change = async (time: string) => {
    setReminderTime2(time);
    localStorage.setItem('bi_daily_reminder_time', time);
    showSuccessAnimation();

    // Reschedule daily reminders
    const { scheduleDailyReminder } = await import('../utils/fcm');
    scheduleDailyReminder();
  };

  const toggleBiDailyReminder = async () => {
    const newState = !biDailyEnabled;
    setBiDailyEnabled(newState);
    localStorage.setItem('bi_daily_reminder_enabled', String(newState));
    showSuccessAnimation();

    // Reschedule daily reminders
    const { scheduleDailyReminder } = await import('../utils/fcm');
    scheduleDailyReminder();
  };

  const daysOfWeek = [
    { id: 0, label: 'Sun' },
    { id: 1, label: 'Mon' },
    { id: 2, label: 'Tue' },
    { id: 3, label: 'Wed' },
    { id: 4, label: 'Thu' },
    { id: 5, label: 'Fri' },
    { id: 6, label: 'Sat' },
  ];

  // Vault handlers
  const handleVaultSetupComplete = async (pinHash: string, pinSalt: string, secretQuestion: string, secretAnswerHash: string, pin: string, secretAnswerSalt?: string) => {
    console.log('handleVaultSetupComplete called');
    if (!userProfile?.uid) {
      console.error('No user profile!');
      return;
    }

    const initialBalance = 0;
    const encryptedBalance = await encryptData(initialBalance.toString(), pin, pinSalt);

    const vault: SecretVault = {
      id: `vault_${userProfile.uid}`,
      userId: userProfile.uid,
      pinHash,
      pinSalt,
      secretQuestion,
      secretAnswerHash,
      secretAnswerSalt: secretAnswerSalt,
      vaultBalanceEncrypted: encryptedBalance,
      vaultHistory: [],
      createdAt: new Date(),
      updatedAt: new Date()
    };

    console.log('Saving vault...');
    await saveSecretVault(vault);
    console.log('Vault saved, updating state...');
    setVaultData(vault);
    setVaultBalance(0);
    setVaultHistory([]);
    // Store PIN in session for immediate use
    sessionStorage.setItem('vault_pin_temp', pin);
    console.log('Setting vaultMode to dashboard');
    setVaultMode('dashboard');
  };

  const handleOpenVault = () => {
    onClose();
    navigate('/vault');
  };

  const handleVaultPINSuccess = async (pin: string) => {
    if (!vaultData) return;

    // Decrypt balance with the entered PIN
    try {
      const decryptedBalance = await decryptData(vaultData.vaultBalanceEncrypted, pin, vaultData.pinSalt);
      setVaultBalance(parseFloat(decryptedBalance));
      // Store PIN temporarily in session storage for vault operations
      sessionStorage.setItem('vault_pin_temp', pin);
      setVaultMode('dashboard');
    } catch (error) {
      console.error('Error decrypting vault balance:', error);
      setVaultBalance(0);
    }
  };

  const handleVaultAddMoney = async (amount: number, note: string) => {
    if (!vaultData || !userProfile?.uid) return;

    const pin = sessionStorage.getItem('vault_pin_temp') || '';
    const newBalance = vaultBalance + amount;
    const encryptedBalance = await encryptData(newBalance.toString(), pin, vaultData.pinSalt);

    const transaction: VaultTransaction = {
      id: `vault_tx_${Date.now()}`,
      type: 'add',
      amount,
      date: new Date(),
      note
    };

    const updatedVault = {
      ...vaultData,
      vaultBalanceEncrypted: encryptedBalance,
      vaultHistory: [...vaultData.vaultHistory, transaction],
      updatedAt: new Date()
    };

    await saveSecretVault(updatedVault);
    setVaultData(updatedVault);
    setVaultBalance(newBalance);
    setVaultHistory(updatedVault.vaultHistory);
    showSuccessAnimation();
  };

  const handleVaultWithdrawMoney = async (amount: number, note: string) => {
    if (!vaultData || !userProfile?.uid) return;

    const pin = sessionStorage.getItem('vault_pin_temp') || '';
    const newBalance = vaultBalance - amount;
    const encryptedBalance = await encryptData(newBalance.toString(), pin, vaultData.pinSalt);

    const transaction: VaultTransaction = {
      id: `vault_tx_${Date.now()}`,
      type: 'withdraw',
      amount,
      date: new Date(),
      note
    };

    const updatedVault = {
      ...vaultData,
      vaultBalanceEncrypted: encryptedBalance,
      vaultHistory: [...vaultData.vaultHistory, transaction],
      updatedAt: new Date()
    };

    await saveSecretVault(updatedVault);
    setVaultData(updatedVault);
    setVaultBalance(newBalance);
    setVaultHistory(updatedVault.vaultHistory);
    showSuccessAnimation();
  };

  const handleResetPIN = async (newPinHash: string, newPinSalt: string, newPin: string) => {
    if (!vaultData || !userProfile?.uid) return;

    // Re-encrypt balance with new PIN
    const encryptedBalance = await encryptData(vaultBalance.toString(), newPin, newPinSalt);

    const updatedVault = {
      ...vaultData,
      pinHash: newPinHash,
      pinSalt: newPinSalt,
      vaultBalanceEncrypted: encryptedBalance,
      updatedAt: new Date()
    };

    await saveSecretVault(updatedVault);
    setVaultData(updatedVault);
    sessionStorage.removeItem('vault_pin_temp');
    setVaultMode('none');
    showSuccessAnimation();
  };

  const handleVaultClose = () => {
    sessionStorage.removeItem('vault_pin_temp');
    setVaultMode('none');
  };

  const handleSaveName = async (newName: string) => {
    try {
      await updateUserName(newName);
      setUserName(newName);
      showSuccessAnimation();
    } catch (error) {
      console.error('Error saving name:', error);
      localStorage.setItem('myxpense_user_name', newName);
      setUserName(newName);
      showSuccessAnimation();
    }
  };

  const handleCurrencyChange = (newCurrency: string) => {
    setCurrency(newCurrency);
    localStorage.setItem('myxpense_currency', newCurrency);
    showSuccessAnimation();
  };

  const handleLowBalanceThresholdChange = (value: string) => {
    const numValue = parseInt(value) || 0;
    setLowBalanceThreshold(numValue);
    localStorage.setItem('low_balance_threshold', numValue.toString());
    showSuccessAnimation();
  };

  const handleProfilePictureUpload = async () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        if (file.size > 10 * 1024 * 1024) {
          alert('Image size should be less than 10MB');
          return;
        }

        try {
          const imageCompression = (await import('browser-image-compression')).default;
          const options = {
            maxSizeMB: 0.3,
            maxWidthOrHeight: 512,
            useWebWorker: true
          };

          const compressedFile = await imageCompression(file, options);
          const reader = new FileReader();
          reader.onload = async (event) => {
            const base64 = event.target?.result as string;
            await updateUserPhoto(base64);
            setProfilePicture(base64);
            showSuccessAnimation();
          };
          reader.readAsDataURL(compressedFile);
        } catch (error) {
          console.error('Error compressing image:', error);
          alert('Error processing image. Please try another image.');
        }
      }
    };
    input.click();
  };

  const handleRemoveProfilePicture = async () => {
    await updateUserPhoto(null);
    setProfilePicture(null);
    showSuccessAnimation();
  };

  const fullResetAndClose = () => {
    setShowNotifications(false);
    setShowDataManagement(false);
    setShowAccountSettings(false);
    setShowPrivacySettings(false);
    setShowPreferences(false);
    onClose();
  };

  const handleExportCSV = async () => {
    if (!userProfile?.uid) {
      alert('Please log in to export data.');
      return;
    }

    try {
      const transactions = await getTransactions(userProfile.uid);

      if (transactions.length === 0) {
        alert('No transactions to export');
        return;
      }

      const headers = ['Date', 'Type', 'Amount', 'Category', 'Description', 'Payment Method'];
      const csvRows = [headers.join(',')];

      for (const t of transactions) {
        const row = [
          new Date(t.date).toLocaleDateString(),
          t.type,
          t.amount,
          t.category || '',
          `"${(t.description || '').replace(/"/g, '""')}"`,
          t.paymentMethod || ''
        ];
        csvRows.push(row.join(','));
      }

      const csvContent = csvRows.join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `myxpense-transactions-${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      showSuccessAnimation();
    } catch (error) {
      console.error('CSV Export error:', error);
      alert('Error exporting CSV. Please try again.');
    }
  };

  const initial = userName.charAt(0).toUpperCase();

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="fixed inset-0" onClick={fullResetAndClose}></div>

      {/* Success Animation */}
      <AnimatePresence>
        {showUpdateAnimation && (
          <motion.div
            initial={{ opacity: 0, scale: 0.5, y: -20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.5, y: -20 }}
            className="fixed top-20 z-[110] bg-gradient-to-r from-green-500 to-emerald-600 text-white px-6 py-3 rounded-full shadow-xl flex items-center space-x-2"
          >
            <Check className="w-5 h-5" />
            <span className="font-semibold">Updated successfully!</span>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="relative bg-white dark:bg-gray-800 rounded-3xl w-full max-w-md max-h-[85vh] overflow-hidden my-auto flex flex-col shadow-2xl"
      >
        {/* Gradient Header */}
        <div className="sticky top-0 bg-gradient-to-r from-blue-500 to-indigo-600 px-4 py-4 flex items-center justify-between z-10 flex-shrink-0">
          <div className="flex items-center space-x-2">
            <User className="w-6 h-6 text-white" />
            <h2 className="text-xl font-semibold text-white">Profile & Settings</h2>
          </div>
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={fullResetAndClose}
            className="p-2 rounded-lg hover:bg-white/20 transition-colors"
          >
            <X className="w-5 h-5 text-white" />
          </motion.button>
        </div>

        <div className="p-4 space-y-4 flex-1 overflow-y-auto">
          {/* Profile Photo Card */}
          <div className="relative overflow-hidden bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-blue-900/20 dark:via-indigo-900/20 dark:to-purple-900/20 rounded-2xl p-6 border border-blue-100 dark:border-blue-800/30">
            <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-blue-200/30 to-indigo-200/30 dark:from-blue-500/10 dark:to-indigo-500/10 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2"></div>
            <div className="flex flex-col items-center relative">
              <div className="relative group">
                {profilePicture ? (
                  <img
                    src={profilePicture}
                    alt="Profile"
                    className="w-24 h-24 rounded-full object-cover border-4 border-white dark:border-gray-700 shadow-xl ring-4 ring-blue-100 dark:ring-blue-900/30"
                  />
                ) : (
                  <div className="w-24 h-24 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center text-white text-3xl font-bold shadow-xl ring-4 ring-blue-100 dark:ring-blue-900/30">
                    {initial}
                  </div>
                )}
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={handleProfilePictureUpload}
                  className="absolute bottom-0 right-0 w-9 h-9 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full flex items-center justify-center text-white hover:from-blue-600 hover:to-indigo-700 transition-all shadow-lg"
                >
                  <Camera className="w-4 h-4" />
                </motion.button>
                {profilePicture && (
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={handleRemoveProfilePicture}
                    className="absolute -top-1 -right-1 w-7 h-7 bg-red-500 rounded-full flex items-center justify-center text-white hover:bg-red-600 transition-colors shadow-md opacity-0 group-hover:opacity-100"
                    title="Remove picture"
                  >
                    <X className="w-4 h-4" />
                  </motion.button>
                )}
              </div>
              <div className="flex items-center space-x-2 mt-4">
                <h3 className="text-xl font-bold text-gray-900 dark:text-white">{userName}</h3>
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setShowEditName(true)}
                  className="p-1.5 hover:bg-white/70 dark:hover:bg-gray-700 rounded-lg transition-colors"
                >
                  <Edit2 className="w-4 h-4 text-blue-500" />
                </motion.button>
              </div>
              {userEmail && (
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{userEmail}</p>
              )}
            </div>
          </div>

          {/* Preferences */}
          <div className="rounded-2xl bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/10 dark:to-pink-900/10 border border-purple-100 dark:border-purple-800/30 overflow-hidden">
            <motion.button
              whileTap={{ scale: 0.99 }}
              onClick={() => setShowPreferences(!showPreferences)}
              className="w-full flex items-center justify-between p-4 hover:bg-purple-100/50 dark:hover:bg-purple-900/20 transition-all duration-200"
            >
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl flex items-center justify-center shadow-lg shadow-purple-200 dark:shadow-purple-900/30">
                  <Globe className="w-5 h-5 text-white" />
                </div>
                <span className="font-semibold text-gray-900 dark:text-white">Preferences</span>
              </div>
              <motion.div
                animate={{ rotate: showPreferences ? 180 : 0 }}
                transition={{ duration: 0.2 }}
              >
                <ChevronDown className="w-5 h-5 text-purple-500" />
              </motion.div>
            </motion.button>

            <AnimatePresence>
              {showPreferences && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
                  className="overflow-hidden"
                >
                  <div className="px-4 pb-4 space-y-3">
                    <div className="p-4 bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm rounded-xl border border-purple-100 dark:border-purple-800/30">
                      <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
                        Currency
                      </label>
                      <select
                        value={currency}
                        onChange={(e) => handleCurrencyChange(e.target.value)}
                        className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                      >
                        <option value="INR">₹ INR - Indian Rupee</option>
                        <option value="USD">$ USD - US Dollar</option>
                        <option value="EUR">€ EUR - Euro</option>
                        <option value="GBP">£ GBP - British Pound</option>
                      </select>
                    </div>

                    <div className="p-4 bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm rounded-xl border border-purple-100 dark:border-purple-800/30">
                      <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
                        Low Balance Threshold
                      </label>
                      <input
                        type="number"
                        value={lowBalanceThreshold}
                        onChange={(e) => handleLowBalanceThresholdChange(e.target.value)}
                        min="0"
                        step="100"
                        className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                      />
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                        Set the balance amount that triggers a low balance alert.
                      </p>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          {/* Manage Categories */}
          <div className="rounded-2xl bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-900/10 dark:to-orange-900/10 border border-amber-100 dark:border-amber-800/30 overflow-hidden">
            <motion.button
              whileTap={{ scale: 0.99 }}
              onClick={() => setShowManageCategories(true)}
              className="w-full flex items-center justify-between p-4 hover:bg-amber-100/50 dark:hover:bg-amber-900/20 transition-all duration-200"
            >
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-gradient-to-br from-amber-500 to-orange-500 rounded-xl flex items-center justify-center shadow-lg shadow-amber-200 dark:shadow-amber-900/30">
                  <Tag className="w-5 h-5 text-white" />
                </div>
                <div className="text-left">
                  <span className="font-semibold text-gray-900 dark:text-white block">Manage Categories</span>
                  <span className="text-xs text-gray-500 dark:text-gray-400 font-normal">Create custom categories</span>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-amber-500" />
            </motion.button>
          </div>


          {/* Recurring Payments */}
          <div className="rounded-2xl bg-gradient-to-br from-indigo-50 to-blue-50 dark:from-indigo-900/10 dark:to-blue-900/10 border border-indigo-100 dark:border-indigo-800/30 overflow-hidden">
            <motion.button
              whileTap={{ scale: 0.99 }}
              onClick={() => setShowRecurringPayments(!showRecurringPayments)}
              className="w-full flex items-center justify-between p-4 hover:bg-indigo-100/50 dark:hover:bg-indigo-900/20 transition-all duration-200"
            >
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-blue-500 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-200 dark:shadow-indigo-900/30">
                  <Repeat className="w-5 h-5 text-white" />
                </div>
                <div className="text-left">
                  <span className="font-semibold text-gray-900 dark:text-white block">Recurring Payments</span>
                  <span className="text-xs text-gray-500 dark:text-gray-400 font-normal">{recurringRules.length} active rules</span>
                </div>
              </div>
              <motion.div
                animate={{ rotate: showRecurringPayments ? 180 : 0 }}
                transition={{ duration: 0.2 }}
              >
                <ChevronDown className="w-5 h-5 text-indigo-500" />
              </motion.div>
            </motion.button>

            <AnimatePresence>
              {showRecurringPayments && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
                  className="overflow-hidden"
                >
                  <div className="px-4 pb-4 space-y-3">
                    {showAddRule ? (
                      <AddRecurringRuleForm
                        initialData={editingRule}
                        onSave={handleAddRule}
                        onCancel={() => { setShowAddRule(false); setEditingRule(null); }}
                      />
                    ) : (
                      <>
                        <div className="p-4 bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm rounded-xl border border-indigo-100 dark:border-indigo-800/30">
                          <RecurringRulesList
                            rules={recurringRules}
                            onDelete={handleDeleteRule}
                            onToggleActive={handleToggleRuleActive}
                            onEdit={handleEditRule}
                          />
                        </div>
                        <button
                          onClick={() => setShowAddRule(true)}
                          className="w-full py-3 rounded-xl bg-white dark:bg-gray-800 border-2 border-dashed border-indigo-200 dark:border-indigo-800/50 text-indigo-600 dark:text-indigo-400 font-medium flex items-center justify-center space-x-2 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-all"
                        >
                          <Plus className="w-5 h-5" />
                          <span>Add New Rule</span>
                        </button>
                      </>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Notification Settings */}
          <div className="rounded-2xl bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-900/10 dark:to-cyan-900/10 border border-blue-100 dark:border-blue-800/30 overflow-hidden">
            <motion.button
              whileTap={{ scale: 0.99 }}
              onClick={() => setShowNotifications(!showNotifications)}
              className="w-full flex items-center justify-between p-4 hover:bg-blue-100/50 dark:hover:bg-blue-900/20 transition-all duration-200"
            >
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-xl flex items-center justify-center shadow-lg shadow-blue-200 dark:shadow-blue-900/30">
                  <Bell className="w-5 h-5 text-white" />
                </div>
                <span className="font-semibold text-gray-900 dark:text-white">Notification Settings</span>
              </div>
              <motion.div
                animate={{ rotate: showNotifications ? 180 : 0 }}
                transition={{ duration: 0.2 }}
              >
                <ChevronDown className="w-5 h-5 text-blue-500" />
              </motion.div>
            </motion.button>

            <AnimatePresence>
              {showNotifications && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
                  className="overflow-hidden"
                >
                  <div className="px-4 pb-4 space-y-3">
                    <div className="flex items-center justify-between p-4 bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm rounded-xl border border-blue-100 dark:border-blue-800/30">
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
                          <Bell className="w-4 h-4 text-blue-500" />
                        </div>
                        <div>
                          <p className="font-medium text-gray-900 dark:text-white">Push Notifications</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">Receive app notifications</p>
                        </div>
                      </div>
                      <button
                        onClick={toggleNotifications}
                        className={`relative inline-flex h-7 w-12 items-center rounded-full transition-all duration-300 shadow-inner ${notificationsEnabled ? 'bg-gradient-to-r from-blue-500 to-cyan-500 shadow-blue-200' : 'bg-gray-300 dark:bg-gray-600'
                          }`}
                      >
                        <motion.span
                          animate={{ x: notificationsEnabled ? 22 : 4 }}
                          transition={{ type: "spring", stiffness: 500, damping: 30 }}
                          className="inline-block h-5 w-5 rounded-full bg-white shadow-md"
                        />
                      </button>
                    </div>

                    <div className="flex items-center justify-between p-4 bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm rounded-xl border border-blue-100 dark:border-blue-800/30">
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
                          <Bell className="w-4 h-4 text-blue-500" />
                        </div>
                        <div className="flex-1">
                          <p className="font-medium text-gray-900 dark:text-white">Vibration Intensity</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">Haptic feedback strength</p>
                        </div>
                      </div>
                      <select
                        value={vibrationIntensity}
                        onChange={(e) => handleVibrationIntensityChange(e.target.value)}
                        className="px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-600 bg-white/80 dark:bg-gray-700 text-sm font-medium text-gray-700 dark:text-gray-200 focus:ring-2 focus:ring-blue-500 outline-none"
                      >
                        <option value="off">Off</option>
                        <option value="low">Low</option>
                        <option value="medium">Medium</option>
                        <option value="high">High</option>
                      </select>
                    </div>

                    <div className="flex justify-end p-2">
                      <button
                        onClick={async () => {
                          const { showLocalNotification } = await import('../utils/fcm');
                          showLocalNotification('🔔 Test Notification', {
                            body: 'This is a test notification with vibration! 📳',
                            icon: '/pwa-192x192.png'
                          });
                          showSuccessAnimation();
                        }}
                        className="text-xs text-blue-500 hover:text-blue-600 font-medium flex items-center gap-1"
                      >
                        <Bell className="w-3 h-3" /> Test Push
                      </button>
                    </div>

                    <div className="flex items-center justify-between p-4 bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm rounded-xl border border-blue-100 dark:border-blue-800/30">
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 bg-red-100 dark:bg-red-900/30 rounded-lg flex items-center justify-center">
                          <BellOff className="w-4 h-4 text-red-500" />
                        </div>
                        <div>
                          <p className="font-medium text-gray-900 dark:text-white">Low Balance Alerts</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">Alert when balance is low</p>
                        </div>
                      </div>
                      <button
                        onClick={toggleLowBalanceAlerts}
                        disabled={!notificationsEnabled}
                        className={`relative inline-flex h-7 w-12 items-center rounded-full transition-all duration-300 shadow-inner ${lowBalanceAlerts && notificationsEnabled ? 'bg-gradient-to-r from-blue-500 to-cyan-500 shadow-blue-200' : 'bg-gray-300 dark:bg-gray-600'
                          } disabled:opacity-50`}
                      >
                        <motion.span
                          animate={{ x: lowBalanceAlerts && notificationsEnabled ? 22 : 4 }}
                          transition={{ type: "spring", stiffness: 500, damping: 30 }}
                          className="inline-block h-5 w-5 rounded-full bg-white shadow-md"
                        />
                      </button>
                    </div>

                    <div className="flex items-center justify-between p-4 bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm rounded-xl border border-blue-100 dark:border-blue-800/30">
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center">
                          <Bell className="w-4 h-4 text-green-500" />
                        </div>
                        <div>
                          <p className="font-medium text-gray-900 dark:text-white">Budget Reminders</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">Monthly budget alerts</p>
                        </div>
                      </div>
                      <button
                        onClick={toggleBudgetReminders}
                        disabled={!notificationsEnabled}
                        className={`relative inline-flex h-7 w-12 items-center rounded-full transition-all duration-300 shadow-inner ${budgetReminders && notificationsEnabled ? 'bg-gradient-to-r from-blue-500 to-cyan-500 shadow-blue-200' : 'bg-gray-300 dark:bg-gray-600'
                          } disabled:opacity-50`}
                      >
                        <motion.span
                          animate={{ x: budgetReminders && notificationsEnabled ? 22 : 4 }}
                          transition={{ type: "spring", stiffness: 500, damping: 30 }}
                          className="inline-block h-5 w-5 rounded-full bg-white shadow-md"
                        />
                      </button>
                    </div>

                    {/* Daily Reminder */}
                    <div className="p-4 bg-gradient-to-br from-purple-100/80 to-blue-100/80 dark:from-purple-900/30 dark:to-blue-900/30 rounded-xl border border-purple-200/50 dark:border-purple-700/50">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center space-x-3">
                          <div className="w-8 h-8 bg-purple-200 dark:bg-purple-900/50 rounded-lg flex items-center justify-center">
                            <Clock className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                          </div>
                          <div>
                            <p className="font-medium text-gray-900 dark:text-white">Daily Reminder</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">Set daily expense tracking reminders</p>
                          </div>
                        </div>
                        <button
                          onClick={toggleDailyReminder}
                          disabled={!notificationsEnabled}
                          className={`relative inline-flex h-7 w-12 items-center rounded-full transition-all duration-300 shadow-inner ${dailyReminderEnabled && notificationsEnabled ? 'bg-gradient-to-r from-purple-500 to-blue-500 shadow-purple-200' : 'bg-gray-300 dark:bg-gray-600'
                            } disabled:opacity-50`}
                        >
                          <motion.span
                            animate={{ x: dailyReminderEnabled && notificationsEnabled ? 22 : 4 }}
                            transition={{ type: "spring", stiffness: 500, damping: 30 }}
                            className="inline-block h-5 w-5 rounded-full bg-white shadow-md"
                          />
                        </button>
                      </div>

                      <AnimatePresence>
                        {dailyReminderEnabled && notificationsEnabled && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
                            className="space-y-3 pt-3 border-t border-purple-200/50 dark:border-purple-700/50"
                          >
                            <div>
                              <label className="flex items-center space-x-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                <Calendar className="w-4 h-4" />
                                <span>Select Days</span>
                              </label>
                              <div className="flex flex-nowrap gap-1 justify-between w-full">
                                {daysOfWeek.map((day) => (
                                  <motion.button
                                    key={day.id}
                                    whileTap={{ scale: 0.95 }}
                                    onClick={() => toggleDay(day.id)}
                                    className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all duration-200 ${selectedDays.includes(day.id)
                                      ? 'bg-gradient-to-r from-purple-500 to-blue-500 text-white shadow-md'
                                      : 'bg-white/80 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-white dark:hover:bg-gray-600'
                                      }`}
                                  >
                                    {day.label}
                                  </motion.button>
                                ))}
                              </div>
                            </div>

                            <div>
                              <div className="flex items-center justify-between mb-2">
                                <label className="flex items-center space-x-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                                  <Clock className="w-4 h-4" />
                                  <span>Reminder Times</span>
                                </label>
                                <button
                                  onClick={toggleBiDailyReminder}
                                  className={`text-xs px-2 py-1 rounded transition-colors ${biDailyEnabled
                                    ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300 font-bold'
                                    : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400'}`}
                                >
                                  {biDailyEnabled ? 'Bi-Daily Active' : 'Enable 2nd Time'}
                                </button>
                              </div>

                              <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1">
                                  <span className="text-[10px] text-gray-500 dark:text-gray-400 uppercase tracking-wider font-semibold ml-1">
                                    {biDailyEnabled ? 'Time 1' : 'Daily Time'}
                                  </span>
                                  <input
                                    type="time"
                                    value={reminderTime}
                                    onChange={(e) => handleTimeChange(e.target.value)}
                                    className="w-full px-3 py-2.5 rounded-xl border border-purple-200 dark:border-purple-600 bg-white/80 dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                                  />
                                </div>

                                {biDailyEnabled && (
                                  <motion.div
                                    initial={{ opacity: 0, x: -10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    className="space-y-1"
                                  >
                                    <span className="text-[10px] text-gray-500 dark:text-gray-400 uppercase tracking-wider font-semibold ml-1">
                                      Time 2
                                    </span>
                                    <input
                                      type="time"
                                      value={reminderTime2}
                                      onChange={(e) => handleTime2Change(e.target.value)}
                                      className="w-full px-3 py-2.5 rounded-xl border border-purple-200 dark:border-purple-600 bg-white/80 dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                                    />
                                  </motion.div>
                                )}
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Privacy & Security */}
          <div className="rounded-2xl bg-gradient-to-br from-indigo-50 to-violet-50 dark:from-indigo-900/10 dark:to-violet-900/10 border border-indigo-100 dark:border-indigo-800/30 overflow-hidden">
            <motion.button
              whileTap={{ scale: 0.99 }}
              onClick={() => setShowPrivacySettings(!showPrivacySettings)}
              className="w-full flex items-center justify-between p-4 hover:bg-indigo-100/50 dark:hover:bg-indigo-900/20 transition-all duration-200"
            >
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-violet-500 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-200 dark:shadow-indigo-900/30">
                  <Shield className="w-5 h-5 text-white" />
                </div>
                <span className="font-semibold text-gray-900 dark:text-white">Privacy & Security</span>
              </div>
              <motion.div
                animate={{ rotate: showPrivacySettings ? 180 : 0 }}
                transition={{ duration: 0.2 }}
              >
                <ChevronDown className="w-5 h-5 text-indigo-500" />
              </motion.div>
            </motion.button>

            <AnimatePresence>
              {showPrivacySettings && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
                  className="overflow-hidden"
                >
                  <div className="px-4 pb-4 space-y-3">
                    <div className="flex items-center justify-between p-4 bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm rounded-xl border border-indigo-100 dark:border-indigo-800/30">
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 bg-purple-100 dark:bg-purple-900/30 rounded-lg flex items-center justify-center">
                          <Fingerprint className="w-4 h-4 text-purple-500" />
                        </div>
                        <div>
                          <p className="font-medium text-gray-900 dark:text-white">Biometric Lock</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">Secure app with fingerprint</p>
                        </div>
                      </div>
                      <button
                        onClick={toggleBiometric}
                        className={`relative inline-flex h-7 w-12 items-center rounded-full transition-all duration-300 shadow-inner ${biometricEnabled ? 'bg-gradient-to-r from-indigo-500 to-violet-500 shadow-indigo-200' : 'bg-gray-300 dark:bg-gray-600'
                          }`}
                      >
                        <motion.span
                          layout
                          transition={{ type: "spring", stiffness: 500, damping: 30 }}
                          className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-md ${biometricEnabled ? 'translate-x-6' : 'translate-x-1'
                            }`}
                        />
                      </button>
                    </div>

                    {/* Secret Vault */}
                    <motion.button
                      whileTap={{ scale: 0.98 }}
                      onClick={handleOpenVault}
                      className="w-full p-4 bg-gradient-to-br from-yellow-50 via-amber-50 to-orange-50 dark:from-yellow-900/20 dark:via-amber-900/20 dark:to-orange-900/20 hover:from-yellow-100 hover:via-amber-100 hover:to-orange-100 dark:hover:from-yellow-900/30 dark:hover:via-amber-900/30 dark:hover:to-orange-900/30 rounded-xl border border-yellow-300/50 dark:border-yellow-700/30 transition-all shadow-sm hover:shadow-md"
                    >
                      <div className="flex items-center space-x-3">
                        <div className="w-12 h-12 bg-gradient-to-br from-yellow-400 to-amber-600 rounded-xl flex items-center justify-center shadow-lg shadow-yellow-200 dark:shadow-yellow-900/30">
                          <Lock className="w-6 h-6 text-white" />
                        </div>
                        <div className="flex-1 text-left">
                          <p className="font-bold text-gray-900 dark:text-white">Secret Vault</p>
                          <p className="text-xs text-gray-600 dark:text-gray-400">
                            Store secret savings securely
                          </p>
                        </div>
                        <div className="text-amber-500">
                          <ChevronRight className="w-6 h-6" />
                        </div>
                      </div>
                    </motion.button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Data Management */}
          <div className="rounded-2xl bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/10 dark:to-emerald-900/10 border border-green-100 dark:border-green-800/30 overflow-hidden">
            <motion.button
              whileTap={{ scale: 0.99 }}
              onClick={() => setShowDataManagement(!showDataManagement)}
              className="w-full flex items-center justify-between p-4 hover:bg-green-100/50 dark:hover:bg-green-900/20 transition-all duration-200"
            >
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-emerald-500 rounded-xl flex items-center justify-center shadow-lg shadow-green-200 dark:shadow-green-900/30">
                  <Database className="w-5 h-5 text-white" />
                </div>
                <span className="font-semibold text-gray-900 dark:text-white">Data Management</span>
              </div>
              <motion.div
                animate={{ rotate: showDataManagement ? 180 : 0 }}
                transition={{ duration: 0.2 }}
              >
                <ChevronDown className="w-5 h-5 text-green-500" />
              </motion.div>
            </motion.button>

            <AnimatePresence>
              {showDataManagement && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
                  className="overflow-hidden"
                >
                  <div className="px-4 pb-4 space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <motion.button
                        whileTap={{ scale: 0.97 }}
                        onClick={handleExportData}
                        className="py-3 px-4 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white rounded-xl font-medium flex items-center justify-center space-x-2 transition-all shadow-lg shadow-green-200 dark:shadow-green-900/30"
                      >
                        <Download className="w-5 h-5" />
                        <span>JSON</span>
                      </motion.button>
                      <motion.button
                        whileTap={{ scale: 0.97 }}
                        onClick={handleExportCSV}
                        className="py-3 px-4 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white rounded-xl font-medium flex items-center justify-center space-x-2 transition-all shadow-lg shadow-emerald-200 dark:shadow-emerald-900/30"
                      >
                        <Download className="w-5 h-5" />
                        <span>CSV</span>
                      </motion.button>
                    </div>
                    <motion.button
                      whileTap={{ scale: 0.98 }}
                      onClick={handleImportData}
                      className="w-full py-3 px-4 bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white rounded-xl font-medium flex items-center justify-center space-x-2 transition-all shadow-lg shadow-blue-200 dark:shadow-blue-900/30"
                    >
                      <Upload className="w-5 h-5" />
                      <span>Import Data</span>
                    </motion.button>
                    <motion.button
                      whileTap={{ scale: 0.98 }}
                      onClick={handleClearAllData}
                      className="w-full py-3 px-4 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white rounded-xl font-medium flex items-center justify-center space-x-2 transition-all shadow-lg shadow-orange-200 dark:shadow-orange-900/30"
                    >
                      <Trash2 className="w-5 h-5" />
                      <span>Clear All Data</span>
                    </motion.button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Account Settings */}
          <div className="rounded-2xl bg-gradient-to-br from-red-50 to-rose-50 dark:from-red-900/10 dark:to-rose-900/10 border border-red-100 dark:border-red-800/30 overflow-hidden">
            <motion.button
              whileTap={{ scale: 0.99 }}
              onClick={() => setShowAccountSettings(!showAccountSettings)}
              className="w-full flex items-center justify-between p-4 hover:bg-red-100/50 dark:hover:bg-red-900/20 transition-all duration-200"
            >
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-gradient-to-br from-red-500 to-rose-500 rounded-xl flex items-center justify-center shadow-lg shadow-red-200 dark:shadow-red-900/30">
                  <User className="w-5 h-5 text-white" />
                </div>
                <span className="font-semibold text-gray-900 dark:text-white">Account Settings</span>
              </div>
              <motion.div
                animate={{ rotate: showAccountSettings ? 180 : 0 }}
                transition={{ duration: 0.2 }}
              >
                <ChevronDown className="w-5 h-5 text-red-500" />
              </motion.div>
            </motion.button>

            <AnimatePresence>
              {showAccountSettings && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
                  className="overflow-hidden"
                >
                  <div className="px-4 pb-4 space-y-3">
                    <motion.button
                      whileTap={{ scale: 0.98 }}
                      onClick={handleDeleteAccount}
                      className="w-full py-3 px-4 bg-gradient-to-r from-red-500 to-rose-500 hover:from-red-600 hover:to-rose-600 text-white rounded-xl font-medium flex items-center justify-center space-x-2 transition-all shadow-lg shadow-red-200 dark:shadow-red-900/30"
                    >
                      <Trash2 className="w-5 h-5" />
                      <span>Delete Account</span>
                    </motion.button>
                    <motion.button
                      whileTap={{ scale: 0.98 }}
                      onClick={handleLogout}
                      className="w-full py-3 px-4 bg-gradient-to-r from-gray-600 to-gray-700 hover:from-gray-700 hover:to-gray-800 text-white rounded-xl font-medium flex items-center justify-center space-x-2 transition-all shadow-lg shadow-gray-300 dark:shadow-gray-900/30"
                    >
                      <LogOut className="w-5 h-5" />
                      <span>Logout</span>
                    </motion.button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Help & Feedback */}
          <motion.button
            whileTap={{ scale: 0.98 }}
            onClick={handleHelpFeedback}
            className="w-full p-4 bg-gradient-to-r from-purple-500 via-violet-500 to-indigo-500 hover:from-purple-600 hover:via-violet-600 hover:to-indigo-600 text-white rounded-2xl flex items-center justify-center space-x-3 transition-all shadow-lg shadow-purple-200 dark:shadow-purple-900/30"
          >
            <MessageCircle className="w-5 h-5" />
            <span className="font-semibold">Help & Feedback</span>
            <HelpCircle className="w-5 h-5" />
          </motion.button>

          {/* Version Info */}
          <div className="text-center pt-2 pb-2">
            <div className="inline-flex items-center px-4 py-2 bg-gray-100/80 dark:bg-gray-700/50 rounded-full">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                <span className="font-semibold">MyXpense</span> v2.04.1.26 •
                <a
                  href="https://instagram.com/ianshul.yadav"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-500 hover:text-blue-600 transition-colors ml-1 font-medium"
                >
                  UnshooTech.dev
                </a>
              </p>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Edit Name Modal */}
      <EditNameModal
        isOpen={showEditName}
        onClose={() => setShowEditName(false)}
        currentName={userName}
        onSave={handleSaveName}
      />

      {/* Secret Vault Modals */}
      {vaultMode === 'setup' && (
        <SecretVaultSetup
          onComplete={handleVaultSetupComplete}
          onCancel={() => setVaultMode('none')}
        />
      )}

      {vaultMode === 'pin-entry' && vaultData && (
        <SecretVaultPINEntry
          pinHash={vaultData.pinHash}
          pinSalt={vaultData.pinSalt}
          onSuccess={handleVaultPINSuccess}
          onCancel={() => setVaultMode('none')}
          onForgotPIN={() => setVaultMode('forgot-pin')}
        />
      )}

      {vaultMode === 'dashboard' && (
        <SecretVaultDashboard
          vaultBalance={vaultBalance}
          vaultHistory={vaultHistory}
          totalBalance={currentBalance}
          onAddMoney={handleVaultAddMoney}
          onWithdrawMoney={handleVaultWithdrawMoney}
          onClose={handleVaultClose}
        />
      )}

      {vaultMode === 'forgot-pin' && vaultData && (
        <SecretVaultForgotPIN
          secretQuestion={vaultData.secretQuestion}
          secretAnswerHash={vaultData.secretAnswerHash}
          currentPinSalt={vaultData.pinSalt}
          secretAnswerSalt={vaultData.secretAnswerSalt}
          onResetComplete={handleResetPIN}
          onCancel={() => setVaultMode('none')}
        />
      )}

      {/* User Manual Modal */}
      {showUserManual && createPortal(
        <div className="fixed inset-0 z-[9999] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowUserManual(false)}>
          <div className="w-full max-w-4xl max-h-[90vh] bg-white dark:bg-gray-900 rounded-2xl shadow-2xl overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
            <UserManual />
            <button
              onClick={() => setShowUserManual(false)}
              className="absolute top-6 right-6 z-[10000] p-3 bg-white dark:bg-gray-800 rounded-full shadow-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              <X className="w-5 h-5 text-gray-600 dark:text-gray-300" />
            </button>
          </div>
        </div>,
        document.body
      )}
      {/* Deleting Data Loading Overlay */}
      <AnimatePresence>
        {isDeletingData && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-xl flex flex-col items-center max-w-sm mx-4 text-center"
            >
              <div className="w-16 h-16 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mb-4" />
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Deleting Data...</h3>
              <p className="text-gray-500 dark:text-gray-400">
                Please wait while we securely remove your information from all databases.
              </p>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {showUpdateAnimation && (
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-[60]">
          <div className="bg-black/70 backdrop-blur-md text-white px-6 py-4 rounded-full shadow-xl flex items-center space-x-3">
            <Check className="w-6 h-6 text-green-400" />
            <span className="font-medium">Settings Updated</span>
          </div>
        </div>
      )}
      {/* Manage Categories Modal */}
      <ManageCategoriesModal isOpen={showManageCategories} onClose={() => setShowManageCategories(false)} />

    </div>
  );
};

export default memo(ProfileSettingsModal);
