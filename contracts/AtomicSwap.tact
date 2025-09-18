// SPDX-License-Identifier: MIT
// AtomicSwap.tact — TON-only escrow MVP (v0.1)
// NOTE: Это рабочий минимальный контракт под сценарий TON↔NFT/TON↔TON с комиссией и дедлайном.
// NFT-приём через onNFTReceived будет добавлен следующим патчем.
// Язык: тон-солидити-стайл для TVM (совместим с toolchain ton-solidity/tact-пайплайном). 
// Цель: быстро получить тестнет-валидный флоу depositTon/execute/refund/cancel с fee.

pragma ton-solidity >= 0.66.0;

contract AtomicSwap {
    address static owner;                // деплойер/админ (задаёт feeReceiver)
    address feeReceiver;                 // адрес получения комиссии; если zero — комиссии копятся на контракте

    // Константы/типы
    uint8 constant KIND_NFT = 0;
    uint8 constant KIND_TON = 1;

    uint8 constant STATUS_ACTIVE    = 0;
    uint8 constant STATUS_CANCELLED = 1;
    uint8 constant STATUS_COMPLETED = 2;
    uint8 constant STATUS_EXPIRED   = 3;

    struct OfferItem {
        uint8   kind;        // 0=NFT, 1=TON
        address nft;         // адрес контракта NFT (для TON: 0:0)
        uint64  token_id;    // NFT token_id (0 => any-of-collection в следующих версиях)
        uint128 amount;      // сумма TON в нанотонах (для NFT = 0)
    }

    struct Offer {
        uint64  offer_id;
        address maker;               // автор оффера
        OfferItem offered;           // что отдаёт maker
        OfferItem wanted;            // что хочет получить maker
        optional(address) taker_allowed; // приватный оффер: разрешённый кошелёк taker
        uint16  fee_bps;             // комиссия в bps (200 = 2.00%)
        uint64  deadline;            // unix ts
        bool    maker_deposited;     // внёс ли депозит maker
        bool    taker_deposited;     // внёс ли депозит taker
        uint8   status;              // STATUS_*
        address maker_depositor;     // фактический msg.sender при депозите со стороны maker
        address taker_depositor;     // фактический msg.sender при депозите со стороны taker
        uint128 ton_from_maker;      // сколько TON внёс maker (нанотоны)
        uint128 ton_from_taker;      // сколько TON внёс taker (нанотоны)
    }

    mapping(uint64 => Offer) offers; // офферы по id
    uint64 next_id;
    uint128 accruedFees;             // накопленные комиссии, если feeReceiver не задан

    // =====================
    // Конструктор/админ
    // =====================
    constructor() public {
        tvm.accept();
        next_id = 1;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, 100);
        _;
    }

    function set_fee_receiver(address to) external onlyOwner {
        tvm.accept();
        feeReceiver = to;
    }

    function withdrawFees(address to, uint128 amount) external onlyOwner {
        tvm.accept();
        require(amount <= accruedFees, 101);
        accruedFees -= amount;
        to.transfer(amount, true, 1);
    }

    // =====================
    // Офферы (создание/отмена)
    // =====================
    function createOffer(
        OfferItem offered,
        OfferItem wanted,
        optional(address) taker_allowed,
        uint16 fee_bps,
        uint64 deadline
    ) external returns (uint64) {
        tvm.accept();
        require(deadline > now, 110);

        uint64 id = next_id;
        next_id += 1;

        offers[id] = Offer(
            id,
            msg.sender,
            offered,
            wanted,
            taker_allowed,
            fee_bps,
            deadline,
            false,
            false,
            STATUS_ACTIVE,
            address.makeAddrNone(),
            address.makeAddrNone(),
            0,
            0
        );
        // Off-chain: OfferCreated(id,...)
        return id;
    }

    function cancelOffer(uint64 offer_id) external {
        tvm.accept();
        Offer of = offers[offer_id];
        require(of.maker == msg.sender, 120);
        require(of.status == STATUS_ACTIVE, 121);
        require(!of.taker_deposited, 122); // нельзя отменять, если депозит taker уже внесён
        of.status = STATUS_CANCELLED;
        offers[offer_id] = of;
        // Off-chain: OfferCancelled(offer_id)
    }

    // =====================
    // TON депозит (MVP)
    // =====================
    // Внос TON от стороны (maker или taker). Сумму определяем по msg.value.
    // Проверки приватности: если указан taker_allowed — только он может вносить как taker.
    function depositTon(uint64 offer_id) external payable {
        tvm.accept();
        Offer of = offers[offer_id];

        require(of.status == STATUS_ACTIVE, 130);
        require(now < of.deadline, 131);
        require(msg.value > 0, 132);

        // приватный оффер: если указан адрес — блокируем депозиты со стороны taker от других адресов
        if (of.taker_allowed.hasValue()) {
            address allowed = of.taker_allowed.get();
            // если депозит делает не maker, он считается taker-депозитом и должен совпадать с allowed
            if (msg.sender != of.maker) {
                require(msg.sender == allowed, 133);
            }
        }

        // определяем сторону
        if (msg.sender == of.maker) {
            require(!of.maker_deposited, 134);
            of.maker_deposited = true;
            of.maker_depositor = msg.sender;
            of.ton_from_maker += msg.value;
        } else {
            require(!of.taker_deposited, 135);
            of.taker_deposited = true;
            of.taker_depositor = msg.sender;
            of.ton_from_taker += msg.value;
        }

        offers[offer_id] = of;
        // Off-chain: MakerDeposited/TakerDeposited(offer_id)
    }

    // =====================
    // Execute / Refund
    // =====================

    // Комиссия считается от TON-«ноги» сделки (сумма TON, проходящая через эскроу).
    // Если обе стороны внесли TON, комиссия с общей суммы.
    function executeSwap(uint64 offer_id) external {
        tvm.accept();
        Offer of = offers[offer_id];
        require(of.status == STATUS_ACTIVE, 140);
        require(of.maker_deposited && of.taker_deposited, 141);
        require(now <= of.deadline, 142);

        // Валидации по предметам сделки (MVP TON-путь): если стороны ожидали TON — ок.
        // (NFT проверки будут добавлены в следующем патче.)
        require(of.offered.kind == KIND_TON || of.wanted.kind == KIND_TON, 143);

        // Сколько TON в сумме прошло через эскроу
        uint128 totalTon = of.ton_from_maker + of.ton_from_taker;

        // fee = totalTon * fee_bps / 10000
        uint128 fee = (uint128(of.fee_bps) * totalTon) / 10000;

        uint128 makerGetsTon;
        uint128 takerGetsTon;

        // Простейшая TON↔TON логика обмена: всё, что внёс maker → taker, и наоборот (минус комиссия пропорционально)
        // Для TON↔NFT позже: весь TON уходит стороне, у которой TON в wanted/offered.
        // Будем удерживать комиссию пропорционально от totalTon из потоков.
        if (totalTon > 0) {
            // Доля потока maker/taker в общей сумме
            uint128 feeFromMaker = (of.ton_from_maker * fee) / totalTon;
            uint128 feeFromTaker = fee - feeFromMaker;

            makerGetsTon = of.ton_from_taker - feeFromMaker; // maker получает то, что внёс taker, минус доля fee
            takerGetsTon = of.ton_from_maker - feeFromTaker; // taker получает то, что внёс maker, минус доля fee
        }

        // распределяем комиссию
        if (fee > 0) {
            if (feeReceiver.value != 0) {
                feeReceiver.transfer(fee, true, 1);
            } else {
                accruedFees += fee;
            }
        }

        // переводы сторонам
        if (makerGetsTon > 0) {
            of.maker.transfer(makerGetsTon, true, 1);
        }
        if (of.taker_depositor.value != 0 && takerGetsTon > 0) {
            of.taker_depositor.transfer(takerGetsTon, true, 1);
        }

        of.status = STATUS_COMPLETED;
        offers[offer_id] = of;
        // Off-chain: OfferExecuted(offer_id)
    }

    function refund(uint64 offer_id) external {
        tvm.accept();
        Offer of = offers[offer_id];
        require(of.status == STATUS_ACTIVE, 150);
        require(now > of.deadline, 151);

        // Возвращаем TON-депозиты, если были
        if (of.ton_from_maker > 0) {
            of.maker.transfer(of.ton_from_maker, true, 1);
            of.ton_from_maker = 0;
        }
        if (of.taker_depositor.value != 0 && of.ton_from_taker > 0) {
            of.taker_depositor.transfer(of.ton_from_taker, true, 1);
            of.ton_from_taker = 0;
        }

        of.status = STATUS_EXPIRED;
        offers[offer_id] = of;
        // Off-chain: OfferRefunded(offer_id)
    }

    // ===============
    // TODO: NFT часть
    // ===============
    // В следующей ревизии:
    // - onNFTReceived (safeTransfer) с привязкой (nft, token_id) → offer_id
    // - проверка exact/any-of-collection при депозитах NFT
    // - executeSwap с переводом NFT обеим сторонам
    // - flat-fee сценарий для NFT↔NFT без TON и +0.1 п.п. при deadline=48h (через перерасчёт fee_bps)
}
