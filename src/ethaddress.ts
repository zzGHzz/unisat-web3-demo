import * as rlp from 'rlp';

function isValidEthAddress(address: string): boolean {
    return /^0x[a-fA-F0-9]{40}$/.test(address);
}

export function encodeEthAddress(chainid: number, addr: string) : string {
    if (!isValidEthAddress(addr)) {
        throw new Error('Invalid Ethereum address');
    }

    if (!Number.isInteger(chainid) || chainid < 0 || chainid > 0xffffffff) {
        throw new Error('Invalid chainid');
    }

    const chainidBuffer = Buffer.alloc(4);
    chainidBuffer.writeUInt32BE(chainid);

    const addrBuffer = Buffer.from(addr.slice(2), 'hex');

    const encoded = rlp.encode([chainidBuffer, addrBuffer]);
    return Buffer.from(encoded).toString('hex');
}