import { useState, useRef, useEffect } from 'react';
import { X, Minus, Plus, Camera, Image as ImageIcon, ChevronLeft } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import imageCompression from 'browser-image-compression';
import { useTransactions } from '../hooks/useFirestoreSync';
import { useAuth } from '../context/AuthContext';
import { useCategories } from '../hooks/useCategories';
import { getIconUrl } from '../data/categoryIcons';

interface AddTransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  type?: 'expense' | 'income';
  onTransactionAdded?: () => void;
}

// Categories are now loaded dynamically via useCategories hook

const AddTransactionModal = ({ isOpen, onClose, type: initialType = 'expense', onTransactionAdded }: AddTransactionModalProps) => {
  const { currentUser } = useAuth();
  const { addTransaction } = useTransactions();
  const { categories } = useCategories();
  const [transactionType, setTransactionType] = useState<'expense' | 'income'>(initialType);
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('');
  const [incomeSource, setIncomeSource] = useState('Pocket Money');
  const [description, setDescription] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [receiptImage, setReceiptImage] = useState<string | null>(null);
  const [isCompressing, setIsCompressing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedTime, setSelectedTime] = useState(new Date().toTimeString().slice(0, 5));
  const [showCustomCategories, setShowCustomCategories] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const amountInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      // Reset to current time whenever modal is opened
      const now = new Date();
      setSelectedDate(now.toISOString().split('T')[0]);
      setSelectedTime(now.toTimeString().slice(0, 5));
      if (amountInputRef.current) {
        setTimeout(() => amountInputRef.current?.focus(), 100);
      }
    }
  }, [isOpen]);

  useEffect(() => {
    setTransactionType(initialType);
  }, [initialType]);

  if (!isOpen) return null;

  const validateForm = () => {
    const newErrors: { [key: string]: string } = {};

    if (!amount || parseFloat(amount) <= 0) {
      newErrors.amount = 'Please enter a valid amount';
    }

    if (transactionType === 'expense' && !category) {
      newErrors.category = 'Please select a category';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleImageCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsCompressing(true);
    try {
      const options = {
        maxSizeMB: 0.2,
        maxWidthOrHeight: 800,
        useWebWorker: true,
        initialQuality: 0.7
      };

      const compressedFile = await imageCompression(file, options);
      const reader = new FileReader();

      reader.onloadend = () => {
        setReceiptImage(reader.result as string);
        setIsCompressing(false);
      };

      reader.readAsDataURL(compressedFile);
    } catch (error) {
      console.error('Error compressing image:', error);
      setIsCompressing(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isSubmitting) return;

    if (!validateForm()) return;

    if (!currentUser) {
      alert('Please sign in to add transactions');
      return;
    }

    setIsSubmitting(true);

    const now = new Date();
    const dateTime = new Date(`${selectedDate}T${selectedTime}`);

    const transaction: any = {
      id: `tx_${Date.now()}`,
      userId: currentUser.uid,
      type: transactionType,
      amount: parseFloat(amount),
      category: transactionType === 'income' ? incomeSource : category,
      description: description || '',
      paymentMethod: paymentMethod || 'Cash',
      date: dateTime, // Combined Date + Time
      createdAt: now,
      updatedAt: now,
    };

    if (receiptImage) {
      transaction.receiptUrl = receiptImage;
    }

    console.log('[AddTransactionModal] Transaction data prepared:', {
      id: transaction.id,
      userId: transaction.userId,
      type: transaction.type,
      amount: transaction.amount,
      category: transaction.category,
      description: transaction.description,
      paymentMethod: transaction.paymentMethod,
      date: transaction.date.toISOString(),
      hasReceiptUrl: !!transaction.receiptUrl
    });

    // Don't await - fire and forget for instant UI
    addTransaction(transaction).catch(error => {
      console.error('[AddTransactionModal] Error adding transaction:', error);
      // Transaction is still saved locally, just couldn't sync to cloud
    });

    // Reset form immediately
    setAmount('');
    setCategory('');
    setIncomeSource('Pocket Money');
    setDescription('');
    setPaymentMethod('Cash');
    setReceiptImage(null);
    setErrors({});
    setSelectedDate(new Date().toISOString().split('T')[0]);
    setSelectedTime(new Date().toTimeString().slice(0, 5));
    setIsSubmitting(false);

    // Call the callback to update parent state BEFORE closing
    if (onTransactionAdded) {
      onTransactionAdded();
    }

    // Close modal immediately
    onClose();
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center"
    >
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose}></div>
      <motion.div
        initial={{ y: '100%', opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: '100%', opacity: 0 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="relative bg-white dark:bg-gray-800 rounded-t-3xl sm:rounded-3xl w-full sm:max-w-md max-h-[85vh] overflow-y-auto"
      >
        <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-4 flex items-center justify-between z-10">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            Add {transactionType === 'expense' ? 'Expense' : 'Income'}
          </h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
            <X className="w-5 h-5 text-gray-600 dark:text-gray-300" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {/* Type Toggle */}
          <div className="flex space-x-2">
            <motion.button
              whileTap={{ scale: 0.95 }}
              type="button"
              onClick={() => setTransactionType('expense')}
              className={`flex-1 py-3 px-4 rounded-xl font-medium flex items-center justify-center space-x-2 transition-colors ${transactionType === 'expense'
                ? 'bg-blue-500 text-white'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
                }`}
            >
              <Minus className="w-5 h-5" />
              <span>Expense</span>
            </motion.button>
            <motion.button
              whileTap={{ scale: 0.95 }}
              type="button"
              onClick={() => setTransactionType('income')}
              className={`flex-1 py-3 px-4 rounded-xl font-medium flex items-center justify-center space-x-2 transition-colors ${transactionType === 'income'
                ? 'bg-blue-500 text-white'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
                }`}
            >
              <Plus className="w-5 h-5" />
              <span>Income</span>
            </motion.button>
          </div>

          {/* Amount */}
          <div>
            <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
              Amount <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500">₹</span>
              <input
                ref={amountInputRef}
                type="number"
                value={amount}
                onChange={(e) => {
                  setAmount(e.target.value);
                  if (errors.amount) {
                    setErrors({ ...errors, amount: '' });
                  }
                }}
                className={`w-full pl-10 pr-4 py-3 border rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-colors ${errors.amount ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
                  }`}
                placeholder="Enter amount"
                step="0.01"
                min="0"
              />
            </div>
            {errors.amount && <p className="mt-1 text-sm text-red-500">{errors.amount}</p>}
          </div>

          {/* Category or Income Source */}
          {transactionType === 'expense' ? (
            <div>
              <label className="block text-sm font-medium text-gray-900 dark:text-white mb-3">
                Category <span className="text-red-500">*</span>
              </label>
              {/* Default categories grid */}
              <div className="grid grid-cols-4 gap-2">
                {categories.filter(c => c.isDefault).map((cat) => {
                  const Icon = cat.icon;
                  const isOther = cat.id === 'other';
                  const customCats = categories.filter(c => !c.isDefault);
                  const isOtherActive = category === 'other' || (!cat.isDefault && customCats.some(cc => cc.id === category));
                  return (
                    <motion.button
                      whileTap={{ scale: 0.95 }}
                      key={cat.id}
                      type="button"
                      onClick={() => {
                        if (isOther && customCats.length > 0) {
                          setShowCustomCategories(!showCustomCategories);
                          // Don't auto-select 'other' if there are custom categories
                        } else {
                          setCategory(cat.id);
                          setShowCustomCategories(false);
                        }
                        if (errors.category) {
                          setErrors({ ...errors, category: '' });
                        }
                      }}
                      className={`flex flex-col items-center p-3 rounded-xl border-2 transition-all ${isOther
                          ? (showCustomCategories || isOtherActive
                            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                            : 'border-gray-200 dark:border-gray-700')
                          : (category === cat.id
                            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                            : 'border-gray-200 dark:border-gray-700')
                        }`}
                    >
                      <div className={`w-12 h-12 rounded-xl ${cat.color} flex items-center justify-center mb-2 overflow-hidden`}>
                        {Icon ? <Icon className="w-6 h-6" /> : <span className="text-lg">📂</span>}
                      </div>
                      <span className="text-xs font-medium text-gray-900 dark:text-white text-center">{cat.name}</span>
                    </motion.button>
                  );
                })}
              </div>

              {/* Custom categories expandable panel */}
              <AnimatePresence>
                {showCustomCategories && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
                    className="overflow-hidden"
                  >
                    <div className="mt-3 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-200 dark:border-gray-700">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setShowCustomCategories(false)}
                            className="p-1 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700"
                          >
                            <ChevronLeft className="w-4 h-4 text-gray-500" />
                          </button>
                          <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Custom Categories</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setCategory('other');
                            setShowCustomCategories(false);
                            if (errors.category) setErrors({ ...errors, category: '' });
                          }}
                          className={`text-xs px-2.5 py-1 rounded-full font-medium transition-colors ${category === 'other'
                              ? 'bg-blue-500 text-white'
                              : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-300 dark:hover:bg-gray-600'
                            }`}
                        >
                          Other
                        </button>
                      </div>
                      {categories.filter(c => !c.isDefault).length === 0 ? (
                        <p className="text-xs text-gray-400 text-center py-3">No custom categories. Create them in Profile → Manage Categories.</p>
                      ) : (
                        <div className="grid grid-cols-4 gap-2">
                          {categories.filter(c => !c.isDefault).map((cat) => (
                            <motion.button
                              whileTap={{ scale: 0.95 }}
                              key={cat.id}
                              type="button"
                              onClick={() => {
                                setCategory(cat.id);
                                setShowCustomCategories(false);
                                if (errors.category) setErrors({ ...errors, category: '' });
                              }}
                              className={`flex flex-col items-center p-2.5 rounded-xl border-2 transition-all ${category === cat.id
                                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                                : 'border-transparent hover:border-gray-300 dark:hover:border-gray-600'
                                }`}
                            >
                              <div className={`w-10 h-10 rounded-xl ${cat.color} flex items-center justify-center mb-1.5 overflow-hidden`}>
                                {cat.iconType === 'asset' && cat.iconAsset ? (
                                  <img src={getIconUrl(cat.iconAsset)} alt="" className="w-6 h-6 object-contain" />
                                ) : cat.iconType === 'emoji' && cat.iconEmoji ? (
                                  <span className="text-lg">{cat.iconEmoji}</span>
                                ) : (
                                  <span className="text-sm">📂</span>
                                )}
                              </div>
                              <span className="text-[10px] font-medium text-gray-700 dark:text-gray-300 text-center leading-tight">{cat.name}</span>
                            </motion.button>
                          ))}
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
              {errors.category && <p className="mt-2 text-sm text-red-500">{errors.category}</p>}
            </div>
          ) : (
            <div>
              <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">Income Source</label>
              <select
                value={incomeSource}
                onChange={(e) => setIncomeSource(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option>Pocket Money</option>
                <option>Salary</option>
                <option>Freelance</option>
                <option>Investment</option>
                <option>Gift</option>
                <option>Parents</option>
                <option>Relatives</option>
                <option>Other</option>
              </select>
            </div>
          )}

          {/* Date & Time */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">Date</label>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                max={new Date().toISOString().split('T')[0]}
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">Time</label>
              <input
                type="time"
                value={selectedTime}
                onChange={(e) => setSelectedTime(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">Description</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              placeholder="Enter description (optional)"
            />
          </div>

          {/* Payment Method */}
          <div>
            <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">Payment Method</label>
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option>Cash</option>
              <option>UPI</option>
              <option>Bank Acc</option>
            </select>
          </div>

          {/* Receipt Upload */}
          <div>
            <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">Receipt (Optional)</label>
            <div className="space-y-3">
              {receiptImage ? (
                <div className="relative rounded-xl overflow-hidden">
                  <img src={receiptImage} alt="Receipt" className="w-full h-48 object-cover" />
                  <button
                    type="button"
                    onClick={() => setReceiptImage(null)}
                    className="absolute top-2 right-2 p-2 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isCompressing}
                    className="flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl hover:border-blue-500 dark:hover:border-blue-500 transition-colors disabled:opacity-50"
                  >
                    <Camera className="w-5 h-5 text-gray-600 dark:text-gray-300" />
                    <span className="text-sm font-medium text-gray-600 dark:text-gray-300">
                      {isCompressing ? 'Processing...' : 'Camera'}
                    </span>
                  </motion.button>
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isCompressing}
                    className="flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl hover:border-blue-500 dark:hover:border-blue-500 transition-colors disabled:opacity-50"
                  >
                    <ImageIcon className="w-5 h-5 text-gray-600 dark:text-gray-300" />
                    <span className="text-sm font-medium text-gray-600 dark:text-gray-300">
                      {isCompressing ? 'Processing...' : 'Gallery'}
                    </span>
                  </motion.button>
                </div>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleImageCapture}
                className="hidden"
              />
            </div>
          </div>

          {/* Submit Button */}
          <motion.button
            whileTap={{ scale: 0.98 }}
            type="submit"
            disabled={isSubmitting || isCompressing}
            className="w-full py-4 bg-blue-500 hover:bg-blue-600 text-white rounded-xl font-semibold text-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? 'Adding...' : `Add ${transactionType === 'expense' ? 'Expense' : 'Income'}`}
          </motion.button>
        </form>
      </motion.div>
    </motion.div>
  );
};

export default AddTransactionModal;
