import { AlertTriangle, AlertCircle } from 'lucide-react';
import Modal from '../../../components/shared/Modal';
import Button from '../../../components/shared/Button';

/**
 * Dialog Peringatan Konflik Penghapusan (HTTP 409 Conflict)
 * Muncul saat user mencoba menghapus entitas yang terikat jadwal aktif.
 */
export default function DeleteConflictDialog({
  isOpen = false,
  onClose,
  onProceedForceDelete,
  entityName = '',
  entityType = 'Data',
  errorMessage = '',
}) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="sm"
      title="Tidak Dapat Menghapus Data"
      footer={
        <div className="flex justify-between items-center w-full gap-2">
          {onProceedForceDelete && (
            <Button
              variant="outline-danger"
              size="sm"
              onClick={onProceedForceDelete}
            >
              Lanjutkan ke Hapus Paksa
            </Button>
          )}
          <Button variant="primary" size="sm" onClick={onClose}>
            Saya Mengerti
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4 py-2">
        <div className="flex items-center gap-3 p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-800">
          <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center shrink-0 text-amber-600">
            <AlertTriangle size={20} />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-amber-900">
              Konflik Keterikatan Jadwal (HTTP 409)
            </h4>
            <p className="text-xs text-amber-700 mt-0.5">
              {entityType} <strong>{entityName}</strong> memiliki keterkaitan jadwal aktif.
            </p>
          </div>
        </div>

        <div className="text-xs text-neutral-600 space-y-2 leading-relaxed">
          <p>
            {errorMessage ||
              `${entityType} ini masih digunakan pada jadwal pelajaran aktif institusi atau memiliki relasi data historis KBM.`}
          </p>
          <div className="p-2.5 bg-neutral-50 rounded border border-neutral-200 flex items-start gap-2 text-neutral-700">
            <AlertCircle size={15} className="text-gray-500 shrink-0 mt-0.5" />
            <span>
              <strong>Pilihan:</strong> Anda dapat memindahkan atau menghapus sesi jadwal di menu <em>Jadwal Pelajaran</em> terlebih dahulu, atau gunakan opsi <strong>Hapus Bersih & Paksa</strong> dengan verifikasi kata sandi untuk membersihkan seluruh keterkaitan data secara permanen.
            </span>
          </div>
        </div>
      </div>
    </Modal>
  );
}
