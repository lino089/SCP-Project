import { useRef, useState } from 'react';
import { Upload, FileText, X } from 'lucide-react';
import './FileUpload.css';

/**
 * Shared File Upload Dropzone Component
 */
export default function FileUpload({
  label = '',
  accept = '*/*',
  maxSizeMB = 10,
  file = null,
  onChange,
  disabled = false,
  hint = 'Maksimum ukuran berkas 10MB',
  className = '',
}) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef(null);

  const formatFileSize = (bytes) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  };

  const handleFiles = (files) => {
    if (!files || files.length === 0) return;
    const selected = files[0];
    if (selected.size > maxSizeMB * 1024 * 1024) {
      setError(`Ukuran berkas melebihi batas maksimal ${maxSizeMB}MB.`);
      return;
    }
    setError('');
    onChange?.(selected);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    if (disabled) return;
    setIsDragOver(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragOver(false);
    if (disabled) return;
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  };

  const handleRemove = (e) => {
    e.stopPropagation();
    if (inputRef.current) {
      inputRef.current.value = '';
    }
    setError('');
    onChange?.(null);
  };

  return (
    <div className={`fileupload-container ${className}`.trim()}>
      {label && <label className="input-label">{label}</label>}

      {file ? (
        <div className="fileupload-selected">
          <div className="fileupload-file-info">
            <FileText size={22} className="fileupload-file-icon" />
            <div className="fileupload-file-meta">
              <span className="fileupload-file-name">{file.name}</span>
              <span className="fileupload-file-size">{formatFileSize(file.size)}</span>
            </div>
          </div>
          {!disabled && (
            <button
              type="button"
              className="fileupload-remove-btn"
              onClick={handleRemove}
              aria-label="Hapus berkas"
            >
              <X size={16} />
            </button>
          )}
        </div>
      ) : (
        <div
          className={[
            'fileupload-dropzone',
            isDragOver ? 'fileupload-dropzone--dragover' : '',
            disabled ? 'fileupload-dropzone--disabled' : '',
          ]
            .filter(Boolean)
            .join(' ')}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => !disabled && inputRef.current?.click()}
        >
          <div className="fileupload-icon-wrapper">
            <Upload size={20} />
          </div>
          <div className="fileupload-prompt">
            <span className="fileupload-link">Pilih berkas</span> atau tarik dan lepas ke sini
          </div>
          {hint && <span className="fileupload-hint">{hint}</span>}
          <input
            ref={inputRef}
            type="file"
            accept={accept}
            disabled={disabled}
            className="fileupload-hidden-input"
            onChange={(e) => handleFiles(e.target.files)}
          />
        </div>
      )}

      {error && <span className="fileupload-error">{error}</span>}
    </div>
  );
}
