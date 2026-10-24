# Gerador de Cartazes (app para Android)

App web instalável. Funciona no Chrome do Android e no PC.

## Como instalar no celular

1. Hospede a pasta em um endereço https (ex.: GitHub Pages, Netlify ou Vercel).
2. Abra o endereço no Chrome do Android.
3. Toque nos três pontinhos e escolha **Adicionar à tela inicial** (ou **Instalar app**).

Depois de instalado, o app abre sozinho e funciona sem internet.

## O que faz

- Lista de produtos: nome e preço. Preço com unidade, como 6,50 KG.
- Modelos de cartaz, tamanhos A1 a A7 e títulos.
- Folhas A4 para colar (A1 sai em 8 folhas na paisagem).
- Modelo de imagem: escolha uma imagem, e o nome e o preço vão sobre ela nas posições que você definir (em % do modelo).
- Baixar PNG e Imprimir.

## Arquivos

- index.html, style.css, app.js: o app.
- manifest.webmanifest, sw.js, icon-192.png, icon-512.png: instalação e uso sem internet.

## Limites

- Para salvar o modelo de imagem, o aparelho precisa ter espaço no armazenamento do navegador. Imagens muito grandes não são guardadas.
- Na impressão, use margem mínima no diálogo do Android e confira a primeira folha antes de imprimir tudo.
