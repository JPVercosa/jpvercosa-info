import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';


@Injectable()
export class ChatService {
private http = inject(HttpClient);
private base = environment.apiBaseUrl.replace(/\/$/, '');
apiSendEndpoint = `${this.base}/chat/send`;
apiStreamEndpoint = `${this.base}/chat/stream`;


async sendMessage(message: string): Promise<string> {
// Simple POST JSON; backend should return { reply: string }
const res: any = await this.http.post(this.apiSendEndpoint, { message }, {
// withCredentials: true, // uncomment if using cookie sessions
}).toPromise();
return res?.reply ?? JSON.stringify(res ?? {});
}


streamMessage(message: string, onChunk: (text: string)=>void) {
// If your backend supports SSE, you can use this from the component
const url = `${this.apiStreamEndpoint}?q=${encodeURIComponent(message)}`;
const es = new EventSource(url, { withCredentials: true });
es.onmessage = (e) => onChunk(e.data);
es.onerror = () => es.close();
return es;
}
}