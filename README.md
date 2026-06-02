# PrintScream: saindo da CLI e virando um app Electron

Este README foi escrito em cima do projeto que voce ja tem hoje.

Hoje a sua base faz isso:

- recebe uma `URL` pela linha de comando
- abre a pagina com `puppeteer`
- calcula a altura total da pagina
- gera um PDF grande, sem margens

Ou seja: a regra de negocio principal ja existe. O que falta agora e colocar uma interface bonita por cima e empacotar tudo como app de desktop.

## O objetivo da migracao

No fim desse processo voce vai ter:

- uma janela desktop feita com Electron
- um formulario com campo de URL
- selecao de onde salvar o PDF
- feedback visual de carregamento e erro
- um `.exe` instalavel para Windows

## A ideia principal

Nao tente "enfiar a CLI inteira" dentro do Electron de uma vez.

O caminho mais seguro e este:

1. separar a logica de gerar PDF da interface de terminal
2. manter a CLI funcionando
3. criar o Electron por cima dessa mesma logica
4. empacotar o app com `electron-builder`

Essa separacao evita retrabalho e deixa o projeto mais facil de evoluir.

---

## Passo 0: entender o que voce ja tem

Hoje o arquivo principal e `print-scream.ts`.

Ele faz 2 coisas ao mesmo tempo:

1. contem a logica de gerar o PDF
2. le argumentos do terminal com `process.argv`

Para virar app desktop, o ideal e separar essas responsabilidades.

Tambem vale notar um detalhe do seu `package.json` atual:

- o campo `"main"` aponta para `index.js`
- esse arquivo nao existe no projeto atual

Quando entrarmos no Electron, esse campo vai passar a apontar para o arquivo real do processo principal do app.

---

## Passo 1: mover a logica da CLI para um modulo reutilizavel

Crie esta estrutura:

```text
src/
  core/
    generatePdf.ts
  cli.ts
```

### `src/core/generatePdf.ts`

```ts
import path from 'node:path';
import puppeteer from 'puppeteer';

export interface GeneratePdfInput {
  url: string;
  outputPath: string;
}

export async function generatePdf({
  url,
  outputPath,
}: GeneratePdfInput): Promise<string> {
  const browser = await puppeteer.launch({
    headless: true,
  });

  try {
    const page = await browser.newPage();

    await page.setViewport({ width: 1440, height: 900 });
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });

    await new Promise((resolve) => setTimeout(resolve, 2000));

    const height = await page.evaluate(() => {
      return Math.max(
        document.documentElement.scrollHeight,
        document.body.scrollHeight,
      );
    });

    const resolvedPath = path.resolve(outputPath);

    await page.pdf({
      path: resolvedPath,
      width: '1440px',
      height: `${height}px`,
      printBackground: true,
      margin: {
        top: '0px',
        right: '0px',
        bottom: '0px',
        left: '0px',
      },
    });

    return resolvedPath;
  } finally {
    await browser.close();
  }
}
```

### `src/cli.ts`

```ts
import path from 'node:path';
import { generatePdf } from './core/generatePdf.js';

const url = process.argv[2];
const fileName = process.argv[3] || 'screenshot.pdf';

if (!url) {
  console.error('Use: npm run cli -- <URL> [arquivo.pdf]');
  process.exit(1);
}

const outputPath = path.resolve(process.cwd(), fileName);

generatePdf({ url, outputPath })
  .then((savedPath) => {
    console.log(`PDF salvo em: ${savedPath}`);
  })
  .catch((error) => {
    console.error('Erro ao gerar PDF:', error);
    process.exit(1);
  });
```

Depois disso, o arquivo `print-scream.ts` da raiz pode ser removido.

O ganho aqui e simples:

- a CLI continua existindo
- o Electron vai reaproveitar exatamente a mesma funcao

---

## Passo 2: instalar o que falta para o app desktop

Rode:

```powershell
npm install --save-dev electron electron-builder copyfiles
```

