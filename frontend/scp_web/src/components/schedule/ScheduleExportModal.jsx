import { useState, useMemo, useEffect } from 'react';
import {
  Download,
  FileSpreadsheet,
  FileText,
  FileCode,
  CheckCircle2,
  AlertCircle,
  Info,
  Loader2,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { Modal, Button, Badge } from '../shared';
import { scheduleApi } from '../../services/scheduleApi';
import generateSchedulePdf from '../../utils/schedulePdfGenerator';
import { NUMBER_TO_DAY, resolveSlotTime } from '../../utils/timetableHelper';
import './ScheduleExportModal.css';

/**
 * Format string tanggal lokal YYYY-MM-DD
 */
const getFormattedDate = () => {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}${m}${d}`;
};

export default function ScheduleExportModal({
  isOpen,
  onClose,
  classList = [],
  activeCycle = 1,
  currentSchedules = [],
  mondayIsUpacara = true,
  periodTemplates = [],
  conflictIds = new Set(),
  showToast,
  showErrorToast,
  preSelectedClassId = null,
}) {
  // Format File Pilihan: 'excel' | 'pdf' | 'csv'
  const [exportFormat, setExportFormat] = useState('excel');

  // Pilihan Putaran: 'both' (Putaran 1 & 2) | 1 | 2
  const [cycleChoice, setCycleChoice] = useState('both');

  // Cakupan Rombel: 'all' | 'level' | 'single'
  const [scopeMode, setScopeMode] = useState('all');
  const [selectedLevel, setSelectedLevel] = useState(10);
  const [selectedClassId, setSelectedClassId] = useState('');

  // Status ekspor
  const [isExporting, setIsExporting] = useState(false);
  const [exportStatusText, setExportStatusText] = useState('');

  // Sinkronisasi kelas terpilih jika dibuka dengan preSelectedClassId
  useEffect(() => {
    if (isOpen) {
      if (preSelectedClassId) {
        setScopeMode('single');
        setSelectedClassId(String(preSelectedClassId));
      } else {
        setScopeMode('all');
        if (classList.length > 0) {
          setSelectedClassId(String(classList[0].id));
        }
      }
    }
  }, [isOpen, preSelectedClassId, classList]);

  // Daftar kelas yang terurut rapi
  const sortedClasses = useMemo(() => {
    return [...classList].sort((a, b) => {
      if (a.level !== b.level) return a.level - b.level;
      return a.name.localeCompare(b.name, undefined, { numeric: true });
    });
  }, [classList]);

  // Filter kelas berdasarkan cakupan yang dipilih Waka
  const targetClasses = useMemo(() => {
    if (scopeMode === 'all') return sortedClasses;
    if (scopeMode === 'level') {
      return sortedClasses.filter((c) => Number(c.level) === Number(selectedLevel));
    }
    if (scopeMode === 'single') {
      const found = sortedClasses.find((c) => String(c.id) === String(selectedClassId));
      return found ? [found] : sortedClasses.slice(0, 1);
    }
    return sortedClasses;
  }, [sortedClasses, scopeMode, selectedLevel, selectedClassId]);

  // Menjalankan proses ekspor data jadwal
  const handleExecuteExport = async () => {
    setIsExporting(true);
    setExportStatusText('Mengumpulkan data jadwal KBM...');

    try {
      // 1. Tentukan siklus putaran yang dibutuhkan
      const targetCycles = cycleChoice === 'both' ? [1, 2] : [Number(cycleChoice)];

      // 2. Ambil data jadwal dari API / memori lokal
      let allSchedules = [];

      // Cek apakah data di memori saat ini sudah mencakup seluruh putaran yang diminta
      const currentCycleNum = Number(activeCycle);
      const needFetchOtherCycle =
        targetCycles.includes(1) && targetCycles.includes(2) && !currentSchedules.some((s) => Number(s.cycle_type || s.cycle) === (currentCycleNum === 1 ? 2 : 1));

      if (needFetchOtherCycle) {
        setExportStatusText('Mengambil data jadwal lengkap Putaran 1 & 2 dari server...');
        const [resP1, resP2] = await Promise.all([
          scheduleApi.getSchedules({ cycle: 1, all: 1 }),
          scheduleApi.getSchedules({ cycle: 2, all: 1 }),
        ]);

        const p1Data = Array.isArray(resP1?.data?.data) ? resP1.data.data : Array.isArray(resP1?.data) ? resP1.data : [];
        const p2Data = Array.isArray(resP2?.data?.data) ? resP2.data.data : Array.isArray(resP2?.data) ? resP2.data : [];
        allSchedules = [...p1Data, ...p2Data];
      } else {
        // Jika target cycle adalah cycle aktif atau data sudah ada
        if (targetCycles.length === 1 && targetCycles[0] !== currentCycleNum) {
          setExportStatusText(`Mengambil data jadwal Putaran ${targetCycles[0]}...`);
          const res = await scheduleApi.getSchedules({ cycle: targetCycles[0], all: 1 });
          allSchedules = Array.isArray(res?.data?.data) ? res.data.data : Array.isArray(res?.data) ? res.data : [];
        } else {
          allSchedules = [...currentSchedules];
        }
      }

      // 3. Filter berdasarkan cakupan rombel kelas dan putaran target
      const targetClassIds = new Set(targetClasses.map((c) => c.id));
      const filteredSchedules = allSchedules.filter((s) => {
        const sCycle = Number(s.cycle_type || s.cycle || 1);
        if (!targetCycles.includes(sCycle)) return false;
        const sClassId = s.class_id || s.school_class?.id;
        return targetClassIds.has(sClassId);
      });

      if (filteredSchedules.length === 0) {
        showErrorToast?.('Tidak ada data jadwal yang sesuai dengan kriteria ekspor ini.');
        setIsExporting(false);
        return;
      }

      const dateStr = getFormattedDate();
      const cycleText = targetCycles.length > 1 ? 'Putaran_1_dan_2' : `Putaran_${targetCycles[0]}`;
      const scopeText =
        scopeMode === 'all'
          ? 'Seluruh_Rombel'
          : scopeMode === 'level'
          ? `Tingkat_${selectedLevel}`
          : `Kelas_${(targetClasses[0]?.name || 'Rombel').replace(/\s+/g, '_')}`;

      // ==========================================
      // EKSPOR FORMAT: SPREADSHEET EXCEL (.xlsx)
      // ==========================================
      if (exportFormat === 'excel') {
        setExportStatusText('Menyusun buku kerja spreadsheet Excel...');
        const workbook = XLSX.utils.book_new();

        // Sheet 1: Data Jadwal Tabular Lengkap
        const tabularData = filteredSchedules.map((s, idx) => {
          const dayName =
            typeof s.day_of_week === 'number'
              ? NUMBER_TO_DAY[s.day_of_week] || 'Senin'
              : s.day || 'Senin';
          const period = Number(s.period_number || s.slot || 1);
          const dur = Number(s.duration_periods || s.duration || 1);
          const slotTime = resolveSlotTime(dayName, period, dur, mondayIsUpacara, periodTemplates);

          return {
            No: idx + 1,
            Putaran: `Putaran ${s.cycle_type || s.cycle || 1}`,
            Hari: dayName,
            'Jam Ke': dur > 1 ? `${period} - ${period + dur - 1}` : `${period}`,
            'Durasi (JP)': dur,
            'Waktu Riil': `${slotTime.startTime} - ${slotTime.endTime} WIB`,
            Tingkat: s.school_class?.level || s.level || '-',
            'Rombel Kelas': s.school_class?.name || s.className || '-',
            'Mata Pelajaran': s.subject?.name || s.subjectName || '-',
            Kategori: s.subject?.category === 'jurusan' ? 'Jurusan' : 'Normada',
            'Guru Pengampu': s.teacher?.name || s.teacherName || '-',
            'NIP Guru': s.teacher?.nis_nip || s.teacher?.nip || '-',
            'Ruangan Belajar': s.room?.name || s.roomName || '-',
            'Tipe Ruangan':
              s.room?.type === 'lab_computer'
                ? 'Lab Komputer'
                : s.room?.type === 'field'
                ? 'Lapangan'
                : 'Ruang Teori',
            'Status Validitas': conflictIds.has(s.id) ? 'Bentrok' : 'Valid',
            'Metode Input':
              s.source === 'auto_generated'
                ? 'Generate Otomatis'
                : s.source === 'imported'
                ? 'Import FET'
                : 'Input Manual',
          };
        });

        const tabularSheet = XLSX.utils.json_to_sheet(tabularData);
        XLSX.utils.book_append_sheet(workbook, tabularSheet, 'Data Jadwal Tabular');

        // Sheet 2: Rekapitulasi Beban Mengajar Guru
        const teacherMap = new Map();
        filteredSchedules.forEach((s) => {
          const tId = s.teacher_id || s.teacher?.id;
          const tName = s.teacher?.name || s.teacherName || 'Guru Pengampu';
          const tNip = s.teacher?.nis_nip || s.teacher?.nip || '-';
          const cycle = Number(s.cycle_type || s.cycle || 1);
          const dur = Number(s.duration_periods || s.duration || 1);
          const mapel = s.subject?.name || s.subjectName || '';
          const cls = s.school_class?.name || s.className || '';

          if (!teacherMap.has(tId)) {
            teacherMap.set(tId, {
              name: tName,
              nip: tNip,
              jpP1: 0,
              jpP2: 0,
              subjects: new Set(),
              classes: new Set(),
            });
          }
          const entry = teacherMap.get(tId);
          if (cycle === 1) entry.jpP1 += dur;
          if (cycle === 2) entry.jpP2 += dur;
          if (mapel) entry.subjects.add(mapel);
          if (cls) entry.classes.add(cls);
        });

        const teacherRows = Array.from(teacherMap.values())
          .sort((a, b) => a.name.localeCompare(b.name))
          .map((t, idx) => ({
            No: idx + 1,
            'Nama Guru': t.name,
            'NIP / NUPTK': t.nip,
            'Total JP (Putaran 1)': t.jpP1,
            'Total JP (Putaran 2)': t.jpP2,
            'Rata-Rata JP/Minggu': ((t.jpP1 + t.jpP2) / 2).toFixed(1),
            'Jumlah Rombel': t.classes.size,
            'Mata Pelajaran Diampu': Array.from(t.subjects).join(', '),
          }));

        const teacherSheet = XLSX.utils.json_to_sheet(teacherRows);
        XLSX.utils.book_append_sheet(workbook, teacherSheet, 'Rekap Beban Guru');

        // Sheet 3: Rekapitulasi Beban per Rombel Kelas
        const classSummaryMap = new Map();
        filteredSchedules.forEach((s) => {
          const cId = s.class_id || s.school_class?.id;
          const cName = s.school_class?.name || s.className || 'Kelas';
          const cLevel = s.school_class?.level || s.level || 10;
          const cycle = Number(s.cycle_type || s.cycle || 1);
          const dur = Number(s.duration_periods || s.duration || 1);
          const mapel = s.subject?.name || s.subjectName || '';
          const guru = s.teacher?.name || s.teacherName || '';

          if (!classSummaryMap.has(cId)) {
            classSummaryMap.set(cId, {
              name: cName,
              level: cLevel,
              jpP1: 0,
              jpP2: 0,
              subjects: new Set(),
              teachers: new Set(),
            });
          }
          const entry = classSummaryMap.get(cId);
          if (cycle === 1) entry.jpP1 += dur;
          if (cycle === 2) entry.jpP2 += dur;
          if (mapel) entry.subjects.add(mapel);
          if (guru) entry.teachers.add(guru);
        });

        const classRows = Array.from(classSummaryMap.values())
          .sort((a, b) => {
            if (a.level !== b.level) return a.level - b.level;
            return a.name.localeCompare(b.name, undefined, { numeric: true });
          })
          .map((c, idx) => ({
            No: idx + 1,
            Tingkat: c.level,
            'Rombel Kelas': c.name,
            'Alokasi JP (Putaran 1)': c.jpP1,
            'Alokasi JP (Putaran 2)': c.jpP2,
            'Jumlah Mapel': c.subjects.size,
            'Jumlah Guru Pengampu': c.teachers.size,
          }));

        const classSheet = XLSX.utils.json_to_sheet(classRows);
        XLSX.utils.book_append_sheet(workbook, classSheet, 'Rekap per Rombel');

        const fileName = `Jadwal_Pelajaran_SMKN1_Bantul_${cycleText}_${scopeText}_${dateStr}.xlsx`;
        XLSX.writeFile(workbook, fileName);
        showToast?.(`Berkas Excel jadwal (${fileName}) berhasil diunduh!`);
      }

      // ==========================================
      // EKSPOR FORMAT: DOKUMEN CETAK PDF (.pdf)
      // ==========================================
      else if (exportFormat === 'pdf') {
        setExportStatusText('Menghasilkan berkas cetak PDF landscape...');

        // Jika hanya 1 kelas yang dipilih
        if (scopeMode === 'single') {
          const singleClass = targetClasses[0];
          generateSchedulePdf({
            role: 'waka',
            user: { name: 'Waka Kurikulum' },
            cycles: targetCycles,
            schedules: filteredSchedules,
            mondayIsUpacara,
            periodTemplates,
            academicYear: '2025/2026',
            semester: 'Ganjil',
            homeroomClassName: singleClass.name,
          });
          showToast?.(`Dokumen PDF jadwal kelas ${singleClass.name} berhasil diunduh!`);
        } else {
          // Jika seluruh kelas atau satu tingkat dipilih: Buat dokumen PDF multi-halaman
          // Mengelompokkan per kelas lalu membuat halaman per rombel
          targetClasses.forEach((cls) => {
            const classSchedules = filteredSchedules.filter((s) => {
              const sClassId = s.class_id || s.school_class?.id;
              return sClassId === cls.id;
            });

            if (classSchedules.length > 0) {
              generateSchedulePdf({
                role: 'waka',
                user: { name: 'Waka Kurikulum' },
                cycles: targetCycles,
                schedules: classSchedules,
                mondayIsUpacara,
                periodTemplates,
                academicYear: '2025/2026',
                semester: 'Ganjil',
                homeroomClassName: cls.name,
              });
            }
          });
          showToast?.(`Dokumen PDF jadwal untuk ${targetClasses.length} rombel kelas berhasil diunduh!`);
        }
      }

      // ==========================================
      // EKSPOR FORMAT: BERKAS CSV (.csv)
      // ==========================================
      else if (exportFormat === 'csv') {
        setExportStatusText('Menyusun berkas data CSV...');

        const csvRows = filteredSchedules.map((s, idx) => {
          const dayName =
            typeof s.day_of_week === 'number'
              ? NUMBER_TO_DAY[s.day_of_week] || 'Senin'
              : s.day || 'Senin';
          const period = Number(s.period_number || s.slot || 1);
          const dur = Number(s.duration_periods || s.duration || 1);
          const slotTime = resolveSlotTime(dayName, period, dur, mondayIsUpacara, periodTemplates);

          return {
            No: idx + 1,
            Putaran: s.cycle_type || s.cycle || 1,
            Hari: dayName,
            JamKe: dur > 1 ? `${period}-${period + dur - 1}` : `${period}`,
            DurasiJP: dur,
            WaktuMulai: slotTime.startTime,
            WaktuSelesai: slotTime.endTime,
            Tingkat: s.school_class?.level || s.level || '',
            Kelas: s.school_class?.name || s.className || '',
            MataPelajaran: s.subject?.name || s.subjectName || '',
            Kategori: s.subject?.category === 'jurusan' ? 'Jurusan' : 'Normada',
            GuruPengampu: s.teacher?.name || s.teacherName || '',
            NIPGuru: s.teacher?.nis_nip || s.teacher?.nip || '',
            Ruangan: s.room?.name || s.roomName || '',
            Status: conflictIds.has(s.id) ? 'Bentrok' : 'Valid',
            Sumber: s.source || 'manual',
          };
        });

        const worksheet = XLSX.utils.json_to_sheet(csvRows);
        const csvOutput = XLSX.utils.sheet_to_csv(worksheet);
        const blob = new Blob([csvOutput], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        const fileName = `Jadwal_Pelajaran_SMKN1_Bantul_${cycleText}_${scopeText}_${dateStr}.csv`;
        link.setAttribute('download', fileName);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        showToast?.(`Berkas CSV jadwal (${fileName}) berhasil diunduh!`);
      }

      onClose?.();
    } catch (err) {
      console.error('Error saat ekspor jadwal:', err);
      showErrorToast?.(err?.message || 'Gagal mengekspor data jadwal.');
    } finally {
      setIsExporting(false);
      setExportStatusText('');
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Ekspor Data Jadwal Pelajaran"
      size="lg"
    >
      <div className="export-modal-body">
        {/* 1. Pemilihan Format Berkas */}
        <div className="export-section">
          <label className="export-section-title">Pilih Format Berkas Ekspor</label>
          <div className="export-format-grid">
            {/* Format Excel */}
            <div
              className={`export-format-card export-format-card--excel ${
                exportFormat === 'excel' ? 'export-format-card--active' : ''
              }`}
              onClick={() => setExportFormat('excel')}
              role="button"
              tabIndex={0}
            >
              <div className="export-format-card__icon-wrapper">
                <FileSpreadsheet size={18} />
              </div>
              <span className="export-format-card__title">Spreadsheet Excel</span>
              <span className="export-format-card__desc">
                Format .xlsx lengkap dengan data tabular, rekap beban guru, & rekap rombel kelas.
              </span>
            </div>

            {/* Format PDF */}
            <div
              className={`export-format-card export-format-card--pdf ${
                exportFormat === 'pdf' ? 'export-format-card--active' : ''
              }`}
              onClick={() => setExportFormat('pdf')}
              role="button"
              tabIndex={0}
            >
              <div className="export-format-card__icon-wrapper">
                <FileText size={18} />
              </div>
              <span className="export-format-card__title">Dokumen Cetak PDF</span>
              <span className="export-format-card__desc">
                Format resmi A4 Landscape dengan kop surat SMKN 1 Bantul & kolom pengesahan.
              </span>
            </div>

            {/* Format CSV */}
            <div
              className={`export-format-card export-format-card--csv ${
                exportFormat === 'csv' ? 'export-format-card--active' : ''
              }`}
              onClick={() => setExportFormat('csv')}
              role="button"
              tabIndex={0}
            >
              <div className="export-format-card__icon-wrapper">
                <FileCode size={18} />
              </div>
              <span className="export-format-card__title">Berkas Data CSV</span>
              <span className="export-format-card__desc">
                Format data teks mentah terpisah koma (.csv) untuk keperluan integrasi atau arsip.
              </span>
            </div>
          </div>
        </div>

        {/* 2. Pemilihan Putaran Jadwal */}
        <div className="export-section">
          <label className="export-section-title">Pilih Putaran Jadwal</label>
          <div className="export-cycle-grid">
            <button
              type="button"
              className={`export-cycle-btn ${cycleChoice === 'both' ? 'export-cycle-btn--active' : ''}`}
              onClick={() => setCycleChoice('both')}
            >
              <span className="export-cycle-btn__title">Putaran 1 & 2 Sekaligus</span>
              <span className="export-cycle-btn__desc">Arsip semester lengkap pola rolling TeFa</span>
            </button>
            <button
              type="button"
              className={`export-cycle-btn ${cycleChoice === 1 ? 'export-cycle-btn--active' : ''}`}
              onClick={() => setCycleChoice(1)}
            >
              <span className="export-cycle-btn__title">Putaran 1 Saja</span>
              <span className="export-cycle-btn__desc">Jadwal blok minggu ganjil / awal putaran</span>
            </button>
            <button
              type="button"
              className={`export-cycle-btn ${cycleChoice === 2 ? 'export-cycle-btn--active' : ''}`}
              onClick={() => setCycleChoice(2)}
            >
              <span className="export-cycle-btn__title">Putaran 2 Saja</span>
              <span className="export-cycle-btn__desc">Jadwal blok minggu genap / rolling rotasi</span>
            </button>
          </div>
        </div>

        {/* 3. Cakupan Rombel Kelas (Scope) */}
        <div className="export-section">
          <label className="export-section-title">Cakupan Rombel Kelas</label>
          <div className="export-scope-box">
            <div className="export-scope-row">
              <label className="export-scope-radio-label">
                <input
                  type="radio"
                  name="scopeMode"
                  checked={scopeMode === 'all'}
                  onChange={() => setScopeMode('all')}
                />
                <span>Seluruh Rombel Sekolah ({classList.length} Kelas)</span>
              </label>

              <label className="export-scope-radio-label">
                <input
                  type="radio"
                  name="scopeMode"
                  checked={scopeMode === 'level'}
                  onChange={() => setScopeMode('level')}
                />
                <span>Filter Tingkat</span>
              </label>

              <label className="export-scope-radio-label">
                <input
                  type="radio"
                  name="scopeMode"
                  checked={scopeMode === 'single'}
                  onChange={() => setScopeMode('single')}
                />
                <span>Satu Kelas Spesifik</span>
              </label>
            </div>

            {/* Sub-selector jika memilih filter tingkat */}
            {scopeMode === 'level' && (
              <div className="flex items-center gap-2 pt-1 border-t border-gray-200">
                <span className="text-xs text-gray-600 font-medium">Pilih Jenjang:</span>
                {[10, 11, 12].map((lvl) => (
                  <button
                    key={lvl}
                    type="button"
                    className={`px-3 py-1 text-xs font-semibold rounded border ${
                      selectedLevel === lvl
                        ? 'bg-indigo-600 text-white border-indigo-600'
                        : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                    }`}
                    onClick={() => setSelectedLevel(lvl)}
                  >
                    Tingkat {lvl}
                  </button>
                ))}
                <span className="text-xs text-gray-500 ml-auto font-medium">
                  ({targetClasses.length} Kelas Terpilih)
                </span>
              </div>
            )}

            {/* Sub-selector jika memilih 1 kelas spesifik */}
            {scopeMode === 'single' && (
              <div className="flex items-center gap-2 pt-1 border-t border-gray-200">
                <span className="text-xs text-gray-600 font-medium">Pilih Rombel:</span>
                <select
                  className="text-xs bg-white border border-gray-300 rounded px-2.5 py-1.5 text-gray-900 font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  value={selectedClassId}
                  onChange={(e) => setSelectedClassId(e.target.value)}
                >
                  {sortedClasses.map((cls) => (
                    <option key={cls.id} value={cls.id}>
                      Kelas {cls.name} (Tingkat {cls.level})
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>

        {/* Ringkasan & Info Box */}
        <div className="export-info-box">
          <Info size={16} className="text-indigo-600 shrink-0 mt-0.5" />
          <div>
            <span>
              Akan mengekspor jadwal untuk <strong>{targetClasses.length} rombel kelas</strong> pada{' '}
              <strong>
                {cycleChoice === 'both' ? 'Putaran 1 & 2' : `Putaran ${cycleChoice}`}
              </strong>{' '}
              dalam format <strong>{exportFormat.toUpperCase()}</strong>.
            </span>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="export-footer">
          <Button variant="outline" onClick={onClose} disabled={isExporting}>
            Batal
          </Button>

          <Button
            variant="primary"
            icon={Download}
            loading={isExporting}
            onClick={handleExecuteExport}
          >
            {isExporting ? exportStatusText || 'Mengekspor Jadwal...' : 'Unduh Berkas Sekarang'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
