const { buildPoseidon } = require('circomlibjs');
const fs = require('fs');
const path = require('path');

class PoseidonMerkleTree {
  constructor(leaves) {
    this.leaves = leaves;
    this.layers = [];
    this.poseidon = null;
    this.F = null;
  }

  // Initialize Poseidon
  async init() {
    this.poseidon = await buildPoseidon();
    this.F = this.poseidon.F;
    await this.buildTree();
  }

  // Hash function sử dụng Poseidon
  hash(inputs) {
    // Convert inputs to field elements
    const fieldInputs = inputs.map(input => {
      if (typeof input === 'string') {
        // Convert string to BigInt
        const bytes = Buffer.from(input, 'utf8');
        let num = BigInt(0);
        for (let i = 0; i < bytes.length; i++) {
          num = (num << BigInt(8)) + BigInt(bytes[i]);
        }
        return this.F.e(num);
      }
      return this.F.e(input);
    });

    return this.F.toString(this.poseidon(fieldInputs));
  }

  // Hash một leaf node từ [UID, balance]
  hashLeaf(uid, balance) {
    // Convert UID to number representation
    const uidBytes = Buffer.from(uid, 'utf8');
    let uidNum = BigInt(0);
    for (let i = 0; i < uidBytes.length; i++) {
      uidNum = (uidNum << BigInt(8)) + BigInt(uidBytes[i]);
    }
    
    return this.hash([uidNum, BigInt(balance)]);
  }

  // Build Merkle Tree
  async buildTree() {
    // Tạo layer đầu tiên từ leaves
    let currentLayer = this.leaves.map(([uid, balance]) => ({
      hash: this.hashLeaf(uid, balance),
      uid: uid,
      balance: balance
    }));

    this.layers.push(currentLayer);

    // Build các layer tiếp theo
    while (currentLayer.length > 1) {
      const newLayer = [];
      
      for (let i = 0; i < currentLayer.length; i += 2) {
        const left = currentLayer[i];
        const right = currentLayer[i + 1] || left; // Duplicate nếu lẻ
        
        const combinedHash = this.hash([
          BigInt(left.hash),
          BigInt(right.hash)
        ]);
        
        newLayer.push({
          hash: combinedHash,
          left: left,
          right: right
        });
      }
      
      this.layers.push(newLayer);
      currentLayer = newLayer;
    }
  }

  // Get Merkle root
  getRoot() {
    if (this.layers.length === 0) return null;
    return this.layers[this.layers.length - 1][0].hash;
  }

  // Get proof cho một UID
  getProof(uid) {
    // Tìm leaf node
    const leafLayer = this.layers[0];
    let nodeIndex = leafLayer.findIndex(node => node.uid === uid);
    
    if (nodeIndex === -1) {
      return null; // UID không tồn tại
    }

    const proof = [];
    let currentNode = leafLayer[nodeIndex];

    // Duyệt từ leaf lên root
    for (let layerIndex = 0; layerIndex < this.layers.length - 1; layerIndex++) {
      const currentLayer = this.layers[layerIndex];
      const isLeftNode = nodeIndex % 2 === 0;
      const siblingIndex = isLeftNode ? nodeIndex + 1 : nodeIndex - 1;
      
      if (siblingIndex < currentLayer.length) {
        proof.push({
          hash: currentLayer[siblingIndex].hash,
          position: isLeftNode ? 'right' : 'left'
        });
      }
      
      nodeIndex = Math.floor(nodeIndex / 2);
    }

    return {
      uid: uid,
      balance: currentNode.balance,
      leafHash: currentNode.hash,
      proof: proof,
      root: this.getRoot()
    };
  }

