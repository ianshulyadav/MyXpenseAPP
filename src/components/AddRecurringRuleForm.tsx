import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import type { RecurringRule } from '../types';
import { useCategories } from '../hooks/useCategories';

interface AddRecurringRuleFormProps {
    initialData?: RecurringRule | null;
    onSave: (rule: Omit<RecurringRule, 'id' | 'createdAt' | 'updatedAt' | 'userId' | 'lastGeneratedDate'> & { id?: string }) => void;
    onCancel: () => void;
}

const AddRecurringRuleForm = ({ initialData, onSave, onCancel }: AddRecurringRuleFormProps) => {
    const { categories } = useCategories();
    const [title, setTitle] = useState(initialData?.title || '');
    const [amount, setAmount] = useState(initialData?.baseAmount.toString() || '');
    const [category, setCategory] = useState(initialData?.category || 'bills');
    const [activeDays, setActiveDays] = useState<number[]>(initialData?.activeDays || [0, 1, 2, 3, 4, 5, 6]); // Default daily
    const [frequencyMode, setFrequencyMode] = useState<'daily' | 'weekdays' | 'custom'>(
        initialData
            ? (initialData.activeDays.length === 7 ? 'daily' :
                (initialData.activeDays.length === 5 && !initialData.activeDays.includes(0) && !initialData.activeDays.includes(6)) ? 'weekdays' : 'custom')
            : 'daily'
    );

    const days = [
        { id: 1, label: 'M', full: 'Mon' },
        { id: 2, label: 'T', full: 'Tue' },
        { id: 3, label: 'W', full: 'Wed' },
        { id: 4, label: 'T', full: 'Thu' },
        { id: 5, label: 'F', full: 'Fri' },
        { id: 6, label: 'S', full: 'Sat' },
        { id: 0, label: 'S', full: 'Sun' },
    ];

    useEffect(() => {
        if (frequencyMode === 'daily') {
            setActiveDays([0, 1, 2, 3, 4, 5, 6]);
        } else if (frequencyMode === 'weekdays') {
            setActiveDays([1, 2, 3, 4, 5]);
        }
    }, [frequencyMode]);

    const toggleDay = (dayId: number) => {
        if (frequencyMode !== 'custom') setFrequencyMode('custom');

        if (activeDays.includes(dayId)) {
            setActiveDays(activeDays.filter(d => d !== dayId));
        } else {
            setActiveDays([...activeDays, dayId].sort());
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!title || !amount || activeDays.length === 0) return;

        onSave({
            id: initialData?.id,
            title,
            baseAmount: parseFloat(amount),
            category,
            activeDays,
            isActive: initialData ? initialData.isActive : true
        });
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4 bg-gray-50 dark:bg-gray-800/50 p-4 rounded-xl border border-gray-200 dark:border-gray-700">
            <div className="flex justify-between items-center mb-2">
                <h3 className="font-semibold text-gray-900 dark:text-white">
                    {initialData ? 'Edit Rule' : 'New Recurring Payment'}
                </h3>
                <button type="button" onClick={onCancel} className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
                    <X className="w-5 h-5" />
                </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
                <div>
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-400 mb-1">Title</label>
                    <input
                        type="text"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder="e.g., Daily Commute"
                        className="w-full px-3 py-2 rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                        required
                    />
                </div>
                <div>
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-400 mb-1">Amount (₹)</label>
                    <input
                        type="number"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        placeholder="0.00"
                        className="w-full px-3 py-2 rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                        required
                    />
                </div>
            </div>

            <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-400 mb-1">Category</label>
                <div className="flex flex-wrap gap-2">
                    {categories.map(cat => (
                        <button
                            key={cat.id}
                            type="button"
                            onClick={() => setCategory(cat.id)}
                            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${category === cat.id
                                ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300 ring-2 ring-blue-500 ring-offset-1 dark:ring-offset-gray-900'
                                : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'
                                }`}
                        >
                            {cat.name}
                        </button>
                    ))}
                </div>
            </div>

            <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-400 mb-2">Frequency</label>
                <div className="flex space-x-2 mb-3">
                    {(['daily', 'weekdays', 'custom'] as const).map(mode => (
                        <button
                            key={mode}
                            type="button"
                            onClick={() => setFrequencyMode(mode)}
                            className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition-colors ${frequencyMode === mode
                                ? 'bg-blue-600 text-white shadow-md'
                                : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700'
                                }`}
                        >
                            {mode.charAt(0).toUpperCase() + mode.slice(1)}
                        </button>
                    ))}
                </div>

                <div className="flex justify-between bg-white dark:bg-gray-900 p-2 rounded-lg border border-gray-200 dark:border-gray-700">
                    {days.map(day => (
                        <button
                            key={day.id}
                            type="button"
                            onClick={() => toggleDay(day.id)}
                            className={`w-8 h-8 rounded-full text-xs font-bold flex items-center justify-center transition-all ${activeDays.includes(day.id)
                                ? 'bg-blue-500 text-white shadow-sm scale-110'
                                : 'text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                                }`}
                            title={day.full}
                        >
                            {day.label}
                        </button>
                    ))}
                </div>
            </div>

            <div className="flex space-x-3 pt-2">
                <button
                    type="button"
                    onClick={onCancel}
                    className="flex-1 px-4 py-2 rounded-xl text-gray-600 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                    Cancel
                </button>
                <button
                    type="submit"
                    className="flex-1 px-4 py-2 rounded-xl text-white bg-gradient-to-r from-blue-600 to-blue-700 font-medium hover:from-blue-700 hover:to-blue-800 shadow-lg shadow-blue-500/30 transition-all"
                >
                    {initialData ? 'Update Rule' : 'Save Rule'}
                </button>
            </div>
        </form>
    );
};

export default AddRecurringRuleForm;
