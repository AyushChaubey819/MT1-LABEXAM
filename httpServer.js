import http from "http";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const PORT = 3000;
const MAX_BODY_SIZE = 1024 * 1024; // 1 MB

// __dirname is not available in ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const INDEX_FILE = path.join(__dirname, "public", "index.html");

// In-memory task store (no database)
const tasks = [
  { id: 1, taskName: "Develop Login Page", assignedTo: "Rahul Sharma", status: "Pending" },
  { id: 2, taskName: "Design Database Schema", assignedTo: "Priya Singh", status: "In Progress" },
  { id: 3, taskName: "Write Unit Tests", assignedTo: "Neha Verma", status: "Completed" }
];

const REQUIRED_FIELDS = ["id", "taskName", "assignedTo", "status"];

const sendJson = (res, statusCode, payload) => {
  res.writeHead(statusCode, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload, null, 2));
};

const sendHtml = (res, statusCode, html) => {
  res.writeHead(statusCode, { "Content-Type": "text/html; charset=utf-8" });
  res.end(html);
};

const pageTemplate = (title, body) => `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
  <style>
    body { font-family: "Segoe UI", Arial, sans-serif; background: #f3f5fb; color: #1f2937;
           display: flex; justify-content: center; padding: 3rem 1rem; }
    .box { background: #fff; max-width: 640px; width: 100%; padding: 2rem; border-radius: 12px;
           box-shadow: 0 4px 14px rgba(0,0,0,0.08); }
    h1 { color: #4f46e5; margin-bottom: 0.75rem; }
    li { margin: 0.35rem 0; }
    a { color: #4f46e5; }
  </style>
</head>
<body><div class="box">${body}</div></body>
</html>`;

// Reads the full request body with a size limit
const readRequestBody = (req) =>
  new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > MAX_BODY_SIZE) {
        reject(new Error("PAYLOAD_TOO_LARGE"));
        req.destroy();
      }
    });
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });

// Returns an error message string, or null when the task is valid
const validateTask = (task) => {
  if (task === null || typeof task !== "object" || Array.isArray(task)) {
    return "Request body must be a JSON object";
  }

  const missing = REQUIRED_FIELDS.filter(
    (field) => task[field] === undefined || task[field] === null || task[field] === ""
  );
  if (missing.length > 0) {
    return `Missing required field(s): ${missing.join(", ")}`;
  }

  if (!Number.isInteger(task.id) || task.id <= 0) {
    return "id must be a positive integer";
  }
  for (const field of ["taskName", "assignedTo", "status"]) {
    if (typeof task[field] !== "string" || task[field].trim() === "") {
      return `${field} must be a non-empty string`;
    }
  }
  return null;
};

const handleAddTask = async (req, res) => {
  let rawBody;
  try {
    rawBody = await readRequestBody(req);
  } catch (error) {
    if (error.message === "PAYLOAD_TOO_LARGE") {
      return sendJson(res, 413, { error: "Request body too large" });
    }
    return sendJson(res, 400, { error: "Unable to read request body" });
  }

  let task;
  try {
    task = JSON.parse(rawBody);
  } catch {
    return sendJson(res, 400, { error: "Invalid JSON format in request body" });
  }

  const validationError = validateTask(task);
  if (validationError) {
    return sendJson(res, 400, { error: validationError });
  }

  if (tasks.some((existing) => existing.id === task.id)) {
    return sendJson(res, 409, { error: `Task with id ${task.id} already exists` });
  }

  const newTask = {
    id: task.id,
    taskName: task.taskName.trim(),
    assignedTo: task.assignedTo.trim(),
    status: task.status.trim()
  };
  tasks.push(newTask);

  return sendJson(res, 201, { message: "Task added successfully", task: newTask });
};

// A4: serve public/index.html using the FS module
const handleHome = (res) => {
  fs.readFile(INDEX_FILE, "utf8", (error, content) => {
    if (error) {
      console.error("File read error:", error.message);
      const status = error.code === "ENOENT" ? 404 : 500;
      const message = status === 404 ? "Requested page file not found" : "Unable to read page file";
      return sendHtml(res, status, pageTemplate("Error", `<h1>${status}</h1><p>${message}.</p>`));
    }
    return sendHtml(res, 200, content);
  });
};

const server = http.createServer(async (req, res) => {
  const { pathname } = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  const { method } = req;

  try {
    // A2: routing
    if (pathname === "/") {
      if (method !== "GET") return sendJson(res, 405, { error: `Method ${method} not allowed on /` });
      return sendHtml(
        res,
        200,
        pageTemplate(
          "Welcome",
          `<h1>Welcome to Employee Task Management</h1>
           <p>This page is served by the Node.js built-in HTTP module.</p>
           <ul>
             <li><a href="/tasks">/tasks</a> - all tasks (JSON)</li>
             <li><a href="/about">/about</a> - application information</li>
             <li><a href="/home">/home</a> - task dashboard (served using FS)</li>
           </ul>`
        )
      );
    }

    if (pathname === "/tasks") {
      if (method !== "GET") return sendJson(res, 405, { error: `Method ${method} not allowed on /tasks` });
      return sendJson(res, 200, tasks);
    }

    if (pathname === "/about") {
      if (method !== "GET") return sendJson(res, 405, { error: `Method ${method} not allowed on /about` });
      return sendHtml(
        res,
        200,
        pageTemplate(
          "About",
          `<h1>About This Application</h1>
           <p>The Employee Task Management application lets you view and add employee tasks.</p>
           <ul>
             <li><strong>Server:</strong> Node.js built-in <code>http</code> module (no Express)</li>
             <li><strong>Static files:</strong> Node.js <code>fs</code> module</li>
             <li><strong>Storage:</strong> In-memory JavaScript array (no database)</li>
             <li><strong>Port:</strong> ${PORT}</li>
           </ul>
           <p><a href="/">Back to home</a></p>`
        )
      );
    }

    if (pathname === "/home") {
      if (method !== "GET") return sendJson(res, 405, { error: `Method ${method} not allowed on /home` });
      return handleHome(res);
    }

    // A3: POST /add-task
    if (pathname === "/add-task") {
      if (method !== "POST") return sendJson(res, 405, { error: `Method ${method} not allowed on /add-task. Use POST` });
      return await handleAddTask(req, res);
    }

    // A5: invalid route
    return sendJson(res, 404, { error: "Route not found", path: pathname });
  } catch (error) {
    console.error("Unexpected server error:", error);
    return sendJson(res, 500, { error: "Internal server error" });
  }
});

// A1: listen on port 3000
server.listen(PORT, () => {
  console.log(`HTTP Server running at http://localhost:${PORT}`);
});