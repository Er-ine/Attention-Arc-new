import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  BrowserRouter,
  Routes,
  Route,
  Link,
  useNavigate
} from "react-router-dom";

import {
  Home,
  Upload,
  BookOpen,
  Brain,
  Users,
  Layers,
  User,
  ArrowRight,
  FileText,
  Send,
  Sparkles,
  CheckCircle
} from "lucide-react";

import "./styles.css";

const API = "http://localhost:5000";

/* =========================
   SIDEBAR
========================= */

function Sidebar() {
  return (
    <aside className="sidebar">

      <div className="brand">
        <div className="brand-mark">
          A
        </div>

        <div>
          <h2>Attention Arc</h2>
          <span>Learn your way.</span>
        </div>
      </div>

      <nav className="nav">

        <Link to="/">
          <Home size={18} />
          Home
        </Link>

        <Link to="/upload">
          <Upload size={18} />
          Study Material
        </Link>

        <Link to="/learn">
          <BookOpen size={18} />
          Understand
        </Link>

        <Link to="/quiz">
          <Brain size={18} />
          Quick Quiz
        </Link>

        <Link to="/diagnosis">
          <Brain size={18} />
          Learning Map
        </Link>

        <Link to="/mentors">
          <Users size={18} />
          Get Help
        </Link>

        <Link to="/flashcards">
          <Layers size={18} />
          Flashcards
        </Link>

      </nav>

      <div className="sidebar-bottom">

        <Link to="/profile">
          <User size={18} />
          My Profile
        </Link>

      </div>

    </aside>
  );
}

/* =========================
   LAYOUT
========================= */

function Layout({ children }) {
  return (
    <div className="app">

      <Sidebar />

      <main className="main">
        {children}
      </main>

    </div>
  );
}

/* =========================
   PAGE TITLE
========================= */

function PageTitle({
  label,
  title,
  text
}) {

  return (
    <div className="page-title">

      <span className="eyebrow">
        {label}
      </span>

      <h1>{title}</h1>

      <p>{text}</p>

    </div>
  );
}

/* =========================
   HOME
========================= */

function HomePage() {

  const navigate = useNavigate();

  return (
    <div className="page">

      <div className="topbar">

        <span>
          Good afternoon 👋
        </span>

        <div className="profile-circle">
          E
        </div>

      </div>

      <section className="hero">

        <div className="hero-content">

          <span className="eyebrow">
            YOUR LEARNING SPACE
          </span>

          <h1>
            Learn smarter.
            <br />
            Find what you need.
          </h1>

          <p>
            Upload your study material and let
            Attention Arc explain it, summarize it
            and help you understand it.
          </p>

          <button
            className="primary-btn"
            onClick={() =>
              navigate("/upload")
            }
          >
            Start learning
            <ArrowRight size={18} />
          </button>

        </div>

        <div className="hero-art">

          <Sparkles size={42} />

          <div className="hero-number">
            01
          </div>

          <p>
            Upload → Understand → Practice
          </p>

        </div>

      </section>

    </div>
  );
}

/* =========================
   UPLOAD
========================= */

