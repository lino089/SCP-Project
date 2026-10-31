/**
 * Helper Validasi Prasyarat Master Data (Pre-condition Gate)
 *
 * 1. checkPdfImportPrerequisites (SCP v4.5 Zero-Manual):
 *    Hanya mensyaratkan Siswa aktif dan Guru aktif dengan FET Staff ID.
 *    Master Ruangan dan Mata Pelajaran didaftarkan otomatis dari dokumen PDF.
 *
 * 2. checkManualSchedulePrerequisites / checkMasterDataPrerequisites:
 *    Mensyaratkan 4 pilar lengkap (Kelas, Ruangan, Mata Pelajaran, Guru)
 *    untuk pembuatan jadwal manual di ScheduleManagementPage.
 */

/**
 * Validasi Prasyarat untuk Impor Berkas PDF Jadwal FET (SCP v4.5 Zero-Manual)
 *
 * @param {Object} params
 * @param {Array} [params.students=[]] - Daftar siswa atau sampel siswa
 * @param {Array} [params.teachers=[]] - Daftar guru
 * @param {number|null} [params.totalStudents=null] - Total siswa dari meta pagination
 * @param {number|null} [params.totalTeachers=null] - Total guru dari meta pagination
 * @returns {Object} Hasil evaluasi prasyarat
 */
export const checkPdfImportPrerequisites = ({
  students = [],
  teachers = [],
  totalStudents = null,
  totalTeachers = null,
}) => {
  const studentCount = totalStudents !== null ? totalStudents : (students?.length || 0);
  const teacherCount = totalTeachers !== null ? totalTeachers : (teachers?.length || 0);

  const fetTeacherCount = Array.isArray(teachers)
    ? teachers.filter((t) => t?.fet_staff_id && String(t.fet_staff_id).trim() !== '').length
    : 0;

  const hasStudents = studentCount > 0;
  const hasTeachers = teacherCount > 0;
  const hasFetStaffId = fetTeacherCount > 0;

  const missing = [];
  if (!hasStudents) {
    missing.push('students');
  }
  if (!hasTeachers) {
    missing.push('teachers');
  } else if (!hasFetStaffId) {
    missing.push('fet_staff_id');
  }

  const isReady = missing.length === 0;

  let message = 'Prasyarat Master Data terpenuhi untuk proses import PDF FET.';
  if (!isReady) {
    const errorDetails = [];
    if (!hasStudents) errorDetails.push('Data Siswa aktif masih kosong');
    if (!hasTeachers) errorDetails.push('Data Guru aktif masih kosong');
    else if (!hasFetStaffId) errorDetails.push('Belum ada guru yang memiliki FET Staff ID');
    message = `Prasyarat belum lengkap: ${errorDetails.join(', ')}.`;
  }

  return {
    isReady,
    missingEntities: missing,
    checks: {
      hasStudents,
      hasTeachers,
      hasFetStaffId,
    },
    counts: {
      studentCount,
      teacherCount,
      fetTeacherCount,
    },
    message,
  };
};

/**
 * Validasi Prasyarat untuk Input Jadwal Manual (/web/schedules)
 * Memeriksa kelayakan 4 entitas Master Data: Kelas, Ruang, Mapel, Guru.
 */
export const checkManualSchedulePrerequisites = ({
  classes = [],
  rooms = [],
  subjects = [],
  teachers = [],
}) => {
  const missing = [];

  if (!classes || classes.length === 0) {
    missing.push('Master Rombel Kelas');
  }

  if (!rooms || rooms.length === 0) {
    missing.push('Master Ruangan Belajar');
  }

  if (!subjects || subjects.length === 0) {
    missing.push('Master Mata Pelajaran');
  }

  const hasFetTeachers =
    teachers && teachers.some((t) => t?.fet_staff_id && String(t.fet_staff_id).trim() !== '');

  if (!teachers || teachers.length === 0) {
    missing.push('Master Guru / Tenaga Pendidik');
  } else if (!hasFetTeachers) {
    missing.push('Guru dengan Kode FET Staff ID (Wajib untuk Sinkronisasi Jadwal)');
  }

  const isReady = missing.length === 0;

  return {
    isReady,
    missingEntities: missing,
    message: isReady
      ? 'Master Data lengkap dan memenuhi syarat penyusunan jadwal.'
      : `Master Data belum lengkap: ${missing.join(', ')}. Harap lengkapi Master Data terlebih dahulu di menu Master Data.`,
  };
};

// Alias untuk backward compatibility dengan ScheduleManagementPage
export const checkMasterDataPrerequisites = checkManualSchedulePrerequisites;

export default {
  checkPdfImportPrerequisites,
  checkManualSchedulePrerequisites,
  checkMasterDataPrerequisites,
};
