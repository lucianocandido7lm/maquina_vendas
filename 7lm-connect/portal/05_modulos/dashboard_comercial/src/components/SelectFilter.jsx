import { useState, useRef, useEffect, useMemo } from 'react';
import { ChevronDown, Check, Search } from 'lucide-react';
import { AnimatePresence, motion as motionFactory } from 'framer-motion';
import './SelectFilter.css';

const SelectFilter = ({ id, label, value, options = [], onChange, className = '' }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef(null);
  const MotionPanel = motionFactory.div;

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const safeOptions = useMemo(() => (
    (Array.isArray(options) ? options : [])
      .filter(Boolean)
      .map((opt) => {
        const value = String(opt?.value ?? '').trim();
        const label = String(opt?.label ?? value).trim();
        return { value, label };
      })
      .filter((opt) => opt.value && opt.label)
  ), [options]);

  const filteredOptions = useMemo(() => {
    const searchText = String(search ?? '').toLowerCase();
    return safeOptions.filter((opt) => opt.label.toLowerCase().includes(searchText));
  }, [safeOptions, search]);

  const selectedOption = useMemo(() => {
    return safeOptions.find(opt => opt.value === value);
  }, [safeOptions, value]);

  const handleSelect = (optionValue) => {
    onChange(optionValue);
    setIsOpen(false);
    setSearch('');
  };

  return (
    <div className={`select-filter ${className}`.trim()} ref={containerRef}>
      <label className="select-filter-label label-md" htmlFor={id}>
        {label}
      </label>
      
      <div 
        className={`select-filter-trigger ${isOpen ? 'is-open' : ''}`}
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className="select-filter-value body-sm">
          {selectedOption ? selectedOption.label : 'Selecione...'}
        </span>
        <ChevronDown size={14} className={`icon-chevron ${isOpen ? 'rotate' : ''}`} />
      </div>

      <AnimatePresence>
        {isOpen && (
          <MotionPanel 
            className="select-filter-dropdown"
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
          >
            {safeOptions.length > 8 && (
              <div className="select-filter-search">
                <Search size={14} />
                <input 
                  type="text" 
                  placeholder="Pesquisar..." 
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                  autoFocus
                />
              </div>
            )}

            <div className="select-filter-options">
              {filteredOptions.length > 0 ? (
                filteredOptions.map((opt) => (
                  <div 
                    key={`${id}-${opt.value}`} 
                    className={`select-filter-option ${value === opt.value ? 'is-selected' : ''}`}
                    onClick={() => handleSelect(opt.value)}
                  >
                    <span className="body-sm">{opt.label}</span>
                    {value === opt.value && <Check size={12} className="icon-check" />}
                  </div>
                ))
              ) : (
                <div className="select-filter-empty body-sm">Nenhum resultado</div>
              )}
            </div>
          </MotionPanel>
        )}
      </AnimatePresence>
    </div>
  );
};

export default SelectFilter;
