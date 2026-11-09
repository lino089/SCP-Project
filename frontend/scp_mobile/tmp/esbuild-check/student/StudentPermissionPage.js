import { useState, useEffect, useMemo, useCallback } from "react";
import {
  FileText,
  Trash2,
  Edit2,
  Eye,
  AlertCircle,
  Send,
  RotateCw,
  Plus,
  ExternalLink,
  Upload,
  CheckCircle2
} from "lucide-react";
import { leaveApi } from "../../services/leaveApi";
import academicEventApi from "../../services/academicEventApi";
import { getStorageUrl, getFallbackStorageUrl } from "../../utils/formatters";
import { unwrap } from "../../utils/responseHelper";
import { todayLocalISO } from "../../utils/dateUtils";
import {
  Button,
  Input,
  Select,
  BottomSheetModal,
  ConfirmSheet,
  DataTable,
  PaginationBar
} from "../../components/shared";
import { EmptyState } from "../../components/feedback";
function LeaveFormFields({
  type,
  onTypeChange,
  category,
  onCategoryChange,
  startDate,
  onStartDateChange,
  endDate,
  onEndDateChange,
  date,
  onDateChange,
  departureTime,
  onDepartureTimeChange,
  expectedReturnTime,
  onExpectedReturnTimeChange,
  fileInputId,
  uploadTitle,
  uploadHint,
  uploadedFile,
  onFileChange
}) {
  return /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("div", { className: "space-y-1" }, /* @__PURE__ */ React.createElement("label", { className: "field-label", htmlFor: `${fileInputId}-type` }, "Tipe Perizinan"), /* @__PURE__ */ React.createElement(
    Select,
    {
      id: `${fileInputId}-type`,
      value: type,
      onChange: (e) => onTypeChange(e.target.value)
    },
    /* @__PURE__ */ React.createElement("option", { value: "tidak_masuk" }, "Tidak Masuk Sekolah (Seharian / Berhari-hari)"),
    /* @__PURE__ */ React.createElement("option", { value: "keluar_sekolah" }, "Keluar Sekolah (Dispensasi Waktu Tertentu)")
  )), /* @__PURE__ */ React.createElement("div", { className: "space-y-1" }, /* @__PURE__ */ React.createElement("label", { className: "field-label", htmlFor: `${fileInputId}-category` }, "Kategori Alasan"), /* @__PURE__ */ React.createElement(
    Select,
    {
      id: `${fileInputId}-category`,
      value: category,
      onChange: (e) => onCategoryChange(e.target.value)
    },
    /* @__PURE__ */ React.createElement("option", { value: "sakit" }, "Sakit (Wajib Surat Dokter/Pemberitahuan)"),
    /* @__PURE__ */ React.createElement("option", { value: "lainnya" }, "Lainnya (Keperluan Keluarga, Lomba, dll)")
  )), type === "tidak_masuk" ? /* @__PURE__ */ React.createElement("div", { className: "grid grid-cols-2 gap-2.5" }, /* @__PURE__ */ React.createElement("div", { className: "space-y-1" }, /* @__PURE__ */ React.createElement("label", { className: "field-label", htmlFor: `${fileInputId}-start` }, "Tanggal Mulai"), /* @__PURE__ */ React.createElement(
    Input,
    {
      id: `${fileInputId}-start`,
      type: "date",
      value: startDate,
      onChange: (e) => onStartDateChange(e.target.value),
      required: true
    }
  )), /* @__PURE__ */ React.createElement("div", { className: "space-y-1" }, /* @__PURE__ */ React.createElement("label", { className: "field-label", htmlFor: `${fileInputId}-end` }, "Tanggal Selesai"), /* @__PURE__ */ React.createElement(
    Input,
    {
      id: `${fileInputId}-end`,
      type: "date",
      value: endDate,
      onChange: (e) => onEndDateChange(e.target.value),
      required: true
    }
  ))) : /* @__PURE__ */ React.createElement("div", { className: "space-y-2.5" }, /* @__PURE__ */ React.createElement("div", { className: "space-y-1" }, /* @__PURE__ */ React.createElement("label", { className: "field-label", htmlFor: `${fileInputId}-date` }, "Tanggal Izin"), /* @__PURE__ */ React.createElement(
    Input,
    {
      id: `${fileInputId}-date`,
      type: "date",
      value: date,
      onChange: (e) => onDateChange(e.target.value),
      required: true
    }
  )), /* @__PURE__ */ React.createElement("div", { className: "grid grid-cols-2 gap-2.5" }, /* @__PURE__ */ React.createElement("div", { className: "space-y-1" }, /* @__PURE__ */ React.createElement("label", { className: "field-label", htmlFor: `${fileInputId}-depart` }, "Jam Keluar"), /* @__PURE__ */ React.createElement(
    Input,
    {
      id: `${fileInputId}-depart`,
      type: "time",
      value: departureTime,
      onChange: (e) => onDepartureTimeChange(e.target.value),
      required: true
    }
  )), /* @__PURE__ */ React.createElement("div", { className: "space-y-1" }, /* @__PURE__ */ React.createElement("label", { className: "field-label", htmlFor: `${fileInputId}-return` }, "Jam Kembali"), /* @__PURE__ */ React.createElement(
    Input,
    {
      id: `${fileInputId}-return`,
      type: "time",
      value: expectedReturnTime,
      onChange: (e) => onExpectedReturnTimeChange(e.target.value),
      required: true
    }
  )))), /* @__PURE__ */ React.createElement("div", { className: "space-y-1 pt-1" }, /* @__PURE__ */ React.createElement("div", { className: "flex items-center justify-between gap-2" }, /* @__PURE__ */ React.createElement("span", { className: "field-label mb-0" }, uploadTitle), category === "sakit" ? /* @__PURE__ */ React.createElement("span", { className: "text-[11px] font-semibold text-[var(--color-danger-fg)]" }, "*Wajib diunggah") : /* @__PURE__ */ React.createElement("span", { className: "text-[11px] text-[var(--color-text-muted)]" }, "Opsional")), /* @__PURE__ */ React.createElement("div", { className: "flex items-center gap-3 p-3 border border-dashed border-[var(--color-border-strong)] rounded-[10px] bg-[var(--color-surface)]" }, /* @__PURE__ */ React.createElement("span", { className: "icon-tile icon-tile--sm" }, /* @__PURE__ */ React.createElement(Upload, { size: 15 })), /* @__PURE__ */ React.createElement("div", { className: "min-w-0 flex-1" }, /* @__PURE__ */ React.createElement("p", { className: "text-[12px] font-medium text-[var(--color-text-primary)] truncate" }, uploadedFile ? uploadedFile.name : "Belum ada berkas dipilih"), /* @__PURE__ */ React.createElement("p", { className: "text-[10.5px] text-[var(--color-text-muted)]" }, uploadHint)), /* @__PURE__ */ React.createElement(
    "input",
    {
      type: "file",
      id: fileInputId,
      accept: ".jpg,.jpeg,.png,.pdf",
      onChange: (e) => onFileChange(e.target.files?.[0] || null),
      className: "hidden"
    }
  ), /* @__PURE__ */ React.createElement("label", { htmlFor: fileInputId, className: "chip shrink-0 cursor-pointer" }, "Pilih"))));
}
export default function StudentPermissionPage() {
  const [leaveRequests, setLeaveRequests] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState(null);
  const [toastMessage, setToastMessage] = useState("");
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [previewDoc, setPreviewDoc] = useState(null);
  const [editingItem, setEditingItem] = useState(null);
  const [deleteConfirmItem, setDeleteConfirmItem] = useState(null);
  const [type, setType] = useState("tidak_masuk");
  const [category, setCategory] = useState("sakit");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [date, setDate] = useState(() => todayLocalISO());
  const [departureTime, setDepartureTime] = useState("10:00");
  const [expectedReturnTime, setExpectedReturnTime] = useState("12:00");
  const [uploadedFile, setUploadedFile] = useState(null);
  const [formError, setFormError] = useState("");
  const [dateWarning, setDateWarning] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [docLoadError, setDocLoadError] = useState(false);
  const [docSourceUrl, setDocSourceUrl] = useState("");
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(""), 4e3);
  };
  const fetchLeaveRequests = useCallback(async () => {
    setFetchError(null);
    try {
      const res = await leaveApi.getLeaveRequests({ per_page: 50 });
      const list = Array.isArray(res) ? res : Array.isArray(res?.data) ? res.data : [];
      setLeaveRequests(list);
    } catch (err) {
      console.warn("Gagal memuat daftar perizinan:", err);
      setFetchError(err.message || "Gagal memuat data perizinan dari server.");
    } finally {
      setIsLoading(false);
    }
  }, []);
  useEffect(() => {
    let cancel = false;
    async function init() {
      try {
        await fetchLeaveRequests();
      } catch {
        if (!cancel) setFetchError("Gagal menghubungkan ke server.");
      }
    }
    init();
    return () => {
      cancel = true;
    };
  }, [fetchLeaveRequests]);
  const handleRefresh = async () => {
    setIsLoading(true);
    await fetchLeaveRequests();
  };
  useEffect(() => {
    let cancel = false;
    const checkSelectedDate = async () => {
      const targetDate = type === "tidak_masuk" ? startDate : date;
      if (!targetDate) {
        setDateWarning(null);
        return;
      }
      try {
        const res = await academicEventApi.checkExemption({
          for_my_class: 1,
          date: targetDate
        });
        if (cancel) return;
        const data = unwrap(res);
        if (data?.disabling_event) {
          const dev = data.disabling_event;
          setDateWarning(
            `Perhatian: Tanggal ${targetDate} bertepatan dengan "${dev.title}" yang meniadakan KBM.`
          );
        } else {
          setDateWarning(null);
        }
      } catch {
      }
    };
    checkSelectedDate();
    return () => {
      cancel = true;
    };
  }, [type, startDate, date]);
  const stats = useMemo(() => {
    return leaveRequests.reduce(
      (acc, item) => {
        acc.total += 1;
        const st = (item.status_approval || item.status || "").toLowerCase();
        if (st === "pending") acc.pending += 1;
        else if (st === "approved" || st === "disetujui") acc.approved += 1;
        else if (st === "rejected" || st === "ditolak") acc.rejected += 1;
        return acc;
      },
      { total: 0, pending: 0, approved: 0, rejected: 0 }
    );
  }, [leaveRequests]);
  const resetForm = () => {
    setType("tidak_masuk");
    setCategory("sakit");
    setStartDate("");
    setEndDate("");
    setDate(todayLocalISO());
    setDepartureTime("10:00");
    setExpectedReturnTime("12:00");
    setUploadedFile(null);
    setFormError("");
    setDateWarning(null);
  };
  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    setFormError("");
    if (type === "tidak_masuk") {
      if (!startDate || !endDate) {
        setFormError("Tanggal mulai dan selesai wajib diisi.");
        return;
      }
      if (endDate < startDate) {
        setFormError("Tanggal selesai tidak boleh lebih awal dari tanggal mulai.");
        return;
      }
    } else {
      if (!date || !departureTime || !expectedReturnTime) {
        setFormError("Tanggal dan jam keluar/kembali wajib diisi.");
        return;
      }
      if (expectedReturnTime <= departureTime) {
        setFormError("Jam kembali harus lebih akhir dari jam keluar.");
        return;
      }
    }
    if (category === "sakit" && !uploadedFile) {
      setFormError("Surat keterangan dokter/orang tua wajib diunggah untuk kategori sakit.");
      return;
    }
    if (uploadedFile && uploadedFile.size > 2 * 1024 * 1024) {
      setFormError("Ukuran berkas lampiran melebihi batas maksimal 2 MB.");
      return;
    }
    setIsSubmitting(true);
    try {
      const formData = new FormData();
      formData.append("type", type);
      formData.append("category", category);
      if (type === "tidak_masuk") {
        formData.append("start_date", startDate);
        formData.append("end_date", endDate);
      } else {
        formData.append("date", date);
        formData.append("departure_time", departureTime);
        formData.append("expected_return_time", expectedReturnTime);
      }
      if (uploadedFile) {
        formData.append("document", uploadedFile);
      }
      const res = await leaveApi.createLeaveRequest(formData);
      if (res?.data || res?.success) {
        const newItem = unwrap(res);
        setLeaveRequests((prev) => [newItem, ...prev]);
        setIsCreateModalOpen(false);
        resetForm();
        showToast("Permohonan perizinan berhasil diajukan dan menunggu verifikasi.");
      }
    } catch (err) {
      setFormError(
        err.response?.data?.message || err.message || "Gagal mengirim permohonan perizinan."
      );
    } finally {
      setIsSubmitting(false);
    }
  };
  const handleOpenEdit = (item) => {
    setEditingItem(item);
    setType(item.type);
    setCategory(item.category);
    setStartDate(item.start_date || "");
    setEndDate(item.end_date || "");
    setDate(item.start_date || todayLocalISO());
    setDepartureTime(item.departure_time ? item.departure_time.slice(0, 5) : "10:00");
    setExpectedReturnTime(
      item.expected_return_time ? item.expected_return_time.slice(0, 5) : "12:00"
    );
    setUploadedFile(null);
    setFormError("");
    setIsEditModalOpen(true);
  };
  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!editingItem) return;
    setFormError("");
    if (type === "tidak_masuk" && endDate < startDate) {
      setFormError("Tanggal selesai tidak boleh lebih awal dari tanggal mulai.");
      return;
    }
    setIsSubmitting(true);
    try {
      const formData = new FormData();
      formData.append("type", type);
      formData.append("category", category);
      if (type === "tidak_masuk") {
        formData.append("start_date", startDate);
        formData.append("end_date", endDate);
      } else {
        formData.append("date", date);
        formData.append("departure_time", departureTime);
        formData.append("expected_return_time", expectedReturnTime);
      }
      if (uploadedFile) {
        formData.append("document", uploadedFile);
      }
      const res = await leaveApi.updateLeaveRequest(editingItem.id, formData);
      if (res?.data || res?.success) {
        const updated = unwrap(res);
        setLeaveRequests(
          (prev) => prev.map((r) => r.id === editingItem.id ? { ...r, ...updated } : r)
        );
        setIsEditModalOpen(false);
        setEditingItem(null);
        resetForm();
        showToast("Permohonan perizinan berhasil diperbarui.");
      }
    } catch (err) {
      setFormError(
        err.response?.data?.message || err.message || "Gagal memperbarui permohonan izin."
      );
    } finally {
      setIsSubmitting(false);
    }
  };
  const handleExecuteDelete = async () => {
    if (!deleteConfirmItem) return;
    try {
      await leaveApi.deleteLeaveRequest(deleteConfirmItem.id);
      setLeaveRequests((prev) => prev.filter((r) => r.id !== deleteConfirmItem.id));
      setDeleteConfirmItem(null);
      showToast("Permohonan izin berhasil dibatalkan.");
    } catch (err) {
      alert(err.response?.data?.message || err.message || "Gagal membatalkan permohonan izin.");
    }
  };
  const handleOpenDocPreview = (item) => {
    setPreviewDoc(item);
    setDocLoadError(false);
    const targetPath = item.document_url || item.document_path;
    setDocSourceUrl(getStorageUrl(targetPath));
  };
  const isImageDoc = useMemo(() => {
    if (!previewDoc?.document_path && !previewDoc?.document_url) return false;
    const path = previewDoc.document_path || previewDoc.document_url;
    const ext = path.split(".").pop()?.toLowerCase();
    return ["jpg", "jpeg", "png", "webp", "gif"].includes(ext);
  }, [previewDoc]);
  const totalItems = leaveRequests.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / perPage));
  const safePage = Math.min(page, totalPages);
  const pagedList = leaveRequests.slice((safePage - 1) * perPage, safePage * perPage);
  return /* @__PURE__ */ React.createElement("div", { className: "space-y-4" }, toastMessage && /* @__PURE__ */ React.createElement("div", { className: "mb-4 p-3.5 bg-[var(--color-success-bg)] border border-[var(--color-success-border)] rounded-[14px] flex items-center gap-2.5 text-[var(--color-success-fg)] text-xs shadow-[var(--shadow-card)] animate-fade-in" }, /* @__PURE__ */ React.createElement(CheckCircle2, { className: "w-4 h-4 text-[var(--color-success-fg)] shrink-0" }), /* @__PURE__ */ React.createElement("span", { className: "font-medium" }, toastMessage)), /* @__PURE__ */ React.createElement("div", { className: "surface-card p-4 mb-4" }, /* @__PURE__ */ React.createElement("div", { className: "flex items-center justify-between gap-3" }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("h1", { className: "font-semibold text-[var(--color-text-primary)] text-sm" }, "Perizinan Siswa"), /* @__PURE__ */ React.createElement("p", { className: "text-xs text-[var(--color-text-secondary)] mt-0.5" }, "Ajukan surat izin ketidakhadiran atau dispensasi")), /* @__PURE__ */ React.createElement("div", { className: "flex items-center gap-1.5" }, /* @__PURE__ */ React.createElement(
    "button",
    {
      onClick: handleRefresh,
      disabled: isLoading,
      "aria-label": "Refresh perizinan",
      className: "p-2 rounded-[10px] text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-subtle)] transition-colors"
    },
    /* @__PURE__ */ React.createElement(RotateCw, { className: `w-4 h-4 ${isLoading ? "animate-spin text-[var(--color-warning-fg)]" : ""}` })
  ), /* @__PURE__ */ React.createElement(
    Button,
    {
      variant: "primary",
      size: "sm",
      onClick: () => {
        resetForm();
        setIsCreateModalOpen(true);
      },
      className: "font-semibold text-xs flex items-center gap-1 shadow-[var(--shadow-card)]"
    },
    /* @__PURE__ */ React.createElement(Plus, { className: "w-3.5 h-3.5" }),
    "Ajukan Izin"
  ))), /* @__PURE__ */ React.createElement("div", { className: "grid grid-cols-4 gap-2 mt-4 pt-3 border-t border-[var(--color-border-light)] text-center" }, /* @__PURE__ */ React.createElement("div", { className: "bg-[var(--color-bg-app)] border border-[var(--color-border-subtle)]/80 rounded-[10px] p-2" }, /* @__PURE__ */ React.createElement("span", { className: "block text-[11px] text-[var(--color-text-secondary)] font-semibold mb-0.5" }, "Total"), /* @__PURE__ */ React.createElement("span", { className: "font-mono text-base font-bold text-[var(--color-text-primary)]" }, isLoading ? "\u2026" : stats.total)), /* @__PURE__ */ React.createElement("div", { className: "bg-[var(--color-warning-bg)] border border-[var(--color-warning-border)] rounded-[10px] p-2" }, /* @__PURE__ */ React.createElement("span", { className: "block text-[11px] text-[var(--color-warning-fg)] font-semibold mb-0.5" }, "Pending"), /* @__PURE__ */ React.createElement("span", { className: "font-mono text-base font-bold text-[var(--color-warning-fg)]" }, isLoading ? "\u2026" : stats.pending)), /* @__PURE__ */ React.createElement("div", { className: "bg-[var(--color-success-bg)] border border-[var(--color-success-border)]/80 rounded-[10px] p-2" }, /* @__PURE__ */ React.createElement("span", { className: "block text-[11px] text-[var(--color-success-fg)] font-semibold mb-0.5" }, "Disetujui"), /* @__PURE__ */ React.createElement("span", { className: "font-mono text-base font-bold text-[var(--color-success-fg)]" }, isLoading ? "\u2026" : stats.approved)), /* @__PURE__ */ React.createElement("div", { className: "bg-[var(--color-danger-bg)] border border-[var(--color-danger-border)]/80 rounded-[10px] p-2" }, /* @__PURE__ */ React.createElement("span", { className: "block text-[11px] text-[var(--color-danger-fg)] font-semibold mb-0.5" }, "Ditolak"), /* @__PURE__ */ React.createElement("span", { className: "font-mono text-base font-bold text-[var(--color-danger-fg)]" }, isLoading ? "\u2026" : stats.rejected)))), fetchError && /* @__PURE__ */ React.createElement("div", { className: "mb-4 p-3.5 bg-[var(--color-danger-bg)] border border-[var(--color-danger-border)] rounded-[10px] flex items-center justify-between gap-3 text-[var(--color-danger-fg)] text-xs" }, /* @__PURE__ */ React.createElement("div", { className: "flex items-center gap-2" }, /* @__PURE__ */ React.createElement(AlertCircle, { className: "w-4 h-4 shrink-0 text-[var(--color-danger-fg)]" }), /* @__PURE__ */ React.createElement("span", null, fetchError)), /* @__PURE__ */ React.createElement(
    Button,
    {
      size: "sm",
      variant: "outline",
      onClick: handleRefresh,
      className: "shrink-0 text-[var(--color-danger-fg)] border-[var(--color-danger-border)] hover:bg-[var(--color-danger-bg)]"
    },
    "Coba Lagi"
  )), /* @__PURE__ */ React.createElement("div", { className: "space-y-3" }, /* @__PURE__ */ React.createElement("h2", { className: "text-xs font-bold text-[var(--color-text-primary)] uppercase tracking-wider px-0.5" }, "Riwayat Pengajuan Perizinan"), /* @__PURE__ */ React.createElement(
    DataTable,
    {
      columns: [
        { key: "no", label: "#", width: 28, align: "center" },
        { key: "type", label: "Izin / Tanggal" },
        { key: "actions", label: "Aksi", width: 116, align: "right" }
      ],
      rows: pagedList,
      isLoading,
      skeletonRows: Math.min(perPage, 6),
      ariaLabel: "Riwayat pengajuan perizinan siswa",
      empty: /* @__PURE__ */ React.createElement(
        EmptyState,
        {
          title: "Belum Ada Riwayat Perizinan",
          message: "Klik tombol \u201CAjukan Izin\u201D di atas untuk mengajukan izin ketidakhadiran baru."
        }
      ),
      renderRow: (item, index) => {
        const statusKey = (item.status_approval || item.status || "").toLowerCase();
        const isPending = statusKey === "pending";
        const isApproved = statusKey === "approved" || statusKey === "disetujui";
        const hasDoc = Boolean(item.document_path || item.document_url);
        const dateRange = item.type === "tidak_masuk" ? item.start_date === item.end_date ? item.start_date : `${item.start_date} s/d ${item.end_date}` : item.start_date || item.date;
        const timeRange = item.type === "keluar_sekolah" && item.departure_time ? `${item.departure_time.slice(0, 5)}-${item.expected_return_time?.slice(0, 5)} WIB` : null;
        return /* @__PURE__ */ React.createElement("tr", { key: item.id }, /* @__PURE__ */ React.createElement("td", { className: "data-table__no" }, String((safePage - 1) * perPage + index + 1).padStart(2, "0")), /* @__PURE__ */ React.createElement("td", null, /* @__PURE__ */ React.createElement(
          "span",
          {
            className: `badge badge--${isApproved ? "success" : isPending ? "warning" : "error"} badge--sm`
          },
          isApproved ? "Disetujui" : isPending ? "Menunggu" : "Ditolak"
        ), /* @__PURE__ */ React.createElement("span", { className: "data-table__cell-title" }, item.type === "tidak_masuk" ? "Tidak Masuk Sekolah" : "Dispensasi Keluar Sekolah"), /* @__PURE__ */ React.createElement("span", { className: "data-table__cell-meta" }, dateRange, timeRange ? ` \xB7 ${timeRange}` : "", item.category ? ` \xB7 ${item.category}` : ""), item.notes && /* @__PURE__ */ React.createElement("span", { className: "data-table__cell-sub" }, "Catatan: ", item.notes)), /* @__PURE__ */ React.createElement("td", null, /* @__PURE__ */ React.createElement("div", { className: "data-table__actions" }, hasDoc && /* @__PURE__ */ React.createElement(
          "button",
          {
            type: "button",
            onClick: () => handleOpenDocPreview(item),
            className: "data-table__action",
            "aria-label": "Lihat Berkas Bukti"
          },
          /* @__PURE__ */ React.createElement(Eye, { size: 13 })
        ), isPending && /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement(
          "button",
          {
            type: "button",
            onClick: () => handleOpenEdit(item),
            className: "data-table__action",
            "aria-label": "Edit Perizinan"
          },
          /* @__PURE__ */ React.createElement(Edit2, { size: 13 })
        ), /* @__PURE__ */ React.createElement(
          "button",
          {
            type: "button",
            onClick: () => setDeleteConfirmItem(item),
            className: "data-table__action data-table__action--danger",
            "aria-label": "Batalkan Perizinan"
          },
          /* @__PURE__ */ React.createElement(Trash2, { size: 13 })
        )))));
      },
      footer: /* @__PURE__ */ React.createElement(
        PaginationBar,
        {
          currentPage: safePage,
          totalPages,
          totalItems,
          perPage,
          onPageChange: setPage,
          onPerPageChange: setPerPage,
          disabled: isLoading
        }
      )
    }
  )), /* @__PURE__ */ React.createElement(
    BottomSheetModal,
    {
      isOpen: isCreateModalOpen,
      onClose: () => {
        setIsCreateModalOpen(false);
        resetForm();
      },
      title: "Form Pengajuan Perizinan",
      subtitle: "Isi data ketidakhadiran dengan lengkap dan benar",
      size: "lg"
    },
    /* @__PURE__ */ React.createElement("form", { onSubmit: handleCreateSubmit, className: "space-y-3.5 pb-2 text-xs" }, formError && /* @__PURE__ */ React.createElement("div", { className: "p-3 bg-[var(--color-danger-bg)] border border-[var(--color-danger-border)] rounded-[10px] text-[var(--color-danger-fg)] flex items-start gap-2" }, /* @__PURE__ */ React.createElement(AlertCircle, { className: "w-4 h-4 shrink-0 mt-0.5 text-[var(--color-danger-fg)]" }), /* @__PURE__ */ React.createElement("span", null, formError)), dateWarning && /* @__PURE__ */ React.createElement("div", { className: "p-3 bg-[var(--color-warning-bg)] border border-[var(--color-warning-border)] rounded-[10px] text-[var(--color-warning-fg)] flex items-start gap-2" }, /* @__PURE__ */ React.createElement(AlertCircle, { className: "w-4 h-4 shrink-0 mt-0.5 text-[var(--color-warning-fg)]" }), /* @__PURE__ */ React.createElement("span", null, dateWarning)), /* @__PURE__ */ React.createElement(
      LeaveFormFields,
      {
        type,
        onTypeChange: setType,
        category,
        onCategoryChange: setCategory,
        startDate,
        onStartDateChange: setStartDate,
        endDate,
        onEndDateChange: setEndDate,
        date,
        onDateChange: setDate,
        departureTime,
        onDepartureTimeChange: setDepartureTime,
        expectedReturnTime,
        onExpectedReturnTimeChange: setExpectedReturnTime,
        fileInputId: "student-leave-file",
        uploadTitle: "Lampiran Dokumen Bukti",
        uploadHint: "JPG, PNG, atau PDF \xB7 maks. 2 MB",
        uploadedFile,
        onFileChange: setUploadedFile
      }
    ), /* @__PURE__ */ React.createElement("div", { className: "flex gap-2 pt-3 border-t border-[var(--color-border-light)]" }, /* @__PURE__ */ React.createElement(
      Button,
      {
        type: "button",
        variant: "outline",
        onClick: () => {
          setIsCreateModalOpen(false);
          resetForm();
        },
        className: "flex-1"
      },
      "Batal"
    ), /* @__PURE__ */ React.createElement(
      Button,
      {
        type: "submit",
        variant: "primary",
        disabled: isSubmitting,
        className: "flex-1 font-semibold flex items-center justify-center gap-1.5"
      },
      isSubmitting ? /* @__PURE__ */ React.createElement(RotateCw, { className: "w-3.5 h-3.5 animate-spin" }) : /* @__PURE__ */ React.createElement(Send, { className: "w-3.5 h-3.5" }),
      "Kirim Izin"
    )))
  ), /* @__PURE__ */ React.createElement(
    BottomSheetModal,
    {
      isOpen: isEditModalOpen,
      onClose: () => {
        setIsEditModalOpen(false);
        setEditingItem(null);
        resetForm();
      },
      title: "Edit Permohonan Izin",
      subtitle: "Ubah detail perizinan sebelum disetujui pihak sekolah",
      size: "lg"
    },
    /* @__PURE__ */ React.createElement("form", { onSubmit: handleEditSubmit, className: "space-y-3.5 pb-2 text-xs" }, formError && /* @__PURE__ */ React.createElement("div", { className: "p-3 bg-[var(--color-danger-bg)] border border-[var(--color-danger-border)] rounded-[10px] text-[var(--color-danger-fg)] flex items-start gap-2" }, /* @__PURE__ */ React.createElement(AlertCircle, { className: "w-4 h-4 shrink-0 mt-0.5 text-[var(--color-danger-fg)]" }), /* @__PURE__ */ React.createElement("span", null, formError)), /* @__PURE__ */ React.createElement(
      LeaveFormFields,
      {
        type,
        onTypeChange: setType,
        category,
        onCategoryChange: setCategory,
        startDate,
        onStartDateChange: setStartDate,
        endDate,
        onEndDateChange: setEndDate,
        date,
        onDateChange: setDate,
        departureTime,
        onDepartureTimeChange: setDepartureTime,
        expectedReturnTime,
        onExpectedReturnTimeChange: setExpectedReturnTime,
        fileInputId: "edit-student-leave-file",
        uploadTitle: "Ganti Lampiran Dokumen",
        uploadHint: "Kosongkan bila tidak diubah \xB7 JPG, PNG, PDF \xB7 maks. 2 MB",
        uploadedFile,
        onFileChange: setUploadedFile
      }
    ), /* @__PURE__ */ React.createElement("div", { className: "flex gap-2 pt-3 border-t border-[var(--color-border-light)]" }, /* @__PURE__ */ React.createElement(
      Button,
      {
        type: "button",
        variant: "outline",
        onClick: () => {
          setIsEditModalOpen(false);
          setEditingItem(null);
          resetForm();
        },
        className: "flex-1"
      },
      "Batal"
    ), /* @__PURE__ */ React.createElement(
      Button,
      {
        type: "submit",
        variant: "primary",
        disabled: isSubmitting,
        className: "flex-1 font-semibold flex items-center justify-center gap-1.5"
      },
      isSubmitting ? /* @__PURE__ */ React.createElement(RotateCw, { className: "w-3.5 h-3.5 animate-spin" }) : /* @__PURE__ */ React.createElement(CheckCircle2, { className: "w-3.5 h-3.5" }),
      "Simpan Perubahan"
    )))
  ), /* @__PURE__ */ React.createElement(
    BottomSheetModal,
    {
      isOpen: Boolean(previewDoc),
      onClose: () => setPreviewDoc(null),
      title: "Dokumen Bukti Perizinan",
      subtitle: `Pengajuan ${previewDoc?.category || ""}`,
      size: "lg"
    },
    previewDoc && /* @__PURE__ */ React.createElement("div", { className: "space-y-3 pb-2 text-center" }, isImageDoc ? /* @__PURE__ */ React.createElement("div", { className: "rounded-[10px] overflow-hidden border border-[var(--color-border-subtle)] bg-[var(--color-text-primary)] flex items-center justify-center min-h-48 max-h-96" }, /* @__PURE__ */ React.createElement(
      "img",
      {
        src: docSourceUrl,
        alt: "Dokumen Bukti",
        className: "max-h-96 max-w-full object-contain",
        onError: () => {
          if (!docLoadError) {
            setDocLoadError(true);
            setDocSourceUrl(
              getFallbackStorageUrl(
                previewDoc.document_url || previewDoc.document_path
              )
            );
          }
        }
      }
    )) : /* @__PURE__ */ React.createElement("div", { className: "p-6 bg-[var(--color-bg-app)] surface-card space-y-2" }, /* @__PURE__ */ React.createElement(FileText, { className: "w-10 h-10 text-[var(--color-text-muted)] mx-auto" }), /* @__PURE__ */ React.createElement("p", { className: "text-xs font-semibold text-[var(--color-text-primary)]" }, "Dokumen Format PDF"), /* @__PURE__ */ React.createElement("p", { className: "text-[11px] text-[var(--color-text-secondary)]" }, "Dokumen lampiran tersimpan dalam format berkas digital."), /* @__PURE__ */ React.createElement("div", { className: "pt-2" }, /* @__PURE__ */ React.createElement(
      "a",
      {
        href: docSourceUrl,
        target: "_blank",
        rel: "noopener noreferrer",
        className: "inline-flex items-center gap-1.5 text-xs text-[var(--color-info-fg)] font-semibold hover:underline"
      },
      "Buka Berkas di Tab Baru",
      /* @__PURE__ */ React.createElement(ExternalLink, { className: "w-3.5 h-3.5" })
    ))), /* @__PURE__ */ React.createElement(
      Button,
      {
        variant: "outline",
        onClick: () => setPreviewDoc(null),
        className: "w-full mt-2"
      },
      "Tutup Pratinjau"
    ))
  ), /* @__PURE__ */ React.createElement(
    ConfirmSheet,
    {
      isOpen: Boolean(deleteConfirmItem),
      onClose: () => setDeleteConfirmItem(null),
      onConfirm: handleExecuteDelete,
      title: "Batalkan Pengajuan Izin?",
      message: "Permohonan izin ini akan dihapus permanen beserta dokumen lampiran yang sudah diunggah.",
      confirmText: "Ya, Batalkan Izin",
      confirmVariant: "danger"
    }
  ));
}
