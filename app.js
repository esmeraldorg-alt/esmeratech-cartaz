// Gerador de Cartazes (versão Android/web). Mesma lógica do programa de PC:
// lista de produtos, modelos, tamanhos A1 a A7, folhas A4 para colar e modelo de imagem.
(function () {
  'use strict';

  // ---------- Dados fixos ----------
  var TAMANHOS = [
    { nome: 'A1', w: 594, h: 841 }, { nome: 'A2', w: 420, h: 594 }, { nome: 'A3', w: 297, h: 420 },
    { nome: 'A4', w: 210, h: 297 }, { nome: 'A5', w: 148, h: 210 }, { nome: 'A6', w: 105, h: 148 },
    { nome: 'A7', w: 74, h: 105 }
  ];

  var TEMAS = [
    { nome: 'Oferta (vermelho e amarelo)', fundo: '#FFDD00', cabeca: '#D6141E', textoCabeca: '#FFDD00',
      faixa: '#FFDD00', preco: '#D6141E', cartao: '#FFFFFF', textoProduto: '#191919', borda: '#D6141E', rua: false },
    { nome: 'Azul', fundo: '#EBF3FF', cabeca: '#003399', textoCabeca: '#FFFFFF',
      faixa: '#003399', preco: '#FFFFFF', cartao: '#FFFFFF', textoProduto: '#1E1E1E', borda: '#003399', rua: false },
    { nome: 'Verde', fundo: '#E8F8EC', cabeca: '#006E32', textoCabeca: '#FFFFFF',
      faixa: '#006E32', preco: '#FFEB3B', cartao: '#FFFFFF', textoProduto: '#1E1E1E', borda: '#006E32', rua: false },
    { nome: 'Cartaz de rua (vermelho, amarelo e branco)', fundo: '#FFFFFF', cabeca: '#D6141E', textoCabeca: '#FFDD00',
      faixa: '#FFDD00', preco: '#D6141E', cartao: '#FFFFFF', textoProduto: '#141414', borda: '#D6141E', rua: true }
  ];

  var K = 4;           // pixels por milímetro para PNG e impressão (~100 dpi)
  var K_PREVIEW = 1.6; // pixels por milímetro na visualização

  // ---------- Estado ----------
  var estado = {
    produtos: [],        // { nome, valor, unidade, preco }
    modelo: null,        // HTMLImageElement ou null
    modeloDataUrl: null, // para guardar no aparelho
    titulo: 'OFERTA',
    tema: 0,
    tamanho: 0,
    dividir: true,
    orient: 0
  };

  var el = {};

  // ---------- Inicialização ----------
  function iniciar() {
    el.form = document.getElementById('form-produto');
    el.nome = document.getElementById('nome');
    el.preco = document.getElementById('preco');
    el.lista = document.getElementById('lista');
    el.limpar = document.getElementById('limpar');
    el.titulo = document.getElementById('titulo');
    el.tema = document.getElementById('tema');
    el.tamanho = document.getElementById('tamanho');
    el.orient = document.getElementById('orient');
    el.dividir = document.getElementById('dividir');
    el.info = document.getElementById('info');
    el.arquivo = document.getElementById('arquivo');
    el.removerModelo = document.getElementById('remover-modelo');
    el.nomeModelo = document.getElementById('nome-modelo');
    el.textosModelo = document.getElementById('textos-modelo');
    el.visualizacao = document.getElementById('visualizacao');
    el.baixar = document.getElementById('baixar');
    el.imprimir = document.getElementById('imprimir');
    el.status = document.getElementById('status');
    el.impressao = document.getElementById('impressao');
    el.numeros = ['nomeX', 'nomeY', 'nomeW', 'nomeH', 'precoX', 'precoY', 'precoW', 'precoH']
      .map(function (id) { return document.getElementById(id); });

    TEMAS.forEach(function (t, i) { el.tema.add(new Option(t.nome, String(i))); });
    TAMANHOS.forEach(function (t, i) { el.tamanho.add(new Option(t.nome + '  (' + t.w + ' x ' + t.h + ' mm)', String(i))); });

    carregarEstado();
    el.titulo.value = estado.titulo;
    el.tema.value = String(estado.tema);
    el.tamanho.value = String(estado.tamanho);
    el.orient.value = String(estado.orient);
    el.dividir.checked = estado.dividir;
    lerNumeros();
    el.numeros.forEach(function (n, i) { n.value = String(valoresLayout()[i]); });

    el.form.addEventListener('submit', function (e) { e.preventDefault(); adicionarProduto(); });
    el.limpar.addEventListener('click', limparLista);
    el.titulo.addEventListener('input', alterou);
    el.tema.addEventListener('change', alterou);
    el.tamanho.addEventListener('change', alterou);
    el.orient.addEventListener('change', alterou);
    el.dividir.addEventListener('change', alterou);
    el.numeros.forEach(function (n) { n.addEventListener('input', alterou); });
    el.arquivo.addEventListener('change', escolherModelo);
    el.removerModelo.addEventListener('click', removerModelo);
    el.baixar.addEventListener('click', baixarPng);
    el.imprimir.addEventListener('click', imprimir);

    if (estado.modeloDataUrl) carregarModeloDeDataUrl(estado.modeloDataUrl);
    renderLista();
    alterou();

    if ('serviceWorker' in navigator && /^https?:/.test(location.protocol)) {
      navigator.serviceWorker.register('sw.js').catch(function () { /* sem offline, o app segue funcionando */ });
    }
  }

  function valoresLayout() {
    return [estado.layout.nomeX, estado.layout.nomeY, estado.layout.nomeW, estado.layout.nomeH,
            estado.layout.precoX, estado.layout.precoY, estado.layout.precoW, estado.layout.precoH];
  }

  function lerNumeros() {
    var v = function (id, padrao) {
      var n = parseFloat(document.getElementById(id).value);
      return isNaN(n) ? padrao : Math.min(100, Math.max(0, n));
    };
    estado.layout = {
      nomeX: v('nomeX', 15), nomeY: v('nomeY', 30), nomeW: v('nomeW', 70), nomeH: v('nomeH', 18),
      precoX: v('precoX', 20), precoY: v('precoY', 58), precoW: v('precoW', 60), precoH: v('precoH', 22)
    };
  }

  // ---------- Produtos ----------
  // "24,90" ou "6,50 KG": o número vira o valor e o resto vira a unidade.
  function criarProduto(nome, precoTexto) {
    var m = /^\s*([\d.,]+)\s*(.*)$/.exec(precoTexto || '');
    if (!nome || !m) return null;
    var numero = m[1];
    if (numero.indexOf(',') >= 0 && numero.indexOf('.') >= 0) numero = numero.replace(/\./g, '');
    numero = numero.replace(',', '.');
    var valor = parseFloat(numero);
    if (isNaN(valor)) return null;
    var unidade = m[2].trim().toUpperCase();
    var valorTexto = valor.toFixed(2).replace('.', ',');
    return {
      nome: nome.trim(),
      valor: valorTexto,
      unidade: unidade,
      preco: 'R$ ' + valorTexto + (unidade ? '/' + unidade : '')
    };
  }

  function adicionarProduto() {
    var nome = el.nome.value.trim();
    if (!nome) { mostrarStatus('Digite o nome do produto.'); el.nome.focus(); return; }
    if (nome.indexOf(';') >= 0) { mostrarStatus("O nome não pode ter ';'."); el.nome.focus(); return; }
    var produto = criarProduto(nome, el.preco.value);
    if (!produto) { mostrarStatus('Preço inválido. Digite assim: 24,90 ou 6,50 KG'); el.preco.focus(); return; }
    estado.produtos.push(produto);
    el.nome.value = '';
    el.preco.value = '';
    el.nome.focus();
    renderLista();
    alterou();
  }

  function removerProduto(indice) {
    estado.produtos.splice(indice, 1);
    renderLista();
    alterou();
  }

  function limparLista() {
    if (!estado.produtos.length) return;
    if (!window.confirm('Apagar todos os produtos da lista?')) return;
    estado.produtos = [];
    renderLista();
    alterou();
  }

  function renderLista() {
    el.lista.innerHTML = '';
    estado.produtos.forEach(function (p, i) {
      var li = document.createElement('li');
      var texto = document.createElement('span');
      texto.className = 'nome-item';
      texto.textContent = p.nome + ' - ' + p.preco;
      var botao = document.createElement('button');
      botao.type = 'button';
      botao.className = 'remover';
      botao.textContent = 'Remover';
      botao.addEventListener('click', function () { removerProduto(i); });
      li.appendChild(texto);
      li.appendChild(botao);
      el.lista.appendChild(li);
    });
  }

  // ---------- Modelo de imagem ----------
  function escolherModelo() {
    var arq = el.arquivo.files && el.arquivo.files[0];
    el.arquivo.value = '';
    if (!arq) return;
    var leitor = new FileReader();
    leitor.onload = function () {
      carregarModeloDeDataUrl(leitor.result, arq.name);
    };
    leitor.onerror = function () { mostrarStatus('Não consegui ler esse arquivo.'); };
    leitor.readAsDataURL(arq);
  }

  function carregarModeloDeDataUrl(dataUrl, nome) {
    var img = new Image();
    img.onload = function () {
      estado.modelo = img;
      estado.modeloDataUrl = dataUrl;
      el.nomeModelo.textContent = 'Modelo: ' + (nome || 'imagem salva');
      salvarEstado();
      alterou();
    };
    img.onerror = function () {
      mostrarStatus('Formato não aceito. Use PNG, JPG, GIF ou WebP.');
    };
    img.src = dataUrl;
  }

  function removerModelo() {
    estado.modelo = null;
    estado.modeloDataUrl = null;
    el.nomeModelo.textContent = 'Nenhum modelo escolhido.';
    alterou();
  }

  // ---------- Regras de folhas (igual ao PC) ----------
  function calcularFolhas(tam, dividir, orient) {
    var plano = { dividir: false, paisagem: false, tw: 0, th: 0, cols: 1, rows: 1, canvasW: tam.w, canvasH: tam.h, total: 1 };
    if (!dividir) return plano;
    var melhor = null;
    [1, 2].forEach(function (o) {
      if (orient !== 0 && orient !== o) return;
      var paisagem = o === 2;
      var tw = paisagem ? 297 : 210;
      var th = paisagem ? 210 : 297;
      var cols = Math.ceil(tam.w / tw - 0.01);
      var rows = Math.ceil(tam.h / th - 0.01);
      var candidato = {
        dividir: true, paisagem: paisagem, tw: tw, th: th, cols: cols, rows: rows,
        canvasW: cols * tw, canvasH: rows * th, total: cols * rows
      };
      if (!melhor || candidato.total < melhor.total) melhor = candidato;
    });
    return melhor;
  }

  // ---------- Desenho (unidades em mm; o contexto já vem com escala k) ----------
  function quebrarLinhas(ctx, texto, largura) {
    var palavras = String(texto).split(/\s+/);
    var linhas = [];
    var atual = '';
    palavras.forEach(function (p) {
      var teste = atual ? atual + ' ' + p : p;
      if (ctx.measureText(teste).width <= largura || !atual) {
        atual = teste;
      } else {
        linhas.push(atual);
        atual = p;
      }
    });
    if (atual) linhas.push(atual);
    return linhas;
  }

  function textoAjustado(ctx, texto, x, y, w, h, maxMm, negrito, cor) {
    if (w <= 1 || h <= 1) return;
    ctx.fillStyle = cor;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    var peso = negrito ? 'bold ' : '';
    for (var mm = maxMm; mm > 0.8; mm *= 0.94) {
      ctx.font = peso + mm + 'px Arial';
      var linhas = quebrarLinhas(ctx, texto, w);
      var alturaLinha = mm * 1.15;
      var cabe = linhas.length * alturaLinha <= h && linhas.every(function (l) { return ctx.measureText(l).width <= w; });
      if (cabe) {
        var y0 = y + h / 2 - (linhas.length - 1) * alturaLinha / 2;
        linhas.forEach(function (l, i) { ctx.fillText(l, x + w / 2, y0 + i * alturaLinha); });
        return;
      }
    }
    ctx.font = peso + '0.8px Arial';
    ctx.fillText(String(texto), x + w / 2, y + h / 2);
  }

  function desenharCartao(ctx, r, p, tema, titulo) {
    var pad = r.w * 0.05;
    ctx.fillStyle = tema.cartao;
    ctx.fillRect(r.x, r.y, r.w, r.h);
    if (tema.rua) {
      var alturaTag = r.h * 0.2;
      var alturaPreco = r.h * 0.3;
      ctx.fillStyle = tema.cabeca;
      ctx.fillRect(r.x, r.y, r.w, alturaTag);
      textoAjustado(ctx, titulo, r.x + pad, r.y + pad * 0.5, r.w - 2 * pad, alturaTag - pad, alturaTag * 0.8, true, tema.textoCabeca);
      textoAjustado(ctx, p.nome, r.x + pad, r.y + alturaTag + pad, r.w - 2 * pad,
        r.h - alturaTag - alturaPreco - 2 * pad, r.h * 0.16, true, tema.textoProduto);
      ctx.fillStyle = tema.faixa;
      ctx.fillRect(r.x, r.y + r.h - alturaPreco, r.w, alturaPreco);
      textoAjustado(ctx, p.preco, r.x + pad, r.y + r.h - alturaPreco + pad * 0.5, r.w - 2 * pad, alturaPreco - pad,
        alturaPreco * 0.75, true, tema.preco);
    } else {
      var alturaFaixa = r.h * 0.36;
      ctx.fillStyle = tema.faixa;
      ctx.fillRect(r.x, r.y + r.h - alturaFaixa, r.w, alturaFaixa);
      textoAjustado(ctx, p.nome, r.x + pad, r.y + pad, r.w - 2 * pad, r.h - alturaFaixa - 2 * pad, r.h * 0.18, true, tema.textoProduto);
      textoAjustado(ctx, p.preco, r.x + pad, r.y + r.h - alturaFaixa + pad * 0.5, r.w - 2 * pad, alturaFaixa - pad,
        alturaFaixa * 0.7, true, tema.preco);
    }
    ctx.strokeStyle = tema.borda;
    ctx.lineWidth = Math.min(r.w, r.h) * 0.02;
    ctx.strokeRect(r.x, r.y, r.w, r.h);
  }

  // Desenha o cartaz inteiro (ou um cartão, quando há modelo de imagem).
  function desenharCartaz(ctx, w, h, tema, titulo, itens, modelo, layout) {
    if (modelo) {
      ctx.drawImage(modelo, 0, 0, w, h);
      if (!itens.length) return;
      var p = itens[0];
      var rn = { x: w * layout.nomeX / 100, y: h * layout.nomeY / 100, w: w * layout.nomeW / 100, h: h * layout.nomeH / 100 };
      var rp = { x: w * layout.precoX / 100, y: h * layout.precoY / 100, w: w * layout.precoW / 100, h: h * layout.precoH / 100 };
      textoAjustado(ctx, p.nome, rn.x, rn.y, rn.w, rn.h, rn.h * 0.9, true, tema.textoProduto);
      textoAjustado(ctx, p.valor + (p.unidade ? ' ' + p.unidade : ''), rp.x, rp.y, rp.w, rp.h, rp.h * 0.9, true, tema.preco);
      return;
    }
    ctx.fillStyle = tema.fundo;
    ctx.fillRect(0, 0, w, h);
    var margem = Math.min(w, h) * 0.03;
    var alturaCab = tema.rua ? 0 : h * 0.2;
    if (alturaCab > 0) {
      ctx.fillStyle = tema.cabeca;
      ctx.fillRect(0, 0, w, alturaCab);
      textoAjustado(ctx, titulo, margem, margem, w - 2 * margem, alturaCab - 2 * margem, alturaCab * 0.8, true, tema.textoCabeca);
    }
    var y0 = alturaCab + margem;
    var larg = w - 2 * margem;
    var alt = h - y0 - margem;
    if (!itens.length) {
      textoAjustado(ctx, 'Nenhum produto na lista', margem, y0, larg, alt, alt * 0.1, true, tema.textoProduto);
      return;
    }
    var n = itens.length;
    var cols = 1;
    var melhorDif = Infinity;
    for (var c = 1; c <= n; c++) {
      var lin = Math.ceil(n / c);
      var razao = (larg / c) / (alt / lin);
      var dif = Math.abs(Math.log(razao / 0.9));
      if (dif < melhorDif) { melhorDif = dif; cols = c; }
    }
    var rows = Math.ceil(n / cols);
    var gap = margem * 0.8;
    var cw = (larg - gap * (cols - 1)) / cols;
    var ch = (alt - gap * (rows - 1)) / rows;
    itens.forEach(function (p, i) {
      var col = i % cols;
      var linha = Math.floor(i / cols);
      desenharCartao(ctx, { x: margem + col * (cw + gap), y: y0 + linha * (ch + gap), w: cw, h: ch }, p, tema, titulo);
    });
  }

  function criarCanvas(wMm, hMm, k) {
    var canvas = document.createElement('canvas');
    canvas.width = Math.round(wMm * k);
    canvas.height = Math.round(hMm * k);
    var ctx = canvas.getContext('2d');
    ctx.setTransform(k, 0, 0, k, 0, 0);
    return { canvas: canvas, ctx: ctx };
  }

  // Monta as páginas a serem vistas, baixadas ou impressas.
  // Cada página: { canvas, paisagem, rotulo }.
  function montarPaginas(k) {
    var tema = TEMAS[estado.tema];
    var tam = TAMANHOS[estado.tamanho];
    var modelo = estado.modelo;
    var paginas = [];
    if (modelo) {
      estado.produtos.forEach(function (p, i) {
        var c = criarCanvas(tam.w, tam.h, k);
        desenharCartaz(c.ctx, tam.w, tam.h, tema, estado.titulo, [p], modelo, estado.layout);
        paginas.push({ canvas: c.canvas, paisagem: false, rotulo: 'cartaz_' + (i + 1) });
      });
      return paginas;
    }
    var plano = calcularFolhas(tam, estado.dividir, estado.orient);
    var inteiro = criarCanvas(plano.canvasW, plano.canvasH, k);
    desenharCartaz(inteiro.ctx, plano.canvasW, plano.canvasH, tema, estado.titulo, estado.produtos, null, null);
    if (!plano.dividir) {
      paginas.push({ canvas: inteiro.canvas, paisagem: false, rotulo: 'cartaz' });
      return paginas;
    }
    for (var r = 0; r < plano.rows; r++) {
      for (var c2 = 0; c2 < plano.cols; c2++) {
        var folha = document.createElement('canvas');
        folha.width = Math.round(plano.tw * k);
        folha.height = Math.round(plano.th * k);
        folha.getContext('2d').drawImage(inteiro.canvas, c2 * plano.tw * k, r * plano.th * k,
          plano.tw * k, plano.th * k, 0, 0, plano.tw * k, plano.th * k);
        var numero = r * plano.cols + c2 + 1;
        paginas.push({
          canvas: folha, paisagem: plano.paisagem,
          rotulo: 'folha_' + numero + '_linha' + (r + 1) + '_coluna' + (c2 + 1)
        });
      }
    }
    return paginas;
  }

  // Linhas tracejadas entre as folhas, só na visualização.
  function desenharGrade(canvas, plano, k) {
    var ctx = canvas.getContext('2d');
    ctx.setTransform(k, 0, 0, k, 0, 0);
    ctx.setLineDash([3, 3]);
    ctx.strokeStyle = 'rgba(60,60,60,0.7)';
    ctx.lineWidth = 0.5;
    for (var c = 1; c < plano.cols; c++) {
      ctx.beginPath(); ctx.moveTo(c * plano.tw, 0); ctx.lineTo(c * plano.tw, plano.canvasH); ctx.stroke();
    }
    for (var r = 1; r < plano.rows; r++) {
      ctx.beginPath(); ctx.moveTo(0, r * plano.th); ctx.lineTo(plano.canvasW, r * plano.th); ctx.stroke();
    }
  }

  // ---------- Visualização e textos ----------
  function alterou() {
    lerNumeros();
    estado.titulo = el.titulo.value.trim();
    estado.tema = parseInt(el.tema.value, 10) || 0;
    estado.tamanho = parseInt(el.tamanho.value, 10) || 0;
    estado.orient = parseInt(el.orient.value, 10) || 0;
    estado.dividir = el.dividir.checked;
    el.textosModelo.hidden = !estado.modelo;
    el.dividir.disabled = !!estado.modelo;
    atualizarInfo();
    atualizarVisualizacao();
    salvarEstado();
  }

  function atualizarInfo() {
    var tam = TAMANHOS[estado.tamanho];
    if (estado.modelo) {
      el.info.textContent = 'Modelo de imagem: um cartaz por produto (' + estado.produtos.length + '), tamanho ' + tam.nome + '.';
      return;
    }
    var plano = calcularFolhas(tam, estado.dividir, estado.orient);
    el.info.textContent = plano.dividir
      ? tam.nome + ': ' + plano.total + ' folhas A4 ' + (plano.paisagem ? 'na paisagem' : 'em pé') + '. Imprima e cole na ordem indicada em cada folha.'
      : tam.nome + ': ' + tam.w + ' x ' + tam.h + ' mm. Sem divisão, sai reduzido numa folha A4.';
  }

  function atualizarVisualizacao() {
    el.visualizacao.innerHTML = '';
    if (!estado.produtos.length && !estado.modelo) {
      var aviso = document.createElement('p');
      aviso.className = 'ajuda';
      aviso.textContent = 'Adicione produtos para ver o cartaz.';
      el.visualizacao.appendChild(aviso);
      mostrarStatus('');
      return;
    }
    if (!estado.produtos.length) {
      mostrarStatus('Nenhum produto. Preencha nome e preço e toque em Adicionar.');
    } else {
      mostrarStatus(estado.produtos.length + ' produto(s).');
    }
    var paginas = montarPaginas(K_PREVIEW);
    if (!paginas.length) return;
    if (!estado.modelo && estado.dividir) {
      var plano = calcularFolhas(TAMANHOS[estado.tamanho], true, estado.orient);
      var inteiro = criarCanvas(plano.canvasW, plano.canvasH, K_PREVIEW);
      desenharCartaz(inteiro.ctx, plano.canvasW, plano.canvasH, TEMAS[estado.tema], estado.titulo, estado.produtos, null, null);
      desenharGrade(inteiro.canvas, plano, K_PREVIEW);
      inteiro.canvas.style.width = '100%';
      el.visualizacao.appendChild(inteiro.canvas);
      return;
    }
    // Modelo de imagem ou sem divisão: mostra o primeiro cartaz.
    paginas[0].canvas.style.width = '100%';
    el.visualizacao.appendChild(paginas[0].canvas);
  }

  function mostrarStatus(texto) {
    el.status.textContent = texto;
  }

  function salvarEstado() {
    try {
      localStorage.setItem('gc_estado', JSON.stringify({
        produtos: estado.produtos, titulo: estado.titulo, tema: estado.tema, tamanho: estado.tamanho,
        orient: estado.orient, dividir: estado.dividir, layout: estado.layout, modeloDataUrl: estado.modeloDataUrl
      }));
    } catch (e) {
      // Sem armazenamento (ou imagem grande demais): o app continua funcionando sem salvar.
      try {
        localStorage.setItem('gc_estado', JSON.stringify({
          produtos: estado.produtos, titulo: estado.titulo, tema: estado.tema, tamanho: estado.tamanho,
          orient: estado.orient, dividir: estado.dividir, layout: estado.layout, modeloDataUrl: null
        }));
      } catch (e2) { /* sem armazenamento disponível */ }
    }
  }

  function carregarEstado() {
    try {
      var salvo = JSON.parse(localStorage.getItem('gc_estado') || 'null');
      if (!salvo) return;
      estado.produtos = Array.isArray(salvo.produtos) ? salvo.produtos : [];
      estado.titulo = salvo.titulo || 'OFERTA';
      estado.tema = salvo.tema || 0;
      estado.tamanho = salvo.tamanho || 0;
      estado.orient = salvo.orient || 0;
      estado.dividir = salvo.dividir !== false;
      estado.layout = salvo.layout || null;
      estado.modeloDataUrl = salvo.modeloDataUrl || null;
    } catch (e) { /* dados antigos ou corrompidos: começa vazio */ }
    if (!estado.layout) {
      estado.layout = { nomeX: 15, nomeY: 30, nomeW: 70, nomeH: 18, precoX: 20, precoY: 58, precoW: 60, precoH: 22 };
    }
    document.getElementById('nomeX').value = estado.layout.nomeX;
    document.getElementById('nomeY').value = estado.layout.nomeY;
    document.getElementById('nomeW').value = estado.layout.nomeW;
    document.getElementById('nomeH').value = estado.layout.nomeH;
    document.getElementById('precoX').value = estado.layout.precoX;
    document.getElementById('precoY').value = estado.layout.precoY;
    document.getElementById('precoW').value = estado.layout.precoW;
    document.getElementById('precoH').value = estado.layout.precoH;
  }

  // ---------- Ações: baixar e imprimir ----------
  function baixarPng() {
    if (!estado.produtos.length) { mostrarStatus('Adicione pelo menos um produto antes de baixar.'); return; }
    var paginas = montarPaginas(K);
    var tam = TAMANHOS[estado.tamanho];
    paginas.forEach(function (pagina, i) {
      setTimeout(function () {
        pagina.canvas.toBlob(function (blob) {
          var url = URL.createObjectURL(blob);
          var a = document.createElement('a');
          a.href = url;
          a.download = pagina.rotulo + '_' + tam.nome + '.png';
          document.body.appendChild(a);
          a.click();
          a.remove();
          setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
        }, 'image/png');
      }, i * 400);
    });
    mostrarStatus(paginas.length + ' arquivo(s) PNG sendo baixados.');
  }

  function imprimir() {
    if (!estado.produtos.length) { mostrarStatus('Adicione pelo menos um produto antes de imprimir.'); return; }
    var paginas = montarPaginas(K);
    el.impressao.innerHTML = '';
    var todasPaisagem = paginas.every(function (p) { return p.paisagem; });
    var todasRetrato = paginas.every(function (p) { return !p.paisagem; });
    paginas.forEach(function (pagina) {
      var div = document.createElement('div');
      div.className = 'pagina';
      var img = document.createElement('img');
      img.src = pagina.canvas.toDataURL('image/png');
      img.alt = pagina.rotulo;
      div.appendChild(img);
      el.impressao.appendChild(div);
    });
    var estilo = document.getElementById('estilo-pagina');
    if (!estilo) {
      estilo = document.createElement('style');
      estilo.id = 'estilo-pagina';
      document.head.appendChild(estilo);
    }
    var orientacao = todasPaisagem ? 'landscape' : (todasRetrato ? 'portrait' : 'portrait');
    estilo.textContent = '@media print { @page { size: A4 ' + orientacao + '; margin: 0; } }';
    mostrarStatus('Abrindo a impressão: ' + paginas.length + ' folha(s).');
    setTimeout(function () { window.print(); }, 300);
  }

  document.addEventListener('DOMContentLoaded', iniciar);
})();
