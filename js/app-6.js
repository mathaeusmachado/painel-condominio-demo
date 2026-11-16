function textoContrato(p, u) {
  const inicio = p.dataEntrada || today();
  const fim = p.dataFimContrato || addAno(inicio);
  const aluguel = brl(valorAluguel(p));
  const cau = brl(p.caucao || valorAluguel(p));
  const doc = p.tipo === 'BR' ? ('CPF ' + (p.cpf || '—')) : [p.passaporte && ('Passaporte ' + p.passaporte), p.crnm && ('CRNM ' + p.crnm), p.pais && ('Origem ' + p.pais)].filter(Boolean).join(' · ');
  return `CONTRATO DE LOCAÇÃO RESIDENCIAL — MODELO 12 MESES
Residencial Hortênsias (locador)

1. PARTES
Locatário responsável: ${p.nome}
Documento: ${doc || '—'}
Telefone: ${p.telefone || '—'}    E-mail: ${p.email || '—'}

2. IMÓVEL
Unidade: ${rotuloUnidade(u.id)}${u.andar ? ' · ' + u.andar : ''}
Uso: residencial, mobiliado conforme inventário do painel.

3. PRAZO
Início: ${fmtData(inicio)}
Término: ${fmtData(fim)}
Prazo: 12 (doze) meses, renovável por acordo escrito.

4. ALUGUEL E CAUÇÃO
Aluguel mensal: ${aluguel}, vencimento todo dia ${p.diaVenc || 5}.
Caução / depósito: ${cau}, a devolver ao término se não houver dano ou débito.

5. OBRIGAÇÕES
O locatário conserva a unidade e a mobília, observa as regras de convivência do condomínio e comunica avarias em até 48 horas.
É vedado ceder, sublocar ou alterar a unidade sem autorização do locador.

6. ASSINATURA
Este arquivo é o modelo preenchido com os dados do cadastro. Depois de assinado (PDF ou Word), o arquivo volta ao painel como anexo do locatário.

Local e data: ______________________
Locador: __________________________     Locatário: ${p.nome}`;
}
function badgeContrato(st) {
  return { assinado: ['ok', 'Assinado'], enviado: ['warn', 'Aguardando assinatura'], rascunho: ['', 'Rascunho'], encerrado: ['', 'Encerrado'] }[st] || ['', st];
}
function renderContratos() {
  const box = $('#tb-contratos'); if (!box) return;
  const lista = (db.contratos || []).slice().sort((a, b) => (a.status + a.id).localeCompare(b.status + b.id));
  const n = { assinado: 0, enviado: 0, rascunho: 0 };
  lista.forEach(c => { if (n[c.status] != null) n[c.status]++; });
  $('#ctr-resumo').innerHTML = `<div class="cards" style="margin-top:0">
    <div class="card"><div class="k">Assinados</div><div class="v ok">${n.assinado}</div></div>
    <div class="card"><div class="k">Aguardando</div><div class="v warn">${n.enviado}</div></div>
    <div class="card"><div class="k">Rascunho</div><div class="v">${n.rascunho}</div></div>
  </div>`;
  box.innerHTML = lista.length ? `<tr><th>Unidade</th><th>Responsável</th><th>Status</th><th>Gerado</th><th>Assinado</th><th></th></tr>` + lista.map(c => {
    const p = pessoa(c.pessoaId), bd = badgeContrato(c.status);
    const acoes = `<button class="small" data-verc="${esc(c.id)}">Ver</button>
      <button class="small" data-pdfc="${esc(c.id)}">PDF</button>
      <button class="small" data-docc="${esc(c.id)}">Word</button>
      ${isObs() ? '' : `${c.status !== 'assinado' ? `<button class="small primary" data-assc="${esc(c.id)}">Assinar agora</button>` : ''}
      <button class="small" data-anxc="${esc(c.id)}">Anexar assinado</button>`}`;
    return `<tr><td>${esc(rotuloUnidade(c.unidadeId))}</td><td>${esc(p ? p.nome : '—')}</td>
      <td><span class="badge ${bd[0]}">${bd[1]}</span>${c.anexoNome ? `<div class="k">anexo: ${esc(c.anexoNome)}</div>` : ''}</td><td>${fmtData(c.geradoEm)}</td><td>${c.assinadoPor ? esc(c.assinadoPor) + ' · ' + fmtData(c.assinadoEm) : '—'}</td>
      <td class="actions">${acoes}</td></tr>`;
  }).join('') : '<tr><td class="empty">Nenhum contrato. O dono gera a partir do modelo.</td></tr>';
}
function abrirContrato(c, assinar) {
  const p = pessoa(c.pessoaId), u = unidade(c.unidadeId);
  if (!p || !u) return toast('Contrato incompleto.');
  const txt = textoContrato(p, u);
  abrirModal(`<h3>Contrato · ${esc(rotuloUnidade(u.id))}</h3>
    <pre class="ctr-txt">${esc(txt)}</pre>
    ${assinar && !isObs() ? `${campo('Nome de quem assina *', 'assinadoPor', p.nome, 'required')}
      <label class="full" style="display:flex;gap:.5rem;align-items:center;margin:.6rem 0"><input type="checkbox" name="aceite" required> Li e concordo com o modelo</label>` : ''}
    <div class="modal-actions">${assinar && !isObs() ? '<button type="button" data-cancel>Cancelar</button><button class="primary">Confirmar assinatura</button>' : '<button class="primary" data-cancel type="button">Fechar</button>'}</div>`, fd => {
    if (!assinar) return;
    if (fd.aceite !== 'on') { erro('Marque que leu e concorda com o modelo.'); return false; }
    c.status = 'assinado'; c.assinadoEm = today(); c.assinadoPor = fd.assinadoPor || p.nome;
    save(); render(); toast('Contrato assinado (demonstração)');
  });
  if (!assinar) $$('[data-cancel]', mform).forEach(b => b.onclick = () => modal.close());
}
function baixarContratoFmt(x, fmt) {
  const p = pessoa(x.pessoaId), u = unidade(x.unidadeId);
  if (!p || !u) return toast('Contrato incompleto.');
  const nome = `contrato-locacao-1ano-${u.nome}`;
  const txt = textoContrato(p, u);
  if (fmt === 'pdf') baixarPdf(nome + '.pdf', 'Contrato de locação — 12 meses', txt);
  else baixarWord(nome + '.doc', 'Contrato de locação — 12 meses', txt);
  if (!isObs() && x.status === 'rascunho') { x.status = 'enviado'; x.enviadoEm = today(); save(); renderContratos(); }
  toast(fmt === 'pdf' ? 'PDF baixado para assinar' : 'Word baixado para assinar');
}
async function anexarContratoAssinado(x) {
  if (isObs()) return;
  const p = pessoa(x.pessoaId); if (!p) return toast('Cadastro do locatário não encontrado.');
  const inp = document.createElement('input');
  inp.type = 'file'; inp.accept = 'application/pdf,.pdf,.doc,.docx,image/*';
  inp.onchange = async () => {
    const f = inp.files && inp.files[0]; if (!f) return;
    if (f.size > MAX_ARQ) return toast('Arquivo passa de 10 MB.');
    const tipo = await magiaArq(f);
    if (!tipo) return toast('Use PDF, Word ou imagem.');
    const id = uid();
    try { await arqPut(id, f); } catch (e) { return toast('Não foi possível guardar o anexo neste navegador.'); }
    p.arquivos = arr(p.arquivos);
    p.arquivos.push({ id, nome: f.name, tipo, tamanho: f.size, categoria: 'contrato', adicionado: today() });
    x.anexoId = id; x.anexoNome = f.name; x.status = 'assinado'; x.assinadoEm = x.assinadoEm || today(); x.assinadoPor = x.assinadoPor || p.nome;
    save(); render(); toast('Contrato assinado anexado no cadastro de ' + p.nome);
  };
  inp.click();
}
$('#tb-contratos') && ($('#tb-contratos').onclick = e => {
  const ver = e.target.closest('[data-verc]'), ass = e.target.closest('[data-assc]');
  const pdf = e.target.closest('[data-pdfc]'), doc = e.target.closest('[data-docc]'), anx = e.target.closest('[data-anxc]');
  const c = id => (db.contratos || []).find(x => x.id === id);
  if (ver) abrirContrato(c(ver.dataset.verc), false);
  if (ass && !isObs()) abrirContrato(c(ass.dataset.assc), true);
  if (pdf) baixarContratoFmt(c(pdf.dataset.pdfc), 'pdf');
  if (doc) baixarContratoFmt(c(doc.dataset.docc), 'word');
  if (anx && !isObs()) anexarContratoAssinado(c(anx.dataset.anxc));
});
function garantirContrato(p) {
  if (!p || !p.unidadeId) return;
  db.contratos = db.contratos || [];
  if (db.contratos.some(c => c.pessoaId === p.id && c.status !== 'encerrado')) return;
  db.contratos.push({ id: uid(), pessoaId: p.id, unidadeId: p.unidadeId, status: 'rascunho', geradoEm: today(), enviadoEm: '', assinadoEm: '', assinadoPor: '', anexoId: '', anexoNome: '' });
}

