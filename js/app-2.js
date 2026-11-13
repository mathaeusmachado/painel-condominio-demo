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
  if (isObs() && b.dataset.tab === 'financeiro') return toast('Financeiro completo só o dono vê. Use o calendário para vencimentos e cobrança.');
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
  if (isObs() && $('#tabs .active')?.dataset.tab === 'financeiro') irAba('calendario');
  renderAlertas();
  const t = $('#tabs .active')?.dataset.tab;
  const fn = ({ financeiro: renderFin, calendario: renderCal, pessoas: renderPessoas, unidades: renderUnidades, contratos: renderContratos })[t];
  if (fn) fn();
}

// =====================================================================
// PESSOAS
// =====================================================================
function prazo(data, p, lim) {
  if (!isoDate(data)) return '—';
  const d = diasAte(data);
  return esc(fmtData(data)) + (ativo(p) && d <= lim ? ` <span class="badge ${d <= 7 ? 'bad' : 'warn'}">${d < 0 ? 'vencido' : d + ' d'}</span>` : '');
}
function renderPessoas() {
  const q = $('#pes-busca').value.trim().toLowerCase(), f = $('#pes-filtro').value;
  const lista = db.pessoas.filter(p => {
    if (f === 'BR' && p.tipo !== 'BR') return false;
    if (f === 'EX' && p.tipo !== 'EX') return false;
    if (f === 'ativo' && !ativo(p)) return false;
    if (f === 'inativo' && ativo(p)) return false;
    return !q || [p.nome, p.cpf, p.rg, p.passaporte, p.crnm, p.telefone, p.email].join(' ').toLowerCase().includes(q);
  }).sort((a, b) => a.nome.localeCompare(b.nome));
  $('#tb-pessoas').innerHTML = lista.length ? `
    <tr><th>Nome</th><th>Origem</th><th>Documento</th><th>Contato</th><th>Unidade</th><th>Entrada</th><th>Contrato até</th><th>Docs</th><th>Aluguel</th><th>Venc.</th><th></th></tr>
    ${lista.map(p => `<tr>
      <td><strong>${esc(p.nome)}</strong> ${ativo(p) ? '' : '<span class="badge">ex-morador</span>'}</td>
      <td>${p.tipo === 'BR' ? 'Brasileiro' : esc(p.pais || 'Estrangeiro')}</td>
      <td>${p.tipo === 'EX' && p.validadeVisto && !isObs() ? '<div class="k" style="font-size:.75rem">visto até ' + prazo(p.validadeVisto, p, AVISO_VISTO) + '</div>' : ''}${docPessoa(p)}</td>
      <td>${esc(isObs() ? (p.telefone ? '(••) •••••-' + String(p.telefone).replace(/\D/g, '').slice(-4) : '') : (p.telefone || ''))}</td>
      <td>${esc(rotuloUnidade(p.unidadeId))}</td>
      <td>${fmtData(p.dataEntrada)}</td>
      <td>${prazo(p.dataFimContrato, p, AVISO_CONTRATO)}</td>
      <td>${docsBadge(p)}</td>
      <td>${p.valor ? brl(p.valor) : '—'}${p.caucao ? `<div class="k">caução ${brl(p.caucao)}${p.caucaoStatus ? ' · ' + esc(p.caucaoStatus) : ''}</div>` : ''}</td>
      <td>${p.diaVenc ? 'dia ' + p.diaVenc : '—'}</td>
      <td class="actions">${isObs() ? '' : `${ativo(p) ? `<button class="small" data-saida="${esc(p.id)}">Saída</button> ` : ''}<button class="small" data-ed="${esc(p.id)}">Editar</button> <button class="small danger" data-del="${esc(p.id)}">Excluir</button>`}</td>
    </tr>`).join('')}` : '<tr><td class="empty">Nenhuma pessoa cadastrada.</td></tr>';
}
$('#pes-busca').oninput = $('#pes-filtro').onchange = renderPessoas;
$('#btn-nova-pessoa').onclick = () => { if (!isObs()) formPessoa(); };
$('#tb-pessoas').onclick = async e => {
  if (isObs()) return;
  const ed = e.target.closest('[data-ed]'), del = e.target.closest('[data-del]'), sai = e.target.closest('[data-saida]');
  if (sai) { const p = pessoa(sai.dataset.saida); if (p) registrarSaida(p); return; }
  if (ed) { const p = pessoa(ed.dataset.ed); if (p) formPessoa(p); return; }
  if (del) {
    const p = pessoa(del.dataset.del); if (!p) return;
    if (ativo(p) && await confirmar('Registrar saída (mantém o histórico de cobranças) em vez de apagar o cadastro?')) {
      registrarSaida(p); return;
    }
    if (!(await confirmar('Apagar o cadastro e as cobranças desta pessoa? Isso some do financeiro.'))) return;
    (p.arquivos || []).forEach(x => arqDel(x.id));
    db.cobrancas.forEach(c => { if (c.pessoaId === p.id) c.nome = c.nome || p.nome; });
    db.pessoas = db.pessoas.filter(x => x.id !== p.id);
    db.cobrancas = db.cobrancas.filter(c => c.pessoaId !== p.id);
    save(); render(); toast('Pessoa excluída');
  }
};
function registrarSaida(p) {
  abrirModal(`<h3>Registrar saída</h3><div class="form">
    <p class="k full" style="color:var(--muted)">${esc(p.nome)} · ${esc(rotuloUnidade(p.unidadeId))}</p>
    ${campo('Data de saída', 'dataSaida', p.dataSaida || today(), 'type="date" required')}
    ${p.caucao ? `<div><label>Caução (${brl(p.caucao)})</label>
      <select name="caucaoStatus"><option value="devolvida">Devolvida</option><option value="parcial">Parcial</option><option value="retida">Retida</option></select></div>
      ${campo('Valor devolvido (R$)', 'caucaoDevolvidaValor', p.caucao, 'type="number" step="0.01" min="0"')}` : ''}
    ${botoes()}</div>`, async fd => {
    p.dataSaida = fd.dataSaida;
    if (p.caucao) {
      p.caucaoStatus = fd.caucaoStatus || 'devolvida';
      p.caucaoDevolvidaEm = fd.dataSaida;
      p.caucaoDevolvidaValor = fd.caucaoStatus === 'retida' ? 0 : (fd.caucaoStatus === 'parcial' ? +fd.caucaoDevolvidaValor || 0 : p.caucao);
    }
    save(); render(); toast('Saída registrada');
  });
}