  // Verify proof
  verifyProof(uid, balance, proof, root) {
    let computedHash = this.hashLeaf(uid, balance);
    
    for (const proofElement of proof) {
      if (proofElement.position === 'left') {
        computedHash = this.hash([
          BigInt(proofElement.hash),
          BigInt(computedHash)
        ]);
      } else {
        computedHash = this.hash([
          BigInt(computedHash),
          BigInt(proofElement.hash)
        ]);
      }
    }
    
    return computedHash === root;
  }

  // Export tree data to JSON
  exportToJSON() {
    return {
      root: this.getRoot(),
      leaves: this.leaves,
      layers: this.layers.map(layer => 
        layer.map(node => ({
          hash: node.hash,
          uid: node.uid,
          balance: node.balance
        }))
      ),
      hashFunction: 'poseidon',
      timestamp: Date.now()
    };
  }
}

// Hàm build tree từ input data
async function buildMerkleTree(input) {
  const tree = new PoseidonMerkleTree(input);
  await tree.init();
  
  // Lưu tree data vào file JSON
  const treeData = tree.exportToJSON();
  const filePath = path.join(__dirname, 'poseidon-merkle-tree-data.json');
  
  fs.writeFileSync(filePath, JSON.stringify(treeData, null, 2));
  console.log(`Poseidon Merkle tree data saved to: ${filePath}`);
  
  return tree;
}

// Hàm get proof từ UID
async function getMerkleProof(uid, treeDataPath = null) {
  let treeData;
  
  if (treeDataPath) {
    // Load tree từ file JSON
    treeData = JSON.parse(fs.readFileSync(treeDataPath, 'utf8'));
  } else {
    // Load từ file mặc định
    const defaultPath = path.join(__dirname, 'poseidon-merkle-tree-data.json');
    treeData = JSON.parse(fs.readFileSync(defaultPath, 'utf8'));
  }
  
  // Rebuild tree từ data
  const tree = new PoseidonMerkleTree(treeData.leaves);
  await tree.init();
  
  const proof = tree.getProof(uid);
  
  if (proof) {
    // Lưu proof vào file JSON
    const proofPath = path.join(__dirname, `poseidon-proof-${uid}.json`);
    fs.writeFileSync(proofPath, JSON.stringify(proof, null, 2));
    console.log(`Proof saved to: ${proofPath}`);
  }
  
  return proof;
}

// Helper function để convert UID string to field element
function uidToFieldElement(uid) {
  const bytes = Buffer.from(uid, 'utf8');
  let num = BigInt(0);
  for (let i = 0; i < bytes.length; i++) {
    num = (num << BigInt(8)) + BigInt(bytes[i]);
  }
  return num.toString();
}

// Export các hàm
module.exports = {
  buildMerkleTree,
  getMerkleProof,
  PoseidonMerkleTree,
  uidToFieldElement
};

// Ví dụ sử dụng
if (require.main === module) {
  (async () => {
    // Test data
    const input = [
      ['UID_1', 1000],
      ['UID_2', 2500],
      ['UID_3', 750],
      ['UID_4', 3000],
      ['UID_5', 1500]
    ];

    // Build tree
    console.log('Building Poseidon Merkle Tree...');
    const tree = await buildMerkleTree(input);
    console.log('Root hash:', tree.getRoot());

    // Get proof cho UID_3
    console.log('\nGetting proof for UID_3...');
    const proof = await getMerkleProof('UID_3');
    
    if (proof) {
      console.log('Proof generated successfully');
      
      // Verify proof
      const isValid = tree.verifyProof(
        proof.uid,
        proof.balance,
        proof.proof,
        proof.root
      );
      console.log('Proof verification:', isValid ? 'VALID' : 'INVALID');
    }
  })();
}

/* cách sử dụng
const { buildMerkleTree, getMerkleProof } = require('./poseidon-merkle-tree');

async function main() {
  // Build tree
  const userData = [
    ['user123', 5000],
    ['user456', 3000],
    // ...
  ];
  const tree = await buildMerkleTree(userData);

  // Get proof
  const proof = await getMerkleProof('user123');
}

main();
*/