// export const bridgeWallet: string = 'tb1pgdd25x6r0f49vsy5d7q4590szehaxs6d4mczgyv9wcztslv7vsss6at4q7';
export const bridgeWallet: string = 'mxV7UsYMscwht4TWMrnSYtN4ccBmx8kdsg'; 
export const dustLimit: number = 546; // satoshis

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