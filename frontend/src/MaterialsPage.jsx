import { useState, useEffect, useCallback } from 'react';
import { apiListDocuments, apiDeleteDocument } from './api';
import { useToast } from './context';
import { FileTextIcon, TrashIcon, RefreshIcon } from './icons';
import UploadDropzone from './UploadDropzone';

function formatBytes(bytes) {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function getMimeLabel(mime) {
  if (mime === 'application/pdf') return 'PDF';
  if (mime?.includes('wordprocessingml')) return 'DOCX';
  return mime?.split('/').pop()?.toUpperCase() || 'FILE';
}

// Skeleton row
function SkeletonRow() {
  return (
    <div className="document-row" aria-hidden="true">
      <div className="skeleton" style={{ width: 32, height: 32, borderRadius: 6, flexShrink: 0 }} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div className="skeleton" style={{ height: 12, width: '55%', borderRadius: 4 }} />
        <div className="skeleton" style={{ height: 10, width: '35%', borderRadius: 4 }} />
      </div>
      <div className="skeleton" style={{ height: 20, width: 48, borderRadius: 99, flexShrink: 0 }} />
    </div>
  );
}

// Confirm delete dialog
function ConfirmDialog({ doc, onConfirm, onCancel }) {
  return (
    <div className="dialog-overlay" role="dialog" aria-modal="true" aria-labelledby="dialog-title">
      <div className="dialog-box">
        <h2 id="dialog-title" className="dialog-title">Delete document?</h2>
        <p className="dialog-body">
          <strong style={{ color: 'var(--text-primary)' }}>{doc.originalName}</strong>
          {' '}will be permanently removed along with all its indexed content. This action cannot be undone.
        </p>
        <div className="dialog-actions">
          <button id="dialog-cancel-btn" className="btn btn-secondary" onClick={onCancel}>Cancel</button>
          <button id="dialog-confirm-delete-btn" className="btn btn-danger" onClick={onConfirm}>Delete</button>
        </div>
      </div>
    </div>
  );
}

// Single document row
function DocumentRow({ doc, onDelete }) {
  const typeLabel = getMimeLabel(doc.mimeType);
  const typeClass = typeLabel === 'PDF' ? 'pdf' : 'docx';

  return (
    <div className="document-row" role="row">
      <div className={`doc-icon ${typeClass}`} aria-label={`${typeLabel} file`}>
        <FileTextIcon size={15} />
      </div>
      <div className="doc-info">
        <div className="doc-name" title={doc.originalName}>{doc.originalName}</div>
        <div className="doc-meta">
          <span>{typeLabel}</span>
          {doc._count?.chunks > 0 && <span>·</span>}
          {doc._count?.chunks > 0 && <span>{doc._count.chunks} chunks</span>}
          <span>·</span>
          <span>{formatDate(doc.createdAt)}</span>
        </div>
      </div>
      <span className="doc-status ready">
        <span className="doc-status-dot" />
        Ready
      </span>
      <div className="doc-actions">
        <button
          id={`delete-doc-${doc.id}`}
          className="btn btn-ghost btn-icon"
          onClick={() => onDelete(doc)}
          title={`Delete ${doc.originalName}`}
          aria-label={`Delete ${doc.originalName}`}
        >
          <TrashIcon size={14} style={{ color: 'var(--danger)' }} />
        </button>
      </div>
    </div>
  );
}

export default function MaterialsPage() {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [deletingDoc, setDeletingDoc] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const { addToast } = useToast();

  const fetchDocuments = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiListDocuments();
      setDocuments(data.documents || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  async function handleDelete() {
    if (!deletingDoc) return;
    setDeleting(true);
    try {
      await apiDeleteDocument(deletingDoc.id);
      setDocuments((prev) => prev.filter((d) => d.id !== deletingDoc.id));
      addToast(`${deletingDoc.originalName} deleted.`, 'success');
    } catch (err) {
      addToast(`Failed to delete: ${err.message}`, 'error');
    } finally {
      setDeletingDoc(null);
      setDeleting(false);
    }
  }

  return (
    <div className="materials-page">
      <header className="page-header">
        <div>
          <h1 className="page-title">Materials</h1>
          <p className="page-subtitle">Upload and manage your research documents</p>
        </div>
        <button
          id="materials-refresh-btn"
          className="btn btn-secondary btn-sm"
          onClick={fetchDocuments}
          disabled={loading}
          aria-label="Refresh document list"
        >
          <RefreshIcon size={13} />
          Refresh
        </button>
      </header>

      <main className="materials-body">
        <UploadDropzone onUploadComplete={fetchDocuments} />

        <div>
          <div className="document-list-header">
            <span className="document-list-title">Your documents</span>
            {!loading && (
              <span className="document-count">{documents.length} file{documents.length !== 1 ? 's' : ''}</span>
            )}
          </div>

          {error && (
            <div className="error-banner" role="alert" style={{ marginBottom: 12 }}>
              {error}
              <button
                className="btn btn-ghost btn-sm"
                onClick={fetchDocuments}
                style={{ marginLeft: 8 }}
              >
                Retry
              </button>
            </div>
          )}

          <div className="document-list" role="table" aria-label="Uploaded documents">
            {loading ? (
              <>
                <SkeletonRow />
                <SkeletonRow />
                <SkeletonRow />
              </>
            ) : documents.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon">
                  <FileTextIcon size={22} />
                </div>
                <div className="empty-state-title">No documents yet</div>
                <div className="empty-state-sub">
                  Upload your first PDF or DOCX above to get started.
                </div>
              </div>
            ) : (
              documents.map((doc) => (
                <DocumentRow key={doc.id} doc={doc} onDelete={setDeletingDoc} />
              ))
            )}
          </div>
        </div>
      </main>

      {deletingDoc && (
        <ConfirmDialog
          doc={deletingDoc}
          onConfirm={handleDelete}
          onCancel={() => setDeletingDoc(null)}
        />
      )}
    </div>
  );
}