Voce ja tem:

- `typescript`
- `ts-node`
- `@types/node`
- `puppeteer`

Entao nao precisa mexer nisso agora.

---

## Passo 3: reorganizar a estrutura do projeto

Depois da migracao, a ideia e ficar assim:

```text
gerador-pdf/
  .cache/
  src/
    cli.ts
    core/
      generatePdf.ts
    electron/
      main.ts
      preload.ts
    renderer/
      index.html
      renderer.js
      styles.css
  package.json
  tsconfig.json
  .puppeteerrc.cjs
```

### O papel de cada pasta

- `src/core`: regra de negocio
- `src/cli.ts`: continua permitindo rodar pelo terminal
- `src/electron/main.ts`: processo principal do Electron
- `src/electron/preload.ts`: ponte segura entre interface e Node/Electron
- `src/renderer`: HTML, CSS e JS da interface

---

## Passo 4: criar o processo principal do Electron

Crie `src/electron/main.ts`:

```ts
import path from 'node:path';
import { app, BrowserWindow, dialog, ipcMain } from 'electron';
import { generatePdf } from '../core/generatePdf.js';

let mainWindow: BrowserWindow | null = null;

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 820,
    minWidth: 980,
    minHeight: 700,
    autoHideMenuBar: true,
    backgroundColor: '#f6efe7',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
}

ipcMain.handle(
  'dialog:save-pdf',
  async (_event, defaultName: string = 'meu-pdf.pdf') => {
    const result = await dialog.showSaveDialog(mainWindow ?? undefined, {
      title: 'Salvar PDF',
      defaultPath: defaultName,
      filters: [{ name: 'PDF', extensions: ['pdf'] }],
    });

    if (result.canceled || !result.filePath) {
      return null;
    }

    return result.filePath;
  },
);

ipcMain.handle(
  'pdf:generate',
  async (
    _event,
    payload: { url: string; outputPath: string },
  ): Promise<string> => {
    if (!payload?.url || !payload?.outputPath) {
      throw new Error('URL e caminho de saida sao obrigatorios.');
    }

    try {
      new URL(payload.url);
    } catch {
      throw new Error('A URL informada e invalida.');
    }

    return generatePdf({
      url: payload.url,
      outputPath: payload.outputPath,
    });
  },
);

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
```

### O que esse arquivo faz

- cria a janela do app
- carrega o HTML da interface
- abre o dialogo de salvar arquivo
- recebe o pedido da interface para gerar PDF
- chama a mesma funcao que a CLI usa

---

## Passo 5: criar o preload

Crie `src/electron/preload.ts`:

```ts
import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('pdfApp', {
  chooseOutputPath: (defaultName: string) =>
    ipcRenderer.invoke('dialog:save-pdf', defaultName),
  generatePdf: (payload: { url: string; outputPath: string }) =>
    ipcRenderer.invoke('pdf:generate', payload),
});
```

### Por que isso existe?

Porque a interface nao deve acessar `ipcRenderer`, `fs`, `path` e outras APIs sensiveis direto no navegador.

O preload e a ponte segura entre:

- o `renderer` (sua tela)
- o `main` (o lado que tem acesso ao sistema)

Essa e a forma recomendada no Electron moderno.

---

## Passo 6: criar a interface bonita

Agora a parte visual.

Crie `src/renderer/index.html`:

