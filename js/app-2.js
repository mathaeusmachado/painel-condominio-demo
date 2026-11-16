// ---------- Arquivos anexados (IndexedDB; metadados ficam no cadastro da pessoa) ----------
let _idb;
const idb = () => _idb || (_idb = new Promise((res, rej) => {
  const r = indexedDB.open('painel-condominio-arquivos', 1);
  r.onupgradeneeded = () => r.result.createObjectStore('f');
  r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
}));
const idbOp = (mode, fn) => idb().then(d => new Promise((res, rej) => {
  const t = d.transaction('f', mode), rq = fn(t.objectStore('f'));
  t.oncomplete = () => res(rq && rq.result); t.onerror = () => rej(t.error); t.onabort = () => rej(t.error);
}));
const arqPut = (id, blob) => idbOp('readwrite', s => s.put(blob, id));
const arqGet = id => idbOp('readonly', s => s.get(id));
const arqDel = id => idbOp('readwrite', s => s.delete(id)).catch(() => {});
const arqClear = () => idbOp('readwrite', s => s.clear()).catch(() => {});

const CAT = { rg: 'RG / CNH', cpf: 'CPF', passaporte: 'Passaporte', crnm: 'CRNM / RNM (ou protocolo)', visto: 'Visto / comprovante migratório',
  residencia: 'Comprovante de residência', contrato: 'Contrato assinado', foto: 'Foto', outro: 'Outro' };
const DOCS_OBRIG = { BR: ['rg', 'cpf', 'contrato'], EX: ['passaporte', 'crnm', 'visto', 'contrato'] }; // documentos esperados por tipo
const MAX_ARQ = 10 * 1024 * 1024;
const fmtTam = n => n >= 1048576 ? (n / 1048576).toFixed(1).replace('.', ',') + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB';
const docsFaltando = p => (DOCS_OBRIG[p.tipo] || []).filter(c => !(p.arquivos || []).some(a => a.categoria === c));
function docsBadge(p) {
  const n = (DOCS_OBRIG[p.tipo] || []).length, f = docsFaltando(p);
  const tip = f.length ? 'Faltam: ' + f.map(c => CAT[c]).join(', ') : 'Documentação completa';
  return `<span class="badge ${f.length ? 'warn' : 'ok'}" title="${esc(tip)}">${n - f.length}/${n}</span> <span class="k">${(p.arquivos || []).length} arq.</span>`;
}
async function magiaArq(f) {
  const b = new Uint8Array(await f.slice(0, 12).arrayBuffer());
  const pdf = b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46;
  const png = b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4E && b[3] === 0x47;
  const jpg = b[0] === 0xFF && b[1] === 0xD8;
  const gif = b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46;
  const webp = b[0] === 0x52 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50;
  if (pdf) return 'application/pdf';
  if (png || jpg || gif || webp) return f.type.startsWith('image/') ? f.type : 'image/jpeg';
  if (b[0] === 0x50 && b[1] === 0x4B) return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  if (/\.docx?$/i.test(f.name)) return f.type || 'application/msword';
  return '';
}
async function verArquivo(a, novo) {
  let blob = novo;
  if (!blob) { try { blob = await arqGet(a.id); } catch (e) { /* ignora */ } }
  if (!blob) return toast('Arquivo não encontrado neste navegador (anexos não entram no backup).');
  const url = URL.createObjectURL(blob), d = $('#previa');
  $('#previa-t').textContent = a.nome;
  const img = (blob.type || '').startsWith('image/');
  $('#previa-c').innerHTML = img
    ? `<img src="${url}" alt="${esc(a.nome)}">`
    : `<iframe src="${url}" title="${esc(a.nome)}" sandbox></iframe>`;
  d.onclose = () => { URL.revokeObjectURL(url); $('#previa-c').innerHTML = ''; };
  d.showModal();
}

