import './Tabs.css';

/**
 * Shared Tabs Bar Component
 */
export default function Tabs({
  tabs = [], // [{ id, label, count, icon: Icon }]
  activeTab,
  onChange,
  className = '',
}) {
  return (
    <div className={`tabs-container ${className}`.trim()} role="tablist">
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        const Icon = tab.icon;

        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            className={`tab-item ${isActive ? 'tab-item--active' : ''}`}
            onClick={() => onChange?.(tab.id)}
          >
            {Icon && <Icon size={16} />}
            <span>{tab.label}</span>
            {tab.count !== undefined && tab.count !== null && (
              <span className="tab-badge">{tab.count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