```html
<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="UTF-8" />
    <meta
      http-equiv="Content-Security-Policy"
      content="default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'"
    />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>PrintScream</title>
    <link rel="stylesheet" href="./styles.css" />
  </head>
  <body>
    <main class="app-shell">
      <section class="hero-card">
        <p class="eyebrow">PrintScream Desktop</p>
        <h1>Transforme qualquer pagina em PDF com cara de aplicativo.</h1>
        <p class="hero-copy">
          Use sua base em Puppeteer, mas com uma interface de desktop limpa,
          pratica e pronta para instalacao.
        </p>
      </section>

      <section class="panel">
        <form id="pdf-form" class="form">
          <label class="field">
            <span>URL da pagina</span>
            <input
              id="url"
              name="url"
              type="url"
              placeholder="https://exemplo.com"
              required
            />
          </label>

          <label class="field">
            <span>Nome do arquivo</span>
            <input
              id="fileName"
              name="fileName"
              type="text"
              value="meu-pdf.pdf"
              required
            />
          </label>

          <label class="field">
            <span>Arquivo de saida</span>
            <div class="inline-row">
              <input
                id="outputPath"
                name="outputPath"
                type="text"
                placeholder="Clique em escolher..."
                readonly
              />
              <button id="choosePath" type="button" class="secondary-button">
                Escolher
              </button>
            </div>
          </label>

          <button id="submitButton" type="submit" class="primary-button">
            Gerar PDF
          </button>
        </form>

        <div id="statusBox" class="status-box neutral">
          Aguardando a primeira geracao.
        </div>
      </section>
    </main>

    <script src="./renderer.js"></script>
  </body>
</html>
```

Crie `src/renderer/renderer.js`:

```js
const form = document.getElementById('pdf-form');
const urlInput = document.getElementById('url');
const fileNameInput = document.getElementById('fileName');
const outputPathInput = document.getElementById('outputPath');
const choosePathButton = document.getElementById('choosePath');
const submitButton = document.getElementById('submitButton');
const statusBox = document.getElementById('statusBox');

function setStatus(message, type = 'neutral') {
  statusBox.textContent = message;
  statusBox.className = `status-box ${type}`;
}

function normalizeFileName(name) {
  const trimmed = name.trim();

  if (!trimmed) {
    return 'meu-pdf.pdf';
  }

  if (trimmed.toLowerCase().endsWith('.pdf')) {
    return trimmed;
  }

  return `${trimmed}.pdf`;
}

choosePathButton.addEventListener('click', async () => {
  const defaultName = normalizeFileName(fileNameInput.value);
  const selectedPath = await window.pdfApp.chooseOutputPath(defaultName);

  if (selectedPath) {
    outputPathInput.value = selectedPath;
    setStatus('Arquivo de saida selecionado com sucesso.', 'neutral');
  }
});

form.addEventListener('submit', async (event) => {
  event.preventDefault();

  const url = urlInput.value.trim();
  const fileName = normalizeFileName(fileNameInput.value);
  let outputPath = outputPathInput.value.trim();

  if (!url) {
    setStatus('Informe a URL antes de continuar.', 'error');
    return;
  }

  if (!outputPath) {
    outputPath = await window.pdfApp.chooseOutputPath(fileName);

    if (!outputPath) {
      setStatus('Voce precisa escolher onde salvar o PDF.', 'error');
      return;
    }

    outputPathInput.value = outputPath;
  }

  submitButton.disabled = true;
  choosePathButton.disabled = true;
  setStatus('Gerando PDF, aguarde alguns segundos...', 'loading');

  try {
    const savedPath = await window.pdfApp.generatePdf({
      url,
      outputPath,
    });

    setStatus(`PDF gerado com sucesso em: ${savedPath}`, 'success');
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Erro inesperado ao gerar PDF.';

    setStatus(message, 'error');
  } finally {
    submitButton.disabled = false;
    choosePathButton.disabled = false;
  }
});
```

Crie `src/renderer/styles.css`:

