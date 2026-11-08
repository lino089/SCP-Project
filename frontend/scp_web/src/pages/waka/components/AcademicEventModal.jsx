import { useState, useEffect, useMemo } from 'react';
import Modal from '../../../components/shared/Modal';
import Button from '../../../components/shared/Button';
import Input from '../../../components/shared/Input';
import { classApi } from '../../../services/masterDataApi';
import { Calendar, Layers, AlertCircle, CheckSquare, Square } from 'lucide-react';
import { todayLocalISO } from '../../../utils/dateUtils';

const EVENT_TYPES = [
  { value: 'holiday', label: 'Hari Libur Nasional / Resmi', defaultDisable: true },
  { value: 'school_event', label: 'Kegiatan Sekolah (Porseni, Upacara, dll)', defaultDisable: false },
  { value: 'class_event', label: 'Kegiatan Khusus Tingkat / Rombel (Kemah, KI, dll)', defaultDisable: true },
  { value: 'exam', label: 'Masa Penilaian / Ujian', defaultDisable: true },
];

export default function AcademicEventModal({
  isOpen = false,
  onClose,
  onSubmit,
  initialData = null,
  loading = false,
}) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState('holiday');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [scopeType, setScopeType] = useState('all');
  const [selectedGrades, setSelectedGrades] = useState(['10']);
  const [selectedClassIds, setSelectedClassIds] = useState([]);
  const [disablesTeaching, setDisablesTeaching] = useState(true);

  // Master Data Kelas untuk pilihan scope_type = 'class'
  const [classesList, setClassesList] = useState([]);
  const [classFilterGrade, setClassFilterGrade] = useState('ALL');
  const [classSearch, setClassSearch] = useState('');
  const [formError, setFormError] = useState('');

  useEffect(() => {
    if (isOpen) {
      classApi.getClasses({ per_page: 100 })
        .then((res) => {
          if (res.data && Array.isArray(res.data)) {
            setClassesList(res.data);
          }
        })
        .catch(() => {});
    }
  }, [isOpen]);

  useEffect(() => {
    if (initialData) {
      setTitle(initialData.title || '');
      setDescription(initialData.description || '');
      setType(initialData.type || 'holiday');
      setStartDate(initialData.start_date || '');
      setEndDate(initialData.end_date || '');
      setScopeType(initialData.scope_type || 'all');
      setDisablesTeaching(initialData.disables_teaching ?? true);

      if (initialData.scope_type === 'grade') {
        setSelectedGrades(Array.isArray(initialData.scope_targets) ? initialData.scope_targets.map(String) : ['10']);
      } else if (initialData.scope_type === 'class') {
        setSelectedClassIds(Array.isArray(initialData.scope_targets) ? initialData.scope_targets.map(Number) : []);
      }
    } else {
      // Reset form default
      const today = todayLocalISO();
      setTitle('');
      setDescription('');
      setType('holiday');
      setStartDate(today);
      setEndDate(today);
      setScopeType('all');
      setSelectedGrades(['10']);
      setSelectedClassIds([]);
      setDisablesTeaching(true);
    }
    setFormError('');
  }, [initialData, isOpen]);

  // Otomatis sesuaikan disables_teaching saat tipe event berubah (jika bukan mode edit)
  const handleTypeChange = (newType) => {
    setType(newType);
    const targetConfig = EVENT_TYPES.find((t) => t.value === newType);
    if (targetConfig) {
      setDisablesTeaching(targetConfig.defaultDisable);
    }
  };

  const handleGradeToggle = (grade) => {
    setSelectedGrades((prev) => {
      const gStr = String(grade);
      if (prev.includes(gStr)) {
        return prev.length > 1 ? prev.filter((g) => g !== gStr) : prev;
      }
      return [...prev, gStr];
    });
  };

  const handleClassToggle = (classId) => {
    setSelectedClassIds((prev) => {
      const id = Number(classId);
      if (prev.includes(id)) {
        return prev.filter((item) => item !== id);
      }
      return [...prev, id];
    });
  };

  const handleSelectAllFilteredClasses = () => {
    const ids = filteredClasses.map((c) => c.id);
    const allSelected = ids.every((id) => selectedClassIds.includes(id));
    if (allSelected) {
      setSelectedClassIds((prev) => prev.filter((id) => !ids.includes(id)));
    } else {
      setSelectedClassIds((prev) => Array.from(new Set([...prev, ...ids])));
    }
  };

  const filteredClasses = useMemo(() => {
    return classesList.filter((c) => {
      if (classFilterGrade !== 'ALL' && String(c.level) !== classFilterGrade) {
        return false;
      }
      if (classSearch.trim()) {
        const q = classSearch.toLowerCase().trim();
        const nameMatch = (c.name || '').toLowerCase().includes(q);
        const majorMatch = (c.major || '').toLowerCase().includes(q);
        if (!nameMatch && !majorMatch) return false;
      }
      return true;
    });
  }, [classesList, classFilterGrade, classSearch]);

  const handleSubmit = (e) => {
    e.preventDefault();
    setFormError('');

    if (!title.trim()) {
      setFormError('Nama kegiatan/agenda wajib diisi.');
      return;
    }
    if (!startDate) {
      setFormError('Tanggal mulai wajib diisi.');
      return;
    }
    if (!endDate) {
      setFormError('Tanggal selesai wajib diisi.');
      return;
    }
    if (endDate < startDate) {
      setFormError('Tanggal selesai tidak boleh lebih awal dari tanggal mulai.');
      return;
    }

    let scopeTargets = null;
    if (scopeType === 'grade') {
      if (selectedGrades.length === 0) {
        setFormError('Pilih minimal satu tingkatan kelas.');
        return;
      }
      scopeTargets = selectedGrades;
    } else if (scopeType === 'class') {
      if (selectedClassIds.length === 0) {
        setFormError('Pilih minimal satu rombel kelas.');
        return;
      }
      scopeTargets = selectedClassIds;
    }

    const payload = {
      title: title.trim(),
      description: description.trim() || null,
      start_date: startDate,
      end_date: endDate,
      type,
      scope_type: scopeType,
      scope_targets: scopeTargets,
      disables_teaching: disablesTeaching,
    };

    onSubmit?.(payload);
  };

  const footer = (
    <div className="flex justify-end gap-2 w-full">
      <Button variant="secondary" onClick={onClose} disabled={loading}>
        Batal
      </Button>
      <Button variant="primary" onClick={handleSubmit} loading={loading}>
        {initialData ? 'Simpan Perubahan' : 'Tambah Agenda'}
      </Button>
    </div>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={initialData ? 'Edit Agenda Kalender Akademik' : 'Tambah Agenda Kalender Akademik'}
      size="lg"
      footer={footer}
    >
      <form onSubmit={handleSubmit} className="space-y-4 text-sm text-gray-700">
        {formError && (
          <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded flex items-center gap-2 text-xs">
            <AlertCircle size={16} className="shrink-0 text-red-500" />
            <span>{formError}</span>
          </div>
        )}

        {/* Nama Agenda */}
        <div>
          <label className="block font-semibold mb-1 text-gray-800">
            Nama Kegiatan / Agenda <span className="text-red-500">*</span>
          </label>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Contoh: Kemah Pramuka Blok Kelas X, Libur Hari Guru, dll"
            className="w-full"
            autoFocus
          />
        </div>

        {/* Kategori Agenda & Rentang Tanggal */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="block font-semibold mb-1 text-gray-800">
              Kategori Agenda <span className="text-red-500">*</span>
            </label>
            <select
              value={type}
              onChange={(e) => handleTypeChange(e.target.value)}
              className="w-full h-10 px-3 border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 bg-white"
            >
              {EVENT_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-semibold mb-1 text-gray-800">
              Tanggal Mulai <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                if (!endDate || e.target.value > endDate) {
                  setEndDate(e.target.value);
                }
              }}
              className="w-full h-10 px-3 border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
              required
            />
          </div>

          <div>
            <label className="block font-semibold mb-1 text-gray-800">
              Tanggal Selesai <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              value={endDate}
              min={startDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full h-10 px-3 border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
              required
            />
          </div>
        </div>

        {/* Keterangan Tambahan */}
        <div>
          <label className="block font-semibold mb-1 text-gray-800">Deskripsi / Catatan Agenda</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Informasi detail kegiatan, surat edaran, atau instruksi pelaksanaan (opsional)"
            rows={2}
            className="w-full p-2.5 border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
          />
        </div>

        {/* Target Peserta / Cakupan (scope_type) */}
        <div className="border-t border-gray-200 pt-3">
          <label className="block font-semibold mb-2 text-gray-800 flex items-center gap-1.5">
            <Layers size={16} className="text-blue-600" />
            <span>Target Peserta / Cakupan Agenda</span>
          </label>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-3">
            <label
              className={`flex items-center gap-2 p-3 border rounded cursor-pointer transition ${
                scopeType === 'all' ? 'border-blue-500 bg-blue-50/50 text-blue-900 font-medium' : 'border-gray-200 hover:bg-gray-50'
              }`}
            >
              <input
                type="radio"
                name="scope_type"
                value="all"
                checked={scopeType === 'all'}
                onChange={() => setScopeType('all')}
                className="text-blue-600"
              />
              <div>
                <div className="text-xs font-semibold">Seluruh Sekolah</div>
                <div className="text-[11px] text-gray-500">Semua tingkat (10, 11, 12)</div>
              </div>
            </label>

            <label
              className={`flex items-center gap-2 p-3 border rounded cursor-pointer transition ${
                scopeType === 'grade' ? 'border-blue-500 bg-blue-50/50 text-blue-900 font-medium' : 'border-gray-200 hover:bg-gray-50'
              }`}
            >
              <input
                type="radio"
                name="scope_type"
                value="grade"
                checked={scopeType === 'grade'}
                onChange={() => setScopeType('grade')}
                className="text-blue-600"
              />
              <div>
                <div className="text-xs font-semibold">Tingkat Tertentu</div>
                <div className="text-[11px] text-gray-500">Khusus kelas 10, 11, atau 12</div>
              </div>
            </label>

            <label
              className={`flex items-center gap-2 p-3 border rounded cursor-pointer transition ${
                scopeType === 'class' ? 'border-blue-500 bg-blue-50/50 text-blue-900 font-medium' : 'border-gray-200 hover:bg-gray-50'
              }`}
            >
              <input
                type="radio"
                name="scope_type"
                value="class"
                checked={scopeType === 'class'}
                onChange={() => setScopeType('class')}
                className="text-blue-600"
              />
              <div>
                <div className="text-xs font-semibold">Rombel Tertentu</div>
                <div className="text-[11px] text-gray-500">Pilih rombel secara spesifik</div>
              </div>
            </label>
          </div>

          {/* Sub-Pilihan: Tingkat Tertentu */}
          {scopeType === 'grade' && (
            <div className="p-3 bg-gray-50 border border-gray-200 rounded mb-3">
              <span className="block text-xs font-semibold text-gray-700 mb-2">
                Pilih Tingkat Kelas yang Mengikuti Agenda:
              </span>
              <div className="flex gap-4">
                {['10', '11', '12'].map((g) => (
                  <label key={g} className="flex items-center gap-2 text-xs font-medium cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedGrades.includes(g)}
                      onChange={() => handleGradeToggle(g)}
                      className="rounded text-blue-600 focus:ring-blue-500 h-4 w-4"
                    />
                    <span>Tingkat {g}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Sub-Pilihan: Rombel Tertentu */}
          {scopeType === 'class' && (
            <div className="p-3 bg-gray-50 border border-gray-200 rounded mb-3 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-semibold text-gray-700">
                  Pilih Rombel Kelas ({selectedClassIds.length} rombel terpilih):
                </span>
                <div className="flex items-center gap-2">
                  <select
                    value={classFilterGrade}
                    onChange={(e) => setClassFilterGrade(e.target.value)}
                    className="h-8 px-2 text-xs border border-gray-300 rounded bg-white"
                  >
                    <option value="ALL">Semua Tingkat</option>
                    <option value="10">Tingkat 10</option>
                    <option value="11">Tingkat 11</option>
                    <option value="12">Tingkat 12</option>
                  </select>
                  <button
                    type="button"
                    onClick={handleSelectAllFilteredClasses}
                    className="text-xs text-blue-600 hover:underline font-medium"
                  >
                    Pilih Semua ({filteredClasses.length})
                  </button>
                </div>
              </div>

              <input
                type="text"
                placeholder="Cari nama rombel (misal: RPL, AK, DKV)..."
                value={classSearch}
                onChange={(e) => setClassSearch(e.target.value)}
                className="w-full h-8 px-2.5 text-xs border border-gray-300 rounded bg-white"
              />

              <div className="max-h-40 overflow-y-auto grid grid-cols-2 sm:grid-cols-3 gap-1.5 p-2 bg-white border border-gray-200 rounded">
                {filteredClasses.length === 0 ? (
                  <div className="col-span-full py-4 text-center text-xs text-gray-400">
                    Tidak ada rombel kelas yang cocok.
                  </div>
                ) : (
                  filteredClasses.map((cls) => {
                    const isSelected = selectedClassIds.includes(cls.id);
                    return (
                      <button
                        key={cls.id}
                        type="button"
                        onClick={() => handleClassToggle(cls.id)}
                        className={`flex items-center gap-1.5 p-1.5 rounded text-left text-xs transition ${
                          isSelected ? 'bg-blue-100 text-blue-800 font-semibold' : 'hover:bg-gray-50 text-gray-700'
                        }`}
                      >
                        {isSelected ? (
                          <CheckSquare size={14} className="text-blue-600 shrink-0" />
                        ) : (
                          <Square size={14} className="text-gray-400 shrink-0" />
                        )}
                        <span className="truncate">{cls.name}</span>
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>

        {/* Dampak KBM (Toggle Switch) */}
        <div className="border-t border-gray-200 pt-3">
          <label className="flex items-start gap-3 p-3 bg-amber-50/60 border border-amber-200 rounded cursor-pointer">
            <input
              type="checkbox"
              checked={disablesTeaching}
              onChange={(e) => setDisablesTeaching(e.target.checked)}
              className="mt-0.5 rounded text-amber-600 focus:ring-amber-500 h-4 w-4 shrink-0"
            />
            <div>
              <div className="text-xs font-semibold text-amber-900">
                Bebaskan Jadwal KBM &amp; Kewajiban Jurnal/Presensi
              </div>
              <div className="text-[11px] text-amber-700 leading-relaxed">
                Jika diaktifkan, kelas yang menjadi target agenda ini tidak wajib menyelenggarakan KBM reguler.
                Pengisian jurnal dan presensi dinonaktifkan tanpa menandai guru sebagai belum mengisi jurnal,
                dan jadwal dikeluarkan dari penyebut persentase kepatuhan.
              </div>
            </div>
          </label>
        </div>
      </form>
    </Modal>
  );
}
