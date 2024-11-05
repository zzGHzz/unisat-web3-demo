import * as bitcoin from "bitcoinjs-lib";
import { Utxo, AddressType, TxPart, TxConfig } from "./types";
import { getApiUrl, bridgeWallet, dustLimit } from "./common";
import * as tools from 'uint8array-tools';
import { encodeEthAddress } from "./ethaddress";

// Fetch the UTXO list of an address via a API call
const getUtxoList = async (address: string, network: string) => {
    const url = getApiUrl(network) + `address/${address}/utxo`;

    const res = await fetch(url);

    const utxos: Utxo[] = [];

    if (res.ok) {
        const data = await res.json();
        for (const utxo of data) {
            if (utxo.status.confirmed === false) {
                continue;
            }

            utxos.push({
                txid: utxo.txid,
                vout: utxo.vout,
                value: utxo.value,
            });
        }
    } else {
        throw new Error("Failed to fetch utxos");
    }

    return utxos;
}

// Fetch the required data of a UTXO according to its address type
const fetchUtxo = async (utxo: Utxo, addrType: AddressType, network: string): Promise<Utxo> => {
    switch (addrType) {
        case AddressType.P2PKH: {
            const txHex = await fetchTxHex(utxo.txid, network);
            utxo.noWittnessUtxo = tools.fromHex(txHex);
            break;
        }
        case AddressType.P2SH_P2WPKH:
            break;
        case AddressType.P2WPKH:
            break;
        case AddressType.P2TR: {
            utxo.pubkey = utxo.pubkey?.slice(1);
            break;
        }
        default:
            throw new Error("Unsupported address type");
    }

    return utxo;
}

// Fetch the hex of a full transaction
const fetchTxHex = async (txid: string, network: string): Promise<string> => {
    let url = getApiUrl(network) + `tx/${txid}/hex`;

    const res = await fetch(url);

    if (res.ok) {
        return res.text();
    } else {
        throw new Error("Failed to fetch tx hex");
    }
}

export const getNetwork = (network: string) => {
    if (network === "livenet") {
        return bitcoin.networks.bitcoin;
    } else if (network === "testnet") {
        return bitcoin.networks.testnet;
    } else {
        throw new Error("Invalid network");
    }
}

// Get the address type
const getAddressType = (addr: string, network: bitcoin.networks.Network) => {
    const err = new Error("Invalid address type");

    try {
        const decoded = bitcoin.address.fromBase58Check(addr);
        if (decoded.version === network.pubKeyHash) {
            return AddressType.P2PKH;
        }

        if (decoded.version === network.scriptHash) {
            return AddressType.P2SH_P2WPKH;
        }

        throw err;
    } catch (err: any) {
        try {
            const decoded = bitcoin.address.fromBech32(addr);

            if (decoded.version === 0) {
                return AddressType.P2WPKH;
            }

            if (decoded.version === 1) {
                return AddressType.P2TR;
            }

            throw err;
        } catch (err: any) {
            throw err;
        }
    }
}

// Add an input to a PSBT
const psbtAddInput = (
    psbt: bitcoin.Psbt,
    type: AddressType,
    utxo: Utxo,
    network: bitcoin.networks.Network
) => {
    switch (type) {
        case AddressType.P2PKH: {
            psbt.addInput({
                hash: utxo.txid,
                index: utxo.vout,
                nonWitnessUtxo: utxo.noWittnessUtxo!,
            });

            break;
        }
        case AddressType.P2SH_P2WPKH:{
            const p2wpkh = bitcoin.payments.p2wpkh({
                pubkey: utxo.pubkey!,
                network: network,
            })

            const p2sh = bitcoin.payments.p2sh({
                redeem: p2wpkh,
                network: network,
            });

            psbt.addInput({
                hash: utxo.txid,
                index: utxo.vout,
                redeemScript: p2sh.redeem!.output!,
                witnessUtxo: {
                    script: p2wpkh.output!,
                    value: BigInt(utxo.value),
                }
            });

            break;
        }
        case AddressType.P2WPKH:{
            const { output } = bitcoin.payments.p2wpkh({
                pubkey: utxo.pubkey!,
                network: network,
            });

            psbt.addInput({
                hash: utxo.txid,
                index: utxo.vout,
                witnessUtxo: {
                    script: output!,
                    value: BigInt(utxo.value),
                }
            });
            break;
        }
        case AddressType.P2TR: {
            const { output } = bitcoin.payments.p2tr({
                internalPubkey: utxo.pubkey!,
                network: network,
            });

            psbt.addInput({
                hash: utxo.txid,
                index: utxo.vout,
                tapInternalKey: utxo.pubkey!,
                witnessUtxo: {
                    script: output!,
                    value: BigInt(utxo.value),
                }
            });
            break;
        }
        default:
            throw new Error("Unsupported address type");
    }

    return psbt;
}