```css
:root {
  --bg-top: #ffd9c4;
  --bg-bottom: #e6f1ef;
  --surface: rgba(255, 255, 255, 0.84);
  --surface-strong: #ffffff;
  --text: #1f2430;
  --muted: #66707f;
  --accent: #c75b39;
  --accent-strong: #964223;
  --accent-soft: #f7e3d8;
  --success: #19643a;
  --error: #a12d2d;
  --loading: #8b5e15;
  --border: rgba(31, 36, 48, 0.1);
  --shadow: 0 30px 80px rgba(31, 36, 48, 0.16);
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  min-height: 100vh;
  font-family: 'Aptos', 'Segoe UI', sans-serif;
  color: var(--text);
  background:
    radial-gradient(circle at top left, var(--bg-top), transparent 35%),
    radial-gradient(circle at bottom right, var(--bg-bottom), transparent 35%),
    linear-gradient(135deg, #f7f1e8 0%, #eef6f5 100%);
}

.app-shell {
  width: min(1100px, calc(100% - 32px));
  margin: 0 auto;
  padding: 48px 0;
  display: grid;
  gap: 24px;
}

.hero-card,
.panel {
  background: var(--surface);
  backdrop-filter: blur(10px);
  border: 1px solid var(--border);
  border-radius: 28px;
  box-shadow: var(--shadow);
}

.hero-card {
  padding: 32px;
}

.hero-card h1 {
  margin: 8px 0 16px;
  font-size: clamp(2rem, 4vw, 3.6rem);
  line-height: 1;
  max-width: 12ch;
}

.eyebrow {
  margin: 0;
  font-size: 0.82rem;
  font-weight: 700;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--accent-strong);
}

.hero-copy {
  margin: 0;
  max-width: 60ch;
  color: var(--muted);
  font-size: 1rem;
  line-height: 1.7;
}

.panel {
  padding: 28px;
}

.form {
  display: grid;
  gap: 18px;
}

.field {
  display: grid;
  gap: 8px;
}

.field span {
  font-size: 0.95rem;
  font-weight: 600;
}

input {
  width: 100%;
  min-height: 52px;
  border-radius: 16px;
  border: 1px solid rgba(31, 36, 48, 0.12);
  background: var(--surface-strong);
  padding: 0 16px;
  font-size: 0.98rem;
  color: var(--text);
  outline: none;
  transition:
    border-color 0.2s ease,
    box-shadow 0.2s ease,
    transform 0.2s ease;
}

input:focus {
  border-color: rgba(199, 91, 57, 0.55);
  box-shadow: 0 0 0 4px rgba(199, 91, 57, 0.12);
  transform: translateY(-1px);
}

.inline-row {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 12px;
}

button {
  border: 0;
  border-radius: 16px;
  cursor: pointer;
  font-size: 0.95rem;
  font-weight: 700;
  transition:
    transform 0.2s ease,
    box-shadow 0.2s ease,
    opacity 0.2s ease,
    background 0.2s ease;
}

button:hover {
  transform: translateY(-1px);
}

button:disabled {
  opacity: 0.65;
  cursor: not-allowed;
  transform: none;
}

.primary-button {
  min-height: 56px;
  background: linear-gradient(135deg, var(--accent), var(--accent-strong));
  color: #fff;
  box-shadow: 0 18px 28px rgba(150, 66, 35, 0.24);
}

.secondary-button {
  min-width: 130px;
  min-height: 52px;
  background: var(--accent-soft);
  color: var(--accent-strong);
}

.status-box {
  margin-top: 20px;
  padding: 16px 18px;
  border-radius: 16px;
  font-size: 0.95rem;
  line-height: 1.6;
  border: 1px solid transparent;
}

.status-box.neutral {
  background: rgba(255, 255, 255, 0.8);
  border-color: rgba(31, 36, 48, 0.08);
}

.status-box.loading {
  background: rgba(139, 94, 21, 0.08);
  color: var(--loading);
  border-color: rgba(139, 94, 21, 0.18);
}

.status-box.success {
  background: rgba(25, 100, 58, 0.08);
  color: var(--success);
  border-color: rgba(25, 100, 58, 0.18);
}

.status-box.error {
  background: rgba(161, 45, 45, 0.08);
  color: var(--error);
  border-color: rgba(161, 45, 45, 0.18);
}

@media (max-width: 720px) {
  .app-shell {
    width: min(100% - 20px, 1100px);
    padding: 20px 0 28px;
  }

  .hero-card,
  .panel {
    border-radius: 22px;
  }

  .hero-card,
  .panel {
    padding: 20px;
  }

  .inline-row {
    grid-template-columns: 1fr;
  }
}
```

