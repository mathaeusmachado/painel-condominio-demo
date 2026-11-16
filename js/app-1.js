'use strict';
/* Painel do Condomínio — dados salvos no localStorage do navegador. */

// ---------- Estado e persistência ----------
const DEMO = !!window.PAINEL_DEMO;
const KEY = DEMO ? 'painel-condominio-demo-v1' : 'painel-condominio-v1';
const KEY_PIN = KEY + '-pin';
const KEY_PREV = KEY + '-prev';
const KEY_BACKUP = KEY + '-backup-em';
const KEY_OK = KEY + '-ok';
const KEY_PAPEL = KEY + '-papel';
const REGRAS_PADRAO = `REGRAS DE CONVIVÊNCIA — Residencial Hortênsias
(texto provisório até o arquivo definitivo do condomínio)

1. Silêncio das 22h às 7h. Música e TV em volume baixo o tempo todo.
2. Áreas comuns: deixe limpo depois de usar. Não deixe louça, lixo ou roupa.
3. Visitantes até 22h, com aviso ao responsável da unidade. Pernoite só com autorização do locador.
4. Proibido fumar em áreas comuns. Drogas ilícitas não são permitidas.
5. Cada morador cuida da própria unidade, da mobília listada no contrato e do lixo no horário da coleta.
6. Não fure parede, não pinte e não troque fechadura sem autorização por escrito.
7. Chaves extras só com o locador. Perda de chave gera reposição por conta do morador.
8. Contas de uso individual (se houver) vencem junto com o aluguel.
9. Convivência: respeito a nacionalidade, religião e rotina de trabalho dos demais.
10. Descumprimento reiterado pode encerrar o contrato, nos termos da lei.

Dúvidas: fale com o responsável do imóvel.`;
const vazio = () => ({ unidades: [], pessoas: [], cobrancas: [], despesas: [], contratos: [], comissoes: [], config: { comissaoObs: false, regras: REGRAS_PADRAO, regrasArq: '' } });
const isObs = () => DEMO && (localStorage.getItem(KEY_PAPEL) || 'dono') === 'observador';
const ISO_D = /^\d{4}-\d{2}-\d{2}$/;
const ISO_M = /^\d{4}-\d{2}$/;
const ID_OK = /^[A-Za-z0-9_-]{1,40}$/;
const CAT_OK = new Set(['rg', 'cpf', 'passaporte', 'crnm', 'visto', 'residencia', 'contrato', 'foto', 'outro']);
const isoDate = s => ISO_D.test(s || '') ? s : '';
const isoMes = s => ISO_M.test(s || '') ? s : '';
const safeId = s => ID_OK.test(String(s || '')) ? String(s) : '';
function arr(x) { return Array.isArray(x) ? x : []; }
function str(x, n = 200) { return String(x ?? '').slice(0, n); }
function num(x) { const n = Number(x); return Number.isFinite(n) ? n : 0; }
function limparArq(a) {
  if (!a || typeof a !== 'object') return null;
  const id = safeId(a.id); if (!id) return null;
  const categoria = CAT_OK.has(a.categoria) ? a.categoria : 'outro';
  return { id, nome: str(a.nome, 180), tipo: str(a.tipo, 80), tamanho: Math.max(0, num(a.tamanho)), categoria, adicionado: isoDate(a.adicionado) };
}
function limparPessoa(p) {
  if (!p || typeof p !== 'object') return null;
  const id = safeId(p.id); if (!id) return null;
  const tipo = p.tipo === 'EX' ? 'EX' : 'BR';
  return {
    id, tipo, nome: str(p.nome, 120), nascimento: isoDate(p.nascimento), telefone: str(p.telefone, 40), email: str(p.email, 80),
    profissao: str(p.profissao, 80), cpf: str(p.cpf, 20), rg: str(p.rg, 30), pais: str(p.pais, 60), passaporte: str(p.passaporte, 30),
    crnm: str(p.crnm, 40), visto: str(p.visto, 80), validadeVisto: isoDate(p.validadeVisto), emergNome: str(p.emergNome, 80),
    emergTel: str(p.emergTel, 40), unidadeId: safeId(p.unidadeId), dataEntrada: isoDate(p.dataEntrada), valor: num(p.valor),
    diaVenc: Math.min(31, Math.max(1, num(p.diaVenc) || 5)), caucao: num(p.caucao), caucaoStatus: str(p.caucaoStatus, 20),
    caucaoDevolvidaEm: isoDate(p.caucaoDevolvidaEm), caucaoDevolvidaValor: num(p.caucaoDevolvidaValor),
    dataFimContrato: isoDate(p.dataFimContrato), dataSaida: isoDate(p.dataSaida), obs: str(p.obs, 2000),
    arquivos: arr(p.arquivos).map(limparArq).filter(Boolean)
  };
}
function limparUnidade(u) {
  if (!u || typeof u !== 'object') return null;
  const id = safeId(u.id); if (!id) return null;
  const itens = arr(u.itens).map(i => i && i.nome ? { nome: str(i.nome, 80), qtd: Math.max(1, num(i.qtd) || 1), estado: str(i.estado, 20) } : null).filter(Boolean);
  return { id, tipo: u.tipo === 'kitnet' ? 'kitnet' : 'quarto', nome: str(u.nome, 40), andar: str(u.andar, 40), valor: num(u.valor), comissao: u.tipo === 'kitnet' ? 0 : num(u.comissao), obs: str(u.obs, 2000), itens };
}
function limparCob(c) {
  if (!c || typeof c !== 'object') return null;
  const id = safeId(c.id); if (!id) return null;
  return { id, pessoaId: safeId(c.pessoaId), unidadeId: safeId(c.unidadeId), nome: str(c.nome, 120), competencia: isoMes(c.competencia), valor: num(c.valor), vencimento: isoDate(c.vencimento), pago: !!c.pago, dataPgto: isoDate(c.dataPgto), obs: str(c.obs, 200) };
}
function limparDesp(d) {
  if (!d || typeof d !== 'object') return null;
  const id = safeId(d.id); if (!id) return null;
  return { id, descricao: str(d.descricao, 120), categoria: str(d.categoria, 40), valor: num(d.valor), data: isoDate(d.data), unidadeId: safeId(d.unidadeId) };
}
function limparContrato(c) {
  if (!c || typeof c !== 'object') return null;
  const id = safeId(c.id); if (!id) return null;
  const st = ['rascunho', 'enviado', 'assinado', 'encerrado'].includes(c.status) ? c.status : 'rascunho';
  return { id, pessoaId: safeId(c.pessoaId), unidadeId: safeId(c.unidadeId), status: st, geradoEm: isoDate(c.geradoEm), enviadoEm: isoDate(c.enviadoEm), assinadoEm: isoDate(c.assinadoEm), assinadoPor: str(c.assinadoPor, 80), anexoId: safeId(c.anexoId), anexoNome: str(c.anexoNome, 180) };
}
function limparComissao(c) {
  if (!c || typeof c !== 'object') return null;
  const id = safeId(c.id); if (!id) return null;
  return { id, unidadeId: safeId(c.unidadeId), competencia: isoMes(c.competencia), valor: num(c.valor), vencimento: isoDate(c.vencimento), pago: !!c.pago, dataPgto: isoDate(c.dataPgto), obs: str(c.obs, 200) };
}
function limparConfig(c) {
  const x = c && typeof c === 'object' ? c : {};
  return { comissaoObs: !!x.comissaoObs, regras: str(x.regras, 20000) || REGRAS_PADRAO, regrasArq: str(x.regrasArq, 180) };
}
function normalizeDb(d) {
  if (!d || typeof d !== 'object') return vazio();
  return {
    unidades: arr(d.unidades).map(limparUnidade).filter(Boolean),
    pessoas: arr(d.pessoas).map(limparPessoa).filter(Boolean),
    cobrancas: arr(d.cobrancas).map(limparCob).filter(Boolean),
    despesas: arr(d.despesas).map(limparDesp).filter(Boolean),
    contratos: arr(d.contratos).map(limparContrato).filter(Boolean),
    comissoes: arr(d.comissoes).map(limparComissao).filter(Boolean),
    config: limparConfig(d.config)
  };
}
function load() {
  try {
    const d = JSON.parse(localStorage.getItem(KEY));
    if (d && typeof d === 'object') return normalizeDb(d);
  } catch (e) { /* ignora */ }
  return vazio();
}
function save() {
  try {
    const json = JSON.stringify(db);
    const prev = localStorage.getItem(KEY);
    if (prev) localStorage.setItem(KEY_PREV, prev);
    localStorage.setItem(KEY, json);
    return true;
  } catch (e) {
    toast(e && e.name === 'QuotaExceededError' ? 'Armazenamento cheio. Baixe um backup e apague anexos antigos.' : 'Não foi possível salvar. Faça um backup agora.');
    return false;
  }
}
function marcarBackup() { try { localStorage.setItem(KEY_BACKUP, today()); } catch (e) { /* ok */ } }
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
let db = load();

