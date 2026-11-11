import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Building2,
  Users,
  BookOpen,
  Layers,
  GraduationCap,
  Plus,
  Pencil,
  Trash2,
  RotateCw,
  X,
} from 'lucide-react';
import {
  Button,
  Modal,
  Input,
  Select,
  SearchInput,
  PasswordSheet,
  SegmentedTabs,
  DataTable,
  PaginationBar,
} from '../../components/shared';
import {
  classApi,
  roomApi,
  subjectApi,
  teacherApi,
  studentApi,
} from '../../services/masterDataApi';
import { EmptyState, ErrorState } from '../../components/feedback';

const TABS = [
  { id: 'kelas', label: 'Rombel', icon: Building2 },
  { id: 'guru', label: 'Guru', icon: Users },
  { id: 'mapel', label: 'Mapel', icon: BookOpen },
  { id: 'ruang', label: 'Ruang', icon: Layers },
  { id: 'siswa', label: 'Siswa', icon: GraduationCap },
];

function rowMeta(tab, item) {
  if (tab === 'kelas') return `Tingkat ${item.level || '-'}${item.major ? ` · ${item.major}` : ''}`;
  if (tab === 'guru') return `${item.nis_nip || 'Tanpa NIP'} · ${item.email || 'Tanpa email'}`;
  if (tab === 'mapel') return `${item.code || '-'} · ${item.default_jp || 2} JP`;
  if (tab === 'ruang') return `${item.code || '-'} · ${item.capacity || 36} siswa`;
  if (tab === 'siswa') return `${item.nis_nip || '-'} · ${item.school_class?.name || 'Tanpa rombel'}`;
  return '';
}

