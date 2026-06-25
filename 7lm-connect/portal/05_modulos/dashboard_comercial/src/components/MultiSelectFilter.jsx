import { useState, useRef, useEffect, useMemo, startTransition } from 'react';
import { ChevronDown, Check, Search, X } from 'lucide-react';
import { AnimatePresence, motion as motionFactory } from 'framer-motion';
import './MultiSelectFilter.css';

const MultiSelectFilter = ({ id, label, value = [], options = [], onChange, className = '', searchKey = '', onSearchOptions }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [remoteOptions, setRemoteOptions] = useState([]);
  const remoteOptionsRef = useRef([]);
  const containerRef = useRef(null);
  const lastRemoteQueryRef = useRef('');
  const MotionPanel = motionFactory.div;

  // Sync value if it's not an array (initial state might be 'todos')
  const activeValues = Array.isArray(value) ? value : (value === 'todos' ? [] : [value]);

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
    const mergedOptions = [...safeOptions];
    remoteOptions.forEach((opt) => {
      if (!mergedOptions.some((item) => item.value === opt.value)) {
        mergedOptions.push(opt);
      }
    });
    const searchText = String(search ?? '').toLowerCase();
    return mergedOptions.filter((opt) => (
      opt.label.toLowerCase().includes(searchText) && opt.value !== 'todos' && opt.value !== 'todas'
    ));
  }, [safeOptions, remoteOptions, search]);

  const localFilteredCount = useMemo(() => {
    const searchText = String(search ?? '').toLowerCase();
    return safeOptions.filter((opt) => (
      opt.label.toLowerCase().includes(searchText) && opt.value !== 'todos' && opt.value !== 'todas'
    )).length;
  }, [safeOptions, search]);

  const normalizedSearch = useMemo(() => String(search ?? '').trim().toLowerCase(), [search]);

  useEffect(() => {
    remoteOptionsRef.current = remoteOptions;
  }, [remoteOptions]);

  useEffect(() => {
    if (!isOpen) return () => {};
    if (typeof onSearchOptions !== 'function') return () => {};
    if (normalizedSearch.length < 2) {
      startTransition(() => setRemoteOptions([]));
      lastRemoteQueryRef.current = '';
      return () => {};
    }
    if (localFilteredCount >= 20) {
      startTransition(() => setRemoteOptions([]));
      lastRemoteQueryRef.current = '';
      return () => {};
    }
    const requestKey = `${searchKey}::${normalizedSearch}`;
    if (lastRemoteQueryRef.current === requestKey) {
      return () => {};
    }

    let active = true;
    const timer = setTimeout(async () => {
      const result = await onSearchOptions(searchKey, normalizedSearch);
      if (!active) return;
      const normalizedResult = Array.isArray(result) ? result : [];
      const currentRemote = remoteOptionsRef.current;
      const hasDiff = normalizedResult.length !== currentRemote.length
        || normalizedResult.some((opt, idx) => opt?.value !== currentRemote[idx]?.value || opt?.label !== currentRemote[idx]?.label);
      if (!hasDiff) {
        lastRemoteQueryRef.current = requestKey;
        return;
      }
      startTransition(() => {
        setRemoteOptions(normalizedResult);
      });
      lastRemoteQueryRef.current = requestKey;
    }, 180);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [isOpen, localFilteredCount, normalizedSearch, onSearchOptions, searchKey]);

  const toggleOption = (optionValue) => {
    if (optionValue === 'todos') {
      onChange([]);
      return;
    }

    let newValue;
    if (activeValues.includes(optionValue)) {
      newValue = activeValues.filter(v => v !== optionValue);
    } else {
      newValue = [...activeValues, optionValue];
    }
    onChange(newValue);
  };

  const removeValue = (val, e) => {
    e.stopPropagation();
    onChange(activeValues.filter(v => v !== val));
  };

  const clearAll = (e) => {
    e.stopPropagation();
    onChange([]);
    setSearch('');
  };

  const isAllSelected = activeValues.length === 0;

  return (
    <div className={`multi-select-filter ${className}`.trim()} ref={containerRef}>
      <label className="multi-select-label label-md" htmlFor={id}>
        {label}
      </label>
      
      <div 
        className={`multi-select-trigger ${isOpen ? 'is-open' : ''}`}
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="multi-select-values">
          {isAllSelected ? (
            <span className="multi-select-placeholder body-sm">Todos</span>
          ) : (
              activeValues.map(val => {
              const opt = safeOptions.find(o => o.value === val);
              return (
                <span key={val} className="multi-select-tag">
                  {opt ? opt.label : val}
                  <X size={10} onClick={(e) => removeValue(val, e)} />
                </span>
              );
            })
          )}
        </div>
        
        <div className="multi-select-icons">
          {!isAllSelected && (
            <X size={14} className="icon-clear" onClick={clearAll} />
          )}
          <ChevronDown size={14} className={`icon-chevron ${isOpen ? 'rotate' : ''}`} />
        </div>
      </div>

      <AnimatePresence>
        {isOpen && (
          <MotionPanel 
            className="multi-select-dropdown"
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
          >
            <div className="multi-select-search">
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

            <div className="multi-select-options">
              <div 
                className={`multi-select-option ${isAllSelected ? 'is-selected' : ''}`}
                onClick={() => toggleOption('todos')}
              >
                <div className="check-box">
                  {isAllSelected && <Check size={12} />}
                </div>
                <span className="body-sm">Todos</span>
              </div>

              {filteredOptions.length > 0 ? (
                filteredOptions.map((opt) => (
                  <div 
                    key={`${id}-${opt.value}`} 
                    className={`multi-select-option ${activeValues.includes(opt.value) ? 'is-selected' : ''}`}
                    onClick={() => toggleOption(opt.value)}
                  >
                    <div className="check-box">
                      {activeValues.includes(opt.value) && <Check size={12} />}
                    </div>
                    <span className="body-sm">{opt.label}</span>
                  </div>
                ))
              ) : search && (
                <div className="multi-select-empty body-sm">Nenhum resultado encontrado</div>
              )}
            </div>
          </MotionPanel>
        )}
      </AnimatePresence>
    </div>
  );
};

export default MultiSelectFilter;
