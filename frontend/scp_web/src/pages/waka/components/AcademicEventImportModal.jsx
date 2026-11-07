import { useState, useMemo, useRef } from 'react';
import {
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  AlertCircle,
  ArrowRight,
  RefreshCw,
  Info,
  Calendar,
  Check,
} from 'lucide-react';
import Modal from '../../../components/shared/Modal';
import Button from '../../../components/shared/Button';
import Badge from '../../../components/shared/Badge';
import { academicEventApi } from '../../../services/academicEventApi';

const EVENT_TYPE_OPTIONS = [
  { value: 'holiday', label: 'Hari Libur Resmi', defaultDisabled: true },
  { value: 'exam', label: 'Masa Ujian / Asesmen', defaultDisabled: true },
  { value: 'school_event', label: 'Kegiatan Sekolah', defaultDisabled: false },
  { value: 'class_event', label: 'Kegiatan Tingkat / Rombel', defaultDisabled: true },
];

const SCOPE_TYPE_OPTIONS = [
  { value: 'all', label: 'Seluruh Sekolah' },
  { value: 'grade', label: 'Per Tingkat' },
  { value: 'class', label: 'Per Rombel' },
];

export default function AcademicEventImportModal({
  isOpen = false,
  onClose,
  classList = [],
  onImportSuccess,
}) {
  const [step, setStep] = useState('upload'); // 'upload' | 'preview' | 'result'
  const [selectedFile, setSelectedFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);

  // Preview Data
  const [previewToken, setPreviewToken] = useState(null);
  const [academicYear, setAcademicYear] = useState('');
  const [previewSummary, setPreviewSummary] = useState(null);
  const [items, setItems] = useState([]);
  const [statusFilter, setStatusFilter] = useState('ALL'); // 'ALL' | 'needs_review' | 'duplicate' | 'valid'
  const [duplicateMode, setDuplicateMode] = useState('skip'); // 'skip' | 'update'

  // Commit States
  const [isCommitting, setIsCommitting] = useState(false);
  const [commitError, setCommitError] = useState(null);
  const [commitResult, setCommitResult] = useState(null);

  const fileInputRef = useRef(null);

  const handleReset = () => {
    setStep('upload');
    setSelectedFile(null);
    setIsUploading(false);
    setUploadError(null);
    setPreviewToken(null);
    setAcademicYear('');
    setPreviewSummary(null);
    setItems([]);
    setStatusFilter('ALL');
    setDuplicateMode('skip');
    setIsCommitting(false);
    setCommitError(null);
    setCommitResult(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleClose = () => {
    handleReset();
    onClose?.();
  };

  // 1. File Selection Handler
  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    setUploadError(null);
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.xlsx')) {
      setUploadError('Berkas harus berupa spreadsheet Excel dengan format .xlsx');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setUploadError('Ukuran berkas tidak boleh melebihi 5 MB.');
      return;
    }

    setSelectedFile(file);
  };

  // 2. Upload & Generate Preview
  const handleGeneratePreview = async () => {
    if (!selectedFile) return;

    setIsUploading(true);
    setUploadError(null);

    const formData = new FormData();
    formData.append('file', selectedFile);

    try {
      const res = await academicEventApi.importPreview(formData);
      const payload = res?.data ?? res;

      if (!payload || !payload.preview_token) {
        throw new Error(res?.message || 'Gagal memproses pratinjau berkas Excel.');
      }

      setPreviewToken(payload.preview_token);
      setAcademicYear(payload.academic_year || '2026/2027');
      setPreviewSummary(payload.summary || null);
      setItems(Array.isArray(payload.items) ? payload.items : []);
      setStep('preview');
    } catch (err) {
      setUploadError(
        err.response?.data?.message || err.message || 'Gagal menganalisis berkas Excel Kalender Akademik.'
      );
    } finally {
      setIsUploading(false);
    }
  };

  // 3. Item Field Update Handlers
  const handleUpdateItem = (itemId, field, value) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== itemId) return item;

        const updated = { ...item, [field]: value };

        // Otomatis sesuaikan disables_teaching jika kategori diubah
        if (field === 'type') {
          const opt = EVENT_TYPE_OPTIONS.find((o) => o.value === value);
          if (opt) {
            updated.disables_teaching = opt.defaultDisabled;
          }
        }

        // Reset scope_targets jika scope_type diubah ke 'all'
        if (field === 'scope_type' && value === 'all') {
          updated.scope_targets = null;
        } else if (field === 'scope_type' && value === 'grade' && (!updated.scope_targets || updated.scope_targets.length === 0)) {
          updated.scope_targets = ['10', '11', '12'];
        }

        return updated;
      })
    );
  };

  const handleToggleGradeTarget = (itemId, gradeStr) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== itemId) return item;
        const current = Array.isArray(item.scope_targets) ? [...item.scope_targets] : [];
        const idx = current.indexOf(gradeStr);
        if (idx >= 0) {
          current.splice(idx, 1);
        } else {
          current.push(gradeStr);
        }
        return {
          ...item,
          scope_targets: current.sort(),
        };
      })
    );
  };

  const handleToggleSelectAll = (checked) => {
    setItems((prev) =>
      prev.map((item) => (item.status === 'error' ? item : { ...item, is_selected: checked }))
    );
  };

  // Filtered rows for display
  const filteredItems = useMemo(() => {
    if (statusFilter === 'ALL') return items;
    if (statusFilter === 'needs_review') return items.filter((i) => i.status === 'needs_review');
    if (statusFilter === 'duplicate') return items.filter((i) => i.is_duplicate);
    if (statusFilter === 'valid') return items.filter((i) => i.status === 'valid' && !i.is_duplicate);
    return items;
  }, [items, statusFilter]);

  const selectedCount = useMemo(() => {
    return items.filter((i) => i.is_selected).length;
  }, [items]);

  // 4. Commit Handler
  const handleCommit = async () => {
    if (!previewToken) return;

    const itemsToCommit = items.filter((i) => i.is_selected);
    if (itemsToCommit.length === 0) {
      setCommitError('Pilih minimal satu agenda untuk diimpor.');
      return;
    }

    setIsCommitting(true);
    setCommitError(null);

    try {
      const payload = {
        preview_token: previewToken,
        duplicate_mode: duplicateMode,
        items: itemsToCommit,
      };

      const res = await academicEventApi.importCommit(payload);
      const resData = res?.data ?? res;

      setCommitResult(resData || { created: itemsToCommit.length, updated: 0, skipped: 0 });
      setStep('result');
    } catch (err) {
      setCommitError(
        err.response?.data?.message || err.message || 'Gagal menyimpan agenda kalender akademik.'
      );
    } finally {
      setIsCommitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={
        step === 'upload'
          ? 'Import Kalender Akademik (Excel)'
          : step === 'preview'
          ? `Tinjau & Edit Agenda Kaldik TA ${academicYear}`
          : 'Hasil Import Kalender Akademik'
      }
      size={step === 'preview' ? 'full' : 'lg'}
    >
      {/* ================= STEP 1: UPLOAD ================= */}
      {step === 'upload' && (
        <div className="space-y-4 py-2">
          <div className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center bg-gray-50/50 hover:bg-gray-50 transition-colors">
            <div className="mx-auto w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mb-3">
              <FileSpreadsheet size={28} />
            </div>
            <h3 className="text-sm font-semibold text-gray-900 mb-1">
              Pilih Berkas Kalender Pendidikan (.xlsx)
            </h3>
            <p className="text-xs text-gray-500 max-w-md mx-auto mb-4">
              Sistem mendukung format tata letak visual Kaldik SMKN 1 Bantul (Sheet &quot;SMK&quot;).
              Ukuran berkas maksimal 5 MB.
            </p>

            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx"
              onChange={handleFileChange}
              className="hidden"
              id="kaldik-file-upload"
            />
            <label
              htmlFor="kaldik-file-upload"
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium rounded-lg text-white bg-blue-600 hover:bg-blue-700 cursor-pointer shadow-sm transition-all"
            >
              <span>Pilih File Spreadsheet</span>
            </label>

            {selectedFile && (
              <div className="mt-4 inline-flex items-center gap-2 px-3 py-1.5 bg-emerald-50 text-emerald-800 text-xs rounded-md border border-emerald-200">
                <CheckCircle2 size={15} className="text-emerald-600 shrink-0" />
                <span className="font-medium">{selectedFile.name}</span>
                <span className="text-gray-400">({(selectedFile.size / 1024).toFixed(1)} KB)</span>
              </div>
            )}
          </div>

          {uploadError && (
            <div className="p-3 bg-red-50 text-red-700 text-xs rounded-lg border border-red-200 flex items-start gap-2">
              <AlertCircle size={16} className="text-red-500 shrink-0 mt-0.5" />
              <span>{uploadError}</span>
            </div>
          )}

          <div className="p-3.5 bg-blue-50/60 text-blue-900 text-xs rounded-lg border border-blue-100 space-y-1.5">
            <div className="flex items-center gap-1.5 font-medium text-blue-800">
              <Info size={15} className="text-blue-600" />
              <span>Fitur Analisis Cerdas:</span>
            </div>
            <ul className="list-disc pl-5 space-y-1 text-gray-600">
              <li>Otomatis mendeteksi tahun ajaran dan memindai 3 kolom blok bulanan secara horizontal.</li>
              <li>Otomatis mengklasifikasikan Libur Resmi, Ujian / Asesmen, dan Acara Sekolah serta status libur KBM.</li>
              <li>Mendeteksi agenda spesifik tingkat kelas (contoh: TKA kelas XII) dan anomali tahun/tanggal.</li>
              <li>Anda dapat meninjau, mengedit, atau membatalkan entri agenda sebelum disimpan ke database.</li>
            </ul>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
            <Button variant="secondary" onClick={handleClose}>
              Batal
            </Button>
            <Button
              variant="primary"
              disabled={!selectedFile || isUploading}
              onClick={handleGeneratePreview}
              className="flex items-center gap-1.5"
            >
              {isUploading ? (
                <>
                  <RefreshCw size={14} className="animate-spin" />
                  <span>Menganalisis...</span>
                </>
              ) : (
                <>
                  <span>Lanjutkan ke Tinjauan</span>
                  <ArrowRight size={14} />
                </>
              )}
            </Button>
          </div>
        </div>
      )}

      {/* ================= STEP 2: PREVIEW & REVIEW ================= */}
      {step === 'preview' && (
        <div className="space-y-4">
          {/* Summary KPIs & Duplicate Option */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 p-3 bg-gray-50 rounded-xl border border-gray-200">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setStatusFilter('ALL')}
                className={`px-2.5 py-1 text-xs rounded-md font-medium transition-all ${
                  statusFilter === 'ALL'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-100'
                }`}
              >
                Semua ({items.length})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('needs_review')}
                className={`px-2.5 py-1 text-xs rounded-md font-medium transition-all ${
                  statusFilter === 'needs_review'
                    ? 'bg-amber-600 text-white shadow-sm'
                    : 'bg-white text-amber-700 border border-amber-200 hover:bg-amber-50'
                }`}
              >
                Perlu Tinjauan ({previewSummary?.warning_count || 0})
              </button>
              {previewSummary?.duplicate_count > 0 && (
                <button
                  type="button"
                  onClick={() => setStatusFilter('duplicate')}
                  className={`px-2.5 py-1 text-xs rounded-md font-medium transition-all ${
                    statusFilter === 'duplicate'
                      ? 'bg-purple-600 text-white shadow-sm'
                      : 'bg-white text-purple-700 border border-purple-200 hover:bg-purple-50'
                  }`}
                >
                  Duplikat ({previewSummary?.duplicate_count})
                </button>
              )}
              <button
                type="button"
                onClick={() => setStatusFilter('valid')}
                className={`px-2.5 py-1 text-xs rounded-md font-medium transition-all ${
                  statusFilter === 'valid'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'bg-white text-emerald-700 border border-emerald-200 hover:bg-emerald-50'
                }`}
              >
                Valid Langsung ({previewSummary?.valid_count || 0})
              </button>
            </div>

            <div className="flex items-center gap-2 text-xs">
              <span className="text-gray-600 font-medium">Jika data duplikat:</span>
              <select
                value={duplicateMode}
                onChange={(e) => setDuplicateMode(e.target.value)}
                className="px-2 py-1 text-xs border border-gray-300 rounded bg-white font-medium text-gray-700 focus:ring-1 focus:ring-blue-500"
              >
                <option value="skip">Lewati Duplikat (Skip)</option>
                <option value="update">Perbarui Data Existing (Update)</option>
              </select>
            </div>
          </div>

          {commitError && (
            <div className="p-3 bg-red-50 text-red-700 text-xs rounded-lg border border-red-200 flex items-start gap-2">
              <AlertCircle size={16} className="text-red-500 shrink-0 mt-0.5" />
              <span>{commitError}</span>
            </div>
          )}

          {/* Table Container */}
          <div className="border border-gray-200 rounded-lg overflow-x-auto max-h-[52vh]">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-gray-100 text-gray-700 sticky top-0 z-10 font-semibold border-b border-gray-200">
                <tr>
                  <th className="p-2.5 w-10 text-center">
                    <input
                      type="checkbox"
                      checked={items.length > 0 && selectedCount === items.filter((i) => i.status !== 'error').length}
                      onChange={(e) => handleToggleSelectAll(e.target.checked)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      title="Pilih Semua"
                    />
                  </th>
                  <th className="p-2.5 w-28">Status</th>
                  <th className="p-2.5 w-64">Nama Agenda</th>
                  <th className="p-2.5 w-36">Mulai</th>
                  <th className="p-2.5 w-36">Selesai</th>
                  <th className="p-2.5 w-44">Kategori</th>
                  <th className="p-2.5 w-48">Cakupan</th>
                  <th className="p-2.5 w-28 text-center">Libur KBM</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {filteredItems.map((item, idx) => {
                  const hasWarning = item.warnings && item.warnings.length > 0;
                  return (
                    <tr
                      key={item.id}
                      className={`hover:bg-blue-50/40 transition-colors ${
                        !item.is_selected ? 'opacity-50 bg-gray-50/30' : ''
                      }`}
                    >
                      {/* Checkbox */}
                      <td className="p-2.5 text-center">
                        <input
                          type="checkbox"
                          checked={Boolean(item.is_selected)}
                          disabled={item.status === 'error'}
                          onChange={(e) => handleUpdateItem(item.id, 'is_selected', e.target.checked)}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                      </td>

                      {/* Status */}
                      <td className="p-2.5">
                        {item.status === 'valid' && !item.is_duplicate && (
                          <Badge variant="success">Siap Import</Badge>
                        )}
                        {item.is_duplicate && (
                          <Badge variant="secondary">Duplikat</Badge>
                        )}
                        {item.status === 'needs_review' && !item.is_duplicate && (
                          <Badge variant="warning">Tinjau</Badge>
                        )}
                        {item.status === 'error' && (
                          <Badge variant="danger">Error</Badge>
                        )}
                      </td>

                      {/* Judul & Warning Alert */}
                      <td className="p-2.5">
                        <input
                          type="text"
                          value={item.title}
                          onChange={(e) => handleUpdateItem(item.id, 'title', e.target.value)}
                          className="w-full px-2 py-1 border border-gray-200 rounded text-xs focus:ring-1 focus:ring-blue-500"
                        />
                        {hasWarning && (
                          <div className="mt-1 space-y-0.5">
                            {item.warnings.map((w, wIdx) => (
                              <div
                                key={wIdx}
                                className="flex items-center gap-1 text-[11px] text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200/60"
                              >
                                <AlertTriangle size={11} className="shrink-0 text-amber-600" />
                                <span className="line-clamp-2">{w}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </td>

                      {/* Tanggal Mulai */}
                      <td className="p-2.5">
                        <input
                          type="date"
                          value={item.start_date || ''}
                          onChange={(e) => handleUpdateItem(item.id, 'start_date', e.target.value)}
                          className="w-full px-2 py-1 border border-gray-200 rounded text-xs focus:ring-1 focus:ring-blue-500"
                        />
                      </td>

                      {/* Tanggal Selesai */}
                      <td className="p-2.5">
                        <input
                          type="date"
                          value={item.end_date || ''}
                          onChange={(e) => handleUpdateItem(item.id, 'end_date', e.target.value)}
                          className="w-full px-2 py-1 border border-gray-200 rounded text-xs focus:ring-1 focus:ring-blue-500"
                        />
                      </td>

                      {/* Kategori */}
                      <td className="p-2.5">
                        <select
                          value={item.type}
                          onChange={(e) => handleUpdateItem(item.id, 'type', e.target.value)}
                          className="w-full px-2 py-1 border border-gray-200 rounded text-xs bg-white focus:ring-1 focus:ring-blue-500"
                        >
                          {EVENT_TYPE_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      </td>

                      {/* Cakupan & Target */}
                      <td className="p-2.5">
                        <select
                          value={item.scope_type}
                          onChange={(e) => handleUpdateItem(item.id, 'scope_type', e.target.value)}
                          className="w-full px-2 py-1 border border-gray-200 rounded text-xs bg-white focus:ring-1 focus:ring-blue-500 mb-1"
                        >
                          {SCOPE_TYPE_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>

                        {/* Grade checkboxes jika scope_type = 'grade' */}
                        {item.scope_type === 'grade' && (
                          <div className="flex items-center gap-2 pt-0.5">
                            {['10', '11', '12'].map((g) => {
                              const isChecked = Array.isArray(item.scope_targets) && item.scope_targets.includes(g);
                              return (
                                <label
                                  key={g}
                                  className="inline-flex items-center gap-1 text-[11px] text-gray-700 cursor-pointer"
                                >
                                  <input
                                    type="checkbox"
                                    checked={isChecked}
                                    onChange={() => handleToggleGradeTarget(item.id, g)}
                                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 w-3 h-3"
                                  />
                                  <span>Kls {g}</span>
                                </label>
                              );
                            })}
                          </div>
                        )}
                      </td>

                      {/* Toggle Libur KBM */}
                      <td className="p-2.5 text-center">
                        <label className="inline-flex items-center gap-1.5 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={Boolean(item.disables_teaching)}
                            onChange={(e) =>
                              handleUpdateItem(item.id, 'disables_teaching', e.target.checked)
                            }
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                          <span
                            className={`text-[11px] font-medium ${
                              item.disables_teaching ? 'text-rose-600 font-semibold' : 'text-gray-400'
                            }`}
                          >
                            {item.disables_teaching ? 'Libur' : 'Aktif'}
                          </span>
                        </label>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Footer Preview */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-gray-100">
            <div className="text-xs text-gray-500">
              Menampilkan <span className="font-semibold text-gray-800">{filteredItems.length}</span> dari{' '}
              <span className="font-semibold text-gray-800">{items.length}</span> agenda ({selectedCount}{' '}
              terpilih untuk diimpor).
            </div>

            <div className="flex items-center gap-2">
              <Button variant="secondary" onClick={() => setStep('upload')}>
                Unggah Ulang
              </Button>
              <Button
                variant="primary"
                disabled={selectedCount === 0 || isCommitting}
                onClick={handleCommit}
                className="flex items-center gap-1.5"
              >
                {isCommitting ? (
                  <>
                    <RefreshCw size={14} className="animate-spin" />
                    <span>Menyimpan ke Kalender...</span>
                  </>
                ) : (
                  <>
                    <Check size={14} />
                    <span>Konfirmasi &amp; Import ({selectedCount} Agenda)</span>
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ================= STEP 3: RESULT ================= */}
      {step === 'result' && (
        <div className="space-y-6 py-6 text-center">
          <div className="w-16 h-16 mx-auto rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <CheckCircle2 size={36} />
          </div>

          <div>
            <h3 className="text-lg font-bold text-gray-900">Import Kalender Akademik Berhasil!</h3>
            <p className="text-xs text-gray-500 mt-1">
              Data kegiatan dan hari libur telah berhasil disimpan dan disinkronkan ke jadwal KBM sekolah.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-3 max-w-md mx-auto">
            <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-100">
              <div className="text-2xl font-bold text-emerald-700">
                {commitResult?.created || 0}
              </div>
              <div className="text-xs text-emerald-600 font-medium mt-0.5">Ditambahkan</div>
            </div>
            <div className="p-3 bg-blue-50 rounded-xl border border-blue-100">
              <div className="text-2xl font-bold text-blue-700">
                {commitResult?.updated || 0}
              </div>
              <div className="text-xs text-blue-600 font-medium mt-0.5">Diperbarui</div>
            </div>
            <div className="p-3 bg-gray-50 rounded-xl border border-gray-200">
              <div className="text-2xl font-bold text-gray-700">
                {commitResult?.skipped || 0}
              </div>
              <div className="text-xs text-gray-500 font-medium mt-0.5">Dilewati</div>
            </div>
          </div>

          <div className="pt-4 border-t border-gray-100">
            <Button
              variant="primary"
              onClick={() => {
                handleClose();
                onImportSuccess?.();
              }}
              className="w-full sm:w-auto px-8"
            >
              Selesai &amp; Buka Kalender
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
