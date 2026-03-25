// ===================================================================
// SISTEMA DE URNA ELETRÔNICA - CIPA 2026/2027
// HOKKAIDO PLASTICS
// ===================================================================

// --- USUARIOS e CANDIDATOS definidos em dados.js ---

// --- SENHA DO ADMIN (SHA-256 hash) ---
// Para trocar a senha, gere o hash SHA-256 no console:
//   crypto.subtle.digest('SHA-256', new TextEncoder().encode('sua_senha'))
//     .then(h => console.log([...new Uint8Array(h)].map(b=>b.toString(16).padStart(2,'0')).join('')))
const SENHA_ADMIN_HASH = '03ac674216f3e15c761ee1a5e255f067953623c8b388b4459e13f978d7c846f4'; // hash de '1234'

// --- ESTADO DA URNA ---
let numeroDigitado = '';
let isBranco = false;
let telaFimAtiva = false;
let votos = carregarVotos();
let adminAutenticado = false;
let emailsDestino = carregarEmails();
let usuarioAtual = null; // Usuário autenticado na sessão atual

// ===================================================================
// PERSISTÊNCIA (localStorage)
// ===================================================================

function carregarVotos() {
  try {
    const dados = localStorage.getItem('cipa_votos');
    return dados ? JSON.parse(dados) : [];
  } catch {
    return [];
  }
}

function salvarVotos() {
  localStorage.setItem('cipa_votos', JSON.stringify(votos));
}

function carregarJaVotaram() {
  try {
    const dados = localStorage.getItem('cipa_ja_votaram');
    return dados ? JSON.parse(dados) : [];
  } catch {
    return [];
  }
}

function registrarVotoUsuario(codigo) {
  const lista = carregarJaVotaram();
  lista.push(codigo);
  localStorage.setItem('cipa_ja_votaram', JSON.stringify(lista));
}

function usuarioJaVotou(codigo) {
  return carregarJaVotaram().includes(codigo);
}

function carregarEmails() {
  try {
    const dados = localStorage.getItem('cipa_emails');
    return dados ? JSON.parse(dados) : [];
  } catch {
    return [];
  }
}

function salvarEmailsStorage() {
  localStorage.setItem('cipa_emails', JSON.stringify(emailsDestino));
}

// ===================================================================
// ÁUDIO (Sons da Urna)
// ===================================================================

const AudioCtx = window.AudioContext || window.webkitAudioContext;
let audioCtx;

function initAudio() {
  if (!audioCtx) audioCtx = new AudioCtx();
  if (audioCtx.state === 'suspended') audioCtx.resume();
}

function playKeyClick() {
  if (!audioCtx) return;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(800, audioCtx.currentTime);
  gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.start();
  osc.stop(audioCtx.currentTime + 0.05);
}

function playConfirmSound() {
  if (!audioCtx) return;
  const t = audioCtx.currentTime;
  const playTone = (freq, start, duration) => {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'square';
    osc.frequency.value = freq;
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    gain.gain.setValueAtTime(0.05, start);
    osc.start(start);
    osc.stop(start + duration);
  };
  // Clássico "pilili-piiiii"
  playTone(1200, t, 0.08);
  playTone(1200, t + 0.15, 0.08);
  playTone(1200, t + 0.30, 0.08);
  playTone(1200, t + 0.45, 0.8);
}

// ===================================================================
// LÓGICA DA URNA
// ===================================================================

function buscarCandidato(num) {
  return CANDIDATOS.find(c => c.numero === num) || null;
}