const REGRAS_ARQ_ID = 'regras-arquivo-painel';
function textoRegras() { return (db.config && db.config.regras) || REGRAS_PADRAO; }
function renderRegras() {
  if (!db.config) db.config = limparConfig({});
  const t = textoRegras();
  const box = $('#regras-txt'), ed = $('#regras-edit'), nm = $('#regras-arq-nome');
  if (box) box.textContent = t;
  if (ed && !isObs()) ed.value = t;
  if (nm) nm.textContent = db.config.regrasArq ? ('Arquivo atual: ' + db.config.regrasArq) : 'Nenhum arquivo substituto. Vale o texto acima.';
}
$('#btn-regras-pdf') && ($('#btn-regras-pdf').onclick = async () => {
  if (db.config && db.config.regrasArq) {
    try {
      const blob = await arqGet(REGRAS_ARQ_ID);
      if (blob && /pdf/i.test(blob.type || db.config.regrasArq)) { baixarBlob(db.config.regrasArq, blob); return; }
    } catch (e) { /* cai no texto */ }
  }
  baixarPdf('regras-de-convivencia.pdf', 'Regras de convivência', textoRegras());
});
$('#btn-regras-word') && ($('#btn-regras-word').onclick = async () => {
  if (db.config && db.config.regrasArq) {
    try {
      const blob = await arqGet(REGRAS_ARQ_ID);
      if (blob && (/word|officedocument/i.test(blob.type || '') || /\.docx?$/i.test(db.config.regrasArq || ''))) {
        baixarBlob(db.config.regrasArq, blob); return;
      }
    } catch (e) { /* cai no texto */ }
  }
  baixarWord('regras-de-convivencia.doc', 'Regras de convivência', textoRegras());
});
$('#btn-regras-salvar') && ($('#btn-regras-salvar').onclick = () => {
  if (isObs()) return;
  if (!db.config) db.config = limparConfig({});
  db.config.regras = str($('#regras-edit').value, 20000) || REGRAS_PADRAO;
  save(); renderRegras(); toast('Regras salvas neste painel');
});
$('#file-regras') && ($('#file-regras').onchange = async e => {
  if (isObs()) return;
  const f = e.target.files && e.target.files[0]; e.target.value = '';
  if (!f) return;
  if (f.size > MAX_ARQ) return toast('Arquivo passa de 10 MB.');
  const tipo = await magiaArq(f);
  if (!tipo) return toast('Use PDF ou Word.');
  try { await arqPut(REGRAS_ARQ_ID, f); } catch (ex) { return toast('Não foi possível guardar o arquivo neste navegador.'); }
  if (!db.config) db.config = limparConfig({});
  db.config.regrasArq = f.name;
  save(); renderRegras(); toast('Arquivo de regras substituído. Download usa esse arquivo.');
});

