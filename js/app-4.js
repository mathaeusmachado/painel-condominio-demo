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
  const cms = (db.comissoes || []).filter(c => c.competencia === comp);
  const comissao = cms.reduce((s, c) => s + c.valor, 0);
  const comissaoPaga = cms.filter(c => c.pago).reduce((s, c) => s + c.valor, 0);
  return { previsto, recebido, atrasado, aReceber: previsto - recebido, despesas, comissao, comissaoPaga, saldo: recebido - despesas - comissaoPaga };
}

function renderFin() {
  const comp = $('#fin-mes').value || today().slice(0, 7);
  const t = totaisMes(comp);
  const card = (k, v, cls = '') => `<div class="card"><div class="k">${k}</div><div class="v ${cls}">${v}</div></div>`;
  $('#fin-cards').innerHTML =
    card('Previsto no mês', brl(t.previsto)) + card('Recebido', brl(t.recebido)) +
    card('A receber', brl(t.aReceber)) + card('Em atraso', brl(t.atrasado), t.atrasado ? 'bad' : '') +
    card('Despesas', brl(t.despesas)) + card('Comissão Geovani', brl(t.comissao)) +
    card('Saldo do mês', brl(t.saldo), t.saldo >= 0 ? 'ok' : 'bad');

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
  renderComissao(comp);
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

function renderComissao(comp) {
  if (!db.config) db.config = limparConfig({});
  const chk = $('#chk-comissao-obs');
  if (chk) chk.checked = !!db.config.comissaoObs;
  const qs = quartos().slice().sort((a, b) => a.nome.localeCompare(b.nome, 'pt', { numeric: true }));
  const tbv = $('#tb-comissao-valores');
  if (tbv) {
    tbv.innerHTML = qs.length ? `<tr><th>Quarto</th><th>Andar</th><th>Aluguel</th><th>Comissão Geovani (R$)</th></tr>` + qs.map(u => `<tr>
      <td>${esc(rotuloUnidade(u.id))}</td><td>${esc(u.andar || '—')}</td><td>${u.valor ? brl(u.valor) : '—'}</td>
      <td>${isObs() ? brl(u.comissao || 0) : `<input data-comu="${esc(u.id)}" type="number" min="0" step="0.01" value="${u.comissao || 0}" style="width:8.5rem">`}</td></tr>`).join('')
      : '<tr><td class="empty">Nenhum quarto cadastrado.</td></tr>';
  }
  const lista = (db.comissoes || []).filter(c => c.competencia === comp).sort((a, b) => rotuloUnidade(a.unidadeId).localeCompare(rotuloUnidade(b.unidadeId), 'pt'));
  const tbc = $('#tb-comissoes');
  if (!tbc) return;
  const bd = { pago: ['ok', 'Pago'], atrasado: ['bad', 'Atrasado'], pendente: ['warn', 'Pendente'] };
  tbc.innerHTML = lista.length ? `<tr><th>Quarto</th><th>Vencimento</th><th>Valor</th><th>Status</th><th>Pago em</th><th></th></tr>` + lista.map(c => {
    const s = statusCob(c);
    return `<tr><td>${esc(rotuloUnidade(c.unidadeId))}</td><td>${fmtData(c.vencimento)}</td><td>${brl(c.valor)}</td>
      <td><span class="badge ${bd[s][0]}">${bd[s][1]}</span></td><td>${fmtData(c.dataPgto)}</td>
      <td class="actions">${isObs() ? '' : `${c.pago ? `<button class="small" data-cdes="${esc(c.id)}">Desfazer</button>` : `<button class="small primary" data-cpaga="${esc(c.id)}">Marcar pago</button>`}
        <button class="small" data-ced="${esc(c.id)}">Editar</button>
        <button class="small danger" data-cdel="${esc(c.id)}" aria-label="Excluir">${ic('x', 13)}</button>`}</td></tr>`;
  }).join('') : '<tr><td class="empty">Sem lançamento neste mês. O dono gera a comissão de cada quarto.</td></tr>';
}
$('#chk-comissao-obs') && ($('#chk-comissao-obs').onchange = () => {
  if (isObs()) return;
  if (!db.config) db.config = limparConfig({});
  db.config.comissaoObs = $('#chk-comissao-obs').checked;
  save(); render();
  toast(db.config.comissaoObs ? 'Observador passa a ver a comissão no Financeiro.' : 'Comissão oculta para o observador.');
});
$('#tb-comissao-valores') && ($('#tb-comissao-valores').onchange = e => {
  if (isObs()) return;
  const inp = e.target.closest('[data-comu]'); if (!inp) return;
  const u = unidade(inp.dataset.comu); if (!u || u.tipo !== 'quarto') return;
  u.comissao = Math.max(0, num(inp.value));
  save();
});
$('#btn-gerar-comissao') && ($('#btn-gerar-comissao').onclick = () => {
  if (isObs()) return toast('Observador só consulta.');
  const comp = isoMes($('#fin-mes').value || today().slice(0, 7));
  if (!comp) return toast('Escolha um mês válido.');
  let n = 0;
  quartos().forEach(u => {
    const valor = num(u.comissao);
    if (valor <= 0) return;
    if ((db.comissoes || []).some(c => c.unidadeId === u.id && c.competencia === comp)) return;
    db.comissoes.push({ id: uid(), unidadeId: u.id, competencia: comp, valor, vencimento: venc(comp, 10), pago: false, dataPgto: '', obs: 'Comissão Geovani' });
    n++;
  });
  save(); renderFin(); toast(n ? `${n} comissão(ões) lançada(s)` : 'Nada a gerar — já lançado ou quarto sem valor de comissão.');
});
function formComissao(c, modo) {
  abrirModal(`<h3>${modo === 'pago' ? 'Marcar comissão paga' : 'Editar comissão'}</h3><div class="form">
    <p class="k full">${esc(rotuloUnidade(c.unidadeId))} · Geovani</p>
    ${campo('Valor (R$)', 'valor', c.valor, 'type="number" step="0.01" min="0" required')}
    ${campo('Vencimento', 'vencimento', c.vencimento, 'type="date" required')}
    ${campo('Pago em', 'dataPgto', modo === 'pago' ? (c.dataPgto || today()) : c.dataPgto, 'type="date"')}
    ${campo('Obs.', 'obs', c.obs, '', 'full')}
    ${botoes()}</div>`, fd => {
    c.valor = +fd.valor; c.vencimento = fd.vencimento; c.obs = fd.obs;
    if (modo === 'pago' || fd.dataPgto) { c.pago = true; c.dataPgto = fd.dataPgto || today(); }
    save(); render(); toast(modo === 'pago' ? 'Comissão marcada como paga' : 'Comissão atualizada');
  });
}
$('#tb-comissoes') && ($('#tb-comissoes').onclick = async e => {
  if (isObs()) return;
  const paga = e.target.closest('[data-cpaga]'), des = e.target.closest('[data-cdes]');
  const del = e.target.closest('[data-cdel]'), ed = e.target.closest('[data-ced]');
  if (!paga && !des && !del && !ed) return;
  const cob = id => (db.comissoes || []).find(x => x.id === id);
  if (paga) { const x = cob(paga.dataset.cpaga); if (x) formComissao(x, 'pago'); return; }
  if (ed) { const x = cob(ed.dataset.ced); if (x) formComissao(x, 'edit'); return; }
  if (des) { const x = cob(des.dataset.cdes); if (x) { x.pago = false; x.dataPgto = ''; } }
  if (del && await confirmar('Excluir este lançamento de comissão?')) db.comissoes = db.comissoes.filter(x => x.id !== del.dataset.cdel);
  save(); renderFin();
});

