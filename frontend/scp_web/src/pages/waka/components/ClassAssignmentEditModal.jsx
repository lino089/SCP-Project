import { useState, useEffect, useMemo, useCallback } from 'react';
import { UserCheck, Shield, Trash2, Plus, AlertCircle, CheckCircle2, Clock } from 'lucide-react';
import Modal from '../../../components/shared/Modal';
import Button from '../../../components/shared/Button';
import Select from '../../../components/shared/Select';
import Badge from '../../../components/shared/Badge';
import { teacherAssignmentApi } from '../../../services/masterDataApi';
import './TeacherAssignment.css';

/**
 * Modal untuk mengelola penugasan Wali Kelas & Guru BK pada rombel kelas tertentu.
 */
export default function ClassAssignmentEditModal({
  isOpen = false,
  onClose,
  classItem = null,
  teacherList = [],
  matrixData = [],
  onSaveSuccess,
}) {
  const [selectedWaliId, setSelectedWaliId] = useState('');
  const [selectedBkIdToAdd, setSelectedBkIdToAdd] = useState('');
  const [kesiswaanList, setKesiswaanList] = useState([]);
  const [historyList, setHistoryList] = useState([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const fetchClassHistory = useCallback(async (clsId) => {
    if (!clsId) return;
    setIsLoadingHistory(true);
    try {
      const res = await teacherAssignmentApi.getAssignmentHistories({
        class_id: clsId,
        is_active: 0,
        per_page: 10,
      });
      const items = res?.data?.data || res?.data || [];
      setHistoryList(Array.isArray(items) ? items : []);
    } catch {
      setHistoryList([]);
    } finally {
      setIsLoadingHistory(false);
    }
  }, []);

  // Map guru yang sudah menjadi Wali Kelas di kelas lain (Aturan 1 Guru 1 Wali Kelas)
  const existingWaliMap = useMemo(() => {
    const map = {};
    if (!Array.isArray(matrixData)) return map;
    matrixData.forEach((row) => {
      if (row.wali_kelas?.id) {
        map[row.wali_kelas.id] = {
          classId: row.class_id,
          className: row.class_name,
        };
      }
    });
    return map;
  }, [matrixData]);

  // Sinkronisasi state saat modal dibuka
  useEffect(() => {
    if (classItem && isOpen) {
      setSelectedWaliId(classItem.wali_kelas?.id ? String(classItem.wali_kelas.id) : '');
      setKesiswaanList(Array.isArray(classItem.kesiswaan) ? [...classItem.kesiswaan] : []);
      setSelectedBkIdToAdd('');
      setErrorMessage('');
      setSuccessMessage('');
      fetchClassHistory(classItem.class_id);
    }
  }, [classItem, isOpen, fetchClassHistory]);

  const classId = classItem?.class_id;

  // Options untuk dropdown Wali Kelas
  const waliOptions = useMemo(() => {
    const defaultOption = [{ value: '', label: '-- Kosongkan / Belum Ditugaskan --' }];
    if (!classId) return defaultOption;
    const teachers = teacherList.map((t) => {
      const isAssignedOther = existingWaliMap[t.id] && existingWaliMap[t.id].classId !== classId;
      const otherClass = isAssignedOther ? existingWaliMap[t.id].className : '';
      return {
        value: String(t.id),
        label: isAssignedOther
          ? `${t.name} (Sudah Wali Kelas di ${otherClass})`
          : `${t.name}${t.nis_nip ? ` (${t.nis_nip})` : ''}`,
        disabled: isAssignedOther,
      };
    });
    return [...defaultOption, ...teachers];
  }, [teacherList, existingWaliMap, classId]);

  // Options untuk dropdown tambah Guru BK (kecualikan yang sudah ditugaskan di kelas ini)
  const bkOptions = useMemo(() => {
    const defaultOption = [{ value: '', label: '-- Pilih Guru BK untuk Ditambahkan --' }];
    const currentBkIds = new Set(kesiswaanList.map((k) => k.id));
    const availableTeachers = teacherList
      .filter((t) => !currentBkIds.has(t.id))
      .map((t) => ({
        value: String(t.id),
        label: `${t.name}${t.nis_nip ? ` (${t.nis_nip})` : ''}`,
      }));
    return [...defaultOption, ...availableTeachers];
  }, [teacherList, kesiswaanList]);

  if (!classItem) return null;

  // Handler simpan perubahan Wali Kelas
  const handleSaveWaliKelas = async () => {
    setErrorMessage('');
    setSuccessMessage('');
    setIsSubmitting(true);
    try {
      const currentWali = classItem.wali_kelas;
      const targetWaliId = selectedWaliId ? Number(selectedWaliId) : null;

      // 1. Jika dikosongkan dan sebelumnya ada wali kelas
      if (!targetWaliId && currentWali?.assignment_id) {
        await teacherAssignmentApi.revokeRole(currentWali.id, currentWali.assignment_id);
      }
      // 2. Jika wali kelas diganti ke guru lain
      else if (targetWaliId && targetWaliId !== currentWali?.id) {
        // Tugaskan wali kelas baru (otomatis menonaktifkan pejabat lama via replace_existing)
        await teacherAssignmentApi.assignRole(targetWaliId, {
          type: 'wali_kelas',
          class_id: classItem.class_id,
          replace_existing: true,
        });
      }

      setSuccessMessage('Penugasan Wali Kelas berhasil diperbarui.');
      fetchClassHistory(classItem.class_id);
      onSaveSuccess?.();
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err) {
      setErrorMessage(err.response?.data?.message || err.message || 'Gagal memperbarui Wali Kelas.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handler tambah Guru BK ke kelas ini
  const handleAddBk = async () => {
    if (!selectedBkIdToAdd) return;
    setErrorMessage('');
    setSuccessMessage('');
    setIsSubmitting(true);
    try {
      const res = await teacherAssignmentApi.assignRole(Number(selectedBkIdToAdd), {
        type: 'kesiswaan',
        class_id: classItem.class_id,
        replace_existing: true,
      });

      const assignedItem = res?.data?.data || res?.data;
      const addedTeacher = teacherList.find((t) => t.id === Number(selectedBkIdToAdd));

      if (addedTeacher) {
        setKesiswaanList([
          {
            assignment_id: assignedItem?.id,
            id: addedTeacher.id,
            name: addedTeacher.name,
            nis_nip: addedTeacher.nis_nip,
          },
        ]);
      }

      setSelectedBkIdToAdd('');
      setSuccessMessage('Guru BK berhasil ditetapkan untuk kelas ini.');
      fetchClassHistory(classItem.class_id);
      onSaveSuccess?.();
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err) {
      setErrorMessage(err.response?.data?.message || err.message || 'Gagal menambahkan Guru BK.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handler hapus Guru BK dari kelas ini
  const handleRemoveBk = async (bkItem) => {
    setErrorMessage('');
    setSuccessMessage('');
    setIsSubmitting(true);
    try {
      if (bkItem.assignment_id) {
        await teacherAssignmentApi.revokeRole(bkItem.id, bkItem.assignment_id);
      } else {
        // Fallback jika assignment_id belum ter-load di state
        const matrixRefresh = await teacherAssignmentApi.getAssignmentMatrix();
        const foundClass = matrixRefresh?.data?.data?.find((c) => c.class_id === classItem.class_id);
        const targetBk = foundClass?.kesiswaan?.find((k) => k.id === bkItem.id);
        if (targetBk?.assignment_id) {
          await teacherAssignmentApi.revokeRole(bkItem.id, targetBk.assignment_id);
        }
      }

      setKesiswaanList((prev) => prev.filter((k) => k.id !== bkItem.id));
      setSuccessMessage(`Penugasan BK ${bkItem.name} untuk kelas ini berhasil dicabut.`);
      fetchClassHistory(classItem.class_id);
      onSaveSuccess?.();
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err) {
      setErrorMessage(err.response?.data?.message || err.message || 'Gagal mencabut penugasan Guru BK.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Kelola Penugasan Kelas"
      size="lg"
      footer={
        <div className="flex justify-end gap-2 w-full">
          <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Tutup
          </Button>
        </div>
      }
    >
      <div className="assignment-edit-form">
        {/* Class Header Card */}
        <div className="assignment-edit-class-header">
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
              Rombongan Belajar
            </span>
            <h3 className="text-lg font-bold text-neutral-900 mt-0.5">
              {classItem.class_name}
            </h3>
          </div>
          <Badge variant="primary">Tingkat {classItem.level}</Badge>
        </div>

        {/* Feedback Alerts */}
        {errorMessage && (
          <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg flex items-center gap-2">
            <AlertCircle size={15} className="flex-shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {successMessage && (
          <div className="p-3 bg-green-50 border border-green-200 text-green-700 text-xs rounded-lg flex items-center gap-2">
            <CheckCircle2 size={15} className="flex-shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* 1. Pengelolaan Wali Kelas */}
        <div className="bg-white p-4 border border-neutral-200 rounded-lg shadow-2xs">
          <div className="assignment-section-header">
            <UserCheck size={16} className="text-blue-600" />
            <span>Wali Kelas Aktif</span>
          </div>
          <p className="assignment-helper-text mb-3">
            Setiap guru hanya boleh menjadi Wali Kelas pada 1 rombel kelas aktif di sekolah.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 items-end">
            <div className="flex-1 w-full">
              <Select
                label="Pilih Guru Wali Kelas"
                value={selectedWaliId}
                onChange={(e) => setSelectedWaliId(e.target.value)}
                options={waliOptions}
                disabled={isSubmitting}
              />
            </div>
            <Button
              variant="primary"
              onClick={handleSaveWaliKelas}
              loading={isSubmitting}
              disabled={isSubmitting}
            >
              Simpan Wali
            </Button>
          </div>
        </div>

        {/* 2. Pengelolaan Guru BK / Kesiswaan Binaan */}
        <div className="bg-white p-4 border border-neutral-200 rounded-lg shadow-2xs">
          <div className="assignment-section-header">
            <Shield size={16} className="text-emerald-600" />
            <span>Guru BK / Kesiswaan Binaan</span>
          </div>
          <p className="assignment-helper-text mb-3">
            Petugas BK berwenang memverifikasi perizinan siswa dan guru pada kelas binaannya.
          </p>

          {/* List Guru BK Aktif di Kelas Ini */}
          <div className="mb-4">
            <span className="text-xs font-semibold text-neutral-600 mb-2 block">
              Daftar Pembina BK Saat Ini ({kesiswaanList.length}):
            </span>
            {kesiswaanList.length === 0 ? (
              <div className="p-3 bg-neutral-50 rounded-lg border border-dashed border-neutral-200 text-center text-xs text-neutral-400 italic">
                Belum ada Guru BK yang ditugaskan membina kelas ini.
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {kesiswaanList.map((bk) => (
                  <div
                    key={bk.id}
                    className="flex items-center justify-between p-2.5 bg-neutral-50 rounded-lg border border-neutral-200 text-xs"
                  >
                    <div>
                      <span className="font-semibold text-neutral-800">{bk.name}</span>
                      {bk.nis_nip && (
                        <span className="text-neutral-500 font-mono text-[11px] ml-2">
                          NIP: {bk.nis_nip}
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveBk(bk)}
                      disabled={isSubmitting}
                      className="text-red-600 hover:text-red-800 p-1 rounded hover:bg-red-50 flex items-center gap-1 transition-colors"
                      title="Cabut pembina BK dari kelas ini"
                    >
                      <Trash2 size={13} />
                      <span className="text-[11px]">Hapus</span>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Form Tambah Pembina BK */}
          <div className="pt-2 border-t border-neutral-100 flex flex-col sm:flex-row gap-3 items-end">
            <div className="flex-1 w-full">
              <Select
                label="Tambah Pembina BK Baru"
                value={selectedBkIdToAdd}
                onChange={(e) => setSelectedBkIdToAdd(e.target.value)}
                options={bkOptions}
                disabled={isSubmitting}
              />
            </div>
            <Button
              variant="outline"
              icon={Plus}
              onClick={handleAddBk}
              disabled={!selectedBkIdToAdd || isSubmitting}
              loading={isSubmitting}
            >
              {kesiswaanList.length > 0 ? 'Ganti BK' : 'Tetapkan BK'}
            </Button>
          </div>
        </div>

        {/* 3. Riwayat Penugasan Kelas Ini (Lampau) */}
        <div className="bg-white p-4 border border-neutral-200 rounded-lg shadow-2xs">
          <div className="assignment-section-header">
            <Clock size={16} className="text-neutral-600" />
            <span>Riwayat Penugasan Sebelumnya</span>
          </div>
          <p className="assignment-helper-text mb-3">
            Catatan historis pejabat Wali Kelas &amp; Guru BK yang pernah bertugas pada kelas ini.
          </p>

          {isLoadingHistory ? (
            <div className="text-xs text-neutral-400 italic py-2">Memuat riwayat penugasan...</div>
          ) : historyList.length === 0 ? (
            <div className="p-3 bg-neutral-50 rounded-lg border border-dashed border-neutral-200 text-center text-xs text-neutral-400 italic">
              Belum ada riwayat pergantian penugasan pada kelas ini.
            </div>
          ) : (
            <div className="flex flex-col gap-2 max-h-48 overflow-y-auto">
              {historyList.map((hist) => (
                <div
                  key={hist.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between p-2.5 bg-neutral-50 rounded-lg border border-neutral-200 text-xs gap-1"
                >
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant={hist.type === 'wali_kelas' ? 'primary' : 'warning'}>
                      {hist.type === 'wali_kelas' ? 'Wali Kelas' : 'Guru BK'}
                    </Badge>
                    <span className="font-semibold text-neutral-800">
                      {hist.teacher?.name || `Guru #${hist.user_id}`}
                    </span>
                    {hist.academic_year && (
                      <span className="text-neutral-500 text-[11px]">
                        ({hist.academic_year})
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-neutral-500">
                    {hist.ended_at
                      ? `Berakhir: ${new Date(hist.ended_at).toLocaleDateString('id-ID')}`
                      : 'Nonaktif'}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
