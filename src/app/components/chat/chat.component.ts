import { Component, effect, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { ChatService } from './chat.service'

@Component({
selector: 'app-chat',
standalone: true,
imports: [CommonModule, FormsModule],
templateUrl: './chat.component.html',
styleUrls: ['./chat.component.scss'],
providers: [ChatService]
})
export class ChatComponent {
messages = signal<{ who: 'user'|'bot'; text: string }[]>([]);
input = signal('');
sending = signal(false);


constructor(public chat: ChatService) {}


async send() {
const text = this.input().trim();
if (!text) return;
this.input.set('');
this.messages.update(arr => [...arr, { who: 'user', text }]);
this.sending.set(true);
try {
const reply = await this.chat.sendMessage(text);
this.messages.update(arr => [...arr, { who: 'bot', text: reply }]);
} catch (e) {
this.messages.update(arr => [...arr, { who: 'bot', text: 'Oops, failed to reach the API. Check CORS/HTTPS.' }]);
} finally {
this.sending.set(false);
}
}
}