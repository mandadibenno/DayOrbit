import { Link, useSearchParams } from 'react-router-dom';
import Icon from '../../components/Icon.jsx';
import SpacePill from '../../components/SpacePill.jsx';
import { HeroDeco } from '../../components/Illustrations.jsx';
import { EmptyState, Segmented } from '../../components/Controls.jsx';
import { useSpace } from '../../context/SpaceContext.jsx';
import { useShell } from '../../context/ShellContext.js';
import SplitHome from './SplitHome.jsx';
import Bills from './Bills.jsx';
import Spending from './Spending.jsx';

const SUBTITLES = {
  split: 'Share costs and see who owes who.',
  bills: 'Payments coming up. Mark them paid when done.',
  spending: 'Money already spent.',
};

export default function Money() {
  const { ready, has, isPersonal, isOwner } = useSpace();
  const { openSwitcher } = useShell();
  const [params, setParams] = useSearchParams();
  const tabs = [
    !isPersonal && has('split') && { value: 'split', label: 'Split' },
    has('bills') && { value: 'bills', label: 'Bills' },
    has('expenses') && { value: 'spending', label: 'Spending' },
  ].filter(Boolean);
  const tab = tabs.find((t) => t.value === params.get('tab'))?.value || tabs[0]?.value;

  return (
    <>
      <section className="hero" style={{ paddingBottom: 46 }}>
        <HeroDeco />
        <div className="hero__inner">
          <div className="topbar"><SpacePill onHero /></div>
          <h1 style={{ marginTop: 10 }}>Money</h1>
          <p className="small" style={{ marginTop: 2 }}>{SUBTITLES[tab] || 'Bills, spending and shared costs.'}</p>
          {tabs.length > 1 && (
            <div style={{ marginTop: 12 }}>
              <Segmented label="Money sections" options={tabs} value={tab} onChange={(v) => setParams({ tab: v }, { replace: true })} />
            </div>
          )}
        </div>
      </section>
      <div className="page" style={{ paddingTop: 0 }}>
        <div className="stack" style={{ marginTop: -24, position: 'relative', zIndex: 2 }}>
          {ready && !tabs.length && (
            <div className="card">
              <EmptyState mood="sleepy" title="Money is turned off here" action={isOwner && <Link className="btn btn-secondary" to="/spaces/settings">Open space settings</Link>}>
                Turning a feature off only hides it. Nothing was deleted.
              </EmptyState>
            </div>
          )}
          {tab === 'split' && <SplitHome />}
          {tab === 'bills' && <Bills />}
          {tab === 'spending' && <Spending />}
          {isPersonal && ready && (
            <p className="notice">
              <Icon name="users" size={16} />
              <span className="grow">Splitting a cost with friends or family? Split Bills lives in shared spaces.</span>
              <button type="button" className="link-btn" style={{ minHeight: 0 }} onClick={openSwitcher}>Switch</button>
            </p>
          )}
        </div>
      </div>
    </>
  );
}