function atualizarTela() {
  const digito1 = document.getElementById('digito1');
  const digito2 = document.getElementById('digito2');
  const infoCandidato = document.getElementById('info-candidato');
  const infoNulo = document.getElementById('info-nulo');
  const infoBranco = document.getElementById('info-branco');
  const telaFoto = document.getElementById('tela-foto');

  // Limpa tudo
  digito1.textContent = '';
  digito2.textContent = '';
  digito1.classList.remove('piscando');
  digito2.classList.remove('piscando');
  infoCandidato.style.display = 'none';
  infoNulo.style.display = 'none';
  infoBranco.style.display = 'none';
  telaFoto.style.display = 'none';

  if (isBranco) {
    infoBranco.style.display = 'block';
    return;
  }

  // Mostra dígitos
  if (numeroDigitado.length >= 1) {
    digito1.textContent = numeroDigitado[0];
  }
  if (numeroDigitado.length >= 2) {
    digito2.textContent = numeroDigitado[1];
  }

  // Cursor piscando
  if (numeroDigitado.length === 0) {
    digito1.classList.add('piscando');
  } else if (numeroDigitado.length === 1) {
    digito2.classList.add('piscando');
  }

  // Se digitou 2 números, verifica candidato
  if (numeroDigitado.length === 2) {
    const candidato = buscarCandidato(numeroDigitado);
    if (candidato) {
      // Mostra info do candidato
      document.getElementById('info-nome').textContent = candidato.nome;
      document.getElementById('info-setor').textContent = candidato.setor;
      infoCandidato.style.display = 'block';

      // Mostra foto
      telaFoto.style.display = 'flex';
      const fotoImg = document.getElementById('foto-img');
      const placeholder = telaFoto.querySelector('.foto-placeholder');
      if (candidato.foto) {
        fotoImg.src = candidato.foto;
        fotoImg.style.display = 'block';
        placeholder.style.display = 'none';
      } else {
        fotoImg.style.display = 'none';
        placeholder.style.display = 'block';
      }
    } else {
      // Voto nulo
      infoNulo.style.display = 'block';
    }
  }
}

function digitarNumero(n) {
  initAudio();
  playKeyClick();
  if (telaFimAtiva) return;
  if (isBranco) {
    isBranco = false;
  }
  if (numeroDigitado.length < 2) {
    numeroDigitado += n;
    atualizarTela();
  }
}

function votoBranco() {
  initAudio();
  playKeyClick();
  if (telaFimAtiva) return;
  numeroDigitado = '';
  isBranco = true;
  atualizarTela();
}

function corrigir() {
  initAudio();
  playKeyClick();
  if (telaFimAtiva) return;
  numeroDigitado = '';
  isBranco = false;
  atualizarTela();
}

function confirmar() {
  initAudio();
  if (telaFimAtiva) return;

  let votoRegistrado = null;

  if (isBranco) {
    votoRegistrado = 'BRANCO';
  } else if (numeroDigitado.length === 2) {
    const candidato = buscarCandidato(numeroDigitado);
    votoRegistrado = candidato ? candidato.numero : 'NULO';
  } else {
    return; // Não faz nada se incompleto
  }

  // Registra voto SEM identificação do eleitor (sigilo do voto)
  const codigoVotante = usuarioAtual ? usuarioAtual.codigo : null;

  votos.push({
    voto: votoRegistrado,
    data: new Date().toISOString()
  });
  salvarVotos();

  // Backup automático a cada 10 votos
  if (votos.length % 10 === 0) backupAutomatico();

  // Marca usuário como já votado
  if (usuarioAtual) {
    registrarVotoUsuario(usuarioAtual.codigo);
    usuarioAtual = null;
  }

  // Notifica o mesário que o voto foi confirmado
  if (codigoVotante) {
    canalUrna.postMessage({ type: 'VOTO_CONFIRMADO', codigo: codigoVotante });
  }

  playConfirmSound();
  mostrarTelaFim();
}

function mostrarTelaFim() {
  telaFimAtiva = true;
  document.getElementById('tela-votacao').style.display = 'none';
  document.getElementById('tela-fim').style.display = 'flex';

  setTimeout(() => {
    telaFimAtiva = false;
    numeroDigitado = '';
    isBranco = false;
    document.getElementById('tela-fim').style.display = 'none';
    // Volta para tela de aguardando após votar
    mostrarTelaAguardando();
  }, 4000);
}

// ===================================================================
// COMUNICAÇÃO COM O MESÁRIO (BroadcastChannel)
// ===================================================================

const canalUrna = new BroadcastChannel('cipa_urna');

canalUrna.onmessage = (e) => {
  if (e.data.type === 'LIBERAR_URNA' && e.data.usuario) {
    usuarioAtual = e.data.usuario;
    iniciarVotacao();
  }
};

function mostrarTelaAguardando() {
  document.getElementById('tela-aguardando').style.display = 'flex';
  document.getElementById('tela-votacao').style.display = 'none';
  document.getElementById('tela-fim').style.display = 'none';
}

function iniciarVotacao() {
  numeroDigitado = '';
  isBranco = false;
  document.getElementById('tela-aguardando').style.display = 'none';
  document.getElementById('tela-votacao').style.display = 'block';
  atualizarTela();
}

