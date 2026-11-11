import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { Clock, Send, AlertTriangle, CheckCircle2, X, LayoutGrid, ShieldAlert } from 'lucide-react';
import { quizApi } from '../../services/quizApi';
import { Button } from '../../components/shared';
import './QuizAttempt.css';

const pad = (n) => String(n).padStart(2, '0');

const isAnsweredValue = (value) => value !== undefined && value !== null && String(value).trim().length > 0;

export default function QuizAttemptPage() {
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
  const autoSubmittedRef = useRef(false);
  const draftKey = `quiz_draft_${id}`;

  // Muat kuis + attempt aktif
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

        // Kunci status ujian di sessionStorage untuk mengaktifkan Focus Mode Route Guard
        if (attempt?.expires_at) {
          sessionStorage.setItem(
            'scp_active_quiz_attempt',
            JSON.stringify({
              quizId: id,
              attemptId: attempt?.id,
              expiresAt: attempt.expires_at,
            })
          );
        }

        if (attempt?.remaining_seconds !== undefined && attempt?.remaining_seconds !== null) {
          setRemaining(Number(attempt.remaining_seconds));
        }

        const saved = localStorage.getItem(draftKey);
        if (saved) {
          try {
            setAnswers(JSON.parse(saved));
          } catch {
            setAnswers({});
          }
        }
      } catch (err) {
        sessionStorage.removeItem('scp_active_quiz_attempt');
        setError(err.message || err.response?.data?.message || 'Gagal memuat kuis.');
      } finally {
        setLoading(false);
      }
    })();
  }, [id, draftKey, location.state]);

  // Hitung mundur dari expires_at (waktu server)
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

  // PROTEKSI FOCUS MODE: Cegah penutupan tab, reload (F5), atau tombol mundur browser
  useEffect(() => {
    if (done || submitting) return undefined;

    const handleBeforeUnload = (e) => {
      e.preventDefault();
      e.returnValue = 'Kuis sedang berlangsung dalam Mode Fokus! Waktu pengerjaan akan tetap berjalan.';
      return e.returnValue;
    };

    window.history.pushState(null, '', window.location.href);
    const handlePopState = () => {
      window.history.pushState(null, '', window.location.href);
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('popstate', handlePopState);
    };
  }, [done, submitting]);

  const answeredCount = useMemo(
    () => questions.filter((q) => isAnsweredValue(answers[q.id])).length,
    [answers, questions]
  );

  const unansweredIds = useMemo(
    () => questions.filter((q) => !isAnsweredValue(answers[q.id])).map((q) => q.id),
    [answers, questions]
  );

  const currentQuestion = questions[currentIdx];

  const handleAnswer = (questionId, value) => {
    setAnswers((prev) => {
      const next = { ...prev, [questionId]: value };
      localStorage.setItem(draftKey, JSON.stringify(next));
      return next;
    });
  };

  const jumpToQuestion = (questionId) => {
    const index = questions.findIndex((q) => q.id === questionId);
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

        await quizApi.submitQuiz(id, {
          answers: payload,
          is_auto_submit: auto,
          auto_submitted: auto,
        });

        localStorage.removeItem(draftKey);
        sessionStorage.removeItem('scp_active_quiz_attempt');
        setDone(true);
        setShowMissing(false);
      } catch (err) {
        const message = err.message || err.response?.data?.message || 'Gagal mengumpulkan jawaban.';
        const serverMissing = err.response?.data?.missing_questions;
        if (Array.isArray(serverMissing) && serverMissing.length > 0) {
          setMissingIds(serverMissing.map(Number));
          setShowMissing(true);
        } else if (!auto) {
          setError(message);
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

  // Waktu habis → auto-submit sekali
  useEffect(() => {
    if (remaining !== 0 || done || autoSubmittedRef.current || questions.length === 0) return;
    autoSubmittedRef.current = true;
    submitRef.current?.(true);
  }, [remaining, done, questions.length]);

  const handleSubmitClick = () => {
    if (remaining !== null && remaining <= 0) {
      executeSubmit(true);
      return;
    }
    if (unansweredIds.length > 0) {
      setMissingIds(unansweredIds);
      setShowMissing(true);
      return;
    }
    executeSubmit(false);
  };

  const timeLabel = remaining === null ? '--:--' : `${pad(Math.floor(remaining / 60))}:${pad(remaining % 60)}`;
  const timeCritical = remaining !== null && remaining <= 300;
  const progressPct = questions.length ? Math.round((answeredCount / questions.length) * 100) : 0;

  if (loading) {
    return (
      <div className="qa-page">
        <div className="qa-loading">Menyiapkan kuis…</div>
      </div>
    );
  }

  if (error && !quiz) {
    return (
      <div className="qa-page qa-page--focus">
        <div className="qa-error">
          <AlertTriangle size={26} />
          <p>{error}</p>
          <Button
            variant="secondary"
            onClick={() => {
              sessionStorage.removeItem('scp_active_quiz_attempt');
              navigate('/student/quiz');
            }}
          >
            Kembali ke daftar kuis
          </Button>
        </div>
      </div>
    );
  }

  if (done) {
    return (
      <div className="qa-page qa-page--focus">
        <div className="qa-done">
          <CheckCircle2 size={34} />
          <h2>Jawaban berhasil dikumpulkan</h2>
          <p>
            {answeredCount} dari {questions.length} soal terisi. Penilaian diproses otomatis oleh evaluasi AI; hasil dapat dilihat
            pada daftar kuis setelah dirilis oleh guru.
          </p>
          <Button
            variant="primary"
            onClick={() => {
              sessionStorage.removeItem('scp_active_quiz_attempt');
              navigate('/student/quiz');
            }}
          >
            Kembali ke daftar kuis
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="qa-page qa-page--focus">
      <header className="qa-head">
        <div className="qa-head__left">
          <div className="qa-focus-badge flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 border border-amber-300 text-amber-900 rounded-lg text-xs font-bold shadow-xs">
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
            <span>Mode Fokus Ujian</span>
          </div>
          <div>
            <h1>{quiz?.title || 'Kuis'}</h1>
            <p>
              {answeredCount} / {questions.length} soal terjawab
            </p>
          </div>
        </div>
        <div className="qa-head__right">
          <div className="qa-progress" aria-hidden="true">
            <span style={{ width: `${progressPct}%` }} />
          </div>
          <span className={`qa-timer ${timeCritical ? 'qa-timer--critical' : ''}`}>
            <Clock size={14} /> {timeLabel}
          </span>
        </div>
      </header>

      <div className="qa-grid">
        <section className="qa-question">
          {currentQuestion ? (
            <>
              <div className="qa-question__top">
                <span className="qa-qnum">
                  Soal {currentIdx + 1} dari {questions.length}
                </span>
                <span className={`qa-badge ${currentQuestion.question_type === 'multiple_choice' ? 'qa-badge--mc' : 'qa-badge--es'}`}>
                  {currentQuestion.question_type === 'multiple_choice' ? 'Pilihan Ganda' : 'Esai'}
                </span>
                <span className="qa-points">{currentQuestion.points || 20} poin</span>
              </div>

              <p className="qa-text">{currentQuestion.question_text}</p>

              {currentQuestion.question_type === 'multiple_choice' ? (
                <div className="qa-options">
                  {Object.entries(currentQuestion.options || {}).map(([letter, text]) => {
                    const selected = answers[currentQuestion.id] === letter;
                    return (
                      <button
                        key={letter}
                        type="button"
                        className={`qa-option ${selected ? 'qa-option--on' : ''}`}
                        onClick={() => handleAnswer(currentQuestion.id, letter)}
                        aria-pressed={selected}
                      >
                        <span className="qa-option__letter">{selected ? '✓' : letter}</span>
                        <span className="qa-option__text">{text}</span>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <textarea
                  className="qa-textarea"
                  rows={6}
                  placeholder="Tulis jawaban Anda di sini…"
                  value={answers[currentQuestion.id] || ''}
                  onChange={(e) => handleAnswer(currentQuestion.id, e.target.value)}
                />
              )}
            </>
          ) : (
            <p className="qa-empty">Kuis ini belum memiliki butir soal.</p>
          )}
        </section>

        <aside className="qa-nav">
          <div className="qa-nav__head">
            <LayoutGrid size={13} />
            <span>Nomor soal</span>
          </div>
          <div className="qa-nav__grid">
            {questions.map((q, index) => {
              const answered = isAnsweredValue(answers[q.id]);
              const missing = missingIds.includes(q.id);
              return (
                <button
                  key={q.id}
                  type="button"
                  className={`qa-num ${index === currentIdx ? 'qa-num--cur' : ''} ${answered && index !== currentIdx ? 'qa-num--done' : ''} ${missing ? 'qa-num--miss' : ''}`}
                  onClick={() => jumpToQuestion(q.id)}
                >
                  {index + 1}
                </button>
              );
            })}
          </div>
          <div className="qa-legend">
            <span><i className="qa-dot qa-dot--done" /> Dijawab</span>
            <span><i className="qa-dot qa-dot--cur" /> Soal aktif</span>
            <span><i className="qa-dot" /> Belum dijawab</span>
          </div>
          <div className="qa-nav__submit">
            <p>{unansweredIds.length > 0 ? `${unansweredIds.length} soal belum dijawab` : 'Semua soal sudah dijawab'}</p>
            <Button variant="primary" icon={Send} onClick={handleSubmitClick} disabled={submitting || questions.length === 0}>
              {submitting ? 'Mengumpulkan…' : 'Kumpulkan'}
            </Button>
          </div>
        </aside>
      </div>

      <footer className="qa-foot">
        <Button variant="secondary" onClick={() => setCurrentIdx((i) => Math.max(0, i - 1))} disabled={currentIdx === 0}>
          ← Sebelumnya
        </Button>
        <span className="qa-foot__hint">Jawaban tersimpan otomatis di perangkat ini.</span>
        <div className="qa-foot__right">
          <Button
            variant="ghost"
            icon={LayoutGrid}
            className="qa-foot__nav"
            onClick={() => setNavOpen(true)}
          >
            {currentIdx + 1}/{questions.length}
          </Button>
          <Button
            variant="primary"
            onClick={() => setCurrentIdx((i) => Math.min(questions.length - 1, i + 1))}
            disabled={currentIdx >= questions.length - 1}
          >
            Selanjutnya →
          </Button>
        </div>
      </footer>

      {/* daftar nomor (mobile) */}
      {navOpen && (
        <div className="qa-sheet" onClick={() => setNavOpen(false)}>
          <div className="qa-sheet__panel" onClick={(e) => e.stopPropagation()}>
            <div className="qa-sheet__head">
              <strong>Nomor soal</strong>
              <button type="button" onClick={() => setNavOpen(false)} aria-label="Tutup">
                <X size={16} />
              </button>
            </div>
            <div className="qa-nav__grid">
              {questions.map((q, index) => {
                const answered = isAnsweredValue(answers[q.id]);
                return (
                  <button
                    key={q.id}
                    type="button"
                    className={`qa-num ${index === currentIdx ? 'qa-num--cur' : ''} ${answered && index !== currentIdx ? 'qa-num--done' : ''} ${missingIds.includes(q.id) ? 'qa-num--miss' : ''}`}
                    onClick={() => jumpToQuestion(q.id)}
                  >
                    {index + 1}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* validasi soal kosong */}
      {showMissing && (
        <div className="qa-modal">
          <div className="qa-modal__box">
            <h3>Masih ada {missingIds.length} soal belum dijawab</h3>
            <p>Semua butir soal wajib dijawab sebelum kuis dapat dikumpulkan.</p>
            <div className="qa-modal__nums">
              {missingIds.map((qid) => (
                <button key={qid} type="button" className="qa-num qa-num--miss" onClick={() => jumpToQuestion(qid)}>
                  {questions.findIndex((q) => q.id === qid) + 1}
                </button>
              ))}
            </div>
            <div className="qa-modal__actions">
              <Button variant="primary" onClick={() => jumpToQuestion(missingIds[0])}>
                Kerjakan soal tersisa
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}