import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { Address, Cell, beginCell, contractAddress, storeStateInit } from '@ton/core';

type CompiledJson = { code: string; data: string };

function findBuildFile(): { type: 'compiled' | 'state_cell'; path: string } {
  const bdir = join(process.cwd(), 'build');
  const files = readdirSync(bdir);
  const compiled = files.find(f => f.endsWith('.compiled.json') || f.endsWith('.json'));
  if (compiled) return { type: 'compiled', path: join(bdir, compiled) };
  const cell = files.find(f => f.endsWith('.cell') || f.endsWith('.pkg'));
  if (cell) return { type: 'state_cell', path: join(bdir, cell) };
  throw new Error('В build/ не найдено ни *.compiled.json, ни *.cell/*.pkg');
}

export function loadDeploy() {
  const { type, path } = findBuildFile();

  if (type === 'compiled') {
    const j: CompiledJson = JSON.parse(readFileSync(path, 'utf-8'));
    // ожидаем base64-клетки
    const code = Cell.fromBoc(Buffer.from(j.code, 'base64'))[0];
    const data = Cell.fromBoc(Buffer.from(j.data, 'base64'))[0];

    const stateInitCell = beginCell().store(storeStateInit({ code, data })).endCell();
    const stateInitBoc = stateInitCell.toBoc({ idx: false }).toString('base64');
    const addr = contractAddress(0, { code, data });
    return { address: addr.toString({ bounceable: true }), state_init: stateInitBoc };
  }

  // type === 'state_cell' → предполагаем, что это уже StateInit-BOC
  const boc = readFileSync(path);
  const stateInitCell = Cell.fromBoc(boc)[0];

  // Адрес считаем через распаковку как StateInit (code+data)
  // Пробуем гидрировать как StateInit: code = ref(0), data = ref(1) или опциональные поля
  // Универсальный способ: попытаемся прочитать как StateInit вручную.
  const slice = stateInitCell.beginParse();
  const hasSplitDepth = slice.loadBit(); // _ split_depth^?
  if (hasSplitDepth) slice.loadUint(5);
  const hasSpecial = slice.loadBit(); // _ special^?
  if (hasSpecial) {
    // unusual; не ожидаем
  }
  const hasCode = slice.loadBit();
  let code: Cell | null = null;
  if (hasCode) code = slice.loadRef();
  const hasData = slice.loadBit();
  let data: Cell | null = null;
  if (hasData) data = slice.loadRef();

  if (!code) throw new Error('StateInit: code not found in cell');
  if (!data) data = new Cell();

  const addr = contractAddress(0, { code, data });
  const stateInitBoc = stateInitCell.toBoc({ idx: false }).toString('base64');
  return { address: addr.toString({ bounceable: true }), state_init: stateInitBoc };
}

export function buildTonConnectDeploy(address: string, stateInitBoc: string, amountTon = 0.05) {
  const amountNano = BigInt(Math.floor(amountTon * 1e9)).toString();
  return {
    valid_until: Math.floor(Date.now() / 1000) + 5 * 60,
    messages: [
      {
        address,
        amount: amountNano,
        state_init: stateInitBoc,
      },
    ],
  };
}
