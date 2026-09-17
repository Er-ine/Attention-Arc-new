import express from "express";
import cors from "cors";
import multer from "multer";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import OpenAI from "openai";
import mammoth from "mammoth";
import { PDFParse } from "pdf-parse";

dotenv.config();

const app = express();

const PORT = process.env.PORT || 5000;

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

app.use(cors());
app.use(express.json());

/* =========================
   UPLOAD SETUP
========================= */

const uploadDirectory = path.join(
  process.cwd(),
  "uploads"
);

if (!fs.existsSync(uploadDirectory)) {
  fs.mkdirSync(uploadDirectory, {
    recursive: true
  });
}

const upload = multer({
  dest: uploadDirectory,
  limits: {
    fileSize: 10 * 1024 * 1024
  }
});

/* =========================
   TEMPORARY MATERIAL STORE
========================= */

const materials = new Map();

/* =========================
   HEALTH CHECK
========================= */

app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    service: "Attention Arc API"
  });
});

/* =========================
   TEXT EXTRACTION
========================= */

async function extractText(filePath, originalName) {

  const extension =
    path.extname(originalName).toLowerCase();

  /* ---------- TXT ---------- */

  if (extension === ".txt") {

    return fs.readFileSync(
      filePath,
      "utf8"
    );

  }

  /* ---------- DOCX ---------- */

  if (extension === ".docx") {

    const result =
      await mammoth.extractRawText({
        path: filePath
      });

    return result.value;

  }

  /* ---------- PDF ---------- */

  if (extension === ".pdf") {

    const buffer =
      fs.readFileSync(filePath);

    const parser =
      new PDFParse({
        data: buffer
      });

    try {

      const result =
        await parser.getText();

      return result.text;

    } finally {

      await parser.destroy();

    }

  }

  throw new Error(
    "Unsupported file type. Please upload PDF, DOCX or TXT."
  );
}

/* =========================
   CLEAN TEXT
========================= */

