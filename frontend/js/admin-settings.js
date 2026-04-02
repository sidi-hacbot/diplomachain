// admin-settings.js - Gestion avancée du contrat (version améliorée)

document.addEventListener('DOMContentLoaded', async () => {

        // FORCER LA CONNEXION METAMASK
    try {
        const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
        console.log("✅ MetaMask connecté:", accounts[0]);
    } catch (error) {
        console.error("❌ Erreur connexion MetaMask:", error);
        alert("Veuillez connecter MetaMask");
    }
    // URL du backend sur Render
    const API_URL = 'http://localhost:5000/api';
    
    // Récupérer l'adresse du contrat
    let contractAddress = null;
    
    try {
        // ✅ Utiliser API_URL au lieu de localhost
        const response = await fetch(`${API_URL}/contract-address`);
        const data = await response.json();
        contractAddress = data.address;
        console.log("✅ Adresse du contrat:", contractAddress);
    } catch (error) {
        console.error("❌ Erreur récupération adresse:", error);
        alert("Impossible de récupérer l'adresse du contrat");
        return;
    }

    const provider = new ethers.providers.Web3Provider(window.ethereum);
    const signer = provider.getSigner();
    
    const ABI = [
        "function paused() view returns (bool)",
        "function pause() external",
        "function unpause() external",
        "function RELAYER_ROLE() view returns (bytes32)",
        "function REVOKER_ROLE() view returns (bytes32)",
        "function grantRole(bytes32 role, address account) external",
        "function revokeRole(bytes32 role, address account) external",
        "function hasRole(bytes32 role, address account) view returns (bool)",
        "function DEFAULT_ADMIN_ROLE() view returns (bytes32)",
        "function modifierSignataire(address newSigner) external"
    ];
    
    const contract = new ethers.Contract(contractAddress, ABI, signer);
    const resultDiv = document.getElementById('result');
    
    function showResult(message, isError = false) {
        const bgColor = isError ? '#f8d7da' : '#d4edda';
        const textColor = isError ? '#721c24' : '#155724';
        resultDiv.innerHTML = `
            <div style="background: ${bgColor}; color: ${textColor}; padding: 15px; border-radius: 8px; animation: fadeIn 0.3s ease;">
                ${message}
            </div>
        `;
        setTimeout(() => {
            if (resultDiv.innerHTML.includes(message)) resultDiv.innerHTML = '';
        }, 5000);
    }
    
    // Mettre à jour les stats
    async function updateStats() {
        try {
            const paused = await contract.paused();
            const userAddress = await signer.getAddress();
            const DEFAULT_ADMIN_ROLE = await contract.DEFAULT_ADMIN_ROLE();
            const isAdmin = await contract.hasRole(DEFAULT_ADMIN_ROLE, userAddress);
            
            document.getElementById('pauseStatus').innerHTML = paused ? '⏸️ EN PAUSE' : '✅ ACTIF';
            document.getElementById('pauseStatus').style.color = paused ? '#ef4444' : '#10b981';
            document.getElementById('adminStatus').innerHTML = isAdmin ? '👑 ADMIN' : '👤 UTILISATEUR';
            document.getElementById('adminStatus').style.color = isAdmin ? '#f59e0b' : '#666';
            
            document.getElementById('relayerCount').innerHTML = '—';
        } catch (error) {
            console.error("Erreur stats:", error);
        }
    }
    
    // ============================================
    // VÉRIFIER L'ÉTAT
    // ============================================
    const checkStatusBtn = document.getElementById('checkStatusBtn');
    const statusDisplay = document.getElementById('statusDisplay');
    
    async function checkStatus() {
        statusDisplay.innerHTML = '<div class="loading-spinner"></div> Chargement...';
        try {
            const paused = await contract.paused();
            const userAddress = await signer.getAddress();
            const DEFAULT_ADMIN_ROLE = await contract.DEFAULT_ADMIN_ROLE();
            const isAdmin = await contract.hasRole(DEFAULT_ADMIN_ROLE, userAddress);
            const RELAYER_ROLE = await contract.RELAYER_ROLE();
            const hasRelayer = await contract.hasRole(RELAYER_ROLE, userAddress);
            
            statusDisplay.innerHTML = `
                <div style="background: #f8f9fa; padding: 16px; border-radius: 12px; margin-top: 15px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
                        <span>🔹 <strong>État:</strong> ${paused ? '⏸️ En pause' : '✅ Actif'}</span>
                        <span>🔹 <strong>Votre rôle:</strong> ${isAdmin ? '👑 Administrateur principal' : (hasRelayer ? '📝 RELAYER' : '👤 Simple utilisateur')}</span>
                        <span>🔹 <strong>Adresse:</strong> <code class="address-display">${userAddress.slice(0, 10)}...${userAddress.slice(-6)}</code></span>
                    </div>
                </div>
            `;
            await updateStats();
        } catch (error) {
            statusDisplay.innerHTML = `<p style="color: red;">❌ Erreur: ${error.message}</p>`;
        }
    }
    
    if (checkStatusBtn) {
        checkStatusBtn.addEventListener('click', checkStatus);
        checkStatus();
    }
    
    // ============================================
    // PAUSE / UNPAUSE
    // ============================================
    const pauseBtn = document.getElementById('pauseBtn');
    const unpauseBtn = document.getElementById('unpauseBtn');
    
    if (pauseBtn) {
        pauseBtn.addEventListener('click', async () => {
            try {
                const tx = await contract.pause();
                showResult("⏳ Transaction de pause envoyée...");
                await tx.wait();
                showResult("✅ Contrat mis en pause !");
                checkStatus();
            } catch (error) {
                showResult(`❌ Erreur: ${error.message}`, true);
            }
        });
    }
    
    if (unpauseBtn) {
        unpauseBtn.addEventListener('click', async () => {
            try {
                const tx = await contract.unpause();
                showResult("⏳ Transaction d'unpause envoyée...");
                await tx.wait();
                showResult("✅ Contrat réactivé !");
                checkStatus();
            } catch (error) {
                showResult(`❌ Erreur: ${error.message}`, true);
            }
        });
    }
    
    // ============================================
    // GESTION DES RÔLES
    // ============================================
    const roleAddress = document.getElementById('roleAddress');
    let RELAYER_ROLE, REVOKER_ROLE;
    
    try {
        RELAYER_ROLE = await contract.RELAYER_ROLE();
        REVOKER_ROLE = await contract.REVOKER_ROLE();
    } catch (error) {
        console.error("Erreur récupération rôles:", error);
    }
    
    async function handleRole(action, role, roleName) {
        const address = roleAddress.value.trim();
        if (!address) {
            showResult("❌ Entrez une adresse Ethereum", true);
            return;
        }
        if (!address.match(/^0x[a-fA-F0-9]{40}$/)) {
            showResult("❌ Adresse invalide (doit commencer par 0x et faire 42 caractères)", true);
            return;
        }
        
        try {
            let tx;
            if (action === 'grant') {
                tx = await contract.grantRole(role, address);
                showResult(`⏳ Attribution du rôle ${roleName} à ${address.slice(0, 10)}...`);
            } else {
                tx = await contract.revokeRole(role, address);
                showResult(`⏳ Retrait du rôle ${roleName} à ${address.slice(0, 10)}...`);
            }
            await tx.wait();
            showResult(`✅ Rôle ${roleName} ${action === 'grant' ? 'attribué' : 'retiré'} avec succès !`);
            roleAddress.value = '';
            checkStatus();
        } catch (error) {
            showResult(`❌ Erreur: ${error.message}`, true);
        }
    }
    
    document.getElementById('grantRelayerBtn')?.addEventListener('click', () => handleRole('grant', RELAYER_ROLE, 'RELAYER'));
    document.getElementById('revokeRelayerBtn')?.addEventListener('click', () => handleRole('revoke', RELAYER_ROLE, 'RELAYER'));
    document.getElementById('grantRevokerBtn')?.addEventListener('click', () => handleRole('grant', REVOKER_ROLE, 'REVOKER'));
    document.getElementById('revokeRevokerBtn')?.addEventListener('click', () => handleRole('revoke', REVOKER_ROLE, 'REVOKER'));
    
    // ============================================
    // MODIFIER LE SIGNATAIRE
    // ============================================
    const modifierSignataireBtn = document.getElementById('modifierSignataireBtn');
    if (modifierSignataireBtn) {
        modifierSignataireBtn.addEventListener('click', async () => {
            const newSigner = document.getElementById('newSignerAddress').value.trim();
            if (!newSigner) {
                showResult("❌ Entrez une adresse", true);
                return;
            }
            if (!newSigner.match(/^0x[a-fA-F0-9]{40}$/)) {
                showResult("❌ Adresse invalide", true);
                return;
            }
            try {
                const tx = await contract.modifierSignataire(newSigner);
                showResult(`⏳ Changement du signataire en cours...`);
                await tx.wait();
                showResult(`✅ Signataire modifié : ${newSigner.slice(0, 10)}...`);
                document.getElementById('newSignerAddress').value = '';
                checkStatus();
            } catch (error) {
                showResult(`❌ Erreur: ${error.message}`, true);
            }
        });
    }
    
    // ============================================
    // VÉRIFIER LES RÔLES
    // ============================================
    const checkAddress = document.getElementById('checkAddress');
    const roleCheckResult = document.getElementById('roleCheckResult');
    
    async function checkRole(role, roleName) {
        const address = checkAddress.value.trim();
        if (!address) {
            roleCheckResult.innerHTML = '<div class="role-check-result" style="background: #f8d7da; color: #721c24;">❌ Entrez une adresse</div>';
            return;
        }
        if (!address.match(/^0x[a-fA-F0-9]{40}$/)) {
            roleCheckResult.innerHTML = '<div class="role-check-result" style="background: #f8d7da; color: #721c24;">❌ Adresse invalide</div>';
            return;
        }
        
        roleCheckResult.innerHTML = '<div class="loading-spinner"></div> Vérification...';
        
        try {
            const hasRole = await contract.hasRole(role, address);
            roleCheckResult.innerHTML = `
                <div class="role-check-result" style="background: ${hasRole ? '#d4edda' : '#f8d7da'}; color: ${hasRole ? '#155724' : '#721c24'};">
                    🔍 ${address.slice(0, 10)}...${address.slice(-6)} : 
                    ${hasRole ? '✅ A le rôle' : '❌ N\'a pas le rôle'} <strong>${roleName}</strong>
                </div>
            `;
        } catch (error) {
            roleCheckResult.innerHTML = `<div class="role-check-result" style="background: #f8d7da; color: #721c24;">❌ Erreur: ${error.message}</div>`;
        }
    }
    
    document.getElementById('checkRelayerBtn')?.addEventListener('click', () => checkRole(RELAYER_ROLE, 'RELAYER'));
    document.getElementById('checkRevokerBtn')?.addEventListener('click', () => checkRole(REVOKER_ROLE, 'REVOKER'));
    
    // Initialiser les stats
    updateStats();
});