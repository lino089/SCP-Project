import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FileQuestion,
  AlertCircle,
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
  Tabs,
} from '../../components/shared';
import './StudentQuiz.css';

const formatQuizDueDate = (dueDateStr) => {
  if (!dueDateStr) return { formatted: '—', tag: null };
  const d = new Date(dueDateStr);
  if (isNaN(d.getTime())) return { formatted: dueDateStr, tag: null };

  const now = new Date();
  const diffHours = (d - now) / (1000 * 60 * 60);

  const formatted = d.toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }) + ' WIB';

  let tag = null;
  if (d < now) {
    tag = { label: 'Telah Lewat', color: 'text-rose-700 bg-rose-50 border-rose-200' };
  } else if (diffHours <= 24) {
    tag = { label: 'Tenggat Hari Ini', color: 'text-amber-800 bg-amber-50 border-amber-300' };
  } else {
    const days = Math.ceil(diffHours / 24);
    tag = { label: `Sisa ${days} hari`, color: 'text-slate-600 bg-slate-100 border-slate-200' };
  }

  return { formatted, tag };
};

export default function StudentQuizPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [quizzes, setQuizzes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [activeTab, setActiveTab] = useState('all');

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

  // Student Info
  const studentInfo = {
    name: user?.name || 'Peserta Didik',
    nis: user?.nis_nip || '-',
    className: user?.school_class?.name || user?.schoolClass?.name || user?.class_name || '-',
  };

  // Fetch quizzes for student
  const loadQuizzes = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await quizApi.getQuizzes();
      if (res?.data) {
        // Filter to quizzes applicable to student (published or published_result)
        const available = res.data.filter(
          (q) => q.status === 'published' || q.status === 'published_result'
        );
        setQuizzes(available);
      }
    } catch (err) {
      console.warn('Gagal memuat kuis siswa:', err);
      setLoadError(err.message || 'Gagal memuat kuis siswa dari server.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadQuizzes();
  }, [loadQuizzes]);


  // --- ACTIONS ---






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

  // Helper untuk menentukan status & aksi pengerjaan kuis siswa
  const getQuizStatusInfo = useCallback((quiz) => {
    // 1. Apakah hasil penilaian sudah dirilis oleh guru?
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
    const hasDraft = typeof window !== 'undefined' && !!sessionStorage.getItem(`quiz_draft_${quiz.id}`);

    // 2. Siswa telah menghabiskan kesempatan pengerjaan
    if (attemptsUsed >= maxAttempts) {
      return {
        key: 'completed',
        label: 'Sudah Mengumpulkan',
        variant: 'success',
        canTake: false,
        canViewResult: false,
        actionLabel: 'Selesai Dikerjakan',
        note: `${attemptsUsed}/${maxAttempts} Percobaan Selesai`,
      };
    }

    // 3. Batas waktu pengerjaan telah lewat
    if (isExpired) {
      return {
        key: 'expired',
        label: 'Batas Waktu Habis',
        variant: 'danger',
        canTake: false,
        canViewResult: false,
        actionLabel: 'Waktu Berakhir',
      };
    }

    // 4. Masih dalam proses pengerjaan (ada draft tersimpan)
    if (hasDraft) {
      return {
        key: 'in_progress',
        label: 'Sedang Dikerjakan',
        variant: 'warning',
        canTake: true,
        canViewResult: false,
        actionLabel: 'Lanjutkan Pengerjaan',
      };
    }

    // 5. Sudah ada percobaan pengerjaan sebelumnya tetapi masih ada sisa kuota
    if (attemptsUsed > 0 && attemptsUsed < maxAttempts) {
      return {
        key: 'partially_done',
        label: `Percobaan ${attemptsUsed} dari ${maxAttempts} Selesai`,
        variant: 'warning',
        canTake: true,
        canViewResult: false,
        actionLabel: `Kerjakan Percobaan ke-${attemptsUsed + 1}`,
        note: `Tersisa ${maxAttempts - attemptsUsed} kesempatan lagi`,
      };
    }

    // 6. Belum Dikerjakan sama sekali
    return {
      key: 'ready',
      label: 'Belum Dikerjakan',
      variant: 'primary',
      canTake: true,
      canViewResult: false,
      actionLabel: 'Mulai Kerjakan',
    };
  }, []);

  // Filter & Tabs Navigasi
  const pendingQuizzes = useMemo(
    () => quizzes.filter((q) => getQuizStatusInfo(q).canTake),
    [quizzes, getQuizStatusInfo]
  );

  const historyQuizzes = useMemo(
    () => quizzes.filter((q) => !getQuizStatusInfo(q).canTake),
    [quizzes, getQuizStatusInfo]
  );

  const tabs = useMemo(
    () => [
      { id: 'all', label: 'Semua Kuis', count: quizzes.length },
      { id: 'pending', label: 'Perlu Dikerjakan', count: pendingQuizzes.length },
      { id: 'history', label: 'Riwayat Selesai', count: historyQuizzes.length },
    ],
    [quizzes.length, pendingQuizzes.length, historyQuizzes.length]
  );

  const filteredQuizzes = useMemo(() => {
    if (activeTab === 'pending') return pendingQuizzes;
    if (activeTab === 'history') return historyQuizzes;
    return quizzes;
  }, [activeTab, pendingQuizzes, historyQuizzes, quizzes]);

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
            {row.subject?.name || row.lesson_plan?.subject?.name || '-'} &bull; <strong className="font-mono">{row.questions_count || 0}</strong> butir soal
          </span>
        </div>
      ),
    },
    {
      key: 'teacher',
      label: 'Guru Pengampu',
      renderCell: (row) => (
        <span className="text-xs text-slate-700">{row.teacher?.name || row.lesson_plan?.teacher?.name || '-'}</span>
      ),
    },
    {
      key: 'dueDate',
      label: 'Batas Pengerjaan',
      renderCell: (row) => {
        const { formatted, tag } = formatQuizDueDate(row.due_date);
        return (
          <div className="flex flex-col gap-1 items-start">
            <span className="font-mono text-xs font-semibold text-slate-800">{formatted}</span>
            {tag && (
              <span className={`inline-block text-[10px] font-semibold px-1.5 py-0.5 rounded border ${tag.color}`}>
                {tag.label}
              </span>
            )}
          </div>
        );
      },
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
        const info = getQuizStatusInfo(row);
        return (
          <div className="flex flex-col gap-0.5">
            <Badge variant={info.variant} dot>
              {info.label}
            </Badge>
            {info.note && (
              <span className="text-[10px] text-slate-500 font-mono">
                {info.note}
              </span>
            )}
          </div>
        );
      },
    },
    {
      key: 'action',
      label: 'Aksi',
      align: 'right',
      renderCell: (row) => {
        const info = getQuizStatusInfo(row);
        if (info.canViewResult) {
          return (
            <Button
              variant="secondary"
              size="sm"
              icon={Eye}
              onClick={() => handleInspectResults(row)}
            >
              {info.actionLabel}
            </Button>
          );
        }
        if (info.canTake) {
          return (
            <Button
              variant="primary"
              size="sm"
              icon={FileQuestion}
              onClick={() => navigate(`/student/quiz/${row.id}`)}
            >
              {info.actionLabel}
            </Button>
          );
        }
        return (
          <Button
            variant="ghost"
            size="sm"
            disabled
          >
            {info.actionLabel}
          </Button>
        );
      },
    },
  ];
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

      {/* Error Alert Banner with Retry */}
      {loadError && (
        <div style={{ marginBottom: '1.25rem', padding: '1rem', backgroundColor: '#fef2f2', border: '1px solid #fecaca', borderRadius: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: '#991b1b', fontSize: '0.875rem' }}>
            <AlertCircle style={{ width: '1.25rem', height: '1.25rem', flexShrink: 0 }} />
            <span>{loadError}</span>
          </div>
          <Button size="sm" variant="outline" onClick={loadQuizzes}>
            <RotateCw className="w-3.5 h-3.5 mr-1" />
            Coba Lagi
          </Button>
        </div>
      )}

      {/* Filter Tabs */}
      <div style={{ marginBottom: '1rem' }}>
        <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />
      </div>

      {/* Tabel Kuis Aktif */}
      <div className="student-quiz-table-wrap">
        <Table
          columns={columns}
          data={filteredQuizzes}
          isLoading={loading}
          pageSize={10}
          emptyMessage={
            activeTab === 'pending'
              ? 'Hebat! Tidak ada kuis yang perlu Anda kerjakan saat ini.'
              : activeTab === 'history'
              ? 'Belum ada riwayat kuis yang selesai dikerjakan.'
              : 'Tidak ada kuis aktif yang ditugaskan ke kelas Anda saat ini.'
          }
        />
      </div>

      {/* =========================================================================
          MODAL LEMBAR UJIAN CBT INTERAKTIF SISWA
         ========================================================================= */}


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
                      {mySubmission?.score ?? mySubmission?.ai_score ?? mySubmission?.final_score ?? 0}
                    </span>
                    <span className="text-xs font-mono text-slate-400">/ 100 Poin</span>
                  </div>
                </div>

                <div>
                  {(() => {
                    const finalScore = mySubmission?.score ?? mySubmission?.ai_score ?? mySubmission?.final_score ?? 0;
                    return (
                      <Badge variant={finalScore >= 75 ? 'success' : 'warning'}>
                        {finalScore >= 75 ? 'Tuntas KKM' : 'Perlu Remedial'}
                      </Badge>
                    );
                  })()}
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
