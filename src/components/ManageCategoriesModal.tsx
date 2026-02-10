import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Plus, Trash2, Edit2, Check, ChevronDown } from 'lucide-react';
import { useCategories } from '../hooks/useCategories';
import { ICON_GROUPS, CATEGORY_COLORS, getIconUrl, type CategoryDef } from '../data/categoryIcons';

interface ManageCategoriesModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const ManageCategoriesModal = ({ isOpen, onClose }: ManageCategoriesModalProps) => {
    const { categories, customCategories, addCategory, editCategory, deleteCategory } = useCategories();
    const [showForm, setShowForm] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [name, setName] = useState('');
    const [selectedIcon, setSelectedIcon] = useState('');
    const [selectedColor, setSelectedColor] = useState(CATEGORY_COLORS[0]);
    const [showIconPicker, setShowIconPicker] = useState(false);
    const [iconPickerGroup, setIconPickerGroup] = useState(0);
    const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

    if (!isOpen) return null;

    const resetForm = () => {
        setName('');
        setSelectedIcon('');
        setSelectedColor(CATEGORY_COLORS[0]);
        setShowForm(false);
        setEditingId(null);
        setShowIconPicker(false);
    };

    const handleSave = () => {
        if (!name.trim()) return;

        if (editingId) {
            editCategory(editingId, {
                name: name.trim(),
                iconAsset: selectedIcon,
                iconType: 'asset',
                color: selectedColor,
            });
        } else {
            addCategory({
                name: name.trim(),
                iconAsset: selectedIcon,
                iconType: 'asset',
                color: selectedColor,
            });
        }
        resetForm();
    };

    const startEdit = (cat: CategoryDef) => {
        setEditingId(cat.id);
        setName(cat.name);
        setSelectedIcon(cat.iconAsset || '');
        setSelectedColor(cat.color);
        setShowForm(true);
    };