### O resultado dessa parte

Voce passa a ter:

- uma tela com visual melhor
- feedback de status
- botao para escolher o destino do arquivo
- experiencia de uso real de desktop

---

## Passo 7: ajustar o `package.json`

Seu `package.json` precisa refletir o novo fluxo.

Exemplo:

```json
{
  "name": "gerador-pdf",
  "version": "1.0.0",
  "description": "Aplicativo desktop para gerar PDF a partir de URLs",
  "main": "dist/electron/main.js",
  "scripts": {
    "cli": "npm run build:ts && node dist/cli.js",
    "build:ts": "tsc",
    "build:renderer": "copyfiles -u 2 \"src/renderer/**/*\" dist/renderer",
    "build": "npm run build:ts && npm run build:renderer",
    "electron": "npm run build && electron .",
    "dist": "npm run build && electron-builder"
  },
  "dependencies": {
    "puppeteer": "^25.1.0"
  },
  "build": {
    "appId": "com.printscream.desktop",
    "productName": "PrintScream",
    "directories": {
      "output": "release"
    },
    "files": [
      "dist/**/*",
      "package.json"
    ],
    "extraResources": [
      {
        "from": ".cache/puppeteer",
        "to": "puppeteer"
      }
    ],
    "win": {
      "target": "nsis"
    }
  }
}
```

### O que mudou aqui

- `"main"` agora aponta para o `main.js` do Electron
- `build` compila TypeScript e copia os arquivos do renderer
- `electron` abre a aplicacao desktop
- `dist` gera o instalador
- as versoes de `electron`, `electron-builder` e `copyfiles` vao ser escritas automaticamente pelo `npm install`

---

## Passo 8: ajustar o `tsconfig.json`

O seu atual ja esta quase pronto.

Eu deixaria assim:

```json
{
  "compilerOptions": {
    "target": "ESNext",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "lib": ["ESNext", "DOM"],
    "strict": true,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "verbatimModuleSyntax": false,
    "outDir": "./dist",
    "sourceMap": true
  },
  "include": ["src/**/*.ts"]
}
```

A mudanca principal e esta:

- antes: `"include": ["**/*.ts"]`
- depois: `"include": ["src/**/*.ts"]`

Isso evita compilar lixo antigo da raiz depois da reorganizacao.

---

## Passo 9: resolver o detalhe mais importante do instalador

Este e o ponto que mais pega quando alguem transforma `puppeteer` em app desktop.

### O problema

Por padrao, o Puppeteer baixa o navegador para:

```text
$HOME/.cache/puppeteer
```

Isso funciona durante o desenvolvimento, mas pode quebrar no app empacotado se voce nao trouxer esse navegador junto.

### A solucao

1. forcar o cache do Puppeteer para dentro do projeto
2. incluir essa pasta no build do Electron
3. apontar o app empacotado para esse cache

### 9.1 Crie `.puppeteerrc.cjs`

```js
const path = require('node:path');

/** @type {import('puppeteer').Configuration} */
module.exports = {
  cacheDirectory: path.join(__dirname, '.cache', 'puppeteer'),
};
```

### 9.2 Depois rode novamente a instalacao dos browsers do Puppeteer

```powershell
npx puppeteer browsers install
```

### 9.3 No `src/electron/main.ts`, adicione isso antes de criar a janela

```ts
if (app.isPackaged) {
  process.env.PUPPETEER_CACHE_DIR = path.join(
    process.resourcesPath,
    'puppeteer',
  );
}
```

Entao o trecho inicial do arquivo fica assim:

