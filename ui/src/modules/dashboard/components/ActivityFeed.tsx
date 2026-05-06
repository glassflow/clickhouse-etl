import type { ActivityItem } from '../types'

type Props = { items: ActivityItem[]; showViewLog?: boolean }

export function ActivityFeed({ items, showViewLog = true }: Props) {
  return (
    <div className="dash-card">
      <div className="dash-card-h">
        <h3>Recent activity</h3>
        {showViewLog && <button className="dash-link" type="button">View log →</button>}
      </div>
      <div className="activity-list">
        {items.map((item, idx) => (
          <div key={idx} className="activity-row">
            <span className={`activity-dot ${item.kind}`} aria-hidden="true" />
            <div className="activity-text">
              {item.actor && <b>{item.actor}</b>}{item.actor && ' '}
              {item.text}
            </div>
            <div className="activity-when">{item.relativeTime}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
