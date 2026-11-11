import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Clock, Send, LayoutGrid, CheckCircle2, X } from 'lucide-react';
import { quizApi } from '../../services/quizApi';
import { Button } from '../../components/shared';
import './QuizMobile.css';

const pad = (n) => String(n).padStart(2, '0');
const filled = (v) => v !== undefined && v !== null && String(v).trim().length > 0;

export default function MobileQuizAttemptPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  const [quiz, setQuiz] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState({});
  const [currentIdx, setCurrentIdx] = useState(0);
  const [expiresAt, setExpiresAt] = useState(null);
  const [remaining, setRemaining] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [missingIds, setMissingIds] = useState([]);
  const [showMissing, setShowMissing] = useState(false);
  const [navOpen, setNavOpen] = useState(false);

  const submitRef = useRef(null);
  const autoRef = useRef(false);
  const draftKey = `quiz_draft_${id}`;

  useEffect(() => {
    (async () => {
      try {
        const res = await quizApi.getQuizDetail(id);
        const data = res?.data || res;
        if (!data) throw new Error('Kuis tidak ditemukan.');

        let attempt = location.state?.attempt;
        if (!attempt?.expires_at) {
          const startRes = await quizApi.startQuiz(id);
          attempt = startRes?.data || startRes;
        }

        setQuiz(data);
        setQuestions(data.questions || []);
        setExpiresAt(attempt?.expires_at || null);
        if (attempt?.remaining_seconds != null) setRemaining(Number(attempt.remaining_seconds));

        const saved = localStorage.getItem(draftKey);
        if (saved) {
          try {
            setAnswers(JSON.parse(saved));
          } catch {
            setAnswers({});
          }
        }
      } catch (err) {
        setError(err.message || err.response?.data?.message || 'Gagal memuat kuis.');
      } finally {
        setLoading(false);
      }
    })();
  }, [id, draftKey, location.state]);

  useEffect(() => {
    if (!expiresAt) return undefined;
    const tick = () => {
      const diff = Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000));
      setRemaining(diff);
    };
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [expiresAt]);

  const answeredCount = useMemo(() => questions.filter((q) => filled(answers[q.id])).length, [answers, questions]);
  const unansweredIds = useMemo(() => questions.filter((q) => !filled(answers[q.id])).map((q) => q.id), [answers, questions]);
  const current = questions[currentIdx];

  const setAnswer = (qid, value) => {
    setAnswers((prev) => {
      const next = { ...prev, [qid]: value };
      localStorage.setItem(draftKey, JSON.stringify(next));
      return next;
    });
  };

  const jumpTo = (qid) => {
    const index = questions.findIndex((q) => q.id === qid);
    if (index >= 0) setCurrentIdx(index);
    setShowMissing(false);
    setNavOpen(false);
  };

  const executeSubmit = useCallback(
    async (auto = false) => {
      if (submitting) return;
      setSubmitting(true);
      try {
        const payload = questions.map((q) => {
          const value = answers[q.id] ?? '';
          return {
            question_id: q.id,
            question_text: q.question_text,
            question_type: q.question_type,
            student_answer: value,
            answer: value,
            selected_option: q.question_type === 'multiple_choice' ? value : null,
          };
        });
        await quizApi.submitQuiz(id, { answers: payload });
        localStorage.removeItem(draftKey);
        setDone(true);
        setShowMissing(false);
      } catch (err) {
        const serverMissing = err.response?.data?.missing_questions;
        if (Array.isArray(serverMissing) && serverMissing.length > 0) {
          setMissingIds(serverMissing.map(Number));
          setShowMissing(true);
        } else if (!auto) {
          setError(err.message || 'Gagal mengumpulkan jawaban.');
        }
      } finally {
        setSubmitting(false);
      }
    },
    [answers, draftKey, id, questions, submitting]
  );

  useEffect(() => {
    submitRef.current = executeSubmit;
  }, [executeSubmit]);

  useEffect(() => {
    if (remaining !== 0 || done || autoRef.current || questions.length === 0) return;
    autoRef.current = true;
    submitRef.current?.(true);
  }, [remaining, done, questions.length]);

  const handleSubmitClick = () => {
    if (remaining !== null && remaining <= 0) return executeSubmit(true);
    if (unansweredIds.length > 0) {
      setMissingIds(unansweredIds);
      setShowMissing(true);
      return;
    }
    executeSubmit(false);
  };

  const timeLabel = remaining === null ? '--:--' : `${pad(Math.floor(remaining / 60))}:${pad(remaining % 60)}`;
  const critical = remaining !== null && remaining <= 300;
  const pct = questions.length ? Math.round((answeredCount / questions.length) * 100) : 0;

  if (loading) return <div className="qm-page"><p className="qm-muted">Menyiapkan kuis…</p></div>;

  if (done) {
    return (
      <div className="qm-page">
        <div className="qm-center">
          <CheckCircle2 size={30} />
          <h2 style={{ fontSize: 16, fontWeight: 800 }}>Jawaban terkumpul</h2>
          <p className="qm-muted">
            {answeredCount} dari {questions.length} soal terisi. Hasil dapat dilihat pada daftar kuis.
          </p>
          <Button variant="primary" onClick={() => navigate('/student/quiz')}>Kembali ke daftar</Button>
        </div>
      </div>
    );
  }

  if (error && !quiz) {
    return (
      <div className="qm-page">
        <div className="qm-center">
          <p>{error}</p>
          <Button variant="secondary" onClick={() => navigate('/student/quiz')}>Kembali</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="qm-page">
      <header className="qm-attempt-head">
        <button type="button" className="qm-back" onClick={() => navigate('/student/quiz')} aria-label="Kembali">
          <ArrowLeft size={15} />
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1 style={{ fontSize: 12.5 }}>{quiz?.title}</h1>
          <p className="qm-muted">{answeredCount}/{questions.length} dijawab</p>
        </div>
        <span className={`qm-timer ${critical ? 'qm-timer--critical' : ''}`}>
          <Clock size={12} /> {timeLabel}
        </span>
      </header>

      <div className="qm-progress"><span style={{ width: `${pct}%` }} /></div>

      <div className="qm-body">
        {current ? (
          <div className="qm-card">
            <div className="qm-qtop">
              <span className="qm-qnum">Soal {currentIdx + 1} / {questions.length}</span>
              <span className={`qm-badge ${current.question_type === 'multiple_choice' ? 'qm-badge--mc' : 'qm-badge--es'}`}>
                {current.question_type === 'multiple_choice' ? 'PG' : 'Esai'}
              </span>
              <span className="qm-points">{current.points || 20} poin</span>
            </div>
            <p className="qm-qtext">{current.question_text}</p>

            {current.question_type === 'multiple_choice' ? (
              <div className="qm-options">
                {Object.entries(current.options || {}).map(([letter, text]) => {
                  const on = answers[current.id] === letter;
                  return (
                    <button key={letter} type="button" className={`qm-option ${on ? 'on' : ''}`} onClick={() => setAnswer(current.id, letter)}>
                      <span className="qm-option__l">{on ? '✓' : letter}</span>
                      <span>{text}</span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <textarea
                className="qm-textarea"
                rows={6}
                placeholder="Tulis jawaban…"
                value={answers[current.id] || ''}
                onChange={(e) => setAnswer(current.id, e.target.value)}
              />
            )}
          </div>
        ) : (
          <p className="qm-muted">Kuis ini belum memiliki butir soal.</p>
        )}
      </div>

      <footer className="qm-foot">
        <button type="button" className="qm-navbtn" onClick={() => setCurrentIdx((i) => Math.max(0, i - 1))} disabled={currentIdx === 0}>
          <ArrowLeft size={15} />
        </button>
        <button type="button" className="qm-navbtn" onClick={() => setNavOpen(true)}>
          <LayoutGrid size={13} /> {currentIdx + 1}/{questions.length}
        </button>
        <Button variant="primary" icon={Send} onClick={handleSubmitClick} disabled={submitting || questions.length === 0}>
          {submitting ? 'Mengirim…' : 'Kumpulkan'}
        </Button>
        <button type="button" className="qm-navbtn" onClick={() => setCurrentIdx((i) => Math.min(questions.length - 1, i + 1))} disabled={currentIdx >= questions.length - 1}>
          <ArrowRight size={15} />
        </button>
      </footer>

      {navOpen && (
        <div className="qm-sheet" onClick={() => setNavOpen(false)}>
          <div className="qm-sheet__panel" onClick={(e) => e.stopPropagation()}>
            <div className="qm-sheet__head">
              <strong>Nomor soal</strong>
              <button type="button" onClick={() => setNavOpen(false)} aria-label="Tutup"><X size={15} /></button>
            </div>
            <div className="qm-nums">
              {questions.map((q, i) => (
                <button
                  key={q.id}
                  type="button"
                  className={`qm-num ${i === currentIdx ? 'cur' : ''} ${filled(answers[q.id]) && i !== currentIdx ? 'done' : ''} ${missingIds.includes(q.id) ? 'miss' : ''}`}
                  onClick={() => jumpTo(q.id)}
                >
                  {i + 1}
                </button>
              ))}
            </div>
            <p className="qm-muted" style={{ marginTop: 8 }}>{unansweredIds.length} soal belum dijawab</p>
          </div>
        </div>
      )}

      {showMissing && (
        <div className="qm-sheet" style={{ alignItems: 'center', display: 'grid', placeItems: 'center' }} onClick={() => setShowMissing(false)}>
          <div className="qm-dialog" onClick={(e) => e.stopPropagation()}>
            <h3>Masih ada {missingIds.length} soal kosong</h3>
            <p className="qm-muted">Semua soal wajib dijawab sebelum dikumpulkan.</p>
            <div className="qm-nums" style={{ margin: '10px 0' }}>
              {missingIds.map((qid) => (
                <button key={qid} type="button" className="qm-num miss" onClick={() => jumpTo(qid)}>
                  {questions.findIndex((q) => q.id === qid) + 1}
                </button>
              ))}
            </div>
            <Button variant="primary" fullWidth onClick={() => jumpTo(missingIds[0])}>
              Kerjakan soal tersisa
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}