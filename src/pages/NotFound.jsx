import { Link } from 'react-router-dom';
import { EmptyState } from '../components/Controls.jsx';

export default function NotFound() {
  return (
    <div className="page" style={{ paddingTop: 48 }}>
      <EmptyState mood="thinking" title="This page drifted out of orbit" action={<Link className="btn btn-primary" to="/home">Go home</Link>}>
        The link may be old or mistyped.
      </EmptyState>
    </div>
  );
}
