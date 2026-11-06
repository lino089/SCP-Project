import { Calendar, Layers, AlertCircle, Info, CheckCircle2 } from 'lucide-react';
import Modal from '../shared/Modal';
import Button from '../shared/Button';
import Badge from '../shared/Badge';

const TYPE_CONFIG = {
  holiday: { label: 'Libur Nasional / Resmi', variant: 'danger' },
  school_event: { label: 'Kegiatan Sekolah', variant: 'warning' },
  class_event: { label: 'Kegiatan Khusus Tingkat/Rombel', variant: 'warning' },
  exam: { label: 'Masa Penilaian / Ujian', variant: 'primary' },
};

export default function AcademicEventDetailModal({
  isOpen = false,
  onClose,
  event = null,
  userRole = 'student',
}) {
  if (!event) return null;

  const typeMeta = TYPE_CONFIG[event.type] || { label: event.type, variant: 'secondary' };

  // Format tanggal Bahasa Indonesia
  const formatDateRange = () => {
    if (!event.start_date) return '-';
    if (event.start_date === event.end_date) {
      return new Date(event.start_date + 'T00:00:00').toLocaleDateString('id-ID', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      });
    }

    const d1 = new Date(event.start_date + 'T00:00:00').toLocaleDateString('id-ID', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
    const d2 = new Date(event.end_date + 'T00:00:00').toLocaleDateString('id-ID', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });

    return `${d1} s/d ${d2}`;
  };

  const footer = (
    <div className="flex justify-end w-full">
      <Button variant="secondary" onClick={onClose}>
        Tutup
      </Button>
    </div>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Rincian Agenda Kegiatan Sekolah"
      size="md"
      footer={footer}
    >
      <div className="space-y-4 text-sm text-gray-700">
        {/* Judul & Kategori */}
        <div>
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <Badge variant={typeMeta.variant}>{typeMeta.label}</Badge>
            {event.disables_teaching ? (
              <Badge variant="danger">KBM Ditiadakan</Badge>
            ) : (
              <Badge variant="success">KBM Berjalan Normal</Badge>
            )}
          </div>
          <h3 className="text-lg font-bold text-gray-900 leading-snug">
            {event.title}
          </h3>
        </div>

        {/* Waktu Pelaksanaan */}
        <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg space-y-2">
          <div className="flex items-start gap-2 text-xs">
            <Calendar size={15} className="text-gray-500 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-gray-800">Waktu Pelaksanaan:</span>
              <p className="text-gray-700 mt-0.5">{formatDateRange()}</p>
            </div>
          </div>

          <div className="flex items-start gap-2 text-xs">
            <Layers size={15} className="text-gray-500 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-gray-800">Cakupan Agenda:</span>
              <p className="text-gray-700 mt-0.5">
                {event.scope_type === 'all'
                  ? 'Berlaku untuk Seluruh Sekolah (Kelas X, XI, XII)'
                  : event.scope_type === 'grade'
                  ? `Khusus Tingkat Kelas ${(event.scope_targets || []).join(', ')}`
                  : Array.isArray(event.target_classes) && event.target_classes.length > 0
                  ? `Khusus Rombel: ${event.target_classes.map((c) => c.name).join(', ')}`
                  : 'Khusus Rombel Tertentu'}
              </p>
            </div>
          </div>
        </div>

        {/* Deskripsi & Instruksi */}
        {event.description ? (
          <div>
            <span className="font-semibold text-xs text-gray-700 block mb-1">
              Deskripsi &amp; Instruksi Pelaksanaan:
            </span>
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs leading-relaxed text-slate-800 whitespace-pre-wrap">
              {event.description}
            </div>
          </div>
        ) : (
          <div className="text-xs text-gray-400 italic">
            Tidak ada deskripsi tambahan untuk agenda ini.
          </div>
        )}

        {/* Kotak Informasi Khusus Berdasarkan Role */}
        {userRole === 'teacher' && (
          <div
            className={`p-3.5 border rounded-lg text-xs space-y-1.5 ${
              event.affects_my_teaching
                ? 'bg-amber-50/70 border-amber-200 text-amber-900'
                : 'bg-blue-50/70 border-blue-200 text-blue-900'
            }`}
          >
            <div className="font-semibold flex items-center gap-1.5">
              {event.affects_my_teaching ? (
                <>
                  <AlertCircle size={15} className="text-amber-600" />
                  <span>Dampak Terhadap Jadwal Mengajar Anda:</span>
                </>
              ) : (
                <>
                  <Info size={15} className="text-blue-600" />
                  <span>Status Jadwal Mengajar Anda:</span>
                </>
              )}
            </div>
            {event.affects_my_teaching ? (
              <p>
                Agenda ini membebaskan kewajiban KBM pada kelas ajar Anda:{' '}
                <strong>{(event.affected_my_classes || []).join(', ')}</strong>. Pengisian jurnal dan presensi KBM pada slot jadwal tersebut otomatis dikecualikan oleh sistem.
              </p>
            ) : (
              <p>
                Agenda ini tidak menonaktifkan jam mengajar aktif Anda. Pembelajaran dan pengisian jurnal pada kelas ajar Anda tetap berjalan sesuai jadwal reguler.
              </p>
            )}
          </div>
        )}

        {userRole === 'parent' && (
          <div className="p-3.5 bg-blue-50/70 border border-blue-200 text-blue-900 rounded-lg text-xs space-y-2">
            <div className="font-semibold flex items-center gap-1.5 text-blue-800">
              <Info size={15} />
              <span>Panduan Kehadiran untuk Orang Tua / Wali:</span>
            </div>
            <p className="leading-relaxed">
              {event.attendance_guidance ||
                (event.disables_teaching
                  ? 'Kegiatan Khusus Sekolah — Siswa mengikuti instruksi kegiatan sekolah/lapangan. KBM reguler di kelas ditiadakan.'
                  : 'KBM reguler di sekolah tetap berlangsung sebagaimana biasa.')}
            </p>

            {Array.isArray(event.applicable_children) && event.applicable_children.length > 0 && (
              <div className="pt-2 border-t border-blue-200/60">
                <span className="font-medium text-blue-800 block mb-1">
                  Siswa yang Terdampak Agenda Ini:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {event.applicable_children.map((child, i) => (
                    <Badge key={child.id || i} variant="info">
                      {child.tag_label || child.name}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {userRole === 'student' && (
          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg text-xs space-y-1">
            <span className="font-semibold text-slate-800 flex items-center gap-1.5">
              <CheckCircle2 size={15} className="text-emerald-600" />
              <span>Status Pembelajaran Kelas:</span>
            </span>
            <p className="text-slate-700">
              {event.disables_teaching
                ? 'KBM reguler di kelas ditiadakan pada tanggal ini. Ikuti instruksi agenda kegiatan yang telah ditentukan oleh pihak sekolah.'
                : 'Kegiatan ini tidak meniadakan KBM. Seluruh siswa tetap mengikuti pembelajaran kelas seperti biasa.'}
            </p>
          </div>
        )}
      </div>
    </Modal>
  );
}
