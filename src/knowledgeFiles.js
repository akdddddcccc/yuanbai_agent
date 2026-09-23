const STORAGE_KEY = "yuanbai-knowledge-documents-v1";
const MAX_FILE_SIZE = 15 * 1024 * 1024;
const MAX_DOCUMENT_CHARACTERS = 50_000;
const MAX_TOTAL_CHARACTERS = 160_000;
const MAX_DOCUMENTS = 8;

function cleanText(value) {
  return String(value || "")
    .replace(/\u0000/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{4,}/g, "\n\n\n")
    .trim();
}

async function readPdf(file) {
  const [pdfjs, workerModule] = await Promise.all([
    import("pdfjs-dist"),
    import("pdfjs-dist/build/pdf.worker.min.mjs?url"),
  ]);
  pdfjs.GlobalWorkerOptions.workerSrc = workerModule.default;
  const pdf = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
  const pages = [];
  for (let pageNumber = 1; pageNumber <= Math.min(pdf.numPages, 120); pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    pages.push(content.items.map((item) => item.str || "").join(" "));
  }
  return pages.join("\n\n");
}

async function readDocx(file) {
  const module = await import("mammoth");
  const mammoth = module.default || module;
  const result = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
  return result.value;
}

async function readPptx(file) {
  const { strFromU8, unzipSync } = await import("fflate");
  const archive = unzipSync(new Uint8Array(await file.arrayBuffer()));
  const slideNames = Object.keys(archive)
    .filter((name) => /^ppt\/slides\/slide\d+\.xml$/i.test(name))
    .sort((a, b) => Number(a.match(/\d+/)?.[0]) - Number(b.match(/\d+/)?.[0]));
  return slideNames.map((name, index) => {
    const xml = new DOMParser().parseFromString(strFromU8(archive[name]), "application/xml");
    const text = [...xml.getElementsByTagName("a:t")].map((node) => node.textContent || "").join(" ");
    return `第${index + 1}页\n${text}`;
  }).join("\n\n");
}

export async function extractKnowledgeFile(file) {
  if (file.size > MAX_FILE_SIZE) throw new Error(`${file.name} 超过15MB，请先压缩或拆分。`);
  const extension = file.name.split(".").pop()?.toLowerCase();
  let text;
  if (["txt", "md", "csv", "json"].includes(extension)) text = await file.text();
  else if (extension === "pdf") text = await readPdf(file);
  else if (extension === "docx") text = await readDocx(file);
  else if (extension === "pptx") text = await readPptx(file);
  else throw new Error(`${file.name} 暂不支持，请使用PDF、DOCX、PPTX、TXT、MD、CSV或JSON。`);

  const content = cleanText(text).slice(0, MAX_DOCUMENT_CHARACTERS);
  if (!content) throw new Error(`${file.name} 没有提取到可读文字。扫描版PDF请先做OCR。`);
  return {
    id: globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`,
    name: file.name.slice(0, 120),
    type: extension,
    size: file.size,
    addedAt: new Date().toISOString(),
    content,
  };
}

export function loadKnowledgeDocuments() {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(value) ? value.slice(0, MAX_DOCUMENTS) : [];
  } catch {
    return [];
  }
}

export function saveKnowledgeDocuments(documents) {
  let remaining = MAX_TOTAL_CHARACTERS;
  const saved = documents.slice(0, MAX_DOCUMENTS).flatMap((document) => {
    if (!document?.content || remaining <= 0) return [];
    const content = document.content.slice(0, remaining);
    remaining -= content.length;
    return [{ ...document, content }];
  });
  localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
  return saved;
}

