import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Save } from 'lucide-react';
import { useAccounts, type Account } from '../hooks/useAccounts';

interface ManageAccountsModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const ManageAccountsModal = ({ isOpen, onClose }: ManageAccountsModalProps) => {
    const { accounts, updateAccount } = useAccounts();
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editBalance, setEditBalance] = useState('');
    const [editName, setEditName] = useState('');
    const [saved, setSaved] = useState(false);

    if (!isOpen) return null;

    const startEdit = (acc: Account) => {
        setEditingId(acc.id);
        setEditBalance(acc.initialBalance.toString());
        setEditName(acc.name);
    };

    const handleSave = (id: string) => {
        const balance = parseFloat(editBalance) || 0;
        updateAccount(id, {
            initialBalance: Math.round(balance * 100) / 100,
            name: editName.trim() || accounts.find(a => a.id === id)?.name || '',
        });
        setEditingId(null);
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
    };

    const totalInitial = accounts.reduce((sum, a) => sum + (a.initialBalance || 0), 0);

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-[120] flex items-end sm:items-center justify-center p-0 sm:p-6">
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 bg-black/60 backdrop-blur-sm"
                    onClick={onClose}
                />
                <motion.div
                    initial={{ y: '100%', opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: '100%', opacity: 0 }}
                    transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                    className="relative w-full max-w-md bg-white dark:bg-gray-900 rounded-t-3xl sm:rounded-3xl shadow-xl overflow-hidden"
                >
                    {/* Header */}
                    <div className="p-5 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center">
                        <div>
                            <h3 className="text-xl font-bold text-gray-900 dark:text-white">Manage Accounts</h3>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Set initial balances for your accounts</p>
                        </div>
                        <button onClick={onClose} className="p-2 bg-gray-100 dark:bg-gray-800 rounded-full">
                            <X className="w-5 h-5 text-gray-500" />
                        </button>
                    </div>

                    <div className="p-5 space-y-4">
                        {/* Info Box */}
                        <div className="bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-800 rounded-xl p-3">
                            <p className="text-xs text-blue-700 dark:text-blue-300">
                                💡 Initial balances represent your starting balance in each account. They are <strong>not</strong> counted as income transactions.
                            </p>
                        </div>

                        {/* Account Cards */}
                        <div className="space-y-3">
                            {accounts.map(acc => (
                                <motion.div
                                    key={acc.id}
                                    layout
                                    className="bg-gray-50 dark:bg-gray-800 rounded-2xl p-4"
                                >
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className={`w-12 h-12 rounded-xl ${acc.color} flex items-center justify-center text-2xl`}>
                                                {acc.icon}
                                            </div>
                                            <div>
                                                {editingId === acc.id ? (
                                                    <input
                                                        value={editName}
                                                        onChange={e => setEditName(e.target.value)}
                                                        className="font-semibold text-gray-900 dark:text-white text-sm bg-transparent border-b border-blue-400 outline-none w-24"
                                                    />
                                                ) : (
                                                    <p className="font-semibold text-gray-900 dark:text-white text-sm">{acc.name}</p>
                                                )}
                                                <p className="text-xs text-gray-500 dark:text-gray-400 capitalize">{acc.type} account</p>
                                            </div>
                                        </div>

                                        {editingId === acc.id ? (
                                            <div className="flex items-center gap-2">
                                                <div className="relative">
                                                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-500 text-sm">₹</span>
                                                    <input
                                                        type="number"
                                                        value={editBalance}
                                                        onChange={e => setEditBalance(e.target.value)}
                                                        className="w-28 pl-6 pr-2 py-2 text-sm font-bold rounded-lg border border-blue-300 dark:border-blue-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-right"
                                                        step="0.01"
                                                        autoFocus
                                                    />
                                                </div>
                                                <button
                                                    onClick={() => handleSave(acc.id)}
                                                    className="p-2 bg-blue-500 rounded-lg text-white"
                                                >
                                                    <Save className="w-4 h-4" />
                                                </button>
                                            </div>
                                        ) : (
                                            <button
                                                onClick={() => startEdit(acc)}
                                                className="text-right group"
                                            >
                                                <p className="font-bold text-gray-900 dark:text-white">
                                                    ₹{(acc.initialBalance || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                                </p>
                                                <p className="text-[10px] text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity">tap to edit</p>
                                            </button>
                                        )}
                                    </div>
                                </motion.div>
                            ))}
                        </div>

                        {/* Total */}
                        <div className="bg-gradient-to-r from-blue-500 to-indigo-600 rounded-2xl p-4 flex justify-between items-center">
                            <p className="text-white/80 text-sm font-medium">Total Initial Balance</p>
                            <p className="text-white font-bold text-lg">
                                ₹{totalInitial.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </p>
                        </div>

                        {/* Success toast */}
                        <AnimatePresence>
                            {saved && (
                                <motion.div
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -10 }}
                                    className="text-center text-sm text-green-600 dark:text-green-400 font-medium"
                                >
                                    ✓ Account updated successfully
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
};

export default ManageAccountsModal;
