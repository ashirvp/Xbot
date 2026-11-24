"use client";

import { useState } from "react";

type Post = { id: number; text: string | null; status: string; error: string | null; created_at: string; tweet_id: string | null };

export default function Home() {
  const [pw, setPw] = useState("");
  const [authed, setAuthed] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [posts, setPosts] = useState<Post[]>([]);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [replyInput, setReplyInput] = useState("");
  const [replies, setReplies] = useState<string[]>([]);

  async function call(path: string, body?: unknown) {
    const res = await fetch(path, {
      method: body === undefined ? "GET" : "POST",
      headers: { "x-admin-password": pw, "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (res.status === 401) throw new Error("Wrong password");
    return data;
  }

  async function act(fn: () => Promise<void>) {
    setBusy(true);
    setMsg("");
    try {
      await fn();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  const load = () =>
    act(async () => {
      const d = await call("/api/settings");
      if (d.error) throw new Error(d.error);
      setEnabled(d.enabled);
      setPosts(d.posts);
      setAuthed(true);
    });

  if (!authed) {
    return (
      <form onSubmit={(e) => { e.preventDefault(); load(); }}>
        <h1>X bot</h1>
        <input type="password" placeholder="Admin password" value={pw} onChange={(e) => setPw(e.target.value)} autoFocus />{" "}
        <button disabled={busy}>Open</button>
        <p>{msg}</p>
      </form>
    );
  }

  return (
    <main>
      <h1>X bot</h1>

      <p>
        Auto-posting is <b>{enabled ? "ON" : "OFF"}</b>{" "}
        <button disabled={busy} onClick={() => act(async () => {
          const d = await call("/api/settings", { enabled: !enabled });
          setEnabled(d.enabled);
        })}>
          Turn {enabled ? "off" : "on"}
        </button>
      </p>

      <p>
        <button disabled={busy} onClick={() => act(async () => {
          if (!confirm("Generate and publish one post to X now? This uses X API credits.")) return;
          const d = await call("/api/post", {});
          setMsg(d.ok ? `Posted: ${d.text}` : `Not posted: ${d.reason}`);
          const s = await call("/api/settings");
          setPosts(s.posts);
        })}>
          Generate &amp; post now
        </button>
      </p>
      {msg && <p style={{ background: "#f3f3f3", padding: 8 }}>{msg}</p>}

      <h2>Reply ideas (drafts only)</h2>
      <textarea rows={3} style={{ width: "100%" }} placeholder="Paste an x.com post URL or the post text"
        value={replyInput} onChange={(e) => setReplyInput(e.target.value)} />
      <button disabled={busy || !replyInput.trim()} onClick={() => act(async () => {
        const d = await call("/api/replies", { input: replyInput });
        if (d.error) throw new Error(d.error);
        setReplies(d.replies);
      })}>Suggest replies</button>
      <ul>
        {replies.map((r, i) => (
          <li key={i}>{r} <button onClick={() => navigator.clipboard.writeText(r)}>Copy</button></li>
        ))}
      </ul>

      <h2>Recent</h2>
      <ul>
        {posts.map((p) => (
          <li key={p.id}>
            <small>{new Date(p.created_at).toLocaleString("de-DE", { timeZone: "Europe/Berlin" })} · {p.status}</small>
            <br />
            {p.tweet_id ? <a href={`https://x.com/i/status/${p.tweet_id}`} target="_blank" rel="noreferrer">{p.text}</a> : p.text}
            {p.error && <><br /><small style={{ color: "crimson" }}>{p.error}</small></>}
          </li>
        ))}
      </ul>
    </main>
  );
}