// ===================================================================
// PAINEL DE ADMINISTRAÇÃO
// ===================================================================

function abrirPainelAdmin() {
  document.getElementById('modal-admin').style.display = 'flex';
  document.getElementById('admin-login').style.display = 'block';
  document.getElementById('admin-resultados').style.display = 'none';
  adminAutenticado = false;
  document.getElementById('input-senha').value = '';
  setTimeout(() => document.getElementById('input-senha').focus(), 100);
}

function fecharPainelAdmin() {
  document.getElementById('modal-admin').style.display = 'none';
  adminAutenticado = false;
}

async function hashSenha(senha) {
  const encoder = new TextEncoder();
  const data = encoder.encode(senha);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(hashBuffer)].map(b => b.toString(16).padStart(2, '0')).join('');
}

async function loginAdmin() {
  const senha = document.getElementById('input-senha').value;
  const hash = await hashSenha(senha);
  if (hash === SENHA_ADMIN_HASH) {
    adminAutenticado = true;
    document.getElementById('admin-login').style.display = 'none';
    document.getElementById('admin-resultados').style.display = 'block';
    document.getElementById('input-emails-destino').value = emailsDestino.join(', ');
    renderizarResultados();
    renderizarListaEleitores();
  } else {
    alert('Senha incorreta!');
    document.getElementById('input-senha').value = '';
    document.getElementById('input-senha').focus();
  }
}

function calcularResultados() {
  const contagem = { BRANCO: 0, NULO: 0 };
  CANDIDATOS.forEach(c => contagem[c.numero] = 0);

  votos.forEach(v => {
    const chave = v.voto || v; // compatibilidade
    contagem[chave] = (contagem[chave] || 0) + 1;
  });

  const total = votos.length;

  const candidatos = CANDIDATOS.map(c => ({
    ...c,
    votos: contagem[c.numero],
    percentual: total > 0 ? ((contagem[c.numero] / total) * 100).toFixed(1) : '0.0'
  })).sort((a, b) => b.votos - a.votos);

  return {
    total,
    brancos: contagem.BRANCO,
    nulos: contagem.NULO,
    candidatos
  };
}

function renderizarResultados() {
  const res = calcularResultados();

  document.getElementById('res-total').textContent = res.total;
  document.getElementById('res-brancos').textContent = res.brancos;
  document.getElementById('res-nulos').textContent = res.nulos;

  const lista = document.getElementById('lista-classificacao');
  lista.innerHTML = '';

  res.candidatos.forEach((cand, index) => {
    const div = document.createElement('div');
    div.className = 'candidato-row';
    div.innerHTML = `
      <div class="candidato-row-esquerda">
        <div class="posicao-badge ${index === 0 && cand.votos > 0 ? 'primeiro' : ''}">
          ${index + 1}º
        </div>
        <div>
          <div class="candidato-nome">${escapeHtml(cand.nome)}</div>
          <div class="candidato-detalhe">Nº ${escapeHtml(cand.numero)} &bull; ${escapeHtml(cand.setor)}</div>
        </div>
      </div>
      <div class="candidato-row-direita">
        <div class="candidato-votos">${cand.votos} <span>votos</span></div>
        <div class="candidato-percent">${cand.percentual}%</div>
      </div>
    `;
    lista.appendChild(div);
  });
}

// Proteção contra XSS
function escapeHtml(text) {
  const div = document.createElement('div');
  div.appendChild(document.createTextNode(text));
  return div.innerHTML;
}

