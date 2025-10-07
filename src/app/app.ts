import { Component } from '@angular/core';
import { ChatComponent } from './components/chat/chat.component';
import { CvComponent } from './components/cv/cv.component';
import { ViewportScroller } from '@angular/common';


@Component({
selector: 'app-root',
standalone: true,
imports: [ChatComponent, CvComponent],
templateUrl: './app.html',
styleUrls: ['./app.scss']
})
export class AppComponent {
  constructor(private viewportScroller: ViewportScroller) {
    viewportScroller.setOffset([0, 88]); // Offset matches header height
  }
}