    const handleDelete = (id: string) => {
        deleteCategory(id);
        setConfirmDelete(null);
    };

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
                    className="relative w-full max-w-md bg-white dark:bg-gray-900 rounded-t-3xl sm:rounded-3xl shadow-xl max-h-[90vh] flex flex-col"
                >
                    {/* Header */}
                    <div className="p-5 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center flex-shrink-0">
                        <h3 className="text-xl font-bold text-gray-900 dark:text-white">Manage Categories</h3>
                        <button onClick={onClose} className="p-2 bg-gray-100 dark:bg-gray-800 rounded-full">
                            <X className="w-5 h-5 text-gray-500" />
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-5 space-y-4">
                        {/* Default Categories */}
                        <div>
                            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">Default Categories</p>
                            <div className="grid grid-cols-4 gap-2">
                                {categories.filter(c => c.isDefault).map(cat => {
                                    const Icon = cat.icon;
                                    return (
                                        <div key={cat.id} className="flex flex-col items-center p-2 rounded-xl opacity-75">
                                            <div className={`w-10 h-10 rounded-xl ${cat.color} flex items-center justify-center mb-1`}>
                                                {Icon && <Icon className="w-5 h-5" />}
                                            </div>
                                            <span className="text-[10px] font-medium text-gray-600 dark:text-gray-400 text-center">{cat.name}</span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Custom Categories */}
                        <div>
                            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
                                Custom Categories ({customCategories.length})
                            </p>
                            {customCategories.length === 0 ? (
                                <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-4">No custom categories yet</p>
                            ) : (
                                <div className="space-y-2">
                                    {customCategories.map(cat => (
                                        <div key={cat.id} className="flex items-center justify-between bg-gray-50 dark:bg-gray-800 rounded-xl p-3">
                                            <div className="flex items-center gap-3">
                                                <div className={`w-10 h-10 rounded-xl ${cat.color} flex items-center justify-center overflow-hidden`}>
                                                    {cat.iconType === 'asset' && cat.iconAsset ? (
                                                        <img src={getIconUrl(cat.iconAsset)} alt="" className="w-7 h-7 object-contain" />
                                                    ) : (
                                                        <span className="text-lg">{cat.iconEmoji || '📂'}</span>
                                                    )}
                                                </div>
                                                <span className="font-medium text-gray-900 dark:text-white text-sm">{cat.name}</span>
                                            </div>
                                            <div className="flex gap-1">
                                                <button onClick={() => startEdit(cat)} className="p-1.5 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700">
                                                    <Edit2 className="w-4 h-4 text-gray-500" />
                                                </button>
                                                {confirmDelete === cat.id ? (
                                                    <button onClick={() => handleDelete(cat.id)} className="p-1.5 rounded-lg bg-red-100 dark:bg-red-900/30">
                                                        <Check className="w-4 h-4 text-red-500" />
                                                    </button>
                                                ) : (
                                                    <button onClick={() => setConfirmDelete(cat.id)} className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20">
                                                        <Trash2 className="w-4 h-4 text-gray-400" />
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Add/Edit Form */}
                        <AnimatePresence>
                            {showForm && (
                                <motion.div
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: 'auto' }}
                                    exit={{ opacity: 0, height: 0 }}
                                    className="bg-blue-50 dark:bg-blue-900/10 rounded-2xl p-4 space-y-4 overflow-hidden"
                                >
                                    <p className="text-sm font-semibold text-blue-700 dark:text-blue-300">
                                        {editingId ? 'Edit Category' : 'New Category'}
                                    </p>

                                    {/* Name */}
                                    <input
                                        value={name}
                                        onChange={e => setName(e.target.value)}
                                        placeholder="Category name"
                                        className="w-full px-3 py-2.5 rounded-xl border border-blue-200 dark:border-blue-800 bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-white"
                                    />

                                    {/* Icon Picker Toggle */}
                                    <div>
                                        <button
                                            onClick={() => setShowIconPicker(!showIconPicker)}
                                            className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl border border-blue-200 dark:border-blue-800 bg-white dark:bg-gray-900 text-sm"
                                        >
                                            <div className="flex items-center gap-2">
                                                {selectedIcon ? (
                                                    <img src={getIconUrl(selectedIcon)} alt="" className="w-6 h-6 object-contain" />
                                                ) : (
                                                    <span className="text-gray-400">Choose icon</span>
                                                )}
                                                {selectedIcon && <span className="text-gray-700 dark:text-gray-300 text-xs">{selectedIcon.replace('category-', '').replace('.webp', '')}</span>}
                                            </div>
                                            <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${showIconPicker ? 'rotate-180' : ''}`} />
                                        </button>

                                        {showIconPicker && (
                                            <div className="mt-2 space-y-2">
                                                {/* Group Tabs */}
                                                <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-hide">
                                                    {ICON_GROUPS.map((g, i) => (
                                                        <button
                                                            key={g.name}
                                                            onClick={() => setIconPickerGroup(i)}
                                                            className={`px-2.5 py-1 text-[10px] font-semibold rounded-full whitespace-nowrap transition-colors ${iconPickerGroup === i
                                                                    ? 'bg-blue-500 text-white'
                                                                    : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                                                                }`}
                                                        >
                                                            {g.name}
                                                        </button>
                                                    ))}
                                                </div>
                                                {/* Icons Grid */}
                                                <div className="grid grid-cols-6 gap-1.5 max-h-40 overflow-y-auto p-1">
                                                    {ICON_GROUPS[iconPickerGroup].icons.map(icon => (
                                                        <button
                                                            key={icon}
                                                            onClick={() => { setSelectedIcon(icon); setShowIconPicker(false); }}
                                                            className={`w-10 h-10 rounded-lg border-2 flex items-center justify-center transition-all ${selectedIcon === icon
                                                                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30'
                                                                    : 'border-transparent hover:bg-gray-100 dark:hover:bg-gray-800'
                                                                }`}
                                                        >
                                                            <img src={getIconUrl(icon)} alt="" className="w-7 h-7 object-contain" />
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Color Picker */}
                                    <div>
                                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Color</p>
                                        <div className="flex flex-wrap gap-1.5">
                                            {CATEGORY_COLORS.map(color => (
                                                <button
                                                    key={color}
                                                    onClick={() => setSelectedColor(color)}
                                                    className={`w-7 h-7 rounded-full ${color.split(' ')[0]} border-2 transition-all ${selectedColor === color ? 'border-blue-500 scale-110' : 'border-transparent'
                                                        }`}
                                                />
                                            ))}
                                        </div>
                                    </div>

                                    {/* Actions */}
                                    <div className="flex gap-2">
                                        <button onClick={resetForm} className="flex-1 py-2 rounded-xl bg-gray-200 dark:bg-gray-700 text-sm font-medium text-gray-700 dark:text-gray-300">
                                            Cancel
                                        </button>
                                        <button
                                            onClick={handleSave}
                                            disabled={!name.trim()}
                                            className="flex-1 py-2 rounded-xl bg-blue-500 text-white text-sm font-semibold disabled:opacity-50"
                                        >
                                            {editingId ? 'Update' : 'Add'}
                                        </button>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>

                    {/* Add Button */}
                    {!showForm && (
                        <div className="p-4 border-t border-gray-100 dark:border-gray-800 flex-shrink-0">
                            <button
                                onClick={() => setShowForm(true)}
                                className="w-full py-3 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-xl font-semibold flex items-center justify-center gap-2"
                            >
                                <Plus className="w-5 h-5" />
                                Add Custom Category
                            </button>
                        </div>
                    )}
                </motion.div>
            </div>
        </AnimatePresence>
    );
};

export default ManageCategoriesModal;
