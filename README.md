# ClassBuddy - Your Offline-First Schedule Assistant

ClassBuddy is a smart, simple, and offline-first web application designed to help students manage their class schedules with ease. It features a bilingual chatbot, proactive notifications, and integrated task management, all wrapped in a clean, modern, and responsive UI.

<!-- A screenshot of the application will be placed here -->
<!-- ![ClassBuddy Screenshot](screenshot.png) -->

## ✨ Key Features (v1.5.2)

- **Full Schedule Management**: Easily view your weekly schedule or a timeline for the current day.
- **Edit On-the-Go**: A simple form allows you to add, remove, or modify classes. Your data is saved automatically.
- **100% Offline Capable**: Thanks to a robust Service Worker, ClassBuddy works perfectly even without an internet connection. Your schedule is always available.
- **Smart Bilingual Chatbot**: Ask "Buddy" questions about your schedule in English or Thai (e.g., "What's my next class?" or "พรุ่งนี้มีเรียนอะไรบ้าง?").
- **Integrated Task Management**: Attach to-do lists to each class. See pending tasks at a glance with badges.
- **Settings Panel**: A centralized modal to control app settings.
  - **Theme Toggle**: Manually switch between Light and Dark modes.
  - **Proactive Notifications**: Enable/disable system notifications that remind you 10 minutes before your next class starts.
  - **Data Import/Export**: Backup your schedule to a file and import it on another device or browser.
- **Responsive & Modern Design**: A clean UI built with Tailwind CSS that looks great on both desktop and mobile devices.
- **PWA Ready**: Can be installed on your home screen for an app-like experience.

## 🚀 Tech Stack

- **Frontend**: HTML5, CSS3, Vanilla JavaScript (ES6+)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/)
- **Offline Storage**: Service Worker API & `localStorage`
- **PWA**: Web App Manifest

## 🔧 Getting Started

Since ClassBuddy is a zero-dependency, pure client-side application, you can run it by simply opening the `index.html` file in your browser.

### Deployment

This app is ready for static deployment. You can deploy it to services like:
- GitHub Pages
- Netlify
- Vercel
- Any static web host

Just upload all the files (`index.html`, `sw.js`, `manifest.json`, `icon.svg`) to the root of your hosting provider.

[https://timeless-sparks-643169459645.us-west1.run.app/
](https://classbud.netlify.app)
---
Made with ❤️ by [Win](https://github.com/wiqnnc)
