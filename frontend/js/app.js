console.log("app.js chargé une fois");

document.addEventListener('DOMContentLoaded', () => {
    // URL du backend sur Render
    const API_URL = 'https://diplomachain.onrender.com/api';
    const CONTRACT_ADDRESS = '0xc266a86428314da3494395EA422AD32ec9508BCb';
    
    document.getElementById('attestationForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const submitBtn = document.querySelector('#attestationForm button[type="submit"]');
        const originalText = submitBtn.textContent;

        submitBtn.disabled = true;
        submitBtn.textContent = "⏳ Envoi en cours...";
        submitBtn.style.opacity = "0.7";
        submitBtn.style.cursor = "not-allowed";
        
        const attestationData = {
            nom: document.getElementById('nom').value.toUpperCase(),
            prenom: document.getElementById('prenom').value,
            typeAttestation: document.getElementById('typeAttestation').value,
            matricule: document.getElementById('matricule').value,
            filiere: document.getElementById('filiere').value,
            dateObtention: Math.floor(new Date(document.getElementById('dateObtention').value).getTime() / 1000),
            mention: document.getElementById('mention').value
        };
        
        const pdfFile = document.getElementById('pdfFile').files[0];
        const photoFile = document.getElementById('photoFile').files[0];

        if (!pdfFile || !photoFile) {
            alert("Veuillez sélectionner un PDF et une photo");
            submitBtn.disabled = false;
            submitBtn.textContent = originalText;
            return;
        }

        const pdfId = await window.uploadToArweave(pdfFile, 'application/pdf');
        const photoId = await window.uploadToArweave(photoFile, photoFile.type);
        
        try {
            // ✅ Utiliser API_URL
            const response = await fetch(`${API_URL}/prepare-signature`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ attestationData, pdfId, photoId })
            });
            
            const { domain, types, message } = await response.json();
            
            const provider = new ethers.providers.Web3Provider(window.ethereum);
            const signer = provider.getSigner();
            const signature = await signer._signTypedData(domain, types, message);
            
            const contractABI = [
                "function ajouter(string nom, string prenom, string typeAttestation, string matricule, string filiere, uint256 dateObtention, string mention, string hashAttestation, string hashPhoto, bytes signature) external returns (bytes32)"
            ];
            
            const contract = new ethers.Contract(domain.verifyingContract, contractABI, signer);
            
            const tx = await contract.ajouter(
                message.nom, message.prenom, message.typeAttestation,
                message.matricule, message.filiere, message.dateObtention,
                message.mention, message.hashAttestation, message.hashPhoto,
                signature,
                { gasLimit: 5000000, gasPrice: ethers.utils.parseUnits("35", "gwei") }
            );
            
            const receipt = await tx.wait();
            
            document.getElementById('result').innerHTML = `✅ Attestation ajoutée !<br>Transaction: ${receipt.transactionHash.slice(0, 30)}...`;
            
            submitBtn.disabled = false;
            submitBtn.textContent = originalText;
            submitBtn.style.opacity = "1";
            submitBtn.style.cursor = "pointer";

        } catch (error) {
            console.error(error);
            document.getElementById('result').innerHTML = `❌ Erreur: ${error.message}`;
            submitBtn.disabled = false;
            submitBtn.textContent = originalText;
            submitBtn.style.opacity = "1";
            submitBtn.style.cursor = "pointer";
        }
    });

    async function loadDiplomes() {
        const container = document.getElementById('diplomesList');
        if (!container) return;
        container.innerHTML = '<div class="loading">Chargement...</div>';
        
        try {
            // ✅ Utiliser API_URL
            const response = await fetch(`${API_URL}/diplomes?page=0&limit=10`);
            const diplomes = await response.json();
            
            if (diplomes.length === 0) {
                container.innerHTML = '<p>📭 Aucune attestation pour le moment.</p>';
                return;
            }
            
            let html = '<div style="max-height: 500px; overflow-y: auto;">';
            for (let i = 0; i < diplomes.length; i++) {
                const d = diplomes[i];
                const status = d[9] === 1 ? '✅ ACTIF' : '❌ RÉVOQUÉ';
                const timestamp = d[5]?.hex ? parseInt(d[5].hex, 16) : d[5];
                const date = new Date(timestamp * 1000).toLocaleDateString();
                
                html += `
                    <div style="border: 1px solid #e0e0e0; border-radius: 8px; padding: 15px; margin-bottom: 15px;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                            <strong>${d[0]} ${d[1]}</strong>
                            <span style="background: ${d[9] === 1 ? '#10b981' : '#ef4444'}; color: white; padding: 4px 8px; border-radius: 20px;">${status}</span>
                        </div>
                        <p><strong>Matricule:</strong> ${d[3]}</p>
                        <p><strong>Filière:</strong> ${d[4]}</p>
                        <p><strong>Type:</strong> ${d[2]}</p>
                        <p><strong>Date:</strong> ${date}</p>
                        <p><strong>Mention:</strong> ${d[6]}</p>
                        <div><a href="https://arweave.net/${d[7]}" target="_blank">📄 PDF</a> | <a href="https://arweave.net/${d[8]}" target="_blank">🖼️ Photo</a></div>
                    </div>
                `;
            }
            html += '</div>';
            container.innerHTML = html;
        } catch (error) {
            container.innerHTML = `<p style="color: red;">❌ Erreur: ${error.message}</p>`;
        }
    }
    
    const loadBtn = document.getElementById('loadDiplomesBtn');
    if (loadBtn) {
        loadBtn.addEventListener('click', loadDiplomes);
    }
    
    // Chargement initial
    loadDiplomes();

    // ============================================
    // RÉVOCATION (corrigée avec bonne adresse)
    // ============================================
    const revokeBtn = document.getElementById('revokeBtn');
    if (revokeBtn) {
        revokeBtn.addEventListener('click', async () => {
            const matricule = document.getElementById('revokeMatricule').value.trim();
            const typeAttestation = document.getElementById('revokeType').value;
            const resultDiv = document.getElementById('revokeResult');
            
            if (!matricule) {
                resultDiv.innerHTML = '<div style="background: #f8d7da; color: #721c24; padding: 10px;">❌ Entrez un matricule</div>';
                return;
            }
            
            resultDiv.innerHTML = '<div class="loading">⏳ Révocation en cours...</div>';
            
            try {
                const provider = new ethers.providers.Web3Provider(window.ethereum);
                const signer = provider.getSigner();
                const signerAddress = await signer.getAddress();
                
                // ✅ Utiliser la bonne adresse du contrat
                const contractCheck = new ethers.Contract(
                    CONTRACT_ADDRESS,
                    [
                        "function REVOKER_ROLE() view returns (bytes32)",
                        "function hasRole(bytes32 role, address account) view returns (bool)"
                    ],
                    provider
                );
                
                const REVOKER_ROLE = await contractCheck.REVOKER_ROLE();
                const hasRole = await contractCheck.hasRole(REVOKER_ROLE, signerAddress);
                
                if (!hasRole) {
                    resultDiv.innerHTML = '<div style="background: #f8d7da; color: #721c24; padding: 10px;">❌ Vous n\'avez pas le droit de révoquer</div>';
                    return;
                }
                
                const contractWithSigner = new ethers.Contract(
                    CONTRACT_ADDRESS,
                    ["function revoquerParMatriculeEtType(string,string) external"],
                    signer
                );
                
                const tx = await contractWithSigner.revoquerParMatriculeEtType(
                    matricule, typeAttestation,
                    { gasLimit: 3000000, gasPrice: ethers.utils.parseUnits("35", "gwei") }
                );
                
                const receipt = await tx.wait();
                
                resultDiv.innerHTML = `
                    <div style="background: #d4edda; color: #155724; padding: 15px;">
                        ✅ Attestation révoquée !<br>
                        Transaction: ${receipt.transactionHash.slice(0, 30)}...
                    </div>
                `;
                document.getElementById('revokeMatricule').value = '';
                await loadDiplomes();
                
            } catch (error) {
                console.error(error);
                resultDiv.innerHTML = `<div style="background: #f8d7da; color: #721c24; padding: 10px;">❌ Erreur: ${error.message}</div>`;
            }
        });
    }
});