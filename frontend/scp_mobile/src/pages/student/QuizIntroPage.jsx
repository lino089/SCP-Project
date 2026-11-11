import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Clock, FileQuestion, CalendarClock, Repeat, AlertTriangle } from 'lucide-react';
import { quizApi } from '../../services/quizApi';
import { Button } from '../../components/shared';
import './QuizMobile.css';

const fmt = (value) => {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

export default function MobileQuizIntroPage() {
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
        if (!data) throw new Error('Kuis tidak ditemukan.');
        setQuiz(data);
      } catch (err) {
        setError(err.message || err.response?.data?.message || 'Gagal memuat kuis.');
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

  if (loading) return <div className="qm-page"><p className="qm-muted">Memuat detail kuis…</p></div>;

  if (error || !quiz) {
    return (
      <div className="qm-page">
        <div className="qm-center">
          <AlertTriangle size={22} />
          <p>{error || 'Kuis tidak tersedia.'}</p>
          <Button variant="secondary" onClick={() => navigate('/student/quiz')}>
            Kembali
          </Button>
        </div>
      </div>
    );
  }

  const questions = quiz.questions || [];
  const duration = Number(quiz.duration_minutes) || 30;

  return (
    <div className="qm-page">
      <header className="qm-head">
        <button type="button" className="qm-back" onClick={() => navigate('/student/quiz')} aria-label="Kembali">
          <ArrowLeft size={16} />
        </button>
        <div>
          <h1>Detail Kuis</h1>
          <p>{quiz.school_class?.name || quiz.schoolClass?.name || 'Kelas'}</p>
        </div>
      </header>

      <div className="qm-body">
        <div className="qm-card">
          <h2 className="qm-title">{quiz.title}</h2>
          <p className="qm-muted">{quiz.teacher?.name || 'Guru'}</p>
          <div className="qm-tags">
            <span className="qm-tag qm-tag--brand"><Clock size={11} /> {duration} menit</span>
            <span className="qm-tag"><FileQuestion size={11} /> {questions.length} soal</span>
            <span className="qm-tag"><Repeat size={11} /> {quiz.max_attempts || 1}×</span>
          </div>
        </div>

        <div className="qm-card">
          <h3>Informasi</h3>
          <div className="qm-grid2">
            <div className="qm-info"><span>Soal</span><b>{questions.length} butir</b></div>
            <div className="qm-info"><span>Durasi</span><b>{duration} menit</b></div>
            <div className="qm-info"><span>Tenggat</span><b>{fmt(quiz.due_date)}</b></div>
            <div className="qm-info"><span>Percobaan</span><b>{quiz.max_attempts || 1}×</b></div>
          </div>
        </div>

        <div className="qm-card">
          <h3>Ketentuan</h3>
          <ul className="qm-rules">
            <li>Waktu berjalan setelah menekan Mulai Kuis.</li>
            <li>Semua soal wajib dijawab sebelum dikumpulkan.</li>
            <li>Waktu habis → jawaban dikumpulkan otomatis.</li>
          </ul>
          <p className="qm-muted" style={{ fontSize: 10.5, marginTop: 6 }}>
            <CalendarClock size={11} /> Tenggat {fmt(quiz.due_date)}
          </p>
        </div>
      </div>

      <footer className="qm-foot">
        <Button variant="secondary" onClick={() => navigate('/student/quiz')}>Kembali</Button>
        <Button variant="primary" onClick={handleStart} disabled={starting}>
          {starting ? 'Menyiapkan…' : 'Mulai Kuis →'}
        </Button>
      </footer>
    </div>
  );
}