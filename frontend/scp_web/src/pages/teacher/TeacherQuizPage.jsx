import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus,
  Sparkles,
  FileUp,
  Edit3,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Send,
  Users,
  Award,
  HelpCircle,
  RotateCw,
} from 'lucide-react';
import { quizApi } from '../../services/quizApi';
import masterDataApi from '../../services/masterDataApi';
import { todayLocalISO } from '../../utils/dateUtils';
import { formatDate } from '../../utils/formatters';
import {
  Button,
  Input,
  Select,
  Badge,
  Modal,
  Table,
  Tabs,
  ConfirmDialog,
} from '../../components/shared';
import './TeacherQuiz.css';

export default function TeacherQuizPage() {
  const navigate = useNavigate();
  const [quizzes, setQuizzes] = useState([]);
  const [classList, setClassList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all'); // 'all' | 'published' | 'draft_review'

  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
  const [isSubmissionsModalOpen, setIsSubmissionsModalOpen] = useState(false);
  const [isSubmissionDetailOpen, setIsSubmissionDetailOpen] = useState(false);
  const [isEditQuestionModalOpen, setIsEditQuestionModalOpen] = useState(false);
  const [isManualQuestionModalOpen, setIsManualQuestionModalOpen] = useState(false);
  const [isEditQuizModalOpen, setIsEditQuizModalOpen] = useState(false);
  const [editingQuiz, setEditingQuiz] = useState(null);
  const [editQuizForm, setEditQuizForm] = useState({
    title: '',
    class_id: '',
    due_date: '',
    max_attempts: '2',
  });
  const [isSavingEditQuiz, setIsSavingEditQuiz] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState({ isOpen: false, title: '', message: '', onConfirm: null });

  // Selected entities
  const [currentQuiz, setCurrentQuiz] = useState(null);
  const [quizQuestions, setQuizQuestions] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [selectedSubmission, setSelectedSubmission] = useState(null);
  const [editingQuestion, setEditingQuestion] = useState(null);





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

  const [loadError, setLoadError] = useState(null);

  // Fetch initial data dari API database riil (hanya memuat kelas yang diajar guru)
  const loadData = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [quizRes, classRes] = await Promise.all([
        quizApi.getQuizzes({ per_page: 50 }),
        masterDataApi.classes.getClasses({ my_taught_only: 1, all: 1 }),
      ]);
      if (quizRes?.data) setQuizzes(Array.isArray(quizRes.data) ? quizRes.data : []);
      if (classRes?.data) setClassList(Array.isArray(classRes.data) ? classRes.data : []);
    } catch (err) {
      console.warn('Gagal memuat data kuis:', err);
      setLoadError(err.message || 'Gagal memuat data kuis atau daftar kelas.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Class options for select dropdown
  const classOptions = useMemo(() => {
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

  // --- HANDLERS ---

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
    let opts = q.options;
    if (typeof opts === 'string') {
      try {
        opts = JSON.parse(opts);
      } catch {
        opts = null;
      }
    }
    if (Array.isArray(opts)) {
      optionsArr = [opts[0] || '', opts[1] || '', opts[2] || '', opts[3] || ''];
    } else if (opts && typeof opts === 'object') {
      optionsArr = [
        opts.A || '',
        opts.B || '',
        opts.C || '',
        opts.D || '',
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

  // Konfirmasi Publikasikan Kuis (dengan duplikasi paralel jika dipilih)
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

    const otherClassIds = (currentQuiz?.target_class_ids || []).filter(
      (cid) => Number(cid) !== Number(currentQuiz.class_id)
    );

    const targetNames = classList
      .filter((c) => (currentQuiz?.target_class_ids || [currentQuiz.class_id]).map(Number).includes(Number(c.id)))
      .map((c) => c.name)
      .join(', ') || currentQuiz.schoolClass?.name || 'terkait';

    setConfirmDialog({
      isOpen: true,
      title: 'Publikasikan Kuis ke Siswa?',
      message: otherClassIds.length > 0
        ? `Kuis "${currentQuiz.title}" akan diterbitkan secara paralel ke kelas: ${targetNames}. Seluruh butir soal akan otomatis disinkronkan ke masing-masing kelas. Lanjutkan?`
        : `Kuis "${currentQuiz.title}" akan diterbitkan dan dapat dikerjakan oleh siswa Kelas ${currentQuiz.schoolClass?.name || 'terkait'}. Lanjutkan?`,
      onConfirm: async () => {
        try {
          const res = await quizApi.updateQuizStatus(currentQuiz.id, {
            status: 'published',
            duplicate_to_class_ids: otherClassIds,
          });
          const updatedQuiz = res?.data || res;
          if (updatedQuiz) {
            await loadData();
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

  // Batalkan & Hapus Kuis Permanen (Keputusan 1: Alt C & Keputusan 2: Alt A)
  const handleDeleteQuiz = (quiz) => {
    const subCount = Number(quiz.submissions_count || 0);
    const confirmMessage = subCount > 0
      ? `Perhatian: Sudah terdapat ${subCount} siswa yang mengumpulkan jawaban pada kuis "${quiz.title}". Membatalkan kuis akan menghapus seluruh data kuis beserta lembar jawaban siswa secara permanen. Apakah Anda yakin ingin menghapus kuis ini?`
      : `Kuis "${quiz.title}" akan dibatalkan dan dihapus secara permanen dari sistem. Tindakan ini tidak dapat dibatalkan. Lanjutkan?`;

    setConfirmDialog({
      isOpen: true,
      title: 'Batalkan & Hapus Kuis?',
      message: confirmMessage,
      onConfirm: async () => {
        try {
          await quizApi.deleteQuiz(quiz.id);
          showToast(`Kuis "${quiz.title}" berhasil dibatalkan dan dihapus.`, 'success');
          loadData();
        } catch (err) {
          showToast(err.message || err.response?.data?.message || 'Gagal menghapus kuis.', 'error');
        } finally {
          setConfirmDialog((c) => ({ ...c, isOpen: false }));
        }
      },
    });
  };

  // 6. Edit Kuis (Metadata, Rombel Kelas, & Tenggat Waktu)
  const handleOpenEditQuizModal = (quiz) => {
    setEditingQuiz(quiz);
    let formattedDueDate = '';
    if (quiz.due_date) {
      try {
        const d = new Date(quiz.due_date);
        if (!isNaN(d.getTime())) {
          const pad = (n) => String(n).padStart(2, '0');
          formattedDueDate = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
        }
      } catch {
        formattedDueDate = '';
      }
    }
    setEditQuizForm({
      title: quiz.title || '',
      class_id: String(quiz.class_id || quiz.school_class?.id || quiz.schoolClass?.id || ''),
      due_date: formattedDueDate,
      max_attempts: String(quiz.max_attempts || '2'),
    });
    setIsEditQuizModalOpen(true);
  };

  const handleSaveEditQuizSubmit = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!editQuizForm.title.trim()) {
      showToast('Judul kuis wajib diisi.', 'error');
      return;
    }
    if (!editQuizForm.due_date) {
      showToast('Tenggat waktu pengerjaan wajib diisi.', 'error');
      return;
    }

    setIsSavingEditQuiz(true);
    try {
      const payload = {
        title: editQuizForm.title.trim(),
        class_id: editQuizForm.class_id ? Number(editQuizForm.class_id) : undefined,
        due_date: new Date(editQuizForm.due_date).toISOString(),
        max_attempts: Number(editQuizForm.max_attempts) || 1,
      };

      const res = await quizApi.updateQuiz(editingQuiz.id, payload);
      const updatedData = res?.data || res;

      setQuizzes((prev) =>
        prev.map((q) => (q.id === editingQuiz.id ? { ...q, ...updatedData } : q))
      );
      setIsEditQuizModalOpen(false);
      showToast('Data kuis berhasil diperbarui.', 'success');
      loadData();
    } catch (err) {
      showToast(err.message || err.response?.data?.message || 'Gagal memperbarui kuis.', 'error');
    } finally {
      setIsSavingEditQuiz(false);
    }
  };

  // 7. Buka Review Submissions & Override Nilai
  const handleOpenSubmissionsModal = async (quiz) => {
    setCurrentQuiz(quiz);
    try {
      const res = await quizApi.getQuizSubmissions(quiz.id);
      const subsList = res?.data?.submissions || res?.data || (Array.isArray(res) ? res : []);
      setSubmissions(Array.isArray(subsList) ? subsList : []);
      setIsSubmissionsModalOpen(true);
    } catch (err) {
      showToast(err.message || 'Gagal memuat daftar pengumpulan siswa.', 'error');
    }
  };

  const handleOpenSubmissionDetail = (sub) => {
    setSelectedSubmission(sub);
    setOverrideScore(String(sub.score ?? sub.ai_score ?? sub.final_score ?? '0'));
    setOverrideFeedback(sub.teacher_feedback || sub.ai_feedback || '');
    setIsSubmissionDetailOpen(true);
  };

  const handleSaveOverrideScore = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    const scoreNum = parseFloat(overrideScore);
    if (isNaN(scoreNum) || scoreNum < 0 || scoreNum > 100) {
      showToast('Skor override harus berupa angka antara 0 hingga 100.', 'error');
      return;
    }

    setIsOverriding(true);
    try {
      const res = await quizApi.overrideSubmission(selectedSubmission.id, {
        score: scoreNum,
        feedback: overrideFeedback,
        teacher_feedback: overrideFeedback,
      });
      const updatedSub = res?.data || res;
      if (updatedSub) {
        setSelectedSubmission((prev) => ({
          ...prev,
          ...updatedSub,
          ai_score: scoreNum,
          teacher_feedback: overrideFeedback,
          is_overridden: true,
        }));
        setSubmissions((prev) =>
          prev.map((s) =>
            s.id === selectedSubmission.id
              ? {
                  ...s,
                  ...updatedSub,
                  ai_score: scoreNum,
                  teacher_feedback: overrideFeedback,
                  is_overridden: true,
                }
              : s
          )
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
      renderCell: (row) => {
        const subjectName = row.subject?.name || row.subject_name || row.lesson_plan?.subject?.name || '-';
        return (
          <div className="flex flex-col">
            <span className="text-xs font-semibold text-slate-900 leading-tight">
              {row.title}
            </span>
            <span className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-1 font-medium">
              <span className="text-primary-700">{subjectName}</span>
              {row.subject?.code ? <span className="text-slate-400">• Kode: {row.subject.code}</span> : null}
            </span>
          </div>
        );
      },
    },
    {
      key: 'class',
      label: 'Rombel Kelas',
      renderCell: (row) => {
        const className =
          row.school_class?.name ||
          row.schoolClass?.name ||
          row.class_name ||
          classList.find((c) => String(c.id) === String(row.class_id))?.name ||
          '-';
        return (
          <Badge variant="neutral">
            Kelas <span className="font-mono font-medium">{className}</span>
          </Badge>
        );
      },
    },
    {
      key: 'dueDate',
      label: 'Tenggat Waktu',
      renderCell: (row) => {
        if (!row.due_date) return <span className="font-mono text-xs text-slate-400">-</span>;
        return (
          <span className="text-xs text-slate-700 whitespace-nowrap font-medium">
            {formatDate(row.due_date, {
              day: '2-digit',
              month: 'short',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </span>
        );
      },
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
        if (row.status === 'generating') {
          return <Badge variant="neutral" dot>Sedang Diproses AI</Badge>;
        }
        if (row.status === 'draft_review') {
          return <Badge variant="warning" dot>Draft Review</Badge>;
        }
        if (row.status === 'published') {
          return <Badge variant="success" dot>Aktif</Badge>;
        }
        return <Badge variant="info" dot>Hasil Dirilis</Badge>;
      },
    },
    {
      key: 'actions',
      label: 'Aksi Pengelolaan',
      align: 'right',
      renderCell: (row) => (
        <div className="flex items-center justify-end gap-1.5 flex-wrap">
          {/* Tombol Edit Kuis (Metadata, Rombel Kelas, & Tenggat Waktu) */}
          <Button
            variant="outline"
            size="sm"
            icon={Edit3}
            onClick={() => handleOpenEditQuizModal(row)}
            title="Edit Pengaturan Kuis"
          >
            Edit Kuis
          </Button>

          {row.status === 'generating' && (
            <Button
              variant="secondary"
              size="sm"
              icon={RotateCw}
              onClick={() => handleOpenPreviewModal(row)}
            >
              Cek Status
            </Button>
          )}
          {row.status === 'draft_review' && (
            <Button
              variant="primary"
              size="sm"
              icon={Sparkles}
              onClick={() => navigate(`/teacher/quiz/create?id=${row.id}`)}
              title="Lanjutkan pembuatan kuis di halaman penuh"
            >
              Lanjutkan
            </Button>
          )}
          {(row.status === 'published' || row.status === 'published_result') && (
            <Button
              variant="secondary"
              size="sm"
              icon={Users}
              onClick={() => handleOpenSubmissionsModal(row)}
            >
              Kelola Nilai
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="text-rose-600 hover:text-rose-700 hover:bg-rose-50"
            icon={Trash2}
            onClick={() => handleDeleteQuiz(row)}
            title="Batalkan &amp; Hapus Kuis"
          >
            Hapus
          </Button>
        </div>
      ),
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
      renderCell: (row) => {
        if (row.formatted_submitted_at) {
          return <span className="text-xs font-mono text-slate-700">{row.formatted_submitted_at}</span>;
        }
        const dateStr = row.submitted_at || row.created_at;
        if (!dateStr) return <span className="text-xs font-mono text-slate-400">-</span>;
        const d = new Date(dateStr);
        return (
          <span className="text-xs font-mono text-slate-700">
            {d.toLocaleString('id-ID', {
              day: '2-digit',
              month: 'short',
              hour: '2-digit',
              minute: '2-digit',
            })} WIB
          </span>
        );
      },
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
          <h1 className="teacher-quiz-title">Manajemen Kuis</h1>
          <p className="teacher-quiz-subtitle">
            Buat asesmen formatif berbantuan AI (prompt &amp; ekstraksi PDF), kurasi butir soal, serta review koreksi semantik siswa.
          </p>
        </div>
        <div>
          <Button variant="primary" onClick={() => navigate('/teacher/quiz/create')}>
            Buat Kuis Baru
          </Button>
        </div>
      </div>

      {/* Error Alert Banner with Retry */}
      {loadError && (
        <div style={{ marginBottom: '1.25rem', padding: '1rem', backgroundColor: '#fef2f2', border: '1px solid #fecaca', borderRadius: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: '#991b1b', fontSize: '0.875rem' }}>
            <AlertCircle style={{ width: '1.25rem', height: '1.25rem', flexShrink: 0 }} />
            <span>{loadError}</span>
          </div>
          <Button size="sm" variant="outline" onClick={loadData}>
            <RotateCw className="w-3.5 h-3.5 mr-1" />
            Coba Lagi
          </Button>
        </div>
      )}

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
          MODAL EDIT KUIS: Edit Metadata, Rombel Kelas, & Tenggat Waktu
         ========================================================================= */}
      <Modal
        isOpen={isEditQuizModalOpen}
        onClose={() => setIsEditQuizModalOpen(false)}
        title="Edit Pengaturan Kuis"
        maxWidth="max-w-lg"
      >
        {editingQuiz && (
          <form onSubmit={handleSaveEditQuizSubmit} className="quiz-modal-form">
            {(editingQuiz.status === 'published' || editingQuiz.status === 'published_result') && (
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-800 flex items-start gap-2">
                <AlertCircle size={16} className="text-blue-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-semibold mb-0.5">Kuis Sedang Aktif Dipublikasikan</p>
                  <p className="text-[11px] text-blue-700 leading-relaxed">
                    Anda dapat memperbarui judul, tenggat waktu, dan jumlah percobaan. Butir soal terkunci untuk menjaga keabsahan penilaian siswa.
                  </p>
                </div>
              </div>
            )}

            <Input
              label="Judul Kuis / Asesmen"
              placeholder="Contoh: Kuis Logika Algoritma & Struktur Data"
              value={editQuizForm.title}
              onChange={(e) => setEditQuizForm({ ...editQuizForm, title: e.target.value })}
              required
            />

            <Select
              label="Target Rombel Kelas"
              value={editQuizForm.class_id}
              onChange={(e) => setEditQuizForm({ ...editQuizForm, class_id: e.target.value })}
              options={classOptions}
              required
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input
                type="datetime-local"
                label="Tenggat Waktu Pengumpulan"
                value={editQuizForm.due_date}
                onChange={(e) => setEditQuizForm({ ...editQuizForm, due_date: e.target.value })}
                required
              />
              <Input
                type="number"
                label="Maks. Percobaan Pengerjaan"
                value={editQuizForm.max_attempts}
                onChange={(e) => setEditQuizForm({ ...editQuizForm, max_attempts: e.target.value })}
                min="1"
                max="5"
                required
              />
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-100">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                icon={Sparkles}
                onClick={() => {
                  setIsEditQuizModalOpen(false);
                  handleOpenPreviewModal(editingQuiz);
                }}
              >
                {editingQuiz.status === 'draft_review' ? 'Kelola Butir Soal' : 'Lihat Pratinjau Soal'}
              </Button>

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setIsEditQuizModalOpen(false)}
                >
                  Batal
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  disabled={isSavingEditQuiz}
                >
                  {isSavingEditQuiz ? 'Menyimpan...' : 'Simpan Perubahan'}
                </Button>
              </div>
            </div>
          </form>
        )}
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
                {currentQuiz?.schoolClass?.name || currentQuiz?.class_name || '-'}
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
                        aria-label={`Edit butir soal nomor ${idx + 1}`}
                      >
                        <Edit3 size={14} />
                      </button>
                      <button
                        type="button"
                        className="q-action-btn q-action-btn--danger"
                        onClick={() => handleDeleteQuestion(q.id)}
                        title="Hapus butir soal"
                        aria-label={`Hapus butir soal nomor ${idx + 1}`}
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
                  {q.question_type === 'multiple_choice' && q.options && (() => {
                    let parsedOptions = q.options;
                    if (typeof parsedOptions === 'string') {
                      try {
                        parsedOptions = JSON.parse(parsedOptions);
                      } catch {
                        parsedOptions = null;
                      }
                    }
                    if (!parsedOptions) return null;

                    const normCorrect = String(q.correct_answer || '').trim().toUpperCase();

                    if (Array.isArray(parsedOptions)) {
                      return (
                        <div className="options-grid">
                          {parsedOptions.map((opt, optIdx) => {
                            const optLetter = ['A', 'B', 'C', 'D', 'E'][optIdx] || String(optIdx);
                            const isCorrect = normCorrect === optLetter || normCorrect.startsWith(optLetter + '.') || normCorrect.startsWith(optLetter + ' ');
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
                          })}
                        </div>
                      );
                    }

                    return (
                      <div className="options-grid">
                        {Object.entries(parsedOptions).map(([optLetter, optText]) => {
                          const normOptKey = String(optLetter).trim().toUpperCase();
                          const isCorrect = normCorrect === normOptKey || normCorrect.startsWith(normOptKey + '.') || normCorrect.startsWith(normOptKey + ' ');
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
                    );
                  })()}

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
                Target Kelas: <strong className="font-mono text-slate-800">{currentQuiz?.schoolClass?.name || currentQuiz?.class_name || '-'}</strong> &bull; Batas Percobaan: <strong className="font-mono text-slate-800">{currentQuiz?.max_attempts}x</strong>
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

            {/* Catatan Feedback Aktif */}
            {(selectedSubmission.teacher_feedback || selectedSubmission.ai_feedback) && (
              <div className="mb-3 p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs">
                <span className="font-semibold text-slate-700 block mb-0.5">Catatan Evaluasi &amp; Umpan Balik:</span>
                <p className="text-slate-600 whitespace-pre-line font-mono text-[11px]">
                  {selectedSubmission.teacher_feedback || selectedSubmission.ai_feedback}
                </p>
              </div>
            )}

            {/* Answer Review Items */}
            <div className="sub-answers-list">
              {(() => {
                const reviewAnswers =
                  (selectedSubmission.answers && selectedSubmission.answers.length > 0)
                    ? selectedSubmission.answers
                    : (selectedSubmission.answers_payload || []);

                if (reviewAnswers.length === 0) {
                  return (
                    <div className="p-4 text-center text-xs text-slate-400">
                      Rincian jawaban otomatis terakumulasi dalam skor sistem.
                    </div>
                  );
                }

                return reviewAnswers.map((ans, idx) => {
                  const fallbackQ = quizQuestions.find((q) => q.id === ans.question_id);
                  const qType = ans.question_type || fallbackQ?.question_type || 'multiple_choice';
                  const qText = ans.question_text || fallbackQ?.question_text || `Soal #${idx + 1}`;
                  const sAns = ans.student_answer ?? ans.answer ?? ans.selected_option ?? '(Tidak dijawab)';
                  const cAns = ans.correct_answer || fallbackQ?.correct_answer || '-';
                  const isCorrect = ans.is_correct !== undefined
                    ? ans.is_correct
                    : (qType === 'multiple_choice' ? String(sAns).trim().toUpperCase() === String(cAns).trim().toUpperCase() : null);

                  return (
                    <div key={idx} className="answer-review-card">
                      <div className="answer-review-head">
                        <span className="text-xs font-semibold text-slate-800">
                          Soal #{idx + 1} ({qType === 'essay' ? 'Esai' : 'Pilihan Ganda'})
                        </span>
                        {isCorrect !== null && (
                          <Badge variant={isCorrect ? 'success' : 'error'}>
                            {isCorrect ? 'Benar / Sesuai' : 'Kurang Tepat'} &bull; {ans.points_awarded ?? (isCorrect ? 100 : 0)} poin
                          </Badge>
                        )}
                      </div>

                      <p className="text-xs text-slate-800 font-medium my-1">{qText}</p>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 my-2 text-xs">
                        <div className="bg-slate-50 p-2 rounded border border-slate-200">
                          <span className="text-[11px] font-semibold text-slate-500 block">Jawaban Siswa:</span>
                          <p className="text-slate-800 font-mono mt-0.5">{sAns}</p>
                        </div>
                        <div className="bg-emerald-50 p-2 rounded border border-emerald-200">
                          <span className="text-[11px] font-semibold text-emerald-700 block">Kunci / Rubrik:</span>
                          <p className="text-emerald-900 font-mono mt-0.5">{cAns}</p>
                        </div>
                      </div>

                      {ans.ai_feedback && (
                        <div className="bg-blue-50 p-2 rounded border border-blue-200 text-xs text-blue-900 mt-1">
                          <span className="font-semibold block text-[11px] text-blue-700">Analisis Semantik AI:</span>
                          <p className="mt-0.5">{ans.ai_feedback}</p>
                        </div>
                      )}
                    </div>
                  );
                });
              })()}
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
