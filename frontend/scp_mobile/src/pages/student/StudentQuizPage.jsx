import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Clock,
  CheckCircle2,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Send,
  Eye,
  RotateCw,
  Sparkles,
  ArrowLeft,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { quizApi } from '../../services/quizApi';
import {
  Button,
  Badge,
  BottomSheetModal,
  ConfirmSheet,
  DataTable,
  PaginationBar,
} from '../../components/shared';
import { EmptyState } from '../../components/feedback';

export default function StudentQuizPage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [quizzes, setQuizzes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [filterTab, setFilterTab] = useState('all'); // 'all' | 'available' | 'graded'

  // Pagination tabel daftar kuis
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);

  // Quiz Taking Mode States
  const [activeQuiz, setActiveQuiz] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [currentQuestionIdx, setCurrentQuestionIdx] = useState(0);
  const [studentAnswers, setStudentAnswers] = useState({}); // { [question_id]: string }
  const [timeLeftSeconds, setTimeLeftSeconds] = useState(1800);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isConfirmSubmitOpen, setIsConfirmSubmitOpen] = useState(false);
  const [isExitTakingOpen, setIsExitTakingOpen] = useState(false);

  // Result / Inspection State
  const [inspectQuiz, setInspectQuiz] = useState(null);
  const [mySubmission, setMySubmission] = useState(null);
  const [loadingSubmission, setLoadingSubmission] = useState(false);

  // Toast message
  const [toast, setToast] = useState({ show: false, message: '', variant: 'success' });
  const showToast = (message, variant = 'success') => {
    setToast({ show: true, message, variant });
    setTimeout(() => setToast({ show: false, message: '', variant: 'success' }), 4000);
  };

  // Timer refs
  const timerRef = useRef(null);
  const autoSubmitRef = useRef(null);

  // Load Quizzes for Student
  const loadQuizzes = useCallback(async () => {
    setLoadError(null);
    try {
      const res = await quizApi.getQuizzes();
      const list = Array.isArray(res) ? res : Array.isArray(res?.data) ? res.data : [];
      // Filter kuis yang berstatus published atau published_result
      const available = list.filter(
        (q) => q.status === 'published' || q.status === 'published_result'
      );
      setQuizzes(available);
    } catch (err) {
      console.warn('Gagal memuat kuis siswa:', err);
      setLoadError(err.message || 'Gagal memuat data kuis dari server.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancel = false;
    async function init() {
      try {
        await loadQuizzes();
      } catch {
        if (!cancel) setLoadError('Gagal menghubungkan ke server.');
      }
    }
    init();
    return () => {
      cancel = true;
    };
  }, [loadQuizzes]);

  const handleRefresh = async () => {
    setLoading(true);
    await loadQuizzes();
  };

  // Helper status kuis
  const getQuizMeta = useCallback(
    (quiz) => {
      if (quiz.status === 'published_result') {
        return {
          key: 'published_result',
          label: 'Hasil Tersedia',
          variant: 'info',
          canTake: false,
          canViewResult: true,
          actionLabel: 'Lihat Nilai & Ulasan',
        };
      }

      const submissions = Array.isArray(quiz.submissions) ? quiz.submissions : [];
      const maxAttempts = Number(quiz.max_attempts || 1);
      const attemptsUsed = submissions.length;
      const isExpired = quiz.due_date ? new Date(quiz.due_date) < new Date() : false;

      if (attemptsUsed >= maxAttempts) {
        return {
          key: 'completed',
          label: 'Sudah Dikerjakan',
          variant: 'success',
          canTake: false,
          canViewResult: false,
          actionLabel: 'Selesai Dikumpulkan',
        };
      }

      if (isExpired) {
        return {
          key: 'expired',
          label: 'Waktu Berakhir',
          variant: 'error',
          canTake: false,
          canViewResult: false,
          actionLabel: 'Batas Waktu Habis',
        };
      }

      const draftKey = `quiz_draft_${user?.id}_${quiz.id}`;
      const hasDraft = typeof window !== 'undefined' && !!sessionStorage.getItem(draftKey);

      return {
        key: 'available',
        label: hasDraft ? 'Lanjutkan Kuis' : 'Siap Dikerjakan',
        variant: 'warning',
        canTake: true,
        canViewResult: false,
        actionLabel: hasDraft ? 'Lanjutkan Pengerjaan' : 'Mulai Kerjakan',
      };
    },
    [user?.id]
  );

  // Filtered Quizzes
  const filteredQuizzes = useMemo(() => {
    return quizzes.filter((quiz) => {
      const meta = getQuizMeta(quiz);
      if (filterTab === 'available') return meta.canTake;
      if (filterTab === 'graded') return meta.canViewResult;
      return true;
    });
  }, [quizzes, filterTab, getQuizMeta]);

  // Pagination client-side atas hasil filter
  const totalItems = filteredQuizzes.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / perPage));
  const safePage = Math.min(page, totalPages);
  const pagedQuizzes = filteredQuizzes.slice((safePage - 1) * perPage, safePage * perPage);

  // Execute Submission
  const executeSubmission = useCallback(async () => {
    if (!activeQuiz) return;
    setIsSubmitting(true);
    try {
      const formattedAnswers = questions.map((q) => {
        const ans = studentAnswers[q.id] || '';
        return {
          question_id: q.id,
          question_text: q.question_text,
          question_type: q.question_type,
          student_answer: ans,
          answer: ans,
          selected_option: q.question_type === 'multiple_choice' ? ans : null,
        };
      });

      const res = await quizApi.submitQuiz(activeQuiz.id, { answers: formattedAnswers });
      if (res?.data || res?.success || res?.status === 202) {
        const draftKey = `quiz_draft_${user?.id}_${activeQuiz.id}`;
        sessionStorage.removeItem(draftKey);
        setActiveQuiz(null);
        setQuestions([]);
        setStudentAnswers({});
        showToast(
          'Jawaban berhasil dikumpulkan! Evaluasi penilaian sedang diproses oleh AI.',
          'success'
        );
        loadQuizzes();
      }
    } catch (err) {
      showToast(
        err.response?.data?.message || err.message || 'Gagal mengirimkan jawaban kuis.',
        'error'
      );
    } finally {
      setIsSubmitting(false);
      setIsConfirmSubmitOpen(false);
    }
  }, [activeQuiz, questions, studentAnswers, user?.id, loadQuizzes]);

  // Sync ref for autoSubmit
  useEffect(() => {
    autoSubmitRef.current = executeSubmission;
  }, [executeSubmission]);

  // Timer Effect
  useEffect(() => {
    if (activeQuiz) {
      timerRef.current = setInterval(() => {
        setTimeLeftSeconds((prev) => {
          if (prev <= 1) {
            clearInterval(timerRef.current);
            showToast('Waktu pengerjaan kuis telah habis! Jawaban otomatis dikirim.', 'warning');
            autoSubmitRef.current?.();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [activeQuiz]);

  // Formatted Time MM:SS
  const formattedTime = useMemo(() => {
    const mins = Math.floor(timeLeftSeconds / 60);
    const secs = timeLeftSeconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }, [timeLeftSeconds]);

  // Count answered questions
  const answeredCount = useMemo(() => {
    return Object.keys(studentAnswers).filter((qId) => {
      const val = studentAnswers[qId];
      return val && String(val).trim().length > 0;
    }).length;
  }, [studentAnswers]);

  // 2. Input Jawaban
  const handleAnswerChange = (questionId, value) => {
    const updated = { ...studentAnswers, [questionId]: value };
    setStudentAnswers(updated);
    if (activeQuiz) {
      const draftKey = `quiz_draft_${user?.id}_${activeQuiz.id}`;
      sessionStorage.setItem(draftKey, JSON.stringify(updated));
    }
  };

  // 3. Inspeksi Hasil Kuis
  const handleInspectResults = async (quiz) => {
    setInspectQuiz(quiz);
    setLoadingSubmission(true);
    try {
      const res = await quizApi.getMySubmission(quiz.id);
      const subData = res?.data || res;
      setMySubmission(subData);
    } catch (err) {
      showToast(err.message || 'Gagal memuat hasil kuis.', 'error');
    } finally {
      setLoadingSubmission(false);
    }
  };

  // ==========================================
  // JIKA SEDANG DALAM MODE PENGERJAAN KUIS
  // ==========================================
  if (activeQuiz) {
    const currentQuestion = questions[currentQuestionIdx];
    const isMultipleChoice = currentQuestion?.question_type === 'multiple_choice';
    const isLastQuestion = currentQuestionIdx === questions.length - 1;
    const isFirstQuestion = currentQuestionIdx === 0;

    // Normalisasi opsi pilihan ganda
    let optionsList = [];
    if (isMultipleChoice) {
      if (Array.isArray(currentQuestion.options)) {
        optionsList = currentQuestion.options;
      } else if (typeof currentQuestion.options === 'string') {
        try {
          optionsList = JSON.parse(currentQuestion.options);
        } catch {
          optionsList = [];
        }
      }
    }

    return (
      <div className="fixed inset-0 z-50 overflow-y-auto bg-[var(--color-bg-app)] flex flex-col">
        {/* Sticky Header Pengerjaan Kuis */}
        <div className="sticky top-0 z-30 bg-[var(--color-surface)] border-b border-[var(--color-border-subtle)] px-4 py-3 shadow-[var(--shadow-card)]">
          <div className="flex items-center justify-between gap-3">
            <button
              onClick={() => setIsExitTakingOpen(true)}
              className="p-1.5 -ml-1.5 text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] rounded-[10px] hover:bg-[var(--color-surface-subtle)] transition-colors"
              aria-label="Kembali"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>

            <div className="flex-1 min-w-0 text-center">
              <span className="font-semibold text-xs text-[var(--color-text-primary)] block truncate">
                {activeQuiz.title}
              </span>
              <span className="text-[11px] text-[var(--color-text-secondary)]">
                Soal {currentQuestionIdx + 1} dari {questions.length} ({answeredCount} Terjawab)
              </span>
            </div>

            {/* Timer Badge */}
            <div
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-[10px] border font-mono text-xs font-bold ${
                timeLeftSeconds < 300
                  ? 'bg-[var(--color-danger-bg)] border-[var(--color-danger-border)] text-[var(--color-danger-fg)] animate-pulse'
                  : 'bg-[var(--color-warning-bg)] border-[var(--color-warning-border)] text-[var(--color-warning-fg)]'
              }`}
            >
              <Clock className="w-3.5 h-3.5 shrink-0" />
              <span>{formattedTime}</span>
            </div>
          </div>

          {/* Slider Nomor Soal */}
          <div className="flex gap-1.5 overflow-x-auto pt-2 pb-1 no-scrollbar">
            {questions.map((q, idx) => {
              const isAnswered =
                studentAnswers[q.id] && String(studentAnswers[q.id]).trim().length > 0;
              const isCurrent = idx === currentQuestionIdx;

              return (
                <button
                  key={q.id || idx}
                  onClick={() => setCurrentQuestionIdx(idx)}
                  className={`w-8 h-8 rounded-[10px] font-mono text-xs font-semibold shrink-0 transition-all ${
                    isCurrent
                      ? 'bg-[var(--color-brand)] text-[var(--color-text-primary)] ring-2 ring-amber-500 font-bold'
                      : isAnswered
                        ? 'bg-[var(--color-success-bg)] text-[var(--color-success-fg)] border border-[var(--color-success-border)]'
                        : 'bg-[var(--color-surface)] text-[var(--color-text-secondary)] border border-[var(--color-border-subtle)]'
                  }`}
                >
                  {idx + 1}
                </button>
              );
            })}
          </div>
        </div>

        {/* Content Butir Pertanyaan */}
        <div className="flex-1 p-4 max-w-lg mx-auto w-full">
          {currentQuestion && (
            <div className="surface-card p-4 shadow-[var(--shadow-card)] space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-[var(--color-border-light)]">
                <Badge variant="outline" className="text-[11px] font-semibold">
                  {isMultipleChoice ? 'Pilihan Ganda' : 'Esai'}
                </Badge>
                {currentQuestion.points && (
                  <span className="text-[11px] font-mono text-[var(--color-text-secondary)]">
                    {currentQuestion.points} Poin
                  </span>
                )}
              </div>

              {/* Teks Pertanyaan */}
              <div className="text-sm font-medium text-[var(--color-text-primary)] leading-relaxed">
                {currentQuestion.question_text}
              </div>

              {/* Pilihan Jawaban */}
              {isMultipleChoice ? (
                <div className="space-y-2.5 pt-2">
                  {optionsList.map((opt, oIdx) => {
                    const optKey =
                      typeof opt === 'string'
                        ? opt.slice(0, 1).toUpperCase()
                        : opt.key || String.fromCharCode(65 + oIdx);
                    const optText = typeof opt === 'string' ? opt : opt.text || opt.value || '';
                    const isSelected = studentAnswers[currentQuestion.id] === optKey;

                    return (
                      <button
                        key={oIdx}
                        type="button"
                        onClick={() => handleAnswerChange(currentQuestion.id, optKey)}
                        className={`w-full text-left p-3.5 rounded-[14px] border transition-all flex items-start gap-3 min-h-12 ${
                          isSelected
                            ? 'bg-[var(--color-warning-bg)] border-[var(--color-warning-border)] text-[var(--color-text-primary)] ring-1 ring-amber-400 shadow-[var(--shadow-card)]'
                            : 'bg-[var(--color-surface)] border-[var(--color-border-subtle)] text-[var(--color-text-primary)] hover:border-[var(--color-border-strong)]'
                        }`}
                      >
                        <span
                          className={`w-7 h-7 rounded-[10px] font-mono text-xs font-bold flex items-center justify-center shrink-0 ${
                            isSelected
                              ? 'bg-[var(--color-brand)] text-[var(--color-text-primary)]'
                              : 'bg-[var(--color-surface-subtle)] text-[var(--color-text-secondary)]'
                          }`}
                        >
                          {optKey}
                        </span>
                        <span className="text-xs pt-1 leading-relaxed flex-1">{optText}</span>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="pt-2">
                  <label className="text-xs font-semibold text-[var(--color-text-primary)] block mb-1.5">
                    Tuliskan Jawaban Anda:
                  </label>
                  <textarea
                    rows={6}
                    value={studentAnswers[currentQuestion.id] || ''}
                    onChange={(e) => handleAnswerChange(currentQuestion.id, e.target.value)}
                    placeholder="Ketikkan argumen dan jawaban esai Anda di sini..."
                    className="w-full text-xs p-3 border border-[var(--color-border-strong)] rounded-[14px] focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-[var(--color-warning-border)] bg-[var(--color-surface)]"
                  />
                </div>
              )}
            </div>
          )}
        </div>

        {/* Bottom Floating Bar */}
        <div className="fixed bottom-0 left-0 right-0 z-30 bg-[var(--color-surface)] border-t border-[var(--color-border-subtle)] p-3 shadow-[var(--shadow-elevated)]">
          <div className="max-w-lg mx-auto flex items-center justify-between gap-2">
            <Button
              variant="outline"
              disabled={isFirstQuestion}
              onClick={() => setCurrentQuestionIdx((p) => Math.max(0, p - 1))}
              className="text-xs font-semibold flex items-center gap-1"
            >
              <ChevronLeft className="w-4 h-4" />
              Sebelumnya
            </Button>

            {isLastQuestion ? (
              <Button
                variant="primary"
                onClick={() => setIsConfirmSubmitOpen(true)}
                className="text-xs font-bold flex items-center gap-1.5 px-4 shadow-[var(--shadow-card)]"
              >
                <Send className="w-3.5 h-3.5" />
                Kumpulkan Kuis
              </Button>
            ) : (
              <Button
                variant="primary"
                onClick={() => setCurrentQuestionIdx((p) => Math.min(questions.length - 1, p + 1))}
                className="text-xs font-semibold flex items-center gap-1"
              >
                Berikutnya
                <ChevronRight className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>

        {/* Dialog Konfirmasi Kumpulkan */}
        <ConfirmSheet
          isOpen={isConfirmSubmitOpen}
          onClose={() => setIsConfirmSubmitOpen(false)}
          onConfirm={executeSubmission}
          isLoading={isSubmitting}
          title="Kumpulkan Jawaban Kuis?"
          message={
            questions.length - answeredCount > 0
              ? `Perhatian: Masih terdapat ${questions.length - answeredCount} butir soal yang belum Anda jawab. Yakin ingin mengumpulkan sekarang?`
              : 'Seluruh butir soal telah dijawab. Jawaban akan langsung dikirim dan dievaluasi.'
          }
          confirmText="Ya, Kumpulkan Sekarang"
          confirmVariant="primary"
        />

        {/* Dialog Konfirmasi Keluar Pengerjaan */}
        <ConfirmSheet
          isOpen={isExitTakingOpen}
          onClose={() => setIsExitTakingOpen(false)}
          onConfirm={() => {
            setActiveQuiz(null);
            setIsExitTakingOpen(false);
          }}
          title="Tinggalkan Sesi Kuis?"
          message="Jawaban Anda telah tersimpan sementara di sesi peramban ini. Timer pengerjaan tetap berjalan di server jika batas waktu ditentukan."
          confirmText="Keluar Sementara"
          confirmVariant="danger"
        />
      </div>
    );
  }

  // ==========================================
  // TAMPILAN DAFTAR KUIS SISWA (DEFAULT)
  // ==========================================
  return (
    <div className="space-y-4">
      {/* Toast */}
      {toast.show && (
        <div
          className={`mb-4 p-3.5 rounded-[14px] flex items-center gap-2.5 text-xs shadow-[var(--shadow-card)] animate-fade-in ${
            toast.variant === 'error'
              ? 'bg-[var(--color-danger-bg)] border border-[var(--color-danger-border)] text-[var(--color-danger-fg)]'
              : toast.variant === 'warning'
                ? 'bg-[var(--color-warning-bg)] border border-[var(--color-warning-border)] text-[var(--color-warning-fg)]'
                : 'bg-[var(--color-success-bg)] border border-[var(--color-success-border)] text-[var(--color-success-fg)]'
          }`}
        >
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span className="font-medium">{toast.message}</span>
        </div>
      )}

      {/* Header Info */}
      <div className="surface-card p-4 mb-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="font-semibold text-[var(--color-text-primary)] text-sm">Kuis & Evaluasi AI</h1>
            <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">
              Pengerjaan kuis kelas berbantuan Google Gemini AI
            </p>
          </div>
          <button
            onClick={handleRefresh}
            disabled={loading}
            aria-label="Refresh kuis"
            className="p-2 rounded-[10px] text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-subtle)] transition-colors"
          >
            <RotateCw className={`w-4 h-4 ${loading ? 'animate-spin text-[var(--color-warning-fg)]' : ''}`} />
          </button>
        </div>

        {/* Filter Segmented Tabs */}
        <div className="grid grid-cols-3 gap-1 mt-4 pt-3 border-t border-[var(--color-border-light)] bg-[var(--color-surface-subtle)] p-1 rounded-[14px]">
          <button
            onClick={() => setFilterTab('all')}
            className={`py-1.5 text-xs font-semibold rounded-[10px] transition-all ${
              filterTab === 'all'
                ? 'bg-[var(--color-surface)] text-[var(--color-text-primary)] shadow-[var(--shadow-card)]'
                : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
            }`}
          >
            Semua
          </button>
          <button
            onClick={() => setFilterTab('available')}
            className={`py-1.5 text-xs font-semibold rounded-[10px] transition-all ${
              filterTab === 'available'
                ? 'bg-[var(--color-surface)] text-[var(--color-text-primary)] shadow-[var(--shadow-card)]'
                : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
            }`}
          >
            Tersedia
          </button>
          <button
            onClick={() => setFilterTab('graded')}
            className={`py-1.5 text-xs font-semibold rounded-[10px] transition-all ${
              filterTab === 'graded'
                ? 'bg-[var(--color-surface)] text-[var(--color-text-primary)] shadow-[var(--shadow-card)]'
                : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
            }`}
          >
            Dinilai
          </button>
        </div>
      </div>

      {/* Load Error */}
      {loadError && (
        <div className="mb-4 p-3.5 bg-[var(--color-danger-bg)] border border-[var(--color-danger-border)] rounded-[10px] flex items-center justify-between gap-3 text-[var(--color-danger-fg)] text-xs">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-[var(--color-danger-fg)]" />
            <span>{loadError}</span>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={handleRefresh}
            className="shrink-0 text-[var(--color-danger-fg)] border-[var(--color-danger-border)] hover:bg-[var(--color-danger-bg)]"
          >
            Coba Lagi
          </Button>
        </div>
      )}

      {/* Quizzes List */}
      <div className="space-y-3">
        <DataTable
          columns={[
            { key: 'no', label: '#', width: 30, align: 'center' },
            { key: 'quiz', label: 'Kuis / Guru' },
            { key: 'status', label: 'Status', width: 124, align: 'right' },
          ]}
          rows={pagedQuizzes}
          isLoading={loading}
          skeletonRows={Math.min(perPage, 8)}
          ariaLabel="Daftar kuis siswa"
          empty={
            <EmptyState
              title="Tidak ada kuis pada kategori ini"
              message="Guru belum merilis kuis baru untuk kelas Anda."
            />
          }
          renderRow={(quiz, index) => {
            const meta = getQuizMeta(quiz);
            const questionCount =
              quiz.questions_count || (quiz.questions ? quiz.questions.length : 0);
            const durationMinutes = quiz.duration_minutes || quiz.duration || 30;

            return (
              <tr key={quiz.id}>
                <td className="data-table__no">
                  {String((safePage - 1) * perPage + index + 1).padStart(2, '0')}
                </td>
                <td>
                  <span className="data-table__cell-title">{quiz.title}</span>
                  <span className="data-table__cell-meta">
                    {durationMinutes} Menit · {questionCount} Soal
                  </span>
                  <span className="data-table__cell-sub">
                    {quiz.teacher?.name || 'Guru Pengampu'}
                    {quiz.due_date ? ` · Tenggat ${quiz.due_date.split('T')[0]}` : ''}
                  </span>
                </td>
                <td>
                  <div className="flex flex-col items-end gap-1">
                    <span className={`badge badge--${meta.variant} badge--sm`}>{meta.label}</span>

                    {meta.canTake && (
                      <button
                        type="button"
                        onClick={() => navigate(`/student/quiz/${quiz.id}`)}
                        className="data-table__action"
                        aria-label={meta.actionLabel}
                      >
                        <Sparkles size={13} />
                      </button>
                    )}

                    {!meta.canTake && meta.canViewResult && (
                      <button
                        type="button"
                        onClick={() => handleInspectResults(quiz)}
                        className="data-table__action"
                        aria-label={meta.actionLabel}
                      >
                        <Eye size={13} />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            );
          }}
          footer={
            <PaginationBar
              currentPage={safePage}
              totalPages={totalPages}
              totalItems={totalItems}
              perPage={perPage}
              onPageChange={setPage}
              onPerPageChange={setPerPage}
              disabled={loading}
            />
          }
        />
      </div>

      {/* Modal Review Nilai & Evaluasi AI */}
      <BottomSheetModal
        isOpen={Boolean(inspectQuiz)}
        onClose={() => {
          setInspectQuiz(null);
          setMySubmission(null);
        }}
        title="Hasil Evaluasi Kuis"
        subtitle={inspectQuiz?.title || 'Review Nilai'}
        size="lg"
      >
        <div className="space-y-4 pb-2 text-xs">
          {loadingSubmission ? (
            <div className="py-8 text-center text-[var(--color-text-muted)]">
              <RotateCw className="w-6 h-6 animate-spin mx-auto mb-2 text-[var(--color-warning-fg)]" />
              Memuat hasil evaluasi...
            </div>
          ) : mySubmission ? (
            <>
              {/* Score Card */}
              <div className="bg-gradient-to-br from-amber-500/10 via-amber-400/5 to-white border border-[var(--color-warning-border)] rounded-[16px] p-4 text-center">
                <span className="text-[11px] font-semibold text-[var(--color-warning-fg)] block mb-1">
                  Nilai Akhir Siswa
                </span>
                <div className="font-mono text-3xl font-black text-[var(--color-warning-fg)]">
                  {mySubmission.best_score ??
                    (mySubmission.submissions && mySubmission.submissions[0]?.ai_score) ??
                    '-'}
                  <span className="text-base font-normal text-[var(--color-text-muted)]"> / 100</span>
                </div>
                <div className="flex items-center justify-center gap-3 mt-2 text-[11px] text-[var(--color-text-secondary)]">
                  <span>
                    Percobaan:{' '}
                    {mySubmission.attempts_used ??
                      (mySubmission.submissions ? mySubmission.submissions.length : 1)}{' '}
                    dari {mySubmission.max_attempts || inspectQuiz?.max_attempts || 1}
                  </span>
                </div>
              </div>

              {/* AI Feedback */}
              {mySubmission.submissions && mySubmission.submissions[0]?.ai_feedback && (
                <div className="p-3.5 bg-[var(--color-info-bg)] border border-[var(--color-info-border)] rounded-[14px] space-y-1.5 text-[var(--color-info-fg)]">
                  <div className="flex items-center gap-1.5 font-semibold text-xs text-[var(--color-info-fg)]">
                    <Sparkles className="w-3.5 h-3.5 text-[var(--color-info-fg)]" />
                    Ulasan & Masukan AI
                  </div>
                  <p className="text-[11px] leading-relaxed text-[var(--color-info-fg)]">
                    {mySubmission.submissions[0].ai_feedback}
                  </p>
                </div>
              )}

              <Button
                variant="outline"
                onClick={() => {
                  setInspectQuiz(null);
                  setMySubmission(null);
                }}
                className="w-full mt-2"
              >
                Tutup Review
              </Button>
            </>
          ) : (
            <div className="py-6 text-center text-[var(--color-text-secondary)]">
              Hasil kuis belum dapat dimuat atau belum dirilis oleh guru.
            </div>
          )}
        </div>
      </BottomSheetModal>
    </div>
  );
}