function UploadPage() {

  const navigate = useNavigate();

  const [file, setFile] =
    useState(null);

  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState("");

  async function uploadMaterial() {

    if (!file) {

      setError(
        "Please choose a study material first."
      );

      return;
    }

    setLoading(true);
    setError("");

    const formData =
      new FormData();

    formData.append(
      "material",
      file
    );

    try {

      const response =
        await fetch(
          `${API}/api/upload`,
          {
            method: "POST",
            body: formData
          }
        );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.message ||
          "Upload failed."
        );
      }

      sessionStorage.setItem(
        "attentionArcMaterialId",
        data.materialId
      );

      sessionStorage.setItem(
        "attentionArcFileName",
        data.file
      );

      navigate("/learn");

    } catch (err) {

      console.error(err);

      setError(
        err.message ||
        "Could not process the file."
      );

    } finally {

      setLoading(false);

    }
  }

  return (
    <div className="page">

      <PageTitle
        label="STEP 01"
        title="Upload your study material."
        text="Your material becomes the foundation for everything Attention Arc explains to you."
      />

      <div className="upload-card">

        <div className="upload-icon">
          <Upload size={34} />
        </div>

        <h2>
          {file
            ? file.name
            : "Choose your material"}
        </h2>

        <p>
          PDF, DOCX or TXT files up to 10 MB.
        </p>

        <label className="secondary-btn">

          Choose file

          <input
            type="file"
            accept=".pdf,.docx,.txt"
            style={{
              display: "none"
            }}
            onChange={(event) => {

              const selected =
                event.target.files?.[0];

              if (selected) {
                setFile(selected);
                setError("");
              }

            }}
          />

        </label>

        {file && (

          <button
            className="primary-btn"
            onClick={uploadMaterial}
            disabled={loading}
          >

            {loading
              ? "Reading your material..."
              : "Understand this material"}

            {!loading && (
              <ArrowRight size={18} />
            )}

          </button>

        )}

        {error && (
          <p
            style={{
              color: "#b04b3a",
              marginTop: "18px"
            }}
          >
            {error}
          </p>
        )}

      </div>

    </div>
  );
}

/* =========================
   AI LEARNING PAGE
========================= */

function LearnPage() {

  const fileName =
    sessionStorage.getItem(
      "attentionArcFileName"
    ) ||
    "Uploaded material";

  const materialId =
    sessionStorage.getItem(
      "attentionArcMaterialId"
    );

  const [summary, setSummary] =
    useState("");

  const [summaryLoading, setSummaryLoading] =
    useState(true);

  const [question, setQuestion] =
    useState("");

  const [chatLoading, setChatLoading] =
    useState(false);

  const [error, setError] =
    useState("");

  const [messages, setMessages] =
    useState([
      {
        role: "ai",
        text:
          "I've read your material. Ask me anything about it."
      }
    ]);

  /* =========================
     AUTOMATIC SUMMARY
  ========================= */

  useEffect(() => {

    async function generateSummary() {

      if (!materialId) {

        setSummaryLoading(false);

        setError(
          "No uploaded material was found. Please upload a file again."
        );

        return;
      }

      try {

        const response =
          await fetch(
            `${API}/api/summary`,
            {
              method: "POST",
              headers: {
                "Content-Type":
                  "application/json"
              },
              body: JSON.stringify({
                materialId
              })
            }
          );

        const data =
          await response.json();

        if (!response.ok) {
          throw new Error(
            data.message ||
            "Summary generation failed."
          );
        }

        setSummary(
          data.summary
        );

      } catch (err) {

        console.error(err);

        setError(
          err.message ||
          "Could not generate the summary."
        );

      } finally {

        setSummaryLoading(false);

      }
    }

    generateSummary();

  }, [materialId]);

  /* =========================
     ASK AI
  ========================= */

  async function askAI() {

    if (
      !question.trim() ||
      chatLoading
    ) {
      return;
    }

    const currentQuestion =
      question.trim();

    setQuestion("");

    const history =
      messages.map((message) => ({
        role: message.role,
        text: message.text
      }));

    setMessages((previous) => [
      ...previous,
      {
        role: "user",
        text: currentQuestion
      }
    ]);

    setChatLoading(true);

    try {

      const response =
        await fetch(
          `${API}/api/chat`,
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json"
            },
            body: JSON.stringify({
              materialId,
              question:
                currentQuestion,
              history
            })
          }
        );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.message ||
          "The AI could not answer."
        );
      }

      setMessages((previous) => [
        ...previous,
        {
          role: "ai",
          text: data.answer
        }
      ]);

    } catch (err) {

      console.error(err);

      setMessages((previous) => [
        ...previous,
        {
          role: "ai",
          text:
            err.message ||
            "Something went wrong."
        }
      ]);

    } finally {

      setChatLoading(false);

    }
  }

  return (
    <div className="page">

      <PageTitle
        label="STEP 02"
        title="Understand your material."
        text="Your AI learning assistant has read the material you uploaded."
      />

      {error && (

        <div
          style={{
            padding: "14px 18px",
            marginBottom: "18px",
            background: "#fff0ed",
            borderRadius: "14px",
            color: "#a34839",
            fontSize: "13px"
          }}
        >
          {error}
        </div>

      )}

      <div className="learning-layout">

        {/* =================
            MATERIAL
        ================= */}

        <div className="material-panel">

          <div className="material-header">

            <div className="material-file-icon">
              <FileText size={23} />
            </div>

            <div>

              <span className="eyebrow">
                YOUR MATERIAL
              </span>

              <h3>
                {fileName}
              </h3>

            </div>

          </div>

          <div className="material-status">

            <CheckCircle size={16} />

            Material processed

          </div>

          <div className="summary-box">

            <span className="eyebrow">
              AI SUMMARY
            </span>

            {summaryLoading ? (

              <p>
                Reading your material and
                preparing a summary...
              </p>

            ) : (

              <p
                style={{
                  whiteSpace: "pre-wrap"
                }}
              >
                {summary ||
                  "No summary was generated."}
              </p>

            )}

          </div>

        </div>

        {/* =================
            CHAT
        ================= */}

        <div className="chat-panel">

          <div className="chat-header">

            <div className="ai-avatar">
              <Sparkles size={18} />
            </div>

            <div>

              <h3>
                Attention Arc AI
              </h3>

              <span>
                Ask questions about your material
              </span>

            </div>

          </div>

          <div className="chat-messages">

            {messages.map(
              (message, index) => (

                <div
                  key={index}
                  className={
                    message.role === "user"
                      ? "message user-message"
                      : "message ai-message"
                  }
                >

                  {message.role === "ai" && (

                    <div className="small-ai-icon">
                      <Sparkles size={13} />
                    </div>

                  )}

                  <p
                    style={{
                      whiteSpace: "pre-wrap"
                    }}
                  >
                    {message.text}
                  </p>

                </div>

              )
            )}

            {chatLoading && (

              <div className="message ai-message">

                <div className="small-ai-icon">
                  <Sparkles size={13} />
                </div>

                <p>
                  Thinking about your material...
                </p>

              </div>

            )}

          </div>

          <div className="chat-input">

            <input
              value={question}
              onChange={(event) =>
                setQuestion(
                  event.target.value
                )
              }
              onKeyDown={(event) => {

                if (
                  event.key === "Enter" &&
                  !event.shiftKey
                ) {
                  event.preventDefault();
                  askAI();
                }

              }}
              placeholder="Ask anything about your material..."
              disabled={chatLoading}
            />

            <button
              onClick={askAI}
              disabled={
                chatLoading ||
                !question.trim()
              }
            >
              <Send size={18} />
            </button>

          </div>

        </div>

      </div>

    </div>
  );
}