export default function MasterDataPage() {
  const [activeTab, setActiveTab] = useState('kelas');
  const [searchQuery, setSearchQuery] = useState('');

  // Data states
  const [classList, setClassList] = useState([]);
  const [roomList, setRoomList] = useState([]);
  const [subjectList, setSubjectList] = useState([]);
  const [teacherList, setTeacherList] = useState([]);
  const [studentList, setStudentList] = useState([]);

  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  // Pagination (server-side)
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // Toast
  const [toastMessage, setToastMessage] = useState(null);
  const [toastType, setToastType] = useState('success');

  // Form Modal (Add / Edit)
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  // Dynamic Form Data
  const [formData, setFormData] = useState({});

  // Password confirmation for delete
  const [isPasswordSheetOpen, setIsPasswordSheetOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordError, setPasswordError] = useState('');

  const showToast = (msg, type = 'success') => {
    setToastMessage(msg);
    setToastType(type);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Debounce pencarian (server-side)
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery.trim()), 350);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Kembali ke halaman 1 saat tab / pencarian / jumlah baris berubah
  useEffect(() => {
    setPage(1);
  }, [activeTab, debouncedSearch, perPage]);

  const setListForTab = useCallback((tab, list) => {
    if (tab === 'kelas') setClassList(list);
    else if (tab === 'guru') setTeacherList(list);
    else if (tab === 'mapel') setSubjectList(list);
    else if (tab === 'ruang') setRoomList(list);
    else if (tab === 'siswa') setStudentList(list);
  }, []);

  const fetchTabData = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = { page, per_page: perPage };
      if (debouncedSearch) params.search = debouncedSearch;

      let res;
      if (activeTab === 'kelas') res = await classApi.getClasses(params);
      else if (activeTab === 'guru') res = await teacherApi.getTeachers(params);
      else if (activeTab === 'mapel') res = await subjectApi.getSubjects(params);
      else if (activeTab === 'ruang') res = await roomApi.getRooms(params);
      else res = await studentApi.getStudents(params);

      const list = Array.isArray(res) ? res : Array.isArray(res?.data) ? res.data : [];
      setListForTab(activeTab, list);

      const meta = res?.meta || {};
      const total = Number(meta.total ?? list.length);
      setTotalItems(total);
      setTotalPages(Number(meta.last_page ?? Math.max(1, Math.ceil(total / perPage))) || 1);
      setLoadError(null);
    } catch (err) {
      setLoadError(err.message || 'Gagal memuat master data.');
    } finally {
      setIsLoading(false);
    }
  }, [activeTab, page, perPage, debouncedSearch, setListForTab]);

  useEffect(() => {
    fetchTabData();
  }, [fetchTabData]);

  const handleRefresh = () => {
    fetchTabData();
  };

  // Open Add Modal
  const handleOpenAdd = () => {
    setEditingItem(null);
    setFormError('');
    if (activeTab === 'kelas') {
      setFormData({ name: '', level: '10', major: '' });
    } else if (activeTab === 'guru') {
      setFormData({ name: '', nis_nip: '', email: '', phone: '' });
    } else if (activeTab === 'mapel') {
      setFormData({ code: '', name: '', default_jp: 2 });
    } else if (activeTab === 'ruang') {
      setFormData({ code: '', name: '', capacity: 36 });
    } else if (activeTab === 'siswa') {
      setFormData({ name: '', nis_nip: '', class_id: classList[0]?.id || '', gender: 'L' });
    }
    setIsModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEdit = (item) => {
    setEditingItem(item);
    setFormError('');
    if (activeTab === 'kelas') {
      setFormData({ name: item.name || '', level: String(item.level || '10'), major: item.major || '' });
    } else if (activeTab === 'guru') {
      setFormData({
        name: item.name || '',
        nis_nip: item.nis_nip || '',
        email: item.email || '',
        phone: item.phone || '',
      });
    } else if (activeTab === 'mapel') {
      setFormData({
        code: item.code || '',
        name: item.name || '',
        default_jp: item.default_jp || 2,
      });
    } else if (activeTab === 'ruang') {
      setFormData({
        code: item.code || '',
        name: item.name || '',
        capacity: item.capacity || 36,
      });
    } else if (activeTab === 'siswa') {
      setFormData({
        name: item.name || '',
        nis_nip: item.nis_nip || '',
        class_id: item.class_id || '',
        gender: item.gender || 'L',
      });
    }
    setIsModalOpen(true);
  };

  // Submit Modal Form
  const handleFormSubmit = async (e) => {
    if (e) e.preventDefault();
    setFormSubmitting(true);
    setFormError('');

    try {
      if (activeTab === 'kelas') {
        if (editingItem) {
          await classApi.update(editingItem.id, formData);
        } else {
          await classApi.create(formData);
        }
      } else if (activeTab === 'guru') {
        if (editingItem) {
          await teacherApi.update(editingItem.id, formData);
        } else {
          await teacherApi.create(formData);
        }
      } else if (activeTab === 'mapel') {
        if (editingItem) {
          await subjectApi.update(editingItem.id, formData);
        } else {
          await subjectApi.create(formData);
        }
      } else if (activeTab === 'ruang') {
        if (editingItem) {
          await roomApi.update(editingItem.id, formData);
        } else {
          await roomApi.create(formData);
        }
      } else if (activeTab === 'siswa') {
        if (editingItem) {
          await studentApi.update(editingItem.id, formData);
        } else {
          await studentApi.create(formData);
        }
      }

      showToast(`Data ${activeTab} berhasil disimpan.`);
      setIsModalOpen(false);
      handleRefresh();
    } catch (err) {
      setFormError(err.response?.data?.message || err.message || 'Gagal menyimpan data.');
    } finally {
      setFormSubmitting(false);
    }
  };

  // Trigger Delete
  const handleTriggerDelete = (id) => {
    setPendingDelete({ tab: activeTab, id });
    setPasswordError('');
    setIsPasswordSheetOpen(true);
  };

  const handlePasswordConfirmDelete = async (password) => {
    setPasswordLoading(true);
    setPasswordError('');
    try {
      const { tab, id } = pendingDelete;
      if (tab === 'kelas') await classApi.delete(id, { password });
      else if (tab === 'guru') await teacherApi.delete(id, { password });
      else if (tab === 'mapel') await subjectApi.delete(id, { password });
      else if (tab === 'ruang') await roomApi.delete(id, { password });
      else if (tab === 'siswa') await studentApi.delete(id, { password });

      showToast(`Data berhasil dihapus dan dipindahkan ke Tempat Sampah.`);
      setIsPasswordSheetOpen(false);
      handleRefresh();
    } catch (err) {
      setPasswordError(
        err.response?.data?.message || err.message || 'Kata sandi salah atau data memiliki dependensi jadwal.'
      );
    } finally {
      setPasswordLoading(false);
    }
  };

  // Daftar aktif (server-side pagination — pencarian & halaman diurus API)
  const currentItems = useMemo(() => {
    if (activeTab === 'kelas') return classList;
    if (activeTab === 'guru') return teacherList;
    if (activeTab === 'mapel') return subjectList;
    if (activeTab === 'ruang') return roomList;
    return studentList;
  }, [activeTab, classList, teacherList, subjectList, roomList, studentList]);

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
          <h1 className="text-sm font-bold text-[var(--color-text-primary)]">Master Data Akademik</h1>
          <p className="text-[11px] text-[var(--color-text-muted)]">
            Kelola entitas kurikulum tanpa fitur import Excel
          </p>
        </div>
        <Button
          size="sm"
          variant="primary"
          onClick={handleOpenAdd}
          className="gap-1.5 text-xs font-semibold px-3 py-1.5"
        >
          <Plus size={14} />
          Tambah
        </Button>
      </div>

      {/* Segmented Tabs */}
      <SegmentedTabs
        tabs={TABS.map((t) => ({ id: t.id, label: t.label, icon: t.icon }))}
        activeTab={activeTab}
        onChange={(id) => {
          setActiveTab(id);
          setSearchQuery('');
        }}
      />

      {/* Search Input */}
      <div className="flex gap-2">
        <SearchInput
          placeholder={`Cari data ${activeTab}...`}
          value={searchQuery}
          onChange={(value) => setSearchQuery(value)}
        />
        <Button
          size="sm"
          variant="ghost"
          onClick={handleRefresh}
          className="p-2 h-10 w-10 min-h-0 border border-[var(--color-border-subtle)] bg-[var(--color-surface)] rounded-[14px]"
          aria-label="Segarkan"
        >
          <RotateCw size={14} />
        </Button>
      </div>

      {/* Daftar data — tabel + pagination */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="section-label">
            Daftar {activeTab.toUpperCase()} ({totalItems} Data)
          </span>
        </div>

        {loadError ? (
          <ErrorState message={loadError} onRetry={handleRefresh} />
        ) : (
          <DataTable
            columns={[
              { key: 'no', label: '#', width: 30, align: 'center' },
              { key: 'name', label: 'Nama / Identitas' },
              { key: 'actions', label: 'Aksi', width: 74, align: 'right' },
            ]}
            rows={currentItems}
            isLoading={isLoading}
            skeletonRows={Math.min(perPage, 10)}
            ariaLabel={`Daftar ${activeTab}`}
            empty={
              <EmptyState
                title={`Tidak Ada Data ${activeTab}`}
                message="Belum ada data pada kategori ini atau kata kunci pencarian tidak ditemukan."
              />
            }
            renderRow={(item, index) => (
              <tr key={item.id}>
                <td className="data-table__no">
                  {String((page - 1) * perPage + index + 1).padStart(2, '0')}
                </td>
                <td>
                  <span className="data-table__cell-title">{item.name}</span>
                  <span className="data-table__cell-meta">{rowMeta(activeTab, item)}</span>
                </td>
                <td>
                  <div className="data-table__actions">
                    <button
                      type="button"
                      className="data-table__action"
                      onClick={() => handleOpenEdit(item)}
                      aria-label={`Ubah ${item.name}`}
                    >
                      <Pencil size={13} />
                    </button>
                    <button
                      type="button"
                      className="data-table__action data-table__action--danger"
                      onClick={() => handleTriggerDelete(item.id)}
                      aria-label={`Hapus ${item.name}`}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </td>
              </tr>
            )}
            footer={
              <PaginationBar
                currentPage={page}
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

      {/* Dynamic Form Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={`${editingItem ? 'Ubah' : 'Tambah'} ${activeTab.toUpperCase()}`}
      >
        <form onSubmit={handleFormSubmit} className="space-y-3">
          {formError && (
            <div className="p-2.5 bg-[var(--color-danger-bg)] border border-[var(--color-danger-border)] text-[var(--color-danger-fg)] text-xs rounded-[14px]">
              {formError}
            </div>
          )}

          {activeTab === 'kelas' && (
            <>
              <Input
                label="Nama Rombel / Kelas"
                placeholder="Contoh: XII RPL 1"
                value={formData.name || ''}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-semibold text-[var(--color-text-primary)] block mb-1">Tingkat</label>
                  <Select
                    value={formData.level || '10'}
                    onChange={(e) => setFormData({ ...formData, level: e.target.value })}
                  >
                    <option value="10">Kelas 10 (X)</option>
                    <option value="11">Kelas 11 (XI)</option>
                    <option value="12">Kelas 12 (XII)</option>
                  </Select>
                </div>
                <Input
                  label="Konsentrasi Keahlian"
                  placeholder="Contoh: Rekayasa Perangkat Lunak"
                  value={formData.major || ''}
                  onChange={(e) => setFormData({ ...formData, major: e.target.value })}
                />
              </div>
            </>
          )}

          {activeTab === 'guru' && (
            <>
              <Input
                label="Nama Lengkap & Gelar"
                placeholder="Contoh: Budi Santoso, S.Kom."
                value={formData.name || ''}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
              <Input
                label="NIP / No. Induk"
                placeholder="19820315..."
                value={formData.nis_nip || ''}
                onChange={(e) => setFormData({ ...formData, nis_nip: e.target.value })}
              />
              <Input
                type="email"
                label="Email Akun"
                placeholder="budi@sekolah.sch.id"
                value={formData.email || ''}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
              <Input
                label="Nomor WhatsApp"
                placeholder="08123456789"
                value={formData.phone || ''}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              />
            </>
          )}

          {activeTab === 'mapel' && (
            <>
              <Input
                label="Kode Mapel"
                placeholder="Contoh: RPL-01"
                value={formData.code || ''}
                onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                required
              />
              <Input
                label="Nama Mata Pelajaran"
                placeholder="Pemrograman Berorientasi Objek"
                value={formData.name || ''}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
              <Input
                type="number"
                label="Standar JP Per Sesi"
                value={formData.default_jp || 2}
                onChange={(e) => setFormData({ ...formData, default_jp: Number(e.target.value) })}
                required
              />
            </>
          )}

          {activeTab === 'ruang' && (
            <>
              <Input
                label="Kode Ruangan"
                placeholder="LAB-01"
                value={formData.code || ''}
                onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                required
              />
              <Input
                label="Nama Ruang / Laboratorium"
                placeholder="Lab Komputer Software 1"
                value={formData.name || ''}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
              <Input
                type="number"
                label="Kapasitas Siswa"
                value={formData.capacity || 36}
                onChange={(e) => setFormData({ ...formData, capacity: Number(e.target.value) })}
                required
              />
            </>
          )}

          {activeTab === 'siswa' && (
            <>
              <Input
                label="Nama Siswa"
                placeholder="Contoh: Ahmad Fauzan"
                value={formData.name || ''}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
              <Input
                label="NIS / NISN"
                placeholder="21221001"
                value={formData.nis_nip || ''}
                onChange={(e) => setFormData({ ...formData, nis_nip: e.target.value })}
              />
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-semibold text-[var(--color-text-primary)] block mb-1">Rombel</label>
                  <Select
                    value={formData.class_id || ''}
                    onChange={(e) => setFormData({ ...formData, class_id: e.target.value })}
                    required
                  >
                    <option value="">Pilih Rombel...</option>
                    {classList.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </Select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-[var(--color-text-primary)] block mb-1">Jenis Kelamin</label>
                  <Select
                    value={formData.gender || 'L'}
                    onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                  >
                    <option value="L">Laki-laki</option>
                    <option value="P">Perempuan</option>
                  </Select>
                </div>
              </div>
            </>
          )}

          <div className="pt-2 flex gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setIsModalOpen(false)}
              className="flex-1"
            >
              Batal
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={formSubmitting}
              className="flex-1"
            >
              {formSubmitting ? 'Menyimpan...' : editingItem ? 'Simpan Perubahan' : 'Tambah'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Password Confirmation Sheet */}
      <PasswordSheet
        isOpen={isPasswordSheetOpen}
        onClose={() => setIsPasswordSheetOpen(false)}
        onConfirm={handlePasswordConfirmDelete}
        title={`Hapus Data ${pendingDelete?.tab || 'Master'}`}
        description="Masukkan kata sandi Waka Kurikulum untuk menghapus entitas ini."
        isLoading={passwordLoading}
        errorMessage={passwordError}
      />
    </div>
  );
}
