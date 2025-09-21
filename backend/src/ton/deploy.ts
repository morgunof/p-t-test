// backend/src/ton/deploy.ts
import { Address, beginCell, contractAddress, storeStateInit, type StateInit } from '@ton/core';
// ВАЖНО: импорт именно из .js, как у тебя в проекте
import { AtomicSwap } from '../tact/swap_AtomicSwap.js';

export async function loadDeploy() {
  const owner = process.env.OWNER_ADDRESS;
  const fee   = process.env.FEE_RECEIVER;
  if (!owner || !fee) throw new Error('OWNER_ADDRESS or FEE_RECEIVER is missing');

  const ownerAddr = Address.parse(owner);
  const feeAddr   = Address.parse(fee);

  // В биндингах нет AtomicSwap.init, а есть только fromInit().
  // Пробуем универсально: без аргументов, если не выйдет — с аргументами.
  let created: any;
  try {
    created = await (AtomicSwap as any).fromInit();
  } catch {
    created = await (AtomicSwap as any).fromInit(ownerAddr, feeAddr);
  }

  // created — это инстанс, у которого обычно есть .address и .init { code, data }
  const address: Address = created?.address;
  const init: StateInit | undefined = created?.init;

  if (!init?.code || !init?.data) {
    throw new Error('Invalid Tact init result (no code/data)');
  }

  const state_init = beginCell()
    .store(storeStateInit(init))
    .endCell()
    .toBoc({ idx: false })
    .toString('base64');

  return { address: address.toString(), state_init };
}

export function buildTonConnectDeploy(address: string, state_init: string, amountTon: number) {
  return {
    valid_until: Math.floor(Date.now() / 1000) + 600,
    messages: [
      {
        address,
        amount: String(Math.round(amountTon * 1e9)),
        state_init,
      },
    ],
  };
}
