import { useState, useMemo, useRef } from 'react';
import {
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  AlertCircle,
  ArrowRight,
  RotateCw,
  Info,
} from 'lucide-react';
import Modal from '../../../components/shared/Modal';
import Button from '../../../components/shared/Button';
import { teacherAssignmentApi } from '../../../services/masterDataApi';
import './TeacherAssignment.css';

/**
 * Wizard Import Excel Penugasan Wali Kelas & Guru BK
 * Alur: Upload -> Preview -> Mapping Review -> Manual Resolusi -> Konfirmasi -> Commit -> Hasil
 */
export default function TeacherAssignmentImportModal({
  isOpen = false,
  onClose,
  teacherList = [],
  classList = [],
  onImportSuccess,
}) {
  // Step: 'upload' | 'preview' | 'result'
  const [step, setStep] = useState('upload');
  const [selectedFile, setSelectedFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);

  // Data Preview dari Backend
  const [previewToken, setPreviewToken] = useState(null);
  const [previewSummary, setPreviewSummary] = useState(null);
  const [previewRows, setPreviewRows] = useState([]);

  // Manual Mapping State per baris (rowKey -> { class_id, wali_teacher_id, bk_teacher_id })
  const [manualMappings, setManualMappings] = useState({});

  // Commit States
  const [isCommitting, setIsCommitting] = useState(false);
  const [commitError, setCommitError] = useState(null);
  const [commitResult, setCommitResult] = useState(null);

  const fileInputRef = useRef(null);

  // Reset all states
  const handleReset = () => {
    setStep('upload');
    setSelectedFile(null);
    setIsUploading(false);
    setUploadError(null);
    setPreviewToken(null);
    setPreviewSummary(null);
    setPreviewRows([]);
    setManualMappings({});
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

  // 2. Upload & Generate Preview Handler
  const handleGeneratePreview = async () => {
    if (!selectedFile) return;

    setIsUploading(true);
    setUploadError(null);

    const formData = new FormData();
    formData.append('file', selectedFile);

    try {
      const res = await teacherAssignmentApi.importPreview(formData);
      // api.js response interceptor returns response.data directly
      const payload = res?.preview_token ? res : (res?.data || {});
      const token = payload.preview_token;
      const summary = payload.summary || {};
      const rows = Array.isArray(payload.data) ? payload.data : [];

      setPreviewToken(token);
      setPreviewSummary(summary);
      setPreviewRows(rows);

      // Inisialisasi default mapping dari hasil exact & fuzzy match
      const initialMappings = {};
      rows.forEach((row) => {
        const rowKey = row.row_number || row.no;
        initialMappings[rowKey] = {
          class_id: row.class_id || null,
          wali_teacher_id: row.wali_kelas?.matched_teacher?.id || null,
          bk_teacher_id: row.guru_bk?.matched_teacher?.id || null,
        };
      });
      setManualMappings(initialMappings);

      setStep('preview');
    } catch (err) {
      setUploadError(
        err.message || err.response?.data?.message || 'Gagal memproses analisis berkas Excel.'
      );
    } finally {
      setIsUploading(false);
    }
  };

  // 3. Manual Resolution Handlers
  const handleSelectWaliForCandidate = (rowIndex, teacherId) => {
    setManualMappings((prev) => ({
      ...prev,
      [rowIndex]: {
        ...prev[rowIndex],
        wali_teacher_id: teacherId ? Number(teacherId) : null,
      },
    }));
  };

  const handleSelectBkForCandidate = (rowIndex, teacherId) => {
    setManualMappings((prev) => ({
      ...prev,
      [rowIndex]: {
        ...prev[rowIndex],
        bk_teacher_id: teacherId ? Number(teacherId) : null,
      },
    }));
  };

  // 4. Validasi Kelengkapan Sebelum Commit
  const validationState = useMemo(() => {
    let unmappedClasses = 0;
    let unmappedWali = 0;
    let unmappedBk = 0;
    const waliUsageCount = {};

    previewRows.forEach((row) => {
      const rowKey = row.row_number || row.no;
      const map = manualMappings[rowKey] || {};
      if (!map.class_id && !row.class_id) unmappedClasses += 1;
      if (!map.wali_teacher_id) unmappedWali += 1;
      else {
        waliUsageCount[map.wali_teacher_id] = (waliUsageCount[map.wali_teacher_id] || 0) + 1;
      }
      if (!map.bk_teacher_id) unmappedBk += 1;
    });

    const duplicateWaliIds = Object.keys(waliUsageCount).filter(
      (id) => waliUsageCount[id] > 1
    );

    const isValid =
      unmappedClasses === 0 && unmappedWali === 0 && unmappedBk === 0 && duplicateWaliIds.length === 0;

    return {
      isValid,
      unmappedClasses,
      unmappedWali,
      unmappedBk,
      duplicateWaliIds,
    };
  }, [previewRows, manualMappings]);

  // 5. Commit Import Handler
  const handleCommit = async () => {
    if (!validationState.isValid || !previewToken) return;

    setIsCommitting(true);
    setCommitError(null);

    const items = previewRows.map((row) => {
      const rowKey = row.row_number || row.no;
      const map = manualMappings[rowKey] || {};
      return {
        class_id: Number(map.class_id || row.class_id),
        wali_teacher_id: Number(map.wali_teacher_id),
        bk_teacher_id: Number(map.bk_teacher_id),
      };
    });

    try {
      const res = await teacherAssignmentApi.importCommit({
        preview_token: previewToken,
        items,
      });

      const commitData = res?.summary || res?.data?.summary || res?.data || { total_classes_processed: items.length };
      setCommitResult(commitData);
      setStep('result');
      onImportSuccess?.();
    } catch (err) {
      if (err.status === 409 || err.status === 410 || err.response?.status === 409 || err.response?.status === 410) {
        setCommitError('Token pratinjau sudah kedaluwarsa atau pernah di-commit sebelumnya. Silakan unggah ulang berkas.');
      } else {
        setCommitError(err.message || err.response?.data?.message || 'Gagal menyimpan penugasan ke database.');
      }
    } finally {
      setIsCommitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Import Penugasan Wali Kelas & Guru BK (Excel)"
      size="xl"
      footer={
        <div className="flex justify-between items-center w-full">
          {step === 'preview' ? (
            <Button variant="secondary" onClick={() => setStep('upload')} disabled={isCommitting}>
              Kembali ke Unggah
            </Button>
          ) : (
            <div />
          )}

          <div className="flex gap-2">
            <Button variant="secondary" onClick={handleClose} disabled={isUploading || isCommitting}>
              {step === 'result' ? 'Tutup' : 'Batal'}
            </Button>

            {step === 'upload' && (
              <Button
                variant="primary"
                icon={ArrowRight}
                onClick={handleGeneratePreview}
                disabled={!selectedFile || isUploading}
                loading={isUploading}
              >
                Pratinjau Pemetaan
              </Button>
            )}

            {step === 'preview' && (
              <Button
                variant="primary"
                icon={CheckCircle2}
                onClick={handleCommit}
                disabled={!validationState.isValid || isCommitting}
                loading={isCommitting}
              >
                Terapkan Penugasan ({previewRows.length} Kelas)
              </Button>
            )}
          </div>
        </div>
      }
    >
      <div className="import-wizard-container">
        {/* ========================================================= */}
        {/* STEP 1: UPLOAD                                            */}
        {/* ========================================================= */}
        {step === 'upload' && (
          <div className="flex flex-col gap-4">
            <div
              className={`import-dropzone ${selectedFile ? 'import-dropzone--active' : ''}`}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx"
                className="hidden"
                onChange={handleFileChange}
              />

              <div className="flex flex-col items-center">
                <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mb-3">
                  <FileSpreadsheet size={24} />
                </div>

                {selectedFile ? (
                  <div>
                    <span className="font-bold text-neutral-800 text-sm block">
                      {selectedFile.name}
                    </span>
                    <span className="text-xs text-neutral-500 mt-1 block">
                      Ukuran: {(selectedFile.size / 1024).toFixed(1)} KB &bull; Klik untuk mengganti
                    </span>
                  </div>
                ) : (
                  <div>
                    <span className="font-semibold text-neutral-800 text-sm block">
                      Pilih berkas Excel (.xlsx) atau seret ke sini
                    </span>
                    <span className="text-xs text-neutral-500 mt-1 block">
                      Gunakan dokumen resmi sekolah: <code>WALI KELAS 2026.2027.xlsx</code>
                    </span>
                  </div>
                )}
              </div>
            </div>

            {uploadError && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg flex items-center gap-2">
                <AlertCircle size={15} className="flex-shrink-0" />
                <span>{uploadError}</span>
              </div>
            )}

            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-neutral-600 flex gap-2.5">
              <Info size={16} className="text-blue-600 flex-shrink-0 mt-0.5" />
              <div>
                <strong>Petunjuk Import:</strong>
                <ul className="list-disc ml-4 mt-1 space-y-1">
                  <li>Sistem membaca baris data (48 rombel kelas) secara otomatis dari berkas resmi sekolah.</li>
                  <li>Nama guru dan rombel kelas dicocokkan secara cerdas menggunakan algoritma 3-Tier.</li>
                  <li>Tahap pratinjau tidak akan mengubah database sebelum Anda menekan tombol konfirmasi.</li>
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* STEP 2: PREVIEW & MAPPING REVIEW                          */}
        {/* ========================================================= */}
        {step === 'preview' && (
          <div className="flex flex-col gap-4">
            {/* Summary Stat Banner */}
            <div className="import-summary-banner">
              <div className="import-summary-item import-summary-item--total">
                <span className="text-lg font-bold block">{previewSummary?.total_rows ?? previewRows.length}</span>
                <span className="text-[11px] text-neutral-600 uppercase font-semibold">Total Rombel</span>
              </div>
              <div className="import-summary-item import-summary-item--exact">
                <span className="text-lg font-bold block">{previewSummary?.exact_matched ?? 0}</span>
                <span className="text-[11px] uppercase font-semibold">Cocok Pasti</span>
              </div>
              <div className="import-summary-item import-summary-item--fuzzy">
                <span className="text-lg font-bold block">
                  {(previewSummary?.fuzzy_matched || 0) + (previewSummary?.ambiguous || 0)}
                </span>
                <span className="text-[11px] uppercase font-semibold">Perlu Konfirmasi</span>
              </div>
              <div className="import-summary-item import-summary-item--notfound">
                <span className="text-lg font-bold block">{previewSummary?.unmatched ?? 0}</span>
                <span className="text-[11px] uppercase font-semibold">Tidak Ditemukan</span>
              </div>
            </div>

            {/* Error & Validation Banner */}
            {commitError && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg flex items-center gap-2">
                <XCircle size={15} className="flex-shrink-0" />
                <span>{commitError}</span>
              </div>
            )}

            {!validationState.isValid && (
              <div className="p-3 bg-amber-50 border border-amber-200 text-amber-800 text-xs rounded-lg flex items-start gap-2">
                <AlertTriangle size={15} className="flex-shrink-0 mt-0.5" />
                <div>
                  <strong>Pemetaan Belum Lengkap:</strong>
                  {validationState.unmappedClasses > 0 && (
                    <span className="block">&bull; Terdapat {validationState.unmappedClasses} kelas yang tidak terdaftar di database.</span>
                  )}
                  {validationState.unmappedWali > 0 && (
                    <span className="block">&bull; Terdapat {validationState.unmappedWali} kelas tanpa pemetaan Wali Kelas.</span>
                  )}
                  {validationState.unmappedBk > 0 && (
                    <span className="block">&bull; Terdapat {validationState.unmappedBk} kelas tanpa pemetaan Guru BK.</span>
                  )}
                  {validationState.duplicateWaliIds.length > 0 && (
                    <span className="block font-semibold">&bull; Ada guru yang ditugaskan sebagai Wali Kelas di lebih dari satu kelas! Harap koreksi manual.</span>
                  )}
                </div>
              </div>
            )}

            {/* Preview Table */}
            <div className="import-table-container">
              <table className="import-table">
                <thead>
                  <tr>
                    <th style={{ width: '45px' }}>No</th>
                    <th style={{ width: '140px' }}>Rombel Excel</th>
                    <th>Pemetaan Wali Kelas</th>
                    <th>Pemetaan Guru BK / Kesiswaan</th>
                  </tr>
                </thead>
                <tbody>
                  {previewRows.map((row, idx) => {
                    const rowKey = row.row_number || row.no || (idx + 1);
                    const waliMatch = row.wali_kelas || {};
                    const bkMatch = row.guru_bk || {};
                    const isClassMatched = row.class_status === 'matched' && Boolean(row.class_id);

                    const isWaliExact = waliMatch.status === 'matched' && waliMatch.matched_teacher?.id;
                    const isBkExact = bkMatch.status === 'matched' && bkMatch.matched_teacher?.id;
                    const isAllExact = isClassMatched && isWaliExact && isBkExact;

                    const rowClass = isAllExact
                      ? 'import-row--exact'
                      : !isClassMatched || waliMatch.status === 'not_found' || bkMatch.status === 'not_found'
                      ? 'import-row--notfound'
                      : 'import-row--fuzzy';

                    const currentWaliId = manualMappings[rowKey]?.wali_teacher_id;
                    const currentBkId = manualMappings[rowKey]?.bk_teacher_id;

                    return (
                      <tr key={rowKey} className={rowClass}>
                        <td className="text-center font-mono text-xs text-neutral-400">
                          {row.no || idx + 1}
                        </td>

                        {/* Kelas */}
                        <td>
                          <div className="font-semibold text-neutral-900">{row.raw_class}</div>
                          {isClassMatched ? (
                            <span className="import-status-tag import-status-tag--exact">
                              ✓ {row.clean_class}
                            </span>
                          ) : (
                            <span className="import-status-tag import-status-tag--notfound">
                              ✕ Kelas Tidak Ditemukan
                            </span>
                          )}
                        </td>

                        {/* Wali Kelas */}
                        <td>
                          <div className="text-xs text-neutral-700 mb-1 font-medium">
                            {waliMatch.raw_name || <span className="italic text-neutral-400">Kosong</span>}
                          </div>

                          {isWaliExact && currentWaliId === waliMatch.matched_teacher?.id ? (
                            <div className="flex items-center gap-2">
                              <span className="import-status-tag import-status-tag--exact">
                                ✓ {waliMatch.matched_teacher?.name} ({waliMatch.matched_teacher?.nis_nip || 'NIP -'})
                              </span>
                              <button
                                type="button"
                                className="text-[11px] text-blue-600 hover:underline cursor-pointer ml-1"
                                onClick={() => handleSelectWaliForCandidate(rowKey, '')}
                              >
                                Ubah
                              </button>
                            </div>
                          ) : (
                            <select
                              className="text-xs p-1.5 border border-amber-300 rounded bg-white w-full max-w-xs outline-none focus:ring-1 focus:ring-amber-500"
                              value={currentWaliId || ''}
                              onChange={(e) => handleSelectWaliForCandidate(rowKey, e.target.value)}
                            >
                              <option value="">-- Pilih Guru Wali Kelas --</option>
                              {Array.isArray(waliMatch.candidates) &&
                                waliMatch.candidates.map((c) => (
                                  <option key={c.id} value={c.id}>
                                    ⭐ {c.name} ({c.similarity ? Math.round(c.similarity) + '%' : 'Kandidat'})
                                  </option>
                                ))}
                              <optgroup label="Seluruh Guru Terdaftar">
                                {teacherList.map((t) => (
                                  <option key={t.id} value={t.id}>
                                    {t.name} ({t.nis_nip || 'NIP -'})
                                  </option>
                                ))}
                              </optgroup>
                            </select>
                          )}
                        </td>

                        {/* Guru BK */}
                        <td>
                          <div className="text-xs text-neutral-700 mb-1 font-medium">
                            {bkMatch.raw_name || <span className="italic text-neutral-400">Kosong</span>}
                          </div>

                          {isBkExact && currentBkId === bkMatch.matched_teacher?.id ? (
                            <div className="flex items-center gap-2">
                              <span className="import-status-tag import-status-tag--exact">
                                ✓ {bkMatch.matched_teacher?.name} ({bkMatch.matched_teacher?.nis_nip || 'NIP -'})
                              </span>
                              <button
                                type="button"
                                className="text-[11px] text-blue-600 hover:underline cursor-pointer ml-1"
                                onClick={() => handleSelectBkForCandidate(rowKey, '')}
                              >
                                Ubah
                              </button>
                            </div>
                          ) : (
                            <select
                              className="text-xs p-1.5 border border-amber-300 rounded bg-white w-full max-w-xs outline-none focus:ring-1 focus:ring-blue-500"
                              value={currentBkId || ''}
                              onChange={(e) => handleSelectBkForCandidate(rowKey, e.target.value)}
                            >
                              <option value="">-- Pilih Guru BK --</option>
                              {Array.isArray(bkMatch.candidates) &&
                                bkMatch.candidates.map((c) => (
                                  <option key={c.id} value={c.id}>
                                    ⭐ {c.name} ({c.similarity ? Math.round(c.similarity) + '%' : 'Kandidat'})
                                  </option>
                                ))}
                              <optgroup label="Seluruh Guru Terdaftar">
                                {teacherList.map((t) => (
                                  <option key={t.id} value={t.id}>
                                    {t.name} ({t.nis_nip || 'NIP -'})
                                  </option>
                                ))}
                              </optgroup>
                            </select>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* STEP 3: RESULT                                            */}
        {/* ========================================================= */}
        {step === 'result' && (
          <div className="flex flex-col items-center justify-center p-6 text-center">
            <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-4">
              <CheckCircle2 size={36} />
            </div>

            <h3 className="text-xl font-bold text-neutral-900 mb-1">
              Import Penugasan Berhasil!
            </h3>
            <p className="text-sm text-neutral-600 max-w-md mb-6">
              Seluruh pemetaan penugasan Wali Kelas dan Guru BK/Kesiswaan dari berkas Excel resmi telah berhasil diterapkan ke sistem.
            </p>

            <div className="grid grid-cols-3 gap-3 w-full max-w-md bg-neutral-50 p-4 border border-neutral-200 rounded-xl mb-6">
              <div>
                <span className="text-xl font-bold text-neutral-900 block">
                  {commitResult?.committed_classes || commitResult?.total_classes_processed || previewRows.length}
                </span>
                <span className="text-[11px] text-neutral-500 uppercase font-semibold">Kelas Diproses</span>
              </div>
              <div>
                <span className="text-xl font-bold text-emerald-600 block">
                  {commitResult?.wali_assignments_created ?? commitResult?.wali_kelas_assigned ?? previewRows.length}
                </span>
                <span className="text-[11px] text-neutral-500 uppercase font-semibold">Wali Ditugaskan</span>
              </div>
              <div>
                <span className="text-xl font-bold text-blue-600 block">
                  {commitResult?.bk_assignments_created ?? commitResult?.bk_assigned ?? previewRows.length}
                </span>
                <span className="text-[11px] text-neutral-500 uppercase font-semibold">BK Ditugaskan</span>
              </div>
            </div>

            <Button variant="primary" onClick={handleClose}>
              Selesai & Tutup
            </Button>
          </div>
        )}
      </div>
    </Modal>
  );
}
