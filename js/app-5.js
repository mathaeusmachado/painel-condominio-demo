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
function latinDoc(s) {
  return String(s ?? '').normalize('NFC').replace(/[^\x09\x0a\x0d\x20-\xff]/g, ch => ({ '–': '-', '—': '-', '“': '"', '”': '"', '‘': "'", '’': "'" }[ch] || ch.normalize('NFD').replace(/[\u0300-\u036f]/g, '')));
}
function baixarWord(nome, titulo, texto) {
  const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word"><head><meta charset="utf-8"><title>${esc(titulo)}</title></head><body style="font-family:Calibri,Arial,sans-serif;font-size:12pt;line-height:1.45"><h1 style="font-size:16pt">${esc(titulo)}</h1><pre style="font-family:Calibri,Arial,sans-serif;white-space:pre-wrap">${esc(texto)}</pre></body></html>`;
  baixarBlob(nome, new Blob(['\ufeff' + html], { type: 'application/msword' }));
}
function baixarPdf(nome, titulo, texto) {
  const raw = latinDoc((titulo ? titulo + '\n\n' : '') + texto).replace(/\r\n/g, '\n');
  const lines = [];
  raw.split('\n').forEach(line => {
    if (!line) { lines.push(''); return; }
    for (let i = 0; i < line.length; i += 88) lines.push(line.slice(i, i + 88));
  });
  const escPdf = s => s.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
  let stream = 'BT /F1 11 Tf 48 800 Td 14 TL\n';
  lines.forEach(ln => { stream += `(${escPdf(ln)}) Tj T*\n`; });
  stream += 'ET\n';
  const objs = [];
  const add = s => { objs.push(s); return objs.length; };
  add('<< /Type /Catalog /Pages 2 0 R >>');
  add('<< /Type /Pages /Kids [3 0 R] /Count 1 >>');
  add('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>');
  add(`<< /Length ${stream.length} >>\nstream\n${stream}endstream`);
  add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
  let pdf = '%PDF-1.4\n', xref = [0];
  objs.forEach((body, i) => {
    xref[i + 1] = pdf.length;
    pdf += `${i + 1} 0 obj\n${body}\nendobj\n`;
  });
  const start = pdf.length;
  pdf += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i <= objs.length; i++) pdf += String(xref[i]).padStart(10, '0') + ' 00000 n \n';
  pdf += `trailer << /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${start}\n%%EOF`;
  const bin = new Uint8Array(pdf.length);
  for (let i = 0; i < pdf.length; i++) bin[i] = pdf.charCodeAt(i) & 0xff;
  baixarBlob(nome, new Blob([bin], { type: 'application/pdf' }));
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

