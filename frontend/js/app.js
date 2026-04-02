console.log("app.js chargé une fois");
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('attestationForm').addEventListener('submit', async (e) => 
    {
        e.preventDefault();
        const submitBtn = document.querySelector('#attestationForm button[type="submit"]');
        const originalText = submitBtn.textContent;

        // Désactiver le bouton
        submitBtn.disabled = true;
        submitBtn.textContent = "⏳ Envoi en cours...";
        submitBtn.style.opacity = "0.7";
        submitBtn.style.cursor = "not-allowed";
        
        // 1. Récupérer les données du formulaire
        const attestationData = 
        {
            nom: document.getElementById('nom').value.toUpperCase(),
            prenom: document.getElementById('prenom').value,
            typeAttestation: document.getElementById('typeAttestation').value,
            matricule: document.getElementById('matricule').value,
            filiere: document.getElementById('filiere').value,
            dateObtention: Math.floor(new Date(document.getElementById('dateObtention').value).getTime() / 1000),
            mention: document.getElementById('mention').value
        };
        
        // Dans submitAttestation, après avoir récupéré les fichiers
    const pdfFile = document.getElementById('pdfFile').files[0];
    const photoFile = document.getElementById('photoFile').files[0];

    // Vérifier que les fichiers existent
    if (!pdfFile || !photoFile) 
    {
        alert("Veuillez sélectionner un PDF et une photo");
        return;
    }

    // Upload
    const pdfId = await window.uploadToArweave(pdfFile, 'application/pdf');
    const photoId = await window.uploadToArweave(photoFile, photoFile.type);
        
        try 
        {
            // 3. Appeler le backend
            const response = await fetch('http://localhost:5000/api/prepare-signature', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ attestationData, pdfId, photoId })
            });
            
            const { domain, types, message, typehash } = await response.json();
            
            // 4. Signer avec MetaMask
            const provider = new ethers.providers.Web3Provider(window.ethereum);
            const signer = provider.getSigner();

            // Test de la signature EIP-712
            console.log("Domain:", domain);
            console.log("Types:", types);
            console.log("Message:", message);

            // Vérifier que les types sont dans le bon ordre
            const expectedOrder = ["nom","prenom","typeAttestation","matricule","filiere","dateObtention","mention","hashAttestation","hashPhoto","chainId","contractAddress","universiteId"];
            const actualOrder = types.Diplome.map(t => t.name);
            console.log("Ordre des champs:", actualOrder);
            console.log("Ordre attendu:", expectedOrder);
            console.log("Ordre correct?", JSON.stringify(actualOrder) === JSON.stringify(expectedOrder));

            const signature = await signer._signTypedData(domain, types, message);
            // Vérifier la signature
            const recoveredAddress = ethers.utils.verifyTypedData(domain, types, message, signature);
            console.log("Adresse récupérée de la signature:", recoveredAddress);
            console.log("Adresse qui signe:", await signer.getAddress());

            if (recoveredAddress.toLowerCase() !== (await signer.getAddress()).toLowerCase()) 
            {
                console.error("❌ La signature ne correspond pas à l'adresse !");
            } else {
                console.log("✅ Signature valide");
            }
            
            // 5. ABI minimal pour la fonction ajouter
            const contractABI = [
                "function ajouter(string nom, string prenom, string typeAttestation, string matricule, string filiere, uint256 dateObtention, string mention, string hashAttestation, string hashPhoto, bytes signature) external returns (bytes32)"
            ];
            
            const contract = new ethers.Contract(
                domain.verifyingContract,
                contractABI,
                signer
            );
            
            // 6. Envoyer la transaction
            const tx = await contract.ajouter(
                message.nom,
                message.prenom,
                message.typeAttestation,
                message.matricule,
                message.filiere,
                message.dateObtention,
                message.mention,
                message.hashAttestation,
                message.hashPhoto,
                signature,
                { gasLimit: 5000000 }
            );
            
            const receipt = await tx.wait();
            
            document.getElementById('result').innerHTML = `✅ Attestation ajoutée !<br>Transaction: ${receipt.transactionHash.slice(0, 30)}...`;
             // Succès : réactiver
            submitBtn.disabled = false;
            submitBtn.textContent = originalText;
            submitBtn.style.opacity = "1";
            submitBtn.style.cursor = "pointer";
            

        } 
        catch (error) 
        {
            console.error(error);
            document.getElementById('result').innerHTML = `❌ Erreur: ${error.message}`;
            // Erreur : réactiver
            submitBtn.disabled = false;
            submitBtn.textContent = originalText;
            submitBtn.style.opacity = "1";
            submitBtn.style.cursor = "pointer";

        }
    });

    function showResult(message, type) 
    {
        const resultDiv = document.getElementById('result');
        resultDiv.textContent = message;
        resultDiv.className = `result ${type}`;
        resultDiv.style.display = 'block';
        setTimeout(() => {
            resultDiv.style.display = 'none';
        }, 5000);
    }

    function showLoading() 
    {
        const resultDiv = document.getElementById('result');
        resultDiv.innerHTML = '<div class="loading">Traitement en cours...</div>';
        resultDiv.className = 'result info';
        resultDiv.style.display = 'block';
    }

    async function loadDiplomes() 
    {
        const container = document.getElementById('diplomesList');
        container.innerHTML = '<div class="loading">Chargement...</div>';
        
        try {
            const response = await fetch('http://localhost:5000/api/diplomes?page=0&limit=10');
            const diplomes = await response.json();
            
            if (diplomes.length === 0) {
                container.innerHTML = '<p>📭 Aucune attestation pour le moment.</p>';
                return;
            }
            
            let html = '<div style="max-height: 500px; overflow-y: auto;">';
            
            for (let i = 0; i < diplomes.length; i++) {
                const d = diplomes[i];
                // d est un tableau avec les données brutes
                const status = d[9] === 1 ? '✅ ACTIF' : '❌ RÉVOQUÉ';
            const timestamp = d[5]?.hex ? parseInt(d[5].hex, 16) : d[5];
            const date = new Date(timestamp * 1000).toLocaleDateString();
                
                html += `
                    <div style="border: 1px solid #e0e0e0; border-radius: 8px; padding: 15px; margin-bottom: 15px;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                            <strong style="font-size: 1.1em;">${d[0]} ${d[1]}</strong>
                            <span style="background: ${d[9] === 1 ? '#10b981' : '#ef4444'}; color: white; padding: 4px 8px; border-radius: 20px; font-size: 0.8em;">
                                ${status}
                            </span>
                        </div>
                        <p><strong>Matricule:</strong> ${d[3]}</p>
                        <p><strong>Filière:</strong> ${d[4]}</p>
                        <p><strong>Type:</strong> ${d[2]}</p>
                        <p><strong>Date:</strong> ${date}</p>
                        <p><strong>Mention:</strong> ${d[6]}</p>
                        <div style="margin-top: 10px;">
                            <a href="https://arweave.net/${d[7]}" target="_blank" style="color: #667eea;">📄 PDF</a> | 
                            <a href="https://arweave.net/${d[8]}" target="_blank" style="color: #667eea;">🖼️ Photo</a>
                        </div>
                    </div>
                `;
            }
            
            html += '</div>';
            container.innerHTML = html;
            
        } catch (error) {
            container.innerHTML = `<p style="color: red;">❌ Erreur: ${error.message}</p>`;
        }
    }
    // Bouton pour charger la liste
