
const $ = id => document.getElementById(id);

const defaults = {
  rDebitVM: 1.22,
  rDebitElo: 1.77,
  rCreditVM: 3.95,
  rCreditAmex: 4.55,
  rCreditElo: 4.50,
  r2: 6.72,
  r6: 12.76,
  r7: 14.27,
  r12: 21.82
};

const rateIds = Object.keys(defaults);
let deferredInstall = null;

function parseMoney(value) {
  let s = String(value).trim().replace(/\s/g, '');

  if (s.includes(',')) {
    s = s.replace(/\./g, '').replace(',', '.');
  }

  const n = Number(s);

  if (!Number.isFinite(n) || n <= 0) {
    throw new Error('Digite um valor válido maior que zero.');
  }

  return n;
}

function money(n) {
  return n.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  });
}

function rates() {
  const r = {};

  rateIds.forEach(id => {
    r[id] = Number($(id).value);
  });

  return r;
}

function interpolate(a, b, step, total) {
  return a + (b - a) * (step / total);
}

function getRate(type, brand, n, r) {

  if (type === 'debit') {

    if (brand === 'amex') {
      throw new Error(
        'A tabela enviada não informa taxa de débito para Amex.'
      );
    }

    return brand === 'elo'
      ? r.rDebitElo
      : r.rDebitVM;
  }

  if (type === 'credit') {

    if (brand === 'amex') return r.rCreditAmex;
    if (brand === 'elo') return r.rCreditElo;

    return r.rCreditVM;
  }

  if (n <= 6) {
    return interpolate(r.r2, r.r6, n - 2, 4);
  }

  return interpolate(r.r7, r.r12, n - 7, 5);
}

function calculate() {

  $('error').textContent = '';

  try {

    const net = parseMoney($('netAmount').value);

    const type = $('paymentType').value;
    const brand = $('brand').value;

    const n = type === 'installments'
      ? Number($('installments').value)
      : 1;

    const rate = getRate(type, brand, n, rates());

    if (!Number.isFinite(rate) || rate < 0 || rate >= 100) {
      throw new Error('Confira as taxas cadastradas.');
    }

    const gross = Math.ceil(
      (net / (1 - rate / 100)) * 100
    ) / 100;

    $('grossAmount').textContent = money(gross);

    $('rate').textContent =
      rate.toFixed(2).replace('.', ',') + '%';

    $('netResult').textContent = money(net);

    $('installmentLine').classList.toggle(
      'hidden',
      type !== 'installments'
    );

    $('installmentValue').textContent =
      n + 'x de ' + money(Math.round((gross / n) * 100) / 100);

    $('estimateNote').textContent =
      type === 'installments'
      ? 'Taxa estimada por interpolação entre os limites da tabela enviada. Confirme o percentual exato no seu plano Cielo.'
      : 'Cálculo com a taxa cadastrada. O arredondamento é feito para cima para proteger o líquido desejado.';

    $('result').classList.remove('hidden');

  } catch (e) {

    $('result').classList.add('hidden');
    $('error').textContent = e.message;

  }
}

$('paymentType').addEventListener('change', () => {

  $('installmentGroup').classList.toggle(
    'hidden',
    $('paymentType').value !== 'installments'
  );

});

$('calculate').addEventListener('click', calculate);

$('copyBtn').addEventListener('click', async () => {

  try {

    await navigator.clipboard.writeText(
      $('grossAmount').textContent
    );

    $('copyBtn').textContent = 'Valor copiado!';

    setTimeout(() => {
      $('copyBtn').textContent = 'Copiar valor total';
    }, 1600);

  } catch {

    $('copyBtn').textContent =
      'Selecione o valor para copiar';

  }

});

$('saveRates').addEventListener('click', () => {

  localStorage.setItem(
    'holandaPayRates',
    JSON.stringify(rates())
  );

  $('rateMessage').textContent =
    'Taxas salvas neste aparelho.';

});

$('resetRates').addEventListener('click', () => {

  rateIds.forEach(id => {
    $(id).value = defaults[id];
  });

  localStorage.removeItem('holandaPayRates');

  $('rateMessage').textContent =
    'Taxas originais restauradas.';

});

try {

  const saved = JSON.parse(
    localStorage.getItem('holandaPayRates') || 'null'
  );

  if (saved) {
    rateIds.forEach(id => {
      if (Number.isFinite(saved[id])) {
        $(id).value = saved[id];
      }
    });
  }

} catch {}

window.addEventListener('beforeinstallprompt', e => {

  e.preventDefault();

  deferredInstall = e;

  $('installBtn').classList.remove('hidden');

});

$('installBtn').addEventListener('click', async () => {

  if (!deferredInstall) return;

  deferredInstall.prompt();

  await deferredInstall.userChoice;

  deferredInstall = null;

  $('installBtn').classList.add('hidden');

});

if ('serviceWorker' in navigator &&
    location.protocol.startsWith('http')) {

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js');
  });

}

calculate();
