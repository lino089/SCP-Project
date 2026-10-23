import { useState, useEffect, useMemo } from 'react';
import {
  Plus,
  Calendar,
  Sparkles,
  FileUp,
  Edit3,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  Send,
  Users,
  Award,
  HelpCircle,
  RotateCw,
} from 'lucide-react';
import { quizApi } from '../../services/quizApi';
import masterDataApi from '../../services/masterDataApi';
import {
  Button,
  Input,
  Select,
  Badge,
  Modal,
  Table,
  Tabs,
  FileUpload,
  ConfirmDialog,
} from '../../components/shared';
import './TeacherQuiz.css';

export default function TeacherQuizPage() {
  const [quizzes, setQuizzes] = useState([]);
  const [classList, setClassList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all'); // 'all' | 'published' | 'draft_review'

  // Modals state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isGenModalOpen, setIsGenModalOpen] = useState(false);
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
  const [isSubmissionsModalOpen, setIsSubmissionsModalOpen] = useState(false);
  const [isSubmissionDetailOpen, setIsSubmissionDetailOpen] = useState(false);
  const [isEditQuestionModalOpen, setIsEditQuestionModalOpen] = useState(false);
  const [isManualQuestionModalOpen, setIsManualQuestionModalOpen] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState({ isOpen: false, title: '', message: '', onConfirm: null });

  // Selected entities
  const [currentQuiz, setCurrentQuiz] = useState(null);
  const [quizQuestions, setQuizQuestions] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [selectedSubmission, setSelectedSubmission] = useState(null);
  const [editingQuestion, setEditingQuestion] = useState(null);

  // New Quiz Form State
  const [createForm, setCreateForm] = useState({
    title: '',
    class_id: '',
    class_name: '',
    due_date: '',
    max_attempts: '2',
  });

  // Generator Method Tab: 'prompt' | 'document' | 'manual'
  const [genMethod, setGenMethod] = useState('prompt');

  // Prompt Form State (Metode 1)
  const [promptForm, setPromptForm] = useState({
    prompt: '',
    total_questions: '5',
    question_types: 'combination', // 'multiple_choice' | 'essay' | 'combination'
    mc_count: '3',
    essay_count: '2',
    difficulty: 'sedang',
    teacher_notes: '',
  });
  const [isGenerating, setIsGenerating] = useState(false);
  const [genProgressMsg, setGenProgressMsg] = useState('');

  // Document Upload State (Metode 2)
  const [uploadedDoc, setUploadedDoc] = useState(null);
  const [isExtracting, setIsExtracting] = useState(false);

  // Manual Question Form State (Metode 3)
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

  // Override Form State
  const [overrideScore, setOverrideScore] = useState('');
  const [overrideFeedback, setOverrideFeedback] = useState('');
  const [isOverriding, setIsOverriding] = useState(false);

  // Toast feedback
  const [toast, setToast] = useState({ show: false, message: '', variant: 'success' });
  const showToast = (message, variant = 'success') => {
    setToast({ show: true, message, variant });
    setTimeout(() => setToast({ show: false, message: '', variant: 'success' }), 4000);
  };

  // Fetch initial data
  useEffect(() => {
    let isMounted = true;
    async function loadData() {
      setLoading(true);
      try {
        const [quizRes, classRes] = await Promise.all([
          quizApi.getQuizzes({ per_page: 50 }),
          masterDataApi.classes.getClasses(),
        ]);
        if (isMounted) {
          if (quizRes?.data) setQuizzes(Array.isArray(quizRes.data) ? quizRes.data : []);
          if (classRes?.data) setClassList(Array.isArray(classRes.data) ? classRes.data : []);
        }
      } catch (err) {
        console.warn('Gagal memuat data kuis:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    loadData();
    return () => {
      isMounted = false;
    };
  }, []);

  // Class options for select dropdown
  const classOptions = useMemo(() => {
    if (classList.length === 0) {
      return [
        { value: '1', label: 'Kelas X-RPL-1' },
        { value: '2', label: 'Kelas X-RPL-2' },
        { value: '3', label: 'Kelas XI-RPL-1' },
      ];
    }
    return classList.map((c) => ({
      value: String(c.id),
      label: `Kelas ${c.name} (${c.level || ''})`,
    }));
  }, [classList]);

  // Tab counters
  const publishedCount = useMemo(
    () => quizzes.filter((q) => q.status === 'published' || q.status === 'published_result').length,
    [quizzes]
  );
  const draftCount = useMemo(
    () => quizzes.filter((q) => q.status === 'draft_review').length,
    [quizzes]
  );

  const tabs = [
    { id: 'all', label: 'Semua Kuis', count: quizzes.length },
    { id: 'published', label: 'Aktif Dipublikasi', count: publishedCount },
    { id: 'draft_review', label: 'Draft Siap Review', count: draftCount },
  ];

  const filteredQuizzes = useMemo(() => {
    if (activeTab === 'all') return quizzes;
    if (activeTab === 'published') {
      return quizzes.filter((q) => q.status === 'published' || q.status === 'published_result');
    }
    return quizzes.filter((q) => q.status === activeTab);
  }, [quizzes, activeTab]);

  // Validation for Prompt Form Composition
  const promptCompositionError = useMemo(() => {
    const total = parseInt(promptForm.total_questions, 10) || 0;
    const mc = parseInt(promptForm.mc_count, 10) || 0;
    const essay = parseInt(promptForm.essay_count, 10) || 0;

    if (total <= 0) return 'Total jumlah soal minimal 1.';

    if (promptForm.question_types === 'multiple_choice') {
      if (mc !== total) return `Pada jenis Pilihan Ganda, jumlah soal PG harus sama dengan total (${total}).`;
    } else if (promptForm.question_types === 'essay') {
      if (essay !== total) return `Pada jenis Esai, jumlah soal Esai harus sama dengan total (${total}).`;
    } else if (promptForm.question_types === 'combination') {
      if (mc <= 0 || essay <= 0) return 'Pada soal kombinasi, butir PG dan Esai masing-masing minimal 1.';
      if (mc + essay !== total) {
        return `Penjumlahan PG (${mc}) + Esai (${essay}) = ${mc + essay}, wajib sama persis dengan Total Soal (${total}).`;
      }
    }
    return '';
  }, [promptForm]);

  // --- HANDLERS ---

  // 1. Inisialisasi Kuis Baru
  const handleOpenCreateModal = () => {
    setCreateForm({
      title: '',
      class_id: classOptions[0]?.value || '1',
      class_name: classOptions[0]?.label?.replace('Kelas ', '') || 'X-RPL-1',
      due_date: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
      max_attempts: '2',
    });
    setIsCreateModalOpen(true);
  };

  const handleCreateQuizSubmit = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!createForm.title.trim()) {
      showToast('Judul kuis wajib diisi.', 'error');
      return;
    }
    try {
      const res = await quizApi.createQuiz(createForm);
      const quizObj = res?.data || res;
      if (quizObj && (quizObj.id || quizObj.title)) {
        setQuizzes((prev) => [quizObj, ...prev.filter((q) => q.id !== quizObj.id)]);
        setCurrentQuiz(quizObj);
        setIsCreateModalOpen(false);
        showToast('Kuis berhasil dibuat dalam status Draft Review.', 'success');
        // Langsung buka opsi generator soal
        setIsGenModalOpen(true);
      }
    } catch (err) {
      showToast(err.message || err.response?.data?.message || 'Gagal membuat kuis baru.', 'error');
    }
  };

  // 2. Generator Metode 1: Prompt AI
  const handleGeneratePromptSubmit = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (promptCompositionError) {
      showToast(promptCompositionError, 'error');
      return;
    }
    if (!promptForm.prompt.trim()) {
      showToast('Instruksi materi prompt wajib diisi.', 'error');
      return;
    }

    setIsGenerating(true);
    setGenProgressMsg('Mengirim instruksi prompt ke AI Gateway (Model: ag/gemini-3.8-flash)...');

    try {
      const payload = {
        prompt: promptForm.prompt,
        total_questions: parseInt(promptForm.total_questions, 10),
        question_types: promptForm.question_types,
        mc_count: parseInt(promptForm.mc_count, 10),
        essay_count: parseInt(promptForm.essay_count, 10),
        difficulty: promptForm.difficulty,
        additional_notes: promptForm.teacher_notes,
      };

      setGenProgressMsg('Menerima respons pemrosesan. Menyiapkan butir soal...');
      const res = await quizApi.generatePrompt(currentQuiz.id, payload);

      if (res?.status === 202 || res?.success || res?.data) {
        setGenProgressMsg('Menyusun butir soal ke dalam skema kuis...');
        // Ambil hasil butir soal
        const qRes = await quizApi.getQuizQuestions(currentQuiz.id);
        const questionsList = qRes?.data?.questions || qRes?.data || qRes?.questions || [];
        setQuizQuestions(Array.isArray(questionsList) ? questionsList : []);
        setIsGenModalOpen(false);
        setIsPreviewModalOpen(true);
        showToast('Soal kuis berhasil dihasilkan oleh AI! Silakan review sebelum dipublikasikan.', 'success');
      }
    } catch (err) {
      showToast(err.message || err.response?.data?.message || 'Gagal memproses prompt AI.', 'error');
    } finally {
      setIsGenerating(false);
      setGenProgressMsg('');
    }
  };

  // 3. Generator Metode 2: Ekstraksi Dokumen PDF/TXT
  const handleExtractDocumentSubmit = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!uploadedDoc) {
      showToast('Harap pilih berkas PDF atau TXT materi terlebih dahulu.', 'error');
      return;
    }

    setIsExtracting(true);
    try {
      const formData = new FormData();
      formData.append('document', uploadedDoc);
      formData.append('file', uploadedDoc);

      const res = await quizApi.extractDocument(currentQuiz.id, formData);
      if (res?.status === 202 || res?.success || res?.data) {
        const qRes = await quizApi.getQuizQuestions(currentQuiz.id);
        const questionsList = qRes?.data?.questions || qRes?.data || qRes?.questions || [];
        setQuizQuestions(Array.isArray(questionsList) ? questionsList : []);
        setIsGenModalOpen(false);
        setIsPreviewModalOpen(true);
        showToast('Dokumen berhasil diekstrak oleh AI! Periksa soal yang memerlukan peninjauan.', 'success');
      }
    } catch (err) {
      showToast(err.message || err.response?.data?.message || 'Gagal mengekstrak dokumen materi.', 'error');
    } finally {
      setIsExtracting(false);
    }
  };

  // 4. Generator Metode 3: Tambah Soal Manual
  const handleOpenManualQuestionModal = () => {
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
    setIsManualQuestionModalOpen(true);
  };

  const handleManualQuestionSubmit = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!manualForm.question_text.trim()) {
      showToast('Teks pertanyaan wajib diisi.', 'error');
      return;
    }

    try {
      const payload = {
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
      };

      const res = await quizApi.createQuestion(currentQuiz.id, payload);
      const newQ = res?.data || res;
      if (newQ && (newQ.id || newQ.question_text)) {
        setQuizQuestions((prev) => [...prev, newQ]);
        setIsManualQuestionModalOpen(false);
        showToast('Butir soal manual berhasil ditambahkan.', 'success');
      }
    } catch (err) {
      showToast(err.message || err.response?.data?.message || 'Gagal menambah soal manual.', 'error');
    }
  };

  // 5. Buka Preview & Kurasi Soal Kuis
  const handleOpenPreviewModal = async (quiz) => {
    setCurrentQuiz(quiz);
    try {
      const res = await quizApi.getQuizQuestions(quiz.id);
      const questionsList = res?.data?.questions || res?.data || res?.questions || [];
      setQuizQuestions(Array.isArray(questionsList) ? questionsList : []);
      setIsPreviewModalOpen(true);
    } catch (err) {
      showToast(err.message || 'Gagal memuat butir soal kuis.', 'error');
    }
  };

  // Edit Butir Soal pada Preview
  const handleStartEditQuestion = (q) => {
    let optionsArr = ['', '', '', ''];
    if (Array.isArray(q.options)) {
      optionsArr = q.options;
    } else if (q.options && typeof q.options === 'object') {
      optionsArr = [
        q.options.A || '',
        q.options.B || '',
        q.options.C || '',
        q.options.D || '',
      ];
    }
    setEditingQuestion({
      id: q.id,
      question_type: q.question_type,
      question_text: q.question_text,
      options: optionsArr,
      correct_answer: q.correct_answer,
      points: q.points || 20,
    });
    setIsEditQuestionModalOpen(true);
  };

  const handleSaveEditQuestion = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    try {
      const optionsPayload =
        editingQuestion.question_type === 'multiple_choice'
          ? Array.isArray(editingQuestion.options)
            ? {
                A: editingQuestion.options[0] || '',
                B: editingQuestion.options[1] || '',
                C: editingQuestion.options[2] || '',
                D: editingQuestion.options[3] || '',
              }
            : editingQuestion.options
          : null;

      const payload = {
        ...editingQuestion,
        options: optionsPayload,
      };

      const res = await quizApi.updateQuestion(currentQuiz.id, editingQuestion.id, payload);
      const updatedQ = res?.data || res;
      if (updatedQ && (updatedQ.id || updatedQ.question_text)) {
        setQuizQuestions((prev) =>
          prev.map((item) => (item.id === editingQuestion.id ? { ...item, ...updatedQ } : item))
        );
        setIsEditQuestionModalOpen(false);
        showToast('Butir soal berhasil diperbarui & status ambigu dibersihkan.', 'success');
      }
    } catch (err) {
      showToast(err.message || 'Gagal menyimpan perubahan butir soal.', 'error');
    }
  };

  // Hapus Butir Soal
  const handleDeleteQuestion = (qId) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Hapus Butir Soal?',
      message: 'Apakah Anda yakin ingin menghapus butir soal ini dari kuis?',
      onConfirm: async () => {
        try {
          await quizApi.deleteQuestion(currentQuiz.id, qId);
          setQuizQuestions((prev) => prev.filter((item) => item.id !== qId));
          showToast('Butir soal berhasil dihapus.', 'success');
        } catch {
          showToast('Gagal menghapus butir soal.', 'error');
        } finally {
          setConfirmDialog((c) => ({ ...c, isOpen: false }));
        }
      },
    });
  };

  // Konfirmasi Publikasikan Kuis
  const handlePublishQuiz = () => {
    if (quizQuestions.length === 0) {
      showToast('Kuis belum memiliki butir soal. Tambahkan soal sebelum mempublikasikan.', 'error');
      return;
    }
    const hasAmbiguous = quizQuestions.some((q) => q.needs_review);
    if (hasAmbiguous) {
      showToast('Terdapat butir soal ambigu bertanda kuning. Harap tinjau atau edit sebelum publikasi.', 'error');
      return;
    }

    setConfirmDialog({
      isOpen: true,
      title: 'Publikasikan Kuis ke Siswa?',
      message: `Kuis "${currentQuiz.title}" akan diterbitkan dan dapat dikerjakan oleh siswa Kelas ${currentQuiz.schoolClass?.name || 'terkait'}. Lanjutkan?`,
      onConfirm: async () => {
        try {
          const res = await quizApi.updateQuizStatus(currentQuiz.id, { status: 'published' });
          const updatedQuiz = res?.data || res;
          if (updatedQuiz) {
            setQuizzes((prev) =>
              prev.map((q) => (q.id === currentQuiz.id ? { ...q, status: 'published' } : q))
            );
            setCurrentQuiz((prev) => ({ ...prev, status: 'published' }));
            setIsPreviewModalOpen(false);
            showToast('Kuis berhasil dipublikasikan dan aktif untuk siswa!', 'success');
          }
        } catch (err) {
          showToast(err.message || err.response?.data?.message || 'Gagal mempublikasikan kuis.', 'error');
        } finally {
          setConfirmDialog((c) => ({ ...c, isOpen: false }));
        }
      },
    });
  };

  // 6. Buka Review Submissions & Override Nilai
  const handleOpenSubmissionsModal = async (quiz) => {
    setCurrentQuiz(quiz);
    try {
      const res = await quizApi.getQuizSubmissions(quiz.id);
      const subsList = res?.data || res;
      setSubmissions(Array.isArray(subsList) ? subsList : []);
      setIsSubmissionsModalOpen(true);
    } catch (err) {
      showToast(err.message || 'Gagal memuat daftar pengumpulan siswa.', 'error');
    }
  };

  const handleOpenSubmissionDetail = (sub) => {
    setSelectedSubmission(sub);
    setOverrideScore(String(sub.ai_score ?? '80'));
    setOverrideFeedback(sub.teacher_feedback || '');
    setIsSubmissionDetailOpen(true);
  };

  const handleSaveOverrideScore = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    const scoreNum = parseInt(overrideScore, 10);
    if (isNaN(scoreNum) || scoreNum < 0 || scoreNum > 100) {
      showToast('Skor override harus berupa angka antara 0 hingga 100.', 'error');
      return;
    }

    setIsOverriding(true);
    try {
      const res = await quizApi.overrideSubmission(selectedSubmission.id, {
        score: scoreNum,
        teacher_feedback: overrideFeedback,
      });
      const updatedSub = res?.data || res;
      if (updatedSub) {
        setSelectedSubmission(updatedSub);
        setSubmissions((prev) =>
          prev.map((s) => (s.id === selectedSubmission.id ? { ...s, ...updatedSub } : s))
        );
        showToast('Nilai dan umpan balik berhasil di-override oleh Guru.', 'success');
      }
    } catch (err) {
      showToast(err.message || err.response?.data?.message || 'Gagal menyimpan penyesuaian nilai.', 'error');
    } finally {
      setIsOverriding(false);
    }
  };

  // Rilis Hasil Kuis ke Siswa & Ortu
  const handleReleaseResults = () => {
    setConfirmDialog({
      isOpen: true,
      title: 'Rilis Hasil Kuis ke Siswa & Orang Tua?',
      message: 'Setelah dirilis, nilai akhir, evaluasi AI, dan catatan ulasan guru akan dapat dilihat secara langsung oleh siswa dan wali murid. Lanjutkan?',
      onConfirm: async () => {
        try {
          const res = await quizApi.updateQuizStatus(currentQuiz.id, { status: 'published_result' });
          const updatedQuiz = res?.data || res;
          if (updatedQuiz) {
            setQuizzes((prev) =>
              prev.map((q) => (q.id === currentQuiz.id ? { ...q, status: 'published_result' } : q))
            );
            setCurrentQuiz((prev) => ({ ...prev, status: 'published_result' }));
            showToast('Hasil kuis berhasil dirilis! Siswa dan Orang Tua kini dapat melihat nilai.', 'success');
          }
        } catch (err) {
          showToast(err.message || err.response?.data?.message || 'Gagal merilis hasil kuis.', 'error');
        } finally {
          setConfirmDialog((c) => ({ ...c, isOpen: false }));
        }
      },
    });
  };

  // Table Columns for Quizzes Table
  const quizColumns = [
    {
      key: 'no',
      label: 'No',
      align: 'center',
      width: '60px',
      renderCell: (row, idx) => (
        <span className="font-mono text-xs text-slate-400">
          {String(idx + 1).padStart(2, '0')}
        </span>
      ),
    },
    {
      key: 'title',
      label: 'Judul Asesmen & Mapel',
      renderCell: (row) => (
        <div className="flex flex-col">
          <span className="text-xs font-semibold text-slate-900 leading-tight">
            {row.title}
          </span>
          <span className="text-[11px] text-slate-500 mt-0.5">
            {row.subject?.name || 'Matematika'} &bull; Kode: {row.subject?.code || 'MTK'}
          </span>
        </div>
      ),
    },
    {
      key: 'class',
      label: 'Rombel Kelas',
      renderCell: (row) => (
        <Badge variant="neutral">
          Kelas <span className="font-mono font-medium">{row.schoolClass?.name || 'X-RPL-1'}</span>
        </Badge>
      ),
    },
    {
      key: 'dueDate',
      label: 'Tenggat Waktu',
      renderCell: (row) => (
        <div className="flex items-center gap-1.5 text-xs text-slate-600">
          <Calendar size={13} className="text-slate-400" />
          <span className="font-mono">{row.due_date}</span>
        </div>
      ),
    },
    {
      key: 'stats',
      label: 'Soal & Submisi',
      renderCell: (row) => (
        <div className="text-xs text-slate-600">
          <div>
            <strong className="font-mono font-semibold text-slate-800">
              {String(row.questions_count || 0).padStart(2, '0')}
            </strong>{' '}
            <span className="text-slate-500">butir soal</span>
          </div>
          <div className="text-[11px] text-slate-400">
            <span className="font-mono text-slate-700">{row.submissions_count || 0}</span> siswa mengumpulkan
          </div>
        </div>
      ),
    },
    {
      key: 'status',
      label: 'Status Kuis',
      renderCell: (row) => {
        if (row.status === 'draft_review') {
          return <Badge variant="warning">Draft Siap Review</Badge>;
        }
        if (row.status === 'published') {
          return <Badge variant="success">Aktif Dipublikasi</Badge>;
        }
        return <Badge variant="info">Hasil Dirilis</Badge>;
      },
    },
    {
      key: 'actions',
      label: 'Aksi Pengelolaan',
      align: 'right',
      renderCell: (row) => {
        if (row.status === 'draft_review') {
          return (
            <Button
              variant="secondary"
              size="sm"
              icon={Edit3}
              onClick={() => handleOpenPreviewModal(row)}
            >
              Review &amp; Edit
            </Button>
          );
        }
        return (
          <Button
            variant="secondary"
            size="sm"
            icon={Users}
            onClick={() => handleOpenSubmissionsModal(row)}
          >
            Kelola Nilai
          </Button>
        );
      },
    },
  ];

  // Table Columns for Submissions Table
  const submissionColumns = [
    {
      key: 'no',
      label: 'No',
      align: 'center',
      width: '50px',
      renderCell: (row, idx) => (
        <span className="font-mono text-xs text-slate-400">{idx + 1}</span>
      ),
    },
    {
      key: 'student',
      label: 'Nama Siswa & NIS',
      renderCell: (row) => (
        <div className="flex flex-col">
          <span className="text-xs font-semibold text-slate-900">{row.student?.name}</span>
          <span className="text-[11px] font-mono text-slate-400">NIS: {row.student?.nis_nip}</span>
        </div>
      ),
    },
    {
      key: 'attempt',
      label: 'Percobaan',
      align: 'center',
      renderCell: (row) => (
        <span className="text-xs font-mono font-medium text-slate-700">
          Ke-{row.attempt_number}
        </span>
      ),
    },
    {
      key: 'submittedAt',
      label: 'Waktu Pengumpulan',
      renderCell: (row) => (
        <span className="text-xs font-mono text-slate-600">
          {row.submitted_at ? new Date(row.submitted_at).toLocaleDateString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '-'}
        </span>
      ),
    },
    {
      key: 'grading',
      label: 'Status Penilaian',
      renderCell: (row) => (
        row.grading_status === 'graded' ? (
          <Badge variant="success">Terkoreksi AI</Badge>
        ) : (
          <Badge variant="warning">Antrean Koreksi</Badge>
        )
      ),
    },
    {
      key: 'score',
      label: 'Skor Akhir',
      align: 'center',
      renderCell: (row) => (
        <div className="flex items-center justify-center gap-1.5">
          <span className="text-sm font-mono font-bold text-slate-900">
            {row.ai_score ?? '-'}
          </span>
          {row.is_overridden && (
            <Badge variant="warning" title="Skor telah disesuaikan oleh Guru">
              Override
            </Badge>
          )}
        </div>
      ),
    },
    {
      key: 'action',
      label: 'Aksi',
      align: 'right',
      renderCell: (row) => (
        <Button
          variant="secondary"
          size="sm"
          onClick={() => handleOpenSubmissionDetail(row)}
        >
          Periksa Jawaban
        </Button>
      ),
    },
  ];

  return (
    <div className="teacher-quiz-page">
      {/* Toast Notification */}
      {toast.show && (
        <div className={`quiz-toast quiz-toast--${toast.variant}`}>
          <span>{toast.message}</span>
        </div>
      )}

      {/* Header Halaman */}
      <div className="teacher-quiz-header">
        <div>
          <h1 className="teacher-quiz-title">Manajemen Kuis AI</h1>
          <p className="teacher-quiz-subtitle">
            Buat asesmen formatif berbantuan AI (prompt &amp; ekstraksi PDF), kurasi butir soal, serta review koreksi semantik siswa.
          </p>
        </div>
        <div>
          <Button variant="primary" icon={Plus} onClick={handleOpenCreateModal}>
            Buat Kuis Baru (AI)
          </Button>
        </div>
      </div>

      {/* Tabs Filter */}
      <div className="teacher-quiz-tabs">
        <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />
      </div>

      {/* Tabel Kuis */}
      <div className="teacher-quiz-table-wrap">
        <Table
          columns={quizColumns}
          data={filteredQuizzes}
          isLoading={loading}
          pageSize={10}
          emptyMessage="Tidak ada data kuis ditemukan pada tab filter ini."
        />
      </div>

      {/* =========================================================================
          MODAL 1: Inisialisasi Kuis Baru
         ========================================================================= */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Inisialisasi Kuis Baru"
        maxWidth="max-w-lg"
      >
        <form onSubmit={handleCreateQuizSubmit} className="quiz-modal-form">
          <Input
            label="Judul Kuis / Asesmen"
            placeholder="Contoh: Kuis Logika Algoritma & Struktur Data"
            value={createForm.title}
            onChange={(e) => setCreateForm({ ...createForm, title: e.target.value })}
            required
          />

          <Select
            label="Target Rombel Kelas"
            options={classOptions}
            value={createForm.class_id}
            onChange={(e) => {
              const selectedOpt = classOptions.find((c) => c.value === e.target.value);
              setCreateForm({
                ...createForm,
                class_id: e.target.value,
                class_name: selectedOpt?.label?.replace('Kelas ', '') || 'X-RPL-1',
              });
            }}
          />

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

          <div className="quiz-modal-hint">
            <HelpCircle size={14} className="text-slate-400 flex-shrink-0" />
            <span>Kuis akan diinisialisasi dalam status <strong>Draft Review</strong> sebelum butir soal di-generate oleh AI.</span>
          </div>

          <div className="quiz-modal-actions">
            <Button variant="secondary" onClick={() => setIsCreateModalOpen(false)}>
              Batal
            </Button>
            <Button type="submit" variant="primary" onClick={handleCreateQuizSubmit}>
              Lanjut Pilih Metode Soal
            </Button>
          </div>
        </form>
      </Modal>

      {/* =========================================================================
          MODAL 2: Tiga Metode Pembuatan Soal (Prompt AI, Ekstraksi Dokumen, Manual)
         ========================================================================= */}
      <Modal
        isOpen={isGenModalOpen}
        onClose={() => !isGenerating && !isExtracting && setIsGenModalOpen(false)}
        title={`Pilih Metode Pembuatan Soal: ${currentQuiz?.title || ''}`}
        maxWidth="max-w-2xl"
      >
        <div className="gen-methods-wrapper">
          {/* Method Selector Tabs */}
          <div className="gen-nav-tabs">
            <button
              type="button"
              className={`gen-nav-btn ${genMethod === 'prompt' ? 'gen-nav-btn--active' : ''}`}
              onClick={() => setGenMethod('prompt')}
            >
              <Sparkles size={16} />
              <span>Metode 1: Prompt AI</span>
            </button>
            <button
              type="button"
              className={`gen-nav-btn ${genMethod === 'document' ? 'gen-nav-btn--active' : ''}`}
              onClick={() => setGenMethod('document')}
            >
              <FileUp size={16} />
              <span>Metode 2: Ekstraksi Dokumen (PDF/TXT)</span>
            </button>
            <button
              type="button"
              className={`gen-nav-btn ${genMethod === 'manual' ? 'gen-nav-btn--active' : ''}`}
              onClick={() => setGenMethod('manual')}
            >
              <Edit3 size={16} />
              <span>Metode 3: Input Manual</span>
            </button>
          </div>

          {/* METODE 1: FORM PROMPT AI */}
          {genMethod === 'prompt' && (
            <form onSubmit={handleGeneratePromptSubmit} className="quiz-gen-form">
              <div className="form-group">
                <label className="form-label">Instruksi Materi &amp; Topik Pembelajaran</label>
                <textarea
                  className="quiz-textarea"
                  rows={3}
                  placeholder="Contoh: Buatkan soal evaluasi mengenai konsep Object Oriented Programming (OOP), konsep inheritance, polymorphism, dan enkapsulasi pada Java/C#."
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
                    { value: 'combination', label: 'Kombinasi (Pilihan Ganda & Esai)' },
                    { value: 'multiple_choice', label: 'Hanya Pilihan Ganda (PG)' },
                    { value: 'essay', label: 'Hanya Esai' },
                  ]}
                  value={promptForm.question_types}
                  onChange={(e) => setPromptForm({ ...promptForm, question_types: e.target.value })}
                  disabled={isGenerating}
                />
              </div>

              {/* Strict Composition Configuration */}
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
                  {promptCompositionError && (
                    <div className="composition-alert">
                      <AlertTriangle size={14} className="text-amber-600 flex-shrink-0" />
                      <span>{promptCompositionError}</span>
                    </div>
                  )}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Select
                  label="Tingkat Kesulitan"
                  options={[
                    { value: 'mudah', label: 'Mudah (Dasar Pemahaman)' },
                    { value: 'sedang', label: 'Sedang (Aplikasi & Analisis)' },
                    { value: 'sulit', label: 'Sulit (HOTS & Penalaran Kritis)' },
                  ]}
                  value={promptForm.difficulty}
                  onChange={(e) => setPromptForm({ ...promptForm, difficulty: e.target.value })}
                  disabled={isGenerating}
                />
                <Input
                  label="Catatan Khusus Guru (Opsional)"
                  placeholder="Misal: Sertakan potongan kode program"
                  value={promptForm.teacher_notes}
                  onChange={(e) => setPromptForm({ ...promptForm, teacher_notes: e.target.value })}
                  disabled={isGenerating}
                />
              </div>

              {isGenerating ? (
                <div className="gen-loading-state">
                  <RotateCw size={24} className="animate-spin text-slate-800" />
                  <p className="text-sm font-medium text-slate-800 mt-2">{genProgressMsg}</p>
                  <p className="text-xs text-slate-400">Proses asinkron queue worker berjalan (estimasi 5–15 detik)...</p>
                </div>
              ) : (
                <div className="quiz-modal-actions">
                  <Button variant="secondary" onClick={() => setIsGenModalOpen(false)}>
                    Tutup
                  </Button>
                  <Button
                    type="submit"
                    variant="primary"
                    icon={Sparkles}
                    disabled={Boolean(promptCompositionError)}
                  >
                    Generate Soal AI Sekarang
                  </Button>
                </div>
              )}
            </form>
          )}

          {/* METODE 2: FORM EKSTRAKSI DOKUMEN (PDF/TXT) */}
          {genMethod === 'document' && (
            <form onSubmit={handleExtractDocumentSubmit} className="quiz-gen-form">
              <div className="doc-instruction-box">
                <h4 className="text-xs font-semibold text-slate-800 uppercase tracking-wider mb-1">
                  Prinsip Pelestarian Konten Asli
                </h4>
                <p className="text-xs text-slate-600 leading-relaxed">
                  AI akan mengekstrak soal yang sudah ada di dokumen modul/ujian, <strong>bukan mengarang soal baru</strong>.
                  Jika terdapat bagian teks buram atau kunci jawaban ambigu, AI akan menandai butir soal dengan bendera <strong>needs_review</strong> pada tahap preview.
                </p>
              </div>

              <FileUpload
                label="Unggah Berkas Modul / Soal Ujian"
                accept=".pdf,.txt"
                maxSizeMB={5}
                file={uploadedDoc}
                onChange={setUploadedDoc}
                hint="Mendukung dokumen .PDF atau .TXT (Maksimal 5MB)"
                disabled={isExtracting}
              />

              {isExtracting ? (
                <div className="gen-loading-state">
                  <RotateCw size={24} className="animate-spin text-slate-800" />
                  <p className="text-sm font-medium text-slate-800 mt-2">
                    Mengekstrak dokumen PDF dan memetakan butir soal via AI...
                  </p>
                  <p className="text-xs text-slate-400">Menghasilkan draf soal berstatus draft_review...</p>
                </div>
              ) : (
                <div className="quiz-modal-actions">
                  <Button variant="secondary" onClick={() => setIsGenModalOpen(false)}>
                    Tutup
                  </Button>
                  <Button
                    type="submit"
                    variant="primary"
                    icon={FileUp}
                    disabled={!uploadedDoc}
                  >
                    Ekstrak Dokumen ke Soal Kuis
                  </Button>
                </div>
              )}
            </form>
          )}

          {/* METODE 3: MANUAL INPUT */}
          {genMethod === 'manual' && (
            <div className="manual-method-intro">
              <p className="text-xs text-slate-600 mb-3">
                Tambahkan butir soal satu per satu secara langsung ke dalam kuis. Soal manual disimpan dengan skema data identik dengan hasil AI.
              </p>
              <Button variant="primary" icon={Plus} onClick={handleOpenManualQuestionModal}>
                Buka Form Tambah Butir Soal Manual
              </Button>
            </div>
          )}
        </div>
      </Modal>

      {/* =========================================================================
          MODAL 3: Tahap Preview & Kurasi Butir Soal (draft_review)
         ========================================================================= */}
      <Modal
        isOpen={isPreviewModalOpen}
        onClose={() => setIsPreviewModalOpen(false)}
        title={`Preview & Kurasi Soal: ${currentQuiz?.title || ''}`}
        maxWidth="max-w-4xl"
      >
        <div className="preview-container">
          {/* Metadata Bar */}
          <div className="preview-meta-bar">
            <div>
              <span className="text-xs text-slate-400">Target Rombel:</span>
              <p className="text-xs font-semibold text-slate-800 font-mono">
                {currentQuiz?.schoolClass?.name || 'X-RPL-1'}
              </p>
            </div>
            <div>
              <span className="text-xs text-slate-400">Tenggat Waktu:</span>
              <p className="text-xs font-semibold text-slate-800 font-mono">
                {currentQuiz?.due_date}
              </p>
            </div>
            <div>
              <span className="text-xs text-slate-400">Total Butir Soal:</span>
              <p className="text-xs font-semibold text-slate-800 font-mono">
                {quizQuestions.length} Soal
              </p>
            </div>
            <div>
              <Button
                variant="outline"
                size="sm"
                icon={Plus}
                onClick={handleOpenManualQuestionModal}
              >
                Tambah Soal Manual
              </Button>
            </div>
          </div>

          {/* Question List */}
          {quizQuestions.length === 0 ? (
            <div className="preview-empty">
              <HelpCircle size={32} className="text-slate-300 mb-2" />
              <p className="text-sm font-semibold text-slate-700">Belum ada butir soal dalam kuis ini.</p>
              <p className="text-xs text-slate-400">Gunakan generator Prompt AI, ekstraksi dokumen, atau tambah soal manual.</p>
            </div>
          ) : (
            <div className="preview-questions-list">
              {quizQuestions.map((q, idx) => (
                <div
                  key={q.id}
                  className={`question-card ${q.needs_review ? 'question-card--ambiguous' : ''}`}
                >
                  <div className="question-card-head">
                    <div className="flex items-center gap-2">
                      <span className="question-number">Soal #{idx + 1}</span>
                      <Badge variant={q.question_type === 'multiple_choice' ? 'default' : 'warning'}>
                        {q.question_type === 'multiple_choice' ? 'Pilihan Ganda' : 'Esai (AI Graded)'}
                      </Badge>
                      <span className="text-[11px] font-mono text-slate-500">Bobot: {q.points || 20} poin</span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        className="q-action-btn"
                        onClick={() => handleStartEditQuestion(q)}
                        title="Edit butir soal"
                      >
                        <Edit3 size={14} />
                      </button>
                      <button
                        type="button"
                        className="q-action-btn q-action-btn--danger"
                        onClick={() => handleDeleteQuestion(q.id)}
                        title="Hapus butir soal"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>

                  {/* Ambiguity Alert Box */}
                  {q.needs_review && (
                    <div className="ambiguity-alert-box">
                      <AlertTriangle size={15} className="text-amber-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <strong className="text-xs font-semibold text-amber-900 block">
                          Perlu Verifikasi Guru (Soal Ambigu)
                        </strong>
                        <p className="text-xs text-amber-800 mt-0.5">
                          {q.review_note || 'Bagian teks atau kunci jawaban terdeteksi belum tervalidasi penuh dari sumber dokumen.'}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Question Text */}
                  <p className="question-text">{q.question_text}</p>

                  {/* Options (for Multiple Choice) */}
                  {q.question_type === 'multiple_choice' && q.options && (
                    <div className="options-grid">
                      {Array.isArray(q.options)
                        ? q.options.map((opt, optIdx) => {
                            const optLetter = ['A', 'B', 'C', 'D'][optIdx] || String(optIdx);
                            const isCorrect = q.correct_answer === optLetter;
                            return (
                              <div
                                key={optIdx}
                                className={`option-item ${isCorrect ? 'option-item--correct' : ''}`}
                              >
                                <span className="option-letter">{optLetter}.</span>
                                <span className="option-label">{opt}</span>
                                {isCorrect && (
                                  <span className="option-correct-badge">Kunci Jawaban</span>
                                )}
                              </div>
                            );
                          })
                        : Object.entries(q.options).map(([optLetter, optText]) => {
                            const isCorrect = q.correct_answer === optLetter;
                            return (
                              <div
                                key={optLetter}
                                className={`option-item ${isCorrect ? 'option-item--correct' : ''}`}
                              >
                                <span className="option-letter">{optLetter}.</span>
                                <span className="option-label">{optText}</span>
                                {isCorrect && (
                                  <span className="option-correct-badge">Kunci Jawaban</span>
                                )}
                              </div>
                            );
                          })}
                    </div>
                  )}

                  {/* Rubric (for Essay) */}
                  {q.question_type === 'essay' && (
                    <div className="essay-rubric-box">
                      <span className="text-[11px] font-semibold text-slate-700 block mb-0.5">
                        Rubrik Penilaian Semantik AI:
                      </span>
                      <p className="text-xs text-slate-600 italic">
                        {q.correct_answer || 'Evaluasi kata kunci kesesuaian konsep materi.'}
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Action Footer */}
          <div className="preview-actions-footer">
            <Button variant="secondary" onClick={() => setIsPreviewModalOpen(false)}>
              Tutup Preview
            </Button>
            <Button
              variant="primary"
              icon={Send}
              onClick={handlePublishQuiz}
              disabled={quizQuestions.length === 0}
            >
              Konfirmasi &amp; Publikasikan Kuis
            </Button>
          </div>
        </div>
      </Modal>

      {/* =========================================================================
          MODAL 4: Form Edit Butir Soal pada Preview
         ========================================================================= */}
      {editingQuestion && (
        <Modal
          isOpen={isEditQuestionModalOpen}
          onClose={() => setIsEditQuestionModalOpen(false)}
          title={`Edit Butir Soal (#${editingQuestion.id})`}
          maxWidth="max-w-lg"
        >
          <form onSubmit={handleSaveEditQuestion} className="quiz-modal-form">
            <div className="form-group">
              <label className="form-label">Teks Pertanyaan</label>
              <textarea
                className="quiz-textarea"
                rows={3}
                value={editingQuestion.question_text}
                onChange={(e) => setEditingQuestion({ ...editingQuestion, question_text: e.target.value })}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Select
                label="Jenis Soal"
                options={[
                  { value: 'multiple_choice', label: 'Pilihan Ganda' },
                  { value: 'essay', label: 'Esai' },
                ]}
                value={editingQuestion.question_type}
                onChange={(e) => setEditingQuestion({ ...editingQuestion, question_type: e.target.value })}
              />
              <Input
                type="number"
                label="Bobot Poin"
                value={editingQuestion.points}
                onChange={(e) => setEditingQuestion({ ...editingQuestion, points: e.target.value })}
                min="5"
                max="100"
              />
            </div>

            {editingQuestion.question_type === 'multiple_choice' ? (
              <div className="space-y-2">
                <label className="form-label">Opsi Jawaban A, B, C, D</label>
                {['A', 'B', 'C', 'D'].map((letter, idx) => (
                  <Input
                    key={letter}
                    label={`Opsi ${letter}`}
                    value={editingQuestion.options?.[idx] || ''}
                    onChange={(e) => {
                      const newOpts = [...(editingQuestion.options || ['', '', '', ''])];
                      newOpts[idx] = e.target.value;
                      setEditingQuestion({ ...editingQuestion, options: newOpts });
                    }}
                    required
                  />
                ))}

                <Select
                  label="Kunci Jawaban Benar"
                  options={[
                    { value: 'A', label: 'Opsi A' },
                    { value: 'B', label: 'Opsi B' },
                    { value: 'C', label: 'Opsi C' },
                    { value: 'D', label: 'Opsi D' },
                  ]}
                  value={editingQuestion.correct_answer}
                  onChange={(e) => setEditingQuestion({ ...editingQuestion, correct_answer: e.target.value })}
                />
              </div>
            ) : (
              <div className="form-group">
                <label className="form-label">Rubrik Penilaian Kata Kunci (Esai)</label>
                <textarea
                  className="quiz-textarea"
                  rows={3}
                  value={editingQuestion.correct_answer}
                  onChange={(e) => setEditingQuestion({ ...editingQuestion, correct_answer: e.target.value })}
                  placeholder="Kriteria jawaban yang diharapkan dan poin kata kunci utama..."
                  required
                />
              </div>
            )}

            <div className="quiz-modal-actions">
              <Button variant="secondary" onClick={() => setIsEditQuestionModalOpen(false)}>
                Batal
              </Button>
              <Button type="submit" variant="primary">
                Simpan Perubahan
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* =========================================================================
          MODAL 5: Form Tambah Butir Soal Manual Ad-Hoc
         ========================================================================= */}
      <Modal
        isOpen={isManualQuestionModalOpen}
        onClose={() => setIsManualQuestionModalOpen(false)}
        title="Tambah Butir Soal Manual"
        maxWidth="max-w-lg"
      >
        <form onSubmit={handleManualQuestionSubmit} className="quiz-modal-form">
          <div className="grid grid-cols-2 gap-3">
            <Select
              label="Jenis Soal"
              options={[
                { value: 'multiple_choice', label: 'Pilihan Ganda' },
                { value: 'essay', label: 'Esai' },
              ]}
              value={manualForm.question_type}
              onChange={(e) => setManualForm({ ...manualForm, question_type: e.target.value })}
            />
            <Input
              type="number"
              label="Bobot Poin"
              value={manualForm.points}
              onChange={(e) => setManualForm({ ...manualForm, points: e.target.value })}
              min="5"
              max="100"
            />
          </div>

          <div className="form-group">
            <label className="form-label">Teks Pertanyaan</label>
            <textarea
              className="quiz-textarea"
              rows={3}
              placeholder="Ketikkan butir pertanyaan di sini..."
              value={manualForm.question_text}
              onChange={(e) => setManualForm({ ...manualForm, question_text: e.target.value })}
              required
            />
          </div>

          {manualForm.question_type === 'multiple_choice' ? (
            <div className="space-y-2">
              <Input
                label="Opsi A"
                value={manualForm.optionA}
                onChange={(e) => setManualForm({ ...manualForm, optionA: e.target.value })}
                required
              />
              <Input
                label="Opsi B"
                value={manualForm.optionB}
                onChange={(e) => setManualForm({ ...manualForm, optionB: e.target.value })}
                required
              />
              <Input
                label="Opsi C"
                value={manualForm.optionC}
                onChange={(e) => setManualForm({ ...manualForm, optionC: e.target.value })}
                required
              />
              <Input
                label="Opsi D"
                value={manualForm.optionD}
                onChange={(e) => setManualForm({ ...manualForm, optionD: e.target.value })}
                required
              />
              <Select
                label="Kunci Jawaban"
                options={[
                  { value: 'A', label: 'Opsi A' },
                  { value: 'B', label: 'Opsi B' },
                  { value: 'C', label: 'Opsi C' },
                  { value: 'D', label: 'Opsi D' },
                ]}
                value={manualForm.correct_answer}
                onChange={(e) => setManualForm({ ...manualForm, correct_answer: e.target.value })}
              />
            </div>
          ) : (
            <div className="form-group">
              <label className="form-label">Rubrik Penilaian Kata Kunci (Esai)</label>
              <textarea
                className="quiz-textarea"
                rows={3}
                placeholder="Pedoman penilaian bagi AI untuk memeriksa jawaban siswa..."
                value={manualForm.correct_answer}
                onChange={(e) => setManualForm({ ...manualForm, correct_answer: e.target.value })}
                required
              />
            </div>
          )}

          <div className="quiz-modal-actions">
            <Button variant="secondary" onClick={() => setIsManualQuestionModalOpen(false)}>
              Batal
            </Button>
            <Button type="submit" variant="primary">
              Tambahkan ke Kuis
            </Button>
          </div>
        </form>
      </Modal>

      {/* =========================================================================
          MODAL 6: Daftar Submissions Pengumpulan Siswa
         ========================================================================= */}
      <Modal
        isOpen={isSubmissionsModalOpen}
        onClose={() => setIsSubmissionsModalOpen(false)}
        title={`Review Submisi Siswa: ${currentQuiz?.title || ''}`}
        maxWidth="max-w-4xl"
      >
        <div className="submissions-wrapper">
          <div className="submissions-top-bar">
            <div>
              <p className="text-xs text-slate-500">
                Target Kelas: <strong className="font-mono text-slate-800">{currentQuiz?.schoolClass?.name || 'X-RPL-1'}</strong> &bull; Batas Percobaan: <strong className="font-mono text-slate-800">{currentQuiz?.max_attempts}x</strong>
              </p>
            </div>
            <div>
              {currentQuiz?.status === 'published' ? (
                <Button variant="primary" size="sm" icon={CheckCircle2} onClick={handleReleaseResults}>
                  Rilis Hasil Kuis ke Siswa &amp; Ortu
                </Button>
              ) : (
                <Badge variant="success">Hasil Kuis Telah Dirilis Resmi</Badge>
              )}
            </div>
          </div>

          <Table
            columns={submissionColumns}
            data={submissions}
            pageSize={10}
            emptyMessage="Belum ada siswa yang mengumpulkan jawaban kuis ini."
          />
        </div>
      </Modal>

      {/* =========================================================================
          MODAL 7: Detail Lembar Jawaban Siswa & Form Override Nilai Guru
         ========================================================================= */}
      {selectedSubmission && (
        <Modal
          isOpen={isSubmissionDetailOpen}
          onClose={() => setIsSubmissionDetailOpen(false)}
          title={`Detail Lembar Jawaban: ${selectedSubmission.student?.name || 'Siswa'}`}
          maxWidth="max-w-3xl"
        >
          <div className="sub-detail-wrapper">
            {/* Student Header Summary */}
            <div className="sub-detail-header">
              <div>
                <h3 className="text-sm font-bold text-slate-900">{selectedSubmission.student?.name}</h3>
                <p className="text-xs text-slate-500 font-mono">
                  NIS: {selectedSubmission.student?.nis_nip} &bull; Percobaan ke-{selectedSubmission.attempt_number}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <div className="text-right">
                  <span className="text-[11px] text-slate-400 block">Skor Akhir</span>
                  <span className="text-lg font-mono font-bold text-slate-900">
                    {selectedSubmission.ai_score ?? '-'}
                  </span>
                </div>
                {selectedSubmission.is_overridden && (
                  <Badge variant="warning">Telah di-override oleh Guru</Badge>
                )}
              </div>
            </div>

            {/* Answer Review Items */}
            <div className="sub-answers-list">
              {selectedSubmission.answers && selectedSubmission.answers.length > 0 ? (
                selectedSubmission.answers.map((ans, idx) => (
                  <div key={idx} className="answer-review-card">
                    <div className="answer-review-head">
                      <span className="text-xs font-semibold text-slate-800">
                        Soal #{idx + 1} ({ans.question_type === 'essay' ? 'Esai' : 'Pilihan Ganda'})
                      </span>
                      <Badge variant={ans.is_correct ? 'success' : 'error'}>
                        {ans.is_correct ? 'Benar / Sesuai' : 'Kurang Tepat'} &bull; {ans.points_awarded || 0} poin
                      </Badge>
                    </div>

                    <p className="text-xs text-slate-800 font-medium my-1">{ans.question_text}</p>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 my-2 text-xs">
                      <div className="bg-slate-50 p-2 rounded border border-slate-200">
                        <span className="text-[11px] font-semibold text-slate-500 block">Jawaban Siswa:</span>
                        <p className="text-slate-800 font-mono mt-0.5">{ans.student_answer}</p>
                      </div>
                      <div className="bg-emerald-50 p-2 rounded border border-emerald-200">
                        <span className="text-[11px] font-semibold text-emerald-700 block">Kunci / Rubrik:</span>
                        <p className="text-emerald-900 font-mono mt-0.5">{ans.correct_answer}</p>
                      </div>
                    </div>

                    {ans.ai_feedback && (
                      <div className="bg-blue-50 p-2 rounded border border-blue-200 text-xs text-blue-900 mt-1">
                        <span className="font-semibold block text-[11px] text-blue-700">Analisis Semantik AI:</span>
                        <p className="mt-0.5">{ans.ai_feedback}</p>
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <div className="p-4 text-center text-xs text-slate-400">
                  Rincian jawaban otomatis terakumulasi dalam skor sistem.
                </div>
              )}
            </div>

            {/* TEACHER OVERRIDE FORM */}
            <form onSubmit={handleSaveOverrideScore} className="override-box">
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Award size={14} className="text-amber-500" />
                <span>Override Nilai &amp; Catatan Guru</span>
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <Input
                  type="number"
                  label="Penyesuaian Skor (0-100)"
                  min="0"
                  max="100"
                  value={overrideScore}
                  onChange={(e) => setOverrideScore(e.target.value)}
                  required
                />
                <div className="sm:col-span-2">
                  <Input
                    label="Umpan Balik Guru (Feedback)"
                    placeholder="Umpan balik personal dari guru untuk siswa..."
                    value={overrideFeedback}
                    onChange={(e) => setOverrideFeedback(e.target.value)}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 mt-3">
                <Button variant="secondary" onClick={() => setIsSubmissionDetailOpen(false)}>
                  Tutup
                </Button>
                <Button type="submit" variant="primary" disabled={isOverriding}>
                  {isOverriding ? 'Menyimpan...' : 'Simpan Penyesuaian Nilai'}
                </Button>
              </div>
            </form>
          </div>
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
