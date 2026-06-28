import { useState } from 'react';
import { api } from '../lib/api';
import { toast } from '../components/Toast';

export function Broadcast() {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [type, setType] = useState('offer');

  const send = async () => {
    await api('/admin/broadcast', { method: 'POST', body: { title, body, type } });
    toast('Notification sent');
    setTitle('');
    setBody('');
  };

  return (
    <div className="card">
      <div className="form">
        <div className="full">
          <label>Title</label>
          <input
            id="b_title"
            placeholder="Weekend offer 🚗"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>
        <div className="full">
          <label>Body</label>
          <textarea
            id="b_body"
            rows={3}
            placeholder="Use SAVE15 for 15% off"
            value={body}
            onChange={(e) => setBody(e.target.value)}
          />
        </div>
        <div>
          <label>Type</label>
          <select id="b_type" value={type} onChange={(e) => setType(e.target.value)}>
            <option value="offer">offer</option>
            <option value="system">system</option>
            <option value="reminder">reminder</option>
            <option value="booking">booking</option>
          </select>
        </div>
      </div>
      <div className="form-actions">
        <button className="btn" id="b_send" onClick={send}>
          Send to all users
        </button>
      </div>
    </div>
  );
}
