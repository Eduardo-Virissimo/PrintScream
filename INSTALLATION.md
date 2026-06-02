# Instalacao do projeto

Este projeto pode ser usado de 2 formas:

1. rodando direto do codigo-fonte
2. instalando o app Windows gerado pelo `electron-builder`

## Requisitos

- Node.js 20 ou superior
- npm
- Windows 10 ou 11 para gerar e instalar o `.exe`

## Rodar em desenvolvimento

1. Instale as dependencias:

   ```bash
   npm install
   ```

2. Compile o projeto:

   ```bash
   npm run build
   ```

3. Abra o app Electron:

   ```bash
   npm run electron
   ```

## Gerar o instalador

1. Rode o empacotamento:

   ```bash
   npm run dist
   ```

2. Aguarde o `electron-builder` terminar.
3. O instalador do Windows sera criado dentro da pasta `release/`.

## Depois de instalar

- Abra o arquivo `.exe` dentro de `release/`.
- Siga o assistente de instalacao do Windows.
- Depois disso, o app pode ser iniciado pelo menu iniciar ou pelo atalho na area de trabalho, se ele for criado.

## Observacao importante

Se o Puppeteer reclamar de browser ausente, rode:

```bash
npx puppeteer browsers install
```

Depois execute `npm run dist` novamente.
