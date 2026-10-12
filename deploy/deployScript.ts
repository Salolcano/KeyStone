import path from "path";
import { readFileSync } from "fs";
import { TransactionStatus } from "genlayer-js/types";

export default async function main(client: any) {
  const code = new Uint8Array(readFileSync(path.resolve(process.cwd(), "contracts/keystone.py")));
  await client.initializeConsensusSmartContract();
  const hash = await client.deployContract({ code, args: [], leaderOnly: false });
  const receipt = await client.waitForTransactionReceipt({ hash, status: TransactionStatus.ACCEPTED, retries: 200 });
  console.log("Keystone deployed at:", receipt.data?.contract_address ?? receipt);
}
