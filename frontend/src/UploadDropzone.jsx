import { useState, useCallback, useRef } from 'react';
import { UploadIcon, FileTextIcon } from './icons';
import { apiUploadDocument } from './api';
import { useToast } from './context';

const ACCEPTED_TYPES = {
  'application/pdf': 'PDF',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'DOCX',
};

function formatBytes(bytes) {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// Individual upload progress item
function UploadItem({ item }) {
  const fillClass =
    item.status === 'done' ? 'success' :
    item.status === 'error' ? 'error' : '';

  return (
    <div className="upload-item">
      <div className="upload-item-icon" style={{
        background: item.file.type === 'application/pdf'
          ? 'rgba(239,68,68,0.1)' : 'rgba(59,130,246,0.1)',
        borderRadius: 6,
        width: 32, height: 32,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <FileTextIcon size={16} style={{
          color: item.file.type === 'application/pdf' ? '#ef4444' : '#3b82f6'
        }} />
      </div>
      <div className="upload-item-info">
        <div className="upload-item-name">{item.file.name}</div>
        <div className="upload-item-status">
          {item.status === 'uploading' && `Uploading… ${item.progress}%`}
          {item.status === 'processing' && 'Processing & indexing…'}
          {item.status === 'done' && `Indexed ${formatBytes(item.file.size)}`}
          {item.status === 'error' && (item.error || 'Upload failed')}
        </div>
        <div className="upload-progress-bar">
          <div
            className={`upload-progress-fill ${fillClass}`}
            style={{ width: `${item.progress}%` }}
          />
        </div>
      </div>
    </div>
  );
}

export default function UploadDropzone({ onUploadComplete }) {
  const [dragOver, setDragOver] = useState(false);
  const [uploads, setUploads] = useState([]);
  const inputRef = useRef(null);
  const { addToast } = useToast();
  const idRef = useRef(0);

  const updateUpload = useCallback((id, patch) => {
    setUploads((prev) => prev.map((u) => u.id === id ? { ...u, ...patch } : u));
  }, []);

  const processFile = useCallback(async (file) => {
    const type = file.type;
    if (!ACCEPTED_TYPES[type]) {
      addToast(`Unsupported file type: ${file.name}. Only PDF and DOCX are accepted.`, 'error');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      addToast(`File too large: ${file.name}. Maximum size is 10MB.`, 'error');
      return;
    }

    const id = ++idRef.current;
    setUploads((prev) => [...prev, { id, file, status: 'uploading', progress: 0, error: null }]);

    try {
      await apiUploadDocument(file, (pct) => {
        updateUpload(id, { progress: pct, status: pct < 100 ? 'uploading' : 'processing' });
      });
      updateUpload(id, { status: 'done', progress: 100 });
      addToast(`${file.name} indexed successfully.`, 'success');
      onUploadComplete?.();

      // Auto-remove from queue after 3s
      setTimeout(() => {
        setUploads((prev) => prev.filter((u) => u.id !== id));
      }, 3000);
    } catch (err) {
      updateUpload(id, { status: 'error', progress: 100, error: err.message });
      addToast(`Failed to upload ${file.name}: ${err.message}`, 'error');
    }
  }, [addToast, onUploadComplete, updateUpload]);

  const handleFiles = useCallback((files) => {
    Array.from(files).forEach(processFile);
  }, [processFile]);

  function handleDrop(e) {
    e.preventDefault();
    setDragOver(false);
    handleFiles(e.dataTransfer.files);
  }

  function handleDragOver(e) {
    e.preventDefault();
    setDragOver(true);
  }

  function handleDragLeave() {
    setDragOver(false);
  }

  function handleInputChange(e) {
    handleFiles(e.target.files);
    // Reset input so same file can be re-uploaded
    e.target.value = '';
  }

  return (
    <div>
      <div
        id="upload-dropzone"
        className={`dropzone ${dragOver ? 'drag-over' : ''}`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        role="button"
        tabIndex={0}
        aria-label="Upload documents — drag and drop or click to browse"
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click(); }}
      >
        <input
          ref={inputRef}
          id="upload-file-input"
          type="file"
          accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          multiple
          onChange={handleInputChange}
          aria-label="Choose files to upload"
        />
        <div className="dropzone-icon">
          <UploadIcon size={20} />
        </div>
        <div className="dropzone-text">Drop documents here</div>
        <div className="dropzone-subtext">or click to browse files</div>
        <div className="dropzone-hint">
          <span>Supported formats:</span>
          <strong style={{ color: 'var(--text-secondary)' }}>PDF, DOCX</strong>
          <span>·</span>
          <span>Max 10 MB per file</span>
        </div>
      </div>

      {uploads.length > 0 && (
        <div className="upload-queue" style={{ marginTop: 12 }}>
          {uploads.map((u) => (
            <UploadItem key={u.id} item={u} />
          ))}
        </div>
      )}
    </div>
  );
}
