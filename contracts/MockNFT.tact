// SPDX-License-Identifier: MIT
// MockNFT.tact - минимальный каркас под тесты
pragma ton-solidity >=0.66.0;
contract MockNFT {
    mapping(uint64 => address) owners;
    function mint(uint64 token, address to) external {
        tvm.accept();
        owners[token] = to;
    }
    function ownerOf(uint64 token) external view returns (address) {
        return owners[token];
    }
}