function formPessoa(p = {}) {
  let arq = [...(p.arquivos || [])];
  const novos = new Map(); // id -> File ainda não gravado
  const novo = !p.id;
  const tipo = p.tipo || 'BR';
  const opts = db.unidades.map(u => `<option value="${esc(u.id)}" ${u.id === p.unidadeId ? 'selected' : ''} data-valor="${esc(u.valor || '')}">${esc(rotuloUnidade(u.id))}${moradores(u.id).some(m => m.id !== p.id) ? ' (ocupado)' : ''}</option>`).join('');
  abrirModal(`
    <h3>${novo ? 'Cadastrar pessoa' : 'Editar pessoa'}</h3>
    <div class="form">
      <div><label>Nacionalidade</label>
        <select name="tipo" id="f-tipo"><option value="BR" ${tipo === 'BR' ? 'selected' : ''}>Brasileiro(a)</option><option value="EX" ${tipo === 'EX' ? 'selected' : ''}>Estrangeiro(a)</option></select></div>
      ${campo('Nome completo *', 'nome', p.nome, 'required')}
      ${campo('Data de nascimento', 'nascimento', p.nascimento, 'type="date"')}
      ${campo('Telefone / WhatsApp', 'telefone', p.telefone)}
      ${campo('E-mail', 'email', p.email, 'type="email"')}
      ${campo('Profissão / ocupação', 'profissao', p.profissao)}
      <fieldset id="f-br"><legend>Documentos (brasileiro)</legend><div class="form">
        ${campo('CPF *', 'cpf', p.cpf, 'placeholder="000.000.000-00"')}
        ${campo('RG', 'rg', p.rg)}
      </div></fieldset>
      <fieldset id="f-ex"><legend>Documentos (estrangeiro)</legend><div class="form">
        ${campo('País de origem *', 'pais', p.pais)}
        ${campo('Passaporte *', 'passaporte', p.passaporte)}
        ${campo('CRNM / RNM (se tiver)', 'crnm', p.crnm)}
        ${campo('CPF (se tiver)', 'cpfEx', p.cpf)}
        ${campo('Tipo de visto / situação migratória', 'visto', p.visto)}
        ${campo('Validade do visto/documento', 'validadeVisto', p.validadeVisto, 'type="date"')}
      </div></fieldset>
      <fieldset><legend>Contato de emergência</legend><div class="form">
        ${campo('Nome', 'emergNome', p.emergNome)}
        ${campo('Telefone', 'emergTel', p.emergTel)}
      </div></fieldset>
      <fieldset><legend>Locação</legend><div class="form">
        <div><label>Quarto / Kitnet</label><select name="unidadeId" id="f-unid"><option value="">— nenhum —</option>${opts}</select></div>
        ${campo('Data de entrada', 'dataEntrada', p.dataEntrada || (novo ? today() : ''), 'type="date"')}
        ${campo('Valor do aluguel (R$)', 'valor', p.valor, 'type="number" step="0.01" min="0"')}
        ${campo('Dia de vencimento (1-31)', 'diaVenc', p.diaVenc || 5, 'type="number" min="1" max="31"')}
        ${campo('Caução / depósito (R$)', 'caucao', p.caucao, 'type="number" step="0.01" min="0"')}
        ${campo('Fim do contrato', 'dataFimContrato', p.dataFimContrato, 'type="date"')}
        ${campo('Data de saída (se já saiu / prevista)', 'dataSaida', p.dataSaida, 'type="date"')}
      </div></fieldset>
      <fieldset><legend>Documentos e arquivos anexados</legend>
        <div id="docs-check" class="chips"></div>
        <div class="form">
          <div><label>Tipo do documento</label><select id="doc-cat">${Object.entries(CAT).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select></div>
          <div><label>Arquivo (PDF ou imagem, até 10 MB)</label><input type="file" id="doc-file" accept="image/*,application/pdf" multiple></div>
        </div>
        <div id="docs-lista"></div>
      </fieldset>
      <div class="full"><label>Observações</label><textarea name="obs" rows="2">${esc(p.obs)}</textarea></div>
      ${botoes()}
    </div>`, async fd => {
    const br = fd.tipo === 'BR';
    if (br && fd.cpf && !validaCPF(fd.cpf)) { erro('CPF inválido.'); return false; }
    if (br && !fd.cpf) { erro('Informe o CPF.'); return false; }
    if (!br && !fd.passaporte && !fd.crnm) { erro('Informe passaporte ou CRNM.'); return false; }
    if (!br && !fd.pais) { erro('Informe o país de origem.'); return false; }
    const u = fd.unidadeId && moradores(fd.unidadeId).find(m => m.id !== p.id);
    if (u && !(await confirmar(`${rotuloUnidade(fd.unidadeId)} já tem morador (${u.nome}). Continuar mesmo assim?`))) return false;
    try {
      for (const [id, f] of novos) if (arq.some(x => x.id === id)) await arqPut(id, f);
    } catch (e) { erro('Não foi possível guardar os arquivos neste navegador.'); return false; }
    (p.arquivos || []).filter(x => !arq.some(y => y.id === x.id)).forEach(x => arqDel(x.id));
    const dup = db.pessoas.find(x => x.id !== p.id && br && fd.cpf && x.cpf && x.cpf.replace(/\D/g, '') === fd.cpf.replace(/\D/g, ''));
    if (dup) { erro('Já existe cadastro com este CPF: ' + dup.nome); return false; }
    const id = p.id || uid();
    const reg = limparPessoa({ ...p, ...fd, arquivos: arq, id, cpf: br ? fd.cpf : fd.cpfEx, valor: +fd.valor || 0, caucao: +fd.caucao || 0, diaVenc: +fd.diaVenc || 5 });
    if (!reg) { erro('Cadastro inválido.'); return false; }
    delete reg.cpfEx;
    if (br) { reg.pais = ''; reg.passaporte = ''; reg.crnm = ''; reg.visto = ''; reg.validadeVisto = ''; }
    else reg.rg = '';
    if (novo) db.pessoas.push(reg); else db.pessoas[db.pessoas.findIndex(x => x.id === p.id)] = reg;
    save(); render(); toast('Pessoa salva');
  });
  const alterna = () => {
    const br = $('#f-tipo').value === 'BR';
    $('#f-br').hidden = !br; $('#f-ex').hidden = br;
  };
  const renderArq = () => {
    const tipo = $('#f-tipo').value, tem = new Set(arq.map(x => x.categoria));
    $('#docs-check').innerHTML = DOCS_OBRIG[tipo].map(c => `<span class="chip ${tem.has(c) ? 'ok' : ''}">${tem.has(c) ? ic('check', 12) : '<i class="pend"></i>'} ${CAT[c]}</span>`).join('');
    $('#docs-lista').innerHTML = arq.length ? arq.map(x => `<div class="arq"><span class="tile">${ic('file', 16)}</span>
      <div class="grow"><div class="nm">${esc(x.nome)}</div><div class="k">${esc(CAT[x.categoria] || 'Outro')} · ${fmtTam(x.tamanho)} · ${fmtData(x.adicionado)}</div></div>
      <button type="button" class="small" data-ver="${x.id}">Ver</button>
      <button type="button" class="small danger" data-rmarq="${x.id}" aria-label="Remover arquivo">${ic('x', 13)}</button></div>`).join('')
      : '<div class="k" style="margin-top:.6rem">Nenhum arquivo anexado.</div>';
  };
  $('#doc-file').onchange = async e => {
    $('.form-erro', mform)?.remove();
    for (const f of e.target.files) {
      if (f.size > MAX_ARQ) { erro(`“${f.name}” passa de 10 MB.`); continue; }
      const tipo = await magiaArq(f);
      if (!tipo) { erro(`“${f.name}” não é PDF nem imagem reconhecível.`); continue; }
      const id = uid(); novos.set(id, f);
      arq.push({ id, nome: f.name, tipo, tamanho: f.size, categoria: CAT_OK.has($('#doc-cat').value) ? $('#doc-cat').value : 'outro', adicionado: today() });
    }
    e.target.value = ''; renderArq();
  };
  const selUn = $('#f-unid');
  if (selUn) selUn.onchange = () => {
    const o = selUn.selectedOptions[0], v = mform.querySelector('[name=valor]');
    if (o && o.dataset.valor && v && !v.value) v.value = o.dataset.valor;
  };
  $('#docs-lista').onclick = e => {
    const v = e.target.closest('[data-ver]'), r = e.target.closest('[data-rmarq]');
    if (v) { const x = arq.find(y => y.id === v.dataset.ver); verArquivo(x, novos.get(x.id)); }
    if (r) { arq = arq.filter(y => y.id !== r.dataset.rmarq); novos.delete(r.dataset.rmarq); renderArq(); }
  };
  $('#f-tipo').addEventListener('change', renderArq);
  $('#f-tipo').onchange = alterna; alterna(); renderArq();
}

