/**
 * Helper Validasi Prasyarat Master Data (Pre-condition Gate)
 * Memverifikasi kelayakan Master Data sebelum aksi input jadwal manual maupun import PDF.
 * Aturan Bisnis:
 * 1. Minimal terdapat 1 kelas aktif
 * 2. Minimal terdapat 1 ruangan aktif
 * 3. Minimal terdapat 1 mata pelajaran aktif
 * 4. Minimal terdapat 1 guru aktif yang telah memiliki FET Staff ID terisi
 */

export const checkMasterDataPrerequisites = ({
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
    teachers && teachers.some((t) => t.fet_staff_id && String(t.fet_staff_id).trim() !== '');

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

export default checkMasterDataPrerequisites;
