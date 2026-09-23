import { useEffect, useRef, useState } from "react";
import { BookOpenText, FileArrowUp, Trash, X } from "@phosphor-icons/react";
import { extractKnowledgeFile, loadKnowledgeDocuments, saveKnowledgeDocuments } from "./knowledgeFiles.js";

function fileSizeLabel(size) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

export function KnowledgePanel({ onDocumentsChange }) {
  const [open, setOpen] = useState(false);
  const [documents, setDocuments] = useState(() => loadKnowledgeDocuments());
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    onDocumentsChange(documents);
  }, [documents, onDocumentsChange]);

  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  const updateDocuments = (next) => {
    const saved = saveKnowledgeDocuments(next);
    setDocuments(saved);
  };

  const onFiles = async (event) => {
    const files = [...(event.target.files || [])];
    event.target.value = "";
    if (!files.length) return;
    setBusy(true);
    setMessage("正在读取资料…");
    const added = [];
    const errors = [];
    for (const file of files) {
      try {
        added.push(await extractKnowledgeFile(file));
      } catch (error) {
        errors.push(error?.message || `${file.name} 读取失败。`);
      }
    }
    if (added.length) updateDocuments([...added, ...documents]);
    setMessage(errors.length ? errors.join(" ") : `已加入${added.length}份资料，可以直接用语音提问。`);
    setBusy(false);
  };

  return (
    <>
      <button
        className="knowledge-trigger"
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <BookOpenText size={16} weight="duotone" />
        <span>资料</span>
        <strong>{documents.length}</strong>
      </button>

      {open && <button className="knowledge-scrim" type="button" aria-label="关闭资料库" onClick={() => setOpen(false)} />}
      <aside
        className={`knowledge-panel${open ? " is-open" : ""}`}
        role="dialog"
        aria-modal={open ? "true" : undefined}
        aria-hidden={!open}
        inert={!open}
        aria-label="元白资料库"
      >
        <header className="knowledge-panel-head">
          <div>
            <span>YUANBAI MEMORY</span>
            <h2>元白资料库</h2>
          </div>
          <button type="button" onClick={() => setOpen(false)} aria-label="关闭"><X size={20} /></button>
        </header>

        <section className="knowledge-official">
          <span>已内置 · 公开核验</span>
          <strong>元白楼、学院方法、师资与项目</strong>
          <p>官方资料和内部口述已经分层保存，回答时会先检索与问题相关的内容。</p>
        </section>

        <section className="knowledge-upload">
          <input
            ref={inputRef}
            type="file"
            multiple
            hidden
            accept=".pdf,.docx,.pptx,.txt,.md,.csv,.json"
            onChange={onFiles}
          />
          <button type="button" onClick={() => inputRef.current?.click()} disabled={busy}>
            <FileArrowUp size={22} weight="duotone" />
            <span><strong>{busy ? "正在读取" : "上传手头资料"}</strong><small>PDF · Word · PPT · 文本，单份不超过15MB</small></span>
          </button>
          <p>资料仅保存在当前浏览器。提问时只发送相关文字片段，不上传原文件。</p>
          {message && <output>{message}</output>}
        </section>

        <section className="knowledge-list" aria-label="已上传资料">
          <div className="knowledge-list-title">
            <span>当前浏览器资料</span>
            <strong>{documents.length}/8</strong>
          </div>
          {documents.length === 0 ? (
            <p className="knowledge-empty">还没有临时资料。路演前可把课程说明、班级资料或作品介绍放进来。</p>
          ) : documents.map((document) => (
            <article key={document.id}>
              <div><strong>{document.name}</strong><small>{document.type.toUpperCase()} · {fileSizeLabel(document.size)} · {document.content.length}字</small></div>
              <button type="button" onClick={() => updateDocuments(documents.filter((item) => item.id !== document.id))} aria-label={`移除${document.name}`}>
                <Trash size={16} />
              </button>
            </article>
          ))}
        </section>
      </aside>
    </>
  );
}
