import { Component } from '@angular/core';
import { CvSectionComponent } from './sections/cv-section.component';

@Component({
  selector: 'app-cv',
  standalone: true,
  templateUrl: './cv.component.html',
  styleUrls: ['./cv.component.scss'],
  imports: [CvSectionComponent],
})
export class CvComponent {
  experienceItems = [
    {
      role: 'Artificial Intelligence Consultant & Full-Stack Developer',
      company: 'Capgemini',
      period: 'Sep, 2024 – Present',
      details: [
        'Engineered a secure RAG-powered chat system using Azure OpenAI, enabling 8+ teams to access GPT models internally; improved prompt reliability by 80% and ensured data-policy compliance.',
        'Designed and deployed a full-stack productivity app (Flask + Angular) used by 700+ employees and 8 projects increasing task efficiency by 75%.',
        'Led and mentored 8 junior developers, achieving a 60% reduction in processing time and 25% higher system maintainability for internal tools.',
        'Built a Python ORM centralization package to streamline database integration and eliminate code duplication, used in 10+ microservices.',
        'Delivered a recommendation system (scikit-learn, XGBoost) improving product relevance by 76%.',
      ],
    },
    {
      role: 'Scientific Researcher in Artificial Intelligence & Data Scientist',
      company: 'Laboratory of Intelligence and Applied Robotics (LIRA)',
      period: 'Apr, 2023 – Sep, 2024',
      details: [
        'Developed custom BERT and Llama-3 based NLP models for the Rio de Janeiro State Court (TJRJ), increasing pre-trial agreements by 35% through an AI-assisted dispute-resolution platform.',
        'Created an end-to-end ML pipeline (ZenML) for model training, evaluation, and deployment with datasets exceeding 500K entries.',
        'Designed 6 NLP preprocessing routines, a labeled dataset, and ensemble models (Random Forest, Support Vector Machines, Catboost) reaching top-tier classification performance.',
        'Applied Fuzzy String Matching to connect disjoint legal databases, enhancing retrieval accuracy.',
      ],
    },
    {
      role: 'Web Development & QA Automation Tester',
      company: 'Driven',
      period: 'Mar, 2021 – Dec, 2023',
      details: [
        'Developed 150+ interactive logic exercises for data-structure learning platform.',
        'Implemented 50+ automated QA tests (Cypress, Puppeteer, Docker) ensuring high software reliability.',
        'Supported front-end and back-end improvements in a fast-paced startup environment (JavaScript, TypeScript, Node.js, HTML, CSS).',
      ],
    },
  ];

  skillsItems = [
    { category: 'AI & ML', skills: 'GenAI, NLP, LLMs, RAG, MLOps, Fine‑Tuning, XAI' },
    {
      category: 'Data Science',
      skills: 'Python, Pandas, scikit‑learn, RF, SVM, XGBoost, ZenML, SQLAlchemy',
    },
    {
      category: 'Software Engineering',
      skills: 'Flask, Angular, REST APIs, Docker, Git, Azure, Full‑Stack',
    },
  ];
  educationItems = [
    'Master’s in Decision Support Methods (Explainable AI) — PUC‑Rio (2024 – Present)',
    'Bachelor’s in Computer Engineering — PUC‑Rio (2017 – 2023)',
  ];
  publicationsItems = [
    'Extracting Legal Decisions from Portuguese Texts with Language Models — IJCNN 2025',
    'Learning to Race: Evolutionary Algorithms & RL — 2024',
    'ICMS Revenue Forecasting Models — 2023',
    'Improving CNN Training with Artificial Samples — UNIGOU 2023',
    'Brazilian Traffic Sign Detection using CNNs — DOI: 10.17771/PUCRio.acad.63984',
  ];
  contactItems = [
    'Email: jpkqvercosa@hotmail.com',
    'LinkedIn: /in/jpvercosa',
    'Phones: +33 07 59 87 45 83 · +55 (21) 99289‑2626',
  ];
  languagesItems = [
    { flag: 'br', name: 'Portuguese', level: 'Native', visual: 5 },
    { flag: 'gb', name: 'English', level: 'Professional', visual: 4 },
    { flag: 'fr', name: 'French', level: 'Advanced', visual: 3 },
    { flag: 'es', name: 'Spanish', level: 'Beginner', visual: 1 },
  ];
  coursesItems = [
    'TCF Tout Public – Global C1 / Oral B1 / Writing B1, 2025',
    'Microsoft Certified: Azure AI Fundamentals, Microsoft, 2024',
    'Data Science in Practice Course, VAI Academy, 2023',
    'Udemy Courses: The Web Developer Bootcamp 2022 (Colt Steele, 2022), Docker and Kubernetes: The Complete Guide (Stephen Grider, 2022)',
    'Extension Course “IA I – Artificial Intelligence I”, PUC-Rio, 2020',
    'Academic Outstanding Certificate in Introduction to Engineering, PUC-Rio, 2017',
    'Academic Student of the Week, UCSB Campus Exchange Program, 2015',
  ];
}
