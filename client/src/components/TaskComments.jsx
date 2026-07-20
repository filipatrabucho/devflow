import { useEffect, useState } from 'react';
import { api } from '../api/client';
import Avatar from './Avatar';
import { TASK_PHASES, labelFor } from '../constants';

function describeEvent(c) {
  const from = labelFor(TASK_PHASES, c.fromPhase);
  const to = labelFor(TASK_PHASES, c.toPhase);
  switch (c.eventType) {
    case 'rejected':
      return `Rejected → ${to}`;
    case 'approved':
      return 'Approved';
    case 'done':
      return 'Marked Done';
    case 'reopened':
      return `Reopened → ${to}`;
    default:
      return `Moved: ${from} → ${to}`;
  }
}

export default function TaskComments({ taskId }) {
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [body, setBody] = useState('');
  const [posting, setPosting] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const data = await api.get(`/tasks/${taskId}/comments`);
      setComments(data.comments);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskId]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!body.trim()) return;
    setPosting(true);
    setError('');
    try {
      const data = await api.post(`/tasks/${taskId}/comments`, { body });
      setComments((prev) => [...prev, data.comment]);
      setBody('');
    } catch (err) {
      setError(err.message);
    } finally {
      setPosting(false);
    }
  }

  return (
    <div className="comments">
      {error && <div className="alert alert--error">{error}</div>}
      {loading ? (
        <p className="muted">Loading comments...</p>
      ) : comments.length === 0 ? (
        <p className="muted">No comments yet.</p>
      ) : (
        <div className="comments__list">
          {comments.map((c) =>
            c.isSystem ? (
              <div className="comments__system" key={c.id}>
                <div className="comments__system-row">
                  <span>
                    <strong>{c.authorName || 'Someone'}</strong>{' '}
                    <span className={`comments__event comments__event--${c.eventType || 'moved'}`}>
                      {describeEvent(c)}
                    </span>
                  </span>
                  <span className="comments__time">{new Date(c.createdAt).toLocaleString()}</span>
                </div>
                {c.body && <p className="comments__system-note">{c.body}</p>}
              </div>
            ) : (
              <div className="comments__item" key={c.id}>
                <Avatar name={c.authorName} src={c.authorAvatar} size={28} />
                <div className="comments__body">
                  <div className="comments__meta">
                    <strong>{c.authorName || 'Unknown'}</strong>
                    <span className="comments__time">{new Date(c.createdAt).toLocaleString()}</span>
                  </div>
                  <p>{c.body}</p>
                </div>
              </div>
            )
          )}
        </div>
      )}

      <form className="comments__form" onSubmit={handleSubmit}>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Add a comment..."
          rows={2}
          maxLength={2000}
        />
        <button className="btn btn--secondary" type="submit" disabled={posting || !body.trim()}>
          {posting ? 'Posting...' : 'Comment'}
        </button>
      </form>
    </div>
  );
}
