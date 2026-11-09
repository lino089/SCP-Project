import { useState, useEffect, useMemo, useCallback } from 'react';
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
import { classApi } from '../../services/masterDataApi';
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
  const [quizzes, setQuizzes] = useState([]);
  const [classesList, setClassesList] = useState([]);
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

  // Modal 1: Buat Kuis Baru (Metadata)
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isCreatingQuiz, setIsCreatingQuiz] = useState(false);
  const [createForm, setCreateForm] = useState({
    title: '',
    class_id: '',
    due_date: '',
    duration_minutes: 30,
  });

  // Modal 2: Generator Soal AI / Ekstraksi Dokumen
  const [selectedQuiz, setSelectedQuiz] = useState(null);
  const [isGeneratorModalOpen, setIsGeneratorModalOpen] = useState(false);
  const [genMethod, setGenMethod] = useState('prompt'); // 'prompt' | 'document'
  const [isGenerating, setIsGenerating] = useState(false);
  const [genError, setGenError] = useState('');

  // Form Prompt AI
  const [promptForm, setPromptForm] = useState({
    prompt: '',
    total_questions: 5,
    mc_count: 3,
    essay_count: 2,
    difficulty: 'sedang',
  });

  // Form Dokumen
  const [uploadedDoc, setUploadedDoc] = useState(null);

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

  // Load Classes for dropdown
  useEffect(() => {
    classApi.getClasses({ per_page: 100 })
      .then((res) => {
        const list = Array.isArray(res) ? res : Array.isArray(res?.data) ? res.data : [];
        setClassesList(list);
      })
      .catch(() => {});
  }, []);

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
  const handleCreateQuizSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!createForm.title.trim()) return;

    setIsCreatingQuiz(true);
    try {
      const res = await quizApi.createQuiz({
        title: createForm.title.trim(),
        class_id: Number(createForm.class_id),
        due_date: createForm.due_date,
        duration_minutes: Number(createForm.duration_minutes),
      });

      const newQuiz = res?.data || res;
      showToast('Draft kuis berhasil dibuat.');
      setIsCreateModalOpen(false);
      handleRefresh();

      setSelectedQuiz(newQuiz);
      setIsGeneratorModalOpen(true);
    } catch (err) {
      showToast(err.response?.data?.message || err.message || 'Gagal membuat kuis.', 'error');
    } finally {
      setIsCreatingQuiz(false);
    }
  };

  // Handle AI Prompt Generation
  const handleGeneratePrompt = async (e) => {
    if (e) e.preventDefault();
    if (!promptForm.prompt.trim()) {
      setGenError('Instruksi materi prompt wajib diisi.');
      return;
    }

    setIsGenerating(true);
    setGenError('');
    try {
      await quizApi.generatePrompt(selectedQuiz.id, {
        prompt: promptForm.prompt.trim(),
        total_questions: Number(promptForm.total_questions),
        mc_count: Number(promptForm.mc_count),
        essay_count: Number(promptForm.essay_count),
        difficulty: promptForm.difficulty,
        question_types: 'combination',
      });

      showToast('Permintaan pembuatan soal AI diterima. Sedang memproses...');
      setIsGeneratorModalOpen(false);
      handleOpenReviewQuestions(selectedQuiz, true);
    } catch (err) {
      setGenError(
        err.response?.data?.message || err.message || 'Gagal generate soal via Gemini AI.'
      );
    } finally {
      setIsGenerating(false);
    }
  };

  // Handle Document Extraction
  const handleExtractDocument = async (e) => {
    if (e) e.preventDefault();
    if (!uploadedDoc) {
      setGenError('Pilih berkas PDF atau TXT materi terlebih dahulu.');
      return;
    }

    setIsGenerating(true);
    setGenError('');
    try {
      const formData = new FormData();
      formData.append('file', uploadedDoc);
      formData.append('document', uploadedDoc);

      await quizApi.extractDocument(selectedQuiz.id, formData);
      showToast('Permintaan ekstraksi berkas AI diterima. Sedang memproses...');
      setIsGeneratorModalOpen(false);
      handleOpenReviewQuestions(selectedQuiz, true);
    } catch (err) {
      setGenError(
        err.response?.data?.message || err.message || 'Gagal mengekstrak soal dari dokumen.'
      );
    } finally {
      setIsGenerating(false);
    }
  };

  // Open Questions Review (dengan dukungan polling jika baru diproses asinkron di queue)
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
          <h1 className="text-sm font-bold text-[var(--color-text-primary)]">Manajemen Kuis AI</h1>
          <p className="text-[11px] text-[var(--color-text-muted)]">
            Pembuatan soal berbantuan Google Gemini &amp; evaluasi
          </p>
        </div>
        <Button
          size="sm"
          variant="primary"
          onClick={() => {
            setCreateForm({
              title: '',
              class_id: classesList[0]?.id || '',
              due_date: '',
              duration_minutes: 30,
            });
            setIsCreateModalOpen(true);
          }}
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
                          onClick={() => handleOpenReviewQuestions(quiz)}
                          className="data-table__action"
                          aria-label="Kelola soal"
                        >
                          <FileText size={13} />
                        </button>

                        {!isPublished && (
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedQuiz(quiz);
                              setIsGeneratorModalOpen(true);
                            }}
                            className="data-table__action"
                            aria-label="Generator soal AI"
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

      {/* MODAL 1: Form Buat Kuis Baru */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Buat Kuis Pembelajaran Baru"
      >
        <form onSubmit={handleCreateQuizSubmit} className="space-y-3">
          <Input
            label="Judul Kuis"
            placeholder="Contoh: Evaluasi Bab 3 - Pemrograman Web"
            value={createForm.title}
            onChange={(e) => setCreateForm({ ...createForm, title: e.target.value })}
            required
          />

          <div>
            <label className="text-xs font-semibold text-[var(--color-text-primary)] block mb-1">Kelas Sasaran</label>
            <Select
              value={createForm.class_id}
              onChange={(e) => setCreateForm({ ...createForm, class_id: e.target.value })}
              required
            >
              <option value="">Pilih Rombel...</option>
              {classesList.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Input
              type="number"
              min="5"
              max="180"
              label="Durasi (Menit)"
              value={createForm.duration_minutes}
              onChange={(e) => setCreateForm({ ...createForm, duration_minutes: e.target.value })}
              required
            />
            <Input
              type="date"
              label="Tenggat Waktu"
              value={createForm.due_date}
              onChange={(e) => setCreateForm({ ...createForm, due_date: e.target.value })}
            />
          </div>

          <div className="pt-2 flex gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setIsCreateModalOpen(false)}
              className="flex-1"
            >
              Batal
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={isCreatingQuiz}
              className="flex-1 bg-[var(--color-warning-bg)] text-[var(--color-text-primary)] font-bold"
            >
              {isCreatingQuiz ? 'Membuat...' : 'Lanjut ke Soal AI'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* MODAL 2: Generator Soal AI / Dokumen */}
      <Modal
        isOpen={isGeneratorModalOpen}
        onClose={() => setIsGeneratorModalOpen(false)}
        title="Generator Butir Soal AI"
      >
        <div className="space-y-3">
          {genError && (
            <div className="p-2.5 bg-[var(--color-danger-bg)] border border-[var(--color-danger-border)] text-[var(--color-danger-fg)] text-xs rounded-[14px]">
              {genError}
            </div>
          )}

          <div className="flex bg-[var(--color-surface-subtle)] p-1 rounded-[14px]">
            <button
              type="button"
              onClick={() => setGenMethod('prompt')}
              className={`flex-1 py-1 rounded-[10px] text-xs font-bold transition-all flex items-center justify-center gap-1 ${
                genMethod === 'prompt' ? 'bg-[var(--color-warning-bg)] text-[var(--color-text-primary)]' : 'text-[var(--color-text-secondary)]'
              }`}
            >
              <Sparkles size={13} />
              Prompt AI
            </button>
            <button
              type="button"
              onClick={() => setGenMethod('document')}
              className={`flex-1 py-1 rounded-[10px] text-xs font-bold transition-all flex items-center justify-center gap-1 ${
                genMethod === 'document' ? 'bg-[var(--color-warning-bg)] text-[var(--color-text-primary)]' : 'text-[var(--color-text-secondary)]'
              }`}
            >
              <Upload size={13} />
              Modul PDF/TXT
            </button>
          </div>

          {genMethod === 'prompt' ? (
            <form onSubmit={handleGeneratePrompt} className="space-y-2.5">
              <div>
                <label className="text-xs font-semibold text-[var(--color-text-primary)] block mb-1">
                  Instruksi Materi Pembelajaran (AI Prompt)
                </label>
                <textarea
                  rows={3}
                  value={promptForm.prompt}
                  onChange={(e) => setPromptForm({ ...promptForm, prompt: e.target.value })}
                  placeholder="Contoh: Buatkan soal pilihan ganda seputar inheritance, polymorphism, dan enkapsulasi pada Java/C#..."
                  className="w-full text-xs p-2.5 field-area focus:outline-hidden focus:border-[var(--color-brand)]"
                  required
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-[11px] font-semibold text-[var(--color-text-primary)] block mb-1">Total Soal</label>
                  <Input
                    type="number"
                    min="1"
                    max="30"
                    value={promptForm.total_questions}
                    onChange={(e) => setPromptForm({ ...promptForm, total_questions: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-[var(--color-text-primary)] block mb-1">Jml Pilihan Ganda</label>
                  <Input
                    type="number"
                    min="0"
                    value={promptForm.mc_count}
                    onChange={(e) => setPromptForm({ ...promptForm, mc_count: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-[var(--color-text-primary)] block mb-1">Jml Esai</label>
                  <Input
                    type="number"
                    min="0"
                    value={promptForm.essay_count}
                    onChange={(e) => setPromptForm({ ...promptForm, essay_count: e.target.value })}
                  />
                </div>
              </div>

              <Button
                type="submit"
                variant="primary"
                disabled={isGenerating}
                className="w-full text-xs font-bold py-2.5 bg-[var(--color-warning-bg)] text-[var(--color-text-primary)] gap-1.5"
              >
                <Sparkles size={15} />
                {isGenerating ? 'Gemini AI Sedang Menulis Soal...' : 'Generate Soal Sekarang'}
              </Button>
            </form>
          ) : (
            <form onSubmit={handleExtractDocument} className="space-y-2.5">
              <div className="p-3 bg-[var(--color-info-bg)] border border-[var(--color-info-border)] rounded-[14px] text-xs text-[var(--color-info-fg)] leading-relaxed">
                AI akan mengekstrak butir-butir soal yang ada di modul/berkas tanpa mengarang soal baru.
              </div>
              <input
                type="file"
                accept=".pdf,.txt"
                onChange={(e) => setUploadedDoc(e.target.files?.[0] || null)}
                className="w-full text-xs file:mr-2 file:py-1.5 file:px-3 file:rounded-[10px] file:border-0 file:text-xs file:font-semibold file:bg-[var(--color-surface-subtle)] file:text-[var(--color-text-primary)]"
                required
              />
              <Button
                type="submit"
                variant="primary"
                disabled={isGenerating}
                className="w-full text-xs font-bold py-2.5 bg-[var(--color-warning-bg)] text-[var(--color-text-primary)] gap-1.5"
              >
                <Upload size={15} />
                {isGenerating ? 'Mengekstrak Soal dari Dokumen...' : 'Ekstrak Soal Dokumen'}
              </Button>
            </form>
          )}
        </div>
      </Modal>

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
