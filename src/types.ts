export interface Utxo {
    txid: string;
    vout: number;
    value: number;
    pubkey?: Uint8Array;
    noWittnessUtxo?: Uint8Array;
}

export enum AddressType {
    P2PKH = "p2pkh",
    P2SH_P2WPKH = "p2sh-p2wpkh",
    P2WPKH = "p2wpkh",
    P2TR = "p2tr",

    OP_RETURN = "op_return",
}

export enum TxPart {
    INPUT = "input",
    OUTPUT = "output",
}

export interface TxConfig {
    input: Map<AddressType, number>;    // input address type -> number of inputs with this type
    output: Map<AddressType, number>;   // output address type -> number of outputs with this type
                                        // type === OP_RETURN -> number of bytes in the output data
}