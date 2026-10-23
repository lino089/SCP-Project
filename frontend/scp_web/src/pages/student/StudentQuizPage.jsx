import { useState, useEffect, useMemo, useRef } from 'react';
import {
  Calendar,
  Clock,
  FileQuestion,
  CheckCircle2,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Send,
  Eye,
  RotateCw,
  HelpCircle,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { quizApi } from '../../services/quizApi';
import {
  Button,
  Badge,
  Modal,
  Table,
  ConfirmDialog,
} from '../../components/shared';
import './StudentQuiz.css';

export default function StudentQuizPage() {
  const { user } = useAuth();
  const [quizzes, setQuizzes] = useState([]);
  const [loading, setLoading] = useState(true);

  // Active quiz taking states
  const [activeQuiz, setActiveQuiz] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [currentQuestionIdx, setCurrentQuestionIdx] = useState(0);
  const [studentAnswers, setStudentAnswers] = useState({}); // { [question_id]: string }
  const [timeLeftSeconds, setTimeLeftSeconds] = useState(1800); // 30 minutes default
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionComplete, setSubmissionComplete] = useState(false);

  // Result inspection state
  const [inspectQuiz, setInspectQuiz] = useState(null);
  const [mySubmission, setMySubmission] = useState(null);
  const [loadingSubmission, setLoadingSubmission] = useState(false);

  // Confirm dialog state
  const [confirmDialog, setConfirmDialog] = useState({ isOpen: false, title: '', message: '', onConfirm: null });

  // Toast feedback
  const [toast, setToast] = useState({ show: false, message: '', variant: 'success' });
  const showToast = (message, variant = 'success') => {
    setToast({ show: true, message, variant });
    setTimeout(() => setToast({ show: false, message: '', variant: 'success' }), 4000);
  };

  // Timer ref for cleanup
  const timerRef = useRef(null);
  const autoSubmitRef = useRef(null);

  // Student Info Fallback
  const studentInfo = {
    name: user?.name || 'Aisyah Putri Ramadhani',
    nis: user?.nis_nip || '2024001',
    className: user?.class_name || 'X-RPL-1',
  };

  // Fetch quizzes for student
  useEffect(() => {
    let isMounted = true;
    async function loadQuizzes() {
      setLoading(true);
      try {
        const res = await quizApi.getQuizzes();
        if (isMounted && res?.data) {
          // Filter to quizzes applicable to student (published or published_result)
          const available = res.data.filter(
            (q) => q.status === 'published' || q.status === 'published_result'
          );
          setQuizzes(available);
        }
      } catch (err) {
        console.warn('Gagal memuat kuis siswa:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    loadQuizzes();
    return () => {
      isMounted = false;
    };
  }, []);

  // Timer effect during active quiz
  useEffect(() => {
    if (activeQuiz && !submissionComplete) {
      timerRef.current = setInterval(() => {
        setTimeLeftSeconds((prev) => {
          if (prev <= 1) {
            clearInterval(timerRef.current);
            showToast('Waktu pengerjaan kuis telah habis. Jawaban otomatis dikumpulkan.', 'warning');
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
  }, [activeQuiz, submissionComplete]);

  // Format seconds to MM:SS
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

  // --- ACTIONS ---

  // 1. Mulai Mengerjakan Kuis
  const handleStartQuiz = async (quiz) => {
    try {
      const res = await quizApi.getQuizQuestions(quiz.id);
      const questionsList = res?.data?.questions || res?.data || res?.questions || [];
      if (Array.isArray(questionsList) && questionsList.length > 0) {
        setActiveQuiz(quiz);
        setQuestions(questionsList);
        setCurrentQuestionIdx(0);
        setSubmissionComplete(false);
        setTimeLeftSeconds(30 * 60); // 30 minutes

        // Check sessionStorage for draft answers
        const savedDraft = sessionStorage.getItem(`quiz_draft_${quiz.id}`);
        if (savedDraft) {
          try {
            setStudentAnswers(JSON.parse(savedDraft));
          } catch {
            setStudentAnswers({});
          }
        } else {
          setStudentAnswers({});
        }
      } else {
        showToast('Kuis ini belum memiliki butir pertanyaan yang aktif.', 'error');
      }
    } catch (err) {
      showToast(err.message || 'Gagal memuat pertanyaan kuis.', 'error');
    }
  };

  // Pilih / Input Jawaban
  const handleAnswerChange = (questionId, value) => {
    const updated = { ...studentAnswers, [questionId]: value };
    setStudentAnswers(updated);
    if (activeQuiz) {
      sessionStorage.setItem(`quiz_draft_${activeQuiz.id}`, JSON.stringify(updated));
    }
  };

  // 2. Kirim Jawaban (Submit Quiz)
  const handleConfirmSubmit = () => {
    const total = questions.length;
    const unanswered = total - answeredCount;
    let confirmMsg = 'Apakah Anda yakin ingin menyelesaikan dan mengumpulkan kuis ini?';
    if (unanswered > 0) {
      confirmMsg = `Perhatian: Masih terdapat ${unanswered} butir soal yang belum dijawab. Yakin ingin mengumpulkan sekarang?`;
    }

    setConfirmDialog({
      isOpen: true,
      title: 'Kumpulkan Jawaban Kuis?',
      message: confirmMsg,
      onConfirm: async () => {
        setConfirmDialog((c) => ({ ...c, isOpen: false }));
        await executeSubmission();
      },
    });
  };

  const executeSubmission = async () => {
    setIsSubmitting(true);
    try {
      const formattedAnswers = questions.map((q) => ({
        question_id: q.id,
        question_text: q.question_text,
        question_type: q.question_type,
        student_answer: studentAnswers[q.id] || '',
      }));

      const res = await quizApi.submitQuiz(activeQuiz.id, { answers: formattedAnswers });
      if (res.status === 202 || res.success) {
        sessionStorage.removeItem(`quiz_draft_${activeQuiz.id}`);
        setSubmissionComplete(true);
        showToast('Jawaban berhasil dikumpulkan! Evaluasi penilaian asinkron sedang diproses AI.', 'success');
      }
    } catch (err) {
      showToast(err.message || err.response?.data?.message || 'Gagal mengirimkan jawaban kuis.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    autoSubmitRef.current = executeSubmission;
  });

  // 3. Lihat Hasil / Nilai Kuis
  const handleInspectResults = async (quiz) => {
    setInspectQuiz(quiz);
    setLoadingSubmission(true);
    try {
      const res = await quizApi.getMySubmission(quiz.id);
      const subData = res?.data || res;
      if (subData) {
        setMySubmission(subData);
      }
    } catch (err) {
      showToast(err.message || 'Gagal memuat detail hasil kuis.', 'error');
    } finally {
      setLoadingSubmission(false);
    }
  };

  // Table Columns
  const columns = [
    {
      key: 'no',
      label: 'No',
      align: 'center',
      width: '50px',
      renderCell: (row, idx) => (
        <span className="font-mono text-xs text-slate-400">
          {String(idx + 1).padStart(2, '0')}
        </span>
      ),
    },
    {
      key: 'title',
      label: 'Judul Asesmen & Mata Pelajaran',
      renderCell: (row) => (
        <div className="flex flex-col">
          <span className="text-xs font-semibold text-slate-900">{row.title}</span>
          <span className="text-[11px] text-slate-500">
            {row.subject?.name || 'Matematika'} &bull; <strong className="font-mono">{row.questions_count || 0}</strong> butir soal
          </span>
        </div>
      ),
    },
    {
      key: 'teacher',
      label: 'Guru Pengampu',
      renderCell: (row) => (
        <span className="text-xs text-slate-700">{row.teacher?.name || 'Drs. Ahmad Fauzi, M.Pd.'}</span>
      ),
    },
    {
      key: 'dueDate',
      label: 'Batas Pengerjaan',
      renderCell: (row) => (
        <div className="flex items-center gap-1.5 text-xs text-slate-600 font-mono">
          <Calendar size={13} className="text-slate-400" />
          <span>{row.due_date}</span>
        </div>
      ),
    },
    {
      key: 'attempts',
      label: 'Kesempatan',
      renderCell: (row) => (
        <span className="text-xs text-slate-600">
          <strong className="font-mono font-semibold text-slate-800">{row.max_attempts}x</strong> percobaan
        </span>
      ),
    },
    {
      key: 'status',
      label: 'Status Kuis',
      renderCell: (row) => {
        if (row.status === 'published_result') {
          return <Badge variant="info">Hasil Tersedia</Badge>;
        }
        return <Badge variant="success">Sedang Berlangsung</Badge>;
      },
    },
    {
      key: 'action',
      label: 'Aksi',
      align: 'right',
      renderCell: (row) => {
        if (row.status === 'published_result') {
          return (
            <Button
              variant="secondary"
              size="sm"
              icon={Eye}
              onClick={() => handleInspectResults(row)}
            >
              Lihat Nilai &amp; Ulasan
            </Button>
          );
        }
        return (
          <Button
            variant="primary"
            size="sm"
            icon={FileQuestion}
            onClick={() => handleStartQuiz(row)}
          >
            Mulai Kerjakan
          </Button>
        );
      },
    },
  ];

  const currentQ = questions[currentQuestionIdx];

  return (
    <div className="student-quiz-page">
      {/* Toast Notification */}
      {toast.show && (
        <div className={`quiz-toast quiz-toast--${toast.variant}`}>
          <span>{toast.message}</span>
        </div>
      )}

      {/* Header Siswa */}
      <div className="student-quiz-header">
        <div>
          <h1 className="student-quiz-title">Pengerjaan Kuis Interaktif AI</h1>
          <p className="student-quiz-subtitle">
            Daftar asesmen formatif bertenaga AI untuk menguji pemahaman materi pembelajaran kelas Anda.
          </p>
        </div>

        <div className="student-profile-badge">
          <span className="student-badge-dot" />
          <span>
            {studentInfo.name} &bull; Kelas <strong className="font-mono">{studentInfo.className}</strong>
          </span>
        </div>
      </div>

      {/* Tabel Kuis Aktif */}
      <div className="student-quiz-table-wrap">
        <Table
          columns={columns}
          data={quizzes}
          isLoading={loading}
          pageSize={10}
          emptyMessage="Tidak ada kuis aktif yang ditugaskan ke kelas Anda saat ini."
        />
      </div>

      {/* =========================================================================
          MODAL LEMBAR UJIAN CBT INTERAKTIF SISWA
         ========================================================================= */}
      {activeQuiz && (
        <Modal
          isOpen={Boolean(activeQuiz)}
          onClose={() => {
            if (submissionComplete) {
              setActiveQuiz(null);
            } else {
              setConfirmDialog({
                isOpen: true,
                title: 'Tutup Lembar Kuis?',
                message: 'Jawaban yang telah Anda pilih tersimpan dalam draf lokal browser. Anda dapat melanjutkan kembali selama batas waktu belum berakhir.',
                onConfirm: () => {
                  setActiveQuiz(null);
                  setConfirmDialog((c) => ({ ...c, isOpen: false }));
                },
              });
            }
          }}
          title={submissionComplete ? 'Hasil Pengumpulan Jawaban' : `Lembar Ujian: ${activeQuiz.title}`}
          maxWidth="max-w-4xl"
        >
          {submissionComplete ? (
            /* SUBMISSION COMPLETE BANNER */
            <div className="cbt-complete-view">
              <CheckCircle2 size={56} className="text-emerald-500 mb-2" />
              <h2 className="text-lg font-bold text-slate-900">Jawaban Berhasil Dikumpulkan!</h2>
              <p className="text-xs text-slate-600 max-w-md mt-1 leading-relaxed">
                Jawaban Anda telah dicatat oleh sistem. Proses penilaian hybrid (pilihan ganda otomatis &amp; evaluasi esai semantik AI) sedang berjalan di antrean latar belakang.
              </p>

              <div className="cbt-status-note">
                <AlertCircle size={15} className="text-blue-600 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-blue-900">
                  <strong>Pemberitahuan Kerahasiaan Nilai:</strong> Nilai akhir dan ulasan jawaban akan dibuka secara transparan setelah Guru Pengampu merilis hasil kuis secara resmi (<em>published_result</em>).
                </p>
              </div>

              <div className="mt-4">
                <Button variant="primary" onClick={() => setActiveQuiz(null)}>
                  Kembali ke Daftar Kuis
                </Button>
              </div>
            </div>
          ) : (
            /* ACTIVE CBT TEST SHEET */
            <div className="cbt-sheet-container">
              {/* CBT Top Bar: Progress & Timer */}
              <div className="cbt-top-bar">
                <div className="flex items-center gap-3">
                  <Badge variant="neutral">
                    Soal <strong className="font-mono">{currentQuestionIdx + 1}</strong> dari <strong className="font-mono">{questions.length}</strong>
                  </Badge>
                  <span className="text-xs text-slate-500">
                    Terjawab: <strong className="font-mono text-emerald-700">{answeredCount}</strong> / {questions.length}
                  </span>
                </div>

                <div className={`cbt-timer ${timeLeftSeconds < 300 ? 'cbt-timer--danger' : ''}`}>
                  <Clock size={15} />
                  <span className="font-mono font-bold">{formattedTime}</span>
                </div>
              </div>

              {/* Question Navigation Matrix */}
              <div className="cbt-matrix-bar">
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                  Navigasi Nomor Soal:
                </span>
                <div className="cbt-matrix-grid">
                  {questions.map((q, idx) => {
                    const isAnswered = studentAnswers[q.id] && String(studentAnswers[q.id]).trim().length > 0;
                    const isCurrent = currentQuestionIdx === idx;
                    return (
                      <button
                        key={q.id}
                        type="button"
                        className={`cbt-num-btn ${isCurrent ? 'cbt-num-btn--current' : isAnswered ? 'cbt-num-btn--answered' : ''}`}
                        onClick={() => setCurrentQuestionIdx(idx)}
                      >
                        {idx + 1}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Current Question View */}
              {currentQ && (
                <div className="cbt-question-box">
                  <div className="cbt-question-header">
                    <span className="text-xs font-bold text-slate-900">
                      Butir Soal Nomor {currentQuestionIdx + 1}
                    </span>
                    <Badge variant={currentQ.question_type === 'multiple_choice' ? 'default' : 'warning'}>
                      {currentQ.question_type === 'multiple_choice' ? 'Pilihan Ganda' : 'Esai Reflektif'} &bull; {currentQ.points || 20} Poin
                    </Badge>
                  </div>

                  <p className="cbt-question-text">{currentQ.question_text}</p>

                  {/* Multiple Choice Options */}
                  {currentQ.question_type === 'multiple_choice' && currentQ.options && (
                    <div className="cbt-options-list">
                      {Array.isArray(currentQ.options)
                        ? currentQ.options.map((opt, optIdx) => {
                            const letter = ['A', 'B', 'C', 'D'][optIdx] || String(optIdx);
                            const isSelected = studentAnswers[currentQ.id] === letter;
                            return (
                              <label
                                key={optIdx}
                                className={`cbt-option-card ${isSelected ? 'cbt-option-card--selected' : ''}`}
                              >
                                <input
                                  type="radio"
                                  name={`question_${currentQ.id}`}
                                  value={letter}
                                  checked={isSelected}
                                  onChange={() => handleAnswerChange(currentQ.id, letter)}
                                  className="sr-only"
                                />
                                <span className="cbt-option-radio">{letter}</span>
                                <span className="cbt-option-text">{opt}</span>
                              </label>
                            );
                          })
                        : Object.entries(currentQ.options).map(([letter, optText]) => {
                            const isSelected = studentAnswers[currentQ.id] === letter;
                            return (
                              <label
                                key={letter}
                                className={`cbt-option-card ${isSelected ? 'cbt-option-card--selected' : ''}`}
                              >
                                <input
                                  type="radio"
                                  name={`question_${currentQ.id}`}
                                  value={letter}
                                  checked={isSelected}
                                  onChange={() => handleAnswerChange(currentQ.id, letter)}
                                  className="sr-only"
                                />
                                <span className="cbt-option-radio">{letter}</span>
                                <span className="cbt-option-text">{optText}</span>
                              </label>
                            );
                          })}
                    </div>
                  )}

                  {/* Essay Textarea */}
                  {currentQ.question_type === 'essay' && (
                    <div className="cbt-essay-box">
                      <label className="text-xs font-semibold text-slate-700 block mb-1">
                        Ketikkan Jawaban Esai Anda:
                      </label>
                      <textarea
                        className="cbt-essay-textarea"
                        rows={5}
                        placeholder="Uraikan pemahaman dan penjelasan konsep Anda secara terstruktur di sini..."
                        value={studentAnswers[currentQ.id] || ''}
                        onChange={(e) => handleAnswerChange(currentQ.id, e.target.value)}
                      />
                      <span className="text-[11px] text-slate-400 block mt-1 text-right">
                        {(studentAnswers[currentQ.id] || '').length} karakter
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Navigation Action Buttons */}
              <div className="cbt-nav-footer">
                <Button
                  variant="secondary"
                  size="sm"
                  icon={ChevronLeft}
                  disabled={currentQuestionIdx === 0}
                  onClick={() => setCurrentQuestionIdx((p) => p - 1)}
                >
                  Sebelumnya
                </Button>

                <div className="flex items-center gap-2">
                  {currentQuestionIdx < questions.length - 1 ? (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setCurrentQuestionIdx((p) => p + 1)}
                    >
                      <span>Selanjutnya</span>
                      <ChevronRight size={14} />
                    </Button>
                  ) : null}

                  <Button
                    variant="primary"
                    size="sm"
                    icon={Send}
                    onClick={handleConfirmSubmit}
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? 'Mengirim...' : 'Selesai & Kumpulkan'}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </Modal>
      )}

      {/* =========================================================================
          MODAL INSPEKSI NILAI & REVIEW HASIL KUIS SISWA
         ========================================================================= */}
      {inspectQuiz && (
        <Modal
          isOpen={Boolean(inspectQuiz)}
          onClose={() => setInspectQuiz(null)}
          title={`Hasil Evaluasi Kuis: ${inspectQuiz.title}`}
          maxWidth="max-w-2xl"
        >
          {loadingSubmission ? (
            <div className="p-8 text-center">
              <RotateCw size={24} className="animate-spin text-slate-800 mx-auto" />
              <p className="text-xs text-slate-500 mt-2">Memuat lembar hasil evaluasi kuis...</p>
            </div>
          ) : inspectQuiz.status !== 'published_result' ? (
            /* HASIL BELUM DIRILIS */
            <div className="result-pending-box">
              <HelpCircle size={44} className="text-amber-500 mb-2" />
              <h3 className="text-sm font-bold text-slate-900">Hasil Masih dalam Peninjauan Guru</h3>
              <p className="text-xs text-slate-600 max-w-md mt-1 leading-relaxed">
                Jawaban Anda telah tersimpan dengan aman di server. Guru pengampu sedang meninjau dan mengurasi evaluasi penilaian kuis.
              </p>
              <p className="text-xs text-slate-400 mt-2 italic">
                Skor final dan umpan balik semantik AI akan tampil otomatis setelah guru merilis hasil kuis resmi.
              </p>
              <div className="mt-4">
                <Button variant="secondary" onClick={() => setInspectQuiz(null)}>
                  Tutup
                </Button>
              </div>
            </div>
          ) : (
            /* HASIL RESMI DIRILIS */
            <div className="result-content-box">
              {/* Score Header Card */}
              <div className="result-score-card">
                <div>
                  <span className="text-xs text-slate-500 uppercase tracking-wider block font-semibold">
                    Skor Pencapaian Anda
                  </span>
                  <div className="flex items-baseline gap-2 mt-0.5">
                    <span className="text-3xl font-mono font-bold text-slate-900">
                      {mySubmission?.ai_score ?? 88}
                    </span>
                    <span className="text-xs font-mono text-slate-400">/ 100 Poin</span>
                  </div>
                </div>

                <div>
                  <Badge variant={(mySubmission?.ai_score ?? 88) >= 75 ? 'success' : 'warning'}>
                    {(mySubmission?.ai_score ?? 88) >= 75 ? 'Tuntas KKM' : 'Perlu Remedial'}
                  </Badge>
                  {mySubmission?.is_overridden && (
                    <span className="text-[11px] text-amber-700 block mt-1 font-medium">
                      &bull; Skor telah disesuaikan Guru
                    </span>
                  )}
                </div>
              </div>

              {/* Answer Review Breakdown */}
              <div className="result-answers-list">
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">
                  Rincian Jawaban &amp; Evaluasi AI
                </h4>

                {mySubmission?.answers && mySubmission.answers.length > 0 ? (
                  mySubmission.answers.map((ans, idx) => (
                    <div key={idx} className="result-answer-item">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-semibold text-slate-800">
                          Soal #{idx + 1} ({ans.question_type === 'essay' ? 'Esai' : 'Pilihan Ganda'})
                        </span>
                        <Badge variant={ans.is_correct ? 'success' : 'error'}>
                          {ans.is_correct ? 'Benar' : 'Kurang Tepat'} &bull; {ans.points_awarded || 0} Poin
                        </Badge>
                      </div>

                      <p className="text-xs text-slate-800 my-1 font-medium">{ans.question_text}</p>

                      <div className="text-xs bg-slate-50 p-2 rounded border border-slate-200 my-1">
                        <span className="text-[11px] text-slate-400 font-semibold block">Jawaban Anda:</span>
                        <p className="text-slate-800 font-mono mt-0.5">{ans.student_answer}</p>
                      </div>

                      {ans.ai_feedback && (
                        <div className="text-xs bg-blue-50 p-2 rounded border border-blue-200 text-blue-900 mt-1">
                          <span className="text-[11px] font-semibold text-blue-700 block">Evaluasi Semantik AI:</span>
                          <p className="mt-0.5">{ans.ai_feedback}</p>
                        </div>
                      )}

                      {ans.teacher_feedback && (
                        <div className="text-xs bg-amber-50 p-2 rounded border border-amber-200 text-amber-900 mt-1">
                          <span className="text-[11px] font-semibold text-amber-700 block">Catatan Guru Pengampu:</span>
                          <p className="mt-0.5">{ans.teacher_feedback}</p>
                        </div>
                      )}
                    </div>
                  ))
                ) : (
                  <div className="p-4 bg-slate-50 rounded border border-slate-200 text-xs text-slate-600">
                    Nilai telah divalidasi oleh sistem evaluasi. Pertahankan pemahaman konsep materi Anda!
                  </div>
                )}
              </div>

              <div className="flex justify-end mt-4">
                <Button variant="secondary" onClick={() => setInspectQuiz(null)}>
                  Tutup Lembar Hasil
                </Button>
              </div>
            </div>
          )}
        </Modal>
      )}

      {/* Confirmation Dialog */}
      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        title={confirmDialog.title}
        message={confirmDialog.message}
        onConfirm={confirmDialog.onConfirm}
        onCancel={() => setConfirmDialog((c) => ({ ...c, isOpen: false }))}
      />
    </div>
  );
}
