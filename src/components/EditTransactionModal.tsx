import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { X, Save, Trash2, Calendar, DollarSign, Tag, FileText, User } from 'lucide-react';
import { useTransactions } from '../hooks/useFirestoreSync';
import { useCategories } from '../hooks/useCategories';
import type { Transaction } from '../types';

interface EditTransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  transaction: Transaction;
}

// Categories are now loaded dynamically via useCategories hook

export const EditTransactionModal = ({ isOpen, onClose, transaction }: EditTransactionModalProps) => {
  const { removeTransaction, updateTransaction } = useTransactions();
  const { categories } = useCategories();
  const [amount, setAmount] = useState(transaction.amount.toString());
  const [category, setCategory] = useState(transaction.category);
  const [date, setDate] = useState(
    new Date(transaction.date).toISOString().split('T')[0]
  );
  const [description, setDescription] = useState(transaction.description || '');
  const [personName, setPersonName] = useState('');

  const [isSaving, setIsSaving] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const isDebt = transaction.type === 'debt';

  useEffect(() => {
    if (transaction) {
      setAmount(transaction.amount.toString());
      setCategory(transaction.category);
      setDate(new Date(transaction.date).toISOString().split('T')[0]);
      setDescription(transaction.description || '');

      if (transaction.type === 'debt') {
        if (transaction.debtType === 'lent') {
          setPersonName(transaction.borrowerName || '');
        } else if (transaction.debtType === 'borrowed') {
          setPersonName(transaction.lenderName || '');
        }
      }
    }
  }, [transaction]);

  if (!isOpen) return null;

  const handleSave = async () => {
    if (!amount || parseFloat(amount) <= 0) {
      alert('Please enter a valid amount');
      return;
    }

    setIsSaving(true);
    try {
      const updates: any = {
        amount: parseFloat(amount),
        category,
        date: new Date(date),
        description: description.trim()
      };

      if (isDebt) {
        if (transaction.debtType === 'lent') {
          updates.borrowerName = personName;
          if (!description) updates.description = `Lent to ${personName}`;
        } else if (transaction.debtType === 'borrowed') {
          updates.lenderName = personName;
          if (!description) updates.description = `Borrowed from ${personName}`;
        }
      }

      await updateTransaction(transaction.id, updates);

      onClose();
    } catch (error) {
      console.error('Error updating transaction:', error);
      alert('Failed to update transaction. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!showDeleteConfirm) {
      setShowDeleteConfirm(true);
      return;
    }

    try {
      await removeTransaction(transaction.id);
      onClose();
    } catch (error) {
      console.error('Error deleting transaction:', error);
      alert('Failed to delete transaction. Please try again.');
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-end sm:items-center justify-center"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: '100%', opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: '100%', opacity: 0 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="bg-white dark:bg-gray-800 rounded-t-3xl sm:rounded-3xl w-full sm:max-w-md max-h-[85vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-4 flex items-center justify-between z-10">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Edit {isDebt ? 'Debt' : 'Transaction'}</h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <X className="w-5 h-5 text-gray-600 dark:text-gray-300" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Amount */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              <DollarSign className="w-4 h-4 inline mr-1" />
              Amount
            </label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              step="0.01"
              min="0"
              className="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            />
          </div>

          {/* Person Name (Debt Only) */}
          {isDebt && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                <User className="w-4 h-4 inline mr-1" />
                {transaction.debtType === 'lent' ? 'Borrower Name' : 'Lender Name'}
              </label>
              <input
                type="text"
                value={personName}
                onChange={(e) => setPersonName(e.target.value)}
                placeholder="John Doe"
                className="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              />
            </div>
          )}

          {/* Category (Hide for Debt or make readonly? Let's hide if Debt, as logic implies it's always Debt) */}
          {!isDebt && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                <Tag className="w-4 h-4 inline mr-1" />
                Category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              >
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              <Calendar className="w-4 h-4 inline mr-1" />
              Date
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              max={new Date().toISOString().split('T')[0]}
              className="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            />
          </div>

          {/* Description/Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              <FileText className="w-4 h-4 inline mr-1" />
              Description / Notes
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add description..."
              rows={3}
              className="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all resize-none"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleDelete}
              className={`flex-shrink-0 px-6 py-3 rounded-xl font-semibold transition-all shadow-md ${showDeleteConfirm
                ? 'bg-red-500 text-white hover:bg-red-600'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
            >
              <Trash2 className="w-5 h-5 inline mr-2" />
              {showDeleteConfirm ? 'Confirm Delete' : 'Delete'}
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleSave}
              disabled={isSaving}
              className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white rounded-xl font-semibold shadow-md transition-all disabled:opacity-50"
            >
              <Save className="w-5 h-5 inline mr-2" />
              {isSaving ? 'Saving...' : 'Save Changes'}
            </motion.button>
          </div>

          {showDeleteConfirm && (
            <p className="text-xs text-red-600 dark:text-red-400 text-center">
              Click "Confirm Delete" again to permanently delete this transaction
            </p>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
};
