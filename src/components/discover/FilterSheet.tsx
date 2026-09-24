import React from 'react';
import { X, RotateCcw, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export interface DiscoverFilters {
  searchTerm: string;
  minAge: number;
  maxAge: number;
  location: string;
  faith: string;
}

interface FilterSheetProps {
  isOpen: boolean;
  filters: DiscoverFilters;
  onClose: () => void;
  onApply: (newFilters: DiscoverFilters) => void;
  onReset: () => void;
}

const LOCATIONS = ['All Locations', 'Lagos', 'Abuja', 'Port Harcourt', 'International'];
const FAITHS = ['All Faiths', 'Christian', 'Muslim', 'Other'];

export const FilterSheet: React.FC<FilterSheetProps> = ({
  isOpen,
  filters,
  onClose,
  onApply,
  onReset
}) => {
  const [localFilters, setLocalFilters] = React.useState<DiscoverFilters>(filters);

  React.useEffect(() => {
    setLocalFilters(filters);
  }, [filters, isOpen]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 320 }}
            className="w-full max-w-sm max-h-[85vh] overflow-y-auto bg-[#FAF8F5] text-stone-900 rounded-3xl p-5 shadow-2xl border border-stone-200"
          >
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-stone-200">
              <div>
                <h3 className="font-serif font-bold text-lg text-stone-900">
                  Filter Profiles
                </h3>
                <p className="text-xs text-stone-500">
                  Browse by location, age and lifestyle alignment
                </p>
              </div>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-full bg-stone-200 flex items-center justify-center text-stone-600 hover:text-stone-900 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Filter options */}
            <div className="space-y-4 py-4 text-xs">
              {/* Keyword / Profession / Name Search */}
              <div>
                <label className="font-semibold text-stone-800 block mb-1">
                  Search Name or Profession
                </label>
                <input
                  type="text"
                  value={localFilters.searchTerm}
                  onChange={(e) => setLocalFilters({ ...localFilters, searchTerm: e.target.value })}
                  placeholder="Name or profession"
                  className="w-full p-2.5 rounded-xl bg-white border border-stone-300 text-stone-900 outline-hidden"
                />
              </div>

              {/* Age Range */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="font-semibold text-stone-800">Age Range</label>
                  <span className="text-rose-900 font-bold">
                    {localFilters.minAge} – {localFilters.maxAge} years
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min={21}
                    max={55}
                    value={localFilters.minAge}
                    onChange={(e) => setLocalFilters({ ...localFilters, minAge: Number(e.target.value) })}
                    className="w-full accent-rose-900"
                  />
                  <input
                    type="range"
                    min={21}
                    max={65}
                    value={localFilters.maxAge}
                    onChange={(e) => setLocalFilters({ ...localFilters, maxAge: Number(e.target.value) })}
                    className="w-full accent-rose-900"
                  />
                </div>
              </div>

              {/* Location selection pills */}
              <div>
                <label className="font-semibold text-stone-800 block mb-1.5">
                  Location
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {LOCATIONS.map((loc) => {
                    const isSelected = localFilters.location === loc;
                    return (
                      <button
                        key={loc}
                        type="button"
                        onClick={() => setLocalFilters({ ...localFilters, location: loc })}
                        className={`px-3 py-1.5 rounded-xl border transition cursor-pointer ${
                          isSelected
                            ? 'bg-rose-900 text-white border-rose-950 font-semibold'
                            : 'bg-white text-stone-700 border-stone-300 hover:bg-stone-50'
                        }`}
                      >
                        {loc}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Faith selection */}
              <div>
                <label className="font-semibold text-stone-800 block mb-1.5">
                  Faith & Spirituality
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {FAITHS.map((f) => {
                    const isSelected = localFilters.faith === f;
                    return (
                      <button
                        key={f}
                        type="button"
                        onClick={() => setLocalFilters({ ...localFilters, faith: f })}
                        className={`px-3 py-1.5 rounded-xl border transition cursor-pointer ${
                          isSelected
                            ? 'bg-rose-900 text-white border-rose-950 font-semibold'
                            : 'bg-white text-stone-700 border-stone-300 hover:bg-stone-50'
                        }`}
                      >
                        {f}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 pt-3 border-t border-stone-200">
              <button
                type="button"
                onClick={() => {
                  onReset();
                  onClose();
                }}
                className="py-3 px-4 rounded-2xl border border-stone-300 text-stone-600 hover:text-stone-900 font-semibold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Reset
              </button>

              <button
                type="button"
                onClick={() => {
                  onApply(localFilters);
                  onClose();
                }}
                className="flex-1 py-3 rounded-2xl bg-rose-900 text-amber-100 font-semibold text-xs shadow-md hover:bg-rose-950 flex items-center justify-center gap-1.5 transition active:scale-98 cursor-pointer"
              >
                <Check className="w-4 h-4" />
                Apply Filters
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
