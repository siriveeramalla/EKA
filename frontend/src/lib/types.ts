export type Source = {
  id: string;
  title: string;
  page?: number;
  section?: string;
  snippet: string;
  score?: number;
  distance?: number;
};

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: Source[];
  createdAt: string;
};

export type AskResponse = {
  answer: string;
  citations?: Array<{
    source?: string;
    location?: string;
    passage?: string;
    distance?: number;
  }>;
  sources?: Source[];
};

export type UploadResponse = {
  message: string;
  document_id: string;
  filename: string;
  file_type: string;
  sections_extracted: number;
  text_characters: number;
};
