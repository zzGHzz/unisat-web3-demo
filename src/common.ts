// export const bridgeWallet: string = 'tb1pgdd25x6r0f49vsy5d7q4590szehaxs6d4mczgyv9wcztslv7vsss6at4q7'; // taproot
// export const bridgeWallet: string = 'mxV7UsYMscwht4TWMrnSYtN4ccBmx8kdsg'; // p2pkh
// export const bridgeWallet: string = 'tb1qrk2032f2pap8dzzwhx9rqj5mdusa0e56tf3rtz'; // p2wpkh
export const bridgeWallet: string = '2N6EsbnP3KLrcCwEXhuXtRT6xDoGqgdSZb7'; // p2sh-p2wpkh
export const dustLimit: number = 546; // in Satoshi

const apiUrl: Map<string, string> = new Map<string, string>([
    ['livenet', 'https://blockstream.info/api/'],
    ['testnet', 'https://mempool.space/testnet4/api/']
])

export const getApiUrl = (network: string): string => {
    const url = apiUrl.get(network);
    if (url === undefined) {
        throw new Error(`api not found for ${network}`);
    }
    return url;
}