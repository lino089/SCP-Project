import './SegmentedTabs.css';

/**
 * SegmentedTabs — Horizontally Scrollable Mobile Tabs & Segmented Control
 * Compatible with web `Tabs` props: ({ tabs: [{ id, label, count, icon }], activeTab, onChange })
 * Default visual pattern is the segmented control ("pill").
 */
export default function SegmentedTabs({
  tabs = [],
  activeTab,
  onChange,
  variant = 'pill', // 'pill' | 'underline'
  fullWidth = false,
  className = '',
}) {
  return (
    <div
      className={[
        'segmented-tabs',
        `segmented-tabs--${variant}`,
        fullWidth && 'segmented-tabs--full',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      role="tablist"
    >
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        const Icon = tab.icon;

        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            className={[
              'segmented-tab',
              isActive && 'segmented-tab--active',
            ]
              .filter(Boolean)
              .join(' ')}
            onClick={() => onChange?.(tab.id)}
          >
            {Icon && <Icon size={15} strokeWidth={1.75} className="segmented-tab__icon" />}
            <span className="segmented-tab__label">{tab.label}</span>
            {tab.count !== undefined && tab.count !== null && (
              <span className="segmented-tab__badge font-mono">{tab.count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