/* =========================
   OTHER PAGES
========================= */

function SimplePage({
  title,
  text
}) {

  return (
    <div className="page">

      <PageTitle
        label="NEXT STEP"
        title={title}
        text={text}
      />

    </div>
  );
}

/* =========================
   APP
========================= */

function App() {

  return (
    <Layout>

      <Routes>

        <Route
          path="/"
          element={<HomePage />}
        />

        <Route
          path="/upload"
          element={<UploadPage />}
        />

        <Route
          path="/learn"
          element={<LearnPage />}
        />

        <Route
          path="/quiz"
          element={
            <SimplePage
              title="Test your understanding."
              text="Your quiz will be generated from the material you uploaded."
            />
          }
        />

        <Route
          path="/diagnosis"
          element={
            <SimplePage
              title="Your learning map."
              text="Your answers will help identify the concepts you need to strengthen."
            />
          }
        />

        <Route
          path="/mentors"
          element={
            <SimplePage
              title="Get focused help."
              text="Find support based on your learning gaps."
            />
          }
        />

        <Route
          path="/flashcards"
          element={
            <SimplePage
              title="Your flashcards."
              text="Review the concepts you need to remember."
            />
          }
        />

        <Route
          path="/profile"
          element={
            <SimplePage
              title="My learning profile."
              text="Track your progress here."
            />
          }
        />

      </Routes>

    </Layout>
  );
}

/* =========================
   START
========================= */

createRoot(document.getElementById("root")).render(
  <BrowserRouter>
    <App />
  </BrowserRouter>
);