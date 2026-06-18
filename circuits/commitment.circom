pragma circom 2.1.6;

/*
 * ZK Shield — Commitment Circuit
 *
 * Private inputs  : secret, amount, pathElements[20], pathIndices[20]
 * Public inputs   : root, nullifier
 *
 * Proves (in zero-knowledge):
 *   1. commitment = Poseidon(secret, amount) exists in the Merkle tree
 *   2. nullifier  = Poseidon(secret)  — prevents double-spend
 *   3. The Merkle path from commitment → root is valid
 *
 * Install deps first:
 *   npm install
 * Compile:
 *   npm run compile:circuit
 */

include "../node_modules/circomlib/circuits/poseidon.circom";
include "../node_modules/circomlib/circuits/mux1.circom";

// ── Merkle path verifier ─────────────────────────────────────────────────────

template MerkleProof(depth) {
    signal input leaf;
    signal input pathElements[depth];
    signal input pathIndices[depth];   // 0 = leaf is left child, 1 = right child
    signal output root;

    component hashers[depth];
    component muxL[depth];
    component muxR[depth];
    signal levelHash[depth + 1];
    levelHash[0] <== leaf;

    for (var i = 0; i < depth; i++) {
        // Binary constraint on path index
        pathIndices[i] * (1 - pathIndices[i]) === 0;

        hashers[i] = Poseidon(2);
        muxL[i]    = Mux1();
        muxR[i]    = Mux1();

        // pathIndices[i] == 0 → leaf is left,  sibling is right
        // pathIndices[i] == 1 → leaf is right, sibling is left
        muxL[i].c[0] <== levelHash[i];
        muxL[i].c[1] <== pathElements[i];
        muxL[i].s    <== pathIndices[i];

        muxR[i].c[0] <== pathElements[i];
        muxR[i].c[1] <== levelHash[i];
        muxR[i].s    <== pathIndices[i];

        hashers[i].inputs[0] <== muxL[i].out;
        hashers[i].inputs[1] <== muxR[i].out;
        levelHash[i + 1]     <== hashers[i].out;
    }

    root <== levelHash[depth];
}

// ── Main circuit ─────────────────────────────────────────────────────────────

template Commitment(depth) {
    // Private
    signal input secret;
    signal input amount;
    signal input pathElements[depth];
    signal input pathIndices[depth];

    // Public
    signal input root;
    signal input nullifier;

    // Step 1: commitment = Poseidon(secret, amount)
    component commitHasher = Poseidon(2);
    commitHasher.inputs[0] <== secret;
    commitHasher.inputs[1] <== amount;
    signal commitment;
    commitment <== commitHasher.out;

    // Step 2: nullifier = Poseidon(secret)  — must match public input
    component nullifierHasher = Poseidon(1);
    nullifierHasher.inputs[0] <== secret;
    nullifier === nullifierHasher.out;

    // Step 3: Merkle inclusion
    component merkle = MerkleProof(depth);
    merkle.leaf         <== commitment;
    for (var i = 0; i < depth; i++) {
        merkle.pathElements[i] <== pathElements[i];
        merkle.pathIndices[i]  <== pathIndices[i];
    }
    root === merkle.root;
}

// Depth 20 = up to 2^20 deposits (matches the Rust contract)
component main { public [root, nullifier] } = Commitment(20);
