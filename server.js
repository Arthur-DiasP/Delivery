import express from "express";
import path from "path";
import { fileURLToPath } from "url";

const app = express();
const PORT = process.env.PORT || 3000;

// Corrigir __dirname no ESModules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Servir todos os arquivos estáticos da raiz do projeto
app.use(express.static(__dirname));

// Rota para a página inicial (index.html)
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

// Roteamento automático para qualquer .html da raiz
// Exemplo: /login → login.html, /cadastro → cadastro.html
app.get("/:page", (req, res, next) => {
  const filePath = path.join(__dirname, `${req.params.page}.html`);
  res.sendFile(filePath, (err) => {
    if (err) next(); // Se não encontrar, passa para o 404
  });
});

// Middleware para tratar 404 (página não encontrada)
app.use((req, res) => {
  res.status(404).send("<h1>404 - Página não encontrada</h1>");
});

// Iniciar o servidor
app.listen(PORT, () => {
  console.log(`🚀 Servidor rodando em http://localhost:${PORT}`);
});
