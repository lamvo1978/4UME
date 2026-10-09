import Papa from "papaparse";
import { readSheet } from "read-excel-file/browser";
import writeXlsxFile from "write-excel-file/browser";
import type { ExportWord, ImportWordRow } from "./api";

type Field = Exclude<keyof ImportWordRow, "line">;

/** Export / template column order. Import also accepts the Vietnamese aliases below, in any order. */
const COLUMNS: { field: Field; header: string; aliases: string[]; width: number }[] = [
  { field: "id", header: "id", aliases: ["ma", "matu"], width: 22 },
  { field: "word", header: "word", aliases: ["tu", "tuvung"], width: 18 },
  { field: "pos", header: "pos", aliases: ["loaitu", "partofspeech"], width: 14 },
  { field: "level", header: "level", aliases: ["capdo", "cefr"], width: 8 },
  { field: "deck", header: "deck", aliases: ["bo", "botu", "deckid", "chude", "topic"], width: 18 },
  { field: "meaningVi", header: "meaning_vi", aliases: ["meaning", "nghia", "nghiatiengviet"], width: 32 },
  { field: "ipa", header: "ipa", aliases: ["phienam"], width: 16 },
  { field: "example", header: "example", aliases: ["vidu", "cauvidu"], width: 40 },
  { field: "exampleVi", header: "example_vi", aliases: ["nghiavidu", "nghiacauvidu"], width: 40 },
  { field: "imageUrl", header: "image_url", aliases: ["image", "hinh", "hinhanh", "anh"], width: 30 },
  { field: "published", header: "published", aliases: ["hien", "hienthi", "visible"], width: 10 },
];

const fold = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/gi, "d")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

function fieldFor(header: string): Field | undefined {
  const h = fold(header);
  return COLUMNS.find((c) => fold(c.header) === h || c.aliases.includes(h))?.field;
}

export type ParsedSheet = { rows: ImportWordRow[]; columns: Field[]; ignored: string[] };

/** Reads the first sheet of an .xlsx or a .csv file; row 1 must hold the column names. */
export async function parseWordFile(file: File): Promise<ParsedSheet> {
  const name = file.name.toLowerCase();
  let table: unknown[][];
  if (name.endsWith(".csv") || name.endsWith(".txt")) {
    const text = await file.text();
    table = Papa.parse<string[]>(text.replace(/^\uFEFF/, ""), { skipEmptyLines: "greedy" }).data;
  } else if (name.endsWith(".xlsx")) {
    table = (await readSheet(file)) as unknown[][];
  } else {
    throw new Error("Chỉ nhận file Excel (.xlsx) hoặc CSV.");
  }
  if (table.length < 2) throw new Error("File cần có dòng tiêu đề và ít nhất một dòng dữ liệu.");

  const headers = table[0].map((h) => String(h ?? "").trim());
  const map = headers.map(fieldFor);
  const columns = map.filter((f): f is Field => !!f);
  if (!columns.includes("word") && !columns.includes("id"))
    throw new Error('Không thấy cột "word" (hoặc "từ"). Hãy dùng file mẫu để đúng tên cột.');

  const rows: ImportWordRow[] = [];
  table.slice(1).forEach((cells, i) => {
    if (cells.every((c) => c === null || c === undefined || String(c).trim() === "")) return;
    const row = { line: i + 2 } as ImportWordRow;
    for (const c of COLUMNS) row[c.field] = null;
    map.forEach((field, col) => {
      if (field) row[field] = cell(cells[col]);
    });
    rows.push(row);
  });
  return { rows, columns, ignored: headers.filter((h, i) => h && !map[i]) };
}

function cell(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "boolean") return v ? "1" : "0";
  return String(v).trim();
}

const exportRow = (w: ExportWord) => [
  w.id,
  w.word,
  w.pos,
  w.level,
  w.deck,
  w.meaningVi,
  w.ipa,
  w.example,
  w.exampleVi,
  w.imageUrl ?? "",
  w.published ? "1" : "0",
];

const HEADERS = COLUMNS.map((c) => c.header);

export async function downloadWordsXlsx(words: ExportWord[], fileName: string) {
  const data = [
    HEADERS.map((h) => ({ value: h, fontWeight: "bold" as const })),
    ...words.map((w) => exportRow(w).map((value) => ({ value, type: String }))),
  ];
  const blob = await writeXlsxFile(data, { columns: COLUMNS.map((c) => ({ width: c.width })), stickyRowsCount: 1, sheet: "Từ vựng" }).toBlob();
  downloadBlob(blob, fileName);
}

export function downloadWordsCsv(words: ExportWord[], fileName: string) {
  const csv = Papa.unparse([HEADERS, ...words.map(exportRow)]);
  // BOM so Excel opens the file as UTF-8 (Vietnamese text).
  downloadBlob(new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" }), fileName);
}

export function downloadJson(data: unknown, fileName: string) {
  downloadBlob(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }), fileName);
}

/** One sample row; `deck` should be a real deck id so the sample imports cleanly. */
export async function downloadTemplate(deck: string) {
  const sample: ExportWord[] = [
    {
      id: "",
      word: "umbrella",
      pos: "noun",
      level: "A1",
      deck,
      deckTitleVi: "",
      meaningVi: "cái ô, cái dù",
      ipa: "/ʌmˈbrelə/",
      example: "Take an umbrella with you.",
      exampleVi: "Mang theo ô nhé.",
      imageUrl: null,
      published: true,
    },
  ];
  await downloadWordsXlsx(sample, "4ume-mau-nhap-tu-vung.xlsx");
}

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}

/** e.g. "4ume-tu-vung-2026-10-08" */
export const datedName = (prefix: string) => `${prefix}-${new Date().toISOString().slice(0, 10)}`;
