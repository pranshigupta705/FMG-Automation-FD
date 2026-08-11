Markdown
# FMG QA Dashboard

A modern, high-performance React dashboard designed to manage, monitor, and visualize the FMG QA Automation process. This frontend provides an intuitive user interface to interact with the QA engine, handle bulk evaluations, and analyze conversation metrics in real-time.

---

## 🚀 Tech Stack

*   **Core:** React.js (v18+)
*   **State Management & API:** Redux Toolkit / RTK Query (`apiSlice`)
*   **Routing:** React Router DOM
*   **Styling:** [Insert your UI library, e.g., Tailwind CSS / Material-UI]
*   **Build Tool:** [Vite / Create React App]

---

## 📂 Project Structure

A quick overview of the modular, feature-based directory structure:

```text
src/
├── components/       # Reusable, modular UI components (Buttons, Modals, Tables)
├── services/         # External integrations and helper logic
├── store/            # Redux store configuration and RTK Query endpoints
│   └── apiSlice.js   # Centralized API definitions for backend communication
├── App.jsx           # Root application component and routing logic
├── main.jsx          # React DOM mounting point
└── assets/           # Static files (images, icons, global stylesheets)
⚙️ Prerequisites
Before you begin, ensure you have met the following requirements:

Node.js: v16.0.0 or higher

Package Manager: npm or yarn

Backend Application: Ensure the fmg-qa-automation-backend server is running locally or deployed.

🛠️ Local Development Setup
Clone the repository

Bash
git clone [https://github.com/your-username/fmg-qa-dashboard.git](https://github.com/your-username/fmg-qa-dashboard.git)
cd fmg-qa-dashboard
Install dependencies

Bash
npm install
Configure Environment Variables
Create a .env file in the root directory and add the required variables. Use .env.example as a reference.

Code snippet
VITE_API_BASE_URL=http://localhost:3000/api  # Replace with your backend URL
Start the development server

Bash
npm run dev
The application will typically be available at http://localhost:5173 (if using Vite) or http://localhost:3000.

📜 Available Scripts
In the project directory, you can run:

Command	Description
npm run dev	Runs the app in the development mode.
npm run build	Builds the app for production to the dist or build folder.
npm run lint	Lints the codebase for stylistic and programmatic errors.
npm run preview	Serves the production build locally for testing.
🚀 Deployment (Production)
This project is optimized for modern hosting platforms like Vercel, Netlify, or AWS Amplify.

To create a production build manually:

Ensure your .env.production file has the correct live backend URL.

Run the build command:

Bash
npm run build
Deploy the generated dist (or build) directory to your static hosting provider.

🤝 Contributing
Create a Feature Branch (git checkout -b feature/amazing-feature)

Commit your Changes (git commit -m 'Add some amazing feature')

Push to the Branch (git push origin feature/amazing-feature)

Open a Pull Request
