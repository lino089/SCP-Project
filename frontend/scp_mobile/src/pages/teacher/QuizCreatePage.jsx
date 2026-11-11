import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  Plus,
  Sparkles,
  FileUp,
  Trash2,
  Pencil,
  Check,
  X,
  Clock,
  AlertTriangle,
  RotateCw,
  Send,
} from 'lucide-react';
import { quizApi } from '../../services/quizApi';
import { classApi } from '../../services/masterDataApi';
import { Button, Input, Select, Badge, FileUpload, ConfirmSheet } from '../../components/shared';
import './QuizCreatePage.css';

const STEPS = ['Konfigurasi', 'Sumber Soal', 'Tinjau'];

export default function MobileQuizCreatePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const resumeId = searchParams.get('id');

  const [step, setStep] = useState(1);
  const [qFilter, setQFilter] = useState('all');
  const [detailQ, setDetailQ] = useState(null);
  const [classesList, setClassesList] = useState([]);
  const [currentQuiz, setCurrentQuiz] = useState(null);
  const [quizQuestions, setQuizQuestions] = useState([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingQuestions, setIsLoadingQuestions] = useState(false);

  const [form, setForm] = useState({
    title: '',
    class_id: '',
    due_date: '',
    max_attempts: 2,
    duration_minutes: 30,
  });

  const [genMethod, setGenMethod] = useState('prompt');
  const [promptForm, setPromptForm] = useState({
    prompt: '',
    total_questions: 5,
    mc_count: 3,
    essay_count: 2,
    difficulty: 'sedang',
  });
  const [uploadedDoc, setUploadedDoc] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);

  const [manualOpen, setManualOpen] = useState(false);
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
  const [editingId, setEditingId] = useState(null);
  const [editText, setEditText] = useState('');
  const [confirm, setConfirm] = useState({ open: false, message: '', onConfirm: null });

  const [toast, setToast] = useState(null);
  const showToast = (message, variant = 'success') => {
    setToast({ message, variant });
    setTimeout(() => setToast(null), 3200);
  };

  useEffect(() => {
    (async () => {
      try {
        const res = await classApi.getClasses({ my_taught_only: 1, all: 1 });
        const list = res?.data || [];
        setClassesList(Array.isArray(list) ? list : []);
        if (Array.isArray(list) && list.length === 1) {
          setForm((prev) => ({ ...prev, class_id: String(list[0].id) }));
        }
      } catch {
        showToast('Gagal memuat daftar kelas.', 'error');
      }
    })();
  }, []);

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

  useEffect(() => {
    if (!resumeId) return;
    (async () => {
      try {
        const res = await quizApi.getQuizDetail(resumeId);
        const quiz = res?.data || res;
        if (!quiz) return;
        setCurrentQuiz(quiz);
        setForm({
          title: quiz.title || '',
          class_id: String(quiz.class_id || ''),
          due_date: (quiz.due_date || '').slice(0, 10),
          max_attempts: Number(quiz.max_attempts || 2),
          duration_minutes: Number(quiz.duration_minutes || 30),
        });
        const list = await loadQuestions(resumeId);
        setStep(list.length > 0 ? 3 : 2);
      } catch (err) {
        showToast(err.message || 'Gagal memuat draf kuis.', 'error');
      }
    })();
  }, [resumeId, loadQuestions]);

  const pollQuestions = async (quizId, attempts = 30, delay = 2000) => {
    for (let i = 1; i <= attempts; i++) {
      try {
        const res = await quizApi.getQuizQuestions(quizId);
        const raw = res?.data?.questions || res?.data || res?.questions || [];
        const list = Array.isArray(raw) ? raw : raw?.questions || [];
        if (list.length > 0) return list;
      } catch {
        /* tunggu antrean */
      }
      if (i < attempts) await new Promise((r) => setTimeout(r, delay));
    }
    return [];
  };

  const handleCreate = async () => {
    if (!form.title.trim()) return showToast('Judul kuis wajib diisi.', 'error');
    if (!form.class_id) return showToast('Pilih kelas target.', 'error');
    if (!form.due_date) return showToast('Tenggat waktu wajib diisi.', 'error');

    setIsSaving(true);
    try {
      const res = await quizApi.createQuiz({
        title: form.title.trim(),
        class_id: form.class_id,
        due_date: form.due_date,
        max_attempts: Number(form.max_attempts) || 1,
        duration_minutes: Number(form.duration_minutes) || 30,
      });
      const quiz = res?.data || res;
      if (!quiz?.id) throw new Error('Respons pembuatan kuis tidak valid.');
      setCurrentQuiz(quiz);
      setStep(2);
      showToast('Draf kuis dibuat. Pilih sumber soal.');
    } catch (err) {
      showToast(err.message || err.response?.data?.message || 'Gagal membuat kuis.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleGenerate = async () => {
    if (!promptForm.prompt.trim()) return showToast('Instruksi materi wajib diisi.', 'error');
    setIsGenerating(true);
    try {
      const res = await quizApi.generatePrompt(currentQuiz.id, {
        prompt: promptForm.prompt,
        total_questions: Number(promptForm.total_questions),
        question_types: 'combination',
        mc_count: Number(promptForm.mc_count),
        essay_count: Number(promptForm.essay_count),
        difficulty: promptForm.difficulty,
        additional_notes: '',
      });
      const direct = Array.isArray(res?.data?.questions) ? res.data.questions : null;
      const list = direct?.length ? direct : await pollQuestions(currentQuiz.id);
      if (list.length > 0) {
        setQuizQuestions(list);
        setStep(3);
        showToast('Soal berhasil dibuat. Periksa sebelum terbit.');
      } else {
        showToast('AI belum menghasilkan soal. Coba lagi.', 'error');
      }
    } catch (err) {
      showToast(err.message || err.response?.data?.message || 'Gagal memproses prompt.', 'error');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleExtract = async () => {
    if (!uploadedDoc) return showToast('Pilih berkas PDF/TXT.', 'error');
    setIsExtracting(true);
    try {
      const fd = new FormData();
      fd.append('document', uploadedDoc);
      fd.append('file', uploadedDoc);
      const res = await quizApi.extractDocument(currentQuiz.id, fd);
      const direct = Array.isArray(res?.data?.questions) ? res.data.questions : null;
      const list = direct?.length ? direct : await pollQuestions(currentQuiz.id);
      if (list.length > 0) {
        setQuizQuestions(list);
        setStep(3);
        showToast('Dokumen diekstrak. Periksa soal bertanda kuning.');
      } else {
        showToast('Soal tidak dapat diekstrak.', 'error');
      }
    } catch (err) {
      showToast(err.message || err.response?.data?.message || 'Gagal mengekstrak dokumen.', 'error');
    } finally {
      setIsExtracting(false);
    }
  };

  const handleAddManual = async () => {
    if (!manualForm.question_text.trim()) return showToast('Teks pertanyaan wajib diisi.', 'error');
    try {
      const res = await quizApi.createQuestion(currentQuiz.id, {
        question_type: manualForm.question_type,
        question_text: manualForm.question_text,
        points: Number(manualForm.points) || 20,
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
            ? manualForm.correct_answer || 'Kriteria jawaban sesuai kata kunci'
            : manualForm.correct_answer,
      });
      const created = res?.data || res;
      if (created) setQuizQuestions((prev) => [...prev, created]);
      setManualOpen(false);
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
      showToast('Butir soal ditambahkan.');
    } catch (err) {
      showToast(err.message || 'Gagal menambah soal.', 'error');
    }
  };

  const handleDelete = (questionId) => {
    setConfirm({
      open: true,
      message: 'Hapus butir soal ini dari kuis?',
      onConfirm: async () => {
        try {
          await quizApi.deleteQuestion(currentQuiz.id, questionId);
          setQuizQuestions((prev) => prev.filter((q) => q.id !== questionId));
          showToast('Butir soal dihapus.');
        } catch {
          showToast('Gagal menghapus butir soal.', 'error');
        } finally {
          setConfirm({ open: false, message: '', onConfirm: null });
        }
      },
    });
  };

  const handleSaveEdit = async (question) => {
    try {
      await quizApi.updateQuestion(currentQuiz.id, question.id, { question_text: editText });
      setQuizQuestions((prev) =>
        prev.map((q) => (q.id === question.id ? { ...q, question_text: editText } : q))
      );
      setEditingId(null);
      showToast('Butir soal diperbarui.');
    } catch (err) {
      showToast(err.message || 'Gagal memperbarui soal.', 'error');
    }
  };

  const handlePublish = () => {
    if (quizQuestions.length === 0) return showToast('Belum ada butir soal.', 'error');
    setConfirm({
      open: true,
      message: `"${currentQuiz?.title}" · ${quizQuestions.length} butir (${totalPoints} poin) · ${form.max_attempts}× percobaan. Butir soal terkunci setelah terbit.`,
      onConfirm: async () => {
        try {
          await quizApi.updateQuizStatus(currentQuiz.id, { status: 'published' });
          setCurrentQuiz((prev) => ({ ...prev, status: 'published' }));
          showToast('Kuis diterbitkan.');
        } catch (err) {
          showToast(err.message || 'Gagal menerbitkan kuis.', 'error');
        } finally {
          setConfirm({ open: false, message: '', onConfirm: null });
        }
      },
    });
  };

  const isPublished = currentQuiz?.status === 'published' || currentQuiz?.status === 'published_result';
  const previewCount = useMemo(() => quizQuestions.length, [quizQuestions]);
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
  const compositionWarning =
    Number(promptForm.total_questions) !==
    Number(promptForm.mc_count) + Number(promptForm.essay_count)
      ? `PG (${promptForm.mc_count}) + Esai (${promptForm.essay_count}) harus sama dengan total ${promptForm.total_questions}.`
      : '';

  return (
    <div className="qc-page">
      {toast && (
        <div className={`qc-toast qc-toast--${toast.variant}`}>{toast.message}</div>
      )}

      <header className="qc-head">
        <button type="button" className="qc-back" onClick={() => navigate('/teacher/quiz')} aria-label="Kembali">
          <ArrowLeft size={16} />
        </button>
        <div className="qc-head__text">
          <h1>{currentQuiz ? 'Lanjutkan Kuis' : 'Buat Kuis'}</h1>
          <p>Langkah {step} dari 3 · {STEPS[step - 1]}</p>
        </div>
      </header>

      <div className="qc-steps">
        {STEPS.map((label, i) => (
          <span key={label} className={`qc-step ${step > i + 1 ? 'qc-step--done' : step === i + 1 ? 'qc-step--on' : ''}`} />
        ))}
      </div>

      <div className="qc-body">
        {/* STEP 1 */}
        {step === 1 && (
          <div className="qc-card">
            <h2>Informasi Kuis</h2>
            <Input
              label="Judul Kuis"
              placeholder="Contoh: Kuis Barisan & Deret"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
            <Select
              label="Kelas Target"
              value={form.class_id}
              onChange={(e) => setForm({ ...form, class_id: e.target.value })}
            >
              <option value="">Pilih kelas…</option>
              {classesList.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
            <Input
              type="date"
              label="Tenggat Pengumpulan"
              value={form.due_date}
              onChange={(e) => setForm({ ...form, due_date: e.target.value })}
            />
            <Select
              label="Maks. Percobaan"
              value={form.max_attempts}
              onChange={(e) => setForm({ ...form, max_attempts: Number(e.target.value) })}
            >
              {[1, 2, 3, 4, 5].map((n) => (
                <option key={n} value={n}>
                  {n} kali
                </option>
              ))}
            </Select>
            <Input
              type="number"
              label="Durasi (menit)"
              value={form.duration_minutes}
              onChange={(e) => setForm({ ...form, duration_minutes: e.target.value })}
              min="1"
              max="300"
            />
            <div className="qc-note">
              <Clock size={13} />
              <span>Durasi pengerjaan mengikuti bobot &amp; jumlah soal yang dibuat.</span>
            </div>
          </div>
        )}

        {/* STEP 2 */}
        {step === 2 && (
          <>
            <div className="qc-methods">
              {[
                { id: 'prompt', title: 'Prompt AI', desc: 'Topik + komposisi soal' },
                { id: 'document', title: 'Dokumen', desc: 'PDF/TXT — ekstrak soal asli' },
              ].map((m) => (
                <button
                  key={m.id}
                  type="button"
                  className={`qc-method ${genMethod === m.id ? 'qc-method--on' : ''}`}
                  onClick={() => setGenMethod(m.id)}
                >
                  <span className="qc-method__radio" />
                  <span className="qc-method__text">
                    <b>{m.title}</b>
                    <span>{m.desc}</span>
                  </span>
                </button>
              ))}
            </div>

            {genMethod === 'prompt' && (
              <div className="qc-card">
                <h2>Prompt AI</h2>
                <div className="qc-field">
                  <label>Topik / Instruksi</label>
                  <textarea
                    rows={3}
                    className="qc-textarea"
                    value={promptForm.prompt}
                    onChange={(e) => setPromptForm({ ...promptForm, prompt: e.target.value })}
                    placeholder="Soal barisan aritmetika kelas X, fokus rumus Un dan Sn"
                  />
                </div>
                <div className="qc-grid2">
                  <Input
                    type="number"
                    label="Total Soal"
                    value={promptForm.total_questions}
                    onChange={(e) => setPromptForm({ ...promptForm, total_questions: e.target.value })}
                    min="1"
                    max="30"
                  />
                  <Select
                    label="Kesulitan"
                    value={promptForm.difficulty}
                    onChange={(e) => setPromptForm({ ...promptForm, difficulty: e.target.value })}
                  >
                    <option value="mudah">Mudah</option>
                    <option value="sedang">Sedang</option>
                    <option value="sulit">Sulit</option>
                  </Select>
                </div>
                <div className="qc-grid2">
                  <Input
                    type="number"
                    label="Soal PG"
                    value={promptForm.mc_count}
                    onChange={(e) => setPromptForm({ ...promptForm, mc_count: e.target.value })}
                    min="0"
                  />
                  <Input
                    type="number"
                    label="Soal Esai"
                    value={promptForm.essay_count}
                    onChange={(e) => setPromptForm({ ...promptForm, essay_count: e.target.value })}
                    min="0"
                  />
                </div>
                {compositionWarning ? (
                  <div className="qc-calc qc-calc--bad">
                    <AlertTriangle size={12} /> <span>{compositionWarning}</span>
                  </div>
                ) : (
                  <div className="qc-calc">
                    <Check size={12} /> <span>{promptForm.mc_count} PG + {promptForm.essay_count} esai = {promptForm.total_questions} soal</span>
                  </div>
                )}
              </div>
            )}

            {genMethod === 'document' && (
              <div className="qc-card">
                <h2>Ekstraksi Dokumen</h2>
                <p className="qc-hint">AI mengekstrak soal yang sudah ada di dokumen, bukan mengarang soal baru.</p>
                <FileUpload
                  label="Berkas materi / soal"
                  accept=".pdf,.txt"
                  maxSizeMB={5}
                  file={uploadedDoc}
                  onChange={setUploadedDoc}
                  hint="PDF atau TXT (maks 5MB)"
                />
              </div>
            )}

            <div className="qc-card qc-card--flat">
              <p className="qc-hint">
                Metode <b>input manual</b> tersedia di website. Butir soal tetap dapat ditambah atau diedit di langkah tinjau.
              </p>
            </div>
          </>
        )}

        {/* STEP 3 */}
        {step === 3 && (
          <div className="qc-card">
            <div className="qc-card__head">
              <h2>Tinjau &amp; Terbitkan</h2>
              <span className="qc-count">{previewCount}</span>
            </div>
            <p className="qc-hint">{mcCount} PG · {essayCount} esai · {totalPoints} poin</p>

            <div className="qc-filters">
              <button type="button" className={`qc-filter ${qFilter === 'all' ? 'on' : ''}`} onClick={() => setQFilter('all')}>
                Semua {previewCount}
              </button>
              <button type="button" className={`qc-filter ${qFilter === 'multiple_choice' ? 'on' : ''}`} onClick={() => setQFilter('multiple_choice')}>
                PG {mcCount}
              </button>
              <button type="button" className={`qc-filter ${qFilter === 'essay' ? 'on' : ''}`} onClick={() => setQFilter('essay')}>
                Esai {essayCount}
              </button>
              <button type="button" className={`qc-filter qc-filter--warn ${qFilter === 'review' ? 'on' : ''}`} onClick={() => setQFilter('review')}>
                Tinjau {reviewCount}
              </button>
            </div>
            {isLoadingQuestions && <p className="qc-hint">Memuat soal…</p>}
            {!isLoadingQuestions && quizQuestions.length === 0 && (
              <p className="qc-hint">Belum ada butir soal. Kembali ke langkah 2.</p>
            )}
            <div className="qc-qlist">
              {filteredQuestions.map((q) => (
                <div key={q.id} className={`qc-qitem ${q.needs_review ? 'qc-qitem--warn' : ''}`}>
                  <div className="qc-qitem__head">
                    <span className="qc-qnum">#{quizQuestions.findIndex((item) => item.id === q.id) + 1}</span>
                    <span className="qc-qtype">{q.question_type === 'multiple_choice' ? 'PG' : 'Esai'}</span>
                    <span className="qc-qpoints">{q.points || 20} poin</span>
                    <div className="qc-qactions">
                      <button type="button" onClick={() => { setEditingId(q.id); setEditText(q.question_text || ''); }} aria-label="Edit soal">
                        <Pencil size={13} />
                      </button>
                      <button type="button" className="danger" onClick={() => handleDelete(q.id)} aria-label="Hapus soal">
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                  {editingId === q.id ? (
                    <>
                      <textarea
                        className="qc-textarea"
                        rows={3}
                        value={editText}
                        onChange={(e) => setEditText(e.target.value)}
                      />
                      <div className="qc-qedit-actions">
                        <button type="button" onClick={() => setEditingId(null)}><X size={13} /> Batal</button>
                        <button type="button" className="save" onClick={() => handleSaveEdit(q)}><Check size={13} /> Simpan</button>
                      </div>
                    </>
                  ) : (
                    <p className="qc-qtext">{q.question_text}</p>
                  )}
                  <button type="button" className="qc-qopen" onClick={() => setDetailQ(q)}>
                    Lihat detail
                  </button>
                  {q.needs_review && (
                    <div className="qc-qwarn">
                      <AlertTriangle size={12} /> <span>{q.review_note || 'Perlu verifikasi guru.'}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
            <div className="qc-reqs">
              <div className={`qc-req ${previewCount > 0 ? 'ok' : 'bad'}`}>
                <span>{previewCount > 0 ? '✓' : '!'}</span>
                <span>{previewCount > 0 ? `Minimal 1 butir — ${previewCount} butir` : 'Belum ada butir soal'}</span>
              </div>
              <div className={`qc-req ${reviewCount === 0 ? 'ok' : 'bad'}`}>
                <span>{reviewCount === 0 ? '✓' : '!'}</span>
                <span>{reviewCount === 0 ? 'Semua soal tervalidasi' : `${reviewCount} soal perlu tinjau`}</span>
              </div>
            </div>

            <Button variant="outline" icon={Plus} onClick={() => setManualOpen(true)} className="qc-add-q">
              Tambah Soal Manual
            </Button>
          </div>
        )}
      </div>

      {/* footer aksi */}
      <footer className="qc-foot">
        {isPublished ? (
          <Button variant="primary" fullWidth onClick={() => navigate('/teacher/quiz')}>
            Kembali ke daftar
          </Button>
        ) : (
          <>
            <Button
              variant="secondary"
              onClick={() => (step === 1 ? navigate('/teacher/quiz') : setStep(step - 1))}
            >
              {step === 1 ? 'Batal' : 'Kembali'}
            </Button>
            {step === 1 && (
              <Button variant="primary" onClick={handleCreate} loading={isSaving} disabled={isSaving}>
                Lanjut
              </Button>
            )}
            {step === 2 && genMethod === 'prompt' && (
              <Button variant="primary" onClick={handleGenerate} loading={isGenerating} disabled={isGenerating}>
                {isGenerating ? 'Memproses…' : 'Generate'}
              </Button>
            )}
            {step === 2 && genMethod === 'document' && (
              <Button variant="primary" onClick={handleExtract} loading={isExtracting} disabled={isExtracting || !uploadedDoc}>
                {isExtracting ? 'Mengekstrak…' : 'Ekstrak'}
              </Button>
            )}
            {step === 3 && (
              <Button variant="primary" icon={Send} onClick={handlePublish} disabled={!canPublish}>
                Terbitkan
              </Button>
            )}
          </>
        )}
      </footer>

      {/* sheet detail soal */}
      {detailQ && (
        <div className="qc-sheet" onClick={() => setDetailQ(null)}>
          <div className="qc-sheet__panel" onClick={(e) => e.stopPropagation()}>
            <div className="qc-sheet__head">
              <h3>Butir #{quizQuestions.findIndex((item) => item.id === detailQ.id) + 1}</h3>
              <button type="button" onClick={() => setDetailQ(null)} aria-label="Tutup"><X size={16} /></button>
            </div>
            <div className="qc-detail-meta">
              <span className="qc-qtype">{detailQ.question_type === 'multiple_choice' ? 'Pilihan Ganda' : 'Esai'}</span>
              <span className="qc-qpoints">{detailQ.points || 20} poin</span>
            </div>
            <p className="qc-qtext">{detailQ.question_text}</p>
            {detailQ.question_type === 'multiple_choice' && detailQ.options && (() => {
              let opts = detailQ.options;
              if (typeof opts === 'string') {
                try { opts = JSON.parse(opts); } catch { opts = null; }
              }
              if (!opts) return null;
              const correct = String(detailQ.correct_answer || '').trim().toUpperCase();
              const entries = Array.isArray(opts)
                ? opts.map((text, i) => [['A', 'B', 'C', 'D', 'E'][i] || String(i), text])
                : Object.entries(opts);
              return (
                <div className="qc-detail-opts">
                  {entries.map(([letter, text]) => {
                    const key = String(letter).trim().toUpperCase();
                    const isCorrect = correct === key || correct.startsWith(`${key}.`) || correct.startsWith(`${key} `);
                    return (
                      <div key={letter} className={`qc-detail-opt ${isCorrect ? 'on' : ''}`}>
                        <b>{letter}.</b> <span>{text}</span>
                        {isCorrect && <em>kunci</em>}
                      </div>
                    );
                  })}
                </div>
              );
            })()}
            {detailQ.question_type === 'essay' && (
              <div className="qc-detail-rubric">
                <b>Rubrik penilaian</b>
                <p>{detailQ.correct_answer || 'Evaluasi kata kunci kesesuaian konsep.'}</p>
              </div>
            )}
            {detailQ.needs_review && (
              <div className="qc-qwarn">
                <AlertTriangle size={12} /> <span>{detailQ.review_note || 'Perlu verifikasi guru.'}</span>
              </div>
            )}
            <div className="qc-sheet__actions">
              <Button variant="secondary" onClick={() => setDetailQ(null)}>Tutup</Button>
              <Button
                variant="primary"
                onClick={() => {
                  setEditingId(detailQ.id);
                  setEditText(detailQ.question_text || '');
                  setDetailQ(null);
                }}
              >
                Edit Soal
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* form soal manual */}
      {manualOpen && (
        <div className="qc-sheet">
          <div className="qc-sheet__panel">
            <div className="qc-sheet__head">
              <h3>Tambah Soal Manual</h3>
              <button type="button" onClick={() => setManualOpen(false)} aria-label="Tutup"><X size={16} /></button>
            </div>
            <Select
              label="Jenis Soal"
              value={manualForm.question_type}
              onChange={(e) => setManualForm({ ...manualForm, question_type: e.target.value })}
            >
              <option value="multiple_choice">Pilihan Ganda</option>
              <option value="essay">Esai</option>
            </Select>
            <div className="qc-field">
              <label>Teks Pertanyaan</label>
              <textarea
                rows={3}
                className="qc-textarea"
                value={manualForm.question_text}
                onChange={(e) => setManualForm({ ...manualForm, question_text: e.target.value })}
              />
            </div>
            {manualForm.question_type === 'multiple_choice' && (
              <div className="qc-grid2">
                <Input label="A" value={manualForm.optionA} onChange={(e) => setManualForm({ ...manualForm, optionA: e.target.value })} />
                <Input label="B" value={manualForm.optionB} onChange={(e) => setManualForm({ ...manualForm, optionB: e.target.value })} />
                <Input label="C" value={manualForm.optionC} onChange={(e) => setManualForm({ ...manualForm, optionC: e.target.value })} />
                <Input label="D" value={manualForm.optionD} onChange={(e) => setManualForm({ ...manualForm, optionD: e.target.value })} />
              </div>
            )}
            <div className="qc-grid2">
              <Input
                label={manualForm.question_type === 'essay' ? 'Rubrik' : 'Kunci'}
                value={manualForm.correct_answer}
                onChange={(e) => setManualForm({ ...manualForm, correct_answer: e.target.value })}
              />
              <Input
                type="number"
                label="Poin"
                value={manualForm.points}
                onChange={(e) => setManualForm({ ...manualForm, points: e.target.value })}
              />
            </div>
            <div className="qc-sheet__actions">
              <Button variant="secondary" onClick={() => setManualOpen(false)}>Batal</Button>
              <Button variant="primary" onClick={handleAddManual}>Simpan Soal</Button>
            </div>
          </div>
        </div>
      )}

      <ConfirmSheet
        isOpen={confirm.open}
        onClose={() => setConfirm({ open: false, message: '', onConfirm: null })}
        onConfirm={confirm.onConfirm}
        title="Konfirmasi"
        message={confirm.message}
      />
    </div>
  );
}