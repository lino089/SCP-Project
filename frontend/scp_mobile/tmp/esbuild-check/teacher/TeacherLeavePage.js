import { useState, useEffect, useMemo, useCallback } from "react";
import {
  Plus,
  Eye,
  RotateCw,
  Download,
  X
} from "lucide-react";
import leaveApi from "../../services/leaveApi";
import journalApi from "../../services/journalApi";
import { Badge, Button, Modal, Select, Input, DataTable, PaginationBar } from "../../components/shared";
import { EmptyState, ErrorState } from "../../components/feedback";
import { getStorageUrl, formatDateIndo } from "../../utils/formatters";
import { todayLocalISO } from "../../utils/dateUtils";
const REASON_CATEGORIES = [
  { value: "dinas_luar", label: "Tugas Dinas Luar / MGMP" },
  { value: "sakit", label: "Sakit / Rawat Medis" },
  { value: "keperluan_pribadi", label: "Keperluan Keluarga / Pribadi" },
  { value: "lainnya", label: "Lainnya" }
];
export default function TeacherLeavePage() {
  const [leaves, setLeaves] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const todayStr = useMemo(() => todayLocalISO(), []);
  const [targetDate, setTargetDate] = useState(todayStr);
  const [reasonCategory, setReasonCategory] = useState("dinas_luar");
  const [reasonDetail, setReasonDetail] = useState("");
  const [taskInstruction, setTaskInstruction] = useState("");
  const [attachmentFile, setAttachmentFile] = useState(null);
  const [taskAttachmentFile, setTaskAttachmentFile] = useState(null);
  const [availableSchedules, setAvailableSchedules] = useState([]);
  const [selectedScheduleIds, setSelectedScheduleIds] = useState([]);
  const [isLoadingSchedules, setIsLoadingSchedules] = useState(false);
  const [selectedDetail, setSelectedDetail] = useState(null);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [toastMessage, setToastMessage] = useState(null);
  const [toastType, setToastType] = useState("success");
  const showToast = (msg, type = "success") => {
    setToastMessage(msg);
    setToastType(type);
    setTimeout(() => setToastMessage(null), 3500);
  };
  const fetchLeaves = useCallback(async () => {
    try {
      const res = await leaveApi.getTeacherLeaveRequests({ per_page: 50 });
      const list = Array.isArray(res) ? res : Array.isArray(res?.data) ? res.data : [];
      setLeaves(list);
      setFetchError(null);
    } catch (err) {
      setFetchError(err.message || "Gagal memuat riwayat izin mengajar.");
    } finally {
      setIsLoading(false);
    }
  }, []);
  useEffect(() => {
    let isMounted = true;
    async function init() {
      try {
        const res = await leaveApi.getTeacherLeaveRequests({ per_page: 50 });
        const list = Array.isArray(res) ? res : Array.isArray(res?.data) ? res.data : [];
        if (isMounted) {
          setLeaves(list);
          setFetchError(null);
        }
      } catch (err) {
        if (isMounted) setFetchError(err.message || "Gagal memuat riwayat izin mengajar.");
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
    fetchLeaves();
  };
  useEffect(() => {
    if (!isModalOpen || !targetDate) return;
    let isMounted = true;
    async function loadSchedulesForDate() {
      setIsLoadingSchedules(true);
      try {
        const d = new Date(targetDate);
        const dayOfWeek = d.getDay() === 0 ? 7 : d.getDay();
        const res = await journalApi.getTeacherSchedules({ day: dayOfWeek });
        const list = Array.isArray(res) ? res : Array.isArray(res?.data) ? res.data : [];
        if (!isMounted) return;
        setAvailableSchedules(list);
        setSelectedScheduleIds(list.map((s) => s.id));
      } catch (err) {
        console.warn("Gagal memuat jadwal untuk tanggal izin:", err);
      } finally {
        if (isMounted) setIsLoadingSchedules(false);
      }
    }
    loadSchedulesForDate();
    return () => {
      isMounted = false;
    };
  }, [isModalOpen, targetDate]);
  const handleOpenCreate = () => {
    setTargetDate(todayStr);
    setReasonCategory("dinas_luar");
    setReasonDetail("");
    setTaskInstruction("");
    setAttachmentFile(null);
    setTaskAttachmentFile(null);
    setSelectedScheduleIds([]);
    setFormError("");
    setIsModalOpen(true);
  };
  const handleToggleSchedule = (id) => {
    setSelectedScheduleIds(
      (prev) => prev.includes(id) ? prev.filter((sId) => sId !== id) : [...prev, id]
    );
  };
  const handleSubmitLeave = async (e) => {
    if (e) e.preventDefault();
    if (!targetDate) {
      setFormError("Tanggal izin wajib ditentukan.");
      return;
    }
    if (!reasonDetail.trim()) {
      setFormError("Alasan detail izin wajib diisi.");
      return;
    }
    setIsSubmitting(true);
    setFormError("");
    try {
      const fullReason = `${reasonCategory}: ${reasonDetail.trim()}`;
      await leaveApi.submitTeacherLeaveRequest({
        date: targetDate,
        reason: fullReason,
        schedule_ids: selectedScheduleIds,
        attachment: attachmentFile,
        task_instruction: taskInstruction.trim(),
        task_attachment: taskAttachmentFile
      });
      showToast("Permohonan izin mengajar berhasil diajukan.");
      setIsModalOpen(false);
      handleRefresh();
    } catch (err) {
      setFormError(
        err.response?.data?.message || err.message || "Gagal mengajukan izin mengajar."
      );
    } finally {
      setIsSubmitting(false);
    }
  };
  const totalItems = leaves.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / perPage));
  const safePage = Math.min(page, totalPages);
  const pagedList = leaves.slice((safePage - 1) * perPage, safePage * perPage);
  return /* @__PURE__ */ React.createElement("div", { className: "space-y-4" }, toastMessage && /* @__PURE__ */ React.createElement(
    "div",
    {
      className: `p-3 rounded-[14px] text-xs flex items-center justify-between animate-fade-in ${toastType === "success" ? "bg-[var(--color-success-bg)] border border-[var(--color-success-border)] text-[var(--color-success-fg)]" : "bg-[var(--color-danger-bg)] border border-[var(--color-danger-border)] text-[var(--color-danger-fg)]"}`
    },
    /* @__PURE__ */ React.createElement("span", null, toastMessage),
    /* @__PURE__ */ React.createElement(
      "button",
      {
        type: "button",
        onClick: () => setToastMessage(null),
        className: "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
      },
      /* @__PURE__ */ React.createElement(X, { size: 14 })
    )
  ), /* @__PURE__ */ React.createElement("div", { className: "surface-card p-3.5 shadow-[var(--shadow-card)] flex items-center justify-between" }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("h1", { className: "text-sm font-bold text-[var(--color-text-primary)]" }, "Izin Mengajar Guru"), /* @__PURE__ */ React.createElement("p", { className: "text-[11px] text-[var(--color-text-muted)]" }, "Pengajuan dispensasi KBM & titipan tugas siswa")), /* @__PURE__ */ React.createElement(
    Button,
    {
      size: "sm",
      variant: "primary",
      onClick: handleOpenCreate,
      className: "gap-1.5 text-xs font-semibold px-3 py-1.5 bg-[var(--color-warning-bg)] text-[var(--color-text-primary)]"
    },
    /* @__PURE__ */ React.createElement(Plus, { size: 14 }),
    "Ajukan Izin"
  )), /* @__PURE__ */ React.createElement("div", { className: "space-y-2" }, /* @__PURE__ */ React.createElement("div", { className: "flex items-center justify-between" }, /* @__PURE__ */ React.createElement("span", { className: "section-label" }, "Riwayat Permohonan Izin (", leaves.length, ")"), /* @__PURE__ */ React.createElement(
    Button,
    {
      size: "sm",
      variant: "ghost",
      onClick: handleRefresh,
      className: "p-1 h-7 w-7 min-h-0",
      "aria-label": "Segarkan"
    },
    /* @__PURE__ */ React.createElement(RotateCw, { size: 14 })
  )), fetchError ? /* @__PURE__ */ React.createElement(ErrorState, { message: fetchError, onRetry: handleRefresh }) : /* @__PURE__ */ React.createElement(
    DataTable,
    {
      columns: [
        { key: "no", label: "#", width: 30, align: "center" },
        { key: "reason", label: "Alasan / Tanggal" },
        { key: "actions", label: "Aksi", width: 54, align: "right" }
      ],
      rows: pagedList,
      isLoading,
      skeletonRows: Math.min(perPage, 8),
      ariaLabel: "Riwayat permohonan izin mengajar",
      empty: /* @__PURE__ */ React.createElement(
        EmptyState,
        {
          title: "Belum Ada Riwayat Izin",
          message: "Anda belum pernah mengajukan permohonan izin mengajar."
        }
      ),
      renderRow: (item, index) => {
        const status = item.status || "pending";
        const badgeVariant = status === "approved" ? "success" : status === "rejected" ? "danger" : "warning";
        const statusLabel = status === "approved" ? "Disetujui" : status === "rejected" ? "Ditolak" : "Menunggu";
        return /* @__PURE__ */ React.createElement("tr", { key: item.id }, /* @__PURE__ */ React.createElement("td", { className: "data-table__no" }, String((safePage - 1) * perPage + index + 1).padStart(2, "0")), /* @__PURE__ */ React.createElement("td", null, /* @__PURE__ */ React.createElement("span", { className: `badge badge--${badgeVariant} badge--sm` }, statusLabel), /* @__PURE__ */ React.createElement("span", { className: "data-table__cell-title" }, item.reason), /* @__PURE__ */ React.createElement("span", { className: "data-table__cell-meta" }, formatDateIndo(item.date)), item.task_instruction && /* @__PURE__ */ React.createElement("span", { className: "data-table__cell-sub" }, "Tugas: \u201C", item.task_instruction, "\u201D")), /* @__PURE__ */ React.createElement("td", null, /* @__PURE__ */ React.createElement("div", { className: "data-table__actions" }, /* @__PURE__ */ React.createElement(
          "button",
          {
            type: "button",
            onClick: () => setSelectedDetail(item),
            className: "data-table__action",
            "aria-label": "Lihat Detail"
          },
          /* @__PURE__ */ React.createElement(Eye, { size: 13 })
        ))));
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
    Modal,
    {
      isOpen: isModalOpen,
      onClose: () => setIsModalOpen(false),
      title: "Ajukan Izin Mengajar Guru"
    },
    /* @__PURE__ */ React.createElement("form", { onSubmit: handleSubmitLeave, className: "space-y-3" }, formError && /* @__PURE__ */ React.createElement("div", { className: "p-2.5 bg-[var(--color-danger-bg)] border border-[var(--color-danger-border)] text-[var(--color-danger-fg)] text-xs rounded-[14px]" }, formError), /* @__PURE__ */ React.createElement(
      Input,
      {
        type: "date",
        label: "Tanggal Izin",
        value: targetDate,
        onChange: (e) => setTargetDate(e.target.value),
        required: true
      }
    ), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("label", { className: "text-xs font-semibold text-[var(--color-text-primary)] block mb-1" }, "Pilih Jadwal Mengajar Terdampak"), isLoadingSchedules ? /* @__PURE__ */ React.createElement("p", { className: "text-xs text-[var(--color-text-muted)]" }, "Memeriksa jadwal mengajar...") : availableSchedules.length === 0 ? /* @__PURE__ */ React.createElement("p", { className: "text-xs text-[var(--color-text-secondary)] italic p-2 bg-[var(--color-bg-app)] rounded-[10px]" }, "Tidak ada jadwal mengajar pada tanggal ini.") : /* @__PURE__ */ React.createElement("div", { className: "space-y-1.5 max-h-40 overflow-y-auto p-1 surface-card" }, availableSchedules.map((s) => {
      const isChecked = selectedScheduleIds.includes(s.id);
      return /* @__PURE__ */ React.createElement(
        "label",
        {
          key: s.id,
          className: `flex items-center gap-2 p-2 rounded-[10px] border text-xs cursor-pointer transition-all ${isChecked ? "border-[var(--color-brand)] bg-yellow-50/50 text-[var(--color-text-primary)] font-semibold" : "border-[var(--color-border-light)] bg-[var(--color-surface)] text-[var(--color-text-secondary)]"}`
        },
        /* @__PURE__ */ React.createElement(
          "input",
          {
            type: "checkbox",
            checked: isChecked,
            onChange: () => handleToggleSchedule(s.id),
            className: "w-4 h-4 text-[var(--color-brand-text)] rounded-[6px] border-[var(--color-border-strong)] focus:ring-yellow-400"
          }
        ),
        /* @__PURE__ */ React.createElement("div", { className: "flex-1 min-w-0" }, /* @__PURE__ */ React.createElement("span", { className: "font-bold" }, s.school_class?.name), " - ", s.subject?.name, " (Jam Ke-", s.period_number, ")")
      );
    }))), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("label", { className: "text-xs font-semibold text-[var(--color-text-primary)] block mb-1" }, "Kategori Alasan"), /* @__PURE__ */ React.createElement(
      Select,
      {
        value: reasonCategory,
        onChange: (e) => setReasonCategory(e.target.value)
      },
      REASON_CATEGORIES.map((cat) => /* @__PURE__ */ React.createElement("option", { key: cat.value, value: cat.value }, cat.label))
    )), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("label", { className: "text-xs font-semibold text-[var(--color-text-primary)] block mb-1" }, "Penjelasan Alasan"), /* @__PURE__ */ React.createElement(
      "textarea",
      {
        rows: 2,
        value: reasonDetail,
        onChange: (e) => setReasonDetail(e.target.value),
        placeholder: "Jelaskan keperluan atau agenda izin secara terperinci...",
        className: "w-full text-xs p-2.5 field-area focus:outline-hidden focus:border-[var(--color-brand)]",
        required: true
      }
    )), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("label", { className: "text-xs font-semibold text-[var(--color-text-primary)] block mb-1" }, "Unggah Bukti Dokumen (Surat Tugas / Surat Dokter)"), /* @__PURE__ */ React.createElement(
      "input",
      {
        type: "file",
        accept: ".pdf,image/*",
        onChange: (e) => setAttachmentFile(e.target.files?.[0] || null),
        className: "w-full text-xs file:mr-2 file:py-1.5 file:px-3 file:rounded-[10px] file:border-0 file:text-xs file:font-semibold file:bg-[var(--color-surface-subtle)] file:text-[var(--color-text-primary)] hover:file:bg-[var(--color-border-subtle)]"
      }
    )), /* @__PURE__ */ React.createElement("div", { className: "pt-2 border-t border-[var(--color-border-light)] space-y-2" }, /* @__PURE__ */ React.createElement("h4", { className: "text-xs font-bold text-[var(--color-text-primary)]" }, "Titipan Tugas Pembelajaran Mandiri"), /* @__PURE__ */ React.createElement(
      "textarea",
      {
        rows: 2,
        value: taskInstruction,
        onChange: (e) => setTaskInstruction(e.target.value),
        placeholder: "Instruksi pengerjaan tugas bagi siswa saat jam kosong...",
        className: "w-full text-xs p-2.5 field-area focus:outline-hidden focus:border-[var(--color-brand)]"
      }
    ), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("label", { className: "text-xs font-semibold text-[var(--color-text-primary)] block mb-1" }, "Berkas Lembar Kerja / Modul Tugas (Opsional)"), /* @__PURE__ */ React.createElement(
      "input",
      {
        type: "file",
        accept: ".pdf,.doc,.docx",
        onChange: (e) => setTaskAttachmentFile(e.target.files?.[0] || null),
        className: "w-full text-xs file:mr-2 file:py-1.5 file:px-3 file:rounded-[10px] file:border-0 file:text-xs file:font-semibold file:bg-[var(--color-surface-subtle)] file:text-[var(--color-text-primary)] hover:file:bg-[var(--color-border-subtle)]"
      }
    ))), /* @__PURE__ */ React.createElement("div", { className: "pt-2 flex gap-2" }, /* @__PURE__ */ React.createElement(
      Button,
      {
        type: "button",
        variant: "secondary",
        onClick: () => setIsModalOpen(false),
        className: "flex-1"
      },
      "Batal"
    ), /* @__PURE__ */ React.createElement(
      Button,
      {
        type: "submit",
        variant: "primary",
        disabled: isSubmitting,
        className: "flex-1 bg-[var(--color-warning-bg)] text-[var(--color-text-primary)] font-bold"
      },
      isSubmitting ? "Mengirim..." : "Kirim Permohonan"
    )))
  ), /* @__PURE__ */ React.createElement(
    Modal,
    {
      isOpen: Boolean(selectedDetail),
      onClose: () => setSelectedDetail(null),
      title: "Detail Izin Mengajar"
    },
    selectedDetail && /* @__PURE__ */ React.createElement("div", { className: "space-y-3 text-xs" }, /* @__PURE__ */ React.createElement("div", { className: "p-3 bg-[var(--color-bg-app)] rounded-[14px] space-y-1.5" }, /* @__PURE__ */ React.createElement("div", { className: "flex items-center justify-between" }, /* @__PURE__ */ React.createElement("span", { className: "text-[var(--color-text-secondary)]" }, "Tanggal:"), /* @__PURE__ */ React.createElement("span", { className: "font-bold" }, formatDateIndo(selectedDetail.date))), /* @__PURE__ */ React.createElement("div", { className: "flex items-center justify-between" }, /* @__PURE__ */ React.createElement("span", { className: "text-[var(--color-text-secondary)]" }, "Status:"), /* @__PURE__ */ React.createElement(
      Badge,
      {
        variant: selectedDetail.status === "approved" ? "success" : selectedDetail.status === "rejected" ? "danger" : "warning",
        size: "sm"
      },
      selectedDetail.status
    ))), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("p", { className: "font-semibold text-[var(--color-text-primary)]" }, "Alasan:"), /* @__PURE__ */ React.createElement("p", { className: "text-[var(--color-text-primary)] mt-0.5" }, selectedDetail.reason)), selectedDetail.task_instruction && /* @__PURE__ */ React.createElement("div", { className: "p-2.5 bg-yellow-50/60 border border-yellow-100 rounded-[14px]" }, /* @__PURE__ */ React.createElement("p", { className: "font-semibold text-yellow-900" }, "Instruksi Tugas Siswa:"), /* @__PURE__ */ React.createElement("p", { className: "text-[var(--color-text-primary)] mt-0.5 leading-relaxed" }, selectedDetail.task_instruction)), selectedDetail.attachment_url && /* @__PURE__ */ React.createElement(
      "a",
      {
        href: getStorageUrl(selectedDetail.attachment_url),
        target: "_blank",
        rel: "noreferrer",
        className: "inline-flex items-center gap-1.5 text-[var(--color-info-fg)] font-semibold underline"
      },
      /* @__PURE__ */ React.createElement(Download, { size: 14 }),
      " Lihat Berkas Bukti Lampiran"
    ), /* @__PURE__ */ React.createElement(
      Button,
      {
        type: "button",
        variant: "secondary",
        onClick: () => setSelectedDetail(null),
        className: "w-full mt-2"
      },
      "Tutup"
    ))
  ));
}