// =====================================================================
// UNIDADES (quartos / kitnets) + inventário mobiliado
// =====================================================================
const ESTADOS = ['Novo', 'Bom', 'Regular', 'Ruim', 'Quebrado'];

function renderUnidades() {
  const f = $('#uni-filtro').value;
  const lista = db.unidades.filter(u => {
    const oc = moradores(u.id).length > 0;
    return !f || (f === 'kitnet' && u.tipo === 'kitnet') || (f === 'quarto' && u.tipo === 'quarto') || (f === 'livre' && !oc) || (f === 'ocupado' && oc);
  }).sort((a, b) => a.nome.localeCompare(b.nome, 'pt', { numeric: true }));
  $('#uni-lista').innerHTML = lista.length ? lista.map(u => {
    const m = moradores(u.id);
    return `<div class="card unit">
      <h3><span><span class="tile">${ic(u.tipo === 'kitnet' ? 'home' : 'bed', 20)}</span>${esc(rotuloUnidade(u.id))}</span>
        <span class="badge ${m.length ? 'ok' : 'warn'}">${m.length ? 'Ocupado' : 'Livre'}</span></h3>
      <div class="k">${u.andar ? esc(u.andar) + ' · ' : ''}${u.valor ? brl(u.valor) + '/mês' : 'sem valor definido'}</div>
      <div class="k">${m.length ? ic('user', 14) + ' ' + m.map(x => esc(x.nome)).join(', ') : 'Sem morador'}</div>
      <strong class="itens-t">Mobília e itens (${(u.itens || []).length})</strong>
      ${(u.itens || []).length ? `<ul>${u.itens.map(i => `<li>${i.qtd}× ${esc(i.nome)} <em>(${esc(i.estado)})</em></li>`).join('')}</ul>` : '<ul><li>Nenhum item listado</li></ul>'}
      ${u.obs ? `<div class="k">${ic('note', 14)} ${esc(u.obs)}</div>` : ''}
      ${isObs() ? '' : `<div class="foot"><button class="small" data-ed="${esc(u.id)}">Editar / itens</button><button class="small danger" data-del="${esc(u.id)}">Excluir</button></div>`}
    </div>`;
  }).join('') : '<div class="empty">Nenhuma unidade. Clique em “+ Nova unidade”.</div>';
}
$('#uni-filtro').onchange = renderUnidades;
$('#btn-nova-unidade').onclick = () => { if (!isObs()) formUnidade(); };
$('#uni-lista').onclick = async e => {
  if (isObs()) return;
  const ed = e.target.closest('[data-ed]'), del = e.target.closest('[data-del]');
  if (ed) { const u = unidade(ed.dataset.ed); if (u) formUnidade(u); }
  if (del) {
    const id = del.dataset.del;
    if (moradores(id).length) return toast('Há morador ativo nesta unidade. Mude o morador antes de excluir.');
    if (await confirmar('Excluir esta unidade?')) { db.unidades = db.unidades.filter(u => u.id !== id); db.pessoas.forEach(p => { if (p.unidadeId === id) p.unidadeId = ''; }); save(); renderUnidades(); }
  }
};

