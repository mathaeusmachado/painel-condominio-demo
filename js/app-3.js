function linhaItem(i = { nome: '', qtd: 1, estado: 'Bom' }) {
  return `<div class="item">
    <input name="i_nome" placeholder="Ex.: Cama de solteiro, Geladeira…" value="${esc(i.nome)}">
    <input name="i_qtd" type="number" min="1" value="${i.qtd}">
    <select name="i_estado">${ESTADOS.map(s => `<option ${s === i.estado ? 'selected' : ''}>${s}</option>`).join('')}</select>
    <button type="button" class="small danger" data-rm aria-label="Remover item">${ic('x', 13)}</button></div>`;
}
const ITENS_SUGERIDOS = ['Cama', 'Colchão', 'Guarda-roupa', 'Mesa', 'Cadeira', 'Geladeira', 'Fogão', 'Micro-ondas', 'Ar-condicionado', 'Ventilador', 'Armário de cozinha', 'Chuveiro', 'Cortina', 'Ventilador de teto'];

function formUnidade(u = {}) {
  const novo = !u.id;
  abrirModal(`
    <h3>${novo ? 'Nova unidade' : 'Editar ' + esc(rotuloUnidade(u.id))}</h3>
    <div class="form">
      <div><label>Tipo</label><select name="tipo"><option value="quarto" ${u.tipo === 'quarto' ? 'selected' : ''}>Quarto</option><option value="kitnet" ${u.tipo === 'kitnet' ? 'selected' : ''}>Kitnet</option></select></div>
      ${campo('Número / nome *', 'nome', u.nome, 'required placeholder="Ex.: 101"')}
      ${campo('Andar / bloco', 'andar', u.andar)}
      ${campo('Valor do aluguel (R$)', 'valor', u.valor, 'type="number" step="0.01" min="0"')}
      <fieldset><legend>Mobília e itens do quarto</legend>
        <div class="itens" id="itens">${(u.itens || []).map(linhaItem).join('')}</div>
        <div class="row gap" style="margin-top:.4rem">
          <button type="button" id="add-item" class="small">+ Item</button>
          <select id="sug" style="width:auto"><option value="">Adicionar item comum…</option>${ITENS_SUGERIDOS.map(s => `<option>${s}</option>`).join('')}</select>
        </div>
      </fieldset>
      <div class="full"><label>Observações</label><textarea name="obs" rows="2">${esc(u.obs)}</textarea></div>
      ${botoes()}
    </div>`, (fd, f) => {
    const nomes = $$('[name=i_nome]', f), qtds = $$('[name=i_qtd]', f), ests = $$('[name=i_estado]', f);
    const itens = nomes.map((n, i) => ({ nome: n.value.trim(), qtd: +qtds[i].value || 1, estado: ests[i].value })).filter(i => i.nome);
    const reg = { id: u.id || uid(), tipo: fd.tipo, nome: fd.nome.trim(), andar: fd.andar, valor: +fd.valor || 0, obs: fd.obs, itens };
    if (db.unidades.some(x => x.id !== reg.id && x.tipo === reg.tipo && x.nome.toLowerCase() === reg.nome.toLowerCase())) { erro('Já existe uma unidade com esse tipo e nome.'); return false; }
    if (novo) db.unidades.push(reg); else db.unidades[db.unidades.findIndex(x => x.id === u.id)] = reg;
    save(); render(); toast('Unidade salva');
  });
  const box = $('#itens');
  $('#add-item').onclick = () => box.insertAdjacentHTML('beforeend', linhaItem());
  $('#sug').onchange = e => { if (e.target.value) box.insertAdjacentHTML('beforeend', linhaItem({ nome: e.target.value, qtd: 1, estado: 'Bom' })); e.target.value = ''; };
  box.onclick = e => { const rm = e.target.closest('[data-rm]'); if (rm) rm.closest('.item').remove(); };
}

// =====================================================================
// FINANCEIRO
// =====================================================================
$('#fin-mes').value = today().slice(0, 7);
$('#fin-mes').onchange = renderFin;

function cobrancasDoMes(comp) { return db.cobrancas.filter(c => c.competencia === comp); }
function totaisMes(comp) {
  const cs = cobrancasDoMes(comp);
  const previsto = cs.reduce((s, c) => s + c.valor, 0);
  const recebido = cs.filter(c => c.pago).reduce((s, c) => s + c.valor, 0);
  const atrasado = cs.filter(c => statusCob(c) === 'atrasado').reduce((s, c) => s + c.valor, 0);
  const despesas = db.despesas.filter(d => d.data.startsWith(comp)).reduce((s, d) => s + d.valor, 0);
  return { previsto, recebido, atrasado, aReceber: previsto - recebido, despesas, saldo: recebido - despesas };
}

