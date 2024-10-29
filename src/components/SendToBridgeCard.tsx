import React, { useState } from "react";
import { Button, Card, Input } from "antd";
import { genSendToBridgeTx, getNetwork } from "../btc-utils";

import * as bitcoin from 'bitcoinjs-lib';
import * as ecc from '@bitcoinerlab/secp256k1';
import { Buffer } from 'buffer';

interface ChildProps {
	account: string;
	strNetwork: string;
	balanceConfirmed: number;
	pubkeyHex: string;
}

export const SendToBridgeCard: React.FC<ChildProps> = ({ account, strNetwork, balanceConfirmed, pubkeyHex }) => {
	bitcoin.initEccLib(ecc);
	window.Buffer = Buffer;

	// Hardhat localhost : 31337 
	// Etherum mainnet: 1
	// Sepolia testnet: 11155111
	const [chainId, setChainId] = useState(31337);
	const [evmAddress, setEvmAddress] = useState("0x");
	const [amount, setAmount] = useState(1000);
	const [feeRate, setFeeRate] = useState(2);
	const [result, setResult] = useState({
		success: false,
		error: "",
		data: "",
	});

	return (
		<Card size="small" title="Send to Bridge" style={{ margin: 10 }}>
			<div style={{ textAlign: "left", marginTop: 10 }}>
				<div style={{ fontWeight: "bold" }}>Evm ChainId:</div>
				<Input
					defaultValue={chainId}
					onChange={(e) => {
						setChainId(parseInt(e.target.value));
					}}
				></Input>
			</div>

			<div style={{ textAlign: "left", marginTop: 10 }}>
				<div style={{ fontWeight: "bold" }}>Evm Address: </div>
				<Input
					defaultValue={evmAddress}
					onChange={(e) => {
						setEvmAddress(e.target.value);
					}}
				></Input>
			</div>

			<div style={{ textAlign: "left", marginTop: 10 }}>
				<div style={{ fontWeight: "bold" }}>Amount: </div>
				<Input
					defaultValue={amount}
					onChange={(e) => {
						setAmount(parseInt(e.target.value));
					}}
				></Input>
			</div>

			<div style={{ textAlign: "left", marginTop: 10 }}>
				<div style={{ fontWeight: "bold" }}>Fee Rate (satoshi/vB): </div>
				<Input
					defaultValue={feeRate}
					onChange={(e) => {
						setFeeRate(parseInt(e.target.value));
					}}
				></Input>
			</div>

			{result.success ? (
				<div style={{ textAlign: "left", marginTop: 10 }}>
					<div style={{ fontWeight: "bold" }}>Txid:</div>
					<div style={{ wordWrap: "break-word" }}>{result.data}</div>
				</div>
			) : (
				<div style={{ textAlign: "left", marginTop: 10 }}>
					<div style={{ wordWrap: "break-word" }}>{result.error}</div>
				</div>
			)}

			<Button
				style={{ marginTop: 10 }}
				onClick={async () => {
					setResult({
						success: false,
						error: "Requesting...",
						data: "",
					});
					try {
						const unisat = (window as any).unisat;
						const network = getNetwork(strNetwork);

						const psbt = await genSendToBridgeTx({
							account,
							strNetwork,
							pubkeyHex,
							amount,
							balanceConfirmed,
							feeRate,
							chainId,
							evmAddress,
						})

						// Sign the psbt using unisat chrome extension wallet
						const res: string = await unisat.signPsbt(psbt.toHex(), {
							autoFinalize: true,
							toSignInputs: [
								{
									index: 0,
									address: account,
								},
							]
						});
						const signed = bitcoin.Psbt.fromHex(res, { network: network });
						const tx = signed.extractTransaction();

						// log the actual tx size
						const weight = tx.weight();
						const vB = Math.ceil(weight / 4);
						console.log(`Actual vB = ${vB}`);

						// Broadcast the tx
						const txid = await unisat.pushTx(tx.toHex());

						setResult({
							success: true,
							error: "",
							data: txid,
						});
					} catch (e) {
						setResult({
							success: false,
							error: (e as any).message,
							data: "",
						});
					}
				}}
			>
				Submit
			</Button>
		</Card>
	);
}
