import React, { useState, useRef, useEffect } from "react";
import { ChevronDown, Search, Check } from "lucide-react";

interface Option {
  value: string;
  label: string;
}

interface SearchableSelectProps {
  options: Option[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export function SearchableSelect({ options, value, onChange, placeholder = "Select...", className = "" }: SearchableSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [focusedIndex, setFocusedIndex] = useState(0); // 0 for None/Reset, 1...n for options
  
  const containerRef = useRef<HTMLDivElement>(null);
  const optionsListRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    setFocusedIndex(0);
  }, [searchQuery, isOpen]);

  useEffect(() => {
    if (isOpen && optionsListRef.current) {
      const listElement = optionsListRef.current;
      const focusedElement = listElement.children[focusedIndex] as HTMLElement;
      if (focusedElement) {
        if (focusedElement.offsetTop < listElement.scrollTop) {
          listElement.scrollTop = focusedElement.offsetTop;
        } else if (focusedElement.offsetTop + focusedElement.offsetHeight > listElement.scrollTop + listElement.clientHeight) {
          listElement.scrollTop = focusedElement.offsetTop + focusedElement.offsetHeight - listElement.clientHeight;
        }
      }
    }
  }, [focusedIndex, isOpen]);

  const selectedOption = options.find((opt) => opt.value === value);

  const filteredOptions = options.filter((opt) => 
    opt.label.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setFocusedIndex((prev) => Math.min(prev + 1, filteredOptions.length));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setFocusedIndex((prev) => Math.max(prev - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (focusedIndex === 0) {
        onChange("");
      } else if (filteredOptions[focusedIndex - 1]) {
        onChange(filteredOptions[focusedIndex - 1].value);
      }
      setIsOpen(false);
      setSearchQuery("");
    } else if (e.key === "Escape") {
      setIsOpen(false);
    }
  };

  return (
    <div className="relative w-full" ref={containerRef}>
      <div 
        tabIndex={0}
        className={`w-full bg-white border border-slate-200 h-9 md:h-10 rounded-xl px-3 flex items-center justify-between text-xs md:text-sm cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all ${className}`}
        onClick={() => setIsOpen(!isOpen)}
        onKeyDown={(e) => {
          if (!isOpen && (e.key === "Enter" || e.key === " ")) {
            e.preventDefault();
            setIsOpen(true);
          }
        }}
      >
        <span className={`truncate pr-2 font-bold ${selectedOption ? "text-slate-900" : "text-slate-400"}`}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <ChevronDown size={14} className={`text-slate-400 shrink-0 transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </div>

      {isOpen && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-slate-200 shadow-2xl rounded-2xl max-h-64 overflow-hidden flex flex-col animate-in fade-in slide-in-from-top-1 duration-150">
          <div className="p-2 border-b border-slate-100 flex items-center gap-2 bg-slate-50/50">
            <Search size={13} className="text-slate-400 shrink-0" />
            <input 
              type="text" 
              className="w-full text-xs outline-none bg-transparent placeholder:text-slate-400 font-bold text-slate-800"
              placeholder="Type to search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              autoFocus
            />
          </div>
          <div className="overflow-y-auto p-1 max-h-52 custom-scrollbar" ref={optionsListRef}>
            <div 
              className={`px-3 py-1.5 text-xs rounded-xl cursor-pointer flex items-center justify-between transition-colors ${focusedIndex === 0 ? "bg-slate-100 ring-1 ring-slate-200" : "hover:bg-slate-50"} ${!value ? "text-indigo-700 font-black" : "text-slate-500 font-bold"}`}
              onClick={() => { onChange(""); setIsOpen(false); setSearchQuery(""); }}
            >
              <span>-- None / Reset --</span>
              {!value && <Check size={13} className="text-indigo-600 shrink-0" />}
            </div>
            {filteredOptions.length === 0 ? (
              <div className="px-3 py-3 text-xs text-slate-400 text-center font-medium">No matching results found</div>
            ) : (
              filteredOptions.map((opt, idx) => {
                const itemIndex = idx + 1;
                const isSelected = value === opt.value;
                const isFocused = focusedIndex === itemIndex;
                
                return (
                  <div 
                    key={opt.value}
                    className={`px-3 py-1.5 text-xs rounded-xl cursor-pointer flex items-center justify-between transition-colors ${isFocused ? "bg-slate-100 ring-1 ring-slate-200" : "hover:bg-slate-50"} ${isSelected ? "text-indigo-700 font-black bg-indigo-50/60" : "text-slate-700 font-bold"}`}
                    onClick={() => { onChange(opt.value); setIsOpen(false); setSearchQuery(""); }}
                  >
                    <span className="truncate pr-2">{opt.label}</span>
                    {isSelected && <Check size={13} className="text-indigo-600 shrink-0" />}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
