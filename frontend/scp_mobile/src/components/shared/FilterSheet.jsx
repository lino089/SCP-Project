import BottomSheetModal from './BottomSheetModal';
import Button from './Button';

/**
 * FilterSheet — Reusable Bottom-Sheet Filter Drawer for Mobile Lists
 */
export default function FilterSheet({
  isOpen = false,
  onClose,
  onApply,
  onReset,
  title = 'Filter Data',
  children,
}) {
  return (
    <BottomSheetModal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      size="md"
      footer={
        <div className="flex items-center justify-between gap-2 w-full">
          {onReset && (
            <Button variant="ghost" size="md" onClick={onReset}>
              Reset Filter
            </Button>
          )}
          <div className="flex items-center gap-2 ml-auto">
            <Button variant="outline" size="md" onClick={onClose}>
              Tutup
            </Button>
            {onApply && (
              <Button variant="primary" size="md" onClick={onApply}>
                Terapkan
              </Button>
            )}
          </div>
        </div>
      }
    >
      <div className="space-y-4">{children}</div>
    </BottomSheetModal>
  );
}
