import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Plus,
  Sparkles,
  FileUp,
  Edit3,
  Trash2,
  AlertTriangle,
  ArrowLeft,
  HelpCircle,
  RotateCw,
  CheckCircle2,
  Send,
  Save,
  X,
} from 'lucide-react';
import { quizApi } from '../../services/quizApi';
import masterDataApi from '../../services/masterDataApi';
import { Button, Input, Select, Badge, FileUpload, ConfirmDialog } from '../../components/shared';
import './TeacherQuiz.css';
import './QuizCreate.css';

const STEP_LABELS = ['Konfigurasi', 'Sumber Soal', 'Tinjau & Terbitkan'];

const fmtDate = (value) => {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
};

export default function QuizCreatePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const resumeId = searchParams.get('id');

  const [step, setStep] = useState(1);
  const [qFilter, setQFilter] = useState('all');
  const [classList, setClassList] = useState([]);
  const [currentQuiz, setCurrentQuiz] = useState(null);
  const [quizQuestions, setQuizQuestions] = useState([]);
  const [isLoadingQuestions, setIsLoadingQuestions] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [createForm, setCreateForm] = useState({
    title: '',
    class_id: '',
    class_name: '',
    selected_class_ids: [],
    due_date: '',
    max_attempts: '2',
    duration_minutes: '30',
  });

  const [genMethod, setGenMethod] = useState('prompt');
  const [promptForm, setPromptForm] = useState({
    prompt: '',
    total_questions: '5',
    question_types: 'combination',
    mc_count: '3',
    essay_count: '2',
    difficulty: 'sedang',
    teacher_notes: '',
  });
  const [isGenerating, setIsGenerating] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [genProgressMsg, setGenProgressMsg] = useState('');
  const [uploadedDoc, setUploadedDoc] = useState(null);

  const [manualForm, setManualForm] = useState({
    question_type: 'multiple_choice',
    question_text: '',
    optionA: '',
    optionB: '',
    optionC: '',
    optionD: '',
    correct_answer: 'A',
    points: '20',
  });
  const [showManualForm, setShowManualForm] = useState(false);
  const [isSavingManual, setIsSavingManual] = useState(false);

  const [editingQuestion, setEditingQuestion] = useState(null);
  const [editForm, setEditForm] = useState({ question_text: '', correct_answer: '', points: '20' });

  const [confirmDialog, setConfirmDialog] = useState({ isOpen: false, title: '', message: '', onConfirm: null });
  const [toast, setToast] = useState({ show: false, message: '', variant: 'success' });

  const showToast = (message, variant = 'success') => {
    setToast({ show: true, message, variant });
    setTimeout(() => setToast({ show: false, message: '', variant: 'success' }), 4000);
  };

  // Kelas yang diajar guru
  useEffect(() => {
    (async () => {
      try {
        const res = await masterDataApi.classes.getClasses({ my_taught_only: 1, all: 1 });
        const list = res?.data || [];
        setClassList(Array.isArray(list) ? list : []);
        if (Array.isArray(list) && list.length === 1) {
          setCreateForm((prev) => ({
            ...prev,
            class_id: String(list[0].id),
            selected_class_ids: [String(list[0].id)],
            class_name: list[0].name,
          }));
        }
      } catch {
        showToast('Gagal memuat daftar kelas yang Anda ajar.', 'error');
      }
    })();
  }, []);

  const classOptions = useMemo(
    () => classList.map((c) => ({ value: String(c.id), label: `Kelas ${c.name} (${c.level || ''})` })),
    [classList]
  );

  const promptCompositionError = useMemo(() => {
    const total = parseInt(promptForm.total_questions, 10) || 0;
    const mc = parseInt(promptForm.mc_count, 10) || 0;
    const essay = parseInt(promptForm.essay_count, 10) || 0;
    if (total <= 0) return 'Total jumlah soal minimal 1.';
    if (promptForm.question_types === 'multiple_choice' && mc !== total) {
      return `Pada jenis Pilihan Ganda, jumlah soal PG harus sama dengan total (${total}).`;
    }
    if (promptForm.question_types === 'essay' && essay !== total) {
      return `Pada jenis Esai, jumlah soal Esai harus sama dengan total (${total}).`;
    }
    if (promptForm.question_types === 'combination') {
      if (mc <= 0 || essay <= 0) return 'Pada soal kombinasi, butir PG dan Esai masing-masing minimal 1.';
      if (mc + essay !== total) {
        return `Penjumlahan PG (${mc}) + Esai (${essay}) = ${mc + essay}, wajib sama persis dengan Total Soal (${total}).`;
      }
    }
    return '';
  }, [promptForm]);

  const loadQuestions = useCallback(async (quizId) => {
    setIsLoadingQuestions(true);
    try {
      const res = await quizApi.getQuizQuestions(quizId);
      const raw = res?.data?.questions || res?.data || res?.questions || [];
      const list = Array.isArray(raw) ? raw : raw?.questions || [];
      setQuizQuestions(list);
      return list;
    } catch {
      setQuizQuestions([]);
      return [];
    } finally {
      setIsLoadingQuestions(false);
    }
  }, []);

  // Muat kuis yang sudah ada (lanjutkan draf)
  useEffect(() => {
    if (!resumeId) return;
    (async () => {
      try {
        const res = await quizApi.getQuizDetail(resumeId);
        const quiz = res?.data || res;
        if (!quiz) return;
        setCurrentQuiz(quiz);
        setCreateForm({
          title: quiz.title || '',
          class_id: String(quiz.class_id || ''),
          class_name: quiz.school_class?.name || quiz.schoolClass?.name || '',
          selected_class_ids: quiz.target_class_ids?.map(String) || [String(quiz.class_id || '')],
          due_date: (quiz.due_date || '').slice(0, 10),
          max_attempts: String(quiz.max_attempts || 1),
          duration_minutes: String(quiz.duration_minutes || 30),
        });
        const list = await loadQuestions(resumeId);
        setStep(quiz.status === 'draft_review' && list.length > 0 ? 3 : 2);
      } catch (err) {
        showToast(err.message || 'Gagal memuat draf kuis.', 'error');
      }
    })();
  }, [resumeId, loadQuestions]);

  const pollForQuizQuestions = async (quizId, maxAttempts = 30, delayMs = 1500) => {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const qRes = await quizApi.getQuizQuestions(quizId);
        const raw = qRes?.data?.questions || qRes?.data || qRes?.questions || [];
        const list = Array.isArray(raw) ? raw : raw?.questions || [];
        if (Array.isArray(list) && list.length > 0) return list;
      } catch {
        /* antrean masih menulis ke database */
      }
      if (attempt < maxAttempts) await new Promise((r) => setTimeout(r, delayMs));
    }
    try {
      const finalRes = await quizApi.getQuizQuestions(quizId);
      const raw = finalRes?.data?.questions || finalRes?.data || finalRes?.questions || [];
      const list = Array.isArray(raw) ? raw : raw?.questions || [];
      return Array.isArray(list) ? list : [];
    } catch {
      return [];
    }
  };

  // STEP 1 — buat kuis
  const handleCreateQuiz = async (e) => {
    if (e?.preventDefault) e.preventDefault();
    if (!createForm.title.trim()) return showToast('Judul kuis wajib diisi.', 'error');
    const selected = createForm.selected_class_ids?.length
      ? createForm.selected_class_ids
      : createForm.class_id
      ? [createForm.class_id]
      : [];
    if (selected.length === 0) return showToast('Pilih minimal satu kelas target.', 'error');

    setIsSaving(true);
    try {
      const res = await quizApi.createQuiz({
        title: createForm.title.trim(),
        class_id: selected[0],
        class_ids: selected,
        due_date: createForm.due_date,
        max_attempts: Number(createForm.max_attempts) || 1,
        duration_minutes: Number(createForm.duration_minutes) || 30,
      });
      const quiz = res?.data || res;
      if (!quiz?.id) throw new Error('Respons pembuatan kuis tidak valid.');
      quiz.target_class_ids = res?.target_class_ids || selected;
      setCurrentQuiz(quiz);
      setStep(2);
      showToast('Kuis dibuat dengan status Draft Review. Lanjut memilih sumber soal.', 'success');
    } catch (err) {
      showToast(err.message || err.response?.data?.message || 'Gagal membuat kuis.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // STEP 2 — generate prompt
  const handleGeneratePrompt = async (e) => {
    if (e?.preventDefault) e.preventDefault();
    if (promptCompositionError) return showToast(promptCompositionError, 'error');
    if (!promptForm.prompt.trim()) return showToast('Instruksi materi wajib diisi.', 'error');
    if (!currentQuiz?.id) return showToast('Kuis belum dibuat.', 'error');

    setIsGenerating(true);
    setGenProgressMsg('Mengirim instruksi prompt ke layanan AI...');
    try {
      const res = await quizApi.generatePrompt(currentQuiz.id, {
        prompt: promptForm.prompt,
        total_questions: parseInt(promptForm.total_questions, 10),
        question_types: promptForm.question_types,
        mc_count: parseInt(promptForm.mc_count, 10),
        essay_count: parseInt(promptForm.essay_count, 10),
        difficulty: promptForm.difficulty,
        additional_notes: promptForm.teacher_notes,
      });

      const direct = Array.isArray(res?.data?.questions) ? res.data.questions : null;
      setGenProgressMsg('Menyusun butir soal ke dalam skema kuis...');
      const list = direct && direct.length ? direct : await pollForQuizQuestions(currentQuiz.id);

      if (list.length > 0) {
        setQuizQuestions(list);
        setStep(3);
        showToast('Soal berhasil dihasilkan. Periksa sebelum diterbitkan.', 'success');
      } else {
        showToast('AI belum menghasilkan soal. Coba lagi atau tambah soal manual.', 'error');
      }
    } catch (err) {
      showToast(err.message || err.response?.data?.message || 'Gagal memproses prompt AI.', 'error');
    } finally {
      setIsGenerating(false);
      setGenProgressMsg('');
    }
  };

  // STEP 2 — ekstraksi dokumen
  const handleExtractDocument = async (e) => {
    if (e?.preventDefault) e.preventDefault();
    if (!uploadedDoc) return showToast('Pilih berkas PDF/TXT terlebih dahulu.', 'error');
    if (!currentQuiz?.id) return showToast('Kuis belum dibuat.', 'error');

    setIsExtracting(true);
    setGenProgressMsg('Mengunggah dokumen dan memicu ekstraksi AI...');
    try {
      const formData = new FormData();
      formData.append('document', uploadedDoc);
      formData.append('file', uploadedDoc);
      const res = await quizApi.extractDocument(currentQuiz.id, formData);

      const direct = Array.isArray(res?.data?.questions) ? res.data.questions : null;
      const list = direct && direct.length ? direct : await pollForQuizQuestions(currentQuiz.id);

      if (list.length > 0) {
        setQuizQuestions(list);
        setStep(3);
        showToast('Dokumen berhasil diekstrak. Periksa butir soal bertanda kuning.', 'success');
      } else {
        showToast('Soal tidak dapat diekstrak dari dokumen ini.', 'error');
      }
    } catch (err) {
      showToast(err.message || err.response?.data?.message || 'Gagal mengekstrak dokumen.', 'error');
    } finally {
      setIsExtracting(false);
      setGenProgressMsg('');
    }
  };

  // STEP 2/3 — soal manual
  const handleAddManualQuestion = async (e) => {
    if (e?.preventDefault) e.preventDefault();
    if (!manualForm.question_text.trim()) return showToast('Teks pertanyaan wajib diisi.', 'error');
    if (!currentQuiz?.id) return showToast('Kuis belum dibuat.', 'error');

    setIsSavingManual(true);
    try {
      const res = await quizApi.createQuestion(currentQuiz.id, {
        question_type: manualForm.question_type,
        question_text: manualForm.question_text,
        points: parseInt(manualForm.points, 10) || 20,
        options:
          manualForm.question_type === 'essay'
            ? null
            : {
                A: manualForm.optionA || 'Pilihan A',
                B: manualForm.optionB || 'Pilihan B',
                C: manualForm.optionC || 'Pilihan C',
                D: manualForm.optionD || 'Pilihan D',
              },
        correct_answer:
          manualForm.question_type === 'essay'
            ? manualForm.correct_answer || 'Kriteria jawaban lengkap sesuai kata kunci'
            : manualForm.correct_answer,
      });
      const newQuestion = res?.data || res;
      if (newQuestion) setQuizQuestions((prev) => [...prev, newQuestion]);
      setManualForm({
        question_type: 'multiple_choice',
        question_text: '',
        optionA: '',
        optionB: '',
        optionC: '',
        optionD: '',
        correct_answer: 'A',
        points: '20',
      });
      showToast('Butir soal manual ditambahkan.', 'success');
    } catch (err) {
      showToast(err.message || err.response?.data?.message || 'Gagal menambah soal manual.', 'error');
    } finally {
      setIsSavingManual(false);
    }
  };

  const handleDeleteQuestion = (questionId) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Hapus Butir Soal?',
      message: 'Butir soal ini akan dihapus dari kuis. Lanjutkan?',
      onConfirm: async () => {
        try {
          await quizApi.deleteQuestion(currentQuiz.id, questionId);
          setQuizQuestions((prev) => prev.filter((q) => q.id !== questionId));
          showToast('Butir soal dihapus.', 'success');
        } catch {
          showToast('Gagal menghapus butir soal.', 'error');
        } finally {
          setConfirmDialog((c) => ({ ...c, isOpen: false }));
        }
      },
    });
  };

  const handleSaveEditQuestion = async (e) => {
    if (e?.preventDefault) e.preventDefault();
    try {
      await quizApi.updateQuestion(currentQuiz.id, editingQuestion.id, {
        question_text: editForm.question_text,
        correct_answer: editForm.correct_answer,
        points: parseInt(editForm.points, 10) || 20,
      });
      setQuizQuestions((prev) =>
        prev.map((q) =>
          q.id === editingQuestion.id
            ? {
                ...q,
                question_text: editForm.question_text,
                correct_answer: editForm.correct_answer,
                points: parseInt(editForm.points, 10) || 20,
                needs_review: false,
              }
            : q
        )
      );
      setEditingQuestion(null);
      showToast('Butir soal diperbarui.', 'success');
    } catch (err) {
      showToast(err.message || 'Gagal memperbarui butir soal.', 'error');
    }
  };

  // STEP 3 — terbitkan
  const handlePublish = () => {
    if (quizQuestions.length === 0) return showToast('Kuis belum memiliki butir soal.', 'error');
    if (quizQuestions.some((q) => q.needs_review)) {
      return showToast('Masih ada soal bertanda kuning. Tinjau atau edit terlebih dahulu.', 'error');
    }

    const otherClassIds = (currentQuiz?.target_class_ids || []).filter(
      (cid) => Number(cid) !== Number(currentQuiz.class_id)
    );

    const targetIds = (currentQuiz?.target_class_ids || createForm.selected_class_ids || []).map(String);
    const targetNames =
      classList
        .filter((c) => targetIds.includes(String(c.id)))
        .map((c) => c.name)
        .join(', ') || '-';

    setConfirmDialog({
      isOpen: true,
      title: 'Terbitkan kuis ini?',
      message:
        `Kuis "${currentQuiz.title}" · ${quizQuestions.length} butir soal (${totalPoints} poin) · ` +
        `tenggat ${fmtDate(createForm.due_date)} · ${targetIds.length} kelas: ${targetNames}. ` +
        'Kuis langsung dapat dikerjakan siswa dan butir soal terkunci setelah terbit.',
      onConfirm: async () => {
        try {
          await quizApi.updateQuizStatus(currentQuiz.id, {
            status: 'published',
            duplicate_to_class_ids: otherClassIds,
          });
          setCurrentQuiz((prev) => ({ ...prev, status: 'published' }));
          showToast('Kuis berhasil diterbitkan.', 'success');
        } catch (err) {
          showToast(err.message || err.response?.data?.message || 'Gagal menerbitkan kuis.', 'error');
        } finally {
          setConfirmDialog((c) => ({ ...c, isOpen: false }));
        }
      },
    });
  };

  const backToList = () => navigate('/teacher/quiz');

  const toggleClass = (value) => {
    setCreateForm((prev) => {
      const exists = prev.selected_class_ids.includes(value);
      const updated = exists
        ? prev.selected_class_ids.filter((id) => id !== value)
        : [...prev.selected_class_ids, value];
      return {
        ...prev,
        selected_class_ids: updated,
        class_id: updated[0] || '',
        class_name: classList.find((c) => String(c.id) === (updated[0] || ''))?.name || '',
      };
    });
  };

  const isPublished = currentQuiz?.status === 'published' || currentQuiz?.status === 'published_result';
  const reviewCount = quizQuestions.filter((q) => q.needs_review).length;
  const mcCount = quizQuestions.filter((q) => q.question_type === 'multiple_choice').length;
  const essayCount = quizQuestions.filter((q) => q.question_type === 'essay').length;
  const totalPoints = quizQuestions.reduce((sum, q) => sum + (Number(q.points) || 20), 0);
  const filteredQuestions =
    qFilter === 'all'
      ? quizQuestions
      : qFilter === 'review'
      ? quizQuestions.filter((q) => q.needs_review)
      : quizQuestions.filter((q) => q.question_type === qFilter);
  const canPublish = quizQuestions.length > 0 && reviewCount === 0;

  return (
    <div className="quiz-create-page">
      {toast.show && (
        <div className={`quiz-create-toast quiz-create-toast--${toast.variant}`}>{toast.message}</div>
      )}

      <header className="quiz-create-head">
        <div>
          <div className="quiz-create-crumb">
            <button type="button" className="quiz-create-crumb-link" onClick={backToList}>
              Kuis
            </button>
            <span>/</span>
            <span>Buat Kuis</span>
          </div>
          <h1 className="quiz-create-title">{currentQuiz ? 'Lanjutkan Kuis' : 'Buat Kuis Baru'}</h1>
          <p className="quiz-create-sub">
            Konfigurasi kuis, pilih sumber soal, lalu tinjau sebelum diterbitkan ke siswa.
          </p>
        </div>
        <Button variant="outline" icon={ArrowLeft} onClick={backToList}>
          Kembali ke daftar
        </Button>
      </header>

      <ol className="quiz-steps">
        {STEP_LABELS.map((label, index) => {
          const number = index + 1;
          const state = step === number ? 'on' : step > number ? 'done' : '';
          return (
            <li key={label} className={`quiz-step ${state}`}>
              <span className="quiz-step__dot">{step > number ? <CheckCircle2 size={13} /> : number}</span>
              <span className="quiz-step__label">{label}</span>
              {number < STEP_LABELS.length && <span className="quiz-step__line" />}
            </li>
          );
        })}
      </ol>

      {/* ================= STEP 1 ================= */}
      {step === 1 && (
        <form className="quiz-create-grid" onSubmit={handleCreateQuiz}>
          <section className="quiz-create-card">
            <h2 className="quiz-create-card__title">Informasi Kuis</h2>
            <p className="quiz-create-card__hint">Judul, kelas target, tenggat, dan batas percobaan pengerjaan.</p>

            <Input
              label="Judul Kuis / Asesmen"
              placeholder="Contoh: Kuis Logika Algoritma & Struktur Data"
              value={createForm.title}
              onChange={(e) => setCreateForm({ ...createForm, title: e.target.value })}
              required
            />

            <div className="form-group">
              <label className="form-label font-semibold text-slate-800 text-xs">
                Target Rombel Kelas yang Diajar (Wajib)
              </label>
              <p className="text-[11px] text-slate-500 mb-2">
                Centang satu atau lebih kelas. Kuis akan didistribusikan paralel.
              </p>
              {classOptions.length === 0 ? (
                <div className="quiz-create-warn">
                  Belum ada jadwal mengajar aktif. Hubungi Waka Kurikulum.
                </div>
              ) : (
                <div className="quiz-class-list">
                  {classOptions.map((c) => {
                    const checked = createForm.selected_class_ids.includes(c.value);
                    return (
                      <label key={c.value} className={`quiz-class-item ${checked ? 'quiz-class-item--on' : ''}`}>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleClass(c.value)}
                          className="quiz-class-check"
                        />
                        <span className="quiz-class-name">{c.label}</span>
                        {checked && <span className="quiz-class-tag">Target</span>}
                      </label>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input
                type="date"
                label="Tenggat Waktu Pengumpulan"
                value={createForm.due_date}
                onChange={(e) => setCreateForm({ ...createForm, due_date: e.target.value })}
                required
              />
              <Input
                type="number"
                label="Maks. Percobaan Pengerjaan"
                value={createForm.max_attempts}
                onChange={(e) => setCreateForm({ ...createForm, max_attempts: e.target.value })}
                min="1"
                max="5"
              />
            </div>

            <Input
              type="number"
              label="Durasi Pengerjaan (menit)"
              value={createForm.duration_minutes}
              onChange={(e) => setCreateForm({ ...createForm, duration_minutes: e.target.value })}
              min="1"
              max="300"
            />
          </section>

          <aside className="quiz-create-aside">
            <h3 className="quiz-create-aside__title">Ringkasan</h3>
            <div className="quiz-sum-row">
              <span>Judul</span>
              <b>{createForm.title || '—'}</b>
            </div>
            <div className="quiz-sum-row">
              <span>Kelas</span>
              <b>{createForm.selected_class_ids.length || 0} rombel</b>
            </div>
            <div className="quiz-sum-row">
              <span>Tenggat</span>
              <b>{fmtDate(createForm.due_date)}</b>
            </div>
            <div className="quiz-sum-row">
              <span>Percobaan</span>
              <b>{createForm.max_attempts}×</b>
            </div>
            <div className="quiz-sum-row">
              <span>Durasi</span>
              <b>{createForm.duration_minutes} menit</b>
            </div>
            <div className="quiz-sum-row quiz-sum-row--muted">
              <span>Status setelah dibuat</span>
              <b>Draft Review</b>
            </div>
            <div className="quiz-create-actions">
              <Button variant="secondary" type="button" onClick={backToList}>
                Batal
              </Button>
              <Button variant="primary" type="submit" disabled={isSaving} icon={Save}>
                {isSaving ? 'Menyimpan…' : 'Lanjut ke Sumber Soal'}
              </Button>
            </div>
          </aside>
        </form>
      )}

      {/* ================= STEP 2 ================= */}
      {step === 2 && (
        <div className="quiz-create-grid">
          <section className="quiz-create-card">
            <h2 className="quiz-create-card__title">Sumber Soal</h2>
            <p className="quiz-create-card__hint">
              Pilih salah satu metode. Semua pengaturan lama tetap tersedia.
            </p>

            <div className="quiz-methods">
              {[
                { id: 'prompt', icon: Sparkles, title: 'Prompt AI', desc: 'Topik + komposisi PG/Esai' },
                { id: 'document', icon: FileUp, title: 'Dokumen', desc: 'PDF/TXT, ekstrak soal asli' },
                { id: 'manual', icon: Edit3, title: 'Manual', desc: 'Tulis butir sendiri' },
              ].map((m) => {
                const Icon = m.icon;
                return (
                  <button
                    key={m.id}
                    type="button"
                    className={`quiz-method ${genMethod === m.id ? 'quiz-method--on' : ''}`}
                    onClick={() => setGenMethod(m.id)}
                    aria-pressed={genMethod === m.id}
                  >
                    <span className="quiz-method__check">{genMethod === m.id ? '✓' : ''}</span>
                    <span className="quiz-method__icon">
                      <Icon size={14} />
                    </span>
                    <b>{m.title}</b>
                    <span className="quiz-method__desc">{m.desc}</span>
                  </button>
                );
              })}
            </div>

            {quizQuestions.length > 0 && (
              <p className="quiz-create-note">
                Sudah ada {quizQuestions.length} butir soal — berganti metode tidak menghapus soal yang sudah dibuat.
              </p>
            )}

            {genMethod === 'prompt' && (
              <form onSubmit={handleGeneratePrompt} className="quiz-gen-form">
                <div className="form-group">
                  <label className="form-label">Instruksi Materi &amp; Topik Pembelajaran</label>
                  <textarea
                    className="quiz-textarea"
                    rows={3}
                    placeholder="Contoh: Buatkan soal evaluasi mengenai konsep Object Oriented Programming, inheritance, polymorphism, dan enkapsulasi."
                    value={promptForm.prompt}
                    onChange={(e) => setPromptForm({ ...promptForm, prompt: e.target.value })}
                    disabled={isGenerating}
                    required
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Input
                    type="number"
                    label="Total Jumlah Soal"
                    min="1"
                    max="30"
                    value={promptForm.total_questions}
                    onChange={(e) => setPromptForm({ ...promptForm, total_questions: e.target.value })}
                    disabled={isGenerating}
                    required
                  />
                  <Select
                    label="Format / Jenis Soal"
                    options={[
                      { value: 'combination', label: 'Kombinasi (PG & Esai)' },
                      { value: 'multiple_choice', label: 'Hanya Pilihan Ganda' },
                      { value: 'essay', label: 'Hanya Esai' },
                    ]}
                    value={promptForm.question_types}
                    onChange={(e) => setPromptForm({ ...promptForm, question_types: e.target.value })}
                    disabled={isGenerating}
                  />
                </div>

                {promptForm.question_types === 'combination' && (
                  <div className="composition-box">
                    <div className="grid grid-cols-2 gap-3">
                      <Input
                        type="number"
                        label="Jumlah Soal PG"
                        min="1"
                        value={promptForm.mc_count}
                        onChange={(e) => setPromptForm({ ...promptForm, mc_count: e.target.value })}
                        disabled={isGenerating}
                        required
                      />
                      <Input
                        type="number"
                        label="Jumlah Soal Esai"
                        min="1"
                        value={promptForm.essay_count}
                        onChange={(e) => setPromptForm({ ...promptForm, essay_count: e.target.value })}
                        disabled={isGenerating}
                        required
                      />
                    </div>
                    {promptCompositionError ? (
                      <div className="composition-alert">
                        <AlertTriangle size={14} className="text-amber-600 flex-shrink-0" />
                        <span>{promptCompositionError}</span>
                      </div>
                    ) : (
                      <div className="composition-ok">
                        <CheckCircle2 size={14} />
                        <span>
                          {promptForm.mc_count} PG + {promptForm.essay_count} esai = {promptForm.total_questions} soal · komposisi sesuai
                        </span>
                      </div>
                    )}
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Select
                    label="Tingkat Kesulitan"
                    options={[
                      { value: 'mudah', label: 'Mudah (Dasar)' },
                      { value: 'sedang', label: 'Sedang (Aplikasi)' },
                      { value: 'sulit', label: 'Sulit (HOTS)' },
                    ]}
                    value={promptForm.difficulty}
                    onChange={(e) => setPromptForm({ ...promptForm, difficulty: e.target.value })}
                    disabled={isGenerating}
                  />
                  <Input
                    label="Catatan Khusus Guru (Opsional)"
                    placeholder="Misal: sertakan potongan kode program"
                    value={promptForm.teacher_notes}
                    onChange={(e) => setPromptForm({ ...promptForm, teacher_notes: e.target.value })}
                    disabled={isGenerating}
                  />
                </div>

                {isGenerating ? (
                  <div className="gen-loading-state">
                    <RotateCw size={22} className="animate-spin text-slate-800" />
                    <p className="text-sm font-medium text-slate-800 mt-2">{genProgressMsg}</p>
                    <p className="text-xs text-slate-400">Estimasi 5–15 detik.</p>
                  </div>
                ) : (
                  <div className="quiz-create-actions">
                    <Button variant="secondary" type="button" onClick={() => setStep(1)}>
                      ← Kembali
                    </Button>
                    <Button type="submit" variant="primary" icon={Sparkles} disabled={Boolean(promptCompositionError)}>
                      Generate Soal
                    </Button>
                  </div>
                )}
              </form>
            )}

            {genMethod === 'document' && (
              <form onSubmit={handleExtractDocument} className="quiz-gen-form">
                <div className="doc-instruction-box">
                  <h4 className="text-xs font-semibold text-slate-800 uppercase tracking-wider mb-1">
                    Prinsip Pelestarian Konten Asli
                  </h4>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    AI mengekstrak soal yang sudah ada di dokumen, bukan mengarang soal baru. Butir yang ambigu
                    ditandai <strong>needs_review</strong>.
                  </p>
                </div>

                <FileUpload
                  label="Unggah Berkas Modul / Soal Ujian"
                  accept=".pdf,.txt"
                  maxSizeMB={5}
                  file={uploadedDoc}
                  onChange={setUploadedDoc}
                  hint="Mendukung .PDF atau .TXT (maks 5MB)"
                  disabled={isExtracting}
                />

                {isExtracting ? (
                  <div className="gen-loading-state">
                    <RotateCw size={22} className="animate-spin text-slate-800" />
                    <p className="text-sm font-medium text-slate-800 mt-2">Mengekstrak dokumen…</p>
                  </div>
                ) : (
                  <div className="quiz-create-actions">
                    <Button variant="secondary" type="button" onClick={() => setStep(1)}>
                      ← Kembali
                    </Button>
                    <Button type="submit" variant="primary" icon={FileUp} disabled={!uploadedDoc}>
                      Ekstrak Dokumen
                    </Button>
                  </div>
                )}
              </form>
            )}

            {genMethod === 'manual' && (
              <div className="quiz-gen-form">
                <p className="text-xs text-slate-600 mb-3">
                  Tambahkan butir soal satu per satu. Soal manual memakai skema data yang sama dengan hasil AI.
                </p>
                <Button variant="primary" icon={Plus} onClick={() => setShowManualForm(true)}>
                  Tambah Butir Soal Manual
                </Button>
                <div className="quiz-create-actions" style={{ marginTop: 16 }}>
                  <Button variant="secondary" type="button" onClick={() => setStep(1)}>
                    ← Kembali
                  </Button>
                  <Button variant="outline" type="button" onClick={() => setStep(3)} disabled={quizQuestions.length === 0}>
                    Lanjut ke Tinjau
                  </Button>
                </div>
              </div>
            )}
          </section>

          <aside className="quiz-create-aside">
            <h3 className="quiz-create-aside__title">Ringkasan</h3>
            <div className="quiz-sum-row"><span>Judul</span><b>{currentQuiz?.title || createForm.title || '—'}</b></div>
            <div className="quiz-sum-row"><span>Kelas</span><b>{createForm.selected_class_ids.length} rombel</b></div>
            <div className="quiz-sum-row"><span>Tenggat</span><b>{fmtDate(createForm.due_date)}</b></div>
            <div className="quiz-sum-row"><span>Percobaan</span><b>{createForm.max_attempts}×</b></div>
            <div className="quiz-sum-row"><span>Butir soal</span><b>{quizQuestions.length}</b></div>
            <div className="quiz-sum-row quiz-sum-row--muted"><span>Status</span><b>Draft Review</b></div>
          </aside>
        </div>
      )}

      {/* ================= STEP 3 ================= */}
      {step === 3 && (
        <div className="quiz-create-grid">
          <section className="quiz-create-card">
            <div className="quiz-review-head">
              <div>
                <h2 className="quiz-create-card__title">Tinjau &amp; Terbitkan</h2>
                <p className="quiz-create-card__hint">
                  {quizQuestions.length} butir soal · {mcCount} PG · {essayCount} esai · {totalPoints} poin
                </p>
              </div>
              <Button variant="outline" size="sm" icon={Plus} onClick={() => setShowManualForm(true)}>
                Tambah Soal
              </Button>
            </div>

            <div className="quiz-filters">
              <button type="button" className={`quiz-filter ${qFilter === 'all' ? 'quiz-filter--on' : ''}`} onClick={() => setQFilter('all')}>
                Semua {quizQuestions.length}
              </button>
              <button type="button" className={`quiz-filter ${qFilter === 'multiple_choice' ? 'quiz-filter--on' : ''}`} onClick={() => setQFilter('multiple_choice')}>
                PG {mcCount}
              </button>
              <button type="button" className={`quiz-filter ${qFilter === 'essay' ? 'quiz-filter--on' : ''}`} onClick={() => setQFilter('essay')}>
                Esai {essayCount}
              </button>
              <button
                type="button"
                className={`quiz-filter ${reviewCount > 0 ? 'quiz-filter--warn' : ''} ${qFilter === 'review' ? 'quiz-filter--on' : ''}`}
                onClick={() => setQFilter('review')}
              >
                Perlu tinjau {reviewCount}
              </button>
            </div>

            {isLoadingQuestions ? (
              <div className="preview-empty">
                <RotateCw size={22} className="animate-spin text-slate-500" />
                <p className="text-xs text-slate-400 mt-2">Memuat butir soal…</p>
              </div>
            ) : quizQuestions.length === 0 ? (
              <div className="preview-empty">
                <HelpCircle size={28} className="text-slate-300 mb-2" />
                <p className="text-sm font-semibold text-slate-700">Belum ada butir soal.</p>
                <p className="text-xs text-slate-400">Kembali ke langkah 2 untuk membuat soal.</p>
              </div>
            ) : (
              <div className="preview-questions-list">
                {filteredQuestions.map((q, idx) => (
                  <div key={q.id} className={`question-card ${q.needs_review ? 'question-card--ambiguous' : ''}`}>
                    {editingQuestion?.id === q.id ? (
                      <form onSubmit={handleSaveEditQuestion} className="quiz-gen-form">
                        <div className="form-group">
                          <label className="form-label">Teks Pertanyaan</label>
                          <textarea
                            className="quiz-textarea"
                            rows={3}
                            value={editForm.question_text}
                            onChange={(e) => setEditForm({ ...editForm, question_text: e.target.value })}
                            required
                          />
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <Input
                            label={q.question_type === 'essay' ? 'Rubrik / Kunci Esai' : 'Kunci Jawaban (A/B/C/D)'}
                            value={editForm.correct_answer}
                            onChange={(e) => setEditForm({ ...editForm, correct_answer: e.target.value })}
                          />
                          <Input
                            type="number"
                            label="Bobot Poin"
                            value={editForm.points}
                            onChange={(e) => setEditForm({ ...editForm, points: e.target.value })}
                            min="1"
                          />
                        </div>
                        <div className="quiz-create-actions">
                          <Button variant="secondary" type="button" onClick={() => setEditingQuestion(null)} icon={X}>
                            Batal
                          </Button>
                          <Button variant="primary" type="submit" icon={Save}>
                            Simpan Butir
                          </Button>
                        </div>
                      </form>
                    ) : (
                      <>
                        <div className="question-card-head">
                          <div className="flex items-center gap-2">
                            <span className="question-number">Soal #{quizQuestions.findIndex((item) => item.id === q.id) + 1}</span>
                            <Badge variant={q.question_type === 'multiple_choice' ? 'default' : 'warning'}>
                              {q.question_type === 'multiple_choice' ? 'Pilihan Ganda' : 'Esai'}
                            </Badge>
                            <span className="text-[11px] font-mono text-slate-500">Bobot: {q.points || 20}</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              className="q-action-btn"
                              onClick={() => {
                                setEditingQuestion(q);
                                setEditForm({
                                  question_text: q.question_text || '',
                                  correct_answer: q.correct_answer || '',
                                  points: String(q.points || 20),
                                });
                              }}
                              aria-label={`Edit soal ${idx + 1}`}
                            >
                              <Edit3 size={14} />
                            </button>
                            <button
                              type="button"
                              className="q-action-btn q-action-btn--danger"
                              onClick={() => handleDeleteQuestion(q.id)}
                              aria-label={`Hapus soal ${idx + 1}`}
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>

                        {q.needs_review && (
                          <div className="ambiguity-alert-box">
                            <AlertTriangle size={15} className="text-amber-600 flex-shrink-0 mt-0.5" />
                            <div>
                              <strong className="text-xs font-semibold text-amber-900 block">
                                Perlu Verifikasi Guru
                              </strong>
                              <p className="text-xs text-amber-800 mt-0.5">
                                {q.review_note || 'Butir ini ditandai ambigu oleh AI.'}
                              </p>
                            </div>
                          </div>
                        )}

                        <p className="question-text">{q.question_text}</p>

                        {q.question_type === 'multiple_choice' && q.options && (() => {
                          let options = q.options;
                          if (typeof options === 'string') {
                            try {
                              options = JSON.parse(options);
                            } catch {
                              options = null;
                            }
                          }
                          if (!options) return null;
                          const correct = String(q.correct_answer || '').trim().toUpperCase();
                          const entries = Array.isArray(options)
                            ? options.map((text, i) => [['A', 'B', 'C', 'D', 'E'][i] || String(i), text])
                            : Object.entries(options);
                          return (
                            <div className="options-grid">
                              {entries.map(([letter, text]) => {
                                const key = String(letter).trim().toUpperCase();
                                const isCorrect = correct === key || correct.startsWith(`${key}.`) || correct.startsWith(`${key} `);
                                return (
                                  <div key={letter} className={`option-item ${isCorrect ? 'option-item--correct' : ''}`}>
                                    <span className="option-letter">{letter}.</span>
                                    <span className="option-label">{text}</span>
                                    {isCorrect && <span className="option-correct-badge">Kunci</span>}
                                  </div>
                                );
                              })}
                            </div>
                          );
                        })()}

                        {q.question_type === 'essay' && (
                          <div className="essay-rubric-box">
                            <span className="text-[11px] font-semibold text-slate-700 block mb-0.5">
                              Rubrik Penilaian AI:
                            </span>
                            <p className="text-xs text-slate-600 italic">
                              {q.correct_answer || 'Evaluasi kata kunci kesesuaian konsep.'}
                            </p>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>

          <aside className="quiz-create-aside">
            <h3 className="quiz-create-aside__title">Syarat terbit</h3>
            <div className={`quiz-req ${quizQuestions.length > 0 ? 'quiz-req--ok' : 'quiz-req--bad'}`}>
              <span className="quiz-req__dot">{quizQuestions.length > 0 ? '✓' : '!'}</span>
              <span>
                {quizQuestions.length > 0
                  ? `Minimal 1 butir soal — ${quizQuestions.length} butir`
                  : 'Belum ada butir soal'}
              </span>
            </div>
            <div className={`quiz-req ${reviewCount === 0 ? 'quiz-req--ok' : 'quiz-req--bad'}`}>
              <span className="quiz-req__dot">{reviewCount === 0 ? '✓' : '!'}</span>
              <span>
                {reviewCount === 0
                  ? 'Semua soal sudah tervalidasi'
                  : `${reviewCount} soal perlu tinjau`}
              </span>
            </div>
            <div className={`quiz-req ${createForm.due_date ? 'quiz-req--ok' : 'quiz-req--bad'}`}>
              <span className="quiz-req__dot">{createForm.due_date ? '✓' : '!'}</span>
              <span>{createForm.due_date ? `Tenggat ${fmtDate(createForm.due_date)}` : 'Tenggat belum diisi'}</span>
            </div>
            <div className={`quiz-req ${createForm.selected_class_ids.length > 0 ? 'quiz-req--ok' : 'quiz-req--bad'}`}>
              <span className="quiz-req__dot">{createForm.selected_class_ids.length > 0 ? '✓' : '!'}</span>
              <span>{createForm.selected_class_ids.length} kelas target</span>
            </div>

            <div style={{ borderTop: '1px solid var(--color-border-light)', marginTop: 4, paddingTop: 8 }}>
              <div className="quiz-sum-row"><span>Judul</span><b>{currentQuiz?.title || '—'}</b></div>
              <div className="quiz-sum-row"><span>Total soal</span><b>{quizQuestions.length} · {totalPoints} poin</b></div>
              <div className="quiz-sum-row"><span>PG / Esai</span><b>{mcCount} / {essayCount}</b></div>
              <div className="quiz-sum-row quiz-sum-row--muted"><span>Status</span><b>Draft Review</b></div>
            </div>

            {isPublished ? (
              <>
                <div className="quiz-create-success">
                  <CheckCircle2 size={16} />
                  <span>Kuis sudah diterbitkan dan dapat dikerjakan siswa.</span>
                </div>
                <div className="quiz-create-actions quiz-create-actions--stack">
                  <Button variant="primary" onClick={backToList}>
                    Kembali ke daftar kuis
                  </Button>
                </div>
              </>
            ) : (
              <div className="quiz-create-actions">
                <Button variant="secondary" onClick={() => setStep(2)}>
                  ← Kembali
                </Button>
                <Button variant="primary" icon={Send} onClick={handlePublish} disabled={!canPublish}>
                  Terbitkan Kuis
                </Button>
              </div>
            )}
            {!isPublished && !canPublish && (
              <p className="quiz-create-blocked">
                {quizQuestions.length === 0
                  ? 'Tambahkan minimal satu butir soal sebelum menerbitkan.'
                  : `Selesaikan ${reviewCount} soal bertanda kuning terlebih dahulu.`}
              </p>
            )}
          </aside>
        </div>
      )}

      {/* Form soal manual */}
      {showManualForm && (
        <div className="quiz-manual-panel">
          <div className="quiz-manual-panel__head">
            <h3>Tambah Butir Soal Manual</h3>
            <button type="button" onClick={() => setShowManualForm(false)} aria-label="Tutup">
              <X size={16} />
            </button>
          </div>
          <form onSubmit={handleAddManualQuestion} className="quiz-gen-form">
            <Select
              label="Jenis Soal"
              options={[
                { value: 'multiple_choice', label: 'Pilihan Ganda' },
                { value: 'essay', label: 'Esai' },
              ]}
              value={manualForm.question_type}
              onChange={(e) => setManualForm({ ...manualForm, question_type: e.target.value })}
            />
            <div className="form-group">
              <label className="form-label">Teks Pertanyaan</label>
              <textarea
                className="quiz-textarea"
                rows={3}
                value={manualForm.question_text}
                onChange={(e) => setManualForm({ ...manualForm, question_text: e.target.value })}
                required
              />
            </div>
            {manualForm.question_type === 'multiple_choice' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Input label="Pilihan A" value={manualForm.optionA} onChange={(e) => setManualForm({ ...manualForm, optionA: e.target.value })} />
                <Input label="Pilihan B" value={manualForm.optionB} onChange={(e) => setManualForm({ ...manualForm, optionB: e.target.value })} />
                <Input label="Pilihan C" value={manualForm.optionC} onChange={(e) => setManualForm({ ...manualForm, optionC: e.target.value })} />
                <Input label="Pilihan D" value={manualForm.optionD} onChange={(e) => setManualForm({ ...manualForm, optionD: e.target.value })} />
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input
                label={manualForm.question_type === 'essay' ? 'Rubrik Penilaian' : 'Kunci Jawaban (A/B/C/D)'}
                value={manualForm.correct_answer}
                onChange={(e) => setManualForm({ ...manualForm, correct_answer: e.target.value })}
              />
              <Input
                type="number"
                label="Bobot Poin"
                value={manualForm.points}
                onChange={(e) => setManualForm({ ...manualForm, points: e.target.value })}
                min="1"
              />
            </div>
            <div className="quiz-create-actions">
              <Button variant="secondary" type="button" onClick={() => setShowManualForm(false)}>
                Batal
              </Button>
              <Button variant="primary" type="submit" icon={Plus} disabled={isSavingManual}>
                {isSavingManual ? 'Menyimpan…' : 'Simpan Butir Soal'}
              </Button>
            </div>
          </form>
        </div>
      )}

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