// ---------- Consultas ----------
const AVISO_VISTO = 60, AVISO_CONTRATO = 30; // dias de antecedência do aviso
const diasAte = s => Math.round((new Date(s + 'T12:00') - new Date(today() + 'T12:00')) / 864e5);
const pessoa = id => db.pessoas.find(p => p.id === id);
const unidade = id => db.unidades.find(u => u.id === id);
const ativo = p => !p.dataSaida || p.dataSaida >= today();
const intervaloMes = comp => { const [y, m] = comp.split('-').map(Number); return { ini: `${comp}-01`, fim: `${comp}-${pad(daysIn(y, m))}` }; };
const ativoEm = (p, ini, fim) => !!(p.dataEntrada && p.dataEntrada <= fim && (!p.dataSaida || p.dataSaida >= ini));
const moradores = uId => db.pessoas.filter(p => p.unidadeId === uId && ativo(p));
const moradoresEm = (uId, ini, fim) => db.pessoas.filter(p => p.unidadeId === uId && ativoEm(p, ini, fim));
const valorAluguel = p => +p.valor || +(unidade(p.unidadeId)?.valor) || 0;
const statusCob = c => c.pago ? 'pago' : (c.vencimento < today() ? 'atrasado' : 'pendente');
const rotuloUnidade = id => { const u = unidade(id); return u ? `${u.tipo === 'kitnet' ? 'Kitnet' : 'Quarto'} ${u.nome}` : '—'; };
const quartos = () => db.unidades.filter(u => u.tipo === 'quarto');
const comissaoVisivelObs = () => !!(db.config && db.config.comissaoObs);
function addAno(iso) {
  if (!isoDate(iso)) return '';
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(y + 1, m - 1, d);
  if (dt.getMonth() !== m - 1) dt.setDate(0);
  return ymd(dt);
}
function maskCpf(v) {
  const d = String(v || '').replace(/\D/g, '');
  return d.length >= 2 ? `***.***.***-${d.slice(-2)}` : '***';
}
function docPessoa(p) {
  if (p.tipo === 'BR') return 'CPF ' + (isObs() ? maskCpf(p.cpf) : esc(p.cpf || '—'));
  if (isObs()) return p.passaporte ? 'Pass. ••••' + esc(String(p.passaporte).slice(-3)) : 'Doc. oculto';
  return p.passaporte ? 'Pass. ' + esc(p.passaporte) : 'CRNM ' + esc(p.crnm || '—');
}

// ---------- Modal ----------
const modal = $('#modal'), mform = $('#modal-form');
function abrirModal(html, onSubmit) {
  mform.innerHTML = html;
  mform.onsubmit = e => {
    e.preventDefault();
    if (e.submitter && e.submitter.value === 'cancel') { modal.close(); return; }
    const fd = Object.fromEntries(new FormData(mform).entries());
    Promise.resolve(onSubmit(fd, mform)).then(r => { if (r !== false) modal.close(); });
  };
  $$('[data-cancel]', mform).forEach(b => b.onclick = () => modal.close());
  modal.showModal();
}
// Avisos dentro do diálogo (alert/confirm nativos não funcionam em todos os ambientes)
function erro(msg) {
  let e = $('.form-erro', mform);
  if (!e) { e = document.createElement('div'); e.className = 'form-erro'; mform.prepend(e); }
  e.textContent = msg; e.scrollIntoView({ block: 'nearest' });
}
function confirmar(msg) {
  return new Promise(res => {
    const d = $('#confirmar'); $('#conf-msg').textContent = msg; d.returnValue = '';
    d.onclose = () => res(d.returnValue === 'yes'); d.showModal();
  });
}
const campo = (label, name, val = '', extra = '', cls = '') =>
  `<div class="${cls}"><label>${label}</label><input name="${name}" value="${esc(val)}" ${extra}></div>`;
const botoes = () => `<div class="modal-actions full" style="grid-column:1/-1"><button type="button" data-cancel>Cancelar</button><button class="primary">Salvar</button></div>`;

// ---------- Avisos de visto / contrato ----------
function listaAlertas() {
  const out = [];
  db.pessoas.filter(ativo).forEach(p => {
    [['Visto/documento', p.validadeVisto, AVISO_VISTO], ['Contrato', p.dataFimContrato, AVISO_CONTRATO]].forEach(([tipo, data, lim]) => {
      if (!data) return;
      const d = diasAte(data);
      if (d <= lim) out.push({ p, tipo, data, d });
    });
  });
  return out.sort((x, y) => x.d - y.d);
}
function lembrarBackupHtml() {
  if (DEMO) return '';
  let em = '';
  try { em = localStorage.getItem(KEY_BACKUP) || ''; } catch (e) { /* ok */ }
  const dias = em && ISO_D.test(em) ? Math.round((new Date(today() + 'T12:00') - new Date(em + 'T12:00')) / 864e5) : 999;
  if (dias <= 7) return '';
  const txt = em ? `Último backup há ${dias} dia(s).` : 'Você ainda não fez backup neste navegador.';
  return `<div class="alerta-box" style="margin-bottom:.8rem;display:flex;align-items:flex-start;gap:.5rem;font-weight:600">${ic('alert', 18)} <span>${esc(txt)} Os dados (CPF, contratos) ficam só neste perfil — copiar a pasta do HTML não copia o cadastro. Use Backup criptografado.</span></div>`;
}
function renderAlertas() {
  const l = listaAlertas(), box = $('#alertas');
  const bk = lembrarBackupHtml();
  if (!db.pessoas.length && !db.unidades.length) {
    box.innerHTML = bk + `<div class="alerta-vazio"><strong>Comece por aqui.</strong> Cadastre um quarto ou kitnet na aba “Quartos e Kitnets”, ou
      <button class="small primary" data-exemplo>carregue dados de exemplo</button> para conhecer o painel.</div>`;
    return;
  }
  if (!l.length) { box.innerHTML = bk; return; }
  const txt = d => d < 0 ? `venceu há ${-d} dia(s)` : d === 0 ? 'vence hoje' : `vence em ${d} dia(s)`;
  const aberto = window.matchMedia('(min-width:721px)').matches ? ' open' : '';
  box.innerHTML = bk + `<details class="alerta-box"${aberto}><summary>${ic('alert', 18)} ${l.length} aviso(s): visto/contrato vencido ou perto de vencer</summary>
    ${l.map(x => `<div class="alerta"><span class="badge ${x.d <= 7 ? 'bad' : 'warn'}">${txt(x.d)}</span>
      <div class="grow"><strong>${esc(x.p.nome)}</strong> — ${esc(x.tipo)} em ${fmtData(x.data)} · ${esc(rotuloUnidade(x.p.unidadeId))}</div>
      ${isObs() ? '' : `<button class="small" data-alerta="${esc(x.p.id)}">Abrir cadastro</button>`}</div>`).join('')}</details>`;
}
$('#alertas').onclick = e => {
  const a = e.target.closest('[data-alerta]'), ex = e.target.closest('[data-exemplo]');
  if (a && !isObs()) { const p = pessoa(a.dataset.alerta); if (p) formPessoa(p); }
  if (ex && !isObs()) carregarExemplo();
};

// ---------- Abas ----------
function irAba(tab) {
  $$('#tabs button').forEach(x => x.classList.toggle('active', x.dataset.tab === tab));
  $$('.tab').forEach(t => t.classList.toggle('active', t.id === 'tab-' + tab));
}
$('#tabs').onclick = e => {
  const b = e.target.closest('button'); if (!b) return;
  if (isObs() && b.dataset.tab === 'financeiro' && !comissaoVisivelObs()) return toast('Financeiro completo só o dono vê. A comissão do Geovani aparece aqui se o dono autorizar.');
  irAba(b.dataset.tab);
  render();
};
function acomodarNav() {
  const nav = $('#tabs'), bar = $('.topbar');
  if (!nav || !bar) return;
  const mobile = window.matchMedia('(max-width:720px)').matches;
  if (mobile && nav.parentElement !== document.body) document.body.appendChild(nav);
  if (!mobile && nav.parentElement !== bar) bar.insertBefore(nav, $('.tools', bar));
}
window.addEventListener('resize', acomodarNav);
acomodarNav();
function render() {
  document.body.classList.toggle('papel-obs', isObs());
  document.body.classList.toggle('comissao-obs', comissaoVisivelObs());
  if (isObs() && $('#tabs .active')?.dataset.tab === 'financeiro' && !comissaoVisivelObs()) irAba('calendario');
  renderAlertas();
  const t = $('#tabs .active')?.dataset.tab;
  const fn = ({ financeiro: renderFin, calendario: renderCal, pessoas: renderPessoas, unidades: renderUnidades, contratos: renderContratos, regras: renderRegras })[t];
  if (fn) fn();
}

