"use client";

import { ChangeEvent, FormEvent, useEffect, useRef, useState } from "react";
import {
  Activity, ArrowUp, BarChart3, BookOpenText, Bot,
  Check, CheckCircle2, ChevronDown, CircleHelp, Clock3,
  FileText, FileUp, FolderOpen, Gauge, LayoutDashboard, LoaderCircle,
  MessageSquareText, Plus, Search, Settings2, ShieldCheck, Sparkles,
  ThumbsDown, ThumbsUp, UploadCloud, UserRound, X, Zap,
} from "lucide-react";
import type { AskResponse, ChatMessage, Source, UploadResponse } from "@/lib/types";

const API_BASE_URL = (process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8000").replace(/\/$/, "");
const starterQuestions = [
  "How should I report a security incident?",
  "What are the steps for onboarding a new employee?",
  "What is the software deployment procedure?",
  "What is the password and access policy?",
];
type View = "chat" | "knowledge" | "documents" | "analytics" | "settings" | "profile" | "login";
type LocalDocument = { id: string; name: string; type: string; size: number; sections: number; uploadedAt: string; status: "Extracted · needs indexing" };

function mapSources(response: AskResponse): Source[] {
  if (response.citations?.length) return response.citations.map((c, i) => ({
    id: `${c.source ?? "source"}-${i}`, title: c.source ?? "Unknown document",
    section: c.location ?? "Location not provided", snippet: c.passage ?? "No supporting passage returned.",
    distance: c.distance, score: c.distance === undefined ? undefined : Math.max(0, 1 - c.distance),
  }));
  return response.sources ?? [];
}
function formatTime(value: string) {
  return new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(new Date(value));
}
function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function Home() {
  const [view, setView] = useState<View>("chat");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [question, setQuestion] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [expandedSources, setExpandedSources] = useState<string[]>([]);
  const [documents, setDocuments] = useState<LocalDocument[]>([]);
  const [backendStatus, setBackendStatus] = useState<"checking" | "online" | "offline">("checking");
  const [searchTerm, setSearchTerm] = useState("");
  const [feedback, setFeedback] = useState<Record<string, "helpful" | "unhelpful">>({});
  const [compactMode, setCompactMode] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let active = true;
    const checkBackend = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/health`, { cache: "no-store" });
        if (active) setBackendStatus(response.ok ? "online" : "offline");
      } catch {
        if (active) setBackendStatus("offline");
      }
    };
    void checkBackend();
    const timer = window.setInterval(checkBackend, 15000);
    return () => { active = false; window.clearInterval(timer); };
  }, []);

  async function sendQuestion(value = question) {
    const cleanQuestion = value.trim();
    if (!cleanQuestion || isSending) return;
    const userMessage: ChatMessage = { id: crypto.randomUUID(), role: "user", content: cleanQuestion, createdAt: new Date().toISOString() };
    setMessages((current) => [...current, userMessage]);
    setQuestion(""); setError(""); setNotice(""); setView("chat"); setIsSending(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/chat/`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ question: cleanQuestion }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        const detail = typeof payload.detail === "string" ? payload.detail : `Request failed (${response.status}).`;
        throw new Error(detail);
      }
      const result = payload as AskResponse;
      setMessages((current) => [...current, { id: crypto.randomUUID(), role: "assistant", content: result.answer || "The API returned no answer.", sources: mapSources(result), createdAt: new Date().toISOString() }]);
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "An unexpected error occurred.";
      setError(message.includes("Failed to fetch") ? `Could not reach the backend at ${API_BASE_URL}. Make sure FastAPI is running and CORS allows this frontend.` : message);
    } finally { setIsSending(false); }
  }

  async function uploadDocument(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]; event.target.value = ""; if (!file) return;
    const extension = file.name.split(".").pop()?.toLowerCase();
    if (!extension || !["pdf", "docx", "txt", "csv"].includes(extension)) { setError("Please choose a PDF, DOCX, TXT, or CSV file."); return; }
    if (file.size > 20 * 1024 * 1024) { setError("The maximum file size is 20 MB."); return; }
    setError(""); setNotice(""); setIsUploading(true);
    try {
      const formData = new FormData(); formData.append("file", file);
      const response = await fetch(`${API_BASE_URL}/api/v1/documents/upload`, { method: "POST", body: formData });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(typeof payload.detail === "string" ? payload.detail : `Upload failed (${response.status}).`);
      const result = payload as UploadResponse;
      setDocuments((current) => [{ id: result.document_id, name: result.filename, type: result.file_type, size: file.size, sections: result.sections_extracted, uploadedAt: new Date().toISOString(), status: "Extracted · needs indexing" }, ...current.filter((d) => d.id !== result.document_id)]);
      setNotice(`${result.filename} uploaded and text extracted. It is not searchable until the ChromaDB index is rebuilt.`);
      setView("documents");
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Upload failed.";
      setError(message.includes("Failed to fetch") ? `Could not reach the backend at ${API_BASE_URL}. Check FastAPI and CORS.` : message);
    } finally { setIsUploading(false); }
  }
  function handleSubmit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); void sendQuestion(); }
  function startNewChat() { setMessages([]); setQuestion(""); setError(""); setNotice(""); setFeedback({}); setView("chat"); }
  function toggleSources(id: string) { setExpandedSources((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]); }
  const latestSources = [...messages].reverse().find((message) => message.role === "assistant" && message.sources?.length)?.sources ?? [];
  const filteredDocuments = documents.filter((document) => document.name.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <main className={`app-shell ${compactMode ? "compact-mode" : ""}`}>
      <aside className="sidebar">
        <div className="brand-lockup"><div className="brand-mark"><BookOpenText size={21} strokeWidth={2.2} /></div><div><p className="brand-name">Knowly</p><p className="brand-caption">Enterprise knowledge</p></div></div>
        <button className="new-chat-button" onClick={startNewChat} type="button"><Plus size={17} /> New conversation</button>
        <div className="sidebar-label">WORKSPACE</div>
        <nav className="side-nav" aria-label="Main navigation">
          <button className={`side-nav-item ${view === "chat" ? "active" : ""}`} onClick={() => setView("chat")} type="button"><MessageSquareText size={17} /> Ask knowledge base</button>
          <button className={`side-nav-item ${view === "documents" ? "active" : ""}`} onClick={() => { setView("documents"); setError(""); }} type="button"><FolderOpen size={17} /> Knowledge base <span className="nav-count">{documents.length}</span></button>
          <button className={`side-nav-item ${view === "knowledge" ? "active" : ""}`} onClick={() => setView("knowledge")} type="button"><BookOpenText size={17} /> Documents</button>
          <button className={`side-nav-item ${view === "analytics" ? "active" : ""}`} onClick={() => setView("analytics")} type="button"><BarChart3 size={17} /> Analytics</button>
          <button className={`side-nav-item ${view === "settings" ? "active" : ""}`} onClick={() => setView("settings")} type="button"><Settings2 size={17} /> Settings</button>
        </nav>
        <div className="sidebar-spacer" />
        <div className="privacy-card"><div className="privacy-icon"><ShieldCheck size={17} /></div><div><p className="privacy-title">Evidence-first answers</p><p className="privacy-copy">Verify important decisions against the cited original document.</p></div></div>
        <button className="profile-row profile-button" type="button" onClick={() => setView("profile")} aria-label="Open user profile"><div className="profile-avatar"><UserRound size={17} /></div><div className="profile-copy"><p>Workspace user</p><span>Employee · HR</span></div></button>
      </aside>

      <section className="main-panel">
        <header className="topbar"><div className="breadcrumb"><span>Workspace</span><span className="breadcrumb-slash">/</span><strong>{({ chat: "Knowledge assistant", knowledge: "Documents", documents: "Knowledge base", analytics: "Analytics overview", settings: "Workspace settings", profile: "User profile", login: "Sign in" })[view]}</strong></div>
          <div className="connection-status"><span className={`status-dot ${backendStatus === "offline" ? "status-offline" : backendStatus === "checking" ? "status-checking" : ""}`} />{backendStatus === "online" ? "Backend connected" : backendStatus === "offline" ? "Backend unavailable" : "Checking backend"}<span className="status-divider" /><span className="model-label">RAG workspace</span></div>
        </header>

        {view === "chat" && <>
          <div className={`conversation-area ${messages.length ? "has-messages" : ""}`}>
            {messages.length === 0 ? <div className="welcome-panel">
              <div className="welcome-symbol"><Sparkles size={24} /></div><div className="eyebrow">YOUR KNOWLEDGE, CONNECTED</div>
              <h1>Answers are closer<br className="desktop-break" /> than you think.</h1>
              <p className="welcome-description">Search policies, technical documentation, troubleshooting guides, and operational procedures. Knowly retrieves relevant passages and returns answers with sources you can verify.</p>
              <div className="welcome-stats"><div><BookOpenText size={16} /><span><strong>Source grounded</strong><small>Document citations</small></span></div><div><ShieldCheck size={16} /><span><strong>Evidence first</strong><small>Abstain when unsure</small></span></div><div><Zap size={16} /><span><strong>Semantic search</strong><small>RAG retrieval</small></span></div></div>
              <div className="suggestion-heading"><span>TRY ASKING</span><span className="suggestion-line" /></div>
              <div className="suggestion-list">{starterQuestions.map((item) => <button className="suggestion-card" key={item} onClick={() => void sendQuestion(item)} type="button"><span>{item}</span><ArrowUp size={16} className="suggestion-arrow" /></button>)}</div>
              <div className="welcome-footnote"><ShieldCheck size={14} /> Answers are grounded in indexed documents when relevant evidence is available.</div>
            </div> : <div className="chat-layout"><div className="message-list">
              <div className="thread-heading"><div><span className="eyebrow">KNOWLEDGE ASSISTANT</span><h1>Your conversation</h1></div><button type="button" className="clear-button" onClick={startNewChat}><Plus size={15} /> New chat</button></div>
              {messages.map((message) => <article className={`message-row ${message.role}`} key={message.id}>
                <div className={`message-avatar ${message.role === "assistant" ? "assistant-avatar" : "user-avatar"}`}>{message.role === "assistant" ? <Bot size={18} /> : <UserRound size={17} />}</div>
                <div className="message-body"><div className="message-meta"><strong>{message.role === "assistant" ? "Knowly" : "You"}</strong><span>{formatTime(message.createdAt)}</span>{message.role === "assistant" && <span className="grounded-tag"><ShieldCheck size={12} /> RAG response</span>}</div><p className="message-content">{message.content}</p>
                  {message.role === "assistant" && <div className="message-actions"><span>Was this answer useful?</span><button aria-label="Helpful answer" className={feedback[message.id] === "helpful" ? "feedback-selected" : ""} onClick={() => setFeedback((current) => ({ ...current, [message.id]: "helpful" }))} type="button"><ThumbsUp size={14} /> Helpful</button><button aria-label="Unhelpful answer" className={feedback[message.id] === "unhelpful" ? "feedback-selected" : ""} onClick={() => setFeedback((current) => ({ ...current, [message.id]: "unhelpful" }))} type="button"><ThumbsDown size={14} /> Not helpful</button></div>}
                  {message.sources && message.sources.length > 0 && <div className="sources-block mobile-sources"><div className="sources-heading"><BookOpenText size={15} /><span>Sources used</span><span className="source-count">{message.sources.length}</span></div>{message.sources.map((source) => <div className="source-card" key={source.id}><button className="source-toggle" type="button" onClick={() => toggleSources(source.id)}><span className="source-file-icon"><FileText size={15} /></span><span className="source-title-wrap"><strong>{source.title}</strong><small>{source.section || (source.page ? `Page ${source.page}` : "Document passage")}</small></span><ChevronDown size={16} className={expandedSources.includes(source.id) ? "rotate-icon" : ""} /></button>{expandedSources.includes(source.id) && <div className="source-snippet">{source.snippet}</div>}</div>)}</div>}
                </div>
              </article>)}
              {isSending && <div className="typing-row"><div className="message-avatar assistant-avatar"><Bot size={18} /></div><div className="typing-indicator"><span /><span /><span /><small>Searching your knowledge base…</small></div></div>}
            </div>
            <aside className="retrieval-panel"><div className="retrieval-header"><div><span className="eyebrow">RETRIEVAL TRACE</span><h2>Sources & evidence</h2></div><span className="source-count">{latestSources.length}</span></div>
              {latestSources.length ? <><p className="retrieval-description">Passages returned by semantic search for the latest answer.</p>{latestSources.map((source, index) => <div className="evidence-card" key={source.id}><div className="evidence-top"><span className="evidence-number">{String(index + 1).padStart(2, "0")}</span><span className="evidence-kind"><FileText size={13} /> Source passage</span></div><strong>{source.title}</strong><small>{source.section || "Location not provided"}</small><p>{source.snippet}</p>{source.distance !== undefined && <div className="distance-bar"><span>Cosine distance</span><strong>{source.distance.toFixed(3)}</strong></div>}</div>)}</> : <div className="empty-evidence"><div className="empty-evidence-icon"><Search size={19} /></div><strong>No sources yet</strong><p>Ask a question to see which indexed document passages the RAG pipeline retrieves.</p></div>}
              <div className="evidence-note"><ShieldCheck size={15} /><span>Use citations to verify answers. Retrieval relevance is not a guarantee of correctness.</span></div>
            </aside></div>}
          </div>
          <div className="composer-area">{error && <div className="alert alert-error" role="alert"><CircleHelp size={17} /><span>{error}</span><button type="button" aria-label="Dismiss error" onClick={() => setError("")}><X size={15} /></button></div>}{notice && <div className="alert alert-notice" role="status"><CheckCircle2 size={17} /><span>{notice}</span><button type="button" aria-label="Dismiss notice" onClick={() => setNotice("")}><X size={15} /></button></div>}
            <form className="composer" onSubmit={handleSubmit}><textarea aria-label="Ask a question" value={question} onChange={(event) => setQuestion(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void sendQuestion(); } }} placeholder="Ask a question about your indexed documents…" rows={2} maxLength={2000} disabled={isSending} /><div className="composer-toolbar"><div className="composer-tools"><input ref={fileInputRef} className="visually-hidden" type="file" accept=".pdf,.docx,.txt,.csv" onChange={uploadDocument} /><button className="tool-button" type="button" onClick={() => fileInputRef.current?.click()} disabled={isUploading}><FileUp size={16} /> {isUploading ? "Uploading…" : "Add document"}</button><span className="composer-hint">PDF, DOCX, TXT, CSV · max 20 MB</span></div><button className="send-button" type="submit" disabled={!question.trim() || isSending} aria-label="Send question">{isSending ? <LoaderCircle className="spin" size={17} /> : <ArrowUp size={18} />}</button></div></form>
            <p className="disclaimer">AI-generated responses can be inaccurate. Check the cited source before acting on important information.</p></div>
        </>}

        {view === "documents" && <div className="page-content"><div className="page-heading"><div><span className="eyebrow">KNOWLEDGE MANAGEMENT</span><h1>Knowledge base</h1><p>Upload source documents and track local processing results.</p></div><button className="primary-action" onClick={() => fileInputRef.current?.click()} type="button"><UploadCloud size={16} /> Upload document</button></div>
          {error && <div className="alert alert-error"><CircleHelp size={17} /><span>{error}</span><button onClick={() => setError("")} type="button"><X size={15} /></button></div>}{notice && <div className="alert alert-notice"><CheckCircle2 size={17} /><span>{notice}</span><button onClick={() => setNotice("")} type="button"><X size={15} /></button></div>}
          <div className="document-summary-grid"><div className="metric-card"><span>Uploaded this session</span><strong>{documents.length}</strong><small>Tracked in this browser session</small></div><div className="metric-card"><span>Successfully extracted</span><strong>{documents.length}</strong><small>Based on successful upload responses</small></div><div className="metric-card warning-metric"><span>Index status</span><strong>Manual</strong><small>Uploads do not automatically update ChromaDB</small></div></div>
          <div className="table-panel"><div className="table-toolbar"><div><h2>Documents</h2><p>Files uploaded through this interface</p></div><label className="search-box"><Search size={15} /><input value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Search documents" /></label></div>
            {filteredDocuments.length ? <div className="document-table-wrap"><table className="document-table"><thead><tr><th>File name</th><th>Type</th><th>Extracted sections</th><th>File size</th><th>Status</th></tr></thead><tbody>{filteredDocuments.map((doc) => <tr key={doc.id}><td><div className="table-file"><span className="table-file-icon"><FileText size={16} /></span><span><strong>{doc.name}</strong><small>Uploaded {new Date(doc.uploadedAt).toLocaleString()}</small></span></div></td><td><span className="file-type-pill">{doc.type.toUpperCase()}</span></td><td>{doc.sections}</td><td>{formatBytes(doc.size)}</td><td><span className="status-pill status-pending"><Clock3 size={12} /> Needs indexing</span></td></tr>)}</tbody></table></div> : <div className="empty-documents"><div className="empty-doc-icon"><FolderOpen size={23} /></div><h3>No session uploads yet</h3><p>Upload a PDF, DOCX, TXT, or CSV file. The backend will extract its text and return processing metadata.</p><button className="primary-action" onClick={() => fileInputRef.current?.click()} type="button"><FileUp size={15} /> Choose a document</button></div>}
          </div><div className="process-callout"><div className="callout-icon"><Activity size={18} /></div><div><strong>Keep your retrieval index in sync</strong><p>After uploading a document, run <code>python process_documents.py</code> and then <code>python build_vector_db.py</code> from your backend folder. Newly uploaded files become searchable after re-indexing.</p></div></div>
          <input ref={fileInputRef} className="visually-hidden" type="file" accept=".pdf,.docx,.txt,.csv" onChange={uploadDocument} />
        </div>}

        {view === "knowledge" && <div className="page-content"><div className="page-heading"><div><span className="eyebrow">DOCUMENT LIBRARY</span><h1>Documents</h1><p>Files uploaded in this browser session. Existing backend files need a listing endpoint to appear here automatically.</p></div><button className="primary-action" type="button" onClick={() => fileInputRef.current?.click()}><UploadCloud size={16}/> Upload document</button></div><div className="document-note"><ShieldCheck size={17}/><span>Supported uploads are sent to FastAPI. Newly uploaded files are extracted, but must be indexed into ChromaDB before they become searchable.</span></div><div className="document-table-wrap"><table className="document-table"><thead><tr><th>Document</th><th>Type</th><th>Size</th><th>Sections</th><th>Status</th><th>Uploaded</th></tr></thead><tbody>{filteredDocuments.length ? filteredDocuments.map((doc) => <tr key={doc.id}><td><FileText size={16}/>{doc.name}</td><td>{doc.type.toUpperCase()}</td><td>{formatBytes(doc.size)}</td><td>{doc.sections}</td><td><span className="status-pill status-pending">{doc.status}</span></td><td>{new Date(doc.uploadedAt).toLocaleDateString()}</td></tr>) : <tr><td colSpan={6} className="table-empty">No uploaded documents in this session. Existing raw/processed files are on the backend filesystem.</td></tr>}</tbody></table></div></div>}
        {view === "profile" && <div className="page-content"><div className="page-heading"><div><span className="eyebrow">ACCOUNT</span><h1>User profile</h1><p>Demo profile for the local development workspace.</p></div></div><section className="settings-card profile-detail"><div className="profile-avatar profile-avatar-large"><UserRound size={28}/></div><h2>Priya Sharma</h2><p>priya@company.example</p><span className="status-pill status-pending">Demo account · not authenticated</span><div className="setting-row"><div><strong>Role</strong><small>Example role only; not enforced by backend</small></div><span className="setting-value">Employee</span></div><div className="setting-row"><div><strong>Department</strong></div><span className="setting-value">HR</span></div><div className="security-checklist"><p><ShieldCheck size={15}/> Sign-in and server-side role enforcement have not yet been implemented.</p></div><button className="secondary-action" type="button" onClick={() => setView("settings")}>Open settings</button></section></div>}
        {view === "login" && <div className="page-content login-page"><section className="settings-card login-card"><div className="brand-mark"><BookOpenText size={22}/></div><h1>Sign in to your workspace</h1><p>Authentication UI preview. Secure authentication must be implemented by the backend before production use.</p><label>Email<input className="login-input" type="email" placeholder="you@company.com"/></label><label>Password<input className="login-input" type="password" placeholder="Enter your password"/></label><button className="primary-action" type="button" onClick={() => setNotice("Demo sign-in is not connected to an authentication service.")}>Sign in</button><small>Your access is limited to documents you are authorized to view.</small></section></div>}
        {view === "analytics" && <div className="page-content"><div className="page-heading"><div><span className="eyebrow">OBSERVABILITY</span><h1>Analytics overview</h1><p>Visibility into the quality and operation of your RAG assistant.</p></div><span className="demo-label"><Activity size={13} /> Metrics readiness</span></div>
          <div className="analytics-banner"><Gauge size={20} /><div><strong>Analytics instrumentation is not connected yet</strong><p>The cards below describe metrics to collect. Live query counts, latency, and answer ratings are not available because the backend does not persist analytics events yet.</p></div></div>
          <div className="analytics-grid"><div className="metric-card large-metric"><div className="metric-top"><span>Documents uploaded this session</span><FileText size={17} /></div><strong>{documents.length}</strong><small>Live from this browser session</small><div className="mini-track"><span style={{ width: `${Math.min(100, documents.length * 10)}%` }} /></div></div><div className="metric-card large-metric"><div className="metric-top"><span>Backend connectivity</span><Activity size={17} /></div><strong className={backendStatus === "online" ? "metric-green" : "metric-red"}>{backendStatus === "online" ? "Online" : backendStatus === "checking" ? "Checking" : "Offline"}</strong><small>Health endpoint check</small><div className="metric-foot"><span className={`status-dot ${backendStatus === "offline" ? "status-offline" : ""}`} /> {API_BASE_URL}/health</div></div><div className="metric-card large-metric"><div className="metric-top"><span>Query latency</span><Clock3 size={17} /></div><strong>—</strong><small>Not measured by current API</small><div className="metric-foot">Add request timing and persistence</div></div><div className="metric-card large-metric"><div className="metric-top"><span>Answer helpfulness</span><ThumbsUp size={17} /></div><strong>—</strong><small>Feedback is local only</small><div className="metric-foot">Store ratings in a database to report trends</div></div></div>
          <div className="table-panel roadmap-panel"><div className="table-toolbar"><div><h2>Recommended evaluation metrics</h2><p>Track these to make the major project measurable.</p></div></div><div className="metric-roadmap"><div><span className="roadmap-icon"><Search size={16} /></span><span><strong>Retrieval quality</strong><small>Precision@k, Recall@k, MRR, nDCG</small></span><span className="roadmap-state">Planned</span></div><div><span className="roadmap-icon"><ShieldCheck size={16} /></span><span><strong>Groundedness and citations</strong><small>Faithfulness, citation coverage, unsupported claim rate</small></span><span className="roadmap-state">Planned</span></div><div><span className="roadmap-icon"><Zap size={16} /></span><span><strong>Performance and reliability</strong><small>Latency, failed requests, model cost, uptime</small></span><span className="roadmap-state">Planned</span></div><div><span className="roadmap-icon"><CheckCircle2 size={16} /></span><span><strong>User feedback</strong><small>Helpful / not helpful with comments and audit trail</small></span><span className="roadmap-state">Planned</span></div></div></div>
        </div>}

        {view === "settings" && <div className="page-content settings-page"><div className="page-heading"><div><span className="eyebrow">PREFERENCES & CONNECTION</span><h1>Workspace settings</h1><p>Review local API configuration and interface preferences.</p></div></div>
          <section className="settings-card"><div className="settings-card-heading"><div className="settings-icon"><Activity size={18} /></div><div><h2>Backend connection</h2><p>Frontend requests are sent directly to your FastAPI development server.</p></div><span className={`status-pill ${backendStatus === "online" ? "status-success" : backendStatus === "offline" ? "status-failed" : "status-pending"}`}>{backendStatus === "online" ? "Connected" : backendStatus === "offline" ? "Unavailable" : "Checking"}</span></div><div className="setting-row"><div><strong>API base URL</strong><small>Configured with NEXT_PUBLIC_API_BASE_URL</small></div><code>{API_BASE_URL}</code></div><div className="setting-row"><div><strong>Health endpoint</strong><small>GET /health · automatically checked every 15 seconds</small></div><span className="setting-value">{backendStatus === "online" ? <><Check size={14} /> Healthy</> : backendStatus === "checking" ? "Checking…" : "Not reachable"}</span></div><div className="setting-row"><div><strong>Chat endpoint</strong><small>POST /api/v1/chat/ · sends a question to the RAG service</small></div><span className="setting-value">Configured</span></div><div className="setting-row"><div><strong>Document upload</strong><small>POST /api/v1/documents/upload · max 20 MB</small></div><span className="setting-value">Configured</span></div></section>
          <section className="settings-card"><div className="settings-card-heading"><div className="settings-icon"><LayoutDashboard size={18} /></div><div><h2>Interface preferences</h2><p>These preferences affect only the current browser session.</p></div></div><div className="setting-row"><div><strong>Compact workspace</strong><small>Reduce some spacing in the interface</small></div><button type="button" className={`toggle-switch ${compactMode ? "toggle-on" : ""}`} aria-pressed={compactMode} onClick={() => setCompactMode((value) => !value)}><span /></button></div><div className="setting-row"><div><strong>Source evidence panel</strong><small>Show retrieved passages alongside chat answers</small></div><span className="setting-value"><Check size={14} /> Enabled</span></div></section>
          <section className="settings-card security-settings"><div className="settings-card-heading"><div className="settings-icon"><ShieldCheck size={18} /></div><div><h2>Security & governance</h2><p>Items to complete before any public or multi-user deployment.</p></div></div><div className="security-checklist"><p><Clock3 size={15} /> Authentication and role-based document access — not implemented</p><p><Clock3 size={15} /> Persistent audit log and conversation storage — not implemented</p><p><Clock3 size={15} /> Server-side file validation and malware scanning — hardening required</p><p><CheckCircle2 size={15} /> API key is kept on backend, not in frontend environment variables</p></div></section>
        </div>}
      </section>
      {view === "chat" && <aside className="sources-panel" aria-label="Retrieved sources">
        <div className="sources-panel-header">
          <div><p className="panel-eyebrow">EVIDENCE</p><h2>Sources & citations</h2><p>{latestSources.length ? `Based on ${latestSources.length} retrieved passage${latestSources.length === 1 ? "" : "s"}` : "Sources appear after you ask a question"}</p></div>
          <span className="sources-panel-icon"><BookOpenText size={18} /></span>
        </div>
        {latestSources.length > 0 ? <>
          <div className="confidence-card">
            <div className="confidence-title"><ShieldCheck size={16}/><span>Answer confidence</span></div>
            {(() => {
              const distances = latestSources.map((item) => item.distance).filter((item): item is number => typeof item === "number");
              const score = distances.length ? Math.max(0, Math.min(1, 1 - distances.reduce((a, b) => a + b, 0) / distances.length)) : null;
              const label = score === null ? "Not assessed" : score >= 0.65 ? "High relevance" : score >= 0.4 ? "Medium relevance" : "Low relevance";
              const color = score === null ? "confidence-neutral" : score >= 0.65 ? "confidence-high" : score >= 0.4 ? "confidence-medium" : "confidence-low";
              return <><div className={`confidence-value ${color}`}>{label}</div><div className="confidence-track"><span className={color} style={{width: `${score === null ? 0 : score * 100}%`}} /></div><p>Estimated from retrieval distance; this is not a verified answer-accuracy score.</p></>;
            })()}
          </div>
          <div className="source-card-list">
            {latestSources.map((source, index) => <article className="source-card" key={source.id}>
              <div className="source-card-top"><span className="citation-number">[{index + 1}]</span><span className="source-file-icon"><FileText size={17}/></span><span className="source-file-type">SOURCE</span></div>
              <h3>{source.title}</h3>
              <p className="source-location">{source.section || (source.page ? `Page ${source.page}` : "Location not provided")}</p>
              <p className="source-excerpt">{source.snippet}</p>
              {typeof source.score === "number" && <div className="source-score">Retrieval relevance <strong>{Math.round(source.score * 100)}%</strong></div>}
              <div className="source-card-actions">
                <button type="button" onClick={() => setNotice(`Source: ${source.title} · ${source.section || "Location not provided"}`)}><Search size={13}/> View reference</button>
                <button type="button" onClick={() => { void navigator.clipboard?.writeText(source.snippet); setNotice("Source excerpt copied."); }}><FileUp size={13}/> Copy excerpt</button>
              </div>
            </article>)}
          </div>
          <div className="panel-feedback"><strong>Was this answer helpful?</strong><div><button type="button" onClick={() => { const last = [...messages].reverse().find((m) => m.role === "assistant"); if (last) setFeedback((old) => ({...old, [last.id]: "helpful"})); setNotice("Thanks for your feedback."); }}><ThumbsUp size={14}/> Yes</button><button type="button" onClick={() => { const last = [...messages].reverse().find((m) => m.role === "assistant"); if (last) setFeedback((old) => ({...old, [last.id]: "unhelpful"})); setNotice("Feedback saved for this browser session."); }}><ThumbsDown size={14}/> No</button></div></div>
        </> : <div className="sources-empty"><div><BookOpenText size={24}/></div><h3>No sources yet</h3><p>Ask a question to see the retrieved passages, document locations, and relevance information used by the assistant.</p></div>}
        <div className="permission-note"><ShieldCheck size={15}/><span>Always verify important decisions against the original document. Role-based access controls must be enforced by the backend.</span></div>
      </aside>}
    </main>
  );
}