// Get the estimated size of an input or output w.r.t. the address type
const getTxPartSize = (type: AddressType, part: TxPart) => {
    switch (type) {
        case AddressType.P2PKH:
            return part === TxPart.INPUT ? 148 : 34;
        case AddressType.P2SH_P2WPKH:
            return part === TxPart.INPUT ? 107 : 32;
        case AddressType.P2WPKH:
            return part === TxPart.INPUT ? 68 : 32;
        case AddressType.P2TR:
            return part === TxPart.INPUT ? 58 : 43;
        default:
            throw new Error("Unsupported address type");
    }
}

// Get the estimated size of the transaction overhead
const getTxOverheadSize = () => {
    return 11;
}

// Get the estimated size of a transaction
const getTxSize = (cfg: TxConfig) => {
    let size = getTxOverheadSize();

    for (const key of cfg.input.keys()) {
        size += getTxPartSize(key, TxPart.INPUT) * cfg.input.get(key)!;
    }

    for (const key of cfg.output.keys()) {
        if (key === AddressType.OP_RETURN) {
            size += cfg.output.get(key)! + 10; // here 10 = 1 byte for OP_RETURN + 1 byte for data length + 8 bytes for amount
        } else {
            size += getTxPartSize(key, TxPart.OUTPUT) * cfg.output.get(key)!;
        }
    }

    return size;
}

// Get the UTXOs that will be used to construct the transaction
const getUtxosForTx = (allUntxos: Utxo[], amount: number) => {
    let accu = 0;
    let n = 0;
    for (const utxo of allUntxos) {
        accu += utxo.value;
        n++;
        if (accu >= amount) {
            break;
        }
    }

    return allUntxos.slice(0, n);
}

export type SendToBridgeTxArgs = {
    account: string,
    strNetwork: string,
    pubkeyHex: string,
    amount: number,
    balanceConfirmed: number,
    feeRate: number,
    chainId: number,
    evmAddress: string,
}

// Generate a partially signed bitcoin transaction to send fund to the bridge.
// The transaction will later be signed by a bitcoin wallet.
// The transaction will have max 3 outputs:
// 1. OP_RETURN output that records the chain id and the EVM address
// 2. Output to send fund to the bridge wallet
// 3. Output to return the remaining fund to the account if the remaining fund is above the dust limit
export const genSendToBridgeTx = async (arg: SendToBridgeTxArgs) => {
    const {
        account,
        strNetwork,
        pubkeyHex,
        amount,
        balanceConfirmed,
        feeRate,
        chainId,
        evmAddress,
    } = arg;

    const network = getNetwork(strNetwork);
    const accoutType = getAddressType(account, network);
    console.log(`account = ${account}, type = ${accoutType}`);
    const pubkey = tools.fromHex(pubkeyHex);

    // Get all the utxos of the account
    const allUtxos = await getUtxoList(account, strNetwork);

    // Compute max fee - including all possible utxos as inputs
    const opReturnDat: string = encodeEthAddress(chainId, evmAddress);
    const bridgeWalletType = getAddressType(bridgeWallet, network);
    const cfg: TxConfig = {
        input: new Map<AddressType, number>([[accoutType, allUtxos.length]]),
        output: new Map<AddressType, number>([[AddressType.OP_RETURN, opReturnDat.length]]),
    }
    if (bridgeWalletType === accoutType) {
        cfg.output.set(bridgeWalletType, 2);
    } else {
        cfg.output.set(bridgeWalletType, 1);
        cfg.output.set(accoutType, 1);
    }
    const maxFee = getTxSize(cfg) * feeRate;

    // Check the sufficiency of the confirmed balance
    if (balanceConfirmed < amount + maxFee) {
        throw new Error("Insufficient balance");
    }

    // Get utxos from all the utxos specifically for the transaction
    const utxos = getUtxosForTx(allUtxos, amount + maxFee);

    // Create a partially signed bitcoin transaction
    let psbt = new bitcoin.Psbt({ network: network });

    // Add inputs
    let bal = 0;
    for (let utxo of utxos) {
        bal += utxo.value;

        utxo.pubkey = pubkey;
        await fetchUtxo(utxo, accoutType, strNetwork);

        psbt = psbtAddInput(
            psbt,
            accoutType,
            utxo,
            network
        )
    }

    // Add output to send fund to the bridge wallet
    psbt.addOutput({
        value: BigInt(amount),
        address: bridgeWallet,
    });

    // Add output that records the account that received the wrapped BTC tokens
    psbt.addOutput({
        script: bitcoin.script.compile([bitcoin.opcodes.OP_RETURN, Buffer.from(opReturnDat, 'utf8')]),
        value: BigInt(0),
    });

    // Recompute fee
    cfg.input.set(accoutType, utxos.length);
    const fee = getTxSize(cfg) * feeRate;

    // ONLY add output to return the remaining fund if it is above the dust limit
    if (bal - amount - fee > dustLimit) {
        psbt.addOutput({
            value: BigInt(bal - amount - fee),
            address: account,
        });
    } else {
        // remove the output from the config
        const num = cfg.output.get(accoutType)!;
        if (num > 1) {
            cfg.output.set(accoutType, num - 1);
        } else {
            cfg.output.delete(accoutType);
        }
    }

    console.log(`Estimated vB = ${getTxSize(cfg)}`);

    return psbt;
}