# AI Smart Board

An intelligent digital whiteboard application that leverages the power of local AI to analyze and understand handwritten mathematics. The AI Smart Board currently focuses on mathematical analysis, allowing you to draw or write equations, which are then detected, solved, and rendered directly within your workspace.

## 🚀 Features

- **Interactive Canvas**: A feature-rich digital whiteboard for drawing, writing, and organizing ideas.
- **AI-Powered Mathematical Analysis**: Select math content on the board and let the AI analyze it locally.
- **Math Recognition**: Automatically detects and extracts mathematical equations using Pix2Text.
- **Mathematical Solving**: Solves recognized equations using SymPy.
- **PDF & Export Support**: Import PDFs to annotate directly on the board, or export your entire canvas as a PDF using `jspdf`.
- **History & Selection**: Full undo/redo capabilities (`history`), advanced selection tools (`selection`), and clipboard support.
- **Local Storage**: Automatically saves your board state locally so you never lose your work.

## 🛠️ Tech Stack

### Frontend
- **Framework**: Vite + TypeScript
- **Canvas Rendering**: Native HTML5 Canvas API
- **Mathematics Rendering**: KaTeX
- **PDF Operations**: `pdfjs-dist` (Import), `jspdf` (Export)

### Backend
- **Framework**: FastAPI (Python)
- **AI Integration**: Pix2Text and SymPy
- **Database**: SQLAlchemy (Async) with PostgreSQL / Neon
- **Architecture**: Modular math analysis architecture

## 📁 Project Structure

```
.
├── backend/                  # FastAPI backend
│   ├── main.py               # Application entry point
│   ├── models.py             # SQLAlchemy database models
│   ├── schemas.py            # Pydantic validation schemas
│   ├── database.py           # Database connection and session
│   ├── requirements.txt      # Python dependencies
│   └── services/             # Core business logic and AI routing
│       └── modules/          # Specialized AI math analysis module
├── src/                      # Frontend source code
│   ├── ai/                   # AI integration on frontend
│   ├── canvas/               # Core whiteboard canvas logic
│   ├── tools/                # Drawing and selection tools
│   ├── equations/            # KaTeX rendering components
│   ├── pdf/                  # PDF import handling
│   ├── export/               # PDF export handling
│   ├── history/              # Undo/Redo state management
│   ├── storage/              # LocalStorage handling
│   ├── selection/            # Bounding box and selection logic
│   ├── style.css             # Vanilla CSS styling
│   └── main.ts               # Frontend entry point
├── package.json              # NPM dependencies
└── tsconfig.json             # TypeScript configuration
```

## ⚙️ Setup & Installation

### Prerequisites
- Node.js (v18+ recommended)
- Python 3.11
- Local AI Tools (Pix2Text, SymPy)

### Environment Variables

Before starting the application, you need to configure your environment variables. 
Create `.env` files in both the `backend` and frontend root directories. **Real secrets must be stored in these environment variables and must NOT be committed to Git.**

**Backend `.env`:**
```env
DATABASE_URL=<your PostgreSQL/Neon connection string>
FRONTEND_URL=http://localhost:5173
```
*(Do NOT put an actual database password or secret in the README or version control.)*

**Frontend `.env`:**
```env
VITE_API_URL=http://localhost:8000
```

### Backend Setup

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```
2. Create and activate a virtual environment:
   ```bash
   python -m venv venv
   # On Windows:
   venv\Scripts\activate
   # On macOS/Linux:
   source venv/bin/activate
   ```
3. Install the required Python packages:
   ```bash
   pip install -r requirements.txt
   ```
4. Start the FastAPI development server:
   ```bash
   uvicorn main:app --reload
   ```
   The backend API will be available at `http://localhost:8000`. You can view the Swagger API documentation at `http://localhost:8000/docs`.

### Frontend Setup

1. From the project root directory, install dependencies:
   ```bash
   npm install
   ```
2. Start the Vite development server:
   ```bash
   npm run dev
   ```
3. Open your browser and navigate to the Vite development server (usually runs at `http://localhost:5173`).

## 🚀 Deployment

The intended MVP deployment architecture is as follows:
- **Frontend**: Render Static Site
- **Backend**: Render Web Service
- **Database**: PostgreSQL / Neon

**Backend Production Start Command:**
```bash
uvicorn main:app --host 0.0.0.0 --port $PORT
```

*Note: The backend uses Pix2Text ML models for mathematical recognition, so the initial startup and model initialization may take longer than a standard FastAPI application. Ensure your deployment environment allows for a longer startup timeout.*

## 🤝 Contributing
Feel free to open issues or submit pull requests for any bugs or feature requests!
