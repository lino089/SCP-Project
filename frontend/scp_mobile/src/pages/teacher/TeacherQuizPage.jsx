import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Sparkles,
  Plus,
  FileText,
  Users,
  CheckCircle2,
  RotateCw,
  Trash2,
  Upload,
  Send,
  X,
} from 'lucide-react';
import quizApi from '../../services/quizApi';
import {
  Button,
  Badge,
  Modal,
  Input,
  Select,
  SearchInput,
  DataTable,
  PaginationBar,
} from '../../components/shared';
import { SkeletonCard, EmptyState, ErrorState } from '../../components/feedback';
import { formatDateIndo } from '../../utils/formatters';

export default function TeacherQuizPage() {
  const navigate = useNavigate();
  const [quizzes, setQuizzes] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  // Filter Tabs: 'all' | 'published' | 'draft_review'
  const [activeTab, setActiveTab] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Pagination tabel daftar kuis
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);

  // Toast
  const [toastMessage, setToastMessage] = useState(null);
  const [toastType, setToastType] = useState('success');

  // Kuis terpilih (review soal & hasil siswa)
  const [selectedQuiz, setSelectedQuiz] = useState(null);

  // Modal 3: Review & Edit Butir Soal
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [quizQuestions, setQuizQuestions] = useState([]);
  const [isLoadingQuestions, setIsLoadingQuestions] = useState(false);

  // Modal 4: Submissions & Override Nilai Siswa
  const [isSubmissionsModalOpen, setIsSubmissionsModalOpen] = useState(false);
  const [submissions, setSubmissions] = useState([]);
  const [isLoadingSubmissions, setIsLoadingSubmissions] = useState(false);
  const [selectedSubmission, setSelectedSubmission] = useState(null);
  const [overrideScore, setOverrideScore] = useState('');
  const [overrideFeedback, setOverrideFeedback] = useState('');
  const [isOverriding, setIsOverriding] = useState(false);

  const showToast = (msg, type = 'success') => {
    setToastMessage(msg);
    setToastType(type);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const fetchQuizzes = useCallback(async () => {
    try {
      const res = await quizApi.getQuizzes();
      const list = Array.isArray(res) ? res : Array.isArray(res?.data) ? res.data : [];
      setQuizzes(list);
      setLoadError(null);
    } catch (err) {
      setLoadError(err.message || 'Gagal memuat daftar kuis pembelajaran.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    async function init() {
      try {
        const res = await quizApi.getQuizzes();
        const list = Array.isArray(res) ? res : Array.isArray(res?.data) ? res.data : [];
        if (isMounted) {
          setQuizzes(list);
          setLoadError(null);
        }
      } catch (err) {
        if (isMounted) setLoadError(err.message || 'Gagal memuat daftar kuis pembelajaran.');
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }
    init();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleRefresh = () => {
    setIsLoading(true);
    fetchQuizzes();
  };

  // Create Quiz Draft
  const handleOpenReviewQuestions = async (quiz, shouldPoll = false) => {
    setSelectedQuiz(quiz);
    setIsReviewModalOpen(true);
    setIsLoadingQuestions(true);
    try {
      let list = [];
      const maxAttempts = shouldPoll ? 15 : 1;
      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        const res = await quizApi.getQuizQuestions(quiz.id);
        list = Array.isArray(res) ? res : Array.isArray(res?.data) ? res.data : [];
        if (list.length > 0 || !shouldPoll) break;
        if (attempt < maxAttempts) {
          await new Promise((r) => setTimeout(r, 1500));
        }
      }
      setQuizQuestions(list);
    } catch {
      showToast('Gagal memuat butir soal kuis.', 'error');
    } finally {
      setIsLoadingQuestions(false);
    }
  };

  // Delete Question
  const handleDeleteQuestion = async (qId) => {
    if (!window.confirm('Hapus butir soal ini?')) return;
    try {
      await quizApi.deleteQuestion(selectedQuiz.id, qId);
      setQuizQuestions((prev) => prev.filter((q) => q.id !== qId));
      showToast('Butir soal berhasil dihapus.');
    } catch {
      showToast('Gagal menghapus soal.', 'error');
    }
  };

  // Publish Quiz
  const handlePublishQuiz = async (quizId) => {
    if (!window.confirm('Publikasikan kuis ini ke siswa kelas?')) return;
    try {
      await quizApi.updateQuizStatus(quizId, { status: 'published' });
      showToast('Kuis berhasil dipublikasikan.');
      setIsReviewModalOpen(false);
      handleRefresh();
    } catch (err) {
      showToast(err.response?.data?.message || err.message || 'Gagal mempublikasikan kuis.', 'error');
    }
  };

  // Open Submissions List
  const handleOpenSubmissions = async (quiz) => {
    setSelectedQuiz(quiz);
    setIsSubmissionsModalOpen(true);
    setIsLoadingSubmissions(true);
    try {
      const res = await quizApi.getQuizSubmissions(quiz.id);
      const list = Array.isArray(res) ? res : Array.isArray(res?.data) ? res.data : [];
      setSubmissions(list);
    } catch {
      showToast('Gagal memuat hasil pengerjaan siswa.', 'error');
    } finally {
      setIsLoadingSubmissions(false);
    }
  };

  // Save Score Override
  const handleSaveOverride = async () => {
    if (!selectedSubmission) return;
    setIsOverriding(true);
    try {
      await quizApi.overrideSubmission(selectedSubmission.id, {
        score: Number(overrideScore),
        teacher_feedback: overrideFeedback.trim(),
      });
      showToast('Nilai dan umpan balik berhasil diperbarui.');
      setSubmissions((prev) =>
        prev.map((s) =>
          s.id === selectedSubmission.id
            ? { ...s, score: Number(overrideScore), teacher_feedback: overrideFeedback }
            : s
        )
      );
      setSelectedSubmission(null);
    } catch {
      showToast('Gagal memperbarui nilai.', 'error');
    } finally {
      setIsOverriding(false);
    }
  };

  // Filtered Quizzes
  const filteredQuizzes = useMemo(() => {
    return quizzes.filter((q) => {
      if (activeTab === 'published' && q.status !== 'published') return false;
      if (activeTab === 'draft_review' && q.status !== 'draft_review') return false;
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const title = q.title?.toLowerCase() || '';
        const cls = q.school_class?.name?.toLowerCase() || '';
        return title.includes(query) || cls.includes(query);
      }
      return true;
    });
  }, [quizzes, activeTab, searchQuery]);

  // Pagination client-side atas hasil filter
  const totalItems = filteredQuizzes.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / perPage));
  const safePage = Math.min(page, totalPages);
  const pagedQuizzes = filteredQuizzes.slice((safePage - 1) * perPage, safePage * perPage);

  return (
    <div className="space-y-4">
      {/* Toast Feedback */}
      {toastMessage && (
        <div
          className={`p-3 rounded-[14px] text-xs flex items-center justify-between animate-fade-in ${
            toastType === 'success'
              ? 'bg-[var(--color-success-bg)] border border-[var(--color-success-border)] text-[var(--color-success-fg)]'
              : 'bg-[var(--color-danger-bg)] border border-[var(--color-danger-border)] text-[var(--color-danger-fg)]'
          }`}
        >
          <span>{toastMessage}</span>
          <button
            type="button"
            onClick={() => setToastMessage(null)}
            className="text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Header Info */}
      <div className="surface-card p-3.5 shadow-[var(--shadow-card)] flex items-center justify-between">
        <div>
          <h1 className="text-sm font-bold text-[var(--color-text-primary)]">Manajemen Kuis</h1>
          <p className="text-[11px] text-[var(--color-text-muted)]">
            Pembuatan soal berbantuan Google Gemini &amp; evaluasi
          </p>
        </div>
        <Button
          size="sm"
          variant="primary"
          onClick={() => navigate('/teacher/quiz/create')}
          className="gap-1.5 text-xs font-semibold px-3 py-1.5 bg-[var(--color-warning-bg)] text-[var(--color-text-primary)]"
        >
          <Plus size={14} />
          Buat Kuis
        </Button>
      </div>

      {/* Status Filter Tabs */}
      <div className="flex bg-[var(--color-surface-subtle)] p-1 rounded-[16px]">
        {[
          { id: 'all', label: 'Semua Kuis' },
          { id: 'published', label: 'Dipublikasikan' },
          { id: 'draft_review', label: 'Draft / Review' },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 py-1.5 rounded-[14px] text-xs font-bold transition-all ${
              activeTab === tab.id
                ? 'bg-[var(--color-warning-bg)] text-[var(--color-text-primary)] shadow-[var(--shadow-card)]'
                : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Search Input */}
      <SearchInput
        placeholder="Cari judul kuis atau rombel..."
        value={searchQuery}
        onChange={(value) => setSearchQuery(value)}
      />

      {/* Quizzes List */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="section-label">
            Daftar Kuis ({totalItems})
          </span>
          <Button
            size="sm"
            variant="ghost"
            onClick={handleRefresh}
            className="p-1 h-7 w-7 min-h-0"
            aria-label="Segarkan"
          >
            <RotateCw size={14} />
          </Button>
        </div>

        {loadError ? (
          <ErrorState message={loadError} onRetry={handleRefresh} />
        ) : (
          <DataTable
            columns={[
              { key: 'no', label: '#', width: 30, align: 'center' },
              { key: 'quiz', label: 'Kuis / Rombel' },
              { key: 'actions', label: 'Aksi', width: 116, align: 'right' },
            ]}
            rows={pagedQuizzes}
            isLoading={isLoading}
            skeletonRows={Math.min(perPage, 8)}
            ariaLabel="Daftar kuis pembelajaran"
            empty={
              <EmptyState
                title="Belum Ada Kuis"
                message="Belum ada kuis yang sesuai dengan kategori ini. Buat kuis baru untuk memulai evaluasi belajar."
              />
            }
            renderRow={(quiz, index) => {
              const isPublished = quiz.status === 'published';

              return (
                <tr key={quiz.id}>
                  <td className="data-table__no">
                    {String((safePage - 1) * perPage + index + 1).padStart(2, '0')}
                  </td>
                  <td>
                    <span className="data-table__cell-title">{quiz.title}</span>
                    <span className="data-table__cell-meta">
                      {quiz.school_class?.name || 'Rombel'} · {quiz.duration_minutes || 30} Menit
                    </span>
                    <span className="data-table__cell-sub">
                      Tenggat: {quiz.due_date ? formatDateIndo(quiz.due_date) : 'Tanpa Batas'}
                    </span>
                  </td>
                  <td>
                    <div className="flex flex-col items-end gap-1">
                      <span
                        className={`badge badge--${isPublished ? 'success' : 'warning'} badge--sm`}
                      >
                        {isPublished ? 'Terbit' : 'Draft'}
                      </span>

                      <div className="data-table__actions">
                        <button
                          type="button"
                          onClick={() =>
                            isPublished
                              ? handleOpenReviewQuestions(quiz)
                              : navigate(`/teacher/quiz/create?id=${quiz.id}`)
                          }
                          className="data-table__action"
                          aria-label={isPublished ? 'Lihat soal' : 'Lanjutkan pembuatan kuis'}
                        >
                          <FileText size={13} />
                        </button>

                        {!isPublished && (
                          <button
                            type="button"
                            onClick={() => navigate(`/teacher/quiz/create?id=${quiz.id}`)}
                            className="data-table__action"
                            aria-label="Lanjutkan ke sumber soal"
                          >
                            <Sparkles size={13} />
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => handleOpenSubmissions(quiz)}
                          className="data-table__action"
                          aria-label="Hasil siswa"
                        >
                          <Users size={13} />
                        </button>
                      </div>
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
                disabled={isLoading}
              />
            }
          />
        )}
      </div>

      {/* MODAL 3: Review Butir Soal */}
      <Modal
        isOpen={isReviewModalOpen}
        onClose={() => setIsReviewModalOpen(false)}
        title={`Review Soal: ${selectedQuiz?.title || 'Kuis'}`}
      >
        <div className="space-y-3 max-h-[75vh] overflow-y-auto pr-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[var(--color-text-primary)]">
              Total {quizQuestions.length} Butir Soal
            </span>
            <Button
              size="sm"
              variant="primary"
              onClick={() => handlePublishQuiz(selectedQuiz.id)}
              disabled={quizQuestions.length === 0}
              className="gap-1 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              <Send size={13} />
              Publikasikan Kuis
            </Button>
          </div>

          {isLoadingQuestions ? (
            <SkeletonCard count={2} />
          ) : quizQuestions.length === 0 ? (
            <EmptyState
              title="Belum Ada Soal"
              message="Kuis ini belum memiliki butir soal. Generate via AI atau buat secara manual."
            />
          ) : (
            <div className="space-y-2">
              {quizQuestions.map((q, idx) => (
                <div
                  key={q.id || idx}
                  className={`bg-[var(--color-surface)] border rounded-[14px] p-3 shadow-[var(--shadow-card)] space-y-2 ${
                    q.needs_review ? 'border-[var(--color-warning-border)] bg-[var(--color-warning-bg)]/30' : 'border-[var(--color-border-subtle)]'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <Badge variant="neutral" size="sm">
                          Soal #{idx + 1}
                        </Badge>
                        <Badge variant="info" size="sm">
                          {q.type === 'essay' ? 'Esai' : 'Pilihan Ganda'}
                        </Badge>
                        {q.needs_review && (
                          <Badge variant="warning" size="sm">
                            Perlu Review
                          </Badge>
                        )}
                        <span className="text-[11px] font-mono text-[var(--color-text-secondary)]">
                          {q.points || 10} Poin
                        </span>
                      </div>

                      <p className="text-xs font-bold text-[var(--color-text-primary)] mt-1 leading-relaxed">
                        {q.question_text}
                      </p>

                      {Array.isArray(q.options) && q.options.length > 0 && (
                        <div className="mt-2 space-y-1">
                          {q.options.map((opt, oIdx) => {
                            const isCorrect = String(opt.is_correct || opt.key === q.correct_answer);
                            return (
                              <div
                                key={oIdx}
                                className={`text-[11px] p-1.5 rounded-[10px] border flex items-center justify-between ${
                                  isCorrect === 'true'
                                    ? 'border-[var(--color-success-border)] bg-[var(--color-success-bg)] text-[var(--color-success-fg)] font-semibold'
                                    : 'border-[var(--color-border-light)] bg-[var(--color-bg-app)] text-[var(--color-text-primary)]'
                                }`}
                              >
                                <span>{opt.text || opt.value || opt}</span>
                                {isCorrect === 'true' && <CheckCircle2 size={12} className="text-[var(--color-success-fg)]" />}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => handleDeleteQuestion(q.id)}
                      className="p-1.5 text-rose-500 hover:text-[var(--color-danger-fg)] rounded-[10px] hover:bg-[var(--color-danger-bg)] shrink-0"
                      aria-label="Hapus Soal"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Modal>

      {/* MODAL 4: Submissions & Override Nilai */}
      <Modal
        isOpen={isSubmissionsModalOpen}
        onClose={() => setIsSubmissionsModalOpen(false)}
        title={`Hasil Pengerjaan Siswa (${submissions.length})`}
      >
        <div className="space-y-3 max-h-[75vh] overflow-y-auto pr-1">
          {isLoadingSubmissions ? (
            <SkeletonCard count={3} />
          ) : submissions.length === 0 ? (
            <EmptyState
              title="Belum Ada Pengerjaan"
              message="Belum ada siswa yang mengumpulkan jawaban kuis ini."
            />
          ) : (
            <div className="space-y-2">
              {submissions.map((sub) => (
                <div
                  key={sub.id}
                  className="surface-card p-3 space-y-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-[var(--color-text-primary)] truncate">
                        {sub.student?.name || 'Siswa'}
                      </p>
                      <p className="text-[11px] text-[var(--color-text-muted)] font-mono">
                        Selesai: {sub.submitted_at ? formatDateIndo(sub.submitted_at) : '-'}
                      </p>
                      {sub.teacher_feedback && (
                        <p className="text-[11px] text-[var(--color-text-secondary)] italic mt-1">
                          Catatan Guru: "{sub.teacher_feedback}"
                        </p>
                      )}
                    </div>

                    <div className="text-right shrink-0">
                      <span className="text-sm font-bold text-[var(--color-text-primary)] bg-[var(--color-brand-soft)] px-2 py-0.5 rounded-[10px] font-mono">
                        {sub.score ?? 0}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedSubmission(sub);
                          setOverrideScore(String(sub.score ?? 0));
                          setOverrideFeedback(sub.teacher_feedback || '');
                        }}
                        className="block mt-1 text-[11px] text-[var(--color-info-fg)] font-bold underline"
                      >
                        Koreksi Nilai
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {selectedSubmission && (
            <div className="p-3 bg-[var(--color-bg-app)] surface-card space-y-2">
              <h4 className="text-xs font-bold text-[var(--color-text-primary)]">
                Koreksi Nilai: {selectedSubmission.student?.name}
              </h4>
              <Input
                type="number"
                min="0"
                max="100"
                label="Skor Akhir (0 - 100)"
                value={overrideScore}
                onChange={(e) => setOverrideScore(e.target.value)}
              />
              <textarea
                rows={2}
                value={overrideFeedback}
                onChange={(e) => setOverrideFeedback(e.target.value)}
                placeholder="Catatan umpan balik untuk siswa..."
                className="w-full text-xs p-2 field-area focus:outline-hidden"
              />
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => setSelectedSubmission(null)}
                  className="flex-1"
                >
                  Batal
                </Button>
                <Button
                  size="sm"
                  variant="primary"
                  onClick={handleSaveOverride}
                  disabled={isOverriding}
                  className="flex-1 bg-[var(--color-warning-bg)] text-[var(--color-text-primary)] font-bold"
                >
                  {isOverriding ? 'Menyimpan...' : 'Simpan Nilai'}
                </Button>
              </div>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
