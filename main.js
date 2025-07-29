const { buildMerkleTree, getMerkleProof } = require('./tree.js');

async function main() {
  // Build tree
  const userData = [
    ['1', 5210],
    ['2', 1200],
    ['3', 3000],
    ['4', 33000],
    // ...
  ];
  const tree = await buildMerkleTree(userData);

  // Get proof
  const proof = await getMerkleProof('3');
}

main();