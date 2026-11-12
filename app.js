/*
 * HelpKids web: a mesma coisa que o app Android (telas, jogo, jogadores, ranking, area dos pais),
 * para rodar no navegador do iPhone/iPad (e em qualquer outro). As listas de figuras, sons e
 * palavras vem de dados.js, gerado por ferramentas/MontarWeb.java a partir do app Android.
 */
(function () {
  'use strict';

  // mesma ordem de Pontuacao.CATEGORIAS no Android (os recordes usam o id)
  var CATEGORIAS = [
    {id: 'alfabeto', nome: 'Letras', icone: 'alfabeto', fundo: 'fundoletras', lista: 'getAlfabeto'},
    {id: 'numeros', nome: 'Números', icone: 'numeros', fundo: 'fundonumero', lista: 'getNumeros'},
    {id: 'formas', nome: 'Formas', icone: 'formas', fundo: 'fundoformas', lista: 'getFormas'},
    {id: 'frutas', nome: 'Frutas', icone: 'food', fundo: 'fundofood', lista: 'getFood'},
    {id: 'animais', nome: 'Animais', icone: 'animais', fundo: 'fundoanimal', lista: 'getAnimais'},
    {id: 'cores', nome: 'Cores', icone: 'cores', fundo: 'fundocores', lista: 'getCores'},
    {id: 'corpo', nome: 'Corpo Humano', icone: 'corpo', fundo: 'fundo', lista: 'getCorpo'},
    {id: 'alimentos', nome: 'Alimentos', icone: 'alimentos', fundo: 'fundofood', lista: 'getAlimentos'}
  ];

  // Nivel.java
  var NIVEIS = [
    {id: 'FACIL', nome: 'Easy', arte: 'nivel_easy', figuras: 2, primeira: 5, segunda: 0, cor: '#43A047'},
    {id: 'MEDIO', nome: 'Medium', arte: 'nivel_medium', figuras: 4, primeira: 10, segunda: 5, cor: '#FB8C00'},
    {id: 'DIFICIL', nome: 'Hard', arte: 'nivel_hard', figuras: 8, primeira: 15, segunda: 10, cor: '#E53935'}
  ];

  var PERGUNTAS_POR_PARTIDA = 10;
  var ERROS_PARA_AJUDA = 2;
  var TAMANHO_MAXIMO_NOME = 15;
  var AVISO_ACERTO_MS = 1900;
  var AVISO_ERRO_MS = 1300;
  var SOM_PRIMEIRA_RODADA_MS = 700;
  var SOM_PROXIMA_RODADA_MS = 400;
  var SOM_DEPOIS_DO_ERRO_MS = 250;
  var CORES_JOGADOR = ['#E53935', '#1E88E5', '#43A047', '#FB8C00', '#8E24AA', '#00897B', '#D81B60', '#6D4C41'];

  function $(id) { return document.getElementById(id); }

  /** caminho de uma imagem do app (img/nome.webp, .png ou .jpg; a lista vem de dados.js) */
  function imagem(nome) { return (window.IMAGENS && window.IMAGENS[nome]) || 'img/' + nome + '.png'; }

  function el(tag, classe, filhos) {
    var e = document.createElement(tag);
    if (classe) e.className = classe;
    (filhos || []).forEach(function (f) { e.appendChild(typeof f === 'string' ? document.createTextNode(f) : f); });
    return e;
  }

  function img(src, classe) {
    var i = el('img', classe);
    i.src = src;
    i.alt = '';
    return i;
  }

  function embaralhar(lista) {
    for (var i = lista.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = lista[i]; lista[i] = lista[j]; lista[j] = t;
    }
    return lista;
  }

  // ------------------------------------------------------------------ guardado no aparelho

  var Guardado = {
    ler: function (chave, padrao) {
      try {
        var v = localStorage.getItem('helpkids.' + chave);
        return v === null ? padrao : JSON.parse(v);
      } catch (e) {
        return padrao;
      }
    },
    gravar: function (chave, valor) {
      try {
        localStorage.setItem('helpkids.' + chave, JSON.stringify(valor));
      } catch (e) {
        // sem espaco ou navegacao privada: o jogo continua, so nao guarda
      }
    }
  };

  // Jogadores.java
  var Jogadores = {
    dados: function () { return Guardado.ler('jogadores', {lista: [], atual: null, niveis: {}}); },
    salvar: function (d) { Guardado.gravar('jogadores', d); },
    todos: function () { return this.dados().lista.slice(); },
    atual: function () {
      var d = this.dados();
      return d.atual && d.lista.indexOf(d.atual) >= 0 ? d.atual : null;
    },
    escolher: function (nome) {
      var d = this.dados();
      d.atual = nome;
      this.salvar(d);
    },
    /** adiciona e ja escolhe; devolve o nome limpo, ou null se vazio ou repetido */
    adicionar: function (nome) {
      // "|" separa jogador e categoria nas chaves dos recordes
      var limpo = (nome || '').replace(/\|/g, ' ').trim().replace(/\s+/g, ' ');
      if (limpo.length > TAMANHO_MAXIMO_NOME) limpo = limpo.substring(0, TAMANHO_MAXIMO_NOME).trim();
      if (!limpo) return null;
      var d = this.dados();
      for (var i = 0; i < d.lista.length; i++) {
        if (d.lista[i].toLowerCase() === limpo.toLowerCase()) return null;
      }
      d.lista.push(limpo);
      d.atual = limpo;
      this.salvar(d);
      return limpo;
    },
    remover: function (nome) {
      var d = this.dados();
      d.lista = d.lista.filter(function (n) { return n !== nome; });
      if (d.atual === nome) d.atual = null;
      this.salvar(d);
    },
    /** mesma cor do Android para o mesmo nome (String.hashCode do Java) */
    cor: function (nome) {
      var s = nome.toLowerCase(), h = 0;
      for (var i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
      return CORES_JOGADOR[Math.abs(h % CORES_JOGADOR.length)];
    },
    nivelPreferido: function (nome) {
      var id = this.dados().niveis[nome];
      return nivelPorId(id) || NIVEIS[1];
    },
    salvarNivel: function (nome, nivel) {
      var d = this.dados();
      d.niveis[nome] = nivel.id;
      this.salvar(d);
    }
  };

  function nivelPorId(id) {
    for (var i = 0; i < NIVEIS.length; i++) if (NIVEIS[i].id === id) return NIVEIS[i];
    return null;
  }

  // Pontuacao.java: chaves "tipo|jogador|categoria" como no Android
  var Pontuacao = {
    tudo: function () { return Guardado.ler('pontuacao', {}); },
    chave: function (tipo, jogador, categoria) { return tipo + '|' + jogador + '|' + categoria; },
    pontosDoAcerto: function (nivel, erros) {
      if (erros === 0) return nivel.primeira;
      return erros === 1 ? nivel.segunda : 0;
    },
    maximo: function (nivel) { return PERGUNTAS_POR_PARTIDA * nivel.primeira; },
    estrelas: function (pontos, nivel) {
      if (pontos <= 0) return 0;
      if (pontos * 10 >= this.maximo(nivel) * 9) return 3;
      return pontos * 10 >= this.maximo(nivel) * 6 ? 2 : 1;
    },
    valor: function (tipo, jogador, categoria) { return this.tudo()[this.chave(tipo, jogador, categoria)] || 0; },
    recorde: function (j, c) { return this.valor('melhor', j, c); },
    estrelasDe: function (j, c) { return this.valor('estrelas', j, c); },
    partidas: function (j, c) { return this.valor('partidas', j, c); },
    /** guarda a partida; true se for recorde novo */
    terminarPartida: function (jogador, categoria, nivel, pontos) {
      var t = this.tudo();
      var k = this.chave.bind(this);
      t[k('partidas', jogador, categoria)] = (t[k('partidas', jogador, categoria)] || 0) + 1;
      var recorde = pontos > (t[k('melhor', jogador, categoria)] || 0);
      if (recorde) {
        t[k('melhor', jogador, categoria)] = pontos;
        t[k('nivel', jogador, categoria)] = nivel.id;
      }
      var e = this.estrelas(pontos, nivel);
      if (e > (t[k('estrelas', jogador, categoria)] || 0)) t[k('estrelas', jogador, categoria)] = e;
      Guardado.gravar('pontuacao', t);
      return recorde;
    },
    registrarErro: function (jogador, categoria, som) {
      var t = this.tudo();
      var c = this.chave('erro', jogador, categoria) + '|' + som;
      t[c] = (t[c] || 0) + 1;
      Guardado.gravar('pontuacao', t);
    },
    maisErradas: function (jogador, categoria, limite) {
      var prefixo = this.chave('erro', jogador, categoria) + '|';
      var t = this.tudo(), erros = [];
      Object.keys(t).forEach(function (c) {
        if (c.indexOf(prefixo) === 0) erros.push([c.substring(prefixo.length), t[c]]);
      });
      erros.sort(function (a, b) { return b[1] - a[1]; });
      return erros.slice(0, limite);
    },
    /** um jogador por linha: melhor partida na categoria, ou a soma de todas (categoria null) */
    classificacao: function (categoria) {
      var t = this.tudo(), por = {};
      Object.keys(t).forEach(function (c) {
        var p = c.split('|');
        if (p.length !== 3 || p[0] !== 'melhor') return;
        var jogador = p[1], cat = p[2], pontos = t[c];
        if (categoria !== null) {
          if (cat === categoria) por[jogador] = {jogador: jogador, pontos: pontos, nivel: nivelPorId(t['nivel|' + jogador + '|' + cat])};
          return;
        }
        if (!por[jogador]) por[jogador] = {jogador: jogador, pontos: 0, categorias: 0};
        por[jogador].pontos += pontos;
        por[jogador].categorias++;
      });
      return Object.keys(por).map(function (j) { return por[j]; }).sort(function (a, b) {
        return a.pontos !== b.pontos ? b.pontos - a.pontos : a.jogador.toLowerCase().localeCompare(b.jogador.toLowerCase());
      });
    },
    posicao: function (jogador, categoria) {
      var lista = this.classificacao(categoria);
      for (var i = 0; i < lista.length; i++) if (lista[i].jogador === jogador) return i + 1;
      return 0;
    },
    zerarTudo: function () { Guardado.gravar('pontuacao', {}); }
  };

  // ------------------------------------------------------------------ sons

  /**
   * Sons pela Web Audio API: os WAV sao lidos uma vez e tocam na hora do toque. No iPhone o
   * audio so pode comecar dentro de um toque, entao o primeiro toque em qualquer lugar "destrava".
   */
  var Sons = {
    ctx: null,
    buffers: {},
    carregando: {},
    ligado: Guardado.ler('som', true),

    contexto: function () {
      if (!this.ctx) {
        var AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return null;
        // iPhone: tocar mesmo com a chave do silencioso ligada (Safari 17+)
        try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch (e) { /* ignora */ }
        this.ctx = new AC();
      }
      return this.ctx;
    },

    destravar: function () {
      var ctx = this.contexto();
      if (!ctx) return;
      if (ctx.state !== 'running') ctx.resume();
      if (!this.destravado) {
        // um som mudo dentro do toque libera o audio no iOS antigo
        var b = ctx.createBuffer(1, 1, 22050), s = ctx.createBufferSource();
        s.buffer = b;
        s.connect(ctx.destination);
        s.start(0);
        this.destravado = true;
      }
    },

    carregar: function (nome) {
      var self = this;
      if (this.buffers[nome]) return Promise.resolve(this.buffers[nome]);
      if (this.carregando[nome]) return this.carregando[nome];
      var ctx = this.contexto();
      if (!ctx) return Promise.resolve(null);
      this.carregando[nome] = fetch('som/' + nome + '.wav')
        .then(function (r) { return r.arrayBuffer(); })
        .then(function (dados) {
          return new Promise(function (ok, erro) { ctx.decodeAudioData(dados, ok, erro); });
        })
        .then(function (buffer) { self.buffers[nome] = buffer; return buffer; })
        .catch(function () { delete self.carregando[nome]; return null; });
      return this.carregando[nome];
    },

    carregarVarios: function (nomes) { nomes.forEach(this.carregar.bind(this)); },

    tocar: function (nome) {
      if (!this.ligado) return;
      var ctx = this.contexto();
      if (!ctx) return;
      if (ctx.state !== 'running') ctx.resume();
      var pedido = Date.now();
      var tocarBuffer = function (buffer) {
        // se demorou para carregar, nao toca atrasado
        if (!buffer || Date.now() - pedido > 1500) return;
        var s = ctx.createBufferSource();
        s.buffer = buffer;
        s.connect(ctx.destination);
        s.start(0);
      };
      if (this.buffers[nome]) tocarBuffer(this.buffers[nome]);
      else this.carregar(nome).then(tocarBuffer);
    },

    setLigado: function (ligado) {
      this.ligado = ligado;
      Guardado.gravar('som', ligado);
    }
  };

  ['pointerdown', 'touchend', 'keydown'].forEach(function (ev) {
    document.addEventListener(ev, function () { Sons.destravar(); }, {capture: true, passive: true});
  });
  document.addEventListener('visibilitychange', function () {
    if (!document.hidden && Sons.ctx && Sons.ctx.state !== 'running') Sons.ctx.resume();
  });

  // ------------------------------------------------------------------ fogos (FogosView.java)

  function Fogos(canvas) {
    this.canvas = canvas;
    this.faiscas = [];
    this.pendentes = [];
    this.rodando = false;
  }
  Fogos.CORES = ['rgb(255,64,64)', 'rgb(255,196,0)', 'rgb(64,200,255)', 'rgb(120,230,60)', 'rgb(255,90,200)', 'rgb(255,140,0)', '#fff'];
  Fogos.prototype.soltar = function (quantidade, intervalo) {
    var agora = performance.now();
    for (var i = 0; i < quantidade; i++) this.pendentes.push(agora + i * intervalo);
    this.iniciar();
  };
  Fogos.prototype.parar = function () {
    this.pendentes = [];
    this.faiscas = [];
    var c = this.canvas;
    c.getContext('2d').clearRect(0, 0, c.width, c.height);
  };
  Fogos.prototype.iniciar = function () {
    if (this.rodando) return;
    this.rodando = true;
    var self = this;
    requestAnimationFrame(function quadro(t) { if (self.desenhar(t)) requestAnimationFrame(quadro); else self.rodando = false; });
  };
  Fogos.prototype.explodir = function (agora, w, h) {
    var x = w * (0.15 + 0.7 * Math.random()), y = h * (0.15 + 0.45 * Math.random());
    var base = Fogos.CORES[Math.floor(Math.random() * Fogos.CORES.length)];
    for (var i = 0; i < 46; i++) {
      var ang = 2 * Math.PI * i / 46 + Math.random() * 0.2;
      var vel = 160 + Math.random() * 200;
      var cor = Math.random() < 0.25 ? Fogos.CORES[Math.floor(Math.random() * Fogos.CORES.length)] : base;
      this.faiscas.push({x: x, y: y, vx: Math.cos(ang) * vel, vy: Math.sin(ang) * vel, cor: cor, inicio: agora});
    }
  };
  Fogos.prototype.desenhar = function (agora) {
    var c = this.canvas, dpr = window.devicePixelRatio || 1;
    var w = c.clientWidth, h = c.clientHeight;
    if (c.width !== Math.round(w * dpr) || c.height !== Math.round(h * dpr)) {
      c.width = Math.round(w * dpr);
      c.height = Math.round(h * dpr);
    }
    var g = c.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, w, h);
    var self = this;
    this.pendentes = this.pendentes.filter(function (quando) {
      if (quando <= agora) { self.explodir(agora, w, h); return false; }
      return true;
    });
    var gravidade = 260;
    this.faiscas = this.faiscas.filter(function (f) {
      var t = (agora - f.inicio) / 1000, vida = (agora - f.inicio) / 1300;
      if (vida >= 1) return false;
      var freio = 1 - vida * 0.55;
      var x = f.x + f.vx * t * freio, y = f.y + f.vy * t * freio + 0.5 * gravidade * t * t;
      g.globalAlpha = 1 - vida;
      g.fillStyle = f.cor;
      g.beginPath();
      g.arc(x, y, 3.2 - 1.8 * vida, 0, 2 * Math.PI);
      g.fill();
      return true;
    });
    g.globalAlpha = 1;
    return this.faiscas.length > 0 || this.pendentes.length > 0;
  };

  // ------------------------------------------------------------------ telas

  var telaAtual = 'inicio';
  var aoMostrar = {};

  function mostrar(id, dados) {
    if (telaAtual === 'jogo' && id !== 'jogo') Jogo.sair();
    document.querySelectorAll('.tela').forEach(function (t) { t.classList.toggle('ativa', t.id === id); });
    telaAtual = id;
    if (aoMostrar[id]) aoMostrar[id](dados);
    ajustarNuvens();
  }

  /** diminui a letra do texto das nuvens de titulo ate caber (nomes compridos, celular) */
  function ajustarNuvens() {
    document.querySelectorAll('.tela.ativa .nuvem span').forEach(function (t) {
      t.style.fontSize = '';
      if (t.scrollWidth > t.clientWidth && t.clientWidth > 0) {
        var atual = parseFloat(getComputedStyle(t).fontSize);
        t.style.fontSize = Math.max(10, atual * t.clientWidth / t.scrollWidth * 0.97) + 'px';
      }
    });
  }
  window.addEventListener('resize', ajustarNuvens);
  // a letra Fredoka carrega depois; mede de novo quando ela chegar
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(ajustarNuvens);

  document.querySelectorAll('[data-volta]').forEach(function (b) {
    b.addEventListener('click', function () {
      Sons.tocar('back');
      mostrar(b.getAttribute('data-volta'));
    });
  });

  // caixa de dialogo: devolve uma Promise com o texto digitado (ou true), ou null se cancelou
  function dialogo(opcoes) {
    return new Promise(function (resolver) {
      var fundo = $('dialogo'), campo = $('dialogoCampo');
      // titulo e botao OK sao artes com a escrita (opcoes.tituloArte, opcoes.okArte); texto so se nao houver arte
      var tituloImg = $('dialogoTituloImg');
      tituloImg.hidden = !opcoes.tituloArte;
      if (opcoes.tituloArte) { tituloImg.src = imagem(opcoes.tituloArte); tituloImg.alt = opcoes.titulo || ''; }
      $('dialogoTitulo').textContent = opcoes.tituloArte ? '' : (opcoes.titulo || '');
      $('dialogoTexto').textContent = opcoes.texto || '';
      $('dialogoOkImg').src = imagem(opcoes.okArte || 'botao_ok');
      $('dialogoOk').setAttribute('aria-label', opcoes.ok || 'OK');
      campo.style.display = opcoes.campo ? '' : 'none';
      campo.value = '';
      campo.placeholder = (opcoes.campo && opcoes.campo.dica) || '';
      campo.inputMode = (opcoes.campo && opcoes.campo.numero) ? 'numeric' : 'text';
      campo.classList.toggle('numero', !!(opcoes.campo && opcoes.campo.numero));
      campo.type = (opcoes.campo && opcoes.campo.numero) ? 'tel' : 'text';
      campo.maxLength = (opcoes.campo && opcoes.campo.max) || 100;
      campo.autocapitalize = 'words';
      fundo.hidden = false;
      if (opcoes.campo) setTimeout(function () { campo.focus(); }, 50);

      function fechar(valor) {
        fundo.hidden = true;
        $('dialogoCaixa').onsubmit = null;
        $('dialogoCancelar').onclick = null;
        $('dialogoFechar').onclick = null;
        fundo.onclick = null;
        resolver(valor);
      }
      $('dialogoCaixa').onsubmit = function (e) {
        e.preventDefault();
        fechar(opcoes.campo ? campo.value : true);
      };
      $('dialogoCancelar').onclick = function () { fechar(null); };
      $('dialogoFechar').onclick = function () { fechar(null); };
      fundo.onclick = function (e) { if (e.target === fundo) fechar(null); };
    });
  }

  var tempoToast;
  function avisoCurto(texto) {
    var t = $('aviso-curto');
    t.textContent = texto;
    t.classList.add('visivel');
    clearTimeout(tempoToast);
    tempoToast = setTimeout(function () { t.classList.remove('visivel'); }, 2200);
  }

  function medalha(estrelas) {
    if (estrelas <= 0) return null;
    return img(imagem('medalha_' + (estrelas >= 3 ? 'ouro' : estrelas === 2 ? 'prata' : 'bronze')));
  }

  function mostrarPlaquinha(elemento, texto) {
    elemento.textContent = texto;
    elemento.classList.remove('visivel');
    void elemento.offsetWidth; // reinicia a animacao
    elemento.classList.add('visivel');
    ajustarTexto(elemento);
  }

  function esconderPlaquinha(elemento) { elemento.classList.remove('visivel'); }

  /** diminui a letra se a palavra nao couber (como no Android) */
  function ajustarTexto(elemento) {
    elemento.style.fontSize = '';
    var pai = elemento.parentElement;
    var disponivel = pai.clientWidth;
    if (disponivel > 0 && elemento.offsetWidth > disponivel) {
      var atual = parseFloat(getComputedStyle(elemento).fontSize);
      elemento.style.fontSize = (atual * disponivel / elemento.offsetWidth * 0.95) + 'px';
    }
  }

  // ------------------------------------------------------------------ tela inicial

  aoMostrar.inicio = function () {
    var j = Jogadores.atual();
    // a nuvem "Quem vai jogar?" fica sempre; o nome do jogador escolhido aparece numa plaquinha embaixo dela
    $('txtJogador').textContent = j || '';
    $('btnJogador').setAttribute('aria-label', j ? 'Jogador: ' + j + ' (tocar para trocar)' : 'Quem vai jogar?');
  };

  $('btnPlay').addEventListener('click', function () {
    Sons.tocar('play');
    if (!Jogadores.atual()) mostrar('jogadores', {abrirMenu: true});
    else mostrar('menu');
  });

  $('btnJogador').addEventListener('click', function () { mostrar('jogadores', {abrirMenu: false}); });

  // engrenagem: uma continha antes da area dos pais
  $('btnPais').addEventListener('click', function () {
    var a = 3 + Math.floor(Math.random() * 7), b = 3 + Math.floor(Math.random() * 7);
    dialogo({titulo: 'Área dos pais', tituloArte: 'titulo_area_dos_pais', texto: 'Quanto é ' + a + ' + ' + b + '?', campo: {numero: true, dica: '?', max: 3}})
      .then(function (resposta) {
        if (resposta === null) return;
        if (String(a + b) === resposta.trim()) mostrar('pais');
        else avisoCurto('Resposta errada');
      });
  });

  // ------------------------------------------------------------------ menu

  (function montarMenu() {
    var grade = $('gradeMenu');
    CATEGORIAS.forEach(function (cat) {
      var botao = el('button', '', [img(imagem(cat.icone))]);
      botao.setAttribute('aria-label', cat.nome);
      botao.addEventListener('click', function () { mostrar('categoria', cat); });
      var recorde = el('div', 'recorde-menu');
      recorde.id = 'recorde-' + cat.id;
      grade.appendChild(el('div', 'item-menu', [botao, recorde]));
    });
  })();

  aoMostrar.menu = function () {
    var j = Jogadores.atual();
    // trofeu: soma das melhores partidas do jogador em todas as categorias
    $('menuPontos').textContent = String(j ? CATEGORIAS.reduce(function (t, c) { return t + Pontuacao.recorde(j, c.id); }, 0) : 0);
    CATEGORIAS.forEach(function (cat) {
      var caixa = $('recorde-' + cat.id);
      caixa.textContent = '';
      var recorde = j ? Pontuacao.recorde(j, cat.id) : 0;
      if (recorde <= 0) return;
      var m = medalha(Pontuacao.estrelasDe(j, cat.id)) || img('img/estrela_placar.webp');
      caixa.appendChild(m);
      caixa.appendChild(document.createTextNode(String(recorde)));
      caixa.title = 'Recorde: ' + recorde;
    });
  };

  $('menuRanking').addEventListener('click', function () { mostrar('ranking', {filtro: null, volta: 'menu'}); });

  // ------------------------------------------------------------------ figuras da categoria

  var categoriaAtual = null;

  aoMostrar.categoria = function (cat) {
    if (cat) categoriaAtual = cat;
    cat = categoriaAtual;
    var lista = window.LISTAS[cat.lista];
    $('fundoCategoria').src = imagem(cat.fundo);
    esconderPlaquinha($('palavraCategoria'));
    var grade = $('gradeFiguras');
    grade.textContent = '';
    lista.forEach(function (item) {
      var b = el('button', 'item-figura', [img(item.imagem)]);
      b.setAttribute('aria-label', item.palavra);
      b.addEventListener('click', function () {
        Sons.tocar(item.som);
        mostrarPlaquinha($('palavraCategoria'), item.palavra);
      });
      grade.appendChild(b);
    });
    grade.parentElement.scrollTop = 0;
    Sons.carregarVarios(lista.map(function (i) { return i.som; }));
  };

  $('btnJogar').addEventListener('click', function () {
    Sons.tocar('next');
    mostrar('jogo', categoriaAtual);
  });

  // ------------------------------------------------------------------ jogo (AtividadeActivity)

  var Jogo = {
    timers: [],
    depois: function (ms, f) { this.timers.push(setTimeout(f, ms)); },
    limparTimers: function () { this.timers.forEach(clearTimeout); this.timers = []; },

    entrar: function (cat) {
      this.cat = cat;
      this.todas = window.LISTAS[cat.lista];
      this.saco = [];
      this.ultimaCorreta = null;
      this.jogador = Jogadores.atual() || 'Jogador';
      this.fogos = this.fogos || new Fogos($('fogos'));
      this.fogosFim = this.fogosFim || new Fogos($('fogosFim'));
      Sons.carregarVarios(this.todas.map(function (i) { return i.som; }).concat(['efeito_acerto', 'efeito_erro']));
      $('gradeOpcoes').textContent = '';
      $('txtPontos').textContent = '0';
      $('txtProgresso').textContent = '';
      $('txtLider').textContent = '';
      $('txtRecorde').textContent = '';
      esconderPlaquinha($('palavraJogo'));
      this.mostrarEscolhaNivel();
    },

    sair: function () {
      this.limparTimers();
      this.correta = null;
      if (this.fogos) this.fogos.parar();
      if (this.fogosFim) this.fogosFim.parar();
      ['aviso', 'fim', 'nivel'].forEach(function (id) { $(id).classList.remove('visivel'); });
    },

    mostrarEscolhaNivel: function () {
      var self = this;
      this.limparTimers();
      this.correta = null;
      $('fim').classList.remove('visivel');
      this.fogosFim.parar();
      $('nivelJogador').textContent = 'Jogador: ' + this.jogador;
      var preferido = Jogadores.nivelPreferido(this.jogador);
      var caixa = $('botoesNivel');
      caixa.textContent = '';
      NIVEIS.forEach(function (n) {
        var b = el('button', 'botao-nivel' + (n === preferido ? ' preferido' : ''), [
          img(imagem(n.arte), 'arte'),
          el('span', 'info', [n.figuras + ' figuras\n1ª ' + n.primeira + ' · 2ª ' + n.segunda + ' pts'])
        ]);
        b.setAttribute('aria-label', n.nome);
        b.addEventListener('click', function () {
          Sons.tocar('play');
          Jogadores.salvarNivel(self.jogador, n);
          $('nivel').classList.remove('visivel');
          self.nivel = n;
          self.comecarPartida(SOM_PRIMEIRA_RODADA_MS);
        });
        caixa.appendChild(b);
      });
      $('nivel').classList.add('visivel');
    },

    comecarPartida: function (atrasoSom) {
      this.pontos = 0;
      this.pergunta = 0;
      this.recorde = Pontuacao.recorde(this.jogador, this.cat.id);
      $('fim').classList.remove('visivel');
      this.fogosFim.parar();
      this.atualizarColunas();
      this.atualizarPlacar();
      this.proximaRodada(atrasoSom);
    },

    /** Hard: 4 colunas deitado, 2 em pe; Easy e Medium: 2 colunas */
    atualizarColunas: function () {
      var deitado = window.innerWidth > window.innerHeight;
      var colunas = this.nivel && this.nivel.figuras >= 8 && deitado ? 4 : 2;
      $('gradeOpcoes').style.setProperty('--colunas', colunas);
    },

    proximaRodada: function (atrasoSom) {
      var self = this;
      this.pergunta++;
      this.erros = 0;
      this.correta = this.tirarDoSaco();
      var opcoes = this.montarOpcoes(this.correta, Math.min(this.nivel.figuras, this.todas.length));
      var grade = $('gradeOpcoes');
      grade.textContent = '';
      opcoes.forEach(function (op) {
        var b = el('button', 'opcao', [img(op.imagem)]);
        b.setAttribute('aria-label', op.palavra);
        b.opcao = op;
        b.addEventListener('click', function () { self.escolher(op); });
        grade.appendChild(b);
      });
      esconderPlaquinha($('palavraJogo'));
      this.atualizarProgresso(this.pergunta - 1);
      this.depois(atrasoSom, this.tocarPalavra.bind(this));
    },

    /** todas saem antes de repetir, e nunca a mesma duas vezes seguidas */
    tirarDoSaco: function () {
      if (this.saco.length === 0) {
        this.saco = embaralhar(this.todas.slice());
        if (this.saco.length > 1 && this.saco[0] === this.ultimaCorreta) {
          var t = this.saco[0]; this.saco[0] = this.saco[this.saco.length - 1]; this.saco[this.saco.length - 1] = t;
        }
      }
      this.ultimaCorreta = this.saco.shift();
      return this.ultimaCorreta;
    },

    montarOpcoes: function (certa, quantidade) {
      var outras = embaralhar(this.todas.filter(function (o) { return o !== certa; }));
      var opcoes = outras.slice(0, quantidade - 1);
      opcoes.push(certa);
      return embaralhar(opcoes);
    },

    tocarPalavra: function () {
      if (telaAtual !== 'jogo' || document.hidden || !this.correta || $('fim').classList.contains('visivel')) return;
      Sons.tocar(this.correta.som);
      var p = $('palavraJogo');
      if (!p.classList.contains('visivel')) mostrarPlaquinha(p, this.correta.palavra);
    },

    escolher: function (op) {
      if (!this.correta || $('aviso').classList.contains('visivel')) return;
      if (op === this.correta) this.mostrarAcerto();
      else this.mostrarErro();
    },

    mostrarAcerto: function () {
      var self = this;
      var ganho = Pontuacao.pontosDoAcerto(this.nivel, this.erros);
      this.pontos += ganho;
      this.pararAjuda();
      $('avisoSeta').classList.remove('gira');
      this.mostrarAviso('Very good!', 'var(--amarelo)');
      Sons.tocar('efeito_acerto');
      this.fogos.soltar(5, 280);
      this.depois(AVISO_ACERTO_MS, function () {
        self.esconderAviso();
        self.animarPlacar(ganho);
        if (self.pergunta >= PERGUNTAS_POR_PARTIDA) self.mostrarFim();
        else self.proximaRodada(SOM_PROXIMA_RODADA_MS);
      });
    },

    mostrarErro: function () {
      var self = this;
      if (this.erros === 0) Pontuacao.registrarErro(this.jogador, this.cat.id, this.correta.som);
      this.erros++;
      var seta = $('avisoSeta');
      seta.classList.remove('gira');
      void seta.offsetWidth;
      seta.classList.add('gira');
      this.mostrarAviso('Try Again', 'var(--laranja)');
      Sons.tocar('efeito_erro');
      this.depois(AVISO_ERRO_MS, function () {
        self.esconderAviso();
        if (self.erros >= ERROS_PARA_AJUDA) self.mostrarAjuda();
        self.depois(SOM_DEPOIS_DO_ERRO_MS, self.tocarPalavra.bind(self));
      });
    },

    mostrarAjuda: function () {
      var certa = this.correta;
      $('gradeOpcoes').querySelectorAll('.opcao').forEach(function (b) {
        if (b.opcao === certa) b.classList.add('ajuda');
      });
    },

    pararAjuda: function () {
      $('gradeOpcoes').querySelectorAll('.opcao').forEach(function (b) { b.classList.remove('ajuda'); });
    },

    mostrarAviso: function (texto, cor) {
      var t = $('avisoTexto');
      t.textContent = texto;
      t.style.color = cor;
      t.style.animation = 'none';
      void t.offsetWidth;
      t.style.animation = '';
      $('aviso').classList.add('visivel');
    },

    esconderAviso: function () {
      $('aviso').classList.remove('visivel');
      this.fogos.parar();
    },

    mostrarFim: function () {
      var self = this;
      var novoRecorde = Pontuacao.terminarPartida(this.jogador, this.cat.id, this.nivel, this.pontos);
      if (novoRecorde) this.recorde = this.pontos;
      this.atualizarPlacar();
      this.atualizarProgresso(PERGUNTAS_POR_PARTIDA);
      var estrelas = Pontuacao.estrelas(this.pontos, this.nivel);
      $('fimTitulo').textContent = estrelas >= 3 ? 'Excellent!' : estrelas === 2 ? 'Great job!' : 'Good job!';
      $('fimPontos').textContent = this.pontos + ' pontos';
      $('fimRecorde').classList.toggle('visivel', novoRecorde);
      var lugar = Pontuacao.posicao(this.jogador, this.cat.id);
      $('fimPosicao').textContent = lugar === 1
        ? 'Você está em 1º lugar em ' + this.cat.nome + '!'
        : 'Você está em ' + lugar + 'º lugar em ' + this.cat.nome;
      document.querySelectorAll('.fim-estrelas img').forEach(function (e, i) {
        e.src = i < estrelas ? 'img/estrela_placar.webp' : 'img/estrela_vazia.webp';
        e.classList.remove('mostra');
        e.style.animationDelay = (300 + i * 250) + 'ms';
        void e.offsetWidth;
        e.classList.add('mostra');
      });
      $('fim').classList.add('visivel');
      $('fim').querySelector('.camada-rolagem').scrollTop = 0;
      Sons.tocar('efeito_acerto');
      this.fogosFim.soltar(2 + estrelas * 2, 300);
      self.correta = null;
    },

    animarPlacar: function (ganho) {
      this.atualizarPlacar();
      var g = $('txtGanho');
      g.textContent = '+' + ganho;
      g.classList.remove('sobe');
      void g.offsetWidth;
      g.classList.add('sobe');
      var e = $('imgEstrela');
      e.classList.remove('estrela-pula');
      void e.offsetWidth;
      e.classList.add('estrela-pula');
    },

    atualizarPlacar: function () {
      $('txtPontos').textContent = String(this.pontos);
      $('txtRecorde').textContent = 'Recorde: ' + this.recorde;
      var classificacao = Pontuacao.classificacao(this.cat.id);
      $('txtLider').textContent = classificacao.length
        ? '1º ' + classificacao[0].jogador + ' · ' + classificacao[0].pontos : '';
    },

    atualizarProgresso: function (respondidas) {
      var s = '';
      for (var i = 0; i < PERGUNTAS_POR_PARTIDA; i++) s += i < respondidas ? '●' : '○';
      $('txtProgresso').textContent = s;
      $('txtProgresso').setAttribute('aria-label', respondidas + ' de ' + PERGUNTAS_POR_PARTIDA);
    }
  };

  aoMostrar.jogo = function (cat) { Jogo.entrar(cat); };

  $('btnSom').addEventListener('click', function () { Jogo.tocarPalavra(); });
  $('fimDeNovo').addEventListener('click', function () { Sons.tocar('play'); Jogo.mostrarEscolhaNivel(); });
  $('fimRanking').addEventListener('click', function () {
    mostrar('ranking', {filtro: Jogo.cat.id, volta: 'menu'});
  });
  window.addEventListener('resize', function () {
    if (telaAtual === 'jogo') Jogo.atualizarColunas();
  });

  // ------------------------------------------------------------------ jogadores

  var abrirMenuDepois = false;

  aoMostrar.jogadores = function (dados) {
    abrirMenuDepois = !!(dados && dados.abrirMenu);
    listarJogadores();
    if (Jogadores.todos().length === 0) novoJogador(); // primeira vez: ja pede o nome
  };

  function listarJogadores() {
    var lista = $('listaJogadores'), atual = Jogadores.atual();
    lista.textContent = '';
    Jogadores.todos().forEach(function (nome) {
      var avatar = el('span', 'avatar', [nome.charAt(0).toUpperCase()]);
      avatar.style.background = Jogadores.cor(nome);
      var cartao = el('button', 'cartao cartao-jogador' + (nome === atual ? ' selecionado' : ''), [avatar, el('span', 'nome', [nome])]);
      cartao.setAttribute('aria-label', nome);
      tocarESegurar(cartao, function () { escolherJogador(nome); }, function () { confirmarRemocao(nome); });
      lista.appendChild(cartao);
    });
  }

  /** toque normal chama 'toque'; tocar e segurar meio segundo chama 'segurar' */
  function tocarESegurar(elemento, toque, segurar) {
    var tempo = null, segurou = false, x0 = 0, y0 = 0;
    elemento.addEventListener('pointerdown', function (e) {
      segurou = false;
      x0 = e.clientX; y0 = e.clientY;
      tempo = setTimeout(function () { segurou = true; tempo = null; segurar(); }, 550);
    });
    var cancelar = function () { if (tempo) { clearTimeout(tempo); tempo = null; } };
    elemento.addEventListener('pointermove', function (e) {
      if (Math.abs(e.clientX - x0) > 10 || Math.abs(e.clientY - y0) > 10) cancelar();
    });
    elemento.addEventListener('pointerup', cancelar);
    elemento.addEventListener('pointercancel', cancelar);
    elemento.addEventListener('pointerleave', cancelar);
    elemento.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    elemento.addEventListener('click', function () { if (!segurou) toque(); });
  }

  function escolherJogador(nome) {
    Jogadores.escolher(nome);
    Sons.tocar('play');
    mostrar(abrirMenuDepois ? 'menu' : 'inicio');
  }

  function novoJogador() {
    dialogo({titulo: '+ Novo jogador', tituloArte: 'titulo_novo_jogador', campo: {dica: 'Nome do jogador', max: TAMANHO_MAXIMO_NOME}}).then(function (nome) {
      if (nome === null) return;
      var limpo = Jogadores.adicionar(nome);
      if (!limpo) {
        avisoCurto('Digite um nome que ainda não exista');
        return;
      }
      escolherJogador(limpo);
    });
  }

  function confirmarRemocao(nome) {
    dialogo({texto: 'Remover ' + nome + '? Os recordes dele continuam no ranking.', ok: 'Remover', okArte: 'botao_remover'}).then(function (sim) {
      if (!sim) return;
      Jogadores.remover(nome);
      listarJogadores();
    });
  }

  $('novoJogador').addEventListener('click', novoJogador);
  $('jogadoresVoltar').addEventListener('click', function () { Sons.tocar('back'); mostrar('inicio'); });

  // ------------------------------------------------------------------ ranking

  var ranking = {filtro: null, volta: 'menu'};

  aoMostrar.ranking = function (dados) {
    if (dados) ranking = dados;
    montarFiltros();
    listarRanking();
  };

  function montarFiltros() {
    var caixa = $('filtrosRanking');
    caixa.textContent = '';
    [{id: null, nome: 'Todas'}].concat(CATEGORIAS).forEach(function (cat) {
      var b = el('button', 'filtro' + (cat.id === ranking.filtro ? ' selecionado' : ''), [cat.nome]);
      b.addEventListener('click', function () {
        ranking.filtro = cat.id;
        montarFiltros();
        listarRanking();
      });
      caixa.appendChild(b);
    });
    var escolhido = caixa.querySelector('.selecionado');
    if (escolhido) escolhido.scrollIntoView({inline: 'center', block: 'nearest'});
  }

  function listarRanking() {
    var lista = $('listaRanking'), posicoes = Pontuacao.classificacao(ranking.filtro), atual = Jogadores.atual();
    lista.textContent = '';
    if (posicoes.length === 0) {
      lista.appendChild(el('div', 'cartao vazio', ['Ninguém jogou ainda. Termine uma partida para aparecer aqui!']));
      return;
    }
    posicoes.forEach(function (p, i) {
      var posicao = el('div', 'posicao');
      var m = medalha(3 - i); // 1o ouro, 2o prata, 3o bronze
      if (m) posicao.appendChild(m);
      posicao.appendChild(document.createTextNode((i + 1) + 'º'));
      var avatar = el('span', 'avatar', [p.jogador.charAt(0).toUpperCase()]);
      avatar.style.background = Jogadores.cor(p.jogador);
      var voce = p.jogador === atual;
      var detalhe = ranking.filtro === null ? p.categorias + ' de ' + CATEGORIAS.length + ' categorias'
        : p.nivel ? p.nivel.nome : '';
      var quem = el('div', 'quem', [el('div', 'nome', [voce ? p.jogador + ' (você)' : p.jogador]), el('div', 'detalhe', [detalhe])]);
      var pontos = el('div', 'pontos', [img('img/estrela_placar.webp'), String(p.pontos)]);
      lista.appendChild(el('div', 'cartao linha-ranking' + (voce ? ' selecionado' : ''), [posicao, avatar, quem, pontos]));
    });
  }

  $('rankingVoltar').addEventListener('click', function () {
    Sons.tocar('back');
    mostrar(ranking.volta);
  });

  // ------------------------------------------------------------------ area dos pais

  aoMostrar.pais = function () {
    var jogador = Jogadores.atual();
    $('somLigado').checked = Sons.ligado;
    $('paisJogador').textContent = jogador ? 'Jogador: ' + jogador : 'Escolha um jogador na tela inicial para ver o progresso dele.';
    var lista = $('listaCategoriasPais');
    lista.textContent = '';
    if (!jogador) return;
    CATEGORIAS.forEach(function (cat) {
      var nome = el('div', 'nome', [cat.nome]);
      var m = medalha(Pontuacao.estrelasDe(jogador, cat.id));
      if (m) nome.appendChild(m);
      var partidas = Pontuacao.partidas(jogador, cat.id);
      var resumo = partidas === 0 ? 'Ainda não jogou'
        : 'Melhor partida: ' + Pontuacao.recorde(jogador, cat.id) + ' pontos · ' + partidas + ' partidas';
      var texto = el('div', 'texto', [nome, el('div', 'det', [resumo]), el('div', 'det', [maisErradas(jogador, cat)])]);
      lista.appendChild(el('div', 'cartao-pais', [img(imagem(cat.icone), 'icone'), texto]));
    });
  };

  function maisErradas(jogador, cat) {
    var erros = Pontuacao.maisErradas(jogador, cat.id, 5);
    if (erros.length === 0) return 'Nenhum erro ainda';
    var palavras = {};
    window.LISTAS[cat.lista].forEach(function (i) { palavras[i.som] = i.palavra; });
    return 'Mais erradas: ' + erros.map(function (e) {
      return (palavras[e[0]] || e[0]).toUpperCase() + ' (' + e[1] + 'x)';
    }).join(', ');
  }

  $('somLigado').addEventListener('change', function () { Sons.setLigado(this.checked); });

  $('zerar').addEventListener('click', function () {
    dialogo({titulo: 'Zerar progresso', tituloArte: 'titulo_zerar', texto: 'Apagar recordes, partidas e erros de todas as categorias?', ok: 'Zerar', okArte: 'botao_zerar'})
      .then(function (sim) {
        if (!sim) return;
        Pontuacao.zerarTudo();
        aoMostrar.pais();
      });
  });

  // ------------------------------------------------------------------ comeco

  mostrar('inicio');
  // sons dos botoes ja ficam prontos
  Sons.carregarVarios(['play', 'back', 'next']);

  // funciona sem internet depois da primeira visita (sw.js guarda todos os arquivos)
  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('sw.js').catch(function () { /* sem cache offline */ });
    });
  }
})();