function renderFin() {
  const comp = $('#fin-mes').value || today().slice(0, 7);
  const t = totaisMes(comp);
  const card = (k, v, cls = '') => `<div class="card"><div class="k">${k}</div><div class="v ${cls}">${v}</div></div>`;
  $('#fin-cards').innerHTML =
    card('Previsto no mês', brl(t.previsto)) + card('Recebido', brl(t.recebido)) +
    card('A receber', brl(t.aReceber)) + card('Em atraso', brl(t.atrasado), t.atrasado ? 'bad' : '') +
    card('Despesas', brl(t.despesas)) + card('Saldo do mês', brl(t.saldo), t.saldo >= 0 ? 'ok' : 'bad');

  // gráfico 6 meses
  const meses = [-5, -4, -3, -2, -1, 0].map(n => addMonths(comp, n));
  const dados = meses.map(m => { const x = totaisMes(m); return { m, r: x.recebido, d: x.despesas }; });
  const nice = n => { const p = 10 ** Math.floor(Math.log10(n)), f = n / p; return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * p; };
  const max = nice(Math.max(100, ...dados.flatMap(x => [x.r, x.d])));
  const eixo = n => n >= 1000 ? (n / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + ' mil' : String(Math.round(n));
  $('#fin-chart').innerHTML = `<div class="chart">
    <div class="grid-lines"><span><i>${eixo(max)}</i></span><span><i>${eixo(max / 2)}</i></span><span><i>0</i></span></div>
    <div class="bars">${dados.map(x => `
      <div class="bar-col" tabindex="0" role="img" aria-label="${nomeMes(x.m)}: recebido ${brl(x.r)}, despesas ${brl(x.d)}">
        <div class="bar-pair"><div class="bar in" style="height:${x.r / max * 100}%"></div><div class="bar out" style="height:${x.d / max * 100}%"></div></div>
        <span class="lbl">${nomeMesCurto(x.m)}</span>
        <div class="tip"><strong>${nomeMes(x.m)}</strong><span><i class="dot s1"></i>Recebido ${brl(x.r)}</span><span><i class="dot s2"></i>Despesas ${brl(x.d)}</span></div>
      </div>`).join('')}</div></div>
    <div class="legend"><span><i class="dot s1"></i> Recebido</span><span><i class="dot s2"></i> Despesas</span></div>`;

  // ocupação do mês financeiro (não de hoje)
  const { ini, fim } = intervaloMes(comp);
  const tot = db.unidades.length, oc = db.unidades.filter(u => moradoresEm(u.id, ini, fim).length).length;
  const pot = db.unidades.reduce((s, u) => s + (u.valor || 0), 0);
  const ocRenda = db.unidades.reduce((s, u) => s + moradoresEm(u.id, ini, fim).reduce((t, p) => t + valorAluguel(p), 0), 0);
  const pct = tot ? oc / tot : 0, C = 2 * Math.PI * 54;
  $('#fin-ocupacao').innerHTML = `<div class="occ">
    <div class="ring"><svg width="132" height="132" viewBox="0 0 132 132" aria-hidden="true">
      <circle cx="66" cy="66" r="54" fill="none" stroke="var(--fill)" stroke-width="12"/>
      <circle cx="66" cy="66" r="54" fill="none" stroke="var(--accent)" stroke-width="12" stroke-linecap="round" stroke-dasharray="${(C * pct).toFixed(1)} ${C.toFixed(1)}"/></svg>
      <div class="num"><span>${Math.round(pct * 100)}%</span><small>${oc} de ${tot}</small></div></div>
    <ul><li>Ocupadas <b>${oc}</b></li><li>Livres <b>${tot - oc}</b></li>
      <li>Kitnets <b>${db.unidades.filter(u => u.tipo === 'kitnet').length}</b></li><li>Quartos <b>${db.unidades.filter(u => u.tipo === 'quarto').length}</b></li>
      <li>Renda contratada <b>${brl(ocRenda)}</b></li><li>Renda potencial <b>${brl(pot)}</b></li></ul></div>`;

  // cobranças
  const cs = cobrancasDoMes(comp).sort((a, b) => a.vencimento.localeCompare(b.vencimento));
  const bd = { pago: ['ok', 'Pago'], atrasado: ['bad', 'Atrasado'], pendente: ['warn', 'Pendente'] };
  $('#tb-cobrancas').innerHTML = cs.length ? `
    <tr><th>Morador</th><th>Unidade</th><th>Vencimento</th><th>Valor</th><th>Status</th><th>Pago em</th><th></th></tr>
    ${cs.map(c => { const p = pessoa(c.pessoaId), s = statusCob(c); return `<tr>
      <td>${esc(p ? p.nome : (c.nome || '(removido)'))}</td><td>${esc(rotuloUnidade(c.unidadeId))}</td><td>${fmtData(c.vencimento)}</td><td>${brl(c.valor)}</td>
      <td><span class="badge ${bd[s][0]}">${bd[s][1]}</span></td><td>${fmtData(c.dataPgto)}</td>
      <td class="actions">${isObs() ? '' : `${c.pago ? `<button class="small" data-desfaz="${esc(c.id)}">Desfazer</button>` : `<button class="small primary" data-paga="${esc(c.id)}">Marcar pago</button>`}
        <button class="small" data-edc="${esc(c.id)}">Editar</button>
        <button class="small danger" data-delc="${esc(c.id)}" aria-label="Excluir cobrança">${ic('x', 13)}</button>`}</td></tr>`; }).join('')}` :
    '<tr><td class="empty">Sem cobranças neste mês. Use “Gerar cobranças do mês”.</td></tr>';

  const ds = db.despesas.filter(d => d.data.startsWith(comp)).sort((a, b) => a.data.localeCompare(b.data));
  $('#tb-despesas').innerHTML = ds.length ? `
    <tr><th>Data</th><th>Descrição</th><th>Categoria</th><th>Valor</th><th></th></tr>
    ${ds.map(d => `<tr><td>${fmtData(d.data)}</td><td>${esc(d.descricao)}</td><td>${esc(d.categoria)}</td><td>${brl(d.valor)}</td>
      <td class="actions">${isObs() ? '' : `<button class="small danger" data-deld="${esc(d.id)}" aria-label="Excluir despesa">${ic('x', 13)}</button>`}</td></tr>`).join('')}` :
    '<tr><td class="empty">Sem despesas neste mês.</td></tr>';
}

$('#btn-gerar').onclick = async () => {
  if (isObs()) return toast('Observador só consulta. Peça ao dono para gerar cobranças.');
  const comp = isoMes($('#fin-mes').value || today().slice(0, 7));
  if (!comp) return toast('Escolha um mês válido.');
  const saidas = db.pessoas.filter(p => p.unidadeId && valorAluguel(p) && p.dataEntrada && p.dataEntrada.slice(0, 7) <= comp
    && p.dataSaida && p.dataSaida.slice(0, 7) === comp && p.dataSaida < venc(comp, p.diaVenc)
    && !db.cobrancas.some(c => c.pessoaId === p.id && c.competencia === comp));
  const pular = new Set();
  if (saidas.length && !(await confirmar(`${saidas.map(p => p.nome).join(', ')} saiu(ram) neste mês antes do vencimento. Gerar aluguel cheio mesmo assim?`))) {
    saidas.forEach(p => pular.add(p.id));
  }
  let n = 0;
  db.pessoas.forEach(p => {
    const valor = valorAluguel(p);
    if (pular.has(p.id)) return;
    if (!p.unidadeId || !valor || !p.dataEntrada || p.dataEntrada.slice(0, 7) > comp) return;
    if (p.dataSaida && p.dataSaida.slice(0, 7) < comp) return;
    if (db.cobrancas.some(c => c.pessoaId === p.id && c.competencia === comp)) return;
    db.cobrancas.push({ id: uid(), pessoaId: p.id, unidadeId: p.unidadeId, nome: p.nome, competencia: comp, valor, vencimento: venc(comp, p.diaVenc), pago: false, dataPgto: '' });
    n++;
  });
  save(); renderFin(); toast(n ? `${n} cobrança(s) gerada(s)` : 'Nada a gerar — já existem ou não há moradores com valor definido');
};
function formCobranca(c, modo) {
  const p = pessoa(c.pessoaId);
  abrirModal(`<h3>${modo === 'pago' ? 'Marcar como pago' : 'Editar cobrança'}</h3><div class="form">
    <p class="k full">${esc(p ? p.nome : c.nome || '')} · ${esc(rotuloUnidade(c.unidadeId))}</p>
    ${campo('Valor (R$)', 'valor', c.valor, 'type="number" step="0.01" min="0" required')}
    ${campo('Vencimento', 'vencimento', c.vencimento, 'type="date" required')}
    ${campo('Pago em', 'dataPgto', modo === 'pago' ? (c.dataPgto || today()) : c.dataPgto, 'type="date"')}
    ${campo('Obs.', 'obs', c.obs, '', 'full')}
    ${botoes()}</div>`, fd => {
    c.valor = +fd.valor; c.vencimento = fd.vencimento; c.obs = fd.obs;
    if (modo === 'pago' || fd.dataPgto) { c.pago = true; c.dataPgto = fd.dataPgto || today(); }
    save(); render(); toast(modo === 'pago' ? 'Pagamento registrado' : 'Cobrança atualizada');
  });
}
$('#tb-cobrancas').onclick = async e => {
  const paga = e.target.closest('[data-paga]'), desfaz = e.target.closest('[data-desfaz]');
  const delc = e.target.closest('[data-delc]'), edc = e.target.closest('[data-edc]');
  if (!paga && !desfaz && !delc && !edc) return;
  const cob = id => db.cobrancas.find(x => x.id === id);
  if (paga) { const x = cob(paga.dataset.paga); if (x) formCobranca(x, 'pago'); return; }
  if (edc) { const x = cob(edc.dataset.edc); if (x) formCobranca(x, 'edit'); return; }
  if (desfaz) { const x = cob(desfaz.dataset.desfaz); if (x) { x.pago = false; x.dataPgto = ''; } }
  if (delc && await confirmar('Excluir esta cobrança?')) db.cobrancas = db.cobrancas.filter(x => x.id !== delc.dataset.delc);
  save(); renderFin();
};
$('#tb-despesas').onclick = async e => {
  const del = e.target.closest('[data-deld]');
  if (del && await confirmar('Excluir esta despesa?')) { db.despesas = db.despesas.filter(x => x.id !== del.dataset.deld); save(); renderFin(); }
};
$('#btn-nova-despesa').onclick = () => {
  if (isObs()) return toast('Observador só consulta.');
  const cats = ['Água', 'Luz', 'Internet', 'Limpeza', 'Manutenção', 'Impostos', 'Reforma', 'Mobília', 'Outros'];
  abrirModal(`<h3>Nova despesa</h3><div class="form">
    ${campo('Descrição *', 'descricao', '', 'required', 'full')}
    <div><label>Categoria</label><select name="categoria">${cats.map(c => `<option>${c}</option>`).join('')}</select></div>
    ${campo('Valor (R$) *', 'valor', '', 'type="number" step="0.01" min="0.01" required')}
    ${campo('Data', 'data', today(), 'type="date" required')}${botoes()}</div>`, fd => {
    db.despesas.push({ id: uid(), descricao: fd.descricao, categoria: fd.categoria, valor: +fd.valor, data: fd.data });
    save(); renderFin(); toast('Despesa registrada');
  });
};

// =====================================================================
// CALENDÁRIO
// =====================================================================
let calMes = today().slice(0, 7), calSel = today();

function eventosDoMes(comp) {
  const ev = {}; const add = (d, e) => (ev[d] = ev[d] || []).push(e);
  db.pessoas.forEach(p => {
    if (p.dataEntrada && p.dataEntrada.startsWith(comp)) add(p.dataEntrada, { t: 'entrada', txt: `Entrada: ${p.nome}`, sub: rotuloUnidade(p.unidadeId) });
    if (p.dataSaida && p.dataSaida.startsWith(comp)) add(p.dataSaida, { t: 'saida', txt: `Saída: ${p.nome}`, sub: rotuloUnidade(p.unidadeId) });
    if (p.dataFimContrato && p.dataFimContrato.startsWith(comp)) add(p.dataFimContrato, { t: 'contrato', txt: `Fim do contrato: ${p.nome}`, sub: rotuloUnidade(p.unidadeId) });
    if (p.validadeVisto && p.validadeVisto.startsWith(comp)) add(p.validadeVisto, { t: 'visto', txt: `Vence visto/doc: ${p.nome}`, sub: p.visto || '' });
    // vencimento previsto (sem cobrança gerada)
    if (p.unidadeId && valorAluguel(p) && p.dataEntrada && p.dataEntrada.slice(0, 7) <= comp && !(p.dataSaida && p.dataSaida.slice(0, 7) < comp)
      && !db.cobrancas.some(c => c.pessoaId === p.id && c.competencia === comp)) {
      const d = venc(comp, p.diaVenc);
      add(d, { t: d < today() ? 'atraso' : 'venc', txt: `Vence aluguel: ${p.nome}`, sub: `${brl(valorAluguel(p))} · ${rotuloUnidade(p.unidadeId)} (cobrança não gerada)` });
    }
  });
  db.cobrancas.filter(c => c.competencia === comp).forEach(c => {
    const p = pessoa(c.pessoaId), nome = p ? p.nome : (c.nome || '?');
    if (c.pago && isoDate(c.dataPgto)) add(c.dataPgto, { t: 'pago', txt: `Pago: ${nome}`, sub: `${brl(c.valor)} · ${rotuloUnidade(c.unidadeId)}` });
    else add(c.vencimento, { t: statusCob(c) === 'atrasado' ? 'atraso' : 'venc', txt: `Vence: ${nome}`, sub: `${brl(c.valor)} · ${rotuloUnidade(c.unidadeId)}`, cobId: c.id });
  });
  return ev;
}

function renderCal() {
  $('#cal-titulo').textContent = nomeMes(calMes);
  const [y, m] = calMes.split('-').map(Number);
  const ev = eventosDoMes(calMes);
  const primeiro = new Date(y, m - 1, 1).getDay(), dias = daysIn(y, m);
  let h = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(d => `<div class="h">${d}</div>`).join('');
  for (let i = 0; i < primeiro; i++) h += '<div></div>';
  for (let d = 1; d <= dias; d++) {
    const dt = `${calMes}-${pad(d)}`;
    h += `<div class="d ${dt === today() ? 'today' : ''} ${dt === calSel ? 'sel' : ''}" data-d="${dt}"><strong>${d}</strong>
      <div class="dots">${(ev[dt] || []).map(e => `<i class="dot ${e.t}"></i>`).join('')}</div></div>`;
  }
  $('#cal-grid').innerHTML = h;
  const lista = ev[calSel] || [];
  $('#cal-dia-titulo').textContent = fmtData(calSel);
  $('#cal-dia').innerHTML = calSel.startsWith(calMes)
    ? (lista.length ? lista.map(e => `<div class="ev"><i class="dot ${e.t}"></i><div class="grow"><div>${esc(e.txt)}</div><div class="k" style="color:var(--muted);font-size:.8rem">${esc(e.sub)}</div></div>${e.cobId ? `<button class="small primary" data-paga="${esc(e.cobId)}">Marcar pago</button>` : ''}</div>`).join('') : '<div class="empty">Nada neste dia.</div>')
    : '<div class="empty">Selecione um dia deste mês.</div>';
}
$('#cal-grid').onclick = e => { const d = e.target.closest('[data-d]'); if (d) { calSel = d.dataset.d; renderCal(); } };
$('#cal-prev').onclick = () => { calMes = addMonths(calMes, -1); calSel = calMes + '-01'; renderCal(); };
$('#cal-next').onclick = () => { calMes = addMonths(calMes, 1); calSel = calMes + '-01'; renderCal(); };
$('#cal-hoje').onclick = () => { calMes = today().slice(0, 7); calSel = today(); renderCal(); };
$('#cal-dia').onclick = e => {
  const paga = e.target.closest('[data-paga]'); if (!paga) return;
  const x = db.cobrancas.find(c => c.id === paga.dataset.paga); if (x) formCobranca(x, 'pago');
};

// =====================================================================
// BACKUP, DADOS DE EXEMPLO
// =====================================================================
function baixarBlob(nome, blob) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = nome; a.click(); URL.revokeObjectURL(a.href);
}
async function cifrarBackup(json, senha) {
  const salt = crypto.getRandomValues(new Uint8Array(16)), iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await chaveDe(senha, salt);
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, te.encode(json));
  return JSON.stringify({ v: 1, alg: 'AES-GCM', salt: b64(salt), iv: b64(iv), ct: b64(ct) });
}
async function decifrarBackup(obj, senha) {
  const key = await chaveDe(senha, unb64(obj.salt));
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(obj.iv) }, key, unb64(obj.ct));
  return JSON.parse(new TextDecoder().decode(pt));
}
