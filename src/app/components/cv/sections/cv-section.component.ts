import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'cv-section',
  standalone: true,
  templateUrl: './cv-section.component.html',
  styleUrls: ['./cv-section.component.scss'],
  imports: [CommonModule]
})
export class CvSectionComponent {
  @Input() title: string = '';
  @Input() items: any[] = [];
  @Input() type: string = 'default'; // e.g., 'experience', 'skills', etc.
  @Input() id: string = ''; // Unique identifier for anchor linking
}