function carregarExemplo() {
  const mob = (...n) => n.map(x => ({ nome: x[0], qtd: x[1], estado: x[2] }));
  const U = [
    ['kitnet', 'K01', 'Térreo', 1100, mob(['Cama de casal', 1, 'Bom'], ['Geladeira', 1, 'Bom'], ['Fogão 2 bocas', 1, 'Regular'], ['Guarda-roupa', 1, 'Bom'], ['Mesa com 2 cadeiras', 1, 'Bom'])],
    ['kitnet', 'K02', 'Térreo', 1100, mob(['Cama de casal', 1, 'Novo'], ['Geladeira', 1, 'Bom'], ['Fogão 2 bocas', 1, 'Bom'], ['Ar-condicionado', 1, 'Bom'])],
    ['kitnet', 'K03', '1º andar', 1150, mob(['Cama de solteiro', 2, 'Regular'], ['Geladeira', 1, 'Bom'], ['Fogão 2 bocas', 1, 'Bom'])],
    ['quarto', 'Q1', '1º andar', 600, mob(['Cama de solteiro', 1, 'Bom'], ['Guarda-roupa', 1, 'Bom'], ['Ventilador', 1, 'Bom'], ['Frigobar', 1, 'Regular'])],
    ['quarto', 'Q2', '1º andar', 600, mob(['Cama de solteiro', 1, 'Regular'], ['Guarda-roupa', 1, 'Regular'], ['Ventilador', 1, 'Bom'])],
    ['quarto', 'Q3', '2º andar', 650, mob(['Cama de solteiro', 1, 'Novo'], ['Guarda-roupa', 1, 'Novo'], ['Escrivaninha', 1, 'Novo'], ['Ar-condicionado', 1, 'Novo'])],
    ['quarto', 'Q4', '2º andar', 650, mob(['Cama de solteiro', 1, 'Bom'], ['Guarda-roupa', 1, 'Bom'])],
  ].map(([tipo, nome, andar, valor, itens], i) => ({ id: uid(), tipo, nome, andar, valor, comissao: tipo === 'quarto' ? 80 + (i % 3) * 20 : 0, itens, obs: '' }));
  const u = n => U.find(x => x.nome === n).id;
  const P = [
    { nome: 'Maria Souza (exemplo)', tipo: 'BR', cpf: '000.000.001-91', telefone: '(11) 90000-0001', un: 'K01', valor: 1100, diaVenc: 5, ent: -210, fim: 20 },
    { nome: 'João Pereira (exemplo)', tipo: 'BR', cpf: '000.000.002-72', telefone: '(11) 90000-0002', un: 'K02', valor: 1100, diaVenc: 10, ent: -90, fim: 300 },
    { nome: 'Carlos Restrepo (exemplo)', tipo: 'EX', pais: 'Colômbia', crnm: 'V123456-7', passaporte: 'AT123456', visto: 'Residência temporária', telefone: '(11) 90000-0003', un: 'Q1', valor: 600, diaVenc: 5, ent: -60, fim: 120, visto_d: 35 },
    { nome: 'Amadou Diallo (exemplo)', tipo: 'EX', pais: 'Senegal', passaporte: 'SN998877', visto: 'Visto humanitário', telefone: '(11) 90000-0004', un: 'Q2', valor: 600, diaVenc: 15, ent: -30, fim: 5, visto_d: -4 },
    { nome: 'Luiza Andrade (exemplo)', tipo: 'BR', cpf: '000.000.003-53', telefone: '(11) 90000-0005', un: 'Q3', valor: 650, diaVenc: 20, ent: -15, fim: 180 },
  ].map(p => ({ id: uid(), nome: p.nome, tipo: p.tipo, cpf: p.cpf || '', pais: p.pais || '', passaporte: p.passaporte || '', crnm: p.crnm || '', visto: p.visto || '',
    validadeVisto: p.visto_d !== undefined ? somaDias(p.visto_d) : '', telefone: p.telefone, unidadeId: u(p.un), valor: p.valor, diaVenc: p.diaVenc,
    dataEntrada: somaDias(p.ent), dataFimContrato: somaDias(p.fim), obs: 'Dado de exemplo' }));
  const cur = today().slice(0, 7), cobr = [];
  P.forEach((p, i) => [-3, -2, -1, 0].forEach(n => {
    const comp = addMonths(cur, n);
    if (p.dataEntrada.slice(0, 7) > comp) return;
    const atrasada = p.nome.startsWith('João') && n === -1;
    cobr.push({ id: uid(), pessoaId: p.id, unidadeId: p.unidadeId, competencia: comp, valor: p.valor, vencimento: venc(comp, p.diaVenc),
      pago: n < 0 ? !atrasada : i % 2 === 0, dataPgto: n < 0 && !atrasada ? venc(comp, p.diaVenc) : (n === 0 && i % 2 === 0 ? today() : '') });
  }));
  const desp = [['Conta de água', 'Água', 380], ['Conta de luz (áreas comuns)', 'Luz', 290], ['Internet', 'Internet', 150], ['Limpeza', 'Limpeza', 240]];
  const despesas = [-2, -1, 0].flatMap(n => desp.map(([descricao, categoria, valor]) => ({ id: uid(), descricao, categoria, valor, data: `${addMonths(cur, n)}-08` })));
  despesas.push({ id: uid(), descricao: 'Troca de chuveiro Q2', categoria: 'Manutenção', valor: 120, data: `${cur}-03` });
  const contratos = P.map((p, i) => {
    const st = i === 0 ? 'enviado' : i === 1 ? 'rascunho' : 'assinado';
    return { id: uid(), pessoaId: p.id, unidadeId: p.unidadeId, status: st, geradoEm: somaDias(p.ent + 1),
      enviadoEm: st === 'rascunho' ? '' : somaDias(p.ent + 2), assinadoEm: st === 'assinado' ? somaDias(p.ent + 5) : '',
      assinadoPor: st === 'assinado' ? p.nome : '' };
  });
  const comissoes = U.filter(u => u.tipo === 'quarto' && u.comissao).map(u => ({ id: uid(), unidadeId: u.id, competencia: cur, valor: u.comissao, vencimento: venc(cur, 10), pago: false, dataPgto: '', obs: 'Comissão Geovani' }));
  db = { unidades: U, pessoas: P, cobrancas: cobr, despesas: despesas.filter(d => d.data <= today() || d.data.slice(0, 7) < cur), contratos, comissoes, config: limparConfig({ comissaoObs: false, regras: REGRAS_PADRAO }) };
  save(); render(); toast('Dados de exemplo carregados');
}

