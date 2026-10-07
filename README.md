# CODE//ZEAL - Online Coding Assessment Platform

CODE//ZEAL is a modern, lightweight, and highly polished online coding test platform built specifically for conducting secure, proctored coding assessments. The current implementation is designed for the S.Y. B.Tech AI&DS Unit II Online Coding Test.

The platform is split into two primary experiences: a real-time **Student Exam Workspace** and a comprehensive **Faculty Administration Portal**.

## 🚀 Features & Implementation

### Student Portal (Exam Workspace)
* **Real-time Access Control:** Students request access by providing their Name, Roll No, and Division. They are placed in a waiting room until approved live by a faculty member.
* **Dynamic Question Allocation:** Upon approval, students are assigned a randomized subset of questions (e.g., 3 random questions out of a bank of 9) to prevent cheating.
* **Integrated IDE:** Features a fully integrated code editor powered by **Monaco Editor** (the engine behind VS Code) and a terminal output window via **XTerm.js**.
* **Live Code Execution:** Students can write, compile, and run their code (currently C++) directly in the browser against hidden test cases. Code execution is powered securely via the **Piston API**.
* **Integrity Tracking:** The platform tracks window switching, copy-pasting, and other potential integrity violations, reporting them directly to the faculty.

### Faculty Portal (Admin Dashboard)
* **Live Dashboard:** Faculty can monitor active students in real-time, view their remaining time, track integrity warnings, and approve/reject incoming access requests instantly.
* **Question Bank Management:** Full CRUD interface for managing coding questions, descriptions, constraints, and defining hidden test cases (input/expected output/marks).
* **Test & Branch Management:** Organize tests by branches, divisions, and set specific durations.
* **Detailed Results:** Post-exam, faculty can review every student's submitted code, execution results, total marks, and any flagged integrity warnings.
* **Secure Registration:** Faculty signup is strictly restricted to verified organization emails (e.g., `@zealeducation.com`).

### 🎨 Design System
The entire platform is built on an **Editorial Light Mode UI** inspired by Anthropic's Claude. It completely avoids generic dashboards in favor of:
* A warm, humanist tinted cream canvas (`#faf9f5`) and soft surfaces.
* Warm coral (`#cc785c`) primary action buttons.
* Premium typography utilizing `Copernicus` / `Tiempos Headline` for headings, `Söhne` for body text, and `Söhne Mono` for code and terminal interfaces.
* Highly coordinated micro-interactions, custom dropdowns, and standardized focus states across all inputs.

## 🛠️ Technology Stack
* **Framework:** [Next.js](https://nextjs.org/) (App Router, React 18)
* **Database & ORM:** [Prisma](https://www.prisma.io/) with SQLite
* **Styling:** Vanilla CSS (Global variables) + Tailwind CSS
* **Editor & Terminal:** `@monaco-editor/react`, `xterm`
* **Code Execution:** [Piston API](https://github.com/engineer-man/piston)
* **Authentication:** Custom JWT-based authentication
* **Real-time State:** Automated polling and React hooks

## 🔄 General Workflow

1. **Setup & Initialization:**
   - Faculty navigates to `/admin/signup` and registers using an authorized `@zealeducation.com` email address.
   - Faculty logs in to the **Faculty Portal** (`/admin/login`).
   - Faculty navigates to the **Questions** tab to populate the question bank and configure test cases.
   
2. **Exam Execution:**
   - Students navigate to the root URL (`/`).
   - Student enters their details (Name, Roll No, Division) and clicks **Request Access**.
   - Faculty views the live request on the **Faculty Dashboard** and clicks **Approve**.
   - The student's screen automatically transitions into the Exam Workspace.
   
3. **Coding & Submission:**
   - The student reads the assigned questions, writes their C++ code in the Monaco editor, and uses the **Run Code** button to execute it against test cases.
   - Once satisfied (or when time runs out), the student clicks **Submit Exam**.
   
4. **Evaluation:**
   - Faculty navigates to the **Results** tab to view the final scores, review the code written by each student, and check for any integrity warnings.

## 💻 Getting Started (Local Development)

First, install the dependencies:
```bash
npm install
```

Generate the Prisma client and push the schema to your local SQLite database:
```bash
npx prisma generate
npx prisma db push
```

Run the development server:
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the student portal, or [http://localhost:3000/admin/login](http://localhost:3000/admin/login) for the faculty portal.
