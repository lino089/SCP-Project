import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Plus,
  Pencil,
  Trash2,
  UserCheck,
  Info,
  Upload,
  CheckCircle2,
  AlertCircle,
  CheckSquare,
  XSquare,
  Eye,
  Clock,
} from 'lucide-react';
import {
  Button,
  Input,
  Select,
  Modal,
  Table,
  Badge,
  Tabs,
  SearchInput,
  ConfirmDialog,
  FileUpload,
  PasswordModal,
} from '../../components/shared';
import { SkeletonRow, EmptyState, ErrorState } from '../../components/feedback';
import { authApi } from '../../services/api';
import {
  masterDataSummaryApi,
  classApi,
  roomApi,
  subjectApi,
  teacherApi,
  studentApi,
  recycleBinApi,
} from '../../services/masterDataApi';
import InitialCredentialModal from './components/InitialCredentialModal';
import TeacherAssignmentModal from './components/TeacherAssignmentModal';
import TeacherAssignmentTab from './components/TeacherAssignmentTab';
import DeleteConflictDialog from './components/DeleteConflictDialog';
import DeleteConfirmationModal from './components/DeleteConfirmationModal';
import { unwrap } from '../../utils/responseHelper';
import './MasterData.css';

export default function MasterDataPage() {
  const [activeTab, setActiveTab] = useState('kelas');
  const [searchQuery, setSearchQuery] = useState('');
  const [levelFilter, setLevelFilter] = useState('ALL');

  // Master datasets
  const [classList, setClassList] = useState([]);
  const [roomList, setRoomList] = useState([]);
  const [subjectList, setSubjectList] = useState([]);
  const [teacherList, setTeacherList] = useState([]);
  const [studentList, setStudentList] = useState([]);
  const [studentPagination, setStudentPagination] = useState({
    currentPage: 1,
    lastPage: 1,
    total: 0,
    perPage: 25,
  });
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [trashList, setTrashList] = useState([]);
  const [trashEntityFilter, setTrashEntityFilter] = useState('all');
  const [isRestoring, setIsRestoring] = useState(false);
  const [tabCounts, setTabCounts] = useState({ kelas: 0, ruang: 0, mapel: 0, guru: 0, siswa: 0, penugasan: 0, trash: 0 });
  const [loadedTabs, setLoadedTabs] = useState(new Set());

  // Teacher Import & Template states
  const [isTeacherImportModalOpen, setIsTeacherImportModalOpen] = useState(false);
  const [teacherImportFile, setTeacherImportFile] = useState(null);
  const [teacherImportLoading, setTeacherImportLoading] = useState(false);
  const [teacherImportSuccess, setTeacherImportSuccess] = useState(null);
  const [teacherImportErrors, setTeacherImportErrors] = useState(null);
  const [teacherImportGeneralError, setTeacherImportGeneralError] = useState(null);
  const [teacherDownloadingTemplate, setTeacherDownloadingTemplate] = useState(false);

  // Student Import & Template states
  const [isStudentImportModalOpen, setIsStudentImportModalOpen] = useState(false);
  const [studentImportFile, setStudentImportFile] = useState(null);
  const [studentImportLoading, setStudentImportLoading] = useState(false);
  const [studentImportSuccess, setStudentImportSuccess] = useState(null);
  const [studentImportErrors, setStudentImportErrors] = useState(null);
  const [studentImportGeneralError, setStudentImportGeneralError] = useState(null);
  const [studentDownloadingTemplate, setStudentDownloadingTemplate] = useState(false);

  // Loading & error state per tab
  const [isLoading, setIsLoading] = useState(false);
  const [fetchError, setFetchError] = useState(null);

  // Form modal states
  const [modalType, setModalType] = useState(null); // 'create' | 'edit' | null
  const [editingItem, setEditingItem] = useState(null);
  const [formData, setFormData] = useState({});
  const [formErrors, setFormErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Delete dialog states
  const [smartDeleteItem, setSmartDeleteItem] = useState(null);
  const [smartDeleteError, setSmartDeleteError] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [conflictError, setConflictError] = useState(null); // { entityName, entityType, message }

  // Initial credential modal (shows newly generated password)
  const [credentialModalData, setCredentialModalData] = useState(null);

  // Teacher assignment modal
  const [assignmentTeacher, setAssignmentTeacher] = useState(null);

  // Row selection states for Guru and Siswa
  const [selectedTeacherIds, setSelectedTeacherIds] = useState([]);
  const [selectedStudentIds, setSelectedStudentIds] = useState([]);

  // Detail Modal state (Read action)
  const [detailItem, setDetailItem] = useState(null);

  // Bulk Delete states
  const [isBulkDeleteOpen, setIsBulkDeleteOpen] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [bulkDeleteSummary, setBulkDeleteSummary] = useState(null);

  // Step-Up Auth Password Confirmation States
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [passwordModalLoading, setPasswordModalLoading] = useState(false);
  const [passwordModalError, setPasswordModalError] = useState('');
  const [pendingPasswordAction, setPendingPasswordAction] = useState(null);

  // Fetch summary counts for instant tab badges (~2ms)
  const refreshSummary = useCallback(async () => {
    try {
      const [res, trashRes] = await Promise.all([
        masterDataSummaryApi.getSummary().catch(() => null),
        recycleBinApi.getTrash({ per_page: 1 }).catch(() => null),
      ]);
      if (res?.data) {
        setTabCounts({
          kelas: Number(res.data.classes || 0),
          ruang: Number(res.data.rooms || 0),
          mapel: Number(res.data.subjects || 0),
          guru: Number(res.data.teachers || 0),
          siswa: Number(res.data.students || 0),
          penugasan: Number(res.data.classes || 0),
          trash: Number(trashRes?.meta?.total ?? trashRes?.data?.meta?.total ?? 0),
        });
      }
    } catch {
      // Graceful fallback
    }
  }, []);

  // Debounce search query specifically for server-side queries
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(typeof searchQuery === 'string' ? searchQuery.trim() : '');
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Load specific tab data with in-memory caching
  const loadTabData = useCallback(async (tabId, force = false) => {
    if (tabId === 'siswa') {
      // Siswa tab uses server-side pagination handled by fetchStudents
      return;
    }

    if (!force && loadedTabs.has(tabId)) {
      // Data already in memory, render instantly
      return;
    }

    setIsLoading(true);
    setFetchError(null);
    try {
      if (tabId === 'kelas') {
        const res = await classApi.getClasses({ per_page: 100 });
        if (res?.data) {
          setClassList(res.data);
          setTabCounts((prev) => ({ ...prev, kelas: res.data.length }));
        }
      } else if (tabId === 'ruang') {
        const res = await roomApi.getRooms({ per_page: 100 });
        if (res?.data) {
          setRoomList(res.data);
          setTabCounts((prev) => ({ ...prev, ruang: res.data.length }));
        }
      } else if (tabId === 'mapel') {
        const res = await subjectApi.getSubjects({ per_page: 100 });
        if (res?.data) {
          setSubjectList(res.data);
          setTabCounts((prev) => ({ ...prev, mapel: res.data.length }));
        }
      } else if (tabId === 'guru') {
        const [tRes, cRes, sRes] = await Promise.all([
          teacherApi.getTeachers({ per_page: 100 }),
          classApi.getClasses({ per_page: 100 }).catch(() => null),
          subjectApi.getSubjects({ per_page: 100 }).catch(() => null),
        ]);
        if (tRes?.data) {
          setTeacherList(tRes.data);
          setTabCounts((prev) => ({ ...prev, guru: tRes.data.length }));
        }
        if (cRes?.data) setClassList(cRes.data);
        if (sRes?.data) setSubjectList(sRes.data);
      } else if (tabId === 'penugasan') {
        const [tRes, cRes] = await Promise.all([
          teacherList.length ? Promise.resolve(null) : teacherApi.getTeachers({ per_page: 100 }),
          classList.length ? Promise.resolve(null) : classApi.getClasses({ per_page: 100 }).catch(() => null),
        ]);
        if (tRes?.data) setTeacherList(tRes.data);
        if (cRes?.data) setClassList(cRes.data);
      } else if (tabId === 'trash') {
        const res = await recycleBinApi.getTrash({ per_page: 200 });
        if (res?.data) {
          setTrashList(res.data);
          setTabCounts((prev) => ({ ...prev, trash: res.meta?.total ?? res.data.length }));
        }
      }
      setLoadedTabs((prev) => new Set(prev).add(tabId));
    } catch (err) {
      setFetchError(err.message || 'Gagal memuat data.');
      if (tabId === 'kelas') setClassList([]);
      else if (tabId === 'ruang') setRoomList([]);
      else if (tabId === 'mapel') setSubjectList([]);
      else if (tabId === 'guru') { setTeacherList([]); setClassList([]); }
      else if (tabId === 'siswa') { setStudentList([]); setClassList([]); }
      else if (tabId === 'trash') { setTrashList([]); }
    } finally {
      setIsLoading(false);
    }
  }, [loadedTabs]);

  // Fetch paginated students with server-side filtering & sorting
  const fetchStudents = useCallback(
    async (page = 1, search = debouncedSearchQuery, level = levelFilter) => {
      setIsLoading(true);
      setFetchError(null);
      try {
        const params = {
          page,
          per_page: 25,
        };
        if (search) params.search = search;
        if (level && level !== 'ALL') params.level = level;

        const [sRes, cRes] = await Promise.all([
          studentApi.getStudents(params),
          classList.length === 0 ? classApi.getClasses({ per_page: 100 }).catch(() => null) : null,
        ]);

        if (sRes?.data) {
          setStudentList(Array.isArray(sRes.data) ? sRes.data : []);
          if (sRes.meta) {
            setStudentPagination({
              currentPage: sRes.meta.current_page || 1,
              lastPage: sRes.meta.last_page || 1,
              total: sRes.meta.total || 0,
              perPage: sRes.meta.per_page || 25,
            });
            setTabCounts((prev) => ({ ...prev, siswa: sRes.meta.total || 0 }));
          }
        }
        if (cRes?.data) setClassList(cRes.data);
      } catch (err) {
        setFetchError(err.message || 'Gagal memuat data siswa.');
        setStudentList([]);
      } finally {
        setIsLoading(false);
      }
    },
    [debouncedSearchQuery, levelFilter, classList.length]
  );

  // Load students whenever activeTab is siswa or filters change
  useEffect(() => {
    if (activeTab === 'siswa') {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      fetchStudents(1, debouncedSearchQuery, levelFilter);
    }
  }, [activeTab, debouncedSearchQuery, levelFilter, fetchStudents]);

  const handleStudentPageChange = useCallback(
    (page) => {
      fetchStudents(page, debouncedSearchQuery, levelFilter);
    },
    [fetchStudents, debouncedSearchQuery, levelFilter]
  );

  // Load summary on mount
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refreshSummary();
  }, [refreshSummary]);

  // Load active tab data on mount & tab change
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadTabData(activeTab);
  }, [activeTab, loadTabData]);

  // Manual refresh handler
  const handleRefresh = useCallback(async () => {
    refreshSummary();
    if (activeTab === 'siswa') {
      await fetchStudents(studentPagination.currentPage, debouncedSearchQuery, levelFilter);
    } else {
      await loadTabData(activeTab, true);
    }
  }, [activeTab, loadTabData, refreshSummary, fetchStudents, studentPagination.currentPage, debouncedSearchQuery, levelFilter]);

  // Template Download Handlers
  const handleDownloadTeacherTemplate = async () => {
    setTeacherDownloadingTemplate(true);
    try {
      const blob = await teacherApi.downloadTemplate();
      const url = window.URL.createObjectURL(new Blob([blob]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'guru_import_template.xlsx');
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert('Gagal mengunduh template Excel guru: ' + (err.message || 'Terjadi kesalahan'));
    } finally {
      setTeacherDownloadingTemplate(false);
    }
  };

  const handleDownloadStudentTemplate = async () => {
    setStudentDownloadingTemplate(true);
    try {
      const blob = await studentApi.downloadTemplate();
      const url = window.URL.createObjectURL(new Blob([blob]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'siswa_import_template.xlsx');
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert('Gagal mengunduh template Excel siswa: ' + (err.message || 'Terjadi kesalahan'));
    } finally {
      setStudentDownloadingTemplate(false);
    }
  };

  // Submit Import Handlers
  const handleSubmitTeacherImport = async () => {
    if (!teacherImportFile) return;
    setTeacherImportLoading(true);
    setTeacherImportErrors(null);
    setTeacherImportGeneralError(null);
    setTeacherImportSuccess(null);

    const formData = new FormData();
    formData.append('file', teacherImportFile);

    try {
      const res = await teacherApi.importTeachers(formData);
      setTeacherImportSuccess(res.data || { imported_count: 0 });
      // Refresh teacherList and subjectList
      const [tRes, sRes] = await Promise.all([
        teacherApi.getTeachers({ per_page: 100 }).catch(() => null),
        subjectApi.getSubjects({ per_page: 100 }).catch(() => null),
      ]);
      if (tRes?.data) setTeacherList(tRes.data);
      if (sRes?.data) setSubjectList(sRes.data);
      refreshSummary();
    } catch (err) {
      if (Array.isArray(err.errors)) {
        setTeacherImportErrors(err.errors);
      } else if (err.raw?.response?.data?.errors && Array.isArray(err.raw.response.data.errors)) {
        setTeacherImportErrors(err.raw.response.data.errors);
      } else if (err.raw?.response?.data?.errors?.file) {
        setTeacherImportGeneralError(err.raw.response.data.errors.file[0]);
      } else {
        setTeacherImportGeneralError(err.message || 'Gagal mengimpor data guru.');
      }
    } finally {
      setTeacherImportLoading(false);
    }
  };

  const handleSubmitStudentImport = async () => {
    if (!studentImportFile) return;
    setStudentImportLoading(true);
    setStudentImportErrors(null);
    setStudentImportGeneralError(null);
    setStudentImportSuccess(null);

    const formData = new FormData();
    formData.append('file', studentImportFile);

    try {
      const res = await studentApi.importStudents(formData);
      setStudentImportSuccess(res.data || {});
      // Refresh both studentList and classList (since classes may be auto-created!)
      await fetchStudents(1, '', 'ALL');
      const cRes = await classApi.getClasses({ per_page: 100 }).catch(() => null);
      if (cRes?.data) setClassList(cRes.data);
      refreshSummary();
    } catch (err) {
      if (Array.isArray(err.errors)) {
        setStudentImportErrors(err.errors);
      } else if (err.raw?.response?.data?.errors && Array.isArray(err.raw.response.data.errors)) {
        setStudentImportErrors(err.raw.response.data.errors);
      } else if (err.raw?.response?.data?.errors?.file) {
        setStudentImportGeneralError(err.raw.response.data.errors.file[0]);
      } else {
        setStudentImportGeneralError(err.message || 'Gagal mengimpor data siswa.');
      }
    } finally {
      setStudentImportLoading(false);
    }
  };

  // Stable callback to update assignment tab count without unnecessary re-renders
  const handleAssignmentCountUpdate = useCallback((cnt) => {
    setTabCounts((prev) => (prev.penugasan === cnt ? prev : { ...prev, penugasan: cnt }));
  }, []);

  // Tab definitions
  const tabs = useMemo(
    () => [
      { id: 'kelas', label: 'Kelas', count: tabCounts.kelas },
      { id: 'ruang', label: 'Ruang', count: tabCounts.ruang },
      { id: 'mapel', label: 'Mata Pelajaran', count: tabCounts.mapel },
      { id: 'guru', label: 'Guru', count: tabCounts.guru },
      { id: 'siswa', label: 'Siswa', count: tabCounts.siswa },
      { id: 'penugasan', label: 'Penugasan Guru', count: tabCounts.penugasan || 0 },
      { id: 'trash', label: 'Tempat Sampah', count: tabCounts.trash || 0 },
    ],
    [tabCounts]
  );

  const handleTabChange = (tabId) => {
    setActiveTab(tabId);
    setSearchQuery('');
    setLevelFilter('ALL');
    setFormErrors({});
  };

  // Open Add modal
  const handleOpenAdd = () => {
    setModalType('create');
    setEditingItem(null);
    setFormErrors({});

    switch (activeTab) {
      case 'kelas':
        setFormData({ name: '', level: '10', next_class_id: '' });
        break;
      case 'ruang':
        setFormData({ name: '', capacity: '36' });
        break;
      case 'mapel':
        setFormData({ name: '' });
        break;
      case 'guru':
        setFormData({
          name: '',
          nip: '',
          email: '',
          phone_number: '',
          subject_id: '',
        });
        break;
      case 'siswa':
        setFormData({
          name: '',
          nis: '',
          student_number: '',
          gender: '',
          nisn: '',
          class_id: classList[0]?.id ? String(classList[0].id) : '',
        });
        break;
      default:
        setFormData({});
    }
  };

  // Open Edit modal
  const handleOpenEdit = useCallback((item) => {
    setModalType('edit');
    setEditingItem(item);
    setFormErrors({});

    if (activeTab === 'kelas') {
      setFormData({
        name: item.name || '',
        level: String(item.level || 10),
        next_class_id: item.next_class_id ? String(item.next_class_id) : '',
      });
    } else if (activeTab === 'ruang') {
      setFormData({
        name: item.name || '',
        capacity: String(item.capacity || 36),
      });
    } else if (activeTab === 'mapel') {
      setFormData({
        name: item.name || '',
      });
    } else if (activeTab === 'guru') {
      setFormData({
        name: item.name || '',
        nip: item.nis_nip || item.nip || '',
        email: item.email || '',
        phone_number: item.phone_number || item.telp || '',
        subject_id: item.subject_id ? String(item.subject_id) : (item.subject?.id ? String(item.subject.id) : ''),
      });
    } else if (activeTab === 'siswa') {
      setFormData({
        name: item.name || '',
        nis: item.nis_nip || item.nis || '',
        student_number: item.student_number ? String(item.student_number) : '',
        gender: item.gender || '',
        nisn: item.nisn || '',
        class_id: item.class_id ? String(item.class_id) : (item.school_class?.id ? String(item.school_class.id) : (item.schoolClass?.id ? String(item.schoolClass.id) : '')),
      });
    }
  }, [activeTab]);

  // Save form handler (Create / Edit)
  const handleSaveForm = async (e) => {
    e.preventDefault();
    setFormErrors({});
    setIsSubmitting(true);

    try {
      if (modalType === 'create') {
        if (activeTab === 'kelas') {
          const payload = {
            name: formData.name,
            level: Number(formData.level),
            next_class_id: formData.next_class_id ? Number(formData.next_class_id) : null,
          };
          try {
            const res = await classApi.createClass(payload);
            setClassList((prev) => [...prev, res.data || res]);
          } catch (apiErr) {
            setFormErrors(apiErr.errors || { general: [apiErr.message || 'Gagal menambahkan kelas.'] });
            setIsSubmitting(false);
            return;
          }
        } else if (activeTab === 'ruang') {
          const payload = {
            name: formData.name,
            capacity: Number(formData.capacity),
          };
          try {
            const res = await roomApi.createRoom(payload);
            setRoomList((prev) => [...prev, res.data || res]);
          } catch (apiErr) {
            setFormErrors(apiErr.errors || { general: [apiErr.message || 'Gagal menambahkan ruang.'] });
            setIsSubmitting(false);
            return;
          }
        } else if (activeTab === 'mapel') {
          const payload = { name: formData.name };
          try {
            const res = await subjectApi.createSubject(payload);
            setSubjectList((prev) => [...prev, res.data || res]);
          } catch (apiErr) {
            setFormErrors(apiErr.errors || { general: [apiErr.message || 'Gagal menambahkan mata pelajaran.'] });
            setIsSubmitting(false);
            return;
          }
        } else if (activeTab === 'guru') {
          const errors = {};
          if (!formData.name?.trim()) errors.name = ['Nama lengkap guru wajib diisi.'];
          if (!formData.nip?.trim()) errors.nip = ['NIP / ID Guru wajib diisi.'];
          if (formData.phone_number?.trim()) {
            if (!/^(\+62|62|0)8[1-9][0-9]{6,11}$/.test(formData.phone_number.trim().replace(/[-\s]/g, ''))) {
              errors.phone_number = ['Format nomor telepon tidak valid. Gunakan format Indonesia (contoh: 081234567890).'];
            }
          }

          if (Object.keys(errors).length > 0) {
            setFormErrors(errors);
            setIsSubmitting(false);
            return;
          }

          const payload = {
            name: formData.name.trim(),
            nip: formData.nip.trim(),
            email: formData.email ? formData.email.trim() : null,
            phone_number: formData.phone_number?.trim() || null,
            subject_id: formData.subject_id ? Number(formData.subject_id) : null,
          };
          try {
            const res = await teacherApi.createTeacher(payload);
            const createdTeacher = res.data?.teacher || res.data;
            if (createdTeacher && !createdTeacher.subject && payload.subject_id) {
              createdTeacher.subject = subjectList.find((s) => s.id === payload.subject_id);
            }
            const password = res.data?.password || payload.nip;
            if (createdTeacher) {
              setTeacherList((prev) => [...prev, createdTeacher]);
            }
            // Pop up the initial credential modal
            setCredentialModalData({
              type: 'teacher',
              teacher: createdTeacher,
              password,
            });
          } catch (apiErr) {
            setFormErrors(apiErr.errors || { general: [apiErr.message || 'Gagal menambahkan guru.'] });
            setIsSubmitting(false);
            return;
          }
        } else if (activeTab === 'siswa') {
          const errors = {};
          if (!formData.name?.trim()) errors.name = ['Nama lengkap siswa wajib diisi.'];
          if (!formData.nis?.trim()) errors.nis = ['Nomor Induk Siswa (NIS) wajib diisi.'];
          if (!formData.class_id) errors.class_id = ['Rombel kelas wajib dipilih.'];
          if (!formData.gender) errors.gender = ['Jenis kelamin wajib dipilih (L atau P).'];
          if (formData.nisn?.trim() && !/^\d{10}$/.test(formData.nisn.trim())) {
            errors.nisn = ['Jika diisi, NISN harus tepat 10 digit angka.'];
          }

          if (Object.keys(errors).length > 0) {
            setFormErrors(errors);
            setIsSubmitting(false);
            return;
          }

          const payload = {
            name: formData.name.trim(),
            nis: formData.nis.trim(),
            class_id: Number(formData.class_id),
            gender: formData.gender,
            student_number: formData.student_number ? Number(formData.student_number) : null,
            nisn: formData.nisn?.trim() || null,
          };
          try {
            const res = await studentApi.createStudent(payload);
            const student = res.data?.student;
            const parent = res.data?.parent;
            const password = res.data?.generate_password || (payload.student_number ? `${payload.nis}${payload.student_number}` : payload.nis);

            if (student) {
              setStudentList((prev) => [...prev, student]);
            }
            setCredentialModalData({
              type: 'student',
              student: student || { name: payload.name, nis_nip: payload.nis, student_number: payload.student_number },
              parent: parent || { name: 'Wali Murid ' + payload.name, nis_nip: 'P-' + payload.nis },
              password,
            });
          } catch (apiErr) {
            setFormErrors(apiErr.errors || { general: [apiErr.message || 'Gagal menambahkan siswa.'] });
            setIsSubmitting(false);
            return;
          }
        }
      } else if (modalType === 'edit') {
        const id = editingItem.id;
        if (activeTab === 'kelas') {
          const payload = {
            name: formData.name,
            level: Number(formData.level),
            next_class_id: formData.next_class_id ? Number(formData.next_class_id) : null,
          };
          try {
            await classApi.updateClass(id, payload);
          } catch (apiErr) {
            if (apiErr.errors) {
              setFormErrors(apiErr.errors);
              setIsSubmitting(false);
              return;
            }
          }
          setClassList((prev) => prev.map((c) => (c.id === id ? { ...c, ...payload } : c)));
        } else if (activeTab === 'ruang') {
          const payload = {
            name: formData.name,
            capacity: Number(formData.capacity),
          };
          try {
            await roomApi.updateRoom(id, payload);
          } catch (apiErr) {
            if (apiErr.errors) {
              setFormErrors(apiErr.errors);
              setIsSubmitting(false);
              return;
            }
          }
          setRoomList((prev) => prev.map((r) => (r.id === id ? { ...r, ...payload } : r)));
        } else if (activeTab === 'mapel') {
          const payload = { name: formData.name };
          try {
            await subjectApi.updateSubject(id, payload);
          } catch (apiErr) {
            if (apiErr.errors) {
              setFormErrors(apiErr.errors);
              setIsSubmitting(false);
              return;
            }
          }
          setSubjectList((prev) => prev.map((s) => (s.id === id ? { ...s, ...payload } : s)));
        } else if (activeTab === 'guru') {
          const errors = {};
          if (!formData.name?.trim()) errors.name = ['Nama lengkap guru wajib diisi.'];
          if (!formData.nip?.trim()) errors.nip = ['NIP / ID Guru wajib diisi.'];
          if (formData.phone_number?.trim()) {
            if (!/^(\+62|62|0)8[1-9][0-9]{6,11}$/.test(formData.phone_number.trim().replace(/[-\s]/g, ''))) {
              errors.phone_number = ['Format nomor telepon tidak valid. Gunakan format Indonesia (contoh: 081234567890).'];
            }
          }

          if (Object.keys(errors).length > 0) {
            setFormErrors(errors);
            setIsSubmitting(false);
            return;
          }

          const payload = {
            name: formData.name.trim(),
            nip: formData.nip?.trim() || null,
            email: formData.email?.trim() || null,
            phone_number: formData.phone_number?.trim() || null,
            subject_id: formData.subject_id ? Number(formData.subject_id) : null,
          };

          // Step-Up Auth password confirmation for Guru edit
          setPendingPasswordAction({
            type: 'edit',
            id,
            payload,
            name: formData.name.trim(),
          });
          setPasswordModalError('');
          setIsPasswordModalOpen(true);
          setIsSubmitting(false);
          return;
        } else if (activeTab === 'siswa') {
          const errors = {};
          if (!formData.name?.trim()) errors.name = ['Nama lengkap siswa wajib diisi.'];
          if (!formData.nis?.trim()) errors.nis = ['Nomor Induk Siswa (NIS) wajib diisi.'];
          if (!formData.class_id) errors.class_id = ['Rombel kelas wajib dipilih.'];
          if (!formData.gender) errors.gender = ['Jenis kelamin wajib dipilih (L atau P).'];
          if (formData.nisn?.trim() && !/^\d{10}$/.test(formData.nisn.trim())) {
            errors.nisn = ['Jika diisi, NISN harus tepat 10 digit angka.'];
          }

          if (Object.keys(errors).length > 0) {
            setFormErrors(errors);
            setIsSubmitting(false);
            return;
          }

          const payload = {
            name: formData.name.trim(),
            nis: formData.nis.trim(),
            class_id: Number(formData.class_id),
            gender: formData.gender,
            student_number: formData.student_number ? Number(formData.student_number) : null,
            nisn: formData.nisn?.trim() || null,
          };

          // Step-Up Auth password confirmation for Siswa edit
          setPendingPasswordAction({
            type: 'edit',
            id,
            payload,
            name: formData.name.trim(),
          });
          setPasswordModalError('');
          setIsPasswordModalOpen(true);
          setIsSubmitting(false);
          return;
        }
      }

      refreshSummary();
      setModalType(null);
      setEditingItem(null);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Smart Delete Handlers
  const handleOpenDelete = useCallback((item) => {
    setSmartDeleteItem(item);
    setSmartDeleteError('');
  }, []);

  const handleSoftDelete = async (item) => {
    if (!item) return;
    setIsDeleting(true);
    setSmartDeleteError('');
    const id = item.id;
    try {
      if (activeTab === 'guru') {
        await teacherApi.deleteTeacher(id);
        setTeacherList((prev) => prev.filter((t) => t.id !== id));
        setSelectedTeacherIds((prev) => prev.filter((tId) => tId !== id));
      } else if (activeTab === 'siswa') {
        await studentApi.deleteStudent(id);
        setStudentList((prev) => prev.filter((s) => s.id !== id));
        setSelectedStudentIds((prev) => prev.filter((sId) => sId !== id));
      } else if (activeTab === 'kelas') {
        await classApi.deleteClass(id);
        setClassList((prev) => prev.filter((c) => c.id !== id));
      } else if (activeTab === 'ruang') {
        await roomApi.deleteRoom(id);
        setRoomList((prev) => prev.filter((r) => r.id !== id));
      } else if (activeTab === 'mapel') {
        await subjectApi.deleteSubject(id);
        setSubjectList((prev) => prev.filter((s) => s.id !== id));
      }
      setSmartDeleteItem(null);
      // Invalidate trash cache so it reflects the new item
      setLoadedTabs((prev) => {
        const next = new Set(prev);
        next.delete('trash');
        return next;
      });
      refreshSummary();
    } catch (err) {
      const isConflict =
        err.status === 409 ||
        err?.response?.status === 409 ||
        err.message?.includes('jadwal') ||
        err?.response?.data?.message?.includes('jadwal');
      if (isConflict) {
        setSmartDeleteItem(null);
        setConflictError({
          entityName: item.name,
          entityType: tabs.find((t) => t.id === activeTab)?.label || 'Data',
          errorMessage: err?.response?.data?.message || err?.message,
        });
        return;
      }
      setSmartDeleteError(err?.response?.data?.message || err?.message || 'Gagal memindahkan ke tempat sampah.');
      throw err;
    } finally {
      setIsDeleting(false);
    }
  };

  const handleForceDelete = async (item, password) => {
    if (!item) return;
    setIsDeleting(true);
    setSmartDeleteError('');
    const id = item.id;
    try {
      await recycleBinApi.forceDeleteData(activeTab, id, { password });
      if (activeTab === 'guru') {
        setTeacherList((prev) => prev.filter((t) => t.id !== id));
        setSelectedTeacherIds((prev) => prev.filter((tId) => tId !== id));
      } else if (activeTab === 'siswa') {
        setStudentList((prev) => prev.filter((s) => s.id !== id));
        setSelectedStudentIds((prev) => prev.filter((sId) => sId !== id));
      } else if (activeTab === 'kelas') {
        setClassList((prev) => prev.filter((c) => c.id !== id));
      } else if (activeTab === 'ruang') {
        setRoomList((prev) => prev.filter((r) => r.id !== id));
      } else if (activeTab === 'mapel') {
        setSubjectList((prev) => prev.filter((s) => s.id !== id));
      }
      setSmartDeleteItem(null);
      refreshSummary();
    } catch (err) {
      setSmartDeleteError(err?.response?.data?.message || err?.message || 'Gagal menghapus permanen.');
      throw err;
    } finally {
      setIsDeleting(false);
    }
  };

  // Restore action for Trash tab
  const handleRestoreTrash = useCallback(async (item) => {
    if (!item) return;
    setIsRestoring(true);
    try {
      await recycleBinApi.restoreData(item.entity_type, item.id);
      setTrashList((prev) => prev.filter((t) => !(t.id === item.id && t.entity_type === item.entity_type)));
      // Invalidate target entity tab cache
      setLoadedTabs((prev) => {
        const next = new Set(prev);
        next.delete(item.entity_type);
        return next;
      });
      refreshSummary();
    } catch (err) {
      alert(err?.response?.data?.message || err?.message || 'Gagal memulihkan data.');
    } finally {
      setIsRestoring(false);
    }
  }, [refreshSummary]);

  // Open permanent delete dialog for item in Trash tab
  const handleOpenPermanentDeleteTrash = useCallback((item) => {
    setPendingPasswordAction({
      type: 'delete_trash_permanent',
      item,
    });
    setPasswordModalError('');
    setIsPasswordModalOpen(true);
  }, []);

  // Teacher Assignment Handlers
  const handleOpenAssignment = useCallback((teacher) => {
    setAssignmentTeacher(teacher);
  }, []);

  const handleAssignRole = async (teacherId, payload) => {
    try {
      const res = await teacherApi.assignRole(teacherId, payload);
      const newAssignment = res?.data;
      if (!newAssignment) return;

      setTeacherList((prev) =>
        prev.map((t) =>
          t.id === teacherId
            ? { ...t, assignments: [...(t.assignments || []), newAssignment] }
            : t
        )
      );

      // Update current modal teacher object
      setAssignmentTeacher((prev) =>
        prev && prev.id === teacherId
          ? { ...prev, assignments: [...(prev.assignments || []), newAssignment] }
          : prev
      );
    } catch (err) {
      alert(err.message || err.response?.data?.message || 'Gagal menambahkan penugasan guru.');
    }
  };

  const handleRevokeRole = async (teacherId, assignmentId) => {
    await teacherApi.revokeRole(teacherId, assignmentId);

    setTeacherList((prev) =>
      prev.map((t) =>
        t.id === teacherId
          ? {
              ...t,
              assignments: (t.assignments || []).filter((a) => a.id !== assignmentId),
            }
          : t
      )
    );

    setAssignmentTeacher((prev) =>
      prev && prev.id === teacherId
        ? {
            ...prev,
            assignments: (prev.assignments || []).filter((a) => a.id !== assignmentId),
          }
        : prev
    );
  };

  // Filtered dataset based on search & levels
  const filteredData = useMemo(() => {
    const q = (typeof searchQuery === 'string' ? searchQuery : (searchQuery?.target?.value ?? '')).toLowerCase().trim();

    if (activeTab === 'kelas') {
      return classList.filter((c) => {
        if (levelFilter !== 'ALL' && String(c.level) !== levelFilter) return false;
        if (!q) return true;
        return String(c.name || '').toLowerCase().includes(q) || String(c.level || '').includes(q);
      });
    }

    if (activeTab === 'ruang') {
      return roomList.filter((r) => {
        if (!q) return true;
        return String(r.name || '').toLowerCase().includes(q) || String(r.capacity || '').includes(q);
      });
    }

    if (activeTab === 'mapel') {
      return subjectList.filter((s) => {
        if (!q) return true;
        return String(s.name || '').toLowerCase().includes(q);
      });
    }

    if (activeTab === 'guru') {
      return teacherList.filter((t) => {
        if (!q) return true;
        const name = String(t.name || '').toLowerCase();
        const nip = String(t.nis_nip || t.nip || '').toLowerCase();
        return (
          name.includes(q) ||
          nip.includes(q)
        );
      });
    }

    if (activeTab === 'siswa') {
      return studentList;
    }

    if (activeTab === 'trash') {
      return trashList.filter((item) => {
        if (trashEntityFilter !== 'all' && item.entity_type !== trashEntityFilter) return false;
        if (!q) return true;
        const name = String(item.name || '').toLowerCase();
        const iden = String(item.identifier || '').toLowerCase();
        const type = String(item.entity_type || '').toLowerCase();
        return name.includes(q) || iden.includes(q) || type.includes(q);
      });
    }

    return [];
  }, [activeTab, searchQuery, levelFilter, trashEntityFilter, classList, roomList, subjectList, teacherList, studentList, trashList]);

  // Current active selection based on active tab
  const currentSelectedIds = useMemo(() => {
    if (activeTab === 'guru') return selectedTeacherIds;
    if (activeTab === 'siswa') return selectedStudentIds;
    return [];
  }, [activeTab, selectedTeacherIds, selectedStudentIds]);

  const selectedItems = useMemo(() => {
    if (activeTab === 'guru') {
      return teacherList.filter((t) => selectedTeacherIds.includes(t.id));
    }
    if (activeTab === 'siswa') {
      return studentList.filter((s) => selectedStudentIds.includes(s.id));
    }
    return [];
  }, [activeTab, teacherList, studentList, selectedTeacherIds, selectedStudentIds]);

  const singleSelectedItem = selectedItems.length === 1 ? selectedItems[0] : null;

  const setCurrentSelectedIds = useCallback(
    (updater) => {
      if (activeTab === 'guru') {
        setSelectedTeacherIds(updater);
      } else if (activeTab === 'siswa') {
        setSelectedStudentIds(updater);
      }
    },
    [activeTab]
  );

  const handleSelectRow = useCallback(
    (key, isChecked) => {
      setCurrentSelectedIds((prev) => {
        if (isChecked) {
          return prev.includes(key) ? prev : [...prev, key];
        } else {
          return prev.filter((id) => id !== key);
        }
      });
    },
    [setCurrentSelectedIds]
  );

  const handleSelectAllCurrentPage = useCallback(
    (pageKeys, willSelectAll) => {
      setCurrentSelectedIds((prev) => {
        if (willSelectAll) {
          const toAdd = pageKeys.filter((k) => !prev.includes(k));
          return [...prev, ...toAdd];
        } else {
          return prev.filter((id) => !pageKeys.includes(id));
        }
      });
    },
    [setCurrentSelectedIds]
  );

  const handleSelectAllFiltered = useCallback(() => {
    const allFilteredKeys = filteredData.map((item) => item.id);
    setCurrentSelectedIds(allFilteredKeys);
  }, [filteredData, setCurrentSelectedIds]);

  const handleDeselectAll = useCallback(() => {
    setCurrentSelectedIds([]);
  }, [setCurrentSelectedIds]);

  // Bulk Delete Execution with Step-Up Auth Password
  const executeBulkDeleteWithPassword = useCallback(async (password) => {
    if (selectedItems.length === 0) return;
    setIsBulkDeleting(true);

    const total = selectedItems.length;
    const successfulIds = [];
    const failedItems = [];

    for (const item of selectedItems) {
      try {
        if (activeTab === 'guru') {
          await teacherApi.deleteTeacher(item.id, { password });
        } else if (activeTab === 'siswa') {
          await studentApi.deleteStudent(item.id, { password });
        }
        successfulIds.push(item.id);
      } catch (err) {
        const errMsg =
          err?.message ||
          (err?.status === 409
            ? 'Data masih digunakan pada jadwal aktif atau relasi data lainnya.'
            : 'Gagal menghapus data.');
        failedItems.push({
          id: item.id,
          name: item.name || `ID #${item.id}`,
          identifier:
            activeTab === 'guru'
              ? item.nip || item.nis_nip || '-'
              : item.nis || '-',
          reason: errMsg,
        });
      }
    }

    if (successfulIds.length > 0) {
      if (activeTab === 'guru') {
        setTeacherList((prev) => prev.filter((t) => !successfulIds.includes(t.id)));
        setSelectedTeacherIds((prev) => prev.filter((id) => !successfulIds.includes(id)));
      } else if (activeTab === 'siswa') {
        setStudentList((prev) => prev.filter((s) => !successfulIds.includes(s.id)));
        setSelectedStudentIds((prev) => prev.filter((id) => !successfulIds.includes(id)));
      }
      refreshSummary();
    }

    setIsBulkDeleting(false);

    setBulkDeleteSummary({
      total,
      successCount: successfulIds.length,
      failedCount: failedItems.length,
      failedItems,
      entityType: activeTab === 'guru' ? 'Guru' : 'Siswa',
    });
  }, [selectedItems, activeTab, refreshSummary]);

  // Request Bulk Delete - Opens Password Confirmation Modal
  const handleRequestBulkDeletePassword = useCallback(() => {
    setIsBulkDeleteOpen(false);
    setPendingPasswordAction({
      type: 'delete_bulk',
    });
    setPasswordModalError('');
    setIsPasswordModalOpen(true);
  }, []);

  // Request Reset Master Data - Opens Password Confirmation Modal
  const handleOpenResetMasterModal = useCallback(() => {
    setPendingPasswordAction({
      type: 'reset_all',
    });
    setPasswordModalError('');
    setIsPasswordModalOpen(true);
  }, []);

  // Step-Up Auth Password Confirmation Handler (Edit & Delete)
  const handlePasswordConfirm = useCallback(async (password) => {
    if (!pendingPasswordAction) return;
    setPasswordModalLoading(true);
    setPasswordModalError('');

    try {
      // 1. Verifikasi kata sandi pengguna saat ini ke backend
      await authApi.verifyPassword(password);
    } catch (err) {
      const errMsg =
        err?.errors?.password?.[0] ||
        err?.message ||
        'Kata sandi yang Anda masukkan salah.';
      setPasswordModalError(errMsg);
      setPasswordModalLoading(false);
      return;
    }

    try {
      if (pendingPasswordAction.type === 'edit') {
        const { id, payload } = pendingPasswordAction;
        const payloadWithPassword = { ...payload, password };

        if (activeTab === 'guru') {
          try {
            const res = await teacherApi.updateTeacher(id, payloadWithPassword);
            const updatedTeacherData = unwrap(res);
            const chosenSubject = payload.subject_id
              ? subjectList.find((s) => s.id === payload.subject_id)
              : null;
            setTeacherList((prev) =>
              prev.map((t) =>
                t.id === id
                  ? {
                      ...t,
                      ...payload,
                      nis_nip: payload.nip,
                      subject: updatedTeacherData?.subject || chosenSubject || null,
                    }
                  : t
              )
            );
          } catch (apiErr) {
            if (apiErr.errors) {
              setFormErrors(apiErr.errors);
              setIsPasswordModalOpen(false);
              setPasswordModalLoading(false);
              return;
            }
          }
        } else if (activeTab === 'siswa') {
          try {
            await studentApi.updateStudent(id, payloadWithPassword);
          } catch (apiErr) {
            if (apiErr.errors) {
              setFormErrors(apiErr.errors);
              setIsPasswordModalOpen(false);
              setPasswordModalLoading(false);
              return;
            }
          }
          setStudentList((prev) =>
            prev.map((st) =>
              st.id === id
                ? {
                    ...st,
                    ...payload,
                    nis_nip: payload.nis,
                    gender: payload.gender,
                    nisn: payload.nisn,
                    schoolClass: classList.find((c) => c.id === payload.class_id),
                    school_class: classList.find((c) => c.id === payload.class_id),
                  }
                : st
            )
          );
        }

        setIsPasswordModalOpen(false);
        setModalType(null);
        setEditingItem(null);
        setPendingPasswordAction(null);
        refreshSummary();
      } else if (pendingPasswordAction.type === 'delete_single') {
        const item = pendingPasswordAction.item;
        const id = item.id;
        const name = item.name || 'Item';

        if (activeTab === 'guru') {
          try {
            await teacherApi.deleteTeacher(id, { password });
            setTeacherList((prev) => prev.filter((t) => t.id !== id));
            setSelectedTeacherIds((prev) => prev.filter((tId) => tId !== id));
          } catch (err) {
            setIsPasswordModalOpen(false);
            setPendingPasswordAction(null);
            refreshSummary();
            if (err.status === 409 || err.message?.includes('jadwal')) {
              setConflictError({
                entityName: name,
                entityType: 'Guru',
                errorMessage: err.message,
              });
              return;
            }
            throw err;
          }
        } else if (activeTab === 'siswa') {
          try {
            await studentApi.deleteStudent(id, { password });
            setStudentList((prev) => prev.filter((s) => s.id !== id));
            setSelectedStudentIds((prev) => prev.filter((sId) => sId !== id));
          } catch (err) {
            setIsPasswordModalOpen(false);
            setPendingPasswordAction(null);
            refreshSummary();
            if (err.status === 409) {
              setConflictError({
                entityName: name,
                entityType: 'Siswa',
                errorMessage: err.message,
              });
              return;
            }
            throw err;
          }
        }

        setIsPasswordModalOpen(false);
        setPendingPasswordAction(null);
        refreshSummary();
      } else if (pendingPasswordAction.type === 'delete_trash_permanent') {
        const item = pendingPasswordAction.item;
        try {
          await recycleBinApi.forceDeleteData(item.entity_type, item.id, { password });
          setTrashList((prev) => prev.filter((t) => !(t.id === item.id && t.entity_type === item.entity_type)));
          setIsPasswordModalOpen(false);
          setPendingPasswordAction(null);
          refreshSummary();
        } catch (err) {
          setPasswordModalError(err?.response?.data?.message || err?.message || 'Gagal menghapus data secara permanen.');
          return;
        }
      } else if (pendingPasswordAction.type === 'delete_bulk') {
        setIsPasswordModalOpen(false);
        setPendingPasswordAction(null);
        await executeBulkDeleteWithPassword(password);
      } else if (pendingPasswordAction.type === 'reset_all') {
        try {
          const res = await masterDataSummaryApi.resetMasterData({ password, scope: 'all' });
          setIsPasswordModalOpen(false);
          setPendingPasswordAction(null);
          refreshSummary();
          handleRefresh();
          alert(res.message || 'Seluruh Master Data berhasil di-reset.');
        } catch (apiErr) {
          if (apiErr.status === 409) {
            setPasswordModalError(
              apiErr.message ||
                'Reset Master Data ditolak: Masih terdapat Data Jadwal yang terhubung. Silakan reset Data Jadwal terlebih dahulu.'
            );
          } else if (apiErr.status === 422) {
            setPasswordModalError(
              apiErr.errors?.password?.[0] || 'Kata sandi yang Anda masukkan salah.'
            );
          } else {
            setPasswordModalError(
              apiErr.message || 'Terjadi kesalahan saat memproses reset Master Data.'
            );
          }
          setPasswordModalLoading(false);
          return;
        }
      }
    } catch (actionErr) {
      setPasswordModalError(
        actionErr?.message || 'Terjadi kesalahan saat memproses permintaan.'
      );
    } finally {
      setPasswordModalLoading(false);
    }
  }, [
    pendingPasswordAction,
    activeTab,
    subjectList,
    classList,
    refreshSummary,
    executeBulkDeleteWithPassword,
    handleRefresh,
  ]);

  // Dynamic columns definition
  const columns = useMemo(() => {
    const baseActionCol = {
      key: 'actions',
      label: 'Aksi',
      align: 'right',
      renderCell: (row) => (
        <div className="master-data__action-cell">
          {(activeTab === 'guru' || activeTab === 'siswa') && (
            <button
              type="button"
              className="master-data__icon-btn"
              onClick={() => setDetailItem(row)}
              title="Lihat Detail Data"
              aria-label="Lihat Detail Data"
            >
              <Eye size={14} />
            </button>
          )}

          {activeTab === 'guru' && (
            <button
              type="button"
              className="master-data__assignment-btn"
              onClick={() => handleOpenAssignment(row)}
              title="Kelola Tugas Tambahan"
            >
              <UserCheck size={14} />
              <span>Penugasan</span>
            </button>
          )}

          <button
            type="button"
            className="master-data__icon-btn"
            onClick={() => handleOpenEdit(row)}
            title="Edit Data"
            aria-label="Edit Data"
          >
            <Pencil size={14} />
          </button>

          <button
            type="button"
            className="master-data__icon-btn master-data__icon-btn--danger"
            onClick={() => handleOpenDelete(row)}
            title="Hapus Data"
            aria-label="Hapus Data"
          >
            <Trash2 size={14} />
          </button>
        </div>
      ),
    };

    switch (activeTab) {
      case 'kelas':
        return [
          {
            key: 'no',
            label: 'No',
            renderCell: (_, idx) => (
              <span className="font-mono text-xs text-neutral-400">
                {String(idx + 1).padStart(2, '0')}
              </span>
            ),
          },
          {
            key: 'name',
            label: 'Nama Rombel',
            renderCell: (r) => (
              <strong className="font-mono text-sm text-neutral-900">{r.name}</strong>
            ),
          },
          {
            key: 'level',
            label: 'Tingkat',
            renderCell: (r) => (
              <Badge variant="neutral">Tingkat {r.level}</Badge>
            ),
          },
          {
            key: 'next_class',
            label: 'Kelas Kenaikan',
            renderCell: (r) => {
              const target = classList.find((c) => c.id === r.next_class_id);
              if (r.next_class_id && target) {
                return (
                  <span className="font-mono text-[11.5px] font-semibold text-gray-800 bg-gray-50 px-1.5 py-0.5 rounded border border-gray-200">
                    &rarr; {target.name}
                  </span>
                );
              }
              if (r.level === 12) {
                return (
                  <Badge variant="success">Tingkat Akhir (Lulus)</Badge>
                );
              }
              return (
                <span className="text-xs text-neutral-400 italic">Belum Dipetakan</span>
              );
            },
          },
          baseActionCol,
        ];

      case 'ruang':
        return [
          {
            key: 'no',
            label: 'No',
            renderCell: (_, idx) => (
              <span className="font-mono text-xs text-neutral-400">
                {String(idx + 1).padStart(2, '0')}
              </span>
            ),
          },
          {
            key: 'name',
            label: 'Nama Ruang',
            renderCell: (r) => (
              <strong className="font-mono text-sm text-neutral-900">{r.name}</strong>
            ),
          },
          {
            key: 'capacity',
            label: 'Kapasitas',
            align: 'right',
            renderCell: (r) => (
              <span className="font-mono text-xs text-neutral-700">{r.capacity} Kursi</span>
            ),
          },
          baseActionCol,
        ];

      case 'mapel':
        return [
          {
            key: 'no',
            label: 'No',
            renderCell: (_, idx) => (
              <span className="font-mono text-xs text-neutral-400">
                {String(idx + 1).padStart(2, '0')}
              </span>
            ),
          },
          {
            key: 'name',
            label: 'Nama Mata Pelajaran',
            renderCell: (r) => (
              <strong className="text-sm text-neutral-900">{r.name}</strong>
            ),
          },
          baseActionCol,
        ];

      case 'guru':
        return [
          {
            key: 'no',
            label: 'No',
            renderCell: (_, idx) => (
              <span className="font-mono text-xs text-neutral-400">
                {String(idx + 1).padStart(2, '0')}
              </span>
            ),
          },
          {
            key: 'name',
            label: 'Nama Lengkap Guru',
            renderCell: (r) => (
              <div>
                <strong className="text-sm text-neutral-900">{r.name}</strong>
                {r.email && (
                  <p className="text-xs text-neutral-500">{r.email}</p>
                )}
              </div>
            ),
          },
          {
            key: 'nip',
            label: 'NIP / ID',
            renderCell: (r) => (
              <code className="font-mono text-xs bg-neutral-100 px-1.5 py-0.5 rounded text-neutral-700">
                {r.nis_nip || r.nip || '-'}
              </code>
            ),
          },
          {
            key: 'phone_number',
            label: 'No. Telepon (ID Login)',
            renderCell: (r) => (
              <span className="text-xs font-mono text-neutral-800">
                {r.phone_number || r.telp || <span className="text-neutral-400 italic">Belum Diatur</span>}
              </span>
            ),
          },
          {
            key: 'subject',
            label: 'Mata Pelajaran',
            renderCell: (r) => (
              <span className="text-xs text-neutral-800 font-medium">
                {r.subject?.name || <span className="text-neutral-400 italic">Belum Diatur</span>}
              </span>
            ),
          },
          {
            key: 'assignments',
            label: 'Tugas Tambahan',
            renderCell: (r) => {
              const asgns = r.assignments || [];
              if (asgns.length === 0) {
                return <span className="text-xs text-neutral-400">-</span>;
              }

              const waliAssignments = asgns.filter((a) => a.type === 'wali_kelas');
              const kesiswaanAssignments = asgns.filter((a) => a.type === 'kesiswaan');

              return (
                <div className="flex flex-wrap gap-1">
                  {waliAssignments.map((a, i) => {
                    const cName = a.school_class?.name || a.schoolClass?.name || '';
                    return (
                      <Badge key={a.id || `wali-${i}`} variant="default">
                        {`Wali ${cName}`}
                      </Badge>
                    );
                  })}
                  {kesiswaanAssignments.length > 0 && (
                    <Badge
                      variant="warning"
                      title={
                        kesiswaanAssignments.length > 1
                          ? `Kesiswaan (${kesiswaanAssignments.length} Kelas Binaan: ${kesiswaanAssignments
                              .map((k) => k.school_class?.name || k.schoolClass?.name || '')
                              .filter(Boolean)
                              .join(', ')})`
                          : 'Kesiswaan'
                      }
                    >
                      Kesiswaan
                    </Badge>
                  )}
                </div>
              );
            },
          },
          baseActionCol,
        ];

      case 'siswa':
        return [
          {
            key: 'no',
            label: 'No',
            renderCell: (_, idx) => (
              <span className="font-mono text-xs text-neutral-400">
                {String(idx + 1).padStart(2, '0')}
              </span>
            ),
          },
          {
            key: 'name',
            label: 'Nama Siswa',
            renderCell: (r) => (
              <div>
                <strong className="text-sm text-neutral-900">{r.name}</strong>
                <p className="text-xs text-neutral-500 font-mono">
                  Wali: P-{r.nis_nip || r.nis}
                </p>
              </div>
            ),
          },
          {
            key: 'nis',
            label: 'NIS',
            renderCell: (r) => (
              <code className="font-mono text-xs bg-neutral-100 px-1.5 py-0.5 rounded text-neutral-700">
                {r.nis_nip || r.nis}
              </code>
            ),
          },
          {
            key: 'student_number',
            label: 'No. Absen',
            renderCell: (r) => (
              <span className="font-mono text-xs font-semibold text-neutral-800">
                {r.student_number ? `${r.student_number}` : '-'}
              </span>
            ),
          },
          {
            key: 'nisn',
            label: 'NISN',
            renderCell: (r) => (
              <span className="font-mono text-xs text-neutral-600">
                {r.nisn || '-'}
              </span>
            ),
          },
          {
            key: 'gender',
            label: 'Gender',
            renderCell: (r) =>
              r.gender ? (
                <Badge variant={r.gender === 'L' ? 'info' : 'default'}>
                  {r.gender === 'L' ? 'L (Laki-laki)' : 'P (Perempuan)'}
                </Badge>
              ) : (
                <span className="text-xs text-neutral-400">-</span>
              ),
          },
          {
            key: 'class',
            label: 'Kelas',
            renderCell: (r) => (
              <Badge variant="neutral">
                {r.school_class?.name || r.schoolClass?.name || r.className || 'Belum Masuk Kelas'}
              </Badge>
            ),
          },
          baseActionCol,
        ];

      case 'trash':
        return [
          {
            key: 'no',
            label: 'No',
            renderCell: (_, idx) => (
              <span className="font-mono text-xs text-neutral-400">
                {String(idx + 1).padStart(2, '0')}
              </span>
            ),
          },
          {
            key: 'name_identifier',
            label: 'Nama & Identitas',
            renderCell: (r) => (
              <div className="flex flex-col gap-0.5">
                <strong className="text-sm font-semibold text-neutral-900">{r.name}</strong>
                {r.identifier && (
                  <span className="font-mono text-xs text-neutral-500">ID: {r.identifier}</span>
                )}
              </div>
            ),
          },
          {
            key: 'entity_type',
            label: 'Kategori',
            renderCell: (r) => {
              const labels = {
                guru: 'Guru',
                siswa: 'Siswa',
                kelas: 'Kelas',
                ruang: 'Ruang',
                mapel: 'Mapel',
              };
              const variants = {
                guru: 'info',
                siswa: 'secondary',
                kelas: 'neutral',
                ruang: 'neutral',
                mapel: 'neutral',
              };
              return (
                <Badge variant={variants[r.entity_type] || 'default'}>
                  {labels[r.entity_type] || r.entity_type}
                </Badge>
              );
            },
          },
          {
            key: 'deleted_at',
            label: 'Tanggal Dihapus',
            renderCell: (r) => {
              if (!r.deleted_at) return <span className="text-xs text-neutral-400">-</span>;
              const date = new Date(r.deleted_at);
              return (
                <span className="text-xs text-neutral-600">
                  {date.toLocaleDateString('id-ID', {
                    day: 'numeric',
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
            key: 'days_remaining',
            label: 'Masa Simpan',
            renderCell: (r) => {
              const days = r.days_remaining ?? 0;
              let variant = 'info';
              if (days <= 3) variant = 'danger';
              else if (days <= 10) variant = 'warning';

              return (
                <div className="flex items-center gap-1.5">
                  <Badge variant={variant}>
                    <Clock size={12} className="mr-1 inline" />
                    {days} hari tersisa
                  </Badge>
                </div>
              );
            },
          },
          {
            key: 'legal_history',
            label: 'Status Riwayat Legal',
            renderCell: (r) =>
              r.has_legal_history ? (
                <Badge variant="warning" title="Memiliki riwayat jurnal/presensi/kuis. Jika dihapus permanen akan dianonimkan.">
                  Arsip Legal Aktif
                </Badge>
              ) : (
                <Badge variant="success">Bebas Riwayat</Badge>
              ),
          },
          {
            key: 'trash_actions',
            label: 'Aksi',
            align: 'right',
            renderCell: (r) => (
              <div className="flex items-center justify-end gap-1.5">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => handleRestoreTrash(r)}
                  disabled={isRestoring}
                  title="Pulihkan data ini kembali ke sistem aktif"
                >
                  Pulihkan
                </Button>
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => handleOpenPermanentDeleteTrash(r)}
                  title="Hapus permanen sekarang (Perlu Password)"
                >
                  Hapus Permanen
                </Button>
              </div>
            ),
          },
        ];

      default:
        return [];
    }
  }, [activeTab, classList, handleOpenEdit, handleOpenAssignment, handleOpenDelete, setDetailItem, isRestoring, handleRestoreTrash, handleOpenPermanentDeleteTrash]);

  return (
    <div className="master-data-page">
      {/* Header */}
      <div className="master-data__header">
        <div>
          <h1 className="master-data__title">Pengelolaan Master Data Sekolah</h1>
          <p className="master-data__subtitle">
            Kelola data institusi kelas rombel, ruang belajar, mata pelajaran, profil guru, dan peserta didik.
          </p>
        </div>

        <div className="master-data__header-actions">
          <Button
            variant="outline"
            className="text-red-600 border-red-200 hover:bg-red-50 hover:border-red-300"
            onClick={handleOpenResetMasterModal}
            title="Reset Seluruh Master Data"
          >
            Reset Master Data
          </Button>
          <Button
            variant="secondary"
            onClick={handleRefresh}
            loading={isLoading}
            title="Muat Ulang Data"
          >
            Refresh
          </Button>

          {activeTab === 'guru' && (
            <>
              <Button
                variant="outline"
                onClick={handleDownloadTeacherTemplate}
                loading={teacherDownloadingTemplate}
                title="Unduh format spreadsheet impor guru (.xlsx)"
              >
                Unduh Template
              </Button>
              <Button
                variant="secondary"
                onClick={() => {
                  setTeacherImportFile(null);
                  setTeacherImportErrors(null);
                  setTeacherImportGeneralError(null);
                  setTeacherImportSuccess(null);
                  setIsTeacherImportModalOpen(true);
                }}
                title="Impor data guru massal (.xlsx)"
              >
                Impor Guru (.xlsx)
              </Button>
            </>
          )}

          {activeTab === 'siswa' && (
            <>
              <Button
                variant="outline"
                onClick={handleDownloadStudentTemplate}
                loading={studentDownloadingTemplate}
                title="Unduh format spreadsheet impor siswa (.xlsx)"
              >
                Unduh Template
              </Button>
              <Button
                variant="secondary"
                onClick={() => {
                  setStudentImportFile(null);
                  setStudentImportErrors(null);
                  setStudentImportGeneralError(null);
                  setStudentImportSuccess(null);
                  setIsStudentImportModalOpen(true);
                }}
                title="Impor data siswa massal (.xlsx)"
              >
                Impor Siswa (.xlsx)
              </Button>
            </>
          )}

          {activeTab !== 'trash' && activeTab !== 'penugasan' && (
            <Button variant="primary" icon={Plus} onClick={handleOpenAdd}>
              Tambah {tabs.find((t) => t.id === activeTab)?.label}
            </Button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="master-data__tabs-wrapper">
        <Tabs tabs={tabs} activeTab={activeTab} onChange={handleTabChange} />
      </div>

      {/* Content Area */}
      {activeTab === 'penugasan' ? (
        <TeacherAssignmentTab
          teacherList={teacherList}
          classList={classList}
          onTabCountUpdate={handleAssignmentCountUpdate}
        />
      ) : (
        <>
          {/* Toolbar (Search & Filter) */}
          <div className="master-data__toolbar">
        <div className="master-data__search">
          <SearchInput
            placeholder={`Cari ${tabs.find((t) => t.id === activeTab)?.label.toLowerCase()}...`}
            value={typeof searchQuery === 'string' ? searchQuery : ''}
            onChange={(val) => {
              const str = typeof val === 'string' ? val : (val?.target?.value ?? '');
              setSearchQuery(str);
            }}
          />
        </div>

        <div className="master-data__filters">
          {(activeTab === 'kelas' || activeTab === 'siswa') && (
            <select
              className="master-data__filter-select"
              value={levelFilter}
              onChange={(e) => setLevelFilter(e.target.value)}
            >
              <option value="ALL">Semua Tingkat</option>
              <option value="10">Tingkat 10</option>
              <option value="11">Tingkat 11</option>
              <option value="12">Tingkat 12</option>
            </select>
          )}

          {activeTab === 'trash' && (
            <select
              className="master-data__filter-select"
              value={trashEntityFilter}
              onChange={(e) => setTrashEntityFilter(e.target.value)}
            >
              <option value="all">Semua Kategori</option>
              <option value="guru">Guru</option>
              <option value="siswa">Siswa</option>
              <option value="kelas">Kelas</option>
              <option value="ruang">Ruangan</option>
              <option value="mapel">Mata Pelajaran</option>
            </select>
          )}

          {/* Quick Select All / Deselect All Button for Guru & Siswa */}
          {(activeTab === 'guru' || activeTab === 'siswa') && filteredData.length > 0 && (
            <div className="master-data__selection-quick-actions">
              {currentSelectedIds.length === 0 ? (
                <Button
                  variant="outline"
                  size="sm"
                  icon={CheckSquare}
                  onClick={handleSelectAllFiltered}
                  title={`Pilih seluruh ${filteredData.length} ${activeTab === 'guru' ? 'guru' : 'siswa'}`}
                >
                  Pilih Semua ({filteredData.length})
                </Button>
              ) : (
                <Button
                  variant="secondary"
                  size="sm"
                  icon={XSquare}
                  onClick={handleDeselectAll}
                  title="Batalkan seluruh pilihan data"
                >
                  Batalkan Pilihan ({currentSelectedIds.length})
                </Button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Selection Action Toolbar for Guru & Siswa */}
      {(activeTab === 'guru' || activeTab === 'siswa') && currentSelectedIds.length > 0 && (
        <div className="master-data__selection-bar">
          <div className="master-data__selection-bar-left">
            <div className="master-data__selection-bar-info">
              <CheckSquare size={16} className="text-slate-800" />
              <span className="master-data__selection-bar-text">
                <strong>{currentSelectedIds.length}</strong> {activeTab === 'guru' ? 'guru' : 'siswa'} dipilih
                {filteredData.length < (activeTab === 'guru' ? teacherList.length : studentList.length) && (
                  <span className="text-xs text-neutral-500 font-normal ml-1">
                    (dari {filteredData.length} hasil filter)
                  </span>
                )}
              </span>
            </div>

            <div className="master-data__selection-bar-actions">
              {currentSelectedIds.length < filteredData.length && (
                <button
                  type="button"
                  className="master-data__selection-link-btn"
                  onClick={handleSelectAllFiltered}
                >
                  Pilih Semua ({filteredData.length})
                </button>
              )}
              <button
                type="button"
                className="master-data__selection-link-btn master-data__selection-link-btn--danger"
                onClick={handleDeselectAll}
              >
                Batalkan Pilihan
              </button>
            </div>
          </div>

          <div className="master-data__selection-crud-toolbar">
            {/* Create */}
            <Button
              variant="outline"
              size="sm"
              icon={Plus}
              onClick={handleOpenAdd}
              title={`Tambah data ${activeTab === 'guru' ? 'guru' : 'siswa'} baru`}
            >
              Tambah Baru
            </Button>

            {/* Read: Detail */}
            <Button
              variant="secondary"
              size="sm"
              icon={Eye}
              onClick={() => singleSelectedItem && setDetailItem(singleSelectedItem)}
              disabled={currentSelectedIds.length !== 1}
              title={
                currentSelectedIds.length === 1
                  ? `Lihat detail lengkap ${singleSelectedItem?.name}`
                  : 'Pilih tepat 1 data untuk melihat detail'
              }
            >
              Lihat Detail
            </Button>

            {/* Update: Edit */}
            <Button
              variant="secondary"
              size="sm"
              icon={Pencil}
              onClick={() => singleSelectedItem && handleOpenEdit(singleSelectedItem)}
              disabled={currentSelectedIds.length !== 1}
              title={
                currentSelectedIds.length === 1
                  ? `Edit data ${singleSelectedItem?.name}`
                  : 'Pilih tepat 1 data untuk mengedit data'
              }
            >
              Edit
            </Button>

            {/* Extra for Guru: Penugasan */}
            {activeTab === 'guru' && (
              <Button
                variant="secondary"
                size="sm"
                icon={UserCheck}
                onClick={() => singleSelectedItem && handleOpenAssignment(singleSelectedItem)}
                disabled={currentSelectedIds.length !== 1}
                title={
                  currentSelectedIds.length === 1
                    ? `Kelola tugas tambahan & mapel ${singleSelectedItem?.name}`
                    : 'Pilih tepat 1 guru untuk penugasan'
                }
              >
                Penugasan
              </Button>
            )}

            {/* Delete: Single or Bulk */}
            <Button
              variant="danger"
              size="sm"
              icon={Trash2}
              onClick={() => {
                if (currentSelectedIds.length === 1) {
                  handleOpenDelete(singleSelectedItem);
                } else {
                  setIsBulkDeleteOpen(true);
                }
              }}
              title={
                currentSelectedIds.length === 1
                  ? `Hapus data ${singleSelectedItem?.name}`
                  : `Hapus ${currentSelectedIds.length} data terpilih`
              }
            >
              Hapus {currentSelectedIds.length > 1 ? `(${currentSelectedIds.length})` : ''}
            </Button>
          </div>
        </div>
      )}

      {/* Table Data or States */}
      {isLoading ? (
        <div className="bg-white rounded-lg border border-neutral-200 overflow-hidden">
          <SkeletonRow count={6} />
        </div>
      ) : fetchError ? (
        <ErrorState
          title="Gagal Memuat Data"
          message={fetchError}
          onRetry={handleRefresh}
        />
      ) : filteredData.length === 0 ? (
        <EmptyState
          title={activeTab === 'trash' ? 'Tempat Sampah Kosong' : 'Tidak Ada Data Ditemukan'}
          message={
            searchQuery
              ? `Tidak ditemukan hasil yang cocok dengan kata kunci "${searchQuery}".`
              : activeTab === 'trash'
              ? 'Tidak ada data master yang berada di Tempat Sampah saat ini.'
              : `Belum ada data ${tabs.find((t) => t.id === activeTab)?.label.toLowerCase()} yang terdaftar.`
          }
          actionLabel={searchQuery ? 'Reset Pencarian' : activeTab === 'trash' ? null : `Tambah Data Baru`}
          onAction={searchQuery ? () => setSearchQuery('') : activeTab === 'trash' ? undefined : handleOpenAdd}
        />
      ) : (
        <div className="bg-white rounded-lg border border-neutral-200 overflow-hidden shadow-2xs">
          <Table
            columns={columns}
            data={filteredData}
            pageSize={25}
            currentPage={activeTab === 'siswa' ? studentPagination.currentPage : undefined}
            totalPages={activeTab === 'siswa' ? studentPagination.lastPage : undefined}
            totalItems={activeTab === 'siswa' ? studentPagination.total : undefined}
            onPageChange={activeTab === 'siswa' ? handleStudentPageChange : undefined}
            selectable={activeTab === 'guru' || activeTab === 'siswa'}
            selectedRowKeys={currentSelectedIds}
            onSelectRow={handleSelectRow}
            onSelectAllCurrentPage={handleSelectAllCurrentPage}
            onSelectAllData={handleSelectAllFiltered}
            onDeselectAll={handleDeselectAll}
            selectionLabel={activeTab === 'guru' ? 'guru' : activeTab === 'siswa' ? 'siswa' : 'data'}
          />
        </div>
      )}
        </>
      )}

      {/* Form Modal (Create / Edit) */}
      <Modal
        isOpen={modalType !== null}
        onClose={() => setModalType(null)}
        title={
          modalType === 'create'
            ? `Tambah ${tabs.find((t) => t.id === activeTab)?.label} Baru`
            : `Edit ${tabs.find((t) => t.id === activeTab)?.label}`
        }
        size="md"
        footer={
          <div className="flex justify-end gap-2 w-full">
            <Button
              variant="secondary"
              onClick={() => setModalType(null)}
              disabled={isSubmitting}
            >
              Batal
            </Button>
            <Button
              variant="primary"
              onClick={handleSaveForm}
              loading={isSubmitting}
              disabled={isSubmitting}
            >
              {modalType === 'create' ? 'Simpan Data' : 'Perbarui Data'}
            </Button>
          </div>
        }
      >
        <form onSubmit={handleSaveForm} className="master-data-form">
          {formErrors.general && (
            <div className="master-data-form__error">{formErrors.general}</div>
          )}

          {/* TAB 1: KELAS */}
          {activeTab === 'kelas' && (
            <>
              <Input
                label="Nama Kelas / Rombel"
                placeholder="Contoh: X-RPL-1, XI-TKJ-2"
                value={formData.name || ''}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                error={formErrors.name?.[0]}
                required
              />

              <Select
                label="Tingkat Kelas"
                value={formData.level || '10'}
                onChange={(e) => setFormData({ ...formData, level: e.target.value })}
                options={[
                  { value: '10', label: 'Tingkat 10 (Kelas Sepuluh)' },
                  { value: '11', label: 'Tingkat 11 (Kelas Sebelas)' },
                  { value: '12', label: 'Tingkat 12 (Kelas Dua Belas)' },
                ]}
              />

              <Select
                label="Kelas Kenaikan Tujuan (next_class_id)"
                value={formData.next_class_id || ''}
                onChange={(e) => setFormData({ ...formData, next_class_id: e.target.value })}
                options={[
                  { value: '', label: '-- Tidak Ada / Tingkat Akhir (Lulus) --' },
                  ...classList
                    .filter((c) => !editingItem || c.id !== editingItem.id)
                    .map((c) => ({
                      value: String(c.id),
                      label: `${c.name} (Tingkat ${c.level})`,
                    })),
                ]}
              />
            </>
          )}

          {/* TAB 2: RUANGAN */}
          {activeTab === 'ruang' && (
            <>
              <Input
                label="Nama Ruangan"
                placeholder="Contoh: R-101, Lab Multimedia 1"
                value={formData.name || ''}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                error={formErrors.name?.[0]}
                required
              />

              <Input
                label="Kapasitas Kursi Siswa"
                type="number"
                min="1"
                max="100"
                value={formData.capacity || '36'}
                onChange={(e) => setFormData({ ...formData, capacity: e.target.value })}
                error={formErrors.capacity?.[0]}
                required
              />
            </>
          )}

          {/* TAB 3: MATA PELAJARAN */}
          {activeTab === 'mapel' && (
            <Input
              label="Nama Mata Pelajaran"
              placeholder="Contoh: Matematika, Pemrograman Web"
              value={formData.name || ''}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              error={formErrors.name?.[0]}
              required
            />
          )}

          {/* TAB 4: GURU */}
          {activeTab === 'guru' && (
            <>
              <Input
                label="Nama Lengkap Guru (beserta Gelar)"
                placeholder="Contoh: Drs. Bambang Irawan, M.Pd."
                value={formData.name || ''}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                error={formErrors.name?.[0]}
                required
              />

              <Input
                label="NIP / Identitas Pegawai"
                placeholder="Nomor Induk Pegawai 18 digit atau kode unik"
                value={formData.nip || ''}
                onChange={(e) => setFormData({ ...formData, nip: e.target.value })}
                error={formErrors.nip?.[0] || formErrors.nis_nip?.[0]}
                required
              />

              <Select
                label="Mata Pelajaran yang Diampu (Opsional)"
                value={formData.subject_id || ''}
                onChange={(e) => setFormData({ ...formData, subject_id: e.target.value })}
                error={formErrors.subject_id?.[0]}
                options={[
                  { value: '', label: '-- Pilih Mata Pelajaran --' },
                  ...subjectList.map((s) => ({
                    value: String(s.id),
                    label: s.name,
                  })),
                ]}
              />

              <Input
                label="Email Institusi (Opsional)"
                type="email"
                placeholder="guru@sekolah.sch.id"
                value={formData.email || ''}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                error={formErrors.email?.[0]}
              />

              <Input
                label="Nomor Telepon / WhatsApp (Opsional)"
                type="tel"
                placeholder="Contoh: 081234567890"
                value={formData.phone_number || ''}
                onChange={(e) => setFormData({ ...formData, phone_number: e.target.value })}
                error={formErrors.phone_number?.[0]}
                helperText="Format nomor seluler Indonesia (08...)"
              />

              {modalType === 'create' && (
                <div className="master-data-form__hint">
                  <Info size={16} className="text-gray-500 shrink-0 mt-0.5" />
                  <span>
                    ID Login Guru adalah <strong>NIP</strong> dan Kata Sandi Awal adalah <strong>GuruSCP@{'{4 angka terakhir NIP}'}!</strong> (wajib ganti kata sandi pada login pertama).
                  </span>
                </div>
              )}
            </>
          )}

          {/* TAB 5: SISWA */}
          {activeTab === 'siswa' && (
            <>
              <Input
                label="Nama Lengkap Siswa"
                placeholder="Contoh: Ananda Pratama"
                value={formData.name || ''}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                error={formErrors.name?.[0]}
                required
              />

              <Input
                label="Nomor Induk Siswa (NIS)"
                placeholder="Contoh: 2024001"
                value={formData.nis || ''}
                onChange={(e) => setFormData({ ...formData, nis: e.target.value })}
                error={formErrors.nis?.[0]}
                required
              />

              <Input
                label="Nomor Absen"
                type="number"
                placeholder="Contoh: 1"
                min="1"
                max="100"
                value={formData.student_number || ''}
                onChange={(e) => setFormData({ ...formData, student_number: e.target.value })}
                error={formErrors.student_number?.[0]}
                helperText="Nomor urut presensi siswa di kelas"
              />

              <Select
                label="Rombel Kelas"
                value={formData.class_id || ''}
                onChange={(e) => setFormData({ ...formData, class_id: e.target.value })}
                options={[
                  { value: '', label: '-- Pilih Rombel Kelas --' },
                  ...classList.map((c) => ({
                    value: String(c.id),
                    label: `${c.name} (Tingkat ${c.level})`,
                  })),
                ]}
                error={formErrors.class_id?.[0]}
                required
              />

              <Select
                label="Jenis Kelamin"
                value={formData.gender || ''}
                onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                options={[
                  { value: '', label: '-- Pilih Jenis Kelamin (Wajib) --' },
                  { value: 'L', label: 'Laki-laki (L)' },
                  { value: 'P', label: 'Perempuan (P)' },
                ]}
                error={formErrors.gender?.[0]}
                required
              />

              <Input
                label="Nomor Induk Siswa Nasional (NISN)"
                placeholder="10 digit angka resmi Kemendikbud (Opsional)"
                value={formData.nisn || ''}
                onChange={(e) => {
                  const cleaned = e.target.value.replace(/\D/g, '').slice(0, 10);
                  setFormData({ ...formData, nisn: cleaned });
                }}
                maxLength={10}
                error={formErrors.nisn?.[0]}
                helperText="Opsional, 10 digit angka resmi NISN siswa"
              />

              {modalType === 'create' && (
                <div className="master-data-form__hint">
                  <Info size={16} className="text-gray-500 shrink-0 mt-0.5" />
                  <span>
                    Sistem akan membuat 2 akun sekaligus: akun <strong>Siswa</strong> (ID Login: <strong>NIS</strong>, Password Awal: <strong>NIS + No. Absen</strong>) dan akun <strong>Orang Tua</strong> (ID Login: <code>P-[NIS]</code>, Password Awal: <strong>NIS + No. Absen</strong>).
                  </span>
                </div>
              )}
            </>
          )}
        </form>
      </Modal>

      {/* Smart Delete Confirmation Modal */}
      <DeleteConfirmationModal
        isOpen={smartDeleteItem !== null}
        onClose={() => setSmartDeleteItem(null)}
        entityType={activeTab}
        item={smartDeleteItem}
        onSoftDelete={handleSoftDelete}
        onForceDelete={handleForceDelete}
        loading={isDeleting}
        serverError={smartDeleteError}
      />

      {/* HTTP 409 Conflict Dialog */}
      <DeleteConflictDialog
        isOpen={conflictError !== null}
        onClose={() => setConflictError(null)}
        entityName={conflictError?.entityName}
        entityType={conflictError?.entityType}
        errorMessage={conflictError?.errorMessage}
      />

      {/* Initial Credential Modal */}
      <InitialCredentialModal
        isOpen={credentialModalData !== null}
        onClose={() => setCredentialModalData(null)}
        data={credentialModalData}
      />

      {/* Teacher Assignment Modal */}
      <TeacherAssignmentModal
        isOpen={assignmentTeacher !== null}
        onClose={() => setAssignmentTeacher(null)}
        teacher={assignmentTeacher}
        classList={classList}
        onAssign={handleAssignRole}
        onRevoke={handleRevokeRole}
      />

      {/* Teacher Import Modal */}
      <Modal
        isOpen={isTeacherImportModalOpen}
        onClose={() => {
          if (!teacherImportLoading) setIsTeacherImportModalOpen(false);
        }}
        title="Impor Data Guru Massal (.xlsx)"
        size="lg"
        footer={
          <div className="flex justify-end gap-2 w-full">
            {teacherImportSuccess ? (
              <Button
                variant="primary"
                onClick={() => setIsTeacherImportModalOpen(false)}
              >
                Selesai
              </Button>
            ) : (
              <>
                <Button
                  variant="secondary"
                  onClick={() => setIsTeacherImportModalOpen(false)}
                  disabled={teacherImportLoading}
                >
                  Batal
                </Button>
                <Button
                  variant="primary"
                  icon={Upload}
                  onClick={handleSubmitTeacherImport}
                  loading={teacherImportLoading}
                  disabled={!teacherImportFile || teacherImportLoading}
                >
                  Unggah &amp; Impor
                </Button>
              </>
            )}
          </div>
        }
      >
        <div className="space-y-4">
          <div className="p-3.5 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-900 space-y-1.5">
            <div className="font-semibold flex items-center gap-1.5 text-blue-800">
              <Info size={15} />
              <span>Ketentuan Format Berkas Excel Guru:</span>
            </div>
            <ul className="list-disc pl-5 space-y-1 text-blue-800">
              <li>Header kolom: <strong>NO</strong>, <strong>NIP</strong> (18 digit PNS atau 16 digit NIK), <strong>NAMA</strong> (beserta gelar), <strong>MAPEL</strong> (mata pelajaran, opsional).</li>
              <li>Akun login guru menggunakan <strong>NIP</strong> sebagai ID Login dan kata sandi awal berformat <strong>GuruSCP@{'{4 angka terakhir NIP}'}!</strong> (wajib ganti kata sandi pada login pertama).</li>
            </ul>
          </div>

          {!teacherImportSuccess && (
            <FileUpload
              label="Pilih Berkas Spreadsheet (.xlsx)"
              accept=".xlsx"
              maxSizeMB={5}
              file={teacherImportFile}
              onChange={(f) => {
                setTeacherImportFile(f);
                setTeacherImportErrors(null);
                setTeacherImportGeneralError(null);
              }}
              disabled={teacherImportLoading}
              hint="Format berkas .xlsx (Excel), Maksimal 5 MB"
            />
          )}

          {/* Success Result Box */}
          {teacherImportSuccess && (
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg space-y-2">
              <div className="flex items-center gap-2 text-emerald-800 font-semibold text-sm">
                <CheckCircle2 size={18} className="text-emerald-600" />
                <span>Data Guru Berhasil Diimpor!</span>
              </div>
              <p className="text-xs text-emerald-700">
                Sebanyak <strong>{teacherImportSuccess.imported_count}</strong> data guru telah berhasil diregistrasikan ke sistem beserta akun login.
              </p>
            </div>
          )}

          {/* General Error Banner */}
          {teacherImportGeneralError && (
            <div className="p-3.5 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2 text-xs text-red-700">
              <AlertCircle size={16} className="text-red-500 shrink-0 mt-0.5" />
              <span>{teacherImportGeneralError}</span>
            </div>
          )}

          {/* Atomic Row Errors Table */}
          {teacherImportErrors && teacherImportErrors.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold text-red-800">
                <span className="flex items-center gap-1.5">
                  <AlertCircle size={15} className="text-red-600" />
                  Kesalahan Validasi Berkas ({teacherImportErrors.length} baris)
                </span>
                <span className="text-[11px] font-normal text-gray-500">
                  Transaksi dibatalkan. Mohon perbaiki dan unggah kembali.
                </span>
              </div>
              <div className="max-h-56 overflow-y-auto border border-red-200 rounded-md text-xs">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-red-50 text-red-900 font-semibold sticky top-0 border-b border-red-200">
                    <tr>
                      <th className="py-2 px-3 w-20">Baris</th>
                      <th className="py-2 px-3 w-32">Kolom</th>
                      <th className="py-2 px-3">Keterangan Masalah</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-red-100 bg-white">
                    {teacherImportErrors.map((err, idx) => (
                      <tr key={idx} className="hover:bg-red-50/50">
                        <td className="py-2 px-3 font-mono font-medium text-red-900">
                          Baris {err.row}
                        </td>
                        <td className="py-2 px-3 font-mono text-gray-700">
                          {err.attribute}
                        </td>
                        <td className="py-2 px-3 text-red-700">
                          {err.message}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </Modal>

      {/* Student Import Modal */}
      <Modal
        isOpen={isStudentImportModalOpen}
        onClose={() => {
          if (!studentImportLoading) setIsStudentImportModalOpen(false);
        }}
        title="Impor Data Siswa Massal (.xlsx)"
        size="lg"
        footer={
          <div className="flex justify-end gap-2 w-full">
            {studentImportSuccess ? (
              <Button
                variant="primary"
                onClick={() => setIsStudentImportModalOpen(false)}
              >
                Selesai
              </Button>
            ) : (
              <>
                <Button
                  variant="secondary"
                  onClick={() => setIsStudentImportModalOpen(false)}
                  disabled={studentImportLoading}
                >
                  Batal
                </Button>
                <Button
                  variant="primary"
                  icon={Upload}
                  onClick={handleSubmitStudentImport}
                  loading={studentImportLoading}
                  disabled={!studentImportFile || studentImportLoading}
                >
                  Unggah &amp; Impor
                </Button>
              </>
            )}
          </div>
        }
      >
        <div className="space-y-4">
          <div className="p-3.5 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-900 space-y-1.5">
            <div className="font-semibold flex items-center gap-1.5 text-blue-800">
              <Info size={15} />
              <span>Fitur Otomatisasi Zero-Manual (SCP v4.5):</span>
            </div>
            <ul className="list-disc pl-5 space-y-1 text-blue-800">
              <li><strong>Format Berkas</strong>: Template buku presensi resmi per tingkatan (Sheet X, XI, XII) memuat kolom <strong>Urt</strong> (No. Absen), <strong>NIS</strong>, <strong>NAMA SISWA</strong>, dan <strong>L / P</strong>.</li>
              <li><strong>Kredensial Login</strong>: Siswa menggunakan ID Login <strong>NIS</strong> dan kata sandi awal <strong>NIS + Nomor Absen</strong> (Contoh: NIS <code>18260</code>, Absen <code>1</code> &rarr; Password <code>182601</code>). Orang tua menggunakan ID Login <code>P-[NIS]</code> dengan kata sandi awal yang sama.</li>
              <li><strong>Auto-Create Kelas</strong>: Rombel kelas pada berkas didaftarkan otomatis sesuai tingkatannya (10, 11, 12).</li>
              <li><strong>Auto-Provisioning Akun Orang Tua</strong>: Akun orang tua otomatis dibuat dengan format nama <strong>"Wali Murid [Nama Siswa]"</strong> dan username <code>P-[NIS]</code> (keduanya wajib ganti sandi pada login pertama).</li>
            </ul>
          </div>

          {!studentImportSuccess && (
            <FileUpload
              label="Pilih Berkas Spreadsheet (.xlsx)"
              accept=".xlsx"
              maxSizeMB={5}
              file={studentImportFile}
              onChange={(f) => {
                setStudentImportFile(f);
                setStudentImportErrors(null);
                setStudentImportGeneralError(null);
              }}
              disabled={studentImportLoading}
              hint="Format berkas .xlsx (Excel), Maksimal 5 MB"
            />
          )}

          {/* Success Result Box */}
          {studentImportSuccess && (
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg space-y-3">
              <div className="flex items-center gap-2 text-emerald-800 font-semibold text-sm">
                <CheckCircle2 size={18} className="text-emerald-600" />
                <span>Siswa berhasil diimpor dan kelas baru telah otomatis didaftarkan.</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-xs">
                <div className="bg-white p-2.5 rounded border border-emerald-100 text-center">
                  <div className="text-[11px] text-gray-500">Siswa Diimpor</div>
                  <div className="text-base font-bold text-emerald-700">
                    {studentImportSuccess.students_imported ?? 0}
                  </div>
                </div>
                <div className="bg-white p-2.5 rounded border border-emerald-100 text-center">
                  <div className="text-[11px] text-gray-500">Kelas Baru Dibuat</div>
                  <div className="text-base font-bold text-blue-700">
                    {studentImportSuccess.classes_created ?? 0}
                  </div>
                </div>
                <div className="bg-white p-2.5 rounded border border-emerald-100 text-center">
                  <div className="text-[11px] text-gray-500">Kelas Telah Ada</div>
                  <div className="text-base font-bold text-gray-700">
                    {studentImportSuccess.classes_existing ?? 0}
                  </div>
                </div>
                <div className="bg-white p-2.5 rounded border border-emerald-100 text-center">
                  <div className="text-[11px] text-gray-500">Akun Ortu Dibuat</div>
                  <div className="text-base font-bold text-purple-700">
                    {studentImportSuccess.parents_imported ?? 0}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* General Error Banner */}
          {studentImportGeneralError && (
            <div className="p-3.5 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2 text-xs text-red-700">
              <AlertCircle size={16} className="text-red-500 shrink-0 mt-0.5" />
              <span>{studentImportGeneralError}</span>
            </div>
          )}

          {/* Atomic Row Errors Table */}
          {studentImportErrors && studentImportErrors.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold text-red-800">
                <span className="flex items-center gap-1.5">
                  <AlertCircle size={15} className="text-red-600" />
                  Kesalahan Validasi Berkas ({studentImportErrors.length} baris)
                </span>
                <span className="text-[11px] font-normal text-gray-500">
                  Transaksi dibatalkan. Mohon perbaiki dan unggah kembali.
                </span>
              </div>
              <div className="max-h-56 overflow-y-auto border border-red-200 rounded-md text-xs">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-red-50 text-red-900 font-semibold sticky top-0 border-b border-red-200">
                    <tr>
                      <th className="py-2 px-3 w-20">Baris</th>
                      <th className="py-2 px-3 w-32">Kolom</th>
                      <th className="py-2 px-3">Keterangan Masalah</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-red-100 bg-white">
                    {studentImportErrors.map((err, idx) => (
                      <tr key={idx} className="hover:bg-red-50/50">
                        <td className="py-2 px-3 font-mono font-medium text-red-900">
                          Baris {err.row}
                        </td>
                        <td className="py-2 px-3 font-mono text-gray-700">
                          {err.attribute}
                        </td>
                        <td className="py-2 px-3 text-red-700">
                          {err.message}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </Modal>

      {/* Detail Modal (Read Action) */}
      <Modal
        isOpen={detailItem !== null}
        onClose={() => setDetailItem(null)}
        title={`Detail Data ${activeTab === 'guru' ? 'Guru' : 'Siswa'}`}
        size="md"
        footer={
          <div className="flex items-center justify-between w-full">
            <Button variant="secondary" onClick={() => setDetailItem(null)}>
              Tutup
            </Button>
            <div className="flex items-center gap-2">
              {activeTab === 'guru' && detailItem && (
                <Button
                  variant="outline"
                  icon={UserCheck}
                  onClick={() => {
                    const item = detailItem;
                    setDetailItem(null);
                    handleOpenAssignment(item);
                  }}
                >
                  Penugasan
                </Button>
              )}
              {detailItem && (
                <Button
                  variant="primary"
                  icon={Pencil}
                  onClick={() => {
                    const item = detailItem;
                    setDetailItem(null);
                    handleOpenEdit(item);
                  }}
                >
                  Edit Data
                </Button>
              )}
            </div>
          </div>
        }
      >
        {detailItem && (
          <div className="space-y-4">
            <div className="master-data__detail-card">
              <div className="master-data__detail-avatar">
                {detailItem.name?.charAt(0)?.toUpperCase() || '?'}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-semibold text-base text-neutral-900 truncate">
                    {detailItem.name}
                  </h3>
                  {activeTab === 'guru' ? (
                    <Badge variant={detailItem.status === 'ASN' ? 'success' : 'neutral'}>
                      {detailItem.status || 'GTT'}
                    </Badge>
                  ) : (
                    <Badge variant="primary">
                      {detailItem.school_class?.name || detailItem.schoolClass?.name || detailItem.className || 'Belum Ada Kelas'}
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-neutral-500 font-mono mt-0.5">
                  {activeTab === 'guru'
                    ? `NIP: ${detailItem.nip || detailItem.nis_nip || '-'}`
                    : `NIS: ${detailItem.nis || detailItem.nis_nip || '-'} • NISN: ${detailItem.nisn || '-'}`}
                </p>
              </div>
            </div>

            <div className="master-data__detail-grid">
              {activeTab === 'guru' ? (
                <>
                  <div className="master-data__detail-item">
                    <span className="master-data__detail-label">Jenis Kelamin</span>
                    <span className="master-data__detail-value">
                      {detailItem.gender === 'L' ? 'Laki-laki (L)' : detailItem.gender === 'P' ? 'Perempuan (P)' : '-'}
                    </span>
                  </div>
                  <div className="master-data__detail-item">
                    <span className="master-data__detail-label">Status Kepegawaian</span>
                    <span className="master-data__detail-value">
                      {detailItem.status || 'GTT / Honorer'}
                    </span>
                  </div>
                  <div className="master-data__detail-item">
                    <span className="master-data__detail-label">Email</span>
                    <span className="master-data__detail-value truncate" title={detailItem.email}>
                      {detailItem.email || '-'}
                    </span>
                  </div>
                  <div className="master-data__detail-item">
                    <span className="master-data__detail-label">Nomor Telepon</span>
                    <span className="master-data__detail-value">
                      {detailItem.phone_number || detailItem.phone || '-'}
                    </span>
                  </div>
                  <div className="master-data__detail-item col-span-2">
                    <span className="master-data__detail-label">Mata Pelajaran Diampu</span>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {Array.isArray(detailItem.subjects) && detailItem.subjects.length > 0 ? (
                        detailItem.subjects.map((sub, idx) => (
                          <Badge key={idx} variant="info">{sub.name || sub}</Badge>
                        ))
                      ) : detailItem.subject_name || detailItem.subject?.name ? (
                        <Badge variant="info">{detailItem.subject_name || detailItem.subject?.name}</Badge>
                      ) : (
                        <span className="text-xs text-neutral-400">Belum ada mapel diampu</span>
                      )}
                    </div>
                  </div>
                  <div className="master-data__detail-item col-span-2">
                    <span className="master-data__detail-label">Tugas Tambahan &amp; Jabatan</span>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {Array.isArray(detailItem.assignments) && detailItem.assignments.length > 0 && (
                        <>
                          {detailItem.assignments
                            .filter((a) => a.type === 'wali_kelas')
                            .map((a, idx) => {
                              const cName = a.school_class?.name || a.schoolClass?.name || '';
                              return (
                                <Badge key={`wali-${idx}`} variant="default">
                                  {`Wali ${cName}`}
                                </Badge>
                              );
                            })}
                          {detailItem.assignments.filter((a) => a.type === 'kesiswaan').length > 0 && (
                            <Badge
                              variant="warning"
                              title={
                                detailItem.assignments.filter((a) => a.type === 'kesiswaan').length > 1
                                  ? `Kesiswaan (${detailItem.assignments.filter((a) => a.type === 'kesiswaan').length} Kelas Binaan: ${detailItem.assignments
                                      .filter((a) => a.type === 'kesiswaan')
                                      .map((k) => k.school_class?.name || k.schoolClass?.name || '')
                                      .filter(Boolean)
                                      .join(', ')})`
                                  : 'Kesiswaan'
                              }
                            >
                              Kesiswaan
                            </Badge>
                          )}
                        </>
                      )}
                      {Array.isArray(detailItem.roles) && detailItem.roles.length > 0 ? (
                        detailItem.roles.map((r, idx) => (
                          <Badge key={idx} variant="neutral">{r.name || r}</Badge>
                        ))
                      ) : detailItem.additional_task ? (
                        <Badge variant="neutral">{detailItem.additional_task}</Badge>
                      ) : (!detailItem.assignments || detailItem.assignments.length === 0) ? (
                        <span className="text-xs text-neutral-400">Guru Reguler (Tanpa Tugas Tambahan)</span>
                      ) : null}
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="master-data__detail-item">
                    <span className="master-data__detail-label">NIS</span>
                    <span className="master-data__detail-value font-mono">{detailItem.nis || detailItem.nis_nip || '-'}</span>
                  </div>
                  <div className="master-data__detail-item">
                    <span className="master-data__detail-label">NISN</span>
                    <span className="master-data__detail-value font-mono">{detailItem.nisn || '-'}</span>
                  </div>
                  <div className="master-data__detail-item">
                    <span className="master-data__detail-label">Jenis Kelamin</span>
                    <span className="master-data__detail-value">
                      {detailItem.gender === 'L' ? 'Laki-laki (L)' : detailItem.gender === 'P' ? 'Perempuan (P)' : '-'}
                    </span>
                  </div>
                  <div className="master-data__detail-item">
                    <span className="master-data__detail-label">Kelas / Rombel</span>
                    <span className="master-data__detail-value">
                      {detailItem.school_class?.name || detailItem.schoolClass?.name || detailItem.className || '-'}
                    </span>
                  </div>
                  <div className="master-data__detail-item">
                    <span className="master-data__detail-label">Nama Orang Tua / Wali</span>
                    <span className="master-data__detail-value">
                      {detailItem.parent?.name || `Wali Murid ${detailItem.name}`}
                    </span>
                  </div>
                  <div className="master-data__detail-item">
                    <span className="master-data__detail-label">Username Akun Orang Tua</span>
                    <span className="master-data__detail-value font-mono">P-{detailItem.nis || detailItem.nis_nip}</span>
                  </div>
                  <div className="master-data__detail-item">
                    <span className="master-data__detail-label">Kontak Orang Tua</span>
                    <span className="master-data__detail-value">
                      {detailItem.parent?.phone || detailItem.parent_phone || 'Belum diisi'}
                    </span>
                  </div>
                  <div className="master-data__detail-item">
                    <span className="master-data__detail-label">Status Siswa</span>
                    <span className="master-data__detail-value">
                      <Badge variant="success">Aktif</Badge>
                    </span>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* Bulk Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={isBulkDeleteOpen}
        onClose={() => !isBulkDeleting && setIsBulkDeleteOpen(false)}
        onConfirm={handleRequestBulkDeletePassword}
        title={`Hapus ${currentSelectedIds.length} ${activeTab === 'guru' ? 'Guru' : 'Siswa'} Terpilih`}
        message={`Apakah Anda yakin ingin menghapus ${currentSelectedIds.length} data ${
          activeTab === 'guru' ? 'guru' : 'siswa'
        } terpilih secara massal? Tindakan ini tidak dapat dibatalkan.`}
        confirmLabel="Lanjutkan ke Konfirmasi Sandi"
        confirmVariant="danger"
        loading={isBulkDeleting}
      />

      {/* Password Confirmation Modal (Step-Up Auth) */}
      <PasswordModal
        isOpen={isPasswordModalOpen}
        onClose={() => {
          if (!passwordModalLoading) {
            setIsPasswordModalOpen(false);
            setPasswordModalError('');
            setPendingPasswordAction(null);
          }
        }}
        onConfirm={handlePasswordConfirm}
        title={
          pendingPasswordAction?.type === 'reset_all'
            ? 'Konfirmasi Reset Master Data'
            : pendingPasswordAction?.type === 'edit'
            ? `Konfirmasi Pembaruan Data ${activeTab === 'guru' ? 'Guru' : 'Siswa'}`
            : pendingPasswordAction?.type === 'delete_trash_permanent'
            ? `Konfirmasi Hapus Permanen "${pendingPasswordAction?.item?.name}"`
            : pendingPasswordAction?.type === 'delete_bulk'
            ? `Konfirmasi Hapus Massal (${selectedItems.length} Data)`
            : `Konfirmasi Hapus Data ${activeTab === 'guru' ? 'Guru' : 'Siswa'}`
        }
        description={
          pendingPasswordAction?.type === 'reset_all'
            ? 'Tindakan ini akan menghapus seluruh Master Data sekolah (kelas rombel, ruang belajar, mata pelajaran, profil guru, dan peserta didik).'
            : pendingPasswordAction?.type === 'edit'
            ? `Masukkan kata sandi akun Anda untuk memvalidasi dan menyimpan pembaruan data "${pendingPasswordAction?.name}".`
            : pendingPasswordAction?.type === 'delete_trash_permanent'
            ? `Masukkan kata sandi akun Anda untuk memvalidasi penghapusan data "${pendingPasswordAction?.item?.name}" secara permanen dari Tempat Sampah.`
            : pendingPasswordAction?.type === 'delete_bulk'
            ? `Tindakan ini tidak dapat dibatalkan. Masukkan kata sandi akun Anda untuk mengonfirmasi penghapusan ${selectedItems.length} data ${
                activeTab === 'guru' ? 'guru' : 'siswa'
              } terpilih secara permanen.`
            : `Tindakan ini tidak dapat dibatalkan. Masukkan kata sandi akun Anda untuk menghapus data "${pendingPasswordAction?.item?.name}".`
        }
        consequence={
          pendingPasswordAction?.type === 'reset_all'
            ? 'PERINGATAN: Tindakan ini akan mengosongkan seluruh data master sekolah. Reset Master Data AKAN DITOLAK secara otomatis oleh sistem apabila masih terdapat Data Jadwal yang terhubung. Tindakan ini tidak dapat dibatalkan. Masukkan kata sandi akun Anda untuk mengonfirmasi.'
            : pendingPasswordAction?.type === 'delete_trash_permanent'
            ? pendingPasswordAction?.item?.has_legal_history
              ? 'Data ini memiliki riwayat KBM / Presensi legal. Sistem akan mengarsipkan dan menganonimkan identitas data agar dokumen sekolah masa lalu tetap valid.'
              : 'Data ini tidak memiliki riwayat keterikatan dan akan dihapus secara fisik dan permanen dari database.'
            : ''
        }
        confirmText={
          pendingPasswordAction?.type === 'reset_all'
            ? 'Reset Master Data'
            : pendingPasswordAction?.type === 'edit'
            ? 'Konfirmasi & Simpan'
            : pendingPasswordAction?.type === 'delete_trash_permanent'
            ? 'Hapus Permanen'
            : pendingPasswordAction?.type === 'delete_bulk'
            ? `Konfirmasi & Hapus (${selectedItems.length})`
            : 'Konfirmasi & Hapus'
        }
        confirmVariant={pendingPasswordAction?.type === 'edit' ? 'primary' : 'danger'}
        loading={passwordModalLoading}
        serverError={passwordModalError}
      />

      {/* Bulk Delete Summary / Report Modal */}
      <Modal
        isOpen={bulkDeleteSummary !== null}
        onClose={() => setBulkDeleteSummary(null)}
        title={`Laporan Penghapusan Massal ${bulkDeleteSummary?.entityType || 'Data'}`}
        size="md"
        footer={
          <div className="flex justify-end w-full">
            <Button variant="primary" onClick={() => setBulkDeleteSummary(null)}>
              Tutup
            </Button>
          </div>
        }
      >
        {bulkDeleteSummary && (
          <div className="space-y-4">
            {bulkDeleteSummary.failedCount === 0 ? (
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center gap-3 text-emerald-800 text-sm">
                <CheckCircle2 size={20} className="text-emerald-600 shrink-0" />
                <div>
                  <div className="font-semibold">Penghapusan Massal Berhasil</div>
                  <div className="text-xs text-emerald-700 mt-0.5">
                    Seluruh {bulkDeleteSummary.successCount} data {bulkDeleteSummary.entityType.toLowerCase()} terpilih berhasil dihapus dari sistem.
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2.5 text-xs text-amber-800">
                  <AlertCircle size={18} className="text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold">
                      {bulkDeleteSummary.successCount} dari {bulkDeleteSummary.total} data berhasil dihapus.
                    </span>
                    <p className="mt-0.5 text-amber-700">
                      Terdapat {bulkDeleteSummary.failedCount} data yang tidak dapat dihapus karena keterkaitan relasi database (misal jadwal KBM aktif).
                    </p>
                  </div>
                </div>

                <div className="border border-neutral-200 rounded-lg overflow-hidden text-xs">
                  <div className="bg-neutral-50 px-3 py-2 font-semibold text-neutral-700 border-b border-neutral-200">
                    Daftar Data yang Gagal Dihapus ({bulkDeleteSummary.failedCount})
                  </div>
                  <div className="max-h-52 overflow-y-auto divide-y divide-neutral-100">
                    {bulkDeleteSummary.failedItems.map((fail) => (
                      <div key={fail.id} className="p-3 bg-white space-y-1">
                        <div className="flex items-center justify-between font-medium text-neutral-900">
                          <span>{fail.name}</span>
                          <span className="text-[11px] font-mono text-neutral-500">{fail.identifier}</span>
                        </div>
                        <div className="text-[11px] text-red-600">
                          {fail.reason}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