function montarApresentacao() {
  const mob = (...n) => n.map(x => ({ nome: x[0], qtd: x[1], estado: x[2] }));
  const kit = mob(['Cama', 1, 'Bom'], ['Geladeira', 1, 'Bom'], ['Fogão 2 bocas', 1, 'Regular'], ['Guarda-roupa', 1, 'Bom']);
  const qto = mob(['Cama de solteiro', 1, 'Bom'], ['Guarda-roupa', 1, 'Bom'], ['Ventilador', 1, 'Bom']);
  const nomes = [
    ['Ana Ribeiro', 'BR'], ['Bruno Costa', 'BR'], ['Carla Mendes', 'BR'], ['Diego Alves', 'BR'],
    ['Elena Vargas', 'EX'], ['Felipe Nunes', 'BR'], ['Gisele Prado', 'BR'], ['Hassan Ali', 'EX'],
    ['Igor Teixeira', 'BR'], ['Julia Martins', 'BR'], ['Kenji Sato', 'EX'], ['Lia Fernandes', 'BR'],
    ['Marcos Lima', 'BR'], ['Nina Castro', 'BR'], ['Otávio Pires', 'BR'], ['Paula Duarte', 'BR'],
    ['Rafael Gomes', 'BR'], ['Sofia Hahn', 'EX'], ['Tiago Rocha', 'BR'], ['Úrsula Dias', 'BR'],
    ['Vitor Barbosa', 'BR'], ['Wanda Silva', 'BR']
  ];
  const U = [];
  for (let i = 1; i <= 12; i++) U.push({ id: uid(), tipo: 'kitnet', nome: 'K' + pad(i), andar: i <= 4 ? 'Térreo' : i <= 8 ? '1º andar' : '2º andar', valor: 1100 + (i % 4) * 50, comissao: 0, itens: kit, obs: '' });
  for (let i = 1; i <= 12; i++) U.push({ id: uid(), tipo: 'quarto', nome: 'Q' + pad(i), andar: i <= 6 ? '1º andar' : '2º andar', valor: 600 + (i % 3) * 40, comissao: 80 + (i % 5) * 20, itens: qto, obs: '' });
  const P = nomes.map((nm, i) => {
    const un = U[i];
    return { id: uid(), nome: nm[0], tipo: nm[1], cpf: nm[1] === 'BR' ? `000.000.${String(i + 1).padStart(3, '0')}-00` : '',
      pais: nm[1] === 'EX' ? ['Colômbia', 'Senegal', 'Japão', 'Alemanha'][i % 4] : '', passaporte: nm[1] === 'EX' ? 'XX' + (100000 + i) : '',
      visto: nm[1] === 'EX' ? 'Residência temporária' : '', validadeVisto: nm[1] === 'EX' ? somaDias(i === 4 ? -3 : 40 + i) : '',
      telefone: '(11) 9' + String(80000000 + i).slice(-8), unidadeId: un.id, valor: un.valor, caucao: un.valor, diaVenc: [5, 10, 15, 20][i % 4],
      dataEntrada: somaDias(-40 - i * 8), dataFimContrato: i === 0 ? somaDias(8) : somaDias(40 + i * 12), obs: 'Responsável pelo aluguel' };
  });
  const cur = today().slice(0, 7), cobr = [];
  P.forEach((p, i) => [-3, -2, -1, 0].forEach(n => {
    const comp = addMonths(cur, n);
    if (p.dataEntrada.slice(0, 7) > comp) return;
    const atrasada = i === 3 && n === -1;
    cobr.push({ id: uid(), pessoaId: p.id, unidadeId: p.unidadeId, nome: p.nome, competencia: comp, valor: p.valor, vencimento: venc(comp, p.diaVenc),
      pago: n < 0 ? !atrasada : i % 3 !== 1, dataPgto: n < 0 && !atrasada ? venc(comp, p.diaVenc) : (n === 0 && i % 3 !== 1 ? today() : '') });
  }));
  const desp = [['Conta de água', 'Água', 890], ['Energia áreas comuns', 'Luz', 640], ['Internet', 'Internet', 180], ['Limpeza', 'Limpeza', 520], ['Manutenção portão', 'Manutenção', 210]];
  const despesas = [-2, -1, 0].flatMap(n => desp.map(([descricao, categoria, valor]) => ({ id: uid(), descricao, categoria, valor, data: `${addMonths(cur, n)}-08` })));
  const contratos = P.map((p, i) => {
    const st = i === 0 ? 'enviado' : i === 1 ? 'rascunho' : 'assinado';
    return { id: uid(), pessoaId: p.id, unidadeId: p.unidadeId, status: st, geradoEm: somaDias(-30), enviadoEm: st === 'rascunho' ? '' : somaDias(-28),
      assinadoEm: st === 'assinado' ? somaDias(-20) : '', assinadoPor: st === 'assinado' ? p.nome : '' };
  });
  const comissoes = U.filter(u => u.tipo === 'quarto').map(u => ({ id: uid(), unidadeId: u.id, competencia: cur, valor: u.comissao, vencimento: venc(cur, 10), pago: iPagoComissao(u), dataPgto: iPagoComissao(u) ? `${cur}-10` : '', obs: 'Comissão Geovani' }));
  function iPagoComissao(u) { return Number(String(u.nome).replace(/\D/g, '')) % 3 === 0; }
  db = { unidades: U, pessoas: P, cobrancas: cobr, despesas: despesas.filter(d => d.data <= today() || d.data.slice(0, 7) < cur), contratos, comissoes, config: limparConfig({ comissaoObs: false, regras: REGRAS_PADRAO }) };
  save(); render();
}