function renderizarListaEleitores() {
  const jaVotaram = carregarJaVotaram();
  const lista = document.getElementById('lista-eleitores');
  if (!lista) return;
  lista.innerHTML = '';

  USUARIOS.forEach(u => {
    const votou = jaVotaram.includes(u.codigo);
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td style="padding:8px 12px;border-bottom:1px solid #f3f4f6;font-weight:700;">${escapeHtml(u.codigo)}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #f3f4f6;">${escapeHtml(u.nome)}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #f3f4f6;text-align:center;">
        <span style="padding:3px 10px;border-radius:12px;font-size:0.78rem;font-weight:700;background:${votou ? '#dcfce7' : '#fef9c3'};color:${votou ? '#166534' : '#92400e'};">
          ${votou ? '&#10003; Votou' : '&#9711; Pendente'}
        </span>
      </td>`;
    lista.appendChild(tr);
  });

  const total = USUARIOS.length;
  const votaram = jaVotaram.length;
  document.getElementById('eleitores-info').textContent =
    `${votaram} de ${total} eleitores já votaram`;
}

// ===================================================================
// E-MAIL
// ===================================================================

function salvarEmails() {
  const input = document.getElementById('input-emails-destino').value;
  emailsDestino = input.split(',').map(e => e.trim()).filter(e => e.length > 0);
  salvarEmailsStorage();
  document.getElementById('email-status').textContent = 'E-mails salvos com sucesso!';
  setTimeout(() => {
    document.getElementById('email-status').textContent = '';
  }, 3000);
}

function gerarCorpoEmail() {
  const res = calcularResultados();
  const dataHora = new Date().toLocaleString('pt-BR');

  let corpo = `RESULTADO DA ELEIÇÃO CIPA 2026/2027 - HOKKAIDO PLASTICS\n`;
  corpo += `Data da apuração: ${dataHora}\n`;
  corpo += `${'='.repeat(50)}\n\n`;
  corpo += `RESUMO GERAL\n`;
  corpo += `Total de votos: ${res.total}\n`;
  corpo += `Votos em branco: ${res.brancos}\n`;
  corpo += `Votos nulos: ${res.nulos}\n\n`;
  corpo += `CLASSIFICAÇÃO DOS CANDIDATOS\n`;
  corpo += `${'-'.repeat(50)}\n`;

  res.candidatos.forEach((cand, i) => {
    corpo += `${i + 1}º lugar: ${cand.nome} (Nº ${cand.numero} - ${cand.setor})\n`;
    corpo += `   Votos: ${cand.votos} (${cand.percentual}%)\n`;
  });

  corpo += `\n${'-'.repeat(50)}\n`;
  corpo += `Relatório gerado automaticamente pelo sistema de urna eletrônica.\n`;

  return corpo;
}

function enviarResultadosPorEmail() {
  if (emailsDestino.length === 0) {
    alert('Configure pelo menos um e-mail de destino antes de enviar!');
    document.getElementById('input-emails-destino').focus();
    return;
  }

  const assunto = encodeURIComponent('Resultado Eleição CIPA 2026/2027 - Hokkaido Plastics');
  const corpo = encodeURIComponent(gerarCorpoEmail());
  const destinatarios = emailsDestino.join(',');

  // Abre o cliente de e-mail padrão com os resultados preenchidos
  window.location.href = `mailto:${destinatarios}?subject=${assunto}&body=${corpo}`;
}

// ===================================================================
// RELATÓRIO HTML (abre em nova aba)
// ===================================================================

function gerarRelatorioHTML() {
  const res = calcularResultados();
  const dataHora = new Date().toLocaleString('pt-BR');

  // Gera as linhas da tabela de candidatos
  let linhasCandidatos = '';
  res.candidatos.forEach((cand, i) => {
    const destaque = i === 0 && cand.votos > 0 ? 'style="background:#fef9c3;font-weight:700;"' : '';
    linhasCandidatos += `
      <tr ${destaque}>
        <td style="padding:10px 16px;border-bottom:1px solid #e5e7eb;text-align:center;font-weight:700;">${i + 1}º</td>
        <td style="padding:10px 16px;border-bottom:1px solid #e5e7eb;text-align:center;">${escapeHtml(cand.numero)}</td>
        <td style="padding:10px 16px;border-bottom:1px solid #e5e7eb;">${escapeHtml(cand.nome)}</td>
        <td style="padding:10px 16px;border-bottom:1px solid #e5e7eb;">${escapeHtml(cand.setor)}</td>
        <td style="padding:10px 16px;border-bottom:1px solid #e5e7eb;text-align:center;font-size:1.2rem;font-weight:900;">${cand.votos}</td>
        <td style="padding:10px 16px;border-bottom:1px solid #e5e7eb;text-align:center;color:#2563eb;font-weight:700;">${cand.percentual}%</td>
      </tr>`;
  });

  // Gera o log de votos (hora de cada voto)
  let linhasLog = '';
  votos.forEach((v, i) => {
    const hora = new Date(v.data).toLocaleString('pt-BR');
    const tipoVoto = v.voto || v;
    const candidato = CANDIDATOS.find(c => c.numero === tipoVoto);
    const descricao = candidato ? escapeHtml(candidato.nome) : tipoVoto;
    linhasLog += `
      <tr>
        <td style="padding:6px 12px;border-bottom:1px solid #f3f4f6;text-align:center;color:#888;">${i + 1}</td>
        <td style="padding:6px 12px;border-bottom:1px solid #f3f4f6;">${hora}</td>
        <td style="padding:6px 12px;border-bottom:1px solid #f3f4f6;font-weight:600;">${descricao}</td>
      </tr>`;
  });

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Relatório CIPA 2026/2027 - Hokkaido Plastics</title>
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    body { font-family:'Segoe UI',Arial,sans-serif; background:#f9fafb; color:#111; padding:40px; }
    .container { max-width:800px; margin:0 auto; background:#fff; border-radius:12px; box-shadow:0 2px 12px rgba(0,0,0,0.08); padding:40px; }
    .header-rel { text-align:center; border-bottom:3px solid #1e40af; padding-bottom:20px; margin-bottom:24px; }
    .header-rel h1 { font-size:1.6rem; color:#1e3a5f; margin-bottom:4px; }
    .header-rel h2 { font-size:1.1rem; color:#2563eb; font-weight:600; }
    .header-rel p { font-size:0.85rem; color:#888; margin-top:8px; }
    .resumo { display:flex; gap:16px; margin-bottom:28px; }
    .resumo-box { flex:1; padding:16px; border-radius:8px; text-align:center; }
    .resumo-box.azul { background:#eff6ff; border:1px solid #bfdbfe; }
    .resumo-box.cinza { background:#f9fafb; border:1px solid #e5e7eb; }
    .resumo-box.verm { background:#fef2f2; border:1px solid #fecaca; }
    .resumo-box .label { font-size:0.7rem; font-weight:700; text-transform:uppercase; }
    .azul .label { color:#2563eb; } .cinza .label { color:#666; } .verm .label { color:#dc2626; }
    .resumo-box .valor { font-size:2.4rem; font-weight:900; color:#111; }
    h3 { font-size:1rem; color:#333; margin:24px 0 12px; border-bottom:1px solid #e5e7eb; padding-bottom:6px; }
    table { width:100%; border-collapse:collapse; }
    th { background:#1e40af; color:#fff; padding:10px 16px; text-align:left; font-size:0.8rem; text-transform:uppercase; }
    .footer-rel { margin-top:32px; text-align:center; font-size:0.75rem; color:#aaa; border-top:1px solid #e5e7eb; padding-top:16px; }
    .selo { display:inline-block; margin-top:12px; padding:6px 16px; border:2px solid #1e40af; border-radius:6px; font-weight:700; color:#1e40af; font-size:0.8rem; }
    @media print {
      body { padding:20px; background:#fff; }
      .container { box-shadow:none; }
      .no-print { display:none !important; }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header-rel">
      <h1>HOKKAIDO PLASTICS</h1>
      <h2>RELATÓRIO OFICIAL — ELEIÇÕES CIPA 2026/2027</h2>
      <p>Gerado em: ${dataHora}</p>
    </div>

    <div class="resumo">
      <div class="resumo-box azul">
        <p class="label">Total de Votos</p>
        <p class="valor">${res.total}</p>
      </div>
      <div class="resumo-box cinza">
        <p class="label">Votos Brancos</p>
        <p class="valor">${res.brancos}</p>
      </div>
      <div class="resumo-box verm">
        <p class="label">Votos Nulos</p>
        <p class="valor">${res.nulos}</p>
      </div>
    </div>

    <h3>Classificação dos Candidatos</h3>
    <table>
      <thead>
        <tr>
          <th style="text-align:center;">Pos.</th>
          <th style="text-align:center;">Nº</th>
          <th>Nome</th>
          <th>Setor</th>
          <th style="text-align:center;">Votos</th>
          <th style="text-align:center;">%</th>
        </tr>
      </thead>
      <tbody>
        ${linhasCandidatos}
      </tbody>
    </table>

    <h3>Registro de Votos (Auditoria)</h3>
    <table>
      <thead>
        <tr>
          <th style="text-align:center;width:60px;">#</th>
          <th>Data/Hora</th>
          <th>Voto</th>
        </tr>
      </thead>
      <tbody>
        ${linhasLog}
      </tbody>
    </table>

    <div class="footer-rel">
      <p>Este documento é o relatório oficial da apuração da eleição CIPA 2026/2027.</p>
      <p>Hokkaido Plastics — Comissão Eleitoral</p>
      <div class="selo">DOCUMENTO OFICIAL</div>
    </div>

    <div class="no-print" style="text-align:center;margin-top:24px;">
      <button onclick="window.print()" style="padding:12px 28px;background:#1e40af;color:#fff;border:none;border-radius:8px;font-weight:700;font-size:1rem;cursor:pointer;">Imprimir / Salvar PDF</button>
    </div>
  </div>
</body>
</html>`;

  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank');
}

// ===================================================================
// EXPORTAR CSV
// ===================================================================

function exportarCSV() {
  const res = calcularResultados();
  let csv = 'Posição,Número,Nome,Setor,Votos,Percentual\n';

  res.candidatos.forEach((cand, i) => {
    csv += `${i + 1},${cand.numero},"${cand.nome}","${cand.setor}",${cand.votos},${cand.percentual}%\n`;
  });

  csv += `\nResumo\n`;
  csv += `Total de Votos,${res.total}\n`;
  csv += `Votos Brancos,${res.brancos}\n`;
  csv += `Votos Nulos,${res.nulos}\n`;

  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `resultado_cipa_${new Date().toISOString().slice(0,10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

// ===================================================================
// TECLADO FÍSICO
// ===================================================================

document.addEventListener('keydown', (e) => {
  // Ignora se o modal admin está aberto
  if (document.getElementById('modal-admin').style.display === 'flex') return;
  // Ignora se a tela de aguardando está ativa (urna bloqueada)
  if (document.getElementById('tela-aguardando').style.display !== 'none') return;
  // Ignora se o foco está em qualquer campo de input/textarea
  if (document.activeElement && (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA')) return;

  if (e.key >= '0' && e.key <= '9') {
    digitarNumero(e.key);
  } else if (e.key === 'Enter') {
    confirmar();
  } else if (e.key === 'Backspace' || e.key === 'Delete') {
    corrigir();
  } else if (e.key === ' ') {
    e.preventDefault();
    votoBranco();
  }
});

// ===================================================================
// BLOQUEIO DE DEVTOOLS (dificulta manipulação)
// ===================================================================

// Bloqueia atalhos de DevTools
document.addEventListener('keydown', (e) => {
  // F12
  if (e.key === 'F12') { e.preventDefault(); return false; }
  // Ctrl+Shift+I, Ctrl+Shift+J, Ctrl+Shift+C
  if (e.ctrlKey && e.shiftKey && ['I','J','C'].includes(e.key.toUpperCase())) { e.preventDefault(); return false; }
  // Ctrl+U (ver código fonte)
  if (e.ctrlKey && e.key.toUpperCase() === 'U') { e.preventDefault(); return false; }
});

// Bloqueia menu de contexto (botão direito)
document.addEventListener('contextmenu', (e) => e.preventDefault());

// ===================================================================
// MODO TELA CHEIA (solicita ao primeiro clique)
// ===================================================================

function solicitarTelaCheia() {
  const el = document.documentElement;
  if (el.requestFullscreen) el.requestFullscreen();
  else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
  else if (el.msRequestFullscreen) el.msRequestFullscreen();
}

// Solicita tela cheia no primeiro toque/clique
document.addEventListener('click', function ativarFullscreen() {
  if (!document.fullscreenElement) {
    solicitarTelaCheia();
  }
  // Remove listener após ativar (não fica pedindo toda hora)
  document.removeEventListener('click', ativarFullscreen);
});

// Reativa tela cheia se o eleitor sair (ESC)
document.addEventListener('fullscreenchange', () => {
  if (!document.fullscreenElement && !adminAutenticado) {
    // Tenta reativar no próximo clique
    document.addEventListener('click', function reativar() {
      if (!document.fullscreenElement) solicitarTelaCheia();
      document.removeEventListener('click', reativar);
    });
  }
});

// ===================================================================
// BACKUP AUTOMÁTICO
// ===================================================================

function backupAutomatico() {
  const dados = {
    votos: votos,
    jaVotaram: carregarJaVotaram(),
    dataBackup: new Date().toISOString(),
    totalVotos: votos.length,
    totalEleitores: USUARIOS.length
  };
  const blob = new Blob([JSON.stringify(dados, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `backup_cipa_${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

// ===================================================================
// INICIALIZAÇÃO
// ===================================================================

mostrarTelaAguardando();
