/**
 * Prerequisite Validator Helper for SCP Academic System (Mobile)
 * Ensures logical dependencies are met before allowing data creation.
 * Note: Waka PDF Import prerequisite is excluded on mobile as import features are out-of-scope.
 */

export function checkAssignmentPrerequisites({ academicYears = [], teachers = [], subjects = [], classes = [] }) {
  const missing = [];
  const hasActiveYear = academicYears.some((y) => y.is_active);

  if (!hasActiveYear) {
    missing.push({
      id: 'academic_year',
      label: 'Tahun Ajaran Aktif',
      description: 'Belum ada Tahun Ajaran yang diaktifkan di Master Data.',
      path: '/web/master-data?tab=years',
      actionText: 'Kelola Tahun Ajaran',
    });
  }
  if (teachers.length === 0) {
    missing.push({
      id: 'teachers',
      label: 'Data Guru',
      description: 'Daftar Guru masih kosong. Tambahkan minimal 1 guru terlebih dahulu.',
      path: '/web/master-data?tab=teachers',
      actionText: 'Tambah Data Guru',
    });
  }
  if (subjects.length === 0) {
    missing.push({
      id: 'subjects',
      label: 'Mata Pelajaran',
      description: 'Daftar Mata Pelajaran masih kosong. Tambahkan mata pelajaran terlebih dahulu.',
      path: '/web/master-data?tab=subjects',
      actionText: 'Tambah Mata Pelajaran',
    });
  }
  if (classes.length === 0) {
    missing.push({
      id: 'classes',
      label: 'Data Kelas (Rombel)',
      description: 'Daftar Kelas masih kosong. Buat kelas terlebih dahulu.',
      path: '/web/master-data?tab=classes',
      actionText: 'Tambah Data Kelas',
    });
  }

  return {
    ready: missing.length === 0,
    missing,
  };
}

export function checkSchedulePrerequisites({ academicYears = [], classes = [], assignments = [] }) {
  const missing = [];
  const hasActiveYear = academicYears.some((y) => y.is_active);

  if (!hasActiveYear) {
    missing.push({
      id: 'academic_year',
      label: 'Tahun Ajaran Aktif',
      description: 'Belum ada Tahun Ajaran yang berstatus Aktif.',
      path: '/web/master-data?tab=years',
      actionText: 'Aktifkan Tahun Ajaran',
    });
  }
  if (classes.length === 0) {
    missing.push({
      id: 'classes',
      label: 'Data Kelas (Rombel)',
      description: 'Data Kelas belum tersedia untuk penjadwalan.',
      path: '/web/master-data?tab=classes',
      actionText: 'Kelola Data Kelas',
    });
  }
  if (assignments.length === 0) {
    missing.push({
      id: 'assignments',
      label: 'Penugasan Guru Mengajar',
      description: 'Belum ada Penugasan Guru (Mapel -> Guru -> Kelas) pada tahun ajaran aktif.',
      path: '/web/master-data?tab=assignments',
      actionText: 'Atur Penugasan Guru',
    });
  }

  return {
    ready: missing.length === 0,
    missing,
  };
}

export function checkGradePromotionPrerequisites({ academicYears = [], classes = [] }) {
  const missing = [];

  if (academicYears.length < 2) {
    missing.push({
      id: 'target_year',
      label: 'Tahun Ajaran Tujuan (Minimal 2 Tahun Ajaran)',
      description: 'Proses kenaikan kelas membutuhkan Tahun Ajaran Asal dan Tahun Ajaran Baru (Tujuan).',
      path: '/web/master-data?tab=years',
      actionText: 'Buat Tahun Ajaran Baru',
    });
  }
  if (classes.length === 0) {
    missing.push({
      id: 'classes',
      label: 'Data Kelas (Rombel)',
      description: 'Belum ada data kelas yang terdaftar untuk dipromosikan.',
      path: '/web/master-data?tab=classes',
      actionText: 'Kelola Data Kelas',
    });
  }

  return {
    ready: missing.length === 0,
    missing,
  };
}
