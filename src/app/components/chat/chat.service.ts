import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';

// Add at top of ChatService (below imports)
class ApiUnavailableError extends Error {
  status: number;
  body?: string;
  constructor(message: string, status = 0, body?: string) {
    super(message);
    this.name = 'ApiUnavailableError';
    this.status = status;
    this.body = body;
  }
}

@Injectable()
export class ChatService {
  private base = environment.apiBaseUrl.replace(/\/$/, '');
  apiEndpoint = `${this.base}/chat`;
  // Backwards-compatible aliases used by the template
  apiSendEndpoint = `${this.base}/chat`;
  apiStreamEndpoint = `${this.base}/chat`;

  // Persisted chat id so the server can resume a session. Read from localStorage if available.
  public chatId: string | null = (() => {
    try {
      return localStorage.getItem('chat_id');
    } catch (e) {
      return null;
    }
  })();

  // Streaming POST using fetch; reads a text/event-stream style response and calls onChunk for each "data: ..." event.
  async streamMessage(
    message: string,
    onChunk: (chunk: { type: 'reasoning' | 'answer' | 'chat_id' | 'other'; text: string }) => void,
    opts?: { useOpenAI?: boolean }
  ) {
    const body: any = { message };
    if (this.chatId) body.chat_id = this.chatId;
    if (opts?.useOpenAI) body.use_openai = true;

    const resp = await fetch(this.apiEndpoint, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    // Not OK → throw explicit error so UI can react
    if (!resp.ok || !resp.body) {
      const txt = await resp.text().catch(() => '');
      throw new ApiUnavailableError(
        `Chat API error (HTTP ${resp.status}).`,
        resp.status,
        txt || undefined
      );
    }

    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    const processBuffer = () => {
      let idx: number;
      while ((idx = buffer.indexOf('\n\n')) !== -1) {
        const chunk = buffer.slice(0, idx).trim();
        buffer = buffer.slice(idx + 2);
        for (const line of chunk.split(/\r?\n/)) {
          if (line.startsWith('data:')) {
            const payload = line.slice(5).trim();
            try {
              const parsed = JSON.parse(payload);
              if (parsed?.type === 'chat_id' && parsed.chat_id) {
                this.chatId = parsed.chat_id;
                try {
                  if (this.chatId) localStorage.setItem('chat_id', this.chatId);
                } catch {}
                continue;
              }
              if (typeof parsed === 'string') {
                onChunk({ type: 'other', text: parsed });
              } else if (parsed.choices) {
                const delta = parsed.choices[0]?.delta;
                if (delta?.content) onChunk({ type: 'answer', text: delta.content });
                else if (delta?.reasoning) onChunk({ type: 'reasoning', text: delta.reasoning });
                else onChunk({ type: 'other', text: JSON.stringify(parsed) });
              } else if (parsed.content) {
                onChunk({ type: 'answer', text: parsed.content });
              } else {
                onChunk({ type: 'other', text: JSON.stringify(parsed) });
              }
            } catch {
              onChunk({ type: 'other', text: payload });
            }
          }
        }
      }
    };

    const pump = async () => {
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          processBuffer();
        }
        // final flush
        buffer = buffer.trim();
        if (buffer) {
          if (buffer.startsWith('data:')) {
            for (const line of buffer.split(/\r?\n/)) {
              if (line.startsWith('data:')) onChunk({ type: 'other', text: line.slice(5).trim() });
            }
          } else {
            onChunk({ type: 'other', text: buffer });
          }
        }
      } catch (err) {
        // Stream died mid-flight → surface as API unavailable
        throw new ApiUnavailableError('Connection lost while streaming from Chat API.', 0);
      } finally {
        try {
          reader.releaseLock();
        } catch {}
      }
    };

    return pump().catch((err) => {
      // Normalize unexpected errors to ApiUnavailableError for the caller
      if (err instanceof ApiUnavailableError) throw err;
      throw new ApiUnavailableError('Unexpected error talking to Chat API.', 0);
    });
  }

  // Fetch chat history from backend for a given chat id. Returns the server message list.
  async fetchChatHistory(chatId?: string) {
    const id = chatId ?? this.chatId;
    if (!id) return null;
    const url = `${this.base}/chats/${encodeURIComponent(id)}/messages`;
    const resp = await fetch(url, { method: 'GET', credentials: 'include' });
    if (!resp.ok) {
      const txt = await resp.text().catch(() => '');
      throw new Error(`Failed to load chat history: ${resp.status} ${txt}`);
    }
    const data = await resp.json().catch(() => null);
    return data;
  }

  // Health check endpoint
  async healthCheck(): Promise<boolean> {
    const url = `${this.base}/health`;
    try {
      const resp = await fetch(url, { method: 'GET', credentials: 'include' });
      if (!resp.ok) return false;
      const data = await resp.json().catch(() => null);
      return data?.status === 'ok';
    } catch (e) {
      return false;
    }
  }
}