```ts
import path from 'node:path';
import { app, BrowserWindow, dialog, ipcMain } from 'electron';
import { generatePdf } from '../core/generatePdf.js';

if (app.isPackaged) {
  process.env.PUPPETEER_CACHE_DIR = path.join(
    process.resourcesPath,
    'puppeteer',
  );
}
```

### Por que isso importa?

Sem esse passo, e comum acontecer isto:

- no seu PC funciona
- no PC de outra pessoa o app abre, mas o Puppeteer nao acha o navegador

Se o seu foco e distribuicao, esse cuidado vale ouro.

---

## Passo 10: rodar em modo desktop

Depois de criar os arquivos:

```powershell
npm run electron
```

Se estiver tudo certo, deve abrir uma janela com:

- campo de URL
- nome do arquivo
- botao para escolher onde salvar
- botao para gerar PDF

---

## Passo 11: gerar o instalador do Windows

Quando a versao desktop estiver funcionando:

```powershell
npm run dist
```

Se tudo der certo, o `electron-builder` vai gerar uma pasta parecida com:

```text
release/
```

E dentro dela voce deve encontrar o instalador `.exe`.

Na configuracao acima, o alvo do Windows e:

```json
"win": {
  "target": "nsis"
}
```

Entao o artefato esperado e um instalador padrao do Windows.

---

## Passo 12: melhorias que eu faria depois da primeira versao

Depois que o app estiver funcionando, eu melhoraria nesta ordem:

1. adicionar historico das ultimas URLs usadas
2. permitir arrastar e soltar uma URL
3. mostrar barra de progresso real
4. deixar o usuario escolher largura do PDF
5. salvar preferencias em arquivo local
6. criar icone do app e splash

---

## Passo 13: uma observacao importante sobre escolhas tecnicas

Neste guia eu mantive o `puppeteer` porque voce ja tem a regra funcionando hoje.

Isso e bom para:

- migrar mais rapido
- aproveitar o que ja esta pronto
- reduzir o risco da primeira versao

Mas existe uma segunda etapa possivel no futuro:

- trocar o `puppeteer` por uma estrategia 100% baseada no Electron

Vantagem:

- app final pode ficar menor
- voce evita empacotar dois mundos grandes

Desvantagem:

- voce vai reescrever parte da geracao

Minha recomendacao pratica:

1. primeiro faca a versao Electron funcionar
2. depois pense em otimizar tamanho e arquitetura

---

## Checklist final

Antes de considerar a migracao concluida, confira se:

- a CLI ainda funciona com `npm run cli -- https://site.com arquivo.pdf`
- o app Electron abre sem erro
- o preload esta sendo usado com `contextIsolation: true`
- a interface consegue escolher o caminho de saida
- o PDF e gerado pela tela
- `npx puppeteer browsers install` foi rodado depois do `.puppeteerrc.cjs`
- `npm run dist` gera o instalador

---

## Referencias oficiais

- Electron - Building your First App: https://www.electronjs.org/docs/latest/tutorial/tutorial-first-app
- Electron - Using Preload Scripts: https://www.electronjs.org/docs/latest/tutorial/tutorial-preload
- Electron - IPC: https://www.electronjs.org/docs/latest/tutorial/ipc
- Electron - dialog: https://www.electronjs.org/docs/latest/api/dialog
- Electron - Packaging Your Application: https://www.electronjs.org/docs/latest/tutorial/tutorial-packaging
- electron-builder - Application Contents: https://www.electron.build/docs/contents/
- Puppeteer - Installation: https://pptr.dev/guides/installation
- Puppeteer - Configuration: https://pptr.dev/guides/configuration
- Puppeteer - Configuration interface: https://pptr.dev/api/puppeteer.configuration

---

## Em resumo

O segredo da sua migracao e este:

- tirar a regra de gerar PDF da CLI
- reaproveitar essa regra no Electron
- criar uma interface simples e bonita
- empacotar com cuidado por causa do cache do Puppeteer

Se voce quiser, no proximo passo eu posso fazer a implementacao dessa estrutura no codigo do projeto, nao so o README.
