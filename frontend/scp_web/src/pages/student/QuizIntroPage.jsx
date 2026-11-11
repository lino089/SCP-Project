import { useEffect, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { ArrowLeft, Clock, FileQuestion, CalendarClock, Repeat, User, BookOpen, AlertCircle } from 'lucide-react';
import { quizApi } from '../../services/quizApi';
import { Button } from '../../components/shared';
import './QuizIntro.css';

const formatDateTime = (value) => {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return (
    d.toLocaleString('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }) + ' WIB'
  );
};

export default function QuizIntroPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [quiz, setQuiz] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await quizApi.getQuizDetail(id);
        const data = res?.data || res;
        if (!data) throw new Error('Data kuis tidak ditemukan.');
        setQuiz(data);
      } catch (err) {
        setError(err.message || err.response?.data?.message || 'Gagal memuat detail kuis.');
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const handleStart = async () => {
    setStarting(true);
    try {
      const res = await quizApi.startQuiz(id);
      const attempt = res?.data || res;
      navigate(`/student/quiz/${id}/attempt`, { state: { attempt } });
    } catch (err) {
      setError(err.message || err.response?.data?.message || 'Gagal memulai kuis.');
      setStarting(false);
    }
  };

  if (loading) {
    return (
      <div className="qi-page">
        <div className="qi-skeleton">
          <span />
          <span />
          <span />
        </div>
      </div>
    );
  }

  if (error || !quiz) {
    return (
      <div className="qi-page">
        <div className="qi-error">
          <AlertCircle size={28} />
          <p>{error || 'Kuis tidak tersedia.'}</p>
          <Button variant="secondary" onClick={() => navigate('/student/quiz')}>
            Kembali ke daftar kuis
          </Button>
        </div>
      </div>
    );
  }

  const questions = quiz.questions || [];
  const nominalDuration = Number(quiz.duration_minutes) || 30;

  const now = new Date();
  const dueDate = quiz.due_date ? new Date(quiz.due_date) : null;
  const minutesToDue = dueDate ? Math.max(0, Math.floor((dueDate - now) / 60000)) : null;
  const isCappedByDue = minutesToDue !== null && minutesToDue < nominalDuration;
  const effectiveDuration = isCappedByDue ? minutesToDue : nominalDuration;

  const submissions = Array.isArray(quiz.submissions) ? quiz.submissions : [];
  const attemptsUsed = submissions.length;
  const maxAttempts = Number(quiz.max_attempts || 1);
  const statusLabel =
    attemptsUsed === 0
      ? 'Belum dikerjakan'
      : attemptsUsed < maxAttempts
      ? `Percobaan ${attemptsUsed} dari ${maxAttempts} selesai`
      : 'Sudah mengumpulkan';

  return (
    <div className="qi-page">
      <div className="qi-head">
        <div>
          <div className="qi-crumb">
            <Link to="/student/quiz">Kuis</Link>
            <span>/</span>
            <span>Detail Kuis</span>
          </div>
          <h1>Detail Kuis</h1>
          <p className="qi-sub">Baca informasi di bawah ini sebelum memulai pengerjaan.</p>
        </div>
        <Button variant="outline" icon={ArrowLeft} onClick={() => navigate('/student/quiz')}>
          Kembali ke daftar
        </Button>
      </div>

      <div className="qi-grid">
        <section className="qi-card">
          <h2 className="qi-title">{quiz.title}</h2>
          <p className="qi-meta">
            {quiz.school_class?.name || quiz.schoolClass?.name || 'Kelas'} · dibuat oleh{' '}
            {quiz.teacher?.name || 'Guru'}
          </p>

          <div className="qi-tags">
            <span className="qi-tag">
              <FileQuestion size={12} /> {questions.length} butir soal
            </span>
            <span className="qi-tag qi-tag--brand">
              <Clock size={12} /> {effectiveDuration} menit
            </span>
            <span className="qi-tag">
              <Repeat size={12} /> Maks. {quiz.max_attempts || 1}×
            </span>
            <span className="qi-tag">
              <CalendarClock size={12} /> Tenggat {formatDateTime(quiz.due_date)}
            </span>
          </div>

          {isCappedByDue && (
            <div className="my-4 p-3.5 rounded-lg border border-amber-300 bg-amber-50 text-amber-950 text-xs flex items-start gap-2.5">
              <AlertCircle size={18} className="text-amber-700 shrink-0 mt-0.5" />
              <div>
                <strong className="font-semibold block text-amber-900">Penyesuaian Batas Waktu:</strong>
                Tenggat pengumpulan kuis adalah <b>{formatDateTime(quiz.due_date)}</b>. Durasi pengerjaan Anda disesuaikan menjadi <b>{effectiveDuration} menit</b> agar tidak melewati batas akhir (alokasi normal: {nominalDuration} menit).
              </div>
            </div>
          )}

          <div className="qi-info">
            <div className="qi-info__item">
              <span>Mata Pelajaran</span>
              <b>{quiz.subject?.name || quiz.school_class?.name || '—'}</b>
            </div>
            <div className="qi-info__item">
              <span>Guru Penyusun</span>
              <b>{quiz.teacher?.name || '—'}</b>
            </div>
            <div className="qi-info__item">
              <span>Jumlah Soal</span>
              <b>{questions.length} butir</b>
            </div>
            <div className="qi-info__item">
              <span>Durasi Pengerjaan</span>
              <b>{effectiveDuration} menit {isCappedByDue && '(Disesuaikan)'}</b>
            </div>
          </div>

          <div className="qi-rules">
            <h3>Ketentuan Pengerjaan</h3>
            <ul>
              <li>Kuis berlangsung dalam <b>Mode Fokus</b> (layar penuh khusus tanpa sidebar atau menu lain).</li>
              <li>Waktu mulai berjalan saat Anda menekan <b>Mulai Kuis</b> dan tidak dapat dijeda.</li>
              <li>Anda tidak diizinkan meninggalkan halaman ujian sampai jawaban dikumpulkan.</li>
              <li>Jawaban tersimpan otomatis di perangkat Anda selama kuis berlangsung.</li>
              <li>Semua soal wajib dijawab sebelum kuis dapat dikumpulkan.</li>
              <li>Bila waktu habis, jawaban yang sudah terisi akan dikumpulkan otomatis oleh sistem.</li>
            </ul>
          </div>

          <div className="qi-actions">
            <span className="qi-actions__hint">
              Dengan menekan Mulai Kuis, Mode Fokus akan aktif dan waktu langsung berjalan.
            </span>
            <Button variant="primary" size="lg" onClick={handleStart} disabled={starting}>
              {starting
                ? 'Menyiapkan…'
                : attemptsUsed > 0
                ? `Mulai Percobaan ke-${attemptsUsed + 1} →`
                : 'Mulai Kuis →'}
            </Button>
          </div>
        </section>

        <aside className="qi-aside">
          <span className="qi-aside__label">Durasi</span>
          <strong className="qi-aside__time">{effectiveDuration}:00</strong>
          <p className="qi-aside__hint">Hitung mundur dimulai setelah Anda menekan tombol mulai.</p>
          <div className="qi-aside__divider" />
          <span className="qi-aside__label">Status</span>
          <b className="qi-aside__status">{statusLabel}</b>
          <div className="qi-aside__row">
            <User size={12} />
            <span>{quiz.teacher?.name || 'Guru'}</span>
          </div>
          <div className="qi-aside__row">
            <BookOpen size={12} />
            <span>{quiz.school_class?.name || quiz.schoolClass?.name || 'Kelas'}</span>
          </div>
        </aside>
      </div>
    </div>
  );
}