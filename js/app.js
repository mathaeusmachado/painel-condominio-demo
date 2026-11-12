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
const vazio = () => ({ unidades: [], pessoas: [], cobrancas: [], despesas: [], contratos: [] });
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
  return { id, tipo: u.tipo === 'kitnet' ? 'kitnet' : 'quarto', nome: str(u.nome, 40), andar: str(u.andar, 40), valor: num(u.valor), obs: str(u.obs, 2000), itens };
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
  return { id, pessoaId: safeId(c.pessoaId), unidadeId: safeId(c.unidadeId), status: st, geradoEm: isoDate(c.geradoEm), enviadoEm: isoDate(c.enviadoEm), assinadoEm: isoDate(c.assinadoEm), assinadoPor: str(c.assinadoPor, 80) };
}
function normalizeDb(d) {
  if (!d || typeof d !== 'object') return vazio();
  return {
    unidades: arr(d.unidades).map(limparUnidade).filter(Boolean),
    pessoas: arr(d.pessoas).map(limparPessoa).filter(Boolean),
    cobrancas: arr(d.cobrancas).map(limparCob).filter(Boolean),
    despesas: arr(d.despesas).map(limparDesp).filter(Boolean),
    contratos: arr(d.contratos).map(limparContrato).filter(Boolean)
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
