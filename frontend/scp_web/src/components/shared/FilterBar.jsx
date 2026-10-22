import { RotateCcw } from 'lucide-react';
import Button from './Button';
import './FilterBar.css';

/**
 * Shared FilterBar Component for Data Table Toolbars
 */
export default function FilterBar({
  children,
  leftContent = null,
  rightContent = null,
  onReset = null,
  resetLabel = 'Reset',
  className = '',
}) {
  return (
    <div className={`filter-bar ${className}`.trim()}>
      <div className="filter-bar-left">
        {leftContent || children}
      </div>

      {(rightContent || onReset) && (
        <div className="filter-bar-right">
          {rightContent}
          {onReset && (
            <Button
              variant="ghost"
              size="sm"
              icon={RotateCcw}
              onClick={onReset}
              className="text-gray-500 hover:text-gray-800"
            >
              {resetLabel}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
