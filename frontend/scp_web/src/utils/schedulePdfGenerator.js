import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  DAYS_LIST,
  NUMBER_TO_DAY,
  getTimeSlotsForDay,
  resolveSlotTime,
  getMorningActivity,
  getBreaksForDay,
} from './timetableHelper.js';

/**
 * Utilitas Generator PDF Jadwal Resmi SMK Negeri 1 Bantul
 * Menghasilkan dokumen cetak resmi format A4 Landscape untuk Guru, Wali Kelas, dan Siswa.
 * Mendukung ekspor terpadu Putaran 1 dan Putaran 2 sekaligus dalam satu file PDF.
 */

/**
 * Format string tanggal Indonesia
 */
const formatIndonesianDate = (date = new Date()) => {
  try {
    return new Intl.DateTimeFormat('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(date);
  } catch {
    return date.toLocaleDateString();
  }
};

/**
 * Format string timestamp cetak
 */
const formatPrintTimestamp = (date = new Date()) => {
  try {
    const dStr = new Intl.DateTimeFormat('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }).format(date);
    const hours = String(date.getHours()).padStart(2, '0');
    const mins = String(date.getMinutes()).padStart(2, '0');
    return `${dStr}, ${hours}:${mins} WIB`;
  } catch {
    return `${date.toLocaleDateString()} WIB`;
  }
};

/**
 * Membersihkan nama string untuk nama file unduhan
 */
const sanitizeFileName = (str) => {
  if (!str) return 'Jadwal';
  return String(str).replace(/[^a-zA-Z0-9_\-]/g, '_');
};

/**
 * Render satu halaman jadwal untuk putaran tertentu (Single Page per Putaran)
 */
const renderCyclePage = ({
  doc,
  cycleNum,
  cycleSchedules = [],
  role = 'teacher',
  user = {},
  mondayIsUpacara = true,
  periodTemplates = [],
  academicYear = '2026/2027',
  semester = 'Ganjil',
  homeroomClassName = '',
  pageIndex = 0,
  totalPages = 1,
}) => {
  const isTeacher = role === 'teacher';
  const isHomeroom = role === 'homeroom';
  const isStudent = role === 'student';
  const isWaka = role === 'waka';

  const userName = user?.name || (isStudent ? 'Peserta Didik' : 'Bapak/Ibu Guru');
  const userNip = user?.nip || user?.nis_nip || user?.nip_nis || '-';
  const userNis = user?.nis || user?.nis_nip || '-';
  const targetClassName =
    homeroomClassName ||
    user?.className ||
    user?.school_class?.name ||
    user?.schoolClass?.name ||
    (user?.class_id ? `Kelas #${user.class_id}` : '-');

  // Rekapitulasi Metrik Beban untuk Putaran ini
  const totalJP = cycleSchedules.reduce(
    (sum, s) => sum + Number(s.duration || s.duration_periods || 1),
    0
  );
  const uniqueClasses = new Set(
    cycleSchedules.map((s) => s.class_id || s.className || s.school_class?.name)
  ).size;
  const uniqueSubjects = new Set(
    cycleSchedules.map((s) => s.subject_id || s.subjectName || s.subject?.name)
  ).size;

  // 1. Kop Surat Resmi Institusi SMK Negeri 1 Bantul
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(30, 41, 59);
  doc.text('PEMERINTAH DAERAH ISTIMEWA YOGYAKARTA', 148.5, 7.5, { align: 'center' });
  doc.text('DINAS PENDIDIKAN, PEMUDA, DAN OLAHRAGA', 148.5, 11, { align: 'center' });

  doc.setFontSize(12);
  doc.text('SMK NEGERI 1 BANTUL', 148.5, 15.5, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(71, 85, 105);
  doc.text(
    'Jalan Parangtritis Km. 11, Sabdodadi, Bantul, Daerah Istimewa Yogyakarta 55715 | Telp: (0274) 367156',
    148.5,
    19.5,
    { align: 'center' }
  );
  doc.text(
    'Website: www.smkn1bantul.sch.id | Pos-el: info@smkn1bantul.sch.id',
    148.5,
    23,
    { align: 'center' }
  );

  // Garis Pemisah Ganda Kop Surat
  doc.setDrawColor(30, 41, 59);
  doc.setLineWidth(0.6);
  doc.line(10, 24.5, 287, 24.5);
  doc.setLineWidth(0.2);
  doc.line(10, 25.2, 287, 25.2);

  // 2. Judul Dokumen
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);

  let docTitle = 'JADWAL MENGAJAR GURU';
  if (isHomeroom) {
    docTitle = `JADWAL PELAJARAN KELAS BINAAN: ${targetClassName.toUpperCase()}`;
  } else if (isStudent) {
    docTitle = `JADWAL PELAJARAN SISWA: KELAS ${targetClassName.toUpperCase()}`;
  } else if (isWaka) {
    docTitle = targetClassName && targetClassName !== '-'
      ? `JADWAL PELAJARAN KELAS ${targetClassName.toUpperCase()}`
      : 'JADWAL PELAJARAN RESMI INSTITUSI';
  }
  doc.text(docTitle, 148.5, 29.5, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(71, 85, 105);
  doc.text(
    `Tahun Ajaran: ${academicYear} | Semester: ${semester} | Putaran: ${cycleNum}`,
    148.5,
    33.2,
    { align: 'center' }
  );

  // 3. Kotak Metadata Identitas & Beban Belajar / Mengajar
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.3);
  doc.roundedRect(10, 35, 277, 8, 1, 1, 'FD');

  doc.setFontSize(7);
  doc.setTextColor(30, 41, 59);

  if (isTeacher) {
    // Kolom Kiri
    doc.setFont('helvetica', 'bold');
    doc.text('Nama Guru:', 13, 38.5);
    doc.setFont('helvetica', 'normal');
    doc.text(userName, 32, 38.5);

    doc.setFont('helvetica', 'bold');
    doc.text('NIP / Kode:', 13, 41.8);
    doc.setFont('helvetica', 'normal');
    doc.text(userNip, 32, 41.8);

    // Kolom Tengah
    doc.setFont('helvetica', 'bold');
    doc.text('Beban Mengajar:', 105, 38.5);
    doc.setFont('helvetica', 'normal');
    doc.text(`${totalJP} JP / Minggu`, 130, 38.5);

    doc.setFont('helvetica', 'bold');
    doc.text('Rombel & Mapel:', 105, 41.8);
    doc.setFont('helvetica', 'normal');
    doc.text(`${uniqueClasses} Rombel | ${uniqueSubjects} Mapel`, 130, 41.8);
  } else if (isHomeroom) {
    // Kolom Kiri
    doc.setFont('helvetica', 'bold');
    doc.text('Rombel Binaan:', 13, 38.5);
    doc.setFont('helvetica', 'normal');
    doc.text(targetClassName, 36, 38.5);

    doc.setFont('helvetica', 'bold');
    doc.text('Wali Kelas:', 13, 41.8);
    doc.setFont('helvetica', 'normal');
    doc.text(userName, 36, 41.8);

    // Kolom Tengah
    doc.setFont('helvetica', 'bold');
    doc.text('Total Beban Belajar:', 105, 38.5);
    doc.setFont('helvetica', 'normal');
    doc.text(`${totalJP} JP / Minggu`, 134, 38.5);

    doc.setFont('helvetica', 'bold');
    doc.text('Jumlah Mapel:', 105, 41.8);
    doc.setFont('helvetica', 'normal');
    doc.text(`${uniqueSubjects} Mata Pelajaran`, 134, 41.8);
  } else if (isWaka) {
    // Kolom Kiri
    doc.setFont('helvetica', 'bold');
    doc.text('Rombel Kelas:', 13, 38.5);
    doc.setFont('helvetica', 'normal');
    doc.text(targetClassName || 'Semua Rombel', 36, 38.5);

    doc.setFont('helvetica', 'bold');
    doc.text('Otoritas:', 13, 41.8);
    doc.setFont('helvetica', 'normal');
    doc.text('Waka Kurikulum', 36, 41.8);

    // Kolom Tengah
    doc.setFont('helvetica', 'bold');
    doc.text('Total Beban Belajar:', 105, 38.5);
    doc.setFont('helvetica', 'normal');
    doc.text(`${totalJP} JP / Minggu`, 134, 38.5);

    doc.setFont('helvetica', 'bold');
    doc.text('Jumlah Mapel & Guru:', 105, 41.8);
    doc.setFont('helvetica', 'normal');
    const teacherCount = new Set(cycleSchedules.map((s) => s.teacher_id || s.teacher?.id)).size;
    doc.text(`${uniqueSubjects} Mapel | ${teacherCount} Guru`, 134, 41.8);
  } else {
    doc.setFont('helvetica', 'bold');
    doc.text('Nama Siswa:', 13, 38.5);
    doc.setFont('helvetica', 'normal');
    doc.text(userName, 32, 38.5);

    doc.setFont('helvetica', 'bold');
    doc.text('NIS / Rombel:', 13, 41.8);
    doc.setFont('helvetica', 'normal');
    doc.text(`${userNis} / Kelas ${targetClassName}`, 32, 41.8);

    // Kolom Tengah
    doc.setFont('helvetica', 'bold');
    doc.text('Beban Belajar:', 105, 38.5);
    doc.setFont('helvetica', 'normal');
    doc.text(`${totalJP} JP / Minggu`, 128, 38.5);

    doc.setFont('helvetica', 'bold');
    doc.text('Jumlah Mapel:', 105, 41.8);
    doc.setFont('helvetica', 'normal');
    doc.text(`${uniqueSubjects} Mata Pelajaran`, 128, 41.8);
  }

  // Kolom Kanan (Informasi Umum Sistem)
  doc.setFont('helvetica', 'bold');
  doc.text('Upacara Senin:', 195, 38.5);
  doc.setFont('helvetica', 'normal');
  doc.text(mondayIsUpacara ? 'Upacara Aktif' : 'Reguler (07:15)', 218, 38.5);

  doc.setFont('helvetica', 'bold');
  doc.text('Dicetak Pada:', 195, 41.8);
  doc.setFont('helvetica', 'normal');
  doc.text(formatPrintTimestamp(), 218, 41.8);

  // 4. Membangun Data Tabel Matriks Jadwal
  const head = [['Jam / Waktu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat']];
  const body = [];

  // Baris Masuk Pagi 07:00 WIB
  const morningRow = [
    {
      content: 'Jam Masuk\n07:00 WIB',
      styles: { fontStyle: 'bold', fillColor: [241, 245, 249], textColor: [15, 23, 42] },
    },
  ];

  DAYS_LIST.forEach((dayName) => {
    const morning = getMorningActivity(dayName, mondayIsUpacara);
    const isMondayUpacara = dayName === 'Senin' && mondayIsUpacara;

    morningRow.push({
      content: `${morning.title.toUpperCase()}\n${morning.time} WIB`,
      styles: {
        fontStyle: 'bold',
        fillColor: isMondayUpacara
          ? [254, 243, 199]
          : dayName === 'Selasa'
          ? [239, 246, 255]
          : [241, 245, 249],
        textColor: isMondayUpacara
          ? [146, 64, 14]
          : dayName === 'Selasa'
          ? [29, 78, 216]
          : [51, 65, 85],
      },
    });
  });
  body.push(morningRow);

  // Pemetaan baris slot 1 s/d 10 dengan Istirahat I & II
  for (let slot = 1; slot <= 10; slot++) {
    const slotRow = [];

    // Kolom 0: Label Slot Jam
    slotRow.push({
      content: `Jam Ke-${slot}`,
      styles: { fontStyle: 'bold', fillColor: [248, 250, 252], textColor: [15, 23, 42] },
    });

    // Kolom 1 s/d 5: Hari Senin s/d Jumat
    DAYS_LIST.forEach((dayName) => {
      const daySlots = getTimeSlotsForDay(dayName, mondayIsUpacara, periodTemplates);
      const isDayOff = !daySlots.some((s) => s.slot === slot);

      if (isDayOff) {
        slotRow.push({
          content: '-x-\n(Off)',
          styles: { textColor: [148, 163, 184], fontStyle: 'normal' },
        });
        return;
      }

      // Cari jadwal yang mulai pada slot ini
      const matchingSchedules = cycleSchedules.filter((s) => {
        const sDay =
          typeof s.day_of_week === 'number'
            ? NUMBER_TO_DAY[s.day_of_week] || 'Senin'
            : s.day || 'Senin';
        if (sDay !== dayName) return false;
        const sSlot = Number(s.slot || s.period_number);
        return sSlot === slot;
      });

      // Cari jadwal multi-JP yang berlanjut dari jam sebelumnya
      const continuationSchedule = cycleSchedules.find((s) => {
        const sDay =
          typeof s.day_of_week === 'number'
            ? NUMBER_TO_DAY[s.day_of_week] || 'Senin'
            : s.day || 'Senin';
        if (sDay !== dayName) return false;
        const start = Number(s.slot || s.period_number);
        const dur = Number(s.duration || s.duration_periods || 1);
        return start < slot && slot < start + dur;
      });

      if (matchingSchedules.length > 0) {
        const lines = [];
        matchingSchedules.forEach((item) => {
          const mapel = item.subject?.name || item.subjectName || 'Mata Pelajaran';
          const room = item.room?.name || item.roomName || 'Ruang';
          const dur = Number(item.duration || item.duration_periods || 1);
          const slotTime = resolveSlotTime(
            dayName,
            item.slot || item.period_number,
            dur,
            mondayIsUpacara,
            periodTemplates
          );

          if (isTeacher) {
            const cls =
              item.school_class?.name ||
              item.schoolClass?.name ||
              item.className ||
              `Kelas #${item.class_id || ''}`;
            lines.push(`${mapel}\nKelas: ${cls}\n${room} (${dur} JP) | ${slotTime.timeText}`);
          } else {
            const guru = item.teacher?.name || item.teacherName || 'Guru Pengampu';
            lines.push(`${mapel}\nGuru: ${guru}\n${room} (${dur} JP) | ${slotTime.timeText}`);
          }
        });

        slotRow.push({
          content: lines.join('\n---\n'),
          styles: { textColor: [15, 23, 42], fontStyle: 'normal' },
        });
      } else if (continuationSchedule) {
        const contMapel =
          continuationSchedule.subject?.name ||
          continuationSchedule.subjectName ||
          'Mata Pelajaran';
        const detail = isTeacher
          ? continuationSchedule.school_class?.name ||
            continuationSchedule.schoolClass?.name ||
            continuationSchedule.className ||
            ''
          : continuationSchedule.room?.name || continuationSchedule.roomName || '';

        slotRow.push({
          content: `[Lanjutan]\n${contMapel}${detail ? `\n(${detail})` : ''}`,
          styles: { textColor: [100, 116, 139], fontStyle: 'italic' },
        });
      } else {
        slotRow.push({
          content: '-',
          styles: { textColor: [148, 163, 184] },
        });
      }
    });

    body.push(slotRow);

    // Baris Istirahat I setelah Jam Ke-3
    if (slot === 3) {
      const break1Row = [
        {
          content: 'Istirahat I',
          styles: { fontStyle: 'bold', fillColor: [254, 243, 199], textColor: [146, 64, 14] },
        },
      ];
      DAYS_LIST.forEach((dayName) => {
        const breaks = getBreaksForDay(dayName, mondayIsUpacara);
        const brk = breaks[0];
        break1Row.push({
          content: `${brk?.time || '09:15 - 09:30'}\n(15 Menit)`,
          styles: {
            fontStyle: 'bold',
            fillColor: [254, 243, 199],
            textColor: [146, 64, 14],
          },
        });
      });
      body.push(break1Row);
    }

    // Baris Istirahat II setelah Jam Ke-6
    if (slot === 6) {
      const break2Row = [
        {
          content: 'Istirahat II',
          styles: { fontStyle: 'bold', fillColor: [236, 253, 245], textColor: [6, 95, 70] },
        },
      ];
      DAYS_LIST.forEach((dayName) => {
        const breaks = getBreaksForDay(dayName, mondayIsUpacara);
        const brk = breaks[1];
        const isFriday = dayName === 'Jumat';
        break2Row.push({
          content: `${brk?.time || '11:30 - 12:30'}\n(${isFriday ? 'Sholat Jumat 75m' : 'Ishoma 60m'})`,
          styles: {
            fontStyle: 'bold',
            fillColor: [236, 253, 245],
            textColor: [6, 95, 70],
          },
        });
      });
      body.push(break2Row);
    }
  }

  // 5. Render AutoTable ke Dokumen
  autoTable(doc, {
    startY: 44.5,
    head: head,
    body: body,
    theme: 'grid',
    styles: {
      font: 'helvetica',
      fontSize: 6.1,
      cellPadding: 0.75,
      halign: 'center',
      valign: 'middle',
      textColor: [30, 41, 59],
      lineColor: [203, 213, 225],
      lineWidth: 0.18,
      overflow: 'linebreak',
    },
    headStyles: {
      fillColor: [30, 41, 59],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 7,
      cellPadding: 1,
      halign: 'center',
      valign: 'middle',
    },
    columnStyles: {
      0: { cellWidth: 26, halign: 'center' },
      1: { cellWidth: 50.2 },
      2: { cellWidth: 50.2 },
      3: { cellWidth: 50.2 },
      4: { cellWidth: 50.2 },
      5: { cellWidth: 50.2 },
    },
    margin: { left: 10, right: 10, bottom: 6 },
  });

  const finalY = doc.lastAutoTable.finalY || 155;

  // 6. Catatan Kaki & Pengesahan Dokumen
  doc.setFontSize(6.2);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 41, 59);
  doc.text('Catatan:', 10, finalY + 3.5);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text(
    '1. Waktu KBM mengacu pada alokasi jam resmi SMKN 1 Bantul (WIB). Jam masuk sekolah 07:00 WIB.',
    10,
    finalY + 6.8
  );
  doc.text(
    '2. Hari Senin jam ke-1 dialokasikan untuk Upacara Bendera (apabila aktif) atau Pembiasaan Karakter.',
    10,
    finalY + 10.1
  );
  doc.text(
    '3. Dokumen resmi ini diterbitkan secara otomatis melalui Sistem SCP SMKN 1 Bantul dan sah tanpa tanda tangan basah.',
    10,
    finalY + 13.4
  );

  // Tanda Tangan Pengesahan (Sebelah Kanan Bawah)
  const signX = 240;
  doc.setTextColor(30, 41, 59);
  doc.text(`Bantul, ${formatIndonesianDate()}`, signX, finalY + 3.5, { align: 'center' });
  doc.text('Mengetahui,', signX, finalY + 6.8, { align: 'center' });
  doc.setFont('helvetica', 'bold');
  doc.text('Kepala Sekolah / Waka Kurikulum', signX, finalY + 10.1, { align: 'center' });

  // Garis Tanda Tangan
  doc.setDrawColor(100, 116, 139);
  doc.setLineWidth(0.3);
  doc.line(signX - 25, finalY + 23, signX + 25, finalY + 23);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.2);
  doc.text('SMK NEGERI 1 BANTUL', signX, finalY + 26.2, { align: 'center' });

  // Penomoran Halaman di Bagian Bawah Halaman
  doc.setFontSize(6);
  doc.setTextColor(148, 163, 184);
  doc.text(
    `Halaman ${pageIndex + 1} dari ${totalPages} — Jadwal KBM Putaran ${cycleNum}`,
    148.5,
    204,
    { align: 'center' }
  );
};

