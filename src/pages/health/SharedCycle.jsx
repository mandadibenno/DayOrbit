import { Link, useParams } from 'react-router-dom';
import Icon from '../../components/Icon.jsx';
import { Avatar } from '../../components/Avatar.jsx';
import { EmptyState, Loading } from '../../components/Controls.jsx';
import { useLoad } from '../../hooks/useLoad.js';
import * as api from '../../lib/api.js';
import { addDays, diffDays, formatDay, formatRange, todayISO } from '../../lib/dates.js';
import { DISCLAIMER } from './cycleUi.jsx';

/** What a partner chose to share: only period dates and/or the next-period estimate. */
export default function SharedCycle() {
  const { ownerId } = useParams();
  const { data, error, loading } = useLoad(() => api.getSharedCycle(ownerId), [ownerId]);
  const today = todayISO();

  const back = <Link className="back-btn" to="/health"><Icon name="chevronLeft" size={20} stroke={2.4} /> Health</Link>;
  if (loading && !data) return <div className="page"><div className="topbar">{back}</div><Loading rows={3} /></div>;
  if (error || !data) {
    return (
      <div className="page">
        <div className="topbar">{back}</div>
        <EmptyState mood="thinking" title="Not shared any more" action={<Link className="btn btn-secondary" to="/health">Back to Health</Link>}>
          This person has stopped sharing, or you’re no longer in a couple space together.
        </EmptyState>
      </div>
    );
  }

  const name = data.owner_name || 'Your partner';
  const first = name.split(' ')[0];
  const next = data.next_period_start;
  const range = data.range_days ?? 2;
  const until = next ? diffDays(next, today) : null;
  const periods = data.periods || [];

  return (
    <div className="page">
      <div className="topbar">{back}</div>
      <div className="row" style={{ minHeight: 0, marginTop: 12 }}>
        <Avatar id={ownerId} name={name} size={52} />
        <div className="grow">
          <h1 className="page-title" style={{ fontSize: 30, lineHeight: '34px' }}>{first}’s cycle</h1>
          <p className="page-sub">Shared with you by {first}</p>
        </div>
      </div>

      {next && (
        <section className="card" style={{ marginTop: 16, background: 'var(--blush)' }}>
          <p className="eyebrow" style={{ color: 'var(--blush-ink)' }}>Next period · estimate</p>
          <p className="display" style={{ fontSize: 26, fontWeight: 800, lineHeight: '32px', marginTop: 4 }}>
            {until > 1 ? `In about ${until} days` : until === 1 ? 'Maybe tomorrow' : until === 0 ? 'Maybe today' : 'Expected recently'}
          </p>
          <p className="small bold" style={{ marginTop: 2 }}>Around {formatDay(next)} · could be {formatRange(addDays(next, -range), addDays(next, range))}</p>
        </section>
      )}

      {periods.length > 0 && (
        <section className="card card--tight" style={{ marginTop: 14 }} aria-labelledby="h-dates">
          <div className="card-head"><h2 id="h-dates" className="section-title" style={{ fontSize: 20 }}>Recent periods</h2></div>
          <ul className="list">
            {periods.map((p) => (
              <li key={p.start_date} className="row" style={{ minHeight: 52 }}>
                <span aria-hidden="true" style={{ width: 10, height: 10, borderRadius: 5, background: '#C2305F', flex: 'none' }} />
                <span className="row__main"><span className="row__title" style={{ fontSize: 15 }}>{formatRange(p.start_date, p.end_date)}</span></span>
                {p.end_date && <span className="small bold muted">{diffDays(p.end_date, p.start_date) + 1} days</span>}
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className="notice notice--private" style={{ marginTop: 14 }}>
        <Icon name="heart" size={16} />
        <span>{first} chose to share {data.scopes?.length === 2 ? 'period dates and the next-period estimate' : data.scopes?.includes('prediction') ? 'the next-period estimate' : 'period dates'}. Notes, feelings and medicines are never shared. {first} can stop sharing any time.</span>
      </p>
      <p className="tiny muted bold center" style={{ marginTop: 14 }}>{DISCLAIMER}</p>
    </div>
  );
}
