import { useCallback, useEffect, useRef, useState } from 'react';
import { api, getToken } from '../lib/api';
import { fmtTime } from '../lib/format';
import { toast } from '../components/Toast';
import type { Envelope, SupportConvo, SupportMessage } from '../lib/types';

// `window.io` is an untyped global injected by /socket.io/socket.io.js in
// index.html. It may be undefined if that script failed to load → polling only.
// The `any` is intentionally confined to this socket boundary.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const io: ((opts?: any) => any) | undefined;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Socket = any;

const POLL_MS = 4000;

export function Support() {
  const [convos, setConvos] = useState<SupportConvo[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [showChat, setShowChat] = useState(false); // mobile single-pane toggle
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Mutable refs that the poll/socket callbacks read without re-subscribing.
  const activeIdRef = useRef<string | null>(null);
  const lastAtRef = useRef<string | null>(null);
  const seenRef = useRef<Set<string>>(new Set());
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const socketRef = useRef<Socket>(null);
  const msgsBoxRef = useRef<HTMLDivElement | null>(null);

  const scrollToBottom = useCallback(() => {
    const box = msgsBoxRef.current;
    if (box) box.scrollTop = box.scrollHeight;
  }, []);

  // Append messages to the open thread, de-duplicated by id so a socket push and
  // a poll (or the just-sent echo) can't render the same message twice. Updates
  // lastAt to the newest accepted message. Returns the count actually added.
  const ingest = useCallback((incoming: SupportMessage[]): number => {
    const seen = seenRef.current;
    const fresh: SupportMessage[] = [];
    incoming.forEach((m) => {
      if (!m || seen.has(m.id)) return;
      seen.add(m.id);
      fresh.push(m);
      if (m.time) lastAtRef.current = m.time;
    });
    if (fresh.length) setMessages((prev) => [...prev, ...fresh]);
    return fresh.length;
  }, []);

  const loadMessages = useCallback(
    async (id: string, replace = false) => {
      if (activeIdRef.current !== id) return;
      const q =
        !replace && lastAtRef.current
          ? `?after=${encodeURIComponent(lastAtRef.current)}`
          : '';
      let env: Envelope<SupportMessage[]>;
      try {
        env = await api<Envelope<SupportMessage[]>>(`/admin/support/${id}/messages${q}`);
      } catch {
        return;
      }
      if (activeIdRef.current !== id) return;
      if (replace) {
        seenRef.current = new Set();
        setMessages([]);
      }
      const added = ingest(env.data || []);
      if (added) requestAnimationFrame(scrollToBottom);
    },
    [ingest, scrollToBottom],
  );

  // ---------------- polling ----------------
  const stopPoll = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const startPoll = useCallback(() => {
    stopPoll();
    pollRef.current = setInterval(() => {
      if (activeIdRef.current) loadMessages(activeIdRef.current);
    }, POLL_MS);
  }, [loadMessages, stopPoll]);

  // ---------------- socket (real-time) ----------------
  const ensureSocket = useCallback((): Socket => {
    if (typeof io === 'undefined') return null; // client script failed to load
    if (socketRef.current) return socketRef.current;

    const socket = io({
      auth: { token: getToken() },
      transports: ['websocket', 'polling'],
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      // (Re)join the open room and rely on push instead of polling.
      const id = activeIdRef.current;
      if (id) {
        socket.emit('conversation:join', id);
        stopPoll();
        loadMessages(id); // catch up on the gap
      }
    });

    socket.on(
      'chat:message',
      (payload: { conversationId?: string; message?: SupportMessage }) => {
        if (!payload || payload.conversationId !== activeIdRef.current || !payload.message) return;
        if (ingest([payload.message])) requestAnimationFrame(scrollToBottom);
      },
    );

    // Lost the socket — fall back to polling until it reconnects.
    socket.on('disconnect', () => {
      if (activeIdRef.current) startPoll();
    });

    return socket;
  }, [ingest, loadMessages, scrollToBottom, startPoll, stopPoll]);

  const joinRoom = useCallback(
    (id: string) => {
      const socket = ensureSocket();
      if (!socket) return; // no socket support — polling already covers it
      if (socket.connected) {
        socket.emit('conversation:join', id);
        stopPoll(); // socket is live; drop the poll
      }
      // If not yet connected, the 'connect' handler joins and stops the poll.
    },
    [ensureSocket, stopPoll],
  );

  const leaveRoom = useCallback((id: string) => {
    const socket = socketRef.current;
    if (socket && socket.connected) socket.emit('conversation:leave', id);
  }, []);

  // ---------------- open a conversation ----------------
  const openConvo = useCallback(
    (c: SupportConvo) => {
      // Leave the previous conversation's room before switching.
      const prev = activeIdRef.current;
      if (prev && prev !== c.id) leaveRoom(prev);

      activeIdRef.current = c.id;
      lastAtRef.current = null;
      seenRef.current = new Set();
      setActiveId(c.id);
      setMessages([]);

      loadMessages(c.id, true);
      // Real-time first; poll is a fallback that the socket pauses on connect.
      joinRoom(c.id);
      startPoll();
    },
    [joinRoom, leaveRoom, loadMessages, startPoll],
  );

  // ---------------- initial load + teardown ----------------
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const env = await api<Envelope<SupportConvo[]>>('/admin/support');
        if (cancelled) return;
        setConvos(env.data || []);
        setLoading(false);
        if (env.data && env.data.length) openConvo(env.data[0]);
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : 'Failed to load');
        setLoading(false);
      }
    })();

    // Teardown on leaving the Support tab (component unmount): leave the room,
    // stop the poll, disconnect the socket. Mirrors teardownSupportRealtime.
    return () => {
      cancelled = true;
      const id = activeIdRef.current;
      if (id) leaveRoom(id);
      activeIdRef.current = null;
      stopPoll();
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
    // Run once on mount; the helpers it calls are stable for the page lifetime.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---------------- send ----------------
  const send = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      const id = activeIdRef.current;
      const text = draft.trim();
      if (!id || !text) return;
      setDraft(''); // optimistic input clear
      try {
        await api(`/admin/support/${id}/messages`, { method: 'POST', body: { text } });
        await loadMessages(id); // pulls the just-sent message via ?after
        setConvos((prev) => prev.map((c) => (c.id === id ? { ...c, lastMessage: text } : c)));
      } catch (err) {
        toast(err instanceof Error ? err.message : 'Send failed');
        setDraft(text); // restore the input
      }
    },
    [draft, loadMessages],
  );

  const active = convos.find((c) => c.id === activeId) || null;

  return (
    <div className={`card support-wrap${showChat ? ' show-chat' : ''}`}>
      <div className="support-list" id="supList">
        {convos.length === 0 ? (
          <div className="empty">No conversations</div>
        ) : (
          convos.map((c) => {
            const initial = (c.customerName || '?').charAt(0).toUpperCase();
            return (
              <div
                key={c.id}
                className={`sup-item${c.id === activeId ? ' active' : ''}`}
                data-id={c.id}
                onClick={() => {
                  // On mobile this swaps the list out for the full-screen chat pane.
                  setShowChat(true);
                  openConvo(c);
                }}
              >
                <div className="sup-avatar">{initial}</div>
                <div className="sup-meta">
                  <div className="sup-name">{c.customerName}</div>
                  <div className="sup-last">{(c.lastMessage || '').slice(0, 42)}</div>
                </div>
                <div className="sup-time">{c.lastAt ? fmtTime(c.lastAt) : ''}</div>
              </div>
            );
          })
        )}
      </div>

      <div className="support-chat" id="supChat">
        {loading ? (
          <div className="empty">Loading…</div>
        ) : error ? (
          <div className="empty">{error}</div>
        ) : !active ? (
          <div className="empty">
            {convos.length ? 'Select a conversation' : 'No support conversations yet.'}
          </div>
        ) : (
          <>
            <div className="sup-head">
              <button
                type="button"
                className="sup-back"
                id="supBack"
                aria-label="Back to conversations"
                onClick={() => setShowChat(false)}
              >
                ←
              </button>
              <div className="sup-head-meta">
                <div className="sup-head-name">{active.customerName}</div>
                <div className="sup-head-sub">
                  {active.customerPhone || active.customerEmail || ''}
                </div>
              </div>
            </div>

            <div className="sup-msgs" id="supMsgs" ref={msgsBoxRef}>
              {messages.map((m) => {
                const images = Array.isArray(m.images) ? m.images.filter(Boolean) : [];
                return (
                  <div key={m.id} className={`sup-msg ${m.fromMe ? 'out' : 'in'}`}>
                    {images.length > 0 && (
                      <div className="sup-imgs">
                        {images.map((src) => (
                          <a
                            key={src}
                            href={src}
                            target="_blank"
                            rel="noopener"
                            className="sup-img"
                          >
                            <img src={src} alt="attachment" loading="lazy" />
                          </a>
                        ))}
                      </div>
                    )}
                    {m.text ? <div className="sup-bubble">{m.text}</div> : null}
                    <div className="sup-msg-time">{fmtTime(m.time)}</div>
                  </div>
                );
              })}
            </div>

            <form className="sup-input" id="supForm" onSubmit={send}>
              <input
                id="supText"
                placeholder="Type a reply…"
                autoComplete="off"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
              />
              <button type="submit" className="btn">
                Send
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