const loadBtn = document.getElementById('loadDiplomesBtn');
if (loadBtn) {
    loadBtn.addEventListener('click', () => {
        loadDiplomes();
    });
}

    // Révocation
    const revokeBtn = document.getElementById('revokeBtn');
    if (revokeBtn) {
        revokeBtn.addEventListener('click', async () => {
            const matricule = document.getElementById('revokeMatricule').value.trim();
            const typeAttestation = document.getElementById('revokeType').value;
            const resultDiv = document.getElementById('revokeResult');
            
            if (!matricule) {
                resultDiv.innerHTML = '<div style="background: #f8d7da; color: #721c24; padding: 10px; border-radius: 8px;">❌ Veuillez entrer un matricule</div>';
                return;
            }
            
            if (!window.ethereum) {
                resultDiv.innerHTML = '<div style="background: #f8d7da; color: #721c24; padding: 10px; border-radius: 8px;">❌ MetaMask non installé</div>';
                return;
            }
            
            resultDiv.innerHTML = '<div class="loading">🔍 Vérification des droits...</div>';
            
            try {
                const provider = new ethers.providers.Web3Provider(window.ethereum);
                const signer = provider.getSigner();
                const signerAddress = await signer.getAddress();
                
                // Vérifier si le compte a le rôle REVOKER_ROLE
                const contract = new ethers.Contract(
                    "0x700b6A60ce7EaaEA56F065753d8dcB9653dbAD35",
                    [
                        "function REVOKER_ROLE() view returns (bytes32)",
                        "function hasRole(bytes32 role, address account) view returns (bool)",
                        "function revoquerParMatriculeEtType(string memory _matricule, string memory _typeAttestation) external"
                    ],
                    provider
                );
                
                const REVOKER_ROLE = await contract.REVOKER_ROLE();
                const hasRole = await contract.hasRole(REVOKER_ROLE, signerAddress);
                
                if (!hasRole) {
                    resultDiv.innerHTML = '<div style="background: #f8d7da; color: #721c24; padding: 10px; border-radius: 8px;">❌ Vous n\'avez pas le droit de révoquer</div>';
                    return;
                }
                
                resultDiv.innerHTML = '<div class="loading">🔐 Préparation de la transaction...</div>';
                
                // Créer le contrat avec signer
                const contractWithSigner = new ethers.Contract(
                    "0x700b6A60ce7EaaEA56F065753d8dcB9653dbAD35",
                    [
                        "function revoquerParMatriculeEtType(string memory _matricule, string memory _typeAttestation) external"
                    ],
                    signer
                );
                
                resultDiv.innerHTML = '<div class="loading">⛓️ Envoi de la transaction...</div>';
                
                const tx = await contractWithSigner.revoquerParMatriculeEtType(matricule, typeAttestation);
                console.log("⏳ Transaction envoyée:", tx.hash);
                
                resultDiv.innerHTML = `<div class="loading">⏳ Confirmation en cours...<br>Hash: ${tx.hash.slice(0, 30)}...</div>`;
                
                const receipt = await tx.wait();
                
                resultDiv.innerHTML = `
                    <div style="background: #d4edda; color: #155724; padding: 15px; border-radius: 8px;">
                        ✅ Attestation révoquée avec succès !<br>
                        Transaction: ${receipt.transactionHash.slice(0, 30)}...
                    </div>
                `;
                
                // Réinitialiser le champ
                document.getElementById('revokeMatricule').value = '';
                
                // Recharger la liste des diplômes
                if (typeof loadDiplomes === 'function') {
                    await loadDiplomes();
                }
                
            } catch (error) {
                console.error(error);
                resultDiv.innerHTML = `<div style="background: #f8d7da; color: #721c24; padding: 10px; border-radius: 8px;">❌ Erreur: ${error.message}</div>`;
            }
        });
    }

});    