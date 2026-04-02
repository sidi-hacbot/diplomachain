// arweave.js - Gestion du stockage sur Arweave

let wanderConnected = false;

async function connectWanderIfNeeded() {
    if (wanderConnected) return true;
    if (!window.arweaveWallet) return false;
    
    try {
        await window.arweaveWallet.connect(['ACCESS_ADDRESS', 'SIGN_TRANSACTION', 'DISPATCH']);
        wanderConnected = true;
        console.log("✅ Wander connecté");
        return true;
    } catch (error) {
        console.error("❌ Erreur Wander:", error);
        return false;
    }
}

window.uploadToArweave = async function(file, contentType) {
    if (!file || !(file instanceof File)) {
        return `temp_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
    }

    const connected = await connectWanderIfNeeded();
    if (!connected) {
        return `temp_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
    }

    try {
        const fileBuffer = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsArrayBuffer(file);
        });

        const arweave = Arweave.init({
            host: 'arweave.net',
            port: 443,
            protocol: 'https'
        });

        let transaction = await arweave.createTransaction({ data: fileBuffer });
        transaction.addTag('Content-Type', contentType);
        transaction.addTag('Filename', file.name);
        transaction.addTag('App-Name', 'DiplomaChain');

        const result = await window.arweaveWallet.dispatch(transaction);
        return result.id;

    } catch (error) {
        console.error("Erreur Arweave:", error);
        return `temp_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
    }
};

window.getArweaveUrl = (id) => `https://arweave.net/${id}`;