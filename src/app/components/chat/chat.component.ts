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
  // API health status: true = healthy, false = unhealthy/null when unknown
  apiHealthy = signal<boolean | null>(null);
  suggestions = [
    "Summarize João Pedro's CV in one sentence",
    "What are João Pedro's top skills based on the CV?",
    'What is this website about?',
    'How can I contact João Pedro?',
  ];
  showSuggestions = signal(true);

  constructor(public chat: ChatService) {}

  // Load chat history on component initialization
  async ngOnInit() {
    // 1) one-time health check
    const healthy = await this.chat.healthCheck();
    this.apiHealthy.set(healthy);

    if (!healthy) {
      this.chatAvailable.set(false);
      const parsed = marked.parse(
        'Service is currently unavailable. Please contact me to restore access.'
      ) as string | Promise<string>;
      const rendered = await Promise.resolve(parsed);
      this.messages.update((arr) => [
        ...arr,
        {
          who: 'bot',
          text: 'Service is currently unavailable. Please contact me to restore access.',
          rendered,
        },
      ]);
      return;
    }

    // 2) healthy: if we have a chatId already, try to restore conversation
    if (this.chat.chatId) {
      try {
        const data = await this.chat.fetchChatHistory();
        if (!data || !data.messages) return;

        const ui: any[] = [];
        let pendingReasoning = '';

        for (const m of data.messages) {
          const role = m.role; // 'user' | 'assistant' | 'reasoning'
          const content = m.content ?? '';
          const message_type = m.message_type; // 'normal' | 'reasoning'

          if (message_type === 'reasoning' || role === 'reasoning') {
            pendingReasoning += content;
            continue;
          }

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
            const parsed = marked.parse(content || '') as string | Promise<string>;
            const rendered = await Promise.resolve(parsed);
            ui.push({ who: 'user', text: content, rendered });
          }
        }

        this.messages.set(ui);
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
      // healthy and no chat id -> allow user to start a new chat
      this.showSuggestions.set(true);
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

    // Parse the user's message to set the rendered property
    const rendered = marked.parse(text) as string | Promise<string>;
    const resolvedRendered = await Promise.resolve(rendered);

    this.messages.update((arr) => [...arr, { who: 'user', text, rendered: resolvedRendered }]);

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
          // open reasoning by default for streaming responses
          reasoningVisible: true,
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
    } catch (e: any) {
      // Show a dedicated backend-down message if the API failed or stream died.
      await this.showBackendDownMessage();
    } finally {
      this.sending.set(false);
      // auto-close the reasoning of the last bot message shortly after streaming ends
      setTimeout(() => {
        this.messages.update((arr) => {
          if (arr.length === 0) return arr;
          const lastIndex = arr.length - 1;
          const last = arr[lastIndex];
          if (!last || last.who !== 'bot') return arr;
          // only auto-close if there is reasoning content and it's currently visible
          if (last.reasoning && last.reasoningVisible) {
            const updated = { ...last, reasoningVisible: false };
            return [...arr.slice(0, lastIndex), updated];
          }
          return arr;
        });
      }, 1500);
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

  private async showBackendDownMessage() {
    this.apiHealthy.set(false);
    this.chatAvailable.set(false);

    const markdown = [
      '**The chat backend became unavailable.**',
      '',
      'Please reload the page to re-check API status.',
    ].join('\n');

    const parsed = marked.parse(markdown) as string | Promise<string>;
    const rendered = await Promise.resolve(parsed);

    // If the last message is the placeholder bot bubble we created for streaming,
    // replace it with the error message; otherwise, append a new one.
    this.messages.update((arr) => {
      const last = arr[arr.length - 1];
      const errorMsg = { who: 'bot' as const, text: markdown, rendered };
      if (last && last.who === 'bot' && !last.text && !last.rendered) {
        // replace empty placeholder
        return [...arr.slice(0, -1), errorMsg];
      }
      return [...arr, errorMsg];
    });
  }
}
