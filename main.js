const { buildMerkleTree, getMerkleProof } = require('./tree.js');

async function main() {
  // Build tree
  const userData = [
    ['1', 5000],
    ['2', 3000],
    ['3', 4000],
    ['4', 6000],
    // ...
  ];
  const tree = await buildMerkleTree(userData);

  // Get proof
  const proof = await getMerkleProof('1');
}

main();