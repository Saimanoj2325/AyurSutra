# 🌿 AyurSutra: Modern Ayurvedic & Panchakarma Management System

<div align="center">
  <img src="https://img.shields.io/badge/Status-Completed-success?style=for-the-badge" alt="Status" />
  <img src="https://img.shields.io/badge/Frontend-React_18_%7C_Vite-61DAFB?style=for-the-badge&logo=react&logoColor=black" alt="Frontend" />
  <img src="https://img.shields.io/badge/Backend-FastAPI_%7C_Python-009688?style=for-the-badge&logo=fastapi&logoColor=white" alt="Backend" />
  <img src="https://img.shields.io/badge/Database-Firebase_Firestore-FFCA28?style=for-the-badge&logo=firebase&logoColor=black" alt="Database" />
  <img src="https://img.shields.io/badge/AI-Custom_RAG_%7C_OpenAI-412991?style=for-the-badge&logo=openai&logoColor=white" alt="AI" />
</div>

<br />

AyurSutra is a comprehensive, end-to-end full-stack SaaS platform designed specifically for Ayurvedic clinics and wellness centers. It bridges the gap between traditional holistic medicine and modern digital healthcare, providing a seamless experience for both practitioners and patients undergoing intensive therapies like Panchakarma. 

## 💡 The Value Proposition

Managing traditional Ayurvedic treatments often involves complex, multi-day therapy schedules, strict dietary regimens, and continuous patient monitoring. **AyurSutra digitalizes and automates this workflow.** 

By offering role-based portals, real-time therapy tracking, and a context-aware AI wellness assistant, AyurSutra empowers practitioners to deliver highly personalized care at scale while ensuring patients remain engaged and compliant throughout their healing journey.

## ✨ Core Features

### 👨‍⚕️ For Practitioners (Clinical Operations)
* **Intelligent Dashboard**: Real-time overview of active treatments, daily schedules, and prioritized patient alerts.
* **Patient Management**: Deep insights into patient profiles, dosha analysis, vital signs, and historical medical reports.
* **Analytics & Outcomes**: Visual progress tracking and treatment efficacy analytics using automated data visualization (Recharts).
* **Clinical Notes & Tasks**: Secure documentation of session notes and automated clinical task reminders.

### 🧘‍♀️ For Patients (Wellness Journey)
* **Personalized Dashboard**: A calming, intuitive interface showing current treatment phase, daily goals, and upcoming therapies.
* **Smart Scheduling**: Seamless booking, rescheduling, and management of therapy sessions.
* **Progress Visualization**: Interactive tracking of symptoms, mood, and overall wellness improvements over the course of the treatment.
* **AyurBot (RAG AI Assistant)**: A highly specialized, context-aware AI chatbot trained on Ayurvedic literature. AyurBot knows the patient's dosha, current therapy, and treatment day, providing highly relevant dietary and lifestyle advice instantly.

## 🛠️ Technical Architecture

AyurSutra is built with a modern, scalable, and fully decoupled architecture. 

### Frontend (Client-Side)
* **Framework**: React 18 with Vite for lightning-fast HMR and optimized builds.
* **Styling**: Tailwind CSS v4 for a highly custom, responsive, and aesthetic UI focusing on modern "glassmorphism" and nature-inspired themes.
* **State & Data**: Custom React Hooks pattern for real-time Firebase data synchronization.
* **Components**: Radix UI primitives and Lucide React icons for accessible, premium interfaces.

### Backend (Server-Side)
* **Framework**: FastAPI (Python 3) for high-performance, asynchronous REST API endpoints.
* **AI & RAG Engine**: 
  * Custom Information Retrieval system using `scikit-learn` TF-IDF vectorization and cosine similarity.
  * Integration with OpenAI LLMs to generate conversational responses grounded in retrieved Ayurvedic texts.
  * Context-injection pipeline that feeds the patient's real-time medical state into the prompt.
* **Security**: Granular CORS middleware and route protection.

### Infrastructure & Database
* **Database**: Firebase Firestore (NoSQL) for real-time data persistence and document storage.
* **Authentication**: Firebase Auth for secure, role-based access control (RBAC).

## 🚀 Installation & Local Development

The project is fully complete and ready to run locally.

### 1. Clone the Repository
```bash
git clone https://github.com/yourusername/ayursutra.git
cd ayursutra
```

### 2. Setup the Backend (FastAPI)
```bash
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt

# Start the server (Runs on http://localhost:8000)
python -m uvicorn main:app --reload
```

### 3. Setup the Frontend (React + Vite)
```bash
cd frontend
npm install

# Start the development server (Runs on http://localhost:5000)
npm run dev
```

## 🧠 The AyurBot RAG Implementation

What sets AyurSutra apart is its custom Retrieval-Augmented Generation (RAG) implementation. Instead of relying on expensive third-party vector databases for a static corpus, AyurSutra implements an optimized, in-memory `TFIDFRetriever` using `numpy`. 

When a patient asks a question:
1. The query is vectorized.
2. Cosine similarity is computed against a curated library of Ayurvedic texts.
3. The top relevant context is extracted.
4. The patient's live data (Dosha, Treatment Day) is injected.
5. The LLM synthesizes a highly personalized, medically accurate response, complete with source citations.

---
<p align="center">
  <i>Built with passion for the intersection of traditional wellness and modern technology.</i>
</p>