/**
 * Fungsi utama ekspor jadwal ke format PDF (Mendukung Putaran 1 & Putaran 2 sekaligus)
 */
export const generateSchedulePdf = ({
  role = 'teacher', // 'teacher' | 'student' | 'homeroom'
  user = {},
  schedulesByCycle = null, // { 1: [...], 2: [...] }
  schedules = [], // fallback jika schedulesByCycle tidak diberikan
  cycle = null, // fallback jika putaran tunggal
  cycles = [1, 2], // daftar siklus yang diekspor sekaligus (default: [1, 2])
  mondayIsUpacara = true,
  periodTemplates = [],
  academicYear = '2026/2027',
  semester = 'Ganjil',
  homeroomClassName = '',
}) => {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  const isTeacher = role === 'teacher';
  const isHomeroom = role === 'homeroom';
  const isStudent = role === 'student';
  const isWaka = role === 'waka';

  const userName = user?.name || (isStudent ? 'Peserta Didik' : 'Bapak/Ibu Guru');
  const targetClassName =
    homeroomClassName ||
    user?.className ||
    user?.school_class?.name ||
    user?.schoolClass?.name ||
    (user?.class_id ? `Kelas #${user.class_id}` : '-');

  // Tentukan daftar siklus yang akan di-render
  let targetCycles = cycles;
  if (!schedulesByCycle && cycle) {
    targetCycles = [Number(cycle)];
  }

  targetCycles.forEach((cNum, index) => {
    if (index > 0) {
      doc.addPage();
    }

    let cycleData = [];
    if (schedulesByCycle && schedulesByCycle[cNum]) {
      cycleData = schedulesByCycle[cNum];
    } else if (schedules && schedules.length > 0) {
      cycleData = schedules.filter((s) => Number(s.cycle_type || s.cycle || 1) === Number(cNum));
      if (cycleData.length === 0 && targetCycles.length === 1) {
        cycleData = schedules;
      }
    }

    renderCyclePage({
      doc,
      cycleNum: cNum,
      cycleSchedules: cycleData,
      role,
      user,
      mondayIsUpacara,
      periodTemplates,
      academicYear,
      semester,
      homeroomClassName,
      pageIndex: index,
      totalPages: targetCycles.length,
    });
  });

  // Nama file unduhan
  let filePrefix = 'Jadwal_Mengajar';
  if (isHomeroom) {
    filePrefix = `Jadwal_Kelas_${sanitizeFileName(targetClassName)}`;
  } else if (isStudent) {
    filePrefix = `Jadwal_Pelajaran_${sanitizeFileName(targetClassName)}`;
  } else if (isWaka) {
    filePrefix = targetClassName && targetClassName !== '-'
      ? `Jadwal_Pelajaran_Kelas_${sanitizeFileName(targetClassName)}`
      : 'Jadwal_Pelajaran_SMKN1_Bantul';
  } else {
    filePrefix = `Jadwal_Mengajar_${sanitizeFileName(userName)}`;
  }

  const suffix = targetCycles.length > 1 ? 'Putaran_1_dan_2' : `Putaran${targetCycles[0]}`;
  const fileName = `${filePrefix}_${suffix}.pdf`;
  doc.save(fileName);

  return doc;
};

export default generateSchedulePdf;
