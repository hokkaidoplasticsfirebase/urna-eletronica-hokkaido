// ===================================================================
// PAINEL DO MESÁRIO — CIPA 2026/2027
// Comunicação com a urna via BroadcastChannel
// ===================================================================

const canalUrna = new BroadcastChannel('cipa_urna');

let eleitorSelecionado = null;
let urnaOcupada = false;

// --- Escuta mensagens da urna ---
canalUrna.onmessage = (e) => {
  if (e.data.type === 'VOTO_CONFIRMADO') {
    urnaOcupada = false;
    eleitorSelecionado = null;
    atualizarStats();
    atualizarStatusUrna('livre');
    limparBusca();
    renderizarListaEleitores();
  }
};

// --- localStorage (compartilhado com a urna) ---
function carregarJaVotaram() {
  try {
    const dados = localStorage.getItem('cipa_ja_votaram');
    return dados ? JSON.parse(dados) : [];
  } catch { return []; }
}

function usuarioJaVotou(codigo) {
  return carregarJaVotaram().includes(codigo);
}

// --- Proteção XSS ---
function escapeHtml(text) {
  const div = document.createElement('div');
  div.appendChild(document.createTextNode(text));
  return div.innerHTML;
}

// --- Estatísticas ---
function atualizarStats() {
  const jaVotaram = carregarJaVotaram();
  const total = USUARIOS.length;
  const votaram = jaVotaram.length;
  const restantes = total - votaram;

  document.getElementById('stat-total').textContent = total;
  document.getElementById('stat-votaram').textContent = votaram;
  document.getElementById('stat-restantes').textContent = restantes;

  const pct = total > 0 ? (votaram / total) * 100 : 0;
  document.getElementById('progress-bar').style.width = pct + '%';
  document.getElementById('progress-text').textContent = pct.toFixed(1) + '%';
}

// --- Status da urna ---
function atualizarStatusUrna(status) {
  const el = document.getElementById('urna-status');
  const dot = el.querySelector('.status-dot');
  const text = el.querySelector('.status-text');

  if (status === 'livre') {
    dot.className = 'status-dot verde';
    text.textContent = 'Urna livre — pronta para próximo eleitor';
    document.getElementById('input-codigo').disabled = false;
    document.getElementById('btn-buscar').disabled = false;
  } else if (status === 'votando') {
    dot.className = 'status-dot amarelo';
    text.textContent = 'Eleitor votando... aguarde a confirmação';
    document.getElementById('input-codigo').disabled = true;
    document.getElementById('btn-buscar').disabled = true;
  }
}

// --- Busca de eleitor ---
function buscarEleitor() {
  const input = document.getElementById('input-codigo');
  const codigo = input.value.padStart(3, '0');
  const erroEl = document.getElementById('busca-erro');
  const resultEl = document.getElementById('resultado-busca');

  erroEl.style.display = 'none';
  resultEl.style.display = 'none';

  if (!input.value.trim()) {
    erroEl.textContent = 'Digite um código válido.';
    erroEl.style.display = 'block';
    return;
  }

  if (urnaOcupada) {
    erroEl.textContent = 'Aguarde o eleitor atual terminar de votar.';
    erroEl.style.display = 'block';
    return;
  }

  const usuario = USUARIOS.find(u => u.codigo === codigo);

  if (!usuario) {
    erroEl.textContent = 'Código não encontrado. Verifique e tente novamente.';
    erroEl.style.display = 'block';
    input.value = '';
    input.focus();
    return;
  }

  if (usuarioJaVotou(codigo)) {
    erroEl.textContent = escapeHtml(usuario.nome) + ' já realizou o voto nesta eleição.';
    erroEl.style.display = 'block';
    input.value = '';
    input.focus();
    return;
  }

  eleitorSelecionado = usuario;
  document.getElementById('eleitor-nome').textContent = usuario.nome;
  document.getElementById('eleitor-codigo').textContent = 'Código: ' + usuario.codigo;
  resultEl.style.display = 'flex';
}

function cancelarBusca() {
  eleitorSelecionado = null;
  document.getElementById('resultado-busca').style.display = 'none';
  document.getElementById('input-codigo').value = '';
  document.getElementById('input-codigo').focus();
}

// --- Liberar urna ---
function liberarUrna() {
  if (!eleitorSelecionado || urnaOcupada) return;

  urnaOcupada = true;
  atualizarStatusUrna('votando');
  document.getElementById('resultado-busca').style.display = 'none';
  document.getElementById('input-codigo').value = '';

  canalUrna.postMessage({
    type: 'LIBERAR_URNA',
    usuario: eleitorSelecionado
  });
}

function limparBusca() {
  eleitorSelecionado = null;
  document.getElementById('resultado-busca').style.display = 'none';
  document.getElementById('busca-erro').style.display = 'none';
  document.getElementById('input-codigo').value = '';
  document.getElementById('input-codigo').disabled = false;
  document.getElementById('btn-buscar').disabled = false;
  document.getElementById('input-codigo').focus();
}

// --- Lista de eleitores ---
function renderizarListaEleitores() {
  const jaVotaram = carregarJaVotaram();
  const filtro = (document.getElementById('filtro-eleitores').value || '').toLowerCase();
  const lista = document.getElementById('lista-eleitores');
  lista.innerHTML = '';

  USUARIOS.forEach(u => {
    if (filtro && !u.nome.toLowerCase().includes(filtro) && !u.codigo.includes(filtro)) return;
    const votou = jaVotaram.includes(u.codigo);
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="td-codigo">${escapeHtml(u.codigo)}</td>
      <td>${escapeHtml(u.nome)}</td>
      <td class="td-situacao">
        <span class="badge ${votou ? 'badge-votou' : 'badge-pendente'}">
          ${votou ? '&#10003; Votou' : '&#9711; Pendente'}
        </span>
      </td>`;
    lista.appendChild(tr);
  });
}

function filtrarEleitores() {
  renderizarListaEleitores();
}

// --- Tecla Enter no campo de código ---
document.getElementById('input-codigo').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') buscarEleitor();
});

// --- Inicialização ---
atualizarStats();
atualizarStatusUrna('livre');
renderizarListaEleitores();
document.getElementById('input-codigo').focus();
