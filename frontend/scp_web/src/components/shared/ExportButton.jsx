import { useState, useRef, useEffect } from 'react';
import { Download, ChevronDown, FileSpreadsheet, FileText } from 'lucide-react';
import Button from './Button';
import './ExportButton.css';

/**
 * Shared Export Action Button with dropdown formats
 */
export default function ExportButton({
  onExport, // (format) => void
  formats = ['excel', 'pdf'], // ['excel', 'pdf', 'csv']
  label = 'Ekspor',
  variant = 'outline',
  size = 'md',
  loading = false,
  disabled = false,
  className = '',
}) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleSelectFormat = (fmt) => {
    setIsOpen(false);
    onExport?.(fmt);
  };

  const getFormatIcon = (fmt) => {
    if (fmt === 'excel') return <FileSpreadsheet size={14} className="text-emerald-600" />;
    return <FileText size={14} className="text-red-500" />;
  };

  const getFormatLabel = (fmt) => {
    if (fmt === 'excel') return 'Unduh Excel (.xlsx)';
    if (fmt === 'pdf') return 'Unduh Dokumen PDF (.pdf)';
    if (fmt === 'csv') return 'Unduh Berkas CSV (.csv)';
    return `Unduh ${fmt.toUpperCase()}`;
  };

  // If only 1 format, direct button click
  if (formats.length === 1) {
    return (
      <Button
        variant={variant}
        size={size}
        icon={Download}
        loading={loading}
        disabled={disabled}
        className={className}
        onClick={() => onExport?.(formats[0])}
      >
        {label}
      </Button>
    );
  }

  return (
    <div className={`export-button-wrapper ${className}`.trim()} ref={dropdownRef}>
      <Button
        variant={variant}
        size={size}
        icon={Download}
        loading={loading}
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
      >
        <span>{label}</span>
        <ChevronDown size={14} className="ml-1 text-gray-400" />
      </Button>

      {isOpen && (
        <div className="export-dropdown-menu" role="menu">
          {formats.map((fmt) => (
            <button
              key={fmt}
              type="button"
              className="export-dropdown-item"
              role="menuitem"
              onClick={() => handleSelectFormat(fmt)}
            >
              {getFormatIcon(fmt)}
              <span>{getFormatLabel(fmt)}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
