import { useState, useEffect, useMemo, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  PlayCircle,
  CheckCircle,
  Save,
  AlertTriangle,
  ShieldCheck,
  Check,
  ArrowLeft,
  X,
  FileCheck2,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { journalApi } from '../../services/journalApi';
import { compressImage } from '../../utils/imageCompressor';
import {
  Button,
  Badge,
  FileUpload,
} from '../../components/shared';
import ForbiddenState from '../../components/feedback/ForbiddenState';
import './TeacherJournal.css';

export default function TeacherJournalPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, isKesiswaan } = useAuth();

  // Ambil data jadwal dari route state atau fallback
  const passedSchedule = location.state?.schedule;

  // Jadwal aktif KBM
  const [schedule, setSchedule] = useState(passedSchedule || null);
  const [journalId, setJournalId] = useState(null);
  const [classOpened, setClassOpened] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Form Fields
  const [topic, setTopic] = useState('');
  const [uploadedPhoto, setUploadedPhoto] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [compressedFileSize, setCompressedFileSize] = useState(null);

  // Data Siswa & Presensi
  const [students, setStudents] = useState([]);
  const [attendance, setAttendance] = useState({});
  const [approvedLeaves, setApprovedLeaves] = useState([]);

  // Ambil jadwal default bila pengguna langsung membuka /teacher/journal tanpa navigasi
  useEffect(() => {
    let isMounted = true;
    if (!schedule) {
      journalApi.getTeacherSchedules({ per_page: 1 }).then((res) => {
        if (!isMounted) return;
        if (res.success && res.data && res.data.length > 0) {
          setSchedule(res.data[0]);
        }
      });
    }
    return () => {
      isMounted = false;
    };
  }, [schedule]);

  // Penegakan Otorisasi Ketat:
  // Apakah user adalah pemilik jadwal ATAU guru Kesiswaan?
  const isOriginalTeacher = useMemo(() => {
    if (!schedule || !user) return true;
    return schedule.teacher_id === user.id;
  }, [schedule, user]);

  const isSubstituteMode = useMemo(() => {
    return isKesiswaan() && !isOriginalTeacher;
  }, [isKesiswaan, isOriginalTeacher]);

  const isAccessDenied = useMemo(() => {
    if (!schedule || !user) return false;
    // Jika bukan guru jadwal dan bukan kesiswaan -> Ditolak (403)
    return !isOriginalTeacher && !isKesiswaan();
  }, [schedule, user, isOriginalTeacher, isKesiswaan]);

  // Muat tugas titipan jika dalam mode pengganti Kesiswaan
  const taskTitipan = useMemo(() => {
    if (isSubstituteMode) {
      return (
        localStorage.getItem('teacher_leave_tasks') ||
        'Lanjutkan praktikum modul CRUD pada materi database dan serahkan ringkasan tugas ke meja piket.'
      );
    }
    return '';
  }, [isSubstituteMode]);

  // Helper kompresi dan set foto dokumentasi
  const handlePhotoSelect = async (file) => {
    if (!file) {
      setUploadedPhoto(null);
      setPhotoPreview(null);
      setCompressedFileSize(null);
      return;
    }

    try {
      const compressed = await compressImage(file, { maxWidth: 1280, quality: 0.8 });
      setUploadedPhoto(compressed);
      setPhotoPreview(URL.createObjectURL(compressed));
      setCompressedFileSize((compressed.size / 1024).toFixed(1));
    } catch {
      setUploadedPhoto(file);
      setPhotoPreview(URL.createObjectURL(file));
      setCompressedFileSize((file.size / 1024).toFixed(1));
    }
  };

  // Bersihkan object URL saat unmount
  useEffect(() => {
    return () => {
      if (photoPreview) {
        URL.revokeObjectURL(photoPreview);
      }
    };
  }, [photoPreview]);

  // Buka Sesi Kelas KBM (POST /api/journals)
  const handleOpenClass = async () => {
    if (!schedule) return;
    setIsSubmitting(true);
    setErrorMessage('');

    try {
      const res = await journalApi.openJournal({
        schedule_id: schedule.id,
        status: 'ongoing',
        date: new Date().toISOString().split('T')[0],
      });

      if (res.success && res.data) {
        setJournalId(res.data.id);
      }

      // Ambil daftar siswa kelas terkait
      const classId = schedule.school_class_id || schedule.class_id || 1;
      const studRes = await journalApi.getClassStudents(classId);
      const studentList = studRes.data || [];
      setStudents(studentList);

      // Tangkap respons meta.approved_leaves
      const leaves = res.meta?.approved_leaves || [];
      setApprovedLeaves(leaves);

      // Inisialisasi Presensi: Seluruh siswa default 'Hadir',
      // kecuali yang terdaftar di approved_leaves
      const initAttendance = {};
      studentList.forEach((st) => {
        const leave = leaves.find((l) => l.student_id === st.id);
        if (leave) {
          initAttendance[st.id] = leave.default_status || (leave.category === 'sakit' ? 'Sakit' : 'Izin');
        } else {
          initAttendance[st.id] = 'Hadir';
        }
      });

      setAttendance(initAttendance);
      setClassOpened(true);
    } catch (err) {
      if (err.response?.status === 403) {
        setErrorMessage('Akses ditolak (403). Anda tidak memiliki wewenang untuk membuka kelas ini.');
      } else {
        setErrorMessage('Gagal membuka sesi KBM. Silakan periksa koneksi Anda.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Menandai Guru Berhalangan Hadir (Jam Kosong) oleh Kesiswaan
  const handleMarkTeacherAbsent = async () => {
    if (!schedule) return;
    const confirm = window.confirm(
      'Apakah Anda yakin ingin menandai kelas ini sebagai Guru Berhalangan Hadir (Jam Kosong)?'
    );
    if (!confirm) return;

    try {
      await journalApi.markTeacherAbsent(journalId || schedule.id, {
        schedule_id: schedule.id,
      });
      alert('Jadwal berhasil ditandai sebagai Guru Berhalangan Hadir (teacher_absent).');
      navigate('/teacher/schedule');
    } catch {
      alert('Gagal menandai status jam kosong.');
    }
  };

  // Ubah status kehadiran per siswa
  const handleStatusChange = useCallback((studentId, newStatus) => {
    setAttendance((prev) => ({
      ...prev,
      [studentId]: newStatus,
    }));
  }, []);

  // Hitung jumlah statistik kehadiran secara langsung
  const counts = useMemo(() => {
    const res = { hadir: 0, sakit: 0, izin: 0, alpa: 0 };
    Object.values(attendance).forEach((status) => {
      const key = (status || '').toLowerCase();
      if (Object.prototype.hasOwnProperty.call(res, key)) {
        res[key] += 1;
      }
    });
    return res;
  }, [attendance]);

  // Submit Penyelesaian Jurnal Atomik (PUT /api/journals/{id})
  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validasi topik materi (wajib minimal 10 karakter jika bukan mode pengganti kesiswaan)
    if (!isSubstituteMode && (!topic || topic.trim().length < 10)) {
      setErrorMessage('Deskripsi topik materi pembelajaran wajib diisi minimal 10 karakter.');
      return;
    }

    if (!uploadedPhoto) {
      setErrorMessage('Wajib mengunggah minimal 1 foto bukti dokumentasi KBM.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage('');

    try {
      // Susun array exceptions HANYA untuk siswa yang tidak Hadir (PRD 5.8)
      const exceptions = [];
      Object.entries(attendance).forEach(([stId, status]) => {
        if (status !== 'Hadir') {
          exceptions.push({
            student_id: parseInt(stId, 10),
            status: status,
          });
        }
      });

      // Konstruksi FormData multipart
      const formData = new FormData();
      formData.append(
        'topic_description',
        topic.trim() || (isSubstituteMode ? 'Pendampingan Jam Kosong oleh Tim Kesiswaan' : 'KBM Kelas')
      );
      formData.append('photo', uploadedPhoto);

      // Kirim array exceptions untuk parsing Laravel
      exceptions.forEach((exc, index) => {
        formData.append(`exceptions[${index}][student_id]`, exc.student_id);
        formData.append(`exceptions[${index}][status]`, exc.status);
      });

      await journalApi.completeJournal(journalId || schedule.id, formData);
      setSubmitted(true);
    } catch (err) {
      if (err.response?.status === 422) {
        setErrorMessage(
          err.response.data?.message || 'Data tidak valid. Pastikan topik minimal 10 karakter dan foto terunggah.'
        );
      } else if (err.response?.status === 403) {
        setErrorMessage('Akses ditolak (403). Anda tidak memiliki izin menyelesaikan jurnal ini.');
      } else {
        setErrorMessage('Terjadi kendala saat menyimpan jurnal. Silakan coba kembali.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Jika hak akses ditolak (403)
  if (isAccessDenied) {
    return (
      <div className="teacher-journal">
        <ForbiddenState
          title="Akses Jurnal Ditolak (403 Forbidden)"
          message="Hanya guru pengajar jadwal atau Tim Kesiswaan (Piket) yang berhak membuka, mengisi, atau menggantikan jurnal KBM kelas ini."
          actionText="Kembali ke Kalender Mengajar"
          onAction={() => navigate('/teacher/schedule')}
        />
      </div>
    );
  }

  return (
    <div className="teacher-journal">
      {/* Header Halaman */}
      <div className="teacher-journal__header">
        <div className="teacher-journal__title-group">
          <h1>Jurnal KBM &amp; Presensi Kelas</h1>
          <p className="teacher-journal__subtitle">
            Buka kelas berjalan, catat topik materi pembelajaran, verifikasi kehadiran siswa, dan unggah foto dokumentasi KBM.
          </p>
        </div>

        <div className="teacher-journal__header-badges">
          {isSubstituteMode ? (
            <>
              <Badge variant="warning">Mode Guru Pengganti (Kesiswaan)</Badge>
              <Badge variant="neutral">
                {schedule?.schoolClass?.name || 'Kelas'} &bull; {schedule?.subject?.name}
              </Badge>
            </>
          ) : (
            <>
              <Badge variant="default">{schedule?.subject?.name || 'Mata Pelajaran'}</Badge>
              <Badge variant="neutral">
                {schedule?.schoolClass?.name || 'Kelas'} &bull; {schedule?.room?.name || 'Ruang'}
              </Badge>
            </>
          )}
        </div>
      </div>

      {/* Banner Ambil Alih Kelas oleh Tim Kesiswaan */}
      {isSubstituteMode && (
        <div className="teacher-journal__kesiswaan-banner">
          <div className="flex items-center gap-3">
            <ShieldCheck size={22} className="text-[#FFDE02] shrink-0" />
            <div>
              <div className="teacher-journal__kesiswaan-banner-title">
                Ambil Alih Kelas KBM oleh Tim Kesiswaan (Piket)
              </div>
              <div className="teacher-journal__kesiswaan-banner-sub">
                Guru Pengampu Asli (<strong>{schedule?.teacher?.name || 'Guru Pengampu'}</strong>) sedang berhalangan hadir.
              </div>
            </div>
          </div>
          <span className="teacher-journal__kesiswaan-pill">
            Topik Pembelajaran Bersifat Opsional
          </span>
        </div>
      )}

      {/* Tampilan Error Banner */}
      {errorMessage && (
        <div className="mb-5 p-3.5 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2.5 text-xs text-red-800">
          <AlertTriangle size={16} className="text-red-600 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* KONDISI 1: SUKSES SUBMIT (COMPLETED STATE) */}
      {submitted ? (
        <div className="border border-emerald-200 bg-white rounded-xl p-10 text-center max-w-xl mx-auto my-8 shadow-xs">
          <div className="w-14 h-14 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-3.5 border border-emerald-200">
            <CheckCircle size={32} />
          </div>
          <h2 className="text-xl font-bold text-gray-900">
            {isSubstituteMode ? 'Presensi Piket Berhasil Dicatat' : 'Jurnal KBM Berhasil Disimpan'}
          </h2>
          <p className="text-xs text-gray-600 mt-2 leading-relaxed">
            {isSubstituteMode
              ? 'Kehadiran siswa telah diverifikasi oleh Tim Kesiswaan dan status kelas diperbarui menjadi Selesai (Diisi Kesiswaan).'
              : 'Data kehadiran siswa dan dokumentasi materi telah tercatat secara atomik di sistem akademik sekolah.'}
          </p>

          <div className="flex items-center justify-center gap-3 mt-6">
            <Button
              variant="secondary"
              icon={ArrowLeft}
              onClick={() => navigate('/teacher/schedule')}
            >
              Kembali ke Kalender Jadwal
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setSubmitted(false);
                setClassOpened(false);
              }}
            >
              Buka Form Kembali
            </Button>
          </div>
        </div>
      ) : !classOpened ? (
        /* KONDISI 2: STANDBY SESI KELAS SIAP DIBUKA */
        <div className="teacher-journal__standby-card">
          <div className="teacher-journal__standby-pulse">
            <span className="teacher-journal__pulse-dot" />
            <span className="teacher-journal__pulse-label">
              {isSubstituteMode ? 'Sesi Ambil Alih Kelas Siap' : 'Sesi Kelas Siap Dibuka'}
            </span>
          </div>

          <h2 className="teacher-journal__standby-title">
            {schedule?.subject?.name || 'Mata Pelajaran'} &bull; {schedule?.schoolClass?.name || 'Kelas'}
          </h2>

          <p className="teacher-journal__standby-desc">
            {isSubstituteMode
              ? `Guru Asli: ${schedule?.teacher?.name || 'Guru Pengampu'} • Jam ke-${schedule?.period_number || 1} • Ruang ${schedule?.room?.name || 'Ruang'}`
              : `Jadwal: Hari ini, Jam ke-${schedule?.period_number || 1} s/d ${(schedule?.period_number || 1) + (schedule?.duration_periods || 2) - 1} • Lokasi ${schedule?.room?.name || 'Ruang Kelas'}`}
          </p>

          {/* Tugas Titipan Guru Asli jika Mode Kesiswaan */}
          {isSubstituteMode && taskTitipan && (
            <div className="teacher-journal__task-box">
              <span className="teacher-journal__task-box-title">
                📢 Tugas Titipan Guru Pengampu Asli:
              </span>
              <p className="teacher-journal__task-box-body">"{taskTitipan}"</p>
            </div>
          )}

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Button
              variant="primary"
              size="md"
              icon={PlayCircle}
              loading={isSubmitting}
              onClick={handleOpenClass}
            >
              {isSubstituteMode
                ? 'Mulai Presensi & Ambil Alih Kelas'
                : 'Mulai & Buka Kelas Sekarang'}
            </Button>

            {isKesiswaan() && (
              <Button
                variant="outline"
                size="md"
                onClick={handleMarkTeacherAbsent}
              >
                Tandai Guru Berhalangan (Jam Kosong)
              </Button>
            )}

            <Button
              variant="secondary"
              size="md"
              onClick={() => navigate('/teacher/schedule')}
            >
              Kembali
            </Button>
          </div>
        </div>
      ) : (
        /* KONDISI 3: FORM JURNAL AKTIF & PRESENSI KELAS */
        <form onSubmit={handleSubmit} className="flex flex-col gap-6">
          {/* Box Tugas Titipan Guru jika Kesiswaan */}
          {isSubstituteMode && taskTitipan && (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-950">
              <span className="font-bold block text-sm mb-1 text-amber-900">
                📢 Instruksi Tugas Titipan Guru Pengampu Asli:
              </span>
              <p className="text-amber-900 text-xs leading-relaxed font-medium">
                "{taskTitipan}"
              </p>
              <span className="text-[11px] text-amber-700 block mt-1.5">
                Bacakan instruksi di atas kepada siswa di kelas sebelum mengisi absensi kehadiran.
              </span>
            </div>
          )}

          {/* GRID: Topik Materi & Dokumentasi Foto */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* 1. Topik & Materi Pembelajaran */}
            <div className="border border-gray-200 rounded-xl p-5 bg-white flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-gray-900">
                  {isSubstituteMode
                    ? '1. Catatan / Kondisi Kelas (Opsional)'
                    : '1. Topik & Materi Pembelajaran'}
                </h2>
                {!isSubstituteMode && (
                  <span
                    className={`text-[11px] font-mono ${topic.trim().length >= 10 ? 'text-emerald-600' : 'text-gray-400'}`}
                  >
                    {topic.trim().length}/10 karakter min
                  </span>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                  {isSubstituteMode ? (
                    'Catatan Pengawasan Kelas (Opsional - Diisi Kesiswaan)'
                  ) : (
                    <>
                      Topik Pembelajaran <span className="text-red-500">*</span>
                    </>
                  )}
                </label>
                <textarea
                  rows={4}
                  required={!isSubstituteMode}
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder={
                    isSubstituteMode
                      ? 'Kosongkan jika hanya mengabsen siswa & menyampaikan tugas titipan guru asli...'
                      : 'Contoh: Pemfaktoran Persamaan Kuadrat dan Aplikasi Kontekstual Latihan Soal Bab 2'
                  }
                  className="w-full px-3 py-2 text-xs border border-gray-300 rounded-md focus:outline-none focus:border-gray-900 bg-white"
                />
                <span className="text-[11px] text-gray-400 mt-1 block">
                  {isSubstituteMode
                    ? 'Tidak wajib diisi jika materi telah tercakup dalam tugas titipan guru asli.'
                    : 'Wajib diisi minimal 10 karakter untuk rekapitulasi kurikulum sekolah.'}
                </span>
              </div>
            </div>

            {/* 2. Dokumentasi Foto Kelas */}
            <div className="border border-gray-200 rounded-xl p-5 bg-white flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-gray-900">
                  2. Dokumentasi Foto Kelas <span className="text-red-500">*</span>
                </h2>
                {compressedFileSize && (
                  <span className="text-[11px] font-mono text-emerald-600">
                    Terkonversi: {compressedFileSize} KB
                  </span>
                )}
              </div>

              <p className="text-xs text-gray-500">
                Unggah bukti foto suasana kegiatan KBM di kelas (Maks. 10MB, otomatis dikompresi).
              </p>

              {photoPreview ? (
                <div className="teacher-journal__photo-preview">
                  <img
                    src={photoPreview}
                    alt="Pratinjau Dokumentasi KBM"
                    className="teacher-journal__photo-img"
                  />
                  <div className="teacher-journal__photo-info">
                    <span>
                      {uploadedPhoto?.name} ({compressedFileSize} KB)
                    </span>
                    <button
                      type="button"
                      className="text-xs text-red-600 hover:text-red-800 flex items-center gap-1 cursor-pointer"
                      onClick={() => handlePhotoSelect(null)}
                    >
                      <X size={14} /> Hapus Foto
                    </button>
                  </div>
                </div>
              ) : (
                <FileUpload
                  accept="image/jpeg,image/png,image/webp"
                  file={uploadedPhoto}
                  onChange={handlePhotoSelect}
                  hint="Format JPG, PNG atau foto kamera langsung (Otomatis dioptimalkan)"
                />
              )}
            </div>
          </div>

          {/* 3. Presensi Kehadiran Siswa (Exception-Based) */}
          <div className="border border-gray-200 rounded-xl p-5 bg-white">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
              <div>
                <h2 className="text-sm font-bold text-gray-900">
                  3. Presensi Kehadiran Siswa ({students.length} Siswa Terdaftar)
                </h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  Secara default seluruh siswa berstatus <strong>Hadir</strong>. Ubah status hanya untuk siswa yang berhalangan hadir.
                </p>
              </div>

              {/* Status Chips Summary */}
              <div className="teacher-journal__counts-bar">
                <span className="teacher-journal__count-chip teacher-journal__count-chip--hadir">
                  Hadir: {counts.hadir}
                </span>
                <span className="teacher-journal__count-chip teacher-journal__count-chip--sakit">
                  Sakit: {counts.sakit}
                </span>
                <span className="teacher-journal__count-chip teacher-journal__count-chip--izin">
                  Izin: {counts.izin}
                </span>
                <span className="teacher-journal__count-chip teacher-journal__count-chip--alpa">
                  Alpa: {counts.alpa}
                </span>
              </div>
            </div>

            {/* Tabel Presensi Exception-Based */}
            <div className="w-full overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse min-w-[600px]">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50/70">
                    <th className="py-2.5 px-3 font-semibold text-gray-600 text-[11px] uppercase tracking-wider w-12">
                      No
                    </th>
                    <th className="py-2.5 px-3 font-semibold text-gray-600 text-[11px] uppercase tracking-wider w-28">
                      NIS
                    </th>
                    <th className="py-2.5 px-3 font-semibold text-gray-600 text-[11px] uppercase tracking-wider">
                      Nama Peserta Didik
                    </th>
                    <th className="py-2.5 px-3 font-semibold text-gray-600 text-[11px] uppercase tracking-wider text-right">
                      Status Kehadiran (Pilih Jika Absen)
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {students.map((st, idx) => {
                    const currentStatus = attendance[st.id] || 'Hadir';
                    const hasApprovedLeave = approvedLeaves.some(
                      (l) => l.student_id === st.id
                    );

                    return (
                      <tr key={st.id} className="hover:bg-gray-50/50">
                        <td className="py-2.5 px-3 text-gray-400 font-mono text-xs">
                          {String(idx + 1).padStart(2, '0')}
                        </td>
                        <td className="py-2.5 px-3">
                          <code className="font-mono text-[11px] text-gray-700 bg-gray-50 px-1.5 py-0.5 rounded border border-gray-200">
                            {st.nis}
                          </code>
                        </td>
                        <td className="py-2.5 px-3 font-medium text-gray-900">
                          <div className="flex items-center gap-2">
                            <span>{st.name}</span>
                            {hasApprovedLeave && (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                                <FileCheck2 size={11} /> Surat Izin Resmi
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <div className="teacher-journal__status-group">
                            {['Hadir', 'Sakit', 'Izin', 'Alpa'].map((stOpt) => {
                              const isSelected = currentStatus === stOpt;
                              let activeClass = '';
                              if (isSelected) {
                                if (stOpt === 'Hadir') activeClass = 'teacher-journal__status-btn--active-hadir';
                                if (stOpt === 'Sakit') activeClass = 'teacher-journal__status-btn--active-sakit';
                                if (stOpt === 'Izin') activeClass = 'teacher-journal__status-btn--active-izin';
                                if (stOpt === 'Alpa') activeClass = 'teacher-journal__status-btn--active-alpa';
                              }

                              return (
                                <button
                                  key={stOpt}
                                  type="button"
                                  onClick={() => handleStatusChange(st.id, stOpt)}
                                  className={`teacher-journal__status-btn ${activeClass}`}
                                >
                                  {stOpt}
                                </button>
                              );
                            })}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Form Actions */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <Button
              variant="secondary"
              type="button"
              onClick={() => setClassOpened(false)}
            >
              Batal
            </Button>
            {isSubstituteMode ? (
              <button
                type="submit"
                disabled={isSubmitting}
                className="h-10 px-5 rounded-md text-xs font-bold bg-[#FFDE02] text-gray-900 hover:bg-[#F2D300] active:scale-[0.98] transition-all shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <Check size={16} strokeWidth={2.5} />
                <span>
                  {isSubmitting ? 'Menyimpan...' : 'Simpan Presensi Piket'}
                </span>
              </button>
            ) : (
              <Button
                type="submit"
                variant="primary"
                icon={Save}
                loading={isSubmitting}
              >
                Simpan Jurnal &amp; Selesaikan Sesi
              </Button>
            )}
          </div>
        </form>
      )}
    </div>
  );
}
