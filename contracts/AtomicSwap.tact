// SPDX-License-Identifier: MIT
// AtomicSwap.tact - MVP skeleton
// NOTE: Это упрощённый каркас, логика проверок и безопасных переводов будет расширена.

pragma ton-solidity >=0.66.0;

contract AtomicSwap {
    address static owner;
    address feeReceiver; // может быть пуст, комиссии будут копиться на контракте

    struct OfferItem {
        uint8 kind; // 0=NFT, 1=TON
        address nft;
        uint64 token_id; // 0 = used only when kind=NFT; 0 can also mean 'any' (по договоренности для MVP)
        uint128 amount;  // only for TON
    }

    struct Offer {
        uint64 offer_id;
        address maker;
        OfferItem offered;
        OfferItem wanted;
        optional(address) taker_allowed;
        uint16 fee_bps;
        uint64 deadline;
        bool maker_deposited;
        bool taker_deposited;
        uint8 status; // 0 Active, 1 Cancelled, 2 Completed, 3 Expired
    }

    // storage
    mapping(uint64 => Offer) offers;
    uint64 next_id;

    // --- events (лог: через emit в off-chain индексере) ---

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

    // Заглушка: возвращает новый ID (в MVP мы чаще создаём on-chain при первом депозите)
    function createOffer(OfferItem offered, OfferItem wanted, optional(address) taker_allowed, uint16 fee_bps, uint64 deadline) external returns (uint64) {
        tvm.accept();
        uint64 id = next_id;
        next_id += 1;
        offers[id] = Offer(id, msg.sender, offered, wanted, taker_allowed, fee_bps, deadline, false, false, 0);
        return id;
    }

    // Остальные методы будут реализованы в полноценной версии (deposit, execute, refund, cancel)
}