function prepararDemo() {
  const lock = $('#lock'); if (lock) lock.remove();
  const lockBtn = $('#btn-lock'); if (lockBtn) lockBtn.hidden = true;
  const bar = $('#demo-bar');
  const syncPapel = () => {
    const p = localStorage.getItem(KEY_PAPEL) || 'dono';
    if (bar) $$('[data-papel]', bar).forEach(b => {
      const on = b.dataset.papel === p;
      b.classList.toggle('primary', on);
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
  };
  if (bar) {
    bar.hidden = false;
    bar.onclick = e => {
      if (e.target.closest('#demo-reset')) { montarApresentacao(); toast('Dados da apresentação recarregados'); syncPapel(); return; }
      const b = e.target.closest('[data-papel]'); if (!b) return;
      localStorage.setItem(KEY_PAPEL, b.dataset.papel);
      toast(b.dataset.papel === 'observador' ? 'Modo observador: só consulta' : 'Modo dono: acesso total');
      syncPapel();
      render();
    };
  }
  syncPapel();
  if (!db.unidades.length) montarApresentacao();
  else {
    const qs = quartos();
    if (qs.length && qs.every(u => !u.comissao)) {
      qs.forEach((u, i) => { u.comissao = 80 + (i % 5) * 20; });
      save();
    }
    render();
  }
}

if (DEMO) prepararDemo();
else exigirPin().then(() => render());