// ---------- Utilitários ----------
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const brl = n => (Number(n) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const pad = n => String(n).padStart(2, '0');
const ymd = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const today = () => ymd(new Date());
const fmtData = s => isoDate(s) ? s.split('-').reverse().join('/') : '—';
const daysIn = (y, m) => new Date(y, m, 0).getDate(); // m = 1..12
const venc = (comp, dia) => { const [y, m] = comp.split('-').map(Number); return `${comp}-${pad(Math.min(dia || 1, daysIn(y, m)))}`; };
const addMonths = (comp, n) => { const [y, m] = comp.split('-').map(Number); const d = new Date(y, m - 1 + n, 1); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`; };
const nomeMes = comp => { const [y, m] = comp.split('-').map(Number); const s = new Date(y, m - 1, 1).toLocaleDateString('pt-BR', { month: 'long' }); return s[0].toUpperCase() + s.slice(1) + ' de ' + y; };
const nomeMesCurto = comp => new Date(comp + '-01T12:00').toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '');

const IC = {
  x: '<path d="M6 6l12 12M18 6L6 18"/>',
  alert: '<path d="M12 3.5l9.5 16.5h-19L12 3.5z"/><path d="M12 10v4M12 17.3v.01"/>',
  home: '<path d="M3 11l9-8 9 8"/><path d="M5 9.5V20h14V9.5"/><path d="M10 20v-5h4v5"/>',
  bed: '<path d="M3 19V5M3 15h18v4M21 15v-3a3 3 0 00-3-3h-7v6"/><circle cx="7" cy="11" r="1.7"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c.8-4 4-6 8-6s7.2 2 8 6"/>',
  note: '<path d="M5 3h10l4 4v14H5z"/><path d="M9 12h6M9 16h6"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7"/>',
  file: '<path d="M6 2.5h8l4 4V21.5H6z"/><path d="M14 2.5V7h4"/>',
  clip: '<path d="M20 11.5l-8 8a5 5 0 01-7-7l8.5-8.5a3.3 3.3 0 014.7 4.7L9.5 17.2a1.7 1.7 0 01-2.4-2.4L14.5 7.5"/>',
  list: '<path d="M8 6h12M8 12h12M8 18h12"/><circle cx="4" cy="6" r="1.2"/><circle cx="4" cy="12" r="1.2"/><circle cx="4" cy="18" r="1.2"/>',
};
const ic = (n, s = 16) => `<svg class="ic" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${IC[n]}</svg>`;

function toast(msg) {
  const t = $('#toast'); t.textContent = msg;
  clearTimeout(toast.t); clearTimeout(toast.h);
  try { if (!t.matches(':popover-open')) t.showPopover(); } catch (e) { /* sem popover: usa posição fixa */ }
  requestAnimationFrame(() => t.classList.add('show'));
  toast.t = setTimeout(() => { t.classList.remove('show'); toast.h = setTimeout(() => { try { t.hidePopover(); } catch (e) { /* ok */ } }, 250); }, 2400);
}
function validaCPF(v) {
  const c = String(v).replace(/\D/g, '');
  if (c.length !== 11 || /^(\d)\1+$/.test(c)) return false;
  for (const n of [9, 10]) {
    let s = 0; for (let i = 0; i < n; i++) s += +c[i] * (n + 1 - i);
    if ((s * 10) % 11 % 10 !== +c[n]) return false;
  }
  return true;
}

const te = new TextEncoder();
const b64 = buf => btoa(String.fromCharCode(...new Uint8Array(buf)));
const unb64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
async function chaveDe(pass, salt) {
  const raw = await crypto.subtle.importKey('raw', te.encode(pass), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: 120000, hash: 'SHA-256' }, raw, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}
async function hashPin(pin, salt) {
  const raw = await crypto.subtle.importKey('raw', te.encode(pin), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: 120000, hash: 'SHA-256' }, raw, 256);
  return b64(bits);
}
function pinGuardado() { try { return JSON.parse(localStorage.getItem(KEY_PIN)); } catch (e) { return null; } }
function sessaoOk() { try { return sessionStorage.getItem(KEY_OK) === '1'; } catch (e) { return false; } }
function marcarSessao() { try { sessionStorage.setItem(KEY_OK, '1'); } catch (e) { /* ok */ } }
function limparSessao() { try { sessionStorage.removeItem(KEY_OK); } catch (e) { /* ok */ } }
let idleT;
function resetIdle() {
  clearTimeout(idleT);
  idleT = setTimeout(() => { limparSessao(); exigirPin(); }, 5 * 60 * 1000);
}
async function exigirPin() {
  if (!globalThis.crypto || !crypto.subtle) {
    $('#lock').hidden = true;
    toast('PIN indisponível neste contexto. Use um perfil exclusivo deste computador.');
    return;
  }
  const lock = $('#lock'), form = $('#lock-form'), t = $('#lock-t'), p = $('#lock-p'), err = $('#lock-err');
  const pinEl = $('#lock-pin'), pin2w = $('#lock-pin2-wrap'), pin2 = $('#lock-pin2'), go = $('#lock-go'), reset = $('#lock-reset');
  const pintar = () => {
    const tem = pinGuardado();
    if (tem && sessaoOk()) { lock.hidden = true; $('#btn-lock').hidden = false; resetIdle(); return true; }
    const setup = !tem;
    lock.hidden = false; $('#btn-lock').hidden = true; err.hidden = true; pinEl.value = ''; pin2.value = '';
    t.textContent = setup ? 'Proteger o painel' : 'Painel bloqueado';
    p.textContent = setup
      ? 'Defina um PIN de 4 a 6 dígitos. Ele não sai deste navegador. Sem o PIN, quem abrir este perfil vê CPF, contratos e documentos.'
      : 'Já existe um PIN neste navegador. Digite-o, ou redefina abaixo.';
    pin2w.hidden = !setup;
    go.textContent = setup ? 'Definir PIN' : 'Desbloquear';
    reset.hidden = setup;
    pinEl.focus();
    return false;
  };
  if (pintar()) return;
  return new Promise(res => {
    const enviar = async e => {
      if (e) e.preventDefault();
      const tem = pinGuardado();
      const setup = !tem;
      const pin = pinEl.value.trim();
      err.hidden = true;
      if (!/^\d{4,6}$/.test(pin)) { err.textContent = 'Use 4 a 6 dígitos.'; err.hidden = false; return; }
      try {
        if (setup) {
          if (pin !== pin2.value.trim()) { err.textContent = 'Os PINs não coincidem.'; err.hidden = false; return; }
          const salt = crypto.getRandomValues(new Uint8Array(16));
          localStorage.setItem(KEY_PIN, JSON.stringify({ salt: b64(salt), hash: await hashPin(pin, salt) }));
        } else {
          const salt = unb64(tem.salt);
          if (await hashPin(pin, salt) !== tem.hash) { err.textContent = 'PIN incorreto.'; err.hidden = false; return; }
        }
        marcarSessao(); lock.hidden = true; $('#btn-lock').hidden = false; resetIdle(); res();
      } catch (ex) {
        err.textContent = 'Este navegador não permite proteger o PIN aqui. Abra por http://127.0.0.1 (servidor local), não só pelo arquivo.';
        err.hidden = false;
      }
    };
    form.onsubmit = enviar;
    go.onclick = enviar;
    reset.onclick = async () => {
      if (!(await confirmar('Redefinir o PIN deste navegador? Os cadastros continuam aqui; só o PIN é apagado.'))) return;
      try { localStorage.removeItem(KEY_PIN); } catch (e) { /* ok */ }
      limparSessao();
      pintar();
    };
  });
}
$('#btn-lock').onclick = () => { limparSessao(); exigirPin(); };
['click', 'keydown', 'pointerdown'].forEach(ev => document.addEventListener(ev, () => { if (sessaoOk()) resetIdle(); }, { passive: true }));