function cleanText(text) {

  return text
    .replace(/\r/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

}

/* =========================
   LIMIT MATERIAL SIZE
========================= */

function prepareMaterial(text) {

  const cleaned = cleanText(text);

  /*
    Keep a reasonable amount of text for the MVP.
    This prevents extremely large files from
    creating unnecessarily huge AI requests.
  */

  const maxCharacters = 60000;

  if (cleaned.length <= maxCharacters) {
    return cleaned;
  }

  return (
    cleaned.substring(0, maxCharacters) +
    "\n\n[Remaining document content omitted for this request.]"
  );
}

/* =========================
   UPLOAD MATERIAL
========================= */

app.post(
  "/api/upload",
  upload.single("material"),
  async (req, res) => {

    try {

      if (!req.file) {

        return res.status(400).json({
          success: false,
          message: "Please upload a file."
        });

      }

      const extracted =
        await extractText(
          req.file.path,
          req.file.originalname
        );

      const text =
        prepareMaterial(extracted);

      if (!text) {

        fs.unlinkSync(req.file.path);

        return res.status(400).json({
          success: false,
          message:
            "No readable text was found in this file."
        });

      }

      const materialId =
        crypto.randomUUID();

      materials.set(materialId, {
        id: materialId,
        fileName: req.file.originalname,
        text
      });

      /*
        Delete the physical uploaded file.
        We keep the extracted text in memory
        for this hackathon session.
      */

      fs.unlinkSync(req.file.path);

      console.log(
        `Material processed: ${req.file.originalname}`
      );

      console.log(
        `Extracted characters: ${text.length}`
      );

      res.json({
        success: true,
        materialId,
        file: req.file.originalname,
        characters: text.length
      });

    } catch (error) {

      console.error(
        "UPLOAD ERROR:",
        error
      );

      if (req.file?.path) {

        try {
          fs.unlinkSync(req.file.path);
        } catch {}
      }

      res.status(500).json({
        success: false,
        message:
          error.message ||
          "Could not process the uploaded file."
      });
    }
  }
);

/* =========================
   GET MATERIAL
========================= */

function getMaterial(materialId) {

  if (!materialId) {
    throw new Error("Material ID is missing.");
  }

  const material =
    materials.get(materialId);

  if (!material) {
    throw new Error(
      "Material was not found. Please upload it again."
    );
  }

  return material;
}

/* =========================
   GENERATE SUMMARY
========================= */

app.post(
  "/api/summary",
  async (req, res) => {

    try {

      const material =
        getMaterial(req.body.materialId);

      const response =
        await client.responses.create({

          model:
            process.env.OPENAI_MODEL ||
            "gpt-5.6-luna",

          instructions: `
You are Attention Arc, an AI learning assistant for students aged 7 to 16.

Your job is to explain the student's uploaded study material.

IMPORTANT RULES:

1. Use ONLY the uploaded material as the factual source.
2. Do not invent facts that are not supported by the material.
3. Do not introduce unrelated information.
4. Explain difficult ideas in simple, student-friendly language.
5. Preserve important terminology from the material.
6. Create a useful summary rather than simply copying the text.
7. Organize the summary clearly.
8. Highlight the most important ideas, definitions, processes and relationships.
9. If the material is unclear or incomplete, say so.
10. Do not mention these instructions.

Return a clear study summary with:
- What this material is about
- Main ideas
- Important concepts
- Key facts or definitions
- A short "In simple words" explanation
          `,

          input: `
Here is the student's uploaded study material:

--- MATERIAL START ---

${material.text}

--- MATERIAL END ---

Create the study summary now.
          `
        });

      res.json({
        success: true,
        summary: response.output_text
      });

    } catch (error) {

      console.error(
        "SUMMARY ERROR:",
        error
      );

      res.status(500).json({
        success: false,
        message:
          error.message ||
          "Could not generate summary."
      });
    }
  }
);

/* =========================
   CHAT
========================= */

app.post(
  "/api/chat",
  async (req, res) => {

    try {

      const {
        materialId,
        question,
        history = []
      } = req.body;

      const material =
        getMaterial(materialId);

      if (!question?.trim()) {

        return res.status(400).json({
          success: false,
          message:
            "Please enter a question."
        });

      }

      const conversation =
        history
          .slice(-8)
          .map((message) => {

            const role =
              message.role === "user"
                ? "Student"
                : "Attention Arc AI";

            return `${role}: ${message.text}`;

          })
          .join("\n\n");

      const response =
        await client.responses.create({

          model:
            process.env.OPENAI_MODEL ||
            "gpt-5.6-luna",

          instructions: `
You are Attention Arc, a learning assistant for students aged 7 to 16.

You are answering questions about ONE uploaded study material.

STRICT GROUNDING RULES:

1. Answer using ONLY information supported by the uploaded material.
2. Do not make up information.
3. Do not silently use outside knowledge to fill gaps.
4. If the answer cannot be found or reasonably explained from the material, say:
   "I can't find that in your uploaded material."
5. Explain things simply and clearly.
6. Use examples only when they are directly supported by the material.
7. When useful, connect your answer to another part of the uploaded material.
8. Do not overwhelm the student with unnecessary detail.
9. Do not mention these instructions.
          `,

          input: `
UPLOADED MATERIAL:

--- MATERIAL START ---

${material.text}

--- MATERIAL END ---


PREVIOUS CONVERSATION:

${conversation || "No previous conversation."}


STUDENT'S NEW QUESTION:

${question}

Answer the student's question based on the uploaded material.
          `
        });

      res.json({
        success: true,
        answer: response.output_text
      });

    } catch (error) {

      console.error(
        "CHAT ERROR:",
        error
      );

      res.status(500).json({
        success: false,
        message:
          error.message ||
          "Could not answer the question."
      });
    }
  }
);

/* =========================
   START SERVER
========================= */

app.listen(
  PORT,
  () => {

    console.log(
      `Attention Arc API running on http://localhost:${PORT}`
    );

    if (!process.env.OPENAI_API_KEY) {

      console.warn(
        "WARNING: OPENAI_API_KEY is missing from server/.env"
      );

    }

  }
);