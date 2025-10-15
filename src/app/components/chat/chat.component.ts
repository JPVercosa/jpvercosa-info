import { Component, effect, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { ChatService } from './chat.service';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { marked } from 'marked';

@Component({
  selector: 'app-chat',
  standalone: true,
  imports: [CommonModule, FormsModule, HttpClientModule],
  templateUrl: './chat.component.html',
  styleUrls: ['./chat.component.scss'],
  providers: [ChatService],
})
export class ChatComponent {
  messages = signal<
    {
      who: 'user' | 'bot';
      text: string;
      rendered?: string;
      reasoning?: string;
      renderedReasoning?: string;
      reasoningVisible?: boolean;
    }[]
  >([]);
  input = signal('');
  sending = signal(false);
  chatAvailable = signal(true);
  suggestions = [
    'Tell me a story in 10 words',
    'Summarize my CV in one sentence',
    'What are my top skills based on the CV?',
  ];
  showSuggestions = signal(true);

  constructor(public chat: ChatService) {}

  // Load chat history on component initialization
  async ngOnInit() {
    // 1) check health
    const healthy = await this.chat.healthCheck();
    if (!healthy) {
      this.chatAvailable.set(false);
      this.messages.update((arr) => [
        ...arr,
        {
          who: 'bot',
          text: 'Service is currently unavailable. Please contact me to restore access.',
        },
      ]);
      return;
    }

    // healthy: if we have a chatId already, try to restore conversation
    if (this.chat.chatId) {
      try {
        const data = await this.chat.fetchChatHistory();
        if (!data || !data.messages) return;

        // Map server messages into UI messages. We need to group reasoning entries with the following assistant normal message.
        const ui: any[] = [];
        let pendingReasoning = '';

        for (const m of data.messages) {
          const role = m.role; // 'user' | 'assistant' | 'reasoning'
          const content = m.content ?? '';
          const message_type = m.message_type; // 'normal' | 'reasoning'

          if (message_type === 'reasoning' || role === 'reasoning') {
            // accumulate reasoning; will attach to next assistant message
            pendingReasoning += content;
            continue;
          }

          // normal message
          if (role === 'user') {
            const parsed = marked.parse(content || '') as string | Promise<string>;
            const rendered = await Promise.resolve(parsed);
            ui.push({ who: 'user', text: content, rendered });
          } else if (role === 'assistant') {
            const parsed = marked.parse(content || '') as string | Promise<string>;
            const rendered = await Promise.resolve(parsed);
            const entry: any = { who: 'bot', text: content, rendered };
            if (pendingReasoning) {
              const rparsed = marked.parse(pendingReasoning || '') as string | Promise<string>;
              const rrendered = await Promise.resolve(rparsed);
              entry.reasoning = pendingReasoning;
              entry.renderedReasoning = rrendered;
              entry.reasoningVisible = false;
              pendingReasoning = '';
            }
            ui.push(entry);
          } else {
            // fallback: treat as user
            const parsed = marked.parse(content || '') as string | Promise<string>;
            const rendered = await Promise.resolve(parsed);
            ui.push({ who: 'user', text: content, rendered });
          }
        }

        // apply to signal
        this.messages.set(ui);
        // show suggestions only if there are no messages
        this.showSuggestions.set(ui.length === 0);
      } catch (e) {
        console.warn('Failed to load chat history', e);
        this.chatAvailable.set(false);
        this.showSuggestions.set(false);
        const errParsed = marked.parse(
          'Chat history is not available right now. Please contact me to restore access.'
        ) as string | Promise<string>;
        const errHtml = await Promise.resolve(errParsed);
        this.messages.update((arr) => [
          ...arr,
          {
            who: 'bot',
            text: 'Chat history is not available right now. Please contact me to restore access.',
            rendered: errHtml,
          },
        ]);
      }
    } else {
      // healthy and no chat id -> allow user to start a new chat (chatAvailable stays true)
    }
  }

  // Clear local chat and restore initial suggested prompts
  clearChat() {
    // ask user to confirm
    const ok = confirm(
      'Are you sure you want to clear this conversation? This will remove the saved chat session.'
    );
    if (!ok) return;
    try {
      localStorage.removeItem('chat_id');
      this.chat.chatId = null;
    } catch (e) {}
    this.messages.set([]);
    // re-enable chat and reset suggestions
    this.chatAvailable.set(true);
  }

  // Send a suggested prompt (fills input and sends)
  useSuggestion(text: string) {
    this.input.set(text);
    // don't auto-send; user can edit and press Send
    // try to focus the input if available
    try {
      const el = document.querySelector('.input-row input') as HTMLInputElement | null;
      if (el) el.focus();
    } catch (e) {}
  }

  async send() {
    const text = this.input().trim();
    if (!text) return;
    // hide suggestions once the user sends a question
    this.showSuggestions.set(false);
    this.input.set('');
    this.messages.update((arr) => [...arr, { who: 'user', text }]);
    this.sending.set(true);
    try {
      // add an empty bot message and append chunks to it as they arrive
      this.messages.update((arr) => [
        ...arr,
        {
          who: 'bot',
          text: '',
          rendered: '',
          reasoning: '',
          renderedReasoning: '',
          reasoningVisible: false,
        },
      ]);
      const onChunk = (chunk: {
        type: 'reasoning' | 'answer' | 'chat_id' | 'other';
        text: string;
      }) => {
        this.messages.update((arr) => {
          const last = arr[arr.length - 1];
          if (!last || last.who !== 'bot') return arr;
          if (chunk.type === 'answer') {
            const newText = (last.text ?? '') + chunk.text;
            const parsed = marked.parse(newText || '') as string | Promise<string>;
            if (parsed && typeof (parsed as Promise<string>).then === 'function') {
              const p = parsed as Promise<string>;
              const updated = { ...last, text: newText, rendered: '' };
              p.then((html: string) => {
                this.messages.update((innerArr) => {
                  // find last bot message
                  for (let i = innerArr.length - 1; i >= 0; --i) {
                    if (innerArr[i].who === 'bot') {
                      const it = { ...innerArr[i], rendered: html };
                      return [...innerArr.slice(0, i), it, ...innerArr.slice(i + 1)];
                    }
                  }
                  return innerArr;
                });
              }).catch(() => {});
              return [...arr.slice(0, -1), updated];
            }
            const html = parsed as string;
            const updated = { ...last, text: newText, rendered: html };
            return [...arr.slice(0, -1), updated];
          }
          if (chunk.type === 'reasoning') {
            const newReason = (last.reasoning ?? '') + chunk.text;
            const rparsed = marked.parse(newReason || '') as string | Promise<string>;
            if (rparsed && typeof (rparsed as Promise<string>).then === 'function') {
              const p = rparsed as Promise<string>;
              const updated = { ...last, reasoning: newReason, renderedReasoning: '' };
              p.then((html: string) => {
                this.messages.update((innerArr) => {
                  for (let i = innerArr.length - 1; i >= 0; --i) {
                    if (innerArr[i].who === 'bot') {
                      const it = { ...innerArr[i], renderedReasoning: html };
                      return [...innerArr.slice(0, i), it, ...innerArr.slice(i + 1)];
                    }
                  }
                  return innerArr;
                });
              }).catch(() => {});
              return [...arr.slice(0, -1), updated];
            }
            const rhtml = rparsed as string;
            const updated = { ...last, reasoning: newReason, renderedReasoning: rhtml };
            return [...arr.slice(0, -1), updated];
          }
          // other/chat_id: ignore or append to answer
          const newText = (last.text ?? '') + chunk.text;
          const parsed = marked.parse(newText || '') as string | Promise<string>;
          if (parsed && typeof (parsed as Promise<string>).then === 'function') {
            const p = parsed as Promise<string>;
            const updated = { ...last, text: newText, rendered: '' };
            p.then((html: string) => {
              this.messages.update((innerArr) => {
                for (let i = innerArr.length - 1; i >= 0; --i) {
                  if (innerArr[i].who === 'bot') {
                    const it = { ...innerArr[i], rendered: html };
                    return [...innerArr.slice(0, i), it, ...innerArr.slice(i + 1)];
                  }
                }
                return innerArr;
              });
            }).catch(() => {});
            return [...arr.slice(0, -1), updated];
          }
          const html = parsed as string;
          const updated = { ...last, text: newText, rendered: html };
          return [...arr.slice(0, -1), updated];
        });
      };
      await this.chat.streamMessage(text, onChunk);
    } catch (e) {
      this.messages.update((arr) => [
        ...arr,
        { who: 'bot', text: 'Oops, failed to reach the API. Check CORS/HTTPS.' },
      ]);
    } finally {
      this.sending.set(false);
    }
  }

  toggleReasoning(index: number) {
    this.messages.update((arr) => {
      const m = arr[index];
      if (!m) return arr;
      const updated = { ...m, reasoningVisible: !m.reasoningVisible };
      return [...arr.slice(0, index), updated, ...arr.slice(index + 1)];
    });
  }
}
