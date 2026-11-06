import { useState, useMemo, useRef } from 'react';
import {
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  AlertCircle,
  ArrowRight,
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

  // 4b. Pengelompokan Baris: Belum Lengkap (Atas) vs Sudah Lengkap (Bawah)
  const { incompleteRows, completeRows } = useMemo(() => {
    const incomplete = [];
    const complete = [];

    previewRows.forEach((row, idx) => {
      const rowKey = row.row_number || row.no || (idx + 1);
      const map = manualMappings[rowKey] || {};

      const hasClass = Boolean(map.class_id || row.class_id);
      const hasWali = Boolean(map.wali_teacher_id);
      const hasBk = Boolean(map.bk_teacher_id);

      const isRowComplete = hasClass && hasWali && hasBk;

      const item = {
        ...row,
        originalIndex: row.no || (idx + 1),
        rowKey,
        isRowComplete,
      };

      if (!isRowComplete) {
        incomplete.push(item);
      } else {
        complete.push(item);
      }
    });

    return { incompleteRows: incomplete, completeRows: complete };
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

  // Helper render baris penugasan kelas secara seragam
  const renderAssignmentRow = (row, isPriority = false) => {
    const rowKey = row.rowKey;
    const waliMatch = row.wali_kelas || {};
    const bkMatch = row.guru_bk || {};
    const isClassMatched = row.class_status === 'matched' && Boolean(row.class_id);

    const currentWaliId = manualMappings[rowKey]?.wali_teacher_id;
    const currentBkId = manualMappings[rowKey]?.bk_teacher_id;

    const isWaliMissing = !currentWaliId;
    const isBkMissing = !currentBkId;

    return (
      <tr key={rowKey} className={isPriority ? 'import-row--incomplete' : 'import-row--complete'}>
        <td className="text-center font-mono text-xs text-neutral-500 font-semibold">
          {row.originalIndex}
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
          <div className="text-[11px] text-neutral-500 mb-1 font-medium truncate" title={waliMatch.raw_name || ''}>
            Excel: <span className="text-neutral-700 font-semibold">{waliMatch.raw_name || <span className="italic text-neutral-400">Kosong</span>}</span>
          </div>

          <select
            className={`import-select-control ${isWaliMissing ? 'import-select-control--error' : ''}`}
            value={currentWaliId || ''}
            onChange={(e) => handleSelectWaliForCandidate(rowKey, e.target.value)}
          >
            <option value="">-- Pilih Guru Wali Kelas --</option>
            {Array.isArray(waliMatch.candidates) && waliMatch.candidates.length > 0 && (
              <optgroup label="Rekomendasi Pencocokan">
                {waliMatch.candidates.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} {c.nis_nip ? `(${c.nis_nip})` : ''}
                  </option>
                ))}
              </optgroup>
            )}
            {waliMatch.matched_teacher?.id &&
              !waliMatch.candidates?.some((c) => c.id === waliMatch.matched_teacher.id) &&
              !teacherList.some((t) => t.id === waliMatch.matched_teacher.id) && (
                <option value={waliMatch.matched_teacher.id}>
                  {waliMatch.matched_teacher.name} ({waliMatch.matched_teacher.nis_nip || 'NIP -'})
                </option>
              )}
            <optgroup label="Seluruh Guru Terdaftar">
              {teacherList.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({t.nis_nip || 'NIP -'})
                </option>
              ))}
            </optgroup>
          </select>
        </td>

        {/* Guru BK / Kesiswaan */}
        <td>
          <div className="text-[11px] text-neutral-500 mb-1 font-medium truncate" title={bkMatch.raw_name || ''}>
            Excel: <span className="text-neutral-700 font-semibold">{bkMatch.raw_name || <span className="italic text-neutral-400">Kosong</span>}</span>
          </div>

          <select
            className={`import-select-control ${isBkMissing ? 'import-select-control--error' : ''}`}
            value={currentBkId || ''}
            onChange={(e) => handleSelectBkForCandidate(rowKey, e.target.value)}
          >
            <option value="">-- Pilih Guru BK / Kesiswaan --</option>
            {Array.isArray(bkMatch.candidates) && bkMatch.candidates.length > 0 && (
              <optgroup label="Rekomendasi Pencocokan">
                {bkMatch.candidates.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} {c.nis_nip ? `(${c.nis_nip})` : ''}
                  </option>
                ))}
              </optgroup>
            )}
            {bkMatch.matched_teacher?.id &&
              !bkMatch.candidates?.some((c) => c.id === bkMatch.matched_teacher.id) &&
              !teacherList.some((t) => t.id === bkMatch.matched_teacher.id) && (
                <option value={bkMatch.matched_teacher.id}>
                  {bkMatch.matched_teacher.name} ({bkMatch.matched_teacher.nis_nip || 'NIP -'})
                </option>
              )}
            <optgroup label="Seluruh Guru Terdaftar">
              {teacherList.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({t.nis_nip || 'NIP -'})
                </option>
              ))}
            </optgroup>
          </select>
        </td>
      </tr>
    );
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
                <span className="text-lg font-bold block">{previewRows.length}</span>
                <span className="text-[11px] text-neutral-600 uppercase font-semibold">Total Rombel</span>
              </div>
              <div className="import-summary-item import-summary-item--exact">
                <span className="text-lg font-bold block">{completeRows.length}</span>
                <span className="text-[11px] uppercase font-semibold">Sudah Lengkap</span>
              </div>
              <div className="import-summary-item import-summary-item--fuzzy">
                <span className="text-lg font-bold block">{incompleteRows.length}</span>
                <span className="text-[11px] uppercase font-semibold">Belum Lengkap</span>
              </div>
              <div className="import-summary-item import-summary-item--notfound">
                <span className="text-lg font-bold block">{validationState.unmappedClasses}</span>
                <span className="text-[11px] uppercase font-semibold">Kelas Tak Terdaftar</span>
              </div>
            </div>

            {/* Error & Validation Banner */}
            {commitError && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg flex items-center gap-2">
                <XCircle size={15} className="flex-shrink-0" />
                <span>{commitError}</span>
              </div>
            )}

            {!validationState.isValid ? (
              <div className="p-3 bg-amber-50 border border-amber-200 text-amber-800 text-xs rounded-lg flex items-start gap-2">
                <AlertTriangle size={15} className="flex-shrink-0 mt-0.5 text-amber-600" />
                <div>
                  <strong>Pemetaan Belum Lengkap (Perlu Tindakan):</strong>
                  {validationState.unmappedClasses > 0 && (
                    <span className="block">&bull; Terdapat {validationState.unmappedClasses} kelas yang tidak terdaftar di database.</span>
                  )}
                  {validationState.unmappedWali > 0 && (
                    <span className="block">&bull; Terdapat {validationState.unmappedWali} kelas tanpa pemetaan Wali Kelas (cek tabel bagian atas).</span>
                  )}
                  {validationState.unmappedBk > 0 && (
                    <span className="block">&bull; Terdapat {validationState.unmappedBk} kelas tanpa pemetaan Guru BK/Kesiswaan (cek tabel bagian atas).</span>
                  )}
                  {validationState.duplicateWaliIds.length > 0 && (
                    <span className="block font-semibold text-red-700">&bull; Ada guru yang ditugaskan sebagai Wali Kelas di lebih dari satu kelas! Harap koreksi manual.</span>
                  )}
                </div>
              </div>
            ) : (
              <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-lg flex items-center gap-2">
                <CheckCircle2 size={16} className="text-emerald-600 flex-shrink-0" />
                <span>Seluruh rombel ({previewRows.length} Kelas) telah terpetakan dengan lengkap dan siap diterapkan ke database.</span>
              </div>
            )}

            {/* Preview Table */}
            <div className="import-table-container">
              <table className="import-table">
                <thead>
                  <tr>
                    <th style={{ width: '45px' }}>No</th>
                    <th style={{ width: '130px' }}>Rombel Excel</th>
                    <th>Pemetaan Wali Kelas</th>
                    <th>Pemetaan Guru BK / Kesiswaan</th>
                  </tr>
                </thead>
                <tbody>
                  {/* SEKSI 1: Rombel yang Belum Lengkap (Ditaruh Paling Atas) */}
                  {incompleteRows.length > 0 && (
                    <>
                      <tr className="import-section-header-row">
                        <td colSpan={4}>
                          <div className="import-section-header import-section-header--incomplete">
                            <div className="flex items-center gap-2">
                              <AlertTriangle size={14} className="text-amber-600 flex-shrink-0" />
                              <span>Perlu Tindakan / Belum Lengkap ({incompleteRows.length} Rombel)</span>
                            </div>
                            <span className="text-[11px] font-normal normal-case text-amber-800">
                              Wajib dilengkapi segera sebelum penugasan dapat diterapkan
                            </span>
                          </div>
                        </td>
                      </tr>
                      {incompleteRows.map((row) => renderAssignmentRow(row, true))}
                    </>
                  )}

                  {/* SEKSI 2: Rombel yang Sudah Lengkap */}
                  {completeRows.length > 0 && (
                    <>
                      <tr className="import-section-header-row">
                        <td colSpan={4}>
                          <div className="import-section-header import-section-header--complete">
                            <div className="flex items-center gap-2">
                              <CheckCircle2 size={14} className="text-emerald-600 flex-shrink-0" />
                              <span>Sudah Terpetakan Lengkap ({completeRows.length} Rombel)</span>
                            </div>
                            <span className="text-[11px] font-normal normal-case text-neutral-500">
                              Dapat disesuaikan kembali jika diperlukan
                            </span>
                          </div>
                        </td>
                      </tr>
                      {completeRows.map((row) => renderAssignmentRow(row, false))}
                    </>
                  )}

                  {previewRows.length === 0 && (
                    <tr>
                      <td colSpan={4} className="text-center py-8 text-neutral-400">
                        Tidak ada data rombel yang dimuat.
                      </td>
                    </tr>
                  )}
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
