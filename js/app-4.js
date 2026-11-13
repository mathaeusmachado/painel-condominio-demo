$('#btn-export').onclick = () => {
  const json = JSON.stringify(db, null, 2);
  abrirModal(`<h3>Backup dos dados</h3>
    <p class="k" style="color:var(--muted)">Anexos (PDF/fotos) não entram no backup. Prefira <strong>Baixar criptografado</strong> com uma senha que só você conhece. Texto puro contém CPF e contratos.</p>
    <label>Senha do backup criptografado</label>
    <input id="bk-pass" type="password" autocomplete="new-password" placeholder="mín. 8 caracteres">
    <textarea id="bk-txt" rows="8" readonly style="font-family:monospace;font-size:.75rem"></textarea>
    <div class="modal-actions"><button type="button" id="bk-limpar" class="danger">Apagar todos os dados</button>
      <button type="button" id="bk-baixar">Baixar em texto (não recomendado)</button>
      <button type="button" id="bk-cifrar" class="primary">Baixar criptografado</button></div>`, () => {});
  $('#bk-txt').value = json;
  $('#bk-baixar').onclick = async () => {
    if (!(await confirmar('Este arquivo fica legível. Guarde fora de pasta compartilhada. Continuar?'))) return;
    baixarBlob(`condominio-backup-${today()}.json`, new Blob([json], { type: 'application/json' }));
    marcarBackup(); toast('Backup em texto baixado');
  };
  $('#bk-cifrar').onclick = async () => {
    const senha = $('#bk-pass').value;
    if ((senha || '').length < 8) { erro('Senha com pelo menos 8 caracteres.'); return; }
    try {
      const out = await cifrarBackup(json, senha);
      baixarBlob(`condominio-backup-${today()}.enc.json`, new Blob([out], { type: 'application/json' }));
      marcarBackup(); toast('Backup criptografado baixado');
    } catch { erro('Não foi possível cifrar neste navegador.'); }
  };
  $('#bk-limpar').onclick = async () => {
    if (!(await confirmar('Apagar TODOS os dados (pessoas, quartos, cobranças e despesas)? Isso não pode ser desfeito.'))) return;
    db = vazio(); arqClear(); save(); modal.close(); render(); toast('Dados apagados');
  };
};
$('#file-import').onchange = async e => {
  const f = e.target.files[0]; if (!f) return;
  try {
    let d = JSON.parse(await f.text());
    if (d && d.v === 1 && d.alg === 'AES-GCM' && d.ct) {
      const senha = prompt('Senha do backup criptografado:');
      if (!senha) return;
      d = await decifrarBackup(d, senha);
    }
    if (!Array.isArray(d.pessoas) || !Array.isArray(d.unidades)) throw 0;
    if (!(await confirmar('Isto substitui todos os dados atuais. Anexos antigos serão apagados (não vêm no backup). Continuar?'))) return;
    await arqClear();
    db = normalizeDb(d);
    db.pessoas.forEach(p => { p.arquivos = []; });
    save(); render(); marcarBackup(); toast('Backup restaurado. Reanexe os documentos.');
  } catch { toast('Arquivo de backup inválido ou senha incorreta.'); }
  e.target.value = '';
};

const somaDias = n => { const d = new Date(); d.setDate(d.getDate() + n); return ymd(d); };

function textoContrato(p, u) {
  return `CONTRATO DE LOCAÇÃO RESIDENCIAL (modelo)

Locador: Residencial Hortênsias
Locatário (responsável): ${p.nome}
Unidade: ${rotuloUnidade(u.id)} · ${u.andar || ''}
Aluguel: ${brl(p.valor)} · vencimento todo dia ${p.diaVenc}
Caução: ${brl(p.caucao || p.valor)}
Início: ${fmtData(p.dataEntrada)}  Término: ${fmtData(p.dataFimContrato)}

O locatário declara ter lido este modelo e concorda com as cláusulas de uso, pontualidade e conservação da unidade mobiliada.
Assinatura eletrônica: nome + data + registro no painel (demonstração).`;
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
    const acoes = isObs()
      ? `<button class="small" data-verc="${esc(c.id)}">Ver</button>`
      : `<button class="small" data-verc="${esc(c.id)}">Ver</button>${c.status !== 'assinado' ? ` <button class="small primary" data-assc="${esc(c.id)}">Assinar agora</button>` : ` <button class="small" data-baixc="${esc(c.id)}">Baixar</button>`}`;
    return `<tr><td>${esc(rotuloUnidade(c.unidadeId))}</td><td>${esc(p ? p.nome : '—')}</td>
      <td><span class="badge ${bd[0]}">${bd[1]}</span></td><td>${fmtData(c.geradoEm)}</td><td>${c.assinadoPor ? esc(c.assinadoPor) + ' · ' + fmtData(c.assinadoEm) : '—'}</td>
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
$('#tb-contratos') && ($('#tb-contratos').onclick = e => {
  const ver = e.target.closest('[data-verc]'), ass = e.target.closest('[data-assc]'), bx = e.target.closest('[data-baixc]');
  const c = id => (db.contratos || []).find(x => x.id === id);
  if (ver) abrirContrato(c(ver.dataset.verc), false);
  if (ass && !isObs()) abrirContrato(c(ass.dataset.assc), true);
  if (bx) {
    const x = c(bx.dataset.baixc), p = pessoa(x.pessoaId), u = unidade(x.unidadeId);
    baixarBlob(`contrato-${u ? u.nome : 'unidade'}.txt`, new Blob([textoContrato(p, u)], { type: 'text/plain' }));
    toast('PDF na versão hospedada; nesta demo o arquivo é texto.');
  }
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
  ].map(([tipo, nome, andar, valor, itens]) => ({ id: uid(), tipo, nome, andar, valor, itens, obs: '' }));
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
  db = { unidades: U, pessoas: P, cobrancas: cobr, despesas: despesas.filter(d => d.data <= today() || d.data.slice(0, 7) < cur), contratos };
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
  for (let i = 1; i <= 12; i++) U.push({ id: uid(), tipo: 'kitnet', nome: 'K' + pad(i), andar: i <= 4 ? 'Térreo' : i <= 8 ? '1º andar' : '2º andar', valor: 1100 + (i % 4) * 50, itens: kit, obs: '' });
  for (let i = 1; i <= 12; i++) U.push({ id: uid(), tipo: 'quarto', nome: 'Q' + pad(i), andar: i <= 6 ? '1º andar' : '2º andar', valor: 600 + (i % 3) * 40, itens: qto, obs: '' });
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
  db = { unidades: U, pessoas: P, cobrancas: cobr, despesas: despesas.filter(d => d.data <= today() || d.data.slice(0, 7) < cur), contratos };
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
  else render();
}

if (DEMO) prepararDemo();
else exigirPin().then(() => render